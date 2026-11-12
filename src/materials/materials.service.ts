import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type MaterialStatus } from '../generated/prisma/client';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { FindMaterialsQueryDto } from './dto/find-materials-query.dto';
import { PrismaService } from '../prisma.service';
import { actingUserId, type AuthContext } from '../auth/auth-context';
import { userSummarySelect } from '../users/public-user.select';
import { SmartAlertsService } from '../smart-alerts/smart-alerts.service';

const withSeller = { seller: { select: userSummarySelect } } as const;

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smartAlerts: SmartAlertsService,
  ) {}

  /**
   * Publishes a listing. Idempotent when the request carries a `clientId`: a repeat of the same
   * listing (the app resends one it saved offline, or a response was lost) returns the material
   * that already exists, with no second row and no second round of smart-match notifications.
   */
  async create(createMaterialDto: CreateMaterialDto, auth: AuthContext) {
    const sellerId = actingUserId(auth, createMaterialDto.sellerId, 'sellerId');
    const { clientId } = createMaterialDto;

    if (clientId) {
      const existing = await this.findByClientId(clientId, sellerId);
      if (existing) return existing;
    }

    let material: Prisma.MaterialGetPayload<{ include: typeof withSeller }>;
    try {
      material = await this.prisma.material.create({
        data: { ...createMaterialDto, sellerId },
        include: withSeller,
      });
    } catch (error) {
      // Two retries of the same listing arrived together and both passed the check above: the
      // unique index let one in, and this one returns what that one created.
      if (clientId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.findByClientId(clientId, sellerId);
        if (existing) return existing;
      }
      throw error;
    }
    // The listing is already published: a failure here must not turn into an error for the seller.
    await this.smartAlerts.notifyMatches(material).catch((error: unknown) => {
      this.logger.warn(`Smart match notifications failed for material ${material.id}: ${String(error)}`);
    });
    return material;
  }

  /** The listing created for [clientId], if any. It must be [sellerId]'s: it is never shown to someone else. */
  private async findByClientId(clientId: string, sellerId: string) {
    const existing = await this.prisma.material.findUnique({ where: { clientId }, include: withSeller });
    if (!existing) return null;
    if (existing.sellerId !== sellerId) throw new ConflictException('This clientId is already used by another listing');
    return existing;
  }

  findAll({ sellerId }: FindMaterialsQueryDto) {
    return this.prisma.material.findMany({
      where: { sellerId },
      include: withSeller,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, auth: AuthContext) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      // Chat rooms reveal who else asked about the item, so only the dashboard gets them.
      include: { ...withSeller, ...(auth.isAdmin && { chatRooms: true }) },
    });
    if (!material) throw new NotFoundException(`Material ${id} not found`);
    return material;
  }

  async update(id: string, updateMaterialDto: UpdateMaterialDto, auth: AuthContext) {
    const material = await this.ensureCanModify(id, auth);
    // Ownership can't be transferred through the app, and clientId only identifies the first publish.
    const { sellerId, ...changes } = updateMaterialDto;
    delete changes.clientId;
    if (!auth.isAdmin) await this.assertSellerCanEdit(id, material.status, changes);
    return this.prisma.material.update({
      where: { id },
      data: auth.isAdmin ? { ...changes, sellerId } : changes,
      include: withSeller,
    });
  }

  async remove(id: string, auth: AuthContext) {
    await this.ensureCanModify(id, auth);
    return this.prisma.material.delete({ where: { id } });
  }

  private async ensureCanModify(id: string, auth: AuthContext) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      select: { sellerId: true, status: true },
    });
    if (!material) throw new NotFoundException(`Material ${id} not found`);
    if (!auth.isAdmin && material.sellerId !== auth.userId) {
      throw new ForbiddenException('Only the seller can change this listing');
    }
    return material;
  }

  /**
   * The status of a listing follows its orders (ordered, completed, cancelled), never the seller's hand,
   * and a listing that is reserved, sold or has a pending order is frozen: changing its price or
   * putting it back on the market could sell the same item twice and count it twice in BQ15.
   */
  private async assertSellerCanEdit(id: string, status: MaterialStatus, changes: Pick<UpdateMaterialDto, 'status'>) {
    if (changes.status !== undefined) {
      throw new ForbiddenException('The status of a listing changes with its orders, it cannot be set by hand');
    }
    const pendingOrders = await this.prisma.exchange.count({ where: { materialId: id, status: 'PENDING' } });
    if (status !== 'AVAILABLE' || pendingOrders > 0) {
      throw new ConflictException('This listing is reserved or sold, or has a pending order, so it cannot be edited');
    }
  }
}

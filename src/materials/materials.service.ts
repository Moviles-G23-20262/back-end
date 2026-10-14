import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  async create(createMaterialDto: CreateMaterialDto, auth: AuthContext) {
    const sellerId = actingUserId(auth, createMaterialDto.sellerId, 'sellerId');
    const material = await this.prisma.material.create({
      data: { ...createMaterialDto, sellerId },
      include: withSeller,
    });
    // The listing is already published: a failure here must not turn into an error for the seller.
    await this.smartAlerts.notifyMatches(material).catch((error: unknown) => {
      this.logger.warn(`Smart match notifications failed for material ${material.id}: ${String(error)}`);
    });
    return material;
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
    await this.ensureCanModify(id, auth);
    // Ownership can't be transferred through the app.
    const { sellerId, ...changes } = updateMaterialDto;
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
      select: { sellerId: true },
    });
    if (!material) throw new NotFoundException(`Material ${id} not found`);
    if (!auth.isAdmin && material.sellerId !== auth.userId) {
      throw new ForbiddenException('Only the seller can change this listing');
    }
  }
}

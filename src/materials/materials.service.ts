import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { FindMaterialsQueryDto } from './dto/find-materials-query.dto';
import { PrismaService } from '../prisma.service';
import { actingUserId, type AuthContext } from '../auth/auth-context';
import { userSummarySelect } from '../users/public-user.select';

const withSeller = { seller: { select: userSummarySelect } } as const;

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createMaterialDto: CreateMaterialDto, auth: AuthContext) {
    const sellerId = actingUserId(auth, createMaterialDto.sellerId, 'sellerId');
    return this.prisma.material.create({
      data: { ...createMaterialDto, sellerId },
      include: withSeller,
    });
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

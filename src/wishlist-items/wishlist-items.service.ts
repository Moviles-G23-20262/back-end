import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';
import { UpdateWishlistItemDto } from './dto/update-wishlist-item.dto';
import { PrismaService } from '../prisma.service';
import { actingUserId, assertSelfOrAdmin, requireUserId, type AuthContext } from '../auth/auth-context';
import { userSummarySelect } from '../users/public-user.select';

const details = {
  user: { select: userSummarySelect },
  material: { include: { seller: { select: userSummarySelect } } },
} as const;

@Injectable()
export class WishlistItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Saving the same listing twice is a no-op that returns the existing item. */
  create(createWishlistItemDto: CreateWishlistItemDto, auth: AuthContext) {
    const userId = actingUserId(auth, createWishlistItemDto.userId, 'userId');
    const { materialId } = createWishlistItemDto;
    return this.prisma.wishlistItem.upsert({
      where: { userId_materialId: { userId, materialId } },
      create: { userId, materialId },
      update: {},
      include: details,
    });
  }

  findAll(auth: AuthContext) {
    return this.prisma.wishlistItem.findMany({
      where: auth.isAdmin ? undefined : { userId: requireUserId(auth) },
      include: details,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, auth: AuthContext) {
    const item = await this.prisma.wishlistItem.findUnique({ where: { id }, include: details });
    if (!item) throw new NotFoundException(`Wishlist item ${id} not found`);
    assertSelfOrAdmin(auth, item.userId);
    return item;
  }

  async update(id: string, updateWishlistItemDto: UpdateWishlistItemDto) {
    await this.ensureExists(id);
    return this.prisma.wishlistItem.update({
      where: { id },
      data: updateWishlistItemDto,
      include: details,
    });
  }

  async remove(id: string, auth: AuthContext) {
    const item = await this.prisma.wishlistItem.findUnique({ where: { id }, select: { userId: true } });
    if (!item) throw new NotFoundException(`Wishlist item ${id} not found`);
    assertSelfOrAdmin(auth, item.userId);
    return this.prisma.wishlistItem.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.wishlistItem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Wishlist item ${id} not found`);
  }
}

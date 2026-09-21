import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';
import { UpdateWishlistItemDto } from './dto/update-wishlist-item.dto';

@Injectable()
export class WishlistItemsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createWishlistItemDto: CreateWishlistItemDto) {
    return this.prisma.wishlistItem.create({
      data: createWishlistItemDto,
      include: { user: true, material: true },
    });
  }

  findAll() {
    return this.prisma.wishlistItem.findMany({
      include: { user: true, material: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.wishlistItem.findUnique({
      where: { id },
      include: { user: true, material: true },
    });
    if (!item) throw new NotFoundException(`Wishlist item ${id} not found`);
    return item;
  }

  async update(id: string, updateWishlistItemDto: UpdateWishlistItemDto) {
    await this.ensureExists(id);
    return this.prisma.wishlistItem.update({
      where: { id },
      data: updateWishlistItemDto,
      include: { user: true, material: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.wishlistItem.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.wishlistItem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Wishlist item ${id} not found`);
  }
}

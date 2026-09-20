import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MaterialsService {

  constructor(private readonly prisma: PrismaService) {}

  create(createMaterialDto: CreateMaterialDto) {
    return this.prisma.material.create({
      data: createMaterialDto,
      include: { seller: true },
    });
  }

  findAll() {
    return this.prisma.material.findMany({
      include: { seller: true },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: { seller: true, chatRooms: true },
    });
    if (!material) throw new NotFoundException(`Material ${id} not found`);
    return material;
  }

  async update(id: string, updateMaterialDto: UpdateMaterialDto) {
    await this.ensureExists(id);
    return this.prisma.material.update({
      where: { id },
      data: updateMaterialDto,
      include: { seller: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.material.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.material.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Material ${id} not found`);
  }
}

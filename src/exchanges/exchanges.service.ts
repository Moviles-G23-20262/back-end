import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateExchangeDto } from './dto/create-exchange.dto';
import { UpdateExchangeDto } from './dto/update-exchange.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ExchangesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createExchangeDto: CreateExchangeDto) {
    if (createExchangeDto.buyerId === createExchangeDto.sellerId) {
      throw new BadRequestException('Buyer and seller must be different users');
    }

    return this.prisma.exchange.create({
      data: createExchangeDto,
      include: { material: true, buyer: true, seller: true },
    });
  }

  findAll() {
    return this.prisma.exchange.findMany({
      include: { material: true, buyer: true, seller: true },
      orderBy: { completedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const exchange = await this.prisma.exchange.findUnique({
      where: { id },
      include: { material: true, buyer: true, seller: true },
    });
    if (!exchange) throw new NotFoundException(`Exchange ${id} not found`);
    return exchange;
  }

  async update(id: string, updateExchangeDto: UpdateExchangeDto) {
    await this.ensureExists(id);
    if (
      updateExchangeDto.buyerId &&
      updateExchangeDto.sellerId &&
      updateExchangeDto.buyerId === updateExchangeDto.sellerId
    ) {
      throw new BadRequestException('Buyer and seller must be different users');
    }

    return this.prisma.exchange.update({
      where: { id },
      data: updateExchangeDto,
      include: { material: true, buyer: true, seller: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.exchange.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.exchange.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Exchange ${id} not found`);
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateExchangeDto } from './dto/create-exchange.dto';
import { UpdateExchangeDto } from './dto/update-exchange.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ExchangesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createExchangeDto: CreateExchangeDto) {
    if (createExchangeDto.buyerId === createExchangeDto.sellerId) {
      throw new BadRequestException('Buyer and seller must be different users');
    }
    await this.validateLocation(createExchangeDto);

    return this.prisma.exchange.create({
      data: createExchangeDto,
      include: { material: true, buyer: true, seller: true, meetingPoint: true },
    });
  }

  findAll() {
    return this.prisma.exchange.findMany({
      include: { material: true, buyer: true, seller: true, meetingPoint: true },
      orderBy: { completedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const exchange = await this.prisma.exchange.findUnique({
      where: { id },
      include: { material: true, buyer: true, seller: true, meetingPoint: true },
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
    await this.validateLocation(updateExchangeDto);

    return this.prisma.exchange.update({
      where: { id },
      data: updateExchangeDto,
      include: { material: true, buyer: true, seller: true, meetingPoint: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.exchange.delete({ where: { id } });
  }

  private async validateLocation(dto: UpdateExchangeDto) {
    if ((dto.lat === undefined) !== (dto.lng === undefined)) {
      throw new BadRequestException('lat and lng must be sent together');
    }
    if (!dto.meetingPointId) return;
    const point = await this.prisma.meetingPoint.findUnique({
      where: { id: dto.meetingPointId },
      select: { id: true },
    });
    if (!point) throw new BadRequestException(`Meeting point ${dto.meetingPointId} not found`);
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.exchange.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Exchange ${id} not found`);
  }
}

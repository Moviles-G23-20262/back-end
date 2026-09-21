import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';
import { UpdateAnalyticsEventDto } from './dto/update-analytics-event.dto';

@Injectable()
export class AnalyticsEventsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createAnalyticsEventDto: CreateAnalyticsEventDto) {
    return this.prisma.analyticsEvent.create({
      data: this.toCreateData(createAnalyticsEventDto),
      include: { user: true, material: true },
    });
  }

  findAll() {
    return this.prisma.analyticsEvent.findMany({
      include: { user: true, material: true },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.analyticsEvent.findUnique({
      where: { id },
      include: { user: true, material: true },
    });
    if (!event) throw new NotFoundException(`Analytics event ${id} not found`);
    return event;
  }

  async update(id: string, updateAnalyticsEventDto: UpdateAnalyticsEventDto) {
    await this.ensureExists(id);
    return this.prisma.analyticsEvent.update({
      where: { id },
      data: this.toUpdateData(updateAnalyticsEventDto),
      include: { user: true, material: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.analyticsEvent.delete({ where: { id } });
  }

  private toCreateData(
    dto: CreateAnalyticsEventDto,
  ): Prisma.AnalyticsEventUncheckedCreateInput {
    return {
      ...dto,
      metadata: this.toJsonObject(dto.metadata),
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
    };
  }

  private toUpdateData(
    dto: UpdateAnalyticsEventDto,
  ): Prisma.AnalyticsEventUncheckedUpdateInput {
    return {
      ...dto,
      metadata: dto.metadata ? { set: this.toJsonObject(dto.metadata) } : undefined,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
    };
  }

  private toJsonObject(metadata?: Record<string, unknown>): Prisma.InputJsonObject | undefined {
    if (!metadata) return undefined;
    return metadata as Prisma.InputJsonObject;
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.analyticsEvent.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Analytics event ${id} not found`);
  }
}

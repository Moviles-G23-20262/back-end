import { Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';
import {
  BatchAnalyticsEventItemDto,
  BatchAnalyticsEventsResult,
  RejectedAnalyticsEvent,
} from './dto/batch-analytics-events.dto';
import type { AuthContext } from '../auth/auth-context';
import { userSummarySelect } from '../users/public-user.select';

const details = { user: { select: userSummarySelect }, material: true } as const;
import { UpdateAnalyticsEventDto } from './dto/update-analytics-event.dto';

@Injectable()
export class AnalyticsEventsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createAnalyticsEventDto: CreateAnalyticsEventDto, auth: AuthContext) {
    // From the app an event always belongs to the signed-in user.
    const dto = auth.isAdmin ? createAnalyticsEventDto : { ...createAnalyticsEventDto, userId: auth.userId };
    return this.prisma.analyticsEvent.create({
      data: this.toCreateData(dto),
      include: details,
    });
  }

  /**
   * Stores the events the app queued while offline. Idempotent: `client_id` is unique, so a batch
   * the phone resends (lost response, crash before it cleared its queue) creates no second row.
   * An invalid event is reported in `rejected` and skipped; the rest of the batch is still stored.
   */
  async createBatch(events: unknown[], auth: AuthContext): Promise<BatchAnalyticsEventsResult> {
    const rejected: RejectedAnalyticsEvent[] = [];
    const valid: BatchAnalyticsEventItemDto[] = [];
    const seen = new Set<string>();

    for (const [index, raw] of events.entries()) {
      const item = plainToInstance(BatchAnalyticsEventItemDto, raw);
      const errors = typeof raw === 'object' && raw !== null ? await validate(item, { whitelist: true }) : [];
      if (typeof raw !== 'object' || raw === null || errors.length > 0) {
        rejected.push({
          index,
          client_id: (raw as { client_id?: string } | null)?.client_id,
          reason: errors.flatMap((e) => Object.values(e.constraints ?? {})).join('; ') || 'Not an object',
        });
      } else if (seen.has(item.client_id)) {
        rejected.push({ index, client_id: item.client_id, reason: 'Repeated inside the batch' });
      } else {
        seen.add(item.client_id);
        valid.push(item);
      }
    }

    // A listing deleted since the event was queued must not make the insert fail on the foreign key.
    const materialIds = [...new Set(valid.flatMap((e) => (e.materialId ? [e.materialId] : [])))];
    const existing = new Set(
      materialIds.length
        ? (await this.prisma.material.findMany({ where: { id: { in: materialIds } }, select: { id: true } })).map((m) => m.id)
        : [],
    );

    const { count } = await this.prisma.analyticsEvent.createMany({
      data: valid.map((e) => ({
        clientId: e.client_id,
        // From the app an event always belongs to the signed-in user.
        userId: auth.isAdmin ? e.userId : auth.userId,
        materialId: e.materialId && existing.has(e.materialId) ? e.materialId : undefined,
        eventType: e.eventType,
        metadata: this.toJsonObject(e.metadata),
        occurredAt: new Date(e.occurredAt ?? e.clientCreatedAt),
        clientCreatedAt: new Date(e.clientCreatedAt),
      })),
      skipDuplicates: true,
    });

    return { received: events.length, created: count, duplicates: valid.length - count, rejected };
  }

  findAll() {
    return this.prisma.analyticsEvent.findMany({
      include: details,
      orderBy: { occurredAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.analyticsEvent.findUnique({
      where: { id },
      include: details,
    });
    if (!event) throw new NotFoundException(`Analytics event ${id} not found`);
    return event;
  }

  async update(id: string, updateAnalyticsEventDto: UpdateAnalyticsEventDto) {
    await this.ensureExists(id);
    return this.prisma.analyticsEvent.update({
      where: { id },
      data: this.toUpdateData(updateAnalyticsEventDto),
      include: details,
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

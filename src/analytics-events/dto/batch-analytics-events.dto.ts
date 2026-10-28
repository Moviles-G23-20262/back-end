import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsISO8601, IsObject, IsOptional, IsUUID } from 'class-validator';
import { AnalyticsEventType } from '../../generated/prisma/client';

/** The most events one request may carry. The app sends 10; the rest is headroom. */
export const MAX_BATCH_SIZE = 100;

/**
 * One line of the app's `pending.jsonl`. The body is only checked as an array here: each event
 * is validated on its own (see `AnalyticsEventsService.createBatch`), so one malformed event
 * is reported back instead of failing the whole batch, which the phone would retry forever.
 */
export class BatchAnalyticsEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH_SIZE)
  events!: unknown[];
}

export class BatchAnalyticsEventItemDto {
  /** UUIDv4 made by the phone: the same event sent twice is stored once. */
  @IsUUID()
  client_id!: string;

  @IsEnum(AnalyticsEventType)
  eventType!: AnalyticsEventType;

  @IsOptional()
  @IsUUID()
  materialId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  /** When the phone really created the event, even if it arrives much later. */
  @IsISO8601()
  clientCreatedAt!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export interface RejectedAnalyticsEvent {
  index: number;
  client_id?: string;
  reason: string;
}

export interface BatchAnalyticsEventsResult {
  received: number;
  /** Stored by this request. */
  created: number;
  /** Already stored by an earlier attempt; ignored. */
  duplicates: number;
  rejected: RejectedAnalyticsEvent[];
}

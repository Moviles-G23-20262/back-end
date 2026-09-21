import { IsEnum, IsISO8601, IsObject, IsOptional, IsUUID } from 'class-validator';
import { AnalyticsEventType } from '../../generated/prisma/client';

export class CreateAnalyticsEventDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  materialId?: string;

  @IsEnum(AnalyticsEventType)
  eventType!: AnalyticsEventType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

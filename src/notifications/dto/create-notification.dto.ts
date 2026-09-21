import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { NotificationType } from '../../generated/prisma/client';

export class CreateNotificationDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  materialId?: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsOptional()
  @IsISO8601()
  openedAt?: string;
}

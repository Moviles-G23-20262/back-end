import { IsEnum, IsNumber, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { ExchangeStatus } from '../../generated/prisma/client';

export class CreateExchangeDto {
  @IsUUID()
  materialId!: string;

  @IsUUID()
  buyerId!: string;

  @IsUUID()
  sellerId!: string;

  @Matches(/^\d+(\.\d{1,2})?$/)
  price!: string;

  /** Exchanges recorded from the dashboard are finished sales unless said otherwise. */
  @IsOptional()
  @IsEnum(ExchangeStatus)
  status?: ExchangeStatus;

  @IsOptional()
  @IsUUID()
  meetingPointId?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

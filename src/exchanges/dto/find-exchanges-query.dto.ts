import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ExchangeStatus } from '../../generated/prisma/client';

export class FindExchangesQueryDto {
  @IsOptional()
  @IsUUID()
  materialId?: string;

  @IsOptional()
  @IsEnum(ExchangeStatus)
  status?: ExchangeStatus;
}

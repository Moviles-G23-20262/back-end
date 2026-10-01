import { IsOptional, IsUUID } from 'class-validator';

export class FindRatingsQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  exchangeId?: string;
}
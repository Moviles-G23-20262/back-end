import { IsNumber, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

export class CreateExchangeDto {
  @IsUUID()
  materialId!: string;

  @IsUUID()
  buyerId!: string;

  @IsUUID()
  sellerId!: string;

  @Matches(/^\d+(\.\d{1,2})?$/)
  price!: string;

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

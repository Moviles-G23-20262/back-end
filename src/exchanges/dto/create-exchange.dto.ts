import { IsUUID, Matches } from 'class-validator';

export class CreateExchangeDto {
  @IsUUID()
  materialId!: string;

  @IsUUID()
  buyerId!: string;

  @IsUUID()
  sellerId!: string;

  @Matches(/^\d+(\.\d{1,2})?$/)
  price!: string;
}

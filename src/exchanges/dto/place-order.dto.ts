import { IsUUID } from 'class-validator';

export class PlaceOrderDto {
  @IsUUID()
  materialId!: string;
}

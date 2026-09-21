import { IsUUID } from 'class-validator';

export class CreateWishlistItemDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  materialId!: string;
}

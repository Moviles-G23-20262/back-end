import { IsUUID } from 'class-validator';

export class CreateChatroomDto {
  @IsUUID()
  materialId!: string;

  @IsUUID()
  buyerId!: string;

  @IsUUID()
  sellerId!: string;
}

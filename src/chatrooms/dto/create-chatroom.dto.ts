import { IsOptional, IsUUID } from 'class-validator';

export class CreateChatroomDto {
  @IsUUID()
  materialId!: string;

  // App users are always the buyer and the seller is the material's owner;
  // only admins (dashboard) have to send these two.
  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;
}

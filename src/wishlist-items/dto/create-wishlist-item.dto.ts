import { IsOptional, IsUUID } from 'class-validator';

export class CreateWishlistItemDto {
  // App users always save for themselves; only admins (dashboard) have to send it.
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsUUID()
  materialId!: string;
}

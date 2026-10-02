import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  chatRoomId!: string;

  // App users always send as themselves; only admins (dashboard) have to send it.
  @IsOptional()
  @IsUUID()
  senderId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}

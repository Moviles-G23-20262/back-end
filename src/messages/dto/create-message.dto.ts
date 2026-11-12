import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Trim } from '../../common/validation';

export class CreateMessageDto {
  @IsUUID()
  chatRoomId!: string;

  // App users always send as themselves; only admins (dashboard) have to send it.
  @IsOptional()
  @IsUUID()
  senderId?: string;

  // A message of only spaces is empty once trimmed.
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}

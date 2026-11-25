import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Trim } from '../../common/validation';

export class CreateMessageDto {
  // Optional client-generated UUID so offline outbox retries are idempotent and never duplicate messages.
  @IsOptional()
  @IsUUID()
  id?: string;

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

  // When a message was written offline, keeps its true creation time (clamped in MessagesService)
  // so BQ4 time-to-agreement does not count time spent waiting for Wi-Fi.
  @IsOptional()
  @IsDateString()
  clientCreatedAt?: string;
}

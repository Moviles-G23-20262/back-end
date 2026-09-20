import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  chatRoomId!: string;

  @IsUUID()
  senderId!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}

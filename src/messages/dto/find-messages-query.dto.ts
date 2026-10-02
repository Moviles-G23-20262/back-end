import { IsOptional, IsUUID } from 'class-validator';

export class FindMessagesQueryDto {
  @IsOptional()
  @IsUUID()
  chatRoomId?: string;
}

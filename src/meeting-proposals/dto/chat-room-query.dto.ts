import { IsUUID } from 'class-validator';

export class ChatRoomQueryDto {
  @IsUUID()
  chatRoomId!: string;
}

import { IsOptional, IsUUID } from 'class-validator';

export class FindMeetingProposalsQueryDto {
  /** Required for app users; admins may list every proposal. */
  @IsOptional()
  @IsUUID()
  chatRoomId?: string;
}

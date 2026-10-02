import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateMeetingProposalDto {
  @IsUUID()
  chatRoomId!: string;

  // App users always propose as themselves; only admins (dashboard) have to send it.
  @IsOptional()
  @IsUUID()
  proposerId?: string;

  @IsUUID()
  meetingPointId!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}

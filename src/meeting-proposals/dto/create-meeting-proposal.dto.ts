import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateMeetingProposalDto {
  // A retry reuses this identifier so it returns the proposal already created.
  @IsOptional()
  @IsUUID()
  clientId?: string;

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

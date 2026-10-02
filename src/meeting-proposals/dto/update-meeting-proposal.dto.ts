import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { MeetingProposalStatus } from '../../generated/prisma/client';

/** Dashboard corrections; the app answers proposals through accept / decline / cancel. */
export class UpdateMeetingProposalDto {
  @IsOptional()
  @IsUUID()
  meetingPointId?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsEnum(MeetingProposalStatus)
  status?: MeetingProposalStatus;
}

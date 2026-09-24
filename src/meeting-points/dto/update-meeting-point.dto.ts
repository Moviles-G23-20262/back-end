import { PartialType } from '@nestjs/swagger';
import { CreateMeetingPointDto } from './create-meeting-point.dto';

export class UpdateMeetingPointDto extends PartialType(CreateMeetingPointDto) {}

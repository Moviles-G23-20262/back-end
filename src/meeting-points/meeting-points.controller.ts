import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { MeetingPointsService } from './meeting-points.service';

@Controller('meeting-points')
export class MeetingPointsController {
  constructor(private readonly meetingPointsService: MeetingPointsService) {}

  @Get()
  findAll() {
    return this.meetingPointsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetingPointsService.findOne(id);
  }
}

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CreateMeetingPointDto } from './dto/create-meeting-point.dto';
import { UpdateMeetingPointDto } from './dto/update-meeting-point.dto';
import { MeetingPointsService } from './meeting-points.service';

@Controller('meeting-points')
export class MeetingPointsController {
  constructor(private readonly meetingPointsService: MeetingPointsService) {}

  @Post()
  create(@Body() createMeetingPointDto: CreateMeetingPointDto) {
    return this.meetingPointsService.create(createMeetingPointDto);
  }

  @Get()
  findAll() {
    return this.meetingPointsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetingPointsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateMeetingPointDto: UpdateMeetingPointDto) {
    return this.meetingPointsService.update(id, updateMeetingPointDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetingPointsService.remove(id);
  }
}

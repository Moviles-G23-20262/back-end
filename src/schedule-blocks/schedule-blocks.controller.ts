import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateScheduleBlockDto } from './dto/create-schedule-block.dto';
import { FindScheduleBlocksQueryDto } from './dto/find-schedule-blocks-query.dto';
import { UpdateScheduleBlockDto } from './dto/update-schedule-block.dto';
import { ScheduleBlocksService } from './schedule-blocks.service';
import { AdminOnly, Auth } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth-context';

@Controller('schedule-blocks')
export class ScheduleBlocksController {
  constructor(private readonly scheduleBlocksService: ScheduleBlocksService) {}

  @Post()
  create(@Body() createScheduleBlockDto: CreateScheduleBlockDto, @Auth() auth: AuthContext) {
    return this.scheduleBlocksService.create(createScheduleBlockDto, auth);
  }

  @Get()
  findAll(@Query() query: FindScheduleBlocksQueryDto, @Auth() auth: AuthContext) {
    return this.scheduleBlocksService.findAll(query, auth);
  }

  @AdminOnly()
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateScheduleBlockDto: UpdateScheduleBlockDto) {
    return this.scheduleBlocksService.update(id, updateScheduleBlockDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.scheduleBlocksService.remove(id, auth);
  }
}

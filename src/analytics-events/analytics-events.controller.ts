import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AnalyticsEventsService } from './analytics-events.service';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';
import { UpdateAnalyticsEventDto } from './dto/update-analytics-event.dto';
import { AdminOnly, Auth } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth-context';

@Controller('analytics-events')
export class AnalyticsEventsController {
  constructor(private readonly analyticsEventsService: AnalyticsEventsService) {}

  @Post()
  create(@Body() createAnalyticsEventDto: CreateAnalyticsEventDto, @Auth() auth: AuthContext) {
    return this.analyticsEventsService.create(createAnalyticsEventDto, auth);
  }

  @AdminOnly()
  @Get()
  findAll() {
    return this.analyticsEventsService.findAll();
  }

  @AdminOnly()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.analyticsEventsService.findOne(id);
  }

  @AdminOnly()
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAnalyticsEventDto: UpdateAnalyticsEventDto,
  ) {
    return this.analyticsEventsService.update(id, updateAnalyticsEventDto);
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.analyticsEventsService.remove(id);
  }
}

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AnalyticsEventsService } from './analytics-events.service';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';
import { UpdateAnalyticsEventDto } from './dto/update-analytics-event.dto';

@Controller('analytics-events')
export class AnalyticsEventsController {
  constructor(private readonly analyticsEventsService: AnalyticsEventsService) {}

  @Post()
  create(@Body() createAnalyticsEventDto: CreateAnalyticsEventDto) {
    return this.analyticsEventsService.create(createAnalyticsEventDto);
  }

  @Get()
  findAll() {
    return this.analyticsEventsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.analyticsEventsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAnalyticsEventDto: UpdateAnalyticsEventDto,
  ) {
    return this.analyticsEventsService.update(id, updateAnalyticsEventDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.analyticsEventsService.remove(id);
  }
}

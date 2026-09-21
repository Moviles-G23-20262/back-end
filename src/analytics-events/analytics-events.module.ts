import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { AnalyticsEventsController } from './analytics-events.controller';
import { AnalyticsEventsService } from './analytics-events.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsEventsController],
  providers: [AnalyticsEventsService],
})
export class AnalyticsEventsModule {}

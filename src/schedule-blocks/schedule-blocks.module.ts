import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { ScheduleBlocksController } from './schedule-blocks.controller';
import { ScheduleBlocksService } from './schedule-blocks.service';

@Module({
  imports: [PrismaModule],
  controllers: [ScheduleBlocksController],
  providers: [ScheduleBlocksService],
})
export class ScheduleBlocksModule {}

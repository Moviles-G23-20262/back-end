import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { MeetingPointsController } from './meeting-points.controller';
import { MeetingPointsService } from './meeting-points.service';

@Module({
  imports: [PrismaModule],
  controllers: [MeetingPointsController],
  providers: [MeetingPointsService],
})
export class MeetingPointsModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { MeetingProposalsController } from './meeting-proposals.controller';
import { MeetingProposalsService } from './meeting-proposals.service';

@Module({
  imports: [PrismaModule],
  controllers: [MeetingProposalsController],
  providers: [MeetingProposalsService],
})
export class MeetingProposalsModule {}

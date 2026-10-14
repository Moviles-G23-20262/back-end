import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { SmartAlertsController } from './smart-alerts.controller';
import { SmartAlertsService } from './smart-alerts.service';

@Module({
  imports: [PrismaModule],
  controllers: [SmartAlertsController],
  providers: [SmartAlertsService],
  // Materials uses it to notify matches when a listing is published.
  exports: [SmartAlertsService],
})
export class SmartAlertsModule {}

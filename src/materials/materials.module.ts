import { Module } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { MaterialsController } from './materials.controller';
import { PrismaModule } from '../prisma.module';
import { SmartAlertsModule } from '../smart-alerts/smart-alerts.module';

@Module({
  controllers: [MaterialsController],
  providers: [MaterialsService],
  imports: [PrismaModule, SmartAlertsModule],
})
export class MaterialsModule {}

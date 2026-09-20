import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { SqlController } from './sql.controller';
import { SqlService } from './sql.service';

@Module({
  imports: [PrismaModule],
  controllers: [SqlController],
  providers: [SqlService],
})
export class SqlModule {}

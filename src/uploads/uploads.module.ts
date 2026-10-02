import { Module } from '@nestjs/common';
import { BlobStorage } from './blob-storage';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, BlobStorage],
})
export class UploadsModule {}

import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Auth } from '../auth/auth.decorators';
import { requireUserId, type AuthContext } from '../auth/auth-context';
import { MAX_IMAGE_BYTES, UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /** multipart/form-data with a single `file` field. Returns `{ url }` to put in a listing's `imageUrls`. */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  upload(@UploadedFile() file: Express.Multer.File | undefined, @Auth() auth: AuthContext) {
    if (!file) throw new BadRequestException('Send the image in a "file" form field');
    return this.uploadsService.uploadImage(file, requireUserId(auth));
  }
}

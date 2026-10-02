import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BlobStorage } from './blob-storage';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const IMAGE_TYPES = [
  { contentType: 'image/jpeg', extension: 'jpg', matches: (b: Buffer) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  { contentType: 'image/png', extension: 'png', matches: (b: Buffer) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  {
    contentType: 'image/webp',
    extension: 'webp',
    matches: (b: Buffer) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
] as const;

@Injectable()
export class UploadsService {
  constructor(private readonly storage: BlobStorage) {}

  /**
   * Stores a listing photo in the public Blob store and returns its URL.
   * The type is decided from the file's own bytes: the client-declared mimetype is not trusted.
   */
  async uploadImage(file: Pick<Express.Multer.File, 'buffer'>, userId: string): Promise<{ url: string }> {
    const kind = IMAGE_TYPES.find((type) => type.matches(file.buffer));
    if (!kind) throw new BadRequestException('Only JPEG, PNG or WebP images are accepted');

    const url = await this.storage.putPublic(
      `materials/${userId}/${randomUUID()}.${kind.extension}`,
      file.buffer,
      kind.contentType,
    );
    return { url };
  }
}

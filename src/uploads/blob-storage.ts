import { Injectable } from '@nestjs/common';

/** Thin wrapper over Vercel Blob so the rest of the code (and its tests) never touch the SDK. */
@Injectable()
export class BlobStorage {
  /** Uploads a public file and returns its URL. Needs BLOB_READ_WRITE_TOKEN (set by connecting the store to the project). */
  async putPublic(pathname: string, body: Buffer, contentType: string): Promise<string> {
    // Dynamic import: @vercel/blob is ESM-only and this project compiles to CommonJS.
    const { put } = await import('@vercel/blob');
    const blob = await put(pathname, body, { access: 'public', contentType });
    return blob.url;
  }
}

import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { BlobStorage } from './blob-storage';
import { UploadsModule } from './uploads.module';

const ME = '3f2b8c1e-0000-4000-8000-000000000001';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('Uploads (HTTP)', () => {
  let app: INestApplication;
  let token: string;
  const storage = { putPublic: jest.fn() };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule, UploadsModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(BlobStorage)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    token = await app.get(JwtService).signAsync({ sub: ME, email: 'me@uni.edu' });
  });

  beforeEach(() => storage.putPublic.mockReset());

  afterAll(() => app.close());

  const upload = () => request(app.getHttpServer()).post('/uploads').set('Authorization', `Bearer ${token}`);

  it('needs a signed-in user', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .attach('file', JPEG, 'photo.jpg')
      .expect(401);
  });

  it('stores a JPEG under the user\'s folder and returns its URL', async () => {
    storage.putPublic.mockResolvedValue('https://store.public.blob.vercel-storage.com/materials/x.jpg');

    const res = await upload().attach('file', JPEG, 'photo.jpg').expect(201);

    expect(res.body).toEqual({ url: 'https://store.public.blob.vercel-storage.com/materials/x.jpg' });
    const [pathname, , contentType] = storage.putPublic.mock.calls[0];
    expect(pathname).toMatch(new RegExp(`^materials/${ME}/[0-9a-f-]+\\.jpg$`));
    expect(contentType).toBe('image/jpeg');
  });

  it('decides the type from the bytes, not from the declared mimetype', async () => {
    storage.putPublic.mockResolvedValue('https://store/x.png');
    await upload().attach('file', PNG, { filename: 'liar.jpg', contentType: 'image/jpeg' }).expect(201);
    expect(storage.putPublic.mock.calls[0][2]).toBe('image/png');

    await upload()
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'evil.png', contentType: 'image/png' })
      .expect(400);
  });

  it('rejects a missing file and files over 4 MB', async () => {
    await upload().expect(400);
    await upload().attach('file', Buffer.concat([JPEG, Buffer.alloc(4 * 1024 * 1024)]), 'big.jpg').expect(413);
    expect(storage.putPublic).not.toHaveBeenCalled();
  });
});

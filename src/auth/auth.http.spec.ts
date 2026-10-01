import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import { AuthModule } from './auth.module';
import { PrismaService } from '../prisma.service';

describe('Auth (HTTP)', () => {
  let app: INestApplication;
  const stored = {
    id: '3f2b8c1e-0000-4000-8000-000000000001',
    email: 'ada@uni.edu',
    fullName: 'Ada Lovelace',
    major: 'CS',
    faculty: null,
    rating: 0,
    createdAt: new Date(),
    passwordHash: hashSync('12345678', 4),
  };
  const prisma = {
    user: {
      // Ignores the "mode: insensitive" part of the filter; the lookup itself is covered by the service.
      findFirst: jest.fn(({ where }) =>
        Promise.resolve(where.email.equals === stored.email ? stored : null),
      ),
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(where.id === stored.id ? { ...stored, passwordHash: undefined } : null),
      ),
      create: jest.fn(({ data }) => Promise.resolve({ ...stored, ...data, passwordHash: undefined })),
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('registers, hashing the plain password before it is stored', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ' ADA@uni.edu ', password: 'correct-horse', fullName: 'Ada', major: 'CS' })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data.email).toBe('ada@uni.edu');
    expect(data.password).toBeUndefined();
    expect(data.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(data.passwordHash).not.toContain('correct-horse');
  });

  it('logs in and the token opens /auth/me', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@uni.edu', password: '12345678' })
      .expect(200);
    expect(login.body.user.passwordHash).toBeUndefined();

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body.email).toBe('ada@uni.edu');
  });

  it('rejects bad credentials and missing or forged tokens', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@uni.edu', password: 'wrong-password' })
      .expect(401);
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Bearer forged.token.here').expect(401);
  });
});

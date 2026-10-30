import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import { AuthModule } from './auth.module';
import { PrismaService } from '../prisma.service';
import { MailService, type MailMessage } from '../mail/mail.service';

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
    emailVerifiedAt: null as Date | null,
    passwordHash: hashSync('12345678', 4),
  };
  // A single stored code is enough here: every test uses Ada's account.
  let storedCode: { id: string; codeHash: string; attempts: number; expiresAt: Date; createdAt: Date } | null = null;
  const sentMail: MailMessage[] = [];
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
      update: jest.fn(({ data }) => {
        Object.assign(stored, data);
        return Promise.resolve({ ...stored, passwordHash: undefined });
      }),
    },
    emailCode: {
      findUnique: jest.fn(() => Promise.resolve(storedCode)),
      upsert: jest.fn(({ update }) => {
        storedCode = { id: 'code-id', ...update };
        return Promise.resolve(storedCode);
      }),
      updateMany: jest.fn(() => {
        if (!storedCode || storedCode.attempts >= 5 || storedCode.expiresAt <= new Date()) return Promise.resolve({ count: 0 });
        storedCode.attempts += 1;
        return Promise.resolve({ count: 1 });
      }),
      deleteMany: jest.fn(() => {
        const count = storedCode ? 1 : 0;
        storedCode = null;
        return Promise.resolve({ count });
      }),
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(MailService)
      .useValue({ send: (message: MailMessage) => Promise.resolve(sentMail.push(message)) })
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

  it('resets a forgotten password with the emailed code', async () => {
    storedCode = null;
    sentMail.length = 0;
    const server = app.getHttpServer();

    await request(server).post('/auth/forgot-password').send({ email: 'nobody@uni.edu' }).expect(204);
    expect(sentMail).toHaveLength(0);

    await request(server).post('/auth/forgot-password').send({ email: ' Ada@uni.edu ' }).expect(204);
    expect(sentMail[0].to).toBe('ada@uni.edu');
    const code = /\b(\d{6})\b/.exec(sentMail[0].text)![1];
    const wrong = code === '000000' ? '111111' : '000000';

    await request(server)
      .post('/auth/reset-password')
      .send({ email: 'ada@uni.edu', code: wrong, newPassword: 'brand-new-pass' })
      .expect(400);
    const reset = await request(server)
      .post('/auth/reset-password')
      .send({ email: 'ada@uni.edu', code, newPassword: 'brand-new-pass' })
      .expect(200);
    expect(reset.body.accessToken).toEqual(expect.any(String));
    expect(reset.body.user.emailVerifiedAt).toBeTruthy();

    // The code works once, and the new password is the one that logs in.
    await request(server)
      .post('/auth/reset-password')
      .send({ email: 'ada@uni.edu', code, newPassword: 'another-pass' })
      .expect(400);
    await request(server).post('/auth/login').send({ email: 'ada@uni.edu', password: 'brand-new-pass' }).expect(200);
  });

  it('validates codes and keeps email verification for signed-in users', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/auth/reset-password')
      .send({ email: 'ada@uni.edu', code: '12ab', newPassword: 'brand-new-pass' })
      .expect(400);
    await request(server).post('/auth/verify-email/send').expect(401);
    await request(server).post('/auth/verify-email').send({ code: '123456' }).expect(401);
  });
});

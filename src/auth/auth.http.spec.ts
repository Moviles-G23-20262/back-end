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
      .send({
        email: ' ADA@Uniandes.edu.co ',
        password: 'CampusSwap1!',
        fullName: '  Ada   Lovelace ',
        major: ' Computer   Science ',
      })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data.email).toBe('ada@uniandes.edu.co');
    expect(data.fullName).toBe('Ada Lovelace');
    expect(data.major).toBe('Computer Science');
    expect(data.password).toBeUndefined();
    expect(data.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(data.passwordHash).not.toContain('CampusSwap1!');
  });

  it('refuses a sign-up that breaks the rules, before anything is stored', async () => {
    const server = app.getHttpServer();
    prisma.user.create.mockClear();
    const valid = { email: 'ada@uniandes.edu.co', password: 'CampusSwap1!', fullName: 'Ada Lovelace', major: 'CS' };

    const bodies = [
      { ...valid, email: 'ada@gmail.com' },
      { ...valid, password: 'correct-horse' },
      { ...valid, password: '        ' },
      { ...valid, password: 'Campus Swap1!' },
      { ...valid, fullName: 'Ada 😀' },
      { ...valid, fullName: '   ' },
      { ...valid, major: '' },
    ];
    for (const body of bodies) {
      await request(server).post('/auth/register').send(body).expect(400);
    }
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('logs in and the token opens /auth/me (an older account with a simple password still can)', async () => {
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
      .send({ email: 'ada@uni.edu', code: wrong, newPassword: 'BrandNew-Pass1!' })
      .expect(400);
    const reset = await request(server)
      .post('/auth/reset-password')
      .send({ email: 'ada@uni.edu', code, newPassword: 'BrandNew-Pass1!' })
      .expect(200);
    expect(reset.body.accessToken).toEqual(expect.any(String));
    expect(reset.body.user.emailVerifiedAt).toBeTruthy();

    // The code works once, and the new password is the one that logs in.
    await request(server)
      .post('/auth/reset-password')
      .send({ email: 'ada@uni.edu', code, newPassword: 'Another-Pass2!' })
      .expect(400);
    await request(server).post('/auth/login').send({ email: 'ada@uni.edu', password: 'BrandNew-Pass1!' }).expect(200);
  });

  it('refuses a weak new password when resetting', async () => {
    const server = app.getHttpServer();
    for (const newPassword of ['12345678', 'brand-new-pass', 'Brand New-Pass1!']) {
      await request(server)
        .post('/auth/reset-password')
        .send({ email: 'ada@uni.edu', code: '123456', newPassword })
        .expect(400);
    }
  });

  it('validates codes and keeps email verification for signed-in users', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/auth/reset-password')
      .send({ email: 'ada@uni.edu', code: '12ab', newPassword: 'BrandNew-Pass1!' })
      .expect(400);
    await request(server).post('/auth/verify-email/send').expect(401);
    await request(server).post('/auth/verify-email').send({ code: '123456' }).expect(401);
  });
});

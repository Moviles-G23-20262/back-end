import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from './auth.module';
import { ChatroomsModule } from '../chatrooms/chatrooms.module';
import { MaterialsModule } from '../materials/materials.module';
import { MessagesModule } from '../messages/messages.module';
import { SqlModule } from '../sql/sql.module';
import { UsersModule } from '../users/users.module';

const ME = '3f2b8c1e-0000-4000-8000-000000000001';
const OTHER = '3f2b8c1e-0000-4000-8000-000000000002';
const THIRD = '3f2b8c1e-0000-4000-8000-000000000003';
const ROOM = '3f2b8c1e-0000-4000-8000-0000000000aa';
const MATERIAL = '3f2b8c1e-0000-4000-8000-0000000000bb';

describe('Access control (HTTP)', () => {
  let app: INestApplication;
  let token: string;
  const prisma = {
    material: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    chatRoom: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    message: { create: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_API_KEY = 'test-admin-key';
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule, UsersModule, MaterialsModule, ChatroomsModule, MessagesModule, SqlModule],
      controllers: [AppController],
      providers: [AppService],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    token = await app.get(JwtService).signAsync({ sub: ME, email: 'me@uni.edu' });
  });

  beforeEach(() => jest.resetAllMocks());

  afterAll(() => app.close());

  const asMe = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  const server = () => app.getHttpServer();

  it('only the health check is open; everything else needs credentials', async () => {
    await request(server()).get('/').expect(200);
    await request(server()).get('/materials').expect(401);
    await request(server()).get('/chatrooms').expect(401);
    await request(server()).get('/materials').set('X-Admin-Key', 'wrong-key').expect(401);
  });

  it('raw SQL needs the admin key, a user token is not enough', async () => {
    await asMe(request(server()).post('/sql/query').send({ query: 'select 1' })).expect(403);
    await request(server()).post('/sql/query').send({ query: 'select 1' }).expect(403);

    prisma.$transaction.mockResolvedValue({ rows: [{ one: 1 }], rowCount: 1 });
    await request(server())
      .post('/sql/query')
      .set('X-Admin-Key', 'test-admin-key')
      .send({ query: 'select 1' })
      .expect(201);
  });

  it('never selects the password hash when loading a seller', async () => {
    prisma.material.findMany.mockResolvedValue([]);

    await asMe(request(server()).get('/materials')).expect(200);

    const { include } = prisma.material.findMany.mock.calls[0][0];
    expect(include.seller.select).toEqual(expect.objectContaining({ id: true, fullName: true }));
    expect(include.seller.select).not.toHaveProperty('passwordHash');
    expect(include.seller.select).not.toHaveProperty('email');
  });

  it('lists a user only for admins and hides other users\' emails', async () => {
    await asMe(request(server()).get('/users')).expect(403);

    prisma.user.findUnique.mockResolvedValue({ id: OTHER });
    await asMe(request(server()).get(`/users/${OTHER}`)).expect(200);
    expect(prisma.user.findUnique.mock.calls[0][0].select).not.toHaveProperty('email');
  });

  it('sells as the signed-in user, ignoring the sellerId in the body', async () => {
    prisma.material.create.mockResolvedValue({ id: MATERIAL });

    await asMe(request(server()).post('/materials'))
      .send({
        title: 'Calculator',
        description: 'Works',
        price: '18.00',
        imageUrls: [],
        category: 'CALCULATORS',
        sellerId: OTHER,
      })
      .expect(201);

    expect(prisma.material.create.mock.calls[0][0].data.sellerId).toBe(ME);
  });

  it('only the seller can edit a listing', async () => {
    prisma.material.findUnique.mockResolvedValue({ sellerId: OTHER });

    await asMe(request(server()).patch(`/materials/${MATERIAL}`)).send({ title: 'Mine now' }).expect(403);
    expect(prisma.material.update).not.toHaveBeenCalled();
  });

  it('the conversation list only asks for rooms the user is part of', async () => {
    prisma.chatRoom.findMany.mockResolvedValue([]);

    await asMe(request(server()).get('/chatrooms')).expect(200);

    expect(prisma.chatRoom.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ buyerId: ME }, { sellerId: ME }],
    });
  });

  it('a stranger can neither read nor write in someone else\'s conversation', async () => {
    prisma.chatRoom.findUnique.mockResolvedValue({ id: ROOM, buyerId: OTHER, sellerId: THIRD, messages: [] });

    await asMe(request(server()).get(`/chatrooms/${ROOM}`)).expect(403);
    await asMe(request(server()).post('/messages')).send({ chatRoomId: ROOM, content: 'hi' }).expect(403);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('opening a chat picks the seller from the listing and reuses an existing room', async () => {
    prisma.material.findUnique.mockResolvedValue({ sellerId: OTHER });
    prisma.chatRoom.findFirst.mockResolvedValue(null);
    prisma.chatRoom.create.mockResolvedValue({ id: ROOM });

    await asMe(request(server()).post('/chatrooms'))
      .send({ materialId: MATERIAL, buyerId: THIRD, sellerId: THIRD })
      .expect(201);
    expect(prisma.chatRoom.create.mock.calls[0][0].data).toEqual({
      materialId: MATERIAL,
      buyerId: ME,
      sellerId: OTHER,
    });

    prisma.chatRoom.findFirst.mockResolvedValue({ id: 'existing' });
    prisma.chatRoom.create.mockClear();
    await asMe(request(server()).post('/chatrooms')).send({ materialId: MATERIAL }).expect(201);
    expect(prisma.chatRoom.create).not.toHaveBeenCalled();
  });

  it('you cannot open a chat with yourself on your own listing', async () => {
    prisma.material.findUnique.mockResolvedValue({ sellerId: ME });

    await asMe(request(server()).post('/chatrooms')).send({ materialId: MATERIAL }).expect(400);
  });
});

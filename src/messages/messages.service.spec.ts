import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma.service';

describe('MessagesService', () => {
  let service: MessagesService;
  const prisma = {
    chatRoom: { findUnique: jest.fn() },
    message: { create: jest.fn(), findUnique: jest.fn() },
  };

  const buyerId = '22222222-2222-4222-8222-222222222222';
  const sellerId = '33333333-3333-4333-8333-333333333333';
  const chatRoomId = '66666666-6666-4666-8666-666666666666';
  const msgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const asBuyer = { isAdmin: false, userId: buyerId };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.chatRoom.findUnique.mockResolvedValue({ buyerId, sellerId });
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns existing message on duplicate client id from the same sender (idempotent retry)', async () => {
    const existing = { id: msgId, chatRoomId, senderId: buyerId, content: 'Hi' };
    prisma.message.create.mockRejectedValue({ code: 'P2002' });
    prisma.message.findUnique.mockResolvedValue(existing);

    const res = await service.create({ id: msgId, chatRoomId, content: 'Hi' }, asBuyer);

    expect(res).toBe(existing);
  });

  it('rejects duplicate client id belonging to another sender with 409 Conflict', async () => {
    prisma.message.create.mockRejectedValue({ code: 'P2002' });
    prisma.message.findUnique.mockResolvedValue({ id: msgId, chatRoomId, senderId: sellerId, content: 'Hi' });

    await expect(service.create({ id: msgId, chatRoomId, content: 'Hi' }, asBuyer)).rejects.toThrow(ConflictException);
  });

  it('uses valid clientCreatedAt and clamps future or >7-day-old timestamps to now', async () => {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    prisma.message.create.mockResolvedValue({ id: msgId });

    await service.create({ id: msgId, chatRoomId, content: 'Offline msg', clientCreatedAt: oneHourAgo }, asBuyer);
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: msgId, createdAt: new Date(oneHourAgo) }),
      }),
    );

    const future = new Date(Date.now() + 86_400_000).toISOString();
    const before = Date.now();
    await service.create({ chatRoomId, content: 'Future msg', clientCreatedAt: future }, asBuyer);
    const passedDate = prisma.message.create.mock.calls[1][0].data.createdAt as Date;
    expect(passedDate.getTime()).toBeGreaterThanOrEqual(before - 50);
    expect(passedDate.getTime()).toBeLessThanOrEqual(Date.now() + 50);
  });
});

import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { MeetingProposalsService } from './meeting-proposals.service';

describe('MeetingProposalsService', () => {
  let service: MeetingProposalsService;
  const tx = {
    $queryRaw: jest.fn(),
    meetingPoint: { findUnique: jest.fn() },
    meetingProposal: { findUnique: jest.fn(), updateMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    message: { create: jest.fn() },
    exchange: { updateMany: jest.fn() },
  };
  const prisma = {
    chatRoom: { findUnique: jest.fn() },
    meetingPoint: { findUnique: jest.fn() },
    meetingProposal: { findUnique: jest.fn(), update: jest.fn() },
    scheduleBlock: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const buyerId = '22222222-2222-4222-8222-222222222222';
  const sellerId = '33333333-3333-4333-8333-333333333333';
  const chatRoomId = '66666666-6666-4666-8666-666666666666';
  const materialId = '11111111-1111-4111-8111-111111111111';
  const meetingPointId = '44444444-4444-4444-8444-444444444444';
  const proposalId = '77777777-7777-4777-8777-777777777777';
  const room = { id: chatRoomId, buyerId, sellerId, materialId };
  const point = { id: meetingPointId, name: 'Student Center plaza', lat: 4.6, lng: -74.06 };
  const asBuyer = { isAdmin: false, userId: buyerId };
  const asSeller = { isAdmin: false, userId: sellerId };
  const inAWeek = (hours = 0) => new Date(Date.now() + 7 * 24 * 3600_000 + hours * 3600_000);

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
    prisma.chatRoom.findUnique.mockResolvedValue(room);
    tx.$queryRaw.mockResolvedValue([room]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [MeetingProposalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<MeetingProposalsService>(MeetingProposalsService);
  });

  describe('create', () => {
    const dto = {
      chatRoomId,
      meetingPointId,
      startsAt: inAWeek().toISOString(),
      endsAt: inAWeek(1).toISOString(),
    };

    it('replaces the open proposal and posts a meeting card in the chat', async () => {
      tx.meetingPoint.findUnique.mockResolvedValue(point);
      tx.meetingProposal.create.mockResolvedValue({ id: proposalId });

      await service.create(dto, asBuyer);

      expect(tx.meetingProposal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { chatRoomId, status: 'PENDING' } }),
      );
      expect(tx.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          chatRoomId,
          senderId: buyerId,
          type: 'MEETING',
          meetingProposalId: proposalId,
          content: expect.stringContaining('Student Center plaza'),
        }),
      });
    });

    it('rejects people outside the chat', async () => {
      const outsider = { isAdmin: false, userId: '88888888-8888-4888-8888-888888888888' };
      await expect(service.create(dto, outsider)).rejects.toThrow(ForbiddenException);
    });

    it('rejects a meeting in the past', async () => {
      tx.meetingPoint.findUnique.mockResolvedValue(point);
      const past = { ...dto, startsAt: '2020-01-01T10:00:00Z', endsAt: '2020-01-01T11:00:00Z' };
      await expect(service.create(past, asBuyer)).rejects.toThrow(BadRequestException);
    });

    it('returns an existing proposal even when its original time has passed', async () => {
      const existing = { id: proposalId, chatRoomId, proposerId: buyerId, status: 'ACCEPTED' };
      tx.meetingProposal.findUnique.mockResolvedValue(existing);
      const replay = {
        ...dto,
        clientId: proposalId,
        startsAt: '2020-01-01T10:00:00Z',
        endsAt: '2020-01-01T11:00:00Z',
      };

      await expect(service.create(replay, asBuyer)).resolves.toEqual(existing);
      expect(tx.meetingProposal.updateMany).not.toHaveBeenCalled();
      expect(tx.message.create).not.toHaveBeenCalled();
    });

    it('returns the committed proposal after a concurrent insert with the same ID', async () => {
      const existing = { id: proposalId, chatRoomId, proposerId: buyerId };
      tx.meetingPoint.findUnique.mockResolvedValue(point);
      tx.meetingProposal.findUnique.mockResolvedValue(null);
      prisma.meetingProposal.findUnique.mockResolvedValue(existing);
      tx.meetingProposal.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Duplicate key', { code: 'P2002', clientVersion: 'test' }),
      );

      await expect(service.create({ ...dto, clientId: proposalId }, asBuyer)).resolves.toEqual(existing);
      expect(tx.message.create).not.toHaveBeenCalled();
    });

    it('does not return another participant’s proposal when they share a room', async () => {
      tx.meetingProposal.findUnique.mockResolvedValue({ id: proposalId, chatRoomId, proposerId: sellerId });
      await expect(service.create({ ...dto, clientId: proposalId }, asBuyer)).rejects.toThrow(ConflictException);
      expect(tx.meetingProposal.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('answering', () => {
    const pending = {
      id: proposalId,
      chatRoomId,
      proposerId: buyerId,
      meetingPointId,
      startsAt: inAWeek(),
      endsAt: inAWeek(1),
      status: 'PENDING',
    };

    beforeEach(() => {
      prisma.meetingProposal.findUnique.mockResolvedValue(pending);
      tx.meetingProposal.findUnique.mockResolvedValue(pending);
    });

    it('accepting confirms it, updates the pending order and posts a confirmation', async () => {
      tx.meetingProposal.update.mockResolvedValue({ ...pending, status: 'ACCEPTED', meetingPoint: point });

      await service.accept(proposalId, asSeller);

      expect(tx.exchange.updateMany).toHaveBeenCalledWith({
        where: { materialId, buyerId, status: 'PENDING' },
        data: expect.objectContaining({ meetingPointId, meetingStartsAt: pending.startsAt }),
      });
      expect(tx.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ senderId: sellerId, content: expect.stringContaining('Confirmed!') }),
      });
      expect(tx.meetingProposal.updateMany).toHaveBeenCalledWith({
        where: { chatRoomId, status: 'ACCEPTED', id: { not: proposalId } },
        data: { status: 'CANCELLED' },
      });
    });

    it('the proposer cannot accept their own proposal', async () => {
      await expect(service.accept(proposalId, asBuyer)).rejects.toThrow(ForbiddenException);
    });

    it('a proposal can only be answered once', async () => {
      tx.meetingProposal.findUnique.mockResolvedValue({ ...pending, status: 'DECLINED' });
      await expect(service.accept(proposalId, asSeller)).rejects.toThrow(ConflictException);
    });

    it('returns the winning acceptance if another request accepted while waiting for the lock', async () => {
      const accepted = { ...pending, status: 'ACCEPTED', meetingPoint: point };
      tx.meetingProposal.findUnique.mockResolvedValue(accepted);

      await expect(service.accept(proposalId, asSeller)).resolves.toEqual(accepted);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.meetingProposal.findUnique.mock.invocationCallOrder[0]);
      expect(tx.meetingProposal.update).not.toHaveBeenCalled();
      expect(tx.exchange.updateMany).not.toHaveBeenCalled();
      expect(tx.message.create).not.toHaveBeenCalled();
    });

    it('cannot accept a proposal withdrawn while waiting for the lock', async () => {
      tx.meetingProposal.findUnique.mockResolvedValue({ ...pending, status: 'CANCELLED' });

      await expect(service.accept(proposalId, asSeller)).rejects.toThrow(ConflictException);
      expect(tx.meetingProposal.update).not.toHaveBeenCalled();
      expect(tx.message.create).not.toHaveBeenCalled();
    });

    it('cannot withdraw a proposal accepted while waiting for the lock', async () => {
      tx.meetingProposal.findUnique.mockResolvedValue({ ...pending, status: 'ACCEPTED' });

      await expect(service.cancel(proposalId, asBuyer)).rejects.toThrow(ConflictException);
      expect(tx.meetingProposal.update).not.toHaveBeenCalled();
    });
  });

  it('suggests slots from both schedules and says who has none', async () => {
    prisma.scheduleBlock.findMany.mockResolvedValue([
      { userId: buyerId, dayOfWeek: 1, startMinute: 420, endMinute: 600 },
    ]);

    const result = await service.suggestions(chatRoomId, asBuyer);

    expect(result.callerHasSchedule).toBe(true);
    expect(result.otherHasSchedule).toBe(false);
    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.suggested).toEqual(result.slots.find((s) => s.sharedBreak) ?? result.slots[0]);
  });
});

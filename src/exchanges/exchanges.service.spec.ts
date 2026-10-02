import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExchangesService } from './exchanges.service';
import { PrismaService } from '../prisma.service';

describe('ExchangesService', () => {
  let service: ExchangesService;
  const tx = {
    material: { updateMany: jest.fn(), update: jest.fn() },
    meetingProposal: { findFirst: jest.fn() },
    exchange: { create: jest.fn(), update: jest.fn() },
    notification: { create: jest.fn() },
  };
  const prisma = {
    exchange: { create: jest.fn(), findUnique: jest.fn() },
    material: { findUnique: jest.fn() },
    meetingPoint: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const materialId = '11111111-1111-4111-8111-111111111111';
  const buyerId = '22222222-2222-4222-8222-222222222222';
  const sellerId = '33333333-3333-4333-8333-333333333333';
  const exchangeId = '55555555-5555-4555-8555-555555555555';
  const base = { materialId, buyerId, sellerId, price: '25000.00' };
  const meetingPointId = '44444444-4444-4444-8444-444444444444';
  const asBuyer = { isAdmin: false, userId: buyerId };
  const asSeller = { isAdmin: false, userId: sellerId };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExchangesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ExchangesService>(ExchangesService);
  });

  describe('admin create', () => {
    it('records a completed exchange with meeting point and coordinates', async () => {
      prisma.meetingPoint.findUnique.mockResolvedValue({ id: meetingPointId });
      const dto = { ...base, meetingPointId, lat: 4.6, lng: -74.06 };

      await service.create(dto);

      expect(prisma.exchange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ...dto, status: 'COMPLETED', completedAt: expect.any(Date) }),
        }),
      );
    });

    it('rejects a latitude without longitude', async () => {
      await expect(service.create({ ...base, lat: 4.6 })).rejects.toThrow(BadRequestException);
      expect(prisma.exchange.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown meeting point', async () => {
      prisma.meetingPoint.findUnique.mockResolvedValue(null);

      await expect(service.create({ ...base, meetingPointId })).rejects.toThrow(BadRequestException);
      expect(prisma.exchange.create).not.toHaveBeenCalled();
    });
  });

  describe('placeOrder', () => {
    beforeEach(() => {
      prisma.material.findUnique.mockResolvedValue({ id: materialId, sellerId, price: '320000.00' });
    });

    it('reserves the listing, creates a pending order at the listing price and notifies the seller', async () => {
      tx.material.updateMany.mockResolvedValue({ count: 1 });
      tx.meetingProposal.findFirst.mockResolvedValue(null);

      await service.placeOrder({ materialId }, asBuyer);

      expect(tx.material.updateMany).toHaveBeenCalledWith({
        where: { id: materialId, status: 'AVAILABLE' },
        data: { status: 'RESERVED' },
      });
      expect(tx.exchange.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { materialId, buyerId, sellerId, price: '320000.00' } }),
      );
      expect(tx.notification.create).toHaveBeenCalledWith({
        data: { userId: sellerId, materialId, type: 'ORDER_PLACED' },
      });
    });

    it('carries over a meetup already agreed in the chat', async () => {
      tx.material.updateMany.mockResolvedValue({ count: 1 });
      const startsAt = new Date('2026-09-17T14:00:00Z');
      const endsAt = new Date('2026-09-17T15:00:00Z');
      tx.meetingProposal.findFirst.mockResolvedValue({
        meetingPointId,
        startsAt,
        endsAt,
        meetingPoint: { lat: 4.6, lng: -74.06 },
      });

      await service.placeOrder({ materialId }, asBuyer);

      expect(tx.exchange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ meetingPointId, meetingStartsAt: startsAt, meetingEndsAt: endsAt }),
        }),
      );
    });

    it('rejects a listing that is already reserved or sold', async () => {
      tx.material.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.placeOrder({ materialId }, asBuyer)).rejects.toThrow(ConflictException);
      expect(tx.exchange.create).not.toHaveBeenCalled();
    });

    it('rejects ordering your own listing', async () => {
      await expect(service.placeOrder({ materialId }, asSeller)).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('complete and cancel', () => {
    const pending = { id: exchangeId, materialId, buyerId, sellerId, status: 'PENDING' };

    it('lets the buyer complete: the listing is sold', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);

      await service.complete(exchangeId, { receivedCondition: 'LIKE_NEW' }, asBuyer);

      expect(tx.material.update).toHaveBeenCalledWith({ where: { id: materialId }, data: { status: 'SOLD' } });
      expect(tx.exchange.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'COMPLETED', completedAt: expect.any(Date), receivedCondition: 'LIKE_NEW' },
        }),
      );
    });

    it('stores the coordinates measured at the meetup when the buyer sends them', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);

      await service.complete(exchangeId, { lat: 4.6031, lng: -74.0648 }, asBuyer);

      const [{ data }] = tx.exchange.update.mock.calls[0] as [{ data: Record<string, unknown> }];
      expect(data).toMatchObject({ status: 'COMPLETED', lat: 4.6031, lng: -74.0648 });
      expect(data.completedAt).toBeInstanceOf(Date);
    });

    it('rejects a latitude without longitude on completion', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);

      await expect(service.complete(exchangeId, { lat: 4.6031 }, asBuyer)).rejects.toThrow(BadRequestException);
      expect(tx.exchange.update).not.toHaveBeenCalled();
    });

    it('does not let the seller complete', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);

      await expect(service.complete(exchangeId, {}, asSeller)).rejects.toThrow(ForbiddenException);
    });

    it('does not complete twice', async () => {
      prisma.exchange.findUnique.mockResolvedValue({ ...pending, status: 'COMPLETED' });

      await expect(service.complete(exchangeId, {}, asBuyer)).rejects.toThrow(ConflictException);
    });

    it('puts the listing back on the market when cancelled', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);

      await service.cancel(exchangeId, asSeller);

      expect(tx.material.updateMany).toHaveBeenCalledWith({
        where: { id: materialId, status: 'RESERVED' },
        data: { status: 'AVAILABLE' },
      });
      expect(tx.exchange.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'CANCELLED', cancelledAt: expect.any(Date) } }),
      );
    });
  });
});

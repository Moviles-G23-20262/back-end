import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExchangesService } from './exchanges.service';
import { PrismaService } from '../prisma.service';

describe('ExchangesService', () => {
  let service: ExchangesService;
  const tx = {
    material: { updateMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    meetingProposal: { findFirst: jest.fn() },
    exchange: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
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
    it('records a completed exchange with meeting point and coordinates, and the listing is sold', async () => {
      prisma.meetingPoint.findUnique.mockResolvedValue({ id: meetingPointId });
      tx.material.findUnique.mockResolvedValue({ status: 'AVAILABLE' });
      const dto = { ...base, meetingPointId, lat: 4.6, lng: -74.06 };

      await service.create(dto);

      expect(tx.exchange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ...dto, status: 'COMPLETED', completedAt: expect.any(Date) }),
        }),
      );
      expect(tx.material.update).toHaveBeenCalledWith({ where: { id: materialId }, data: { status: 'SOLD' } });
    });

    it('does not record a second sale of a listing that is already sold', async () => {
      tx.material.findUnique.mockResolvedValue({ status: 'SOLD' });

      await expect(service.create(base)).rejects.toThrow(ConflictException);
      expect(tx.exchange.create).not.toHaveBeenCalled();
    });

    it('does not record a sale of a listing that does not exist', async () => {
      tx.material.findUnique.mockResolvedValue(null);

      await expect(service.create(base)).rejects.toThrow(NotFoundException);
    });

    it('a pending exchange does not sell the listing', async () => {
      await service.create({ ...base, status: 'PENDING' });

      expect(prisma.exchange.create).toHaveBeenCalled();
      expect(tx.material.update).not.toHaveBeenCalled();
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
    const pending = {
      id: exchangeId,
      materialId,
      buyerId,
      sellerId,
      status: 'PENDING',
      price: '25000.00',
      material: { status: 'RESERVED' },
    };

    beforeEach(() => tx.material.updateMany.mockResolvedValue({ count: 1 }));

    // The row as the database returns it after this side's confirmation is written.
    const afterConfirm = (fields: Record<string, unknown>) => ({ ...pending, buyerConfirmedAt: null, sellerConfirmedAt: null, ...fields });

    it('the buyer confirming alone does not sell the listing: it waits for the seller', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);
      tx.exchange.update.mockResolvedValueOnce(afterConfirm({ buyerConfirmedAt: new Date() }));

      const result = await service.complete(exchangeId, { receivedCondition: 'LIKE_NEW' }, asBuyer);

      expect(tx.exchange.update).toHaveBeenCalledTimes(1);
      expect(tx.exchange.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { buyerConfirmedAt: expect.any(Date), receivedCondition: 'LIKE_NEW' } }),
      );
      expect(tx.material.updateMany).not.toHaveBeenCalled();
      expect(result.status).toBe('PENDING');
    });

    it('the seller confirming alone does not sell the listing either', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);
      tx.exchange.update.mockResolvedValueOnce(afterConfirm({ sellerConfirmedAt: new Date() }));

      await service.complete(exchangeId, {}, asSeller);

      expect(tx.exchange.update).toHaveBeenCalledWith(expect.objectContaining({ data: { sellerConfirmedAt: expect.any(Date) } }));
      expect(tx.material.updateMany).not.toHaveBeenCalled();
    });

    it('the second confirmation closes the sale: exchange completed and listing sold', async () => {
      const buyerConfirmedAt = new Date('2026-11-22T15:00:00Z');
      prisma.exchange.findUnique.mockResolvedValue({ ...pending, buyerConfirmedAt });
      tx.exchange.update
        .mockResolvedValueOnce(afterConfirm({ buyerConfirmedAt, sellerConfirmedAt: new Date() }))
        .mockResolvedValueOnce({ ...pending, status: 'COMPLETED' });

      const result = await service.complete(exchangeId, {}, asSeller);

      expect(tx.material.updateMany).toHaveBeenCalledWith({
        where: { id: materialId, status: 'RESERVED' },
        data: { status: 'SOLD' },
      });
      expect(tx.exchange.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { status: 'COMPLETED', completedAt: expect.any(Date) } }),
      );
      expect(result.status).toBe('COMPLETED');
    });

    it('when both confirm at the same moment, the one that sees the other closes the sale', async () => {
      // The seller's write waited for the buyer's: the returned row already has both confirmations.
      prisma.exchange.findUnique.mockResolvedValue(pending);
      tx.exchange.update
        .mockResolvedValueOnce(afterConfirm({ buyerConfirmedAt: new Date(), sellerConfirmedAt: new Date() }))
        .mockResolvedValueOnce({ ...pending, status: 'COMPLETED' });

      await service.complete(exchangeId, {}, asSeller);

      expect(tx.material.updateMany).toHaveBeenCalledTimes(1);
    });

    it('confirming again keeps the first time', async () => {
      const buyerConfirmedAt = new Date('2026-11-22T15:00:00Z');
      prisma.exchange.findUnique.mockResolvedValue({ ...pending, buyerConfirmedAt });
      tx.exchange.update.mockResolvedValueOnce(afterConfirm({ buyerConfirmedAt }));

      await service.complete(exchangeId, {}, asBuyer);

      expect(tx.exchange.update).toHaveBeenCalledWith(expect.objectContaining({ data: { buyerConfirmedAt } }));
    });

    it('stores the coordinates measured at the meetup', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);
      tx.exchange.update.mockResolvedValueOnce(afterConfirm({ buyerConfirmedAt: new Date() }));

      await service.complete(exchangeId, { lat: 4.6031, lng: -74.0648 }, asBuyer);

      const [{ data }] = tx.exchange.update.mock.calls[0] as [{ data: Record<string, unknown> }];
      expect(data).toMatchObject({ lat: 4.6031, lng: -74.0648 });
      expect(data.buyerConfirmedAt).toBeInstanceOf(Date);
    });

    it('rejects a latitude without longitude on completion', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);

      await expect(service.complete(exchangeId, { lat: 4.6031 }, asBuyer)).rejects.toThrow(BadRequestException);
      expect(tx.exchange.update).not.toHaveBeenCalled();
    });

    it('only the buyer reports the condition the item arrived in', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);

      await expect(service.complete(exchangeId, { receivedCondition: 'NEW' }, asSeller)).rejects.toThrow(BadRequestException);
      expect(tx.exchange.update).not.toHaveBeenCalled();
    });

    it('does not let someone outside the exchange confirm it', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);
      const stranger = { isAdmin: false, userId: '66666666-6666-4666-8666-666666666666' };

      await expect(service.complete(exchangeId, {}, stranger)).rejects.toThrow(ForbiddenException);
      expect(tx.exchange.update).not.toHaveBeenCalled();
    });

    it('does not complete an exchange without a price', async () => {
      prisma.exchange.findUnique.mockResolvedValue({ ...pending, price: '0.00' });

      await expect(service.complete(exchangeId, {}, asBuyer)).rejects.toThrow(BadRequestException);
      expect(tx.exchange.update).not.toHaveBeenCalled();
    });

    it.each(['AVAILABLE', 'SOLD'])('does not complete when the listing is %s instead of reserved', async (status) => {
      prisma.exchange.findUnique.mockResolvedValue({ ...pending, material: { status } });

      await expect(service.complete(exchangeId, {}, asBuyer)).rejects.toThrow(ConflictException);
      expect(tx.exchange.update).not.toHaveBeenCalled();
    });

    it('does not sell when the listing stopped being reserved while confirming', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);
      tx.exchange.update.mockResolvedValueOnce(afterConfirm({ buyerConfirmedAt: new Date(), sellerConfirmedAt: new Date() }));
      tx.material.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.complete(exchangeId, {}, asBuyer)).rejects.toThrow(ConflictException);
      expect(tx.exchange.update).toHaveBeenCalledTimes(1);
    });

    it('rolls back a confirmation of an exchange that was cancelled meanwhile', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);
      tx.exchange.update.mockResolvedValueOnce(afterConfirm({ status: 'CANCELLED', buyerConfirmedAt: new Date() }));

      await expect(service.complete(exchangeId, {}, asBuyer)).rejects.toThrow(ConflictException);
      expect(tx.material.updateMany).not.toHaveBeenCalled();
    });

    it('does not complete twice', async () => {
      prisma.exchange.findUnique.mockResolvedValue({ ...pending, status: 'COMPLETED' });

      await expect(service.complete(exchangeId, {}, asBuyer)).rejects.toThrow(ConflictException);
    });

    it('puts the listing back on the market when cancelled', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);
      tx.exchange.updateMany.mockResolvedValue({ count: 1 });
      const cancelled = { ...pending, status: 'CANCELLED', material: { status: 'AVAILABLE' } };
      tx.exchange.findUniqueOrThrow.mockResolvedValue(cancelled);

      await expect(service.cancel(exchangeId, asSeller)).resolves.toEqual(cancelled);

      expect(tx.material.updateMany).toHaveBeenCalledWith({
        where: { id: materialId, status: 'RESERVED' },
        data: { status: 'AVAILABLE' },
      });
      expect(tx.exchange.updateMany).toHaveBeenCalledWith({
        where: { id: exchangeId, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
      });
      expect(tx.exchange.updateMany.mock.invocationCallOrder[0]).toBeLessThan(tx.material.updateMany.mock.invocationCallOrder[0]);
    });

    it('does not release the listing if confirmation closed the exchange before cancellation could write', async () => {
      prisma.exchange.findUnique.mockResolvedValue(pending);
      tx.exchange.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.cancel(exchangeId, asSeller)).rejects.toThrow(ConflictException);
      expect(tx.material.updateMany).not.toHaveBeenCalled();
      expect(tx.exchange.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });
});

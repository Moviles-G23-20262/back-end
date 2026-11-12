import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { MaterialsService } from './materials.service';
import { PrismaService } from '../prisma.service';
import { SmartAlertsService } from '../smart-alerts/smart-alerts.service';

describe('MaterialsService', () => {
  let service: MaterialsService;
  const prisma = {
    material: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    exchange: { count: jest.fn() },
  };
  const smartAlerts = { notifyMatches: jest.fn() };

  const sellerId = '33333333-3333-4333-8333-333333333333';
  const dto = {
    title: 'Arduino UNO',
    description: 'Barely used, with its cable',
    price: '45000',
    condition: 'GOOD' as const,
    imageUrls: ['https://blob.test/arduino.jpg'],
    category: 'LAB_EQUIPMENT' as const,
  };
  const created = { id: '11111111-1111-4111-8111-111111111111', sellerId, ...dto };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.material.create.mockResolvedValue(created);
    prisma.material.findUnique.mockResolvedValue(null);
    smartAlerts.notifyMatches.mockResolvedValue(0);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaterialsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SmartAlertsService, useValue: smartAlerts },
      ],
    }).compile();

    service = module.get<MaterialsService>(MaterialsService);
  });

  it('publishing a listing notifies the students whose alerts it matches', async () => {
    smartAlerts.notifyMatches.mockResolvedValue(2);

    await expect(service.create(dto, { isAdmin: false, userId: sellerId })).resolves.toBe(created);
    expect(smartAlerts.notifyMatches).toHaveBeenCalledWith(created);
  });

  it('the listing is still published when the notifications fail', async () => {
    smartAlerts.notifyMatches.mockRejectedValue(new Error('database hiccup'));

    await expect(service.create(dto, { isAdmin: false, userId: sellerId })).resolves.toBe(created);
  });

  describe('idempotency with clientId (a listing saved offline may be sent more than once)', () => {
    const clientId = '99999999-9999-4999-8999-999999999999';
    const asSeller = { isAdmin: false, userId: sellerId };
    const createdWith = () => (prisma.material.create.mock.calls[0] as [{ data: unknown }])[0];
    const duplicateError = () =>
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

    it('the first time it creates the material and stores the clientId', async () => {
      const withClientId = { ...created, clientId };
      prisma.material.create.mockResolvedValue(withClientId);

      await expect(service.create({ ...dto, clientId }, asSeller)).resolves.toBe(withClientId);

      expect(prisma.material.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { clientId } }));
      expect(prisma.material.create).toHaveBeenCalledTimes(1);
      expect(createdWith().data).toMatchObject({ clientId, sellerId });
      expect(smartAlerts.notifyMatches).toHaveBeenCalledTimes(1);
    });

    it('a repeat returns the material that already exists: no second row, no second notification', async () => {
      const existing = { ...created, clientId };
      prisma.material.findUnique.mockResolvedValue(existing);

      await expect(service.create({ ...dto, clientId }, asSeller)).resolves.toBe(existing);

      expect(prisma.material.create).not.toHaveBeenCalled();
      expect(smartAlerts.notifyMatches).not.toHaveBeenCalled();
    });

    it('two retries that race: the loser of the unique index returns the winner\'s material', async () => {
      const winner = { ...created, clientId };
      prisma.material.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
      prisma.material.create.mockRejectedValue(duplicateError());

      await expect(service.create({ ...dto, clientId }, asSeller)).resolves.toBe(winner);

      expect(smartAlerts.notifyMatches).not.toHaveBeenCalled();
    });

    it('another seller\'s clientId is a conflict and never reveals their material', async () => {
      prisma.material.findUnique.mockResolvedValue({ ...created, sellerId: 'someone-else', clientId });

      await expect(service.create({ ...dto, clientId }, asSeller)).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.material.create).not.toHaveBeenCalled();
    });

    it('a unique violation that is not about clientId still fails', async () => {
      prisma.material.create.mockRejectedValue(duplicateError());

      await expect(service.create(dto, asSeller)).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    });

    it('without a clientId nothing is looked up (the old behaviour)', async () => {
      await service.create(dto, asSeller);

      expect(prisma.material.findUnique).not.toHaveBeenCalled();
    });

    it('the clientId cannot be changed afterwards', async () => {
      prisma.material.findUnique.mockResolvedValue({ ...created, sellerId, status: 'AVAILABLE' });
      prisma.exchange.count.mockResolvedValue(0);
      prisma.material.update.mockResolvedValue(created);

      await service.update(created.id, { title: 'New title', clientId }, asSeller);

      expect((prisma.material.update.mock.calls[0] as [{ data: unknown }])[0].data).toEqual({ title: 'New title' });
    });
  });

  describe('editing a listing', () => {
    const asSeller = { isAdmin: false, userId: sellerId };
    const listing = (status: string) => ({ sellerId, status });

    beforeEach(() => {
      prisma.exchange.count.mockResolvedValue(0);
      prisma.material.update.mockResolvedValue(created);
    });

    it('the seller can change the price of a listing that is on the market', async () => {
      prisma.material.findUnique.mockResolvedValue(listing('AVAILABLE'));

      await service.update(created.id, { price: '40000' }, asSeller);

      expect(prisma.material.update).toHaveBeenCalled();
    });

    it('the seller cannot set the status by hand', async () => {
      prisma.material.findUnique.mockResolvedValue(listing('AVAILABLE'));

      await expect(service.update(created.id, { status: 'SOLD' }, asSeller)).rejects.toThrow(ForbiddenException);
      expect(prisma.material.update).not.toHaveBeenCalled();
    });

    it.each(['RESERVED', 'SOLD'])('a %s listing cannot be edited by its seller', async (status) => {
      prisma.material.findUnique.mockResolvedValue(listing(status));

      await expect(service.update(created.id, { price: '40000' }, asSeller)).rejects.toThrow(ConflictException);
      expect(prisma.material.update).not.toHaveBeenCalled();
    });

    it('a listing with a pending order cannot be edited, even if it still shows as available', async () => {
      prisma.material.findUnique.mockResolvedValue(listing('AVAILABLE'));
      prisma.exchange.count.mockResolvedValue(1);

      await expect(service.update(created.id, { title: 'Another title' }, asSeller)).rejects.toThrow(ConflictException);
    });

    it('an admin can still correct a listing in any status', async () => {
      prisma.material.findUnique.mockResolvedValue(listing('SOLD'));

      await service.update(created.id, { status: 'AVAILABLE' }, { isAdmin: true });

      expect(prisma.material.update).toHaveBeenCalled();
      expect(prisma.exchange.count).not.toHaveBeenCalled();
    });
  });
});

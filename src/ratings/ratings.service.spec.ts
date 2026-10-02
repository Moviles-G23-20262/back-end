import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { RatingsService } from './ratings.service';

describe('RatingsService', () => {
  let service: RatingsService;
  const tx = {
    rating: { create: jest.fn(), aggregate: jest.fn() },
    user: { update: jest.fn() },
  };
  const prisma = {
    exchange: { findUnique: jest.fn() },
    rating: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const admin = { isAdmin: true };
  const buyer = '22222222-2222-4222-8222-222222222222';
  const seller = '33333333-3333-4333-8333-333333333333';
  const base = {
    exchangeId: '11111111-1111-4111-8111-111111111111',
    raterId: buyer,
    ratedId: seller,
    stars: 5,
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
    const module: TestingModule = await Test.createTestingModule({
      providers: [RatingsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<RatingsService>(RatingsService);
  });

  it('rejects rating yourself', async () => {
    await expect(service.create({ ...base, ratedId: buyer }, admin)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects users that are not part of the exchange', async () => {
    prisma.exchange.findUnique.mockResolvedValue({ buyerId: buyer, sellerId: seller, status: 'COMPLETED' });
    const outsider = '44444444-4444-4444-8444-444444444444';
    await expect(service.create({ ...base, raterId: outsider }, admin)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a second rating for the same exchange', async () => {
    prisma.exchange.findUnique.mockResolvedValue({ buyerId: buyer, sellerId: seller, status: 'COMPLETED' });
    prisma.rating.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create(base, admin)).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates the rating and updates the rated user average', async () => {
    prisma.exchange.findUnique.mockResolvedValue({ buyerId: buyer, sellerId: seller, status: 'COMPLETED' });
    prisma.rating.findUnique.mockResolvedValue(null);
    tx.rating.create.mockResolvedValue({ id: 'r1', ...base, tags: [] });
    tx.rating.aggregate.mockResolvedValue({ _avg: { stars: 4.5 } });

    await service.create(base, admin);

    expect(tx.rating.create).toHaveBeenCalledWith({ data: { ...base, tags: [] } });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: seller }, data: { rating: 4.5 } });
  });

  it('rates as the signed-in user, ignoring the raterId sent in the body', async () => {
    const outsider = '44444444-4444-4444-8444-444444444444';
    prisma.exchange.findUnique.mockResolvedValue({ buyerId: buyer, sellerId: seller, status: 'COMPLETED' });
    prisma.rating.findUnique.mockResolvedValue(null);
    tx.rating.create.mockResolvedValue({ id: 'r1' });
    tx.rating.aggregate.mockResolvedValue({ _avg: { stars: 5 } });

    await service.create({ ...base, raterId: outsider }, { isAdmin: false, userId: buyer });

    expect(tx.rating.create).toHaveBeenCalledWith({ data: { ...base, raterId: buyer, tags: [] } });
  });
});

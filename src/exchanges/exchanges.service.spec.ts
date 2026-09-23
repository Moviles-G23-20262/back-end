import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExchangesService } from './exchanges.service';
import { PrismaService } from '../prisma.service';

describe('ExchangesService', () => {
  let service: ExchangesService;
  const prisma = {
    exchange: { create: jest.fn() },
    meetingPoint: { findUnique: jest.fn() },
  };

  const base = {
    materialId: '11111111-1111-4111-8111-111111111111',
    buyerId: '22222222-2222-4222-8222-222222222222',
    sellerId: '33333333-3333-4333-8333-333333333333',
    price: '25000.00',
  };
  const meetingPointId = '44444444-4444-4444-8444-444444444444';

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExchangesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ExchangesService>(ExchangesService);
  });

  it('creates an exchange with meeting point and coordinates', async () => {
    prisma.meetingPoint.findUnique.mockResolvedValue({ id: meetingPointId });
    const dto = { ...base, meetingPointId, lat: 4.6, lng: -74.06 };

    await service.create(dto);

    expect(prisma.exchange.create).toHaveBeenCalledWith(expect.objectContaining({ data: dto }));
  });

  it('creates an exchange without location, as before', async () => {
    await service.create(base);

    expect(prisma.meetingPoint.findUnique).not.toHaveBeenCalled();
    expect(prisma.exchange.create).toHaveBeenCalled();
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

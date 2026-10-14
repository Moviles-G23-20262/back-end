import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SmartAlertsService } from './smart-alerts.service';
import { PrismaService } from '../prisma.service';

describe('SmartAlertsService', () => {
  let service: SmartAlertsService;
  const prisma = {
    smartAlert: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    notification: { createMany: jest.fn() },
  };

  const sellerId = '33333333-3333-4333-8333-333333333333';
  const ana = '22222222-2222-4222-8222-222222222222';
  const luis = '44444444-4444-4444-8444-444444444444';
  const material = {
    id: '11111111-1111-4111-8111-111111111111',
    sellerId,
    title: 'Casio fx-991LA calculator',
    courseCode: null,
    category: 'CALCULATORS' as const,
    price: '60000.00',
    condition: 'GOOD' as const,
  };
  const alert = (userId: string, keyword: string) => ({
    id: `alert-${userId}-${keyword}`,
    userId,
    keyword,
    courseCode: null,
    category: null,
    maxPrice: '80000.00',
    minCondition: null,
    enabled: true,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmartAlertsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<SmartAlertsService>(SmartAlertsService);
  });

  describe('notifyMatches', () => {
    it('notifies each matching student once, and only for matching keywords', async () => {
      prisma.smartAlert.findMany.mockResolvedValue([alert(ana, 'casio'), alert(ana, 'calculator'), alert(luis, 'arduino')]);

      const notified = await service.notifyMatches(material);

      expect(notified).toBe(1);
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [{ userId: ana, materialId: material.id, type: 'SMART_MATCH' }],
      });
    });

    it('asks the database only for enabled alerts of other students that the price and category allow', async () => {
      prisma.smartAlert.findMany.mockResolvedValue([]);

      await service.notifyMatches(material);

      expect(prisma.smartAlert.findMany).toHaveBeenCalledWith({
        where: {
          enabled: true,
          userId: { not: sellerId },
          maxPrice: { gte: '60000.00' },
          OR: [{ category: null }, { category: 'CALCULATORS' }],
        },
      });
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });

  it('an app user always creates the alert for themselves', async () => {
    await service.create({ userId: luis, maxPrice: '30000' }, { isAdmin: false, userId: ana });

    expect(prisma.smartAlert.create).toHaveBeenCalledWith({ data: { userId: ana, maxPrice: '30000' } });
  });

  it("a student can't change someone else's alert", async () => {
    prisma.smartAlert.findUnique.mockResolvedValue({ userId: luis });

    await expect(service.update('a1', { enabled: false }, { isAdmin: false, userId: ana })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.smartAlert.update).not.toHaveBeenCalled();
  });
});

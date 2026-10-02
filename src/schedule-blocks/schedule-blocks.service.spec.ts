import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { ScheduleBlocksService } from './schedule-blocks.service';

describe('ScheduleBlocksService', () => {
  let service: ScheduleBlocksService;
  const prisma = {
    scheduleBlock: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  };
  const me = { isAdmin: false, userId: '22222222-2222-4222-8222-222222222222' };
  const math = { dayOfWeek: 1, startMinute: 7 * 60, endMinute: 9 * 60, label: 'MATH-201' };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScheduleBlocksService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ScheduleBlocksService>(ScheduleBlocksService);
  });

  it('adds a class to the schedule of the caller, whatever userId they send', async () => {
    prisma.scheduleBlock.findFirst.mockResolvedValue(null);

    await service.create({ ...math, userId: '99999999-9999-4999-8999-999999999999' }, me);

    expect(prisma.scheduleBlock.create).toHaveBeenCalledWith({ data: { ...math, userId: me.userId } });
  });

  it('rejects a class that ends before it starts', async () => {
    await expect(service.create({ ...math, endMinute: 6 * 60 }, me)).rejects.toThrow(BadRequestException);
  });

  it('rejects overlapping classes', async () => {
    prisma.scheduleBlock.findFirst.mockResolvedValue({ label: 'PHYS-101' });
    await expect(service.create(math, me)).rejects.toThrow('Overlaps with PHYS-101');
  });

  it('only deletes classes of the caller', async () => {
    prisma.scheduleBlock.findUnique.mockResolvedValue({ userId: 'someone-else' });
    await expect(service.remove('id', me)).rejects.toThrow(ForbiddenException);
  });
});

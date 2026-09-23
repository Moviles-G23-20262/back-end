import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MeetingPointsService } from './meeting-points.service';
import { PrismaService } from '../prisma.service';

describe('MeetingPointsService', () => {
  let service: MeetingPointsService;
  const prisma = { meetingPoint: { findMany: jest.fn(), findUnique: jest.fn() } };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [MeetingPointsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<MeetingPointsService>(MeetingPointsService);
  });

  it('lists points ordered by name', async () => {
    await service.findAll();

    expect(prisma.meetingPoint.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });

  it('throws when the point does not exist', async () => {
    prisma.meetingPoint.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});

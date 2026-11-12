import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  const prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
  const userId = '3f2b8c1e-0000-4000-8000-000000000001';
  const asMe = { isAdmin: false, userId };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue({ email: 'ana@uniandes.edu.co' });
    prisma.user.update.mockResolvedValue({ id: userId });
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    const sentData = (call: number) => (prisma.user.update.mock.calls[call] as [{ data: object }])[0].data;

    it('a new email is not verified until its owner types the code again', async () => {
      await service.update(userId, { email: 'ana.gomez@uniandes.edu.co' }, asMe);

      expect(sentData(0)).toEqual({ email: 'ana.gomez@uniandes.edu.co', emailVerifiedAt: null });
    });

    it('the same email, or no email, keeps the verification', async () => {
      await service.update(userId, { email: 'ana@uniandes.edu.co' }, asMe);
      await service.update(userId, { fullName: 'Ana Gómez' }, asMe);

      expect(sentData(0)).toEqual({ email: 'ana@uniandes.edu.co' });
      expect(sentData(1)).toEqual({ fullName: 'Ana Gómez' });
    });

    it('a user that does not exist is a 404', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.update(userId, { fullName: 'Ana Gómez' }, asMe)).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});

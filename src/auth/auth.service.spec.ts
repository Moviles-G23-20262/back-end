import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashSync } from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = { create: jest.fn(), findOne: jest.fn(), findByEmailWithHash: jest.fn() };
  const jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
  const storedUser = {
    id: 'user-id',
    email: 'a@b.co',
    fullName: 'Ada',
    major: 'CS',
    faculty: null,
    rating: 0,
    createdAt: new Date(),
    passwordHash: hashSync('12345678', 4),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('logs in with the right password and never returns the hash', async () => {
    usersService.findByEmailWithHash.mockResolvedValue(storedUser);

    const result = await service.login({ email: 'a@b.co', password: '12345678' });

    expect(result.accessToken).toBe('signed-token');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-id', email: 'a@b.co' });
  });

  it('rejects a wrong password', async () => {
    usersService.findByEmailWithHash.mockResolvedValue(storedUser);

    await expect(service.login({ email: 'a@b.co', password: 'nope-nope' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown email with the same error', async () => {
    usersService.findByEmailWithHash.mockResolvedValue(null);

    await expect(service.login({ email: 'x@y.co', password: '12345678' })).rejects.toThrow(
      'Invalid credentials',
    );
  });
});

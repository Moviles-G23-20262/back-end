import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashSync } from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { EmailCodesService } from './email-codes.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    create: jest.fn(),
    findOne: jest.fn(),
    findSelf: jest.fn(),
    findByEmailWithHash: jest.fn(),
    resetPassword: jest.fn(),
    markEmailVerified: jest.fn(),
  };
  const emailCodes = { send: jest.fn(), consume: jest.fn() };
  const jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
  const storedUser = {
    id: 'user-id',
    email: 'a@b.co',
    fullName: 'Ada',
    major: 'CS',
    faculty: null,
    rating: 0,
    createdAt: new Date(),
    emailVerifiedAt: null,
    passwordHash: hashSync('12345678', 4),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: EmailCodesService, useValue: emailCodes },
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

  it('emails a verification code on register, and still registers if the email fails', async () => {
    const { passwordHash: _hash, ...created } = storedUser;
    usersService.create.mockResolvedValue(created);
    emailCodes.send.mockRejectedValue(new Error('smtp down'));

    const result = await service.register({ email: 'a@b.co', password: '12345678', fullName: 'Ada', major: 'CS' });

    expect(emailCodes.send).toHaveBeenCalledWith(created, 'VERIFY_EMAIL');
    expect(result.accessToken).toBe('signed-token');
  });

  it('sends a reset code only to registered emails, answering the same either way', async () => {
    usersService.findByEmailWithHash.mockResolvedValueOnce(null);
    await expect(service.forgotPassword('x@y.co')).resolves.toBeUndefined();
    expect(emailCodes.send).not.toHaveBeenCalled();

    usersService.findByEmailWithHash.mockResolvedValueOnce(storedUser);
    emailCodes.send.mockRejectedValueOnce(new HttpException('Wait', 429));
    await expect(service.forgotPassword('a@b.co')).resolves.toBeUndefined();
    expect(emailCodes.send).toHaveBeenCalledWith(storedUser, 'RESET_PASSWORD');
  });

  it('resets the password with a valid code and signs the user in', async () => {
    usersService.findByEmailWithHash.mockResolvedValue(storedUser);
    emailCodes.consume.mockResolvedValue(true);
    usersService.resetPassword.mockResolvedValue({ id: 'user-id', email: 'a@b.co' });

    const result = await service.resetPassword({ email: 'a@b.co', code: '123456', newPassword: 'new-password' });

    expect(emailCodes.consume).toHaveBeenCalledWith('user-id', 'RESET_PASSWORD', '123456');
    expect(usersService.resetPassword).toHaveBeenCalledWith('user-id', 'new-password');
    expect(result.accessToken).toBe('signed-token');
  });

  it('rejects a wrong reset code, and an unknown email the same way', async () => {
    usersService.findByEmailWithHash.mockResolvedValueOnce(storedUser);
    emailCodes.consume.mockResolvedValueOnce(false);
    await expect(
      service.resetPassword({ email: 'a@b.co', code: '000000', newPassword: 'new-password' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    usersService.findByEmailWithHash.mockResolvedValueOnce(null);
    await expect(
      service.resetPassword({ email: 'x@y.co', code: '000000', newPassword: 'new-password' }),
    ).rejects.toThrow('Invalid or expired code');
    expect(usersService.resetPassword).not.toHaveBeenCalled();
  });

  it('verifies the email with the right code and skips users already verified', async () => {
    usersService.findSelf.mockResolvedValueOnce(storedUser);
    emailCodes.consume.mockResolvedValueOnce(true);
    await service.verifyEmail('user-id', '123456');
    expect(usersService.markEmailVerified).toHaveBeenCalledWith('user-id');

    usersService.findSelf.mockResolvedValueOnce({ ...storedUser, emailVerifiedAt: new Date() });
    await service.sendVerificationEmail('user-id');
    expect(emailCodes.send).not.toHaveBeenCalled();
  });
});

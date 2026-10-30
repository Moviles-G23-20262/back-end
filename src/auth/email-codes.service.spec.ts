import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { EmailCodesService } from './email-codes.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma.service';

describe('EmailCodesService', () => {
  const user = { id: 'user-id', email: 'ada@uni.edu', fullName: 'Ada Lovelace' };
  const prisma = {
    emailCode: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const mail = { send: jest.fn() };
  const service = new EmailCodesService(prisma as unknown as PrismaService, mail as unknown as MailService);

  beforeEach(() => jest.resetAllMocks());

  it('emails a 6-digit code and stores only its hash', async () => {
    prisma.emailCode.findUnique.mockResolvedValue(null);

    await service.send(user, 'RESET_PASSWORD');

    const sent = mail.send.mock.calls[0][0];
    const code = /\b(\d{6})\b/.exec(sent.text)![1];
    expect(sent.to).toBe('ada@uni.edu');
    expect(sent.html).toContain(code);
    const { create } = prisma.emailCode.upsert.mock.calls[0][0];
    expect(create.codeHash).toMatch(/^\$2[aby]\$/);
    expect(create.codeHash).not.toContain(code);
    expect(create.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('refuses a new code within a minute of the last one', async () => {
    prisma.emailCode.findUnique.mockResolvedValue({ createdAt: new Date() });

    await expect(service.send(user, 'VERIFY_EMAIL')).rejects.toBeInstanceOf(HttpException);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('drops the code and answers 503 when the email cannot be sent', async () => {
    prisma.emailCode.findUnique.mockResolvedValue(null);
    mail.send.mockRejectedValue(new Error('smtp down'));

    await expect(service.send(user, 'VERIFY_EMAIL')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.emailCode.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-id', purpose: 'VERIFY_EMAIL' },
    });
  });

  it('accepts the right code once', async () => {
    prisma.emailCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.emailCode.findUnique.mockResolvedValue({ id: 'code-id', codeHash: hashSync('123456', 4) });
    prisma.emailCode.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.consume('user-id', 'VERIFY_EMAIL', '123456')).resolves.toBe(true);
    expect(prisma.emailCode.deleteMany).toHaveBeenCalledWith({ where: { id: 'code-id' } });
  });

  it('rejects a wrong code without using it up', async () => {
    prisma.emailCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.emailCode.findUnique.mockResolvedValue({ id: 'code-id', codeHash: hashSync('123456', 4) });

    await expect(service.consume('user-id', 'VERIFY_EMAIL', '654321')).resolves.toBe(false);
    expect(prisma.emailCode.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects expired codes and codes out of attempts before comparing', async () => {
    prisma.emailCode.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.consume('user-id', 'RESET_PASSWORD', '123456')).resolves.toBe(false);
    const { where } = prisma.emailCode.updateMany.mock.calls[0][0];
    expect(where.attempts).toEqual({ lt: 5 });
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
    expect(prisma.emailCode.findUnique).not.toHaveBeenCalled();
  });
});

import { HttpException, HttpStatus, Injectable, ServiceUnavailableException, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';
import { EmailCodePurpose } from '../generated/prisma/client';

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;

const COPY: Record<EmailCodePurpose, { subject: string; intro: string }> = {
  VERIFY_EMAIL: {
    subject: 'Verify your Campus Swap email',
    intro: 'Use this code to verify your email in Campus Swap:',
  },
  RESET_PASSWORD: {
    subject: 'Reset your Campus Swap password',
    intro: 'Use this code to choose a new password in Campus Swap:',
  },
};

export interface CodeRecipient {
  id: string;
  email: string;
  fullName: string;
}

/** One-time 6-digit codes sent by email, used to verify an account and to reset a password. */
@Injectable()
export class EmailCodesService {
  private readonly logger = new Logger(EmailCodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Emails a fresh code, replacing any earlier one for the same purpose.
   * Throws 429 if the last code was sent less than a minute ago, and 503 if the email could not be sent.
   */
  async send(user: CodeRecipient, purpose: EmailCodePurpose): Promise<void> {
    const previous = await this.prisma.emailCode.findUnique({
      where: { userId_purpose: { userId: user.id, purpose } },
      select: { createdAt: true },
    });
    if (previous && Date.now() - previous.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new HttpException('Wait a minute before asking for another code', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const data = {
      codeHash: await hash(code, 10),
      attempts: 0,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
      createdAt: new Date(),
    };
    await this.prisma.emailCode.upsert({
      where: { userId_purpose: { userId: user.id, purpose } },
      create: { userId: user.id, purpose, ...data },
      update: data,
    });

    try {
      await this.mail.send({ to: user.email, ...this.compose(user.fullName, code, purpose) });
    } catch (error) {
      this.logger.error(`Could not email a ${purpose} code to ${user.email}`, error as Error);
      // Drop the unsent code so the cooldown doesn't block a retry.
      await this.prisma.emailCode.deleteMany({ where: { userId: user.id, purpose } });
      throw new ServiceUnavailableException('We could not send the email. Try again in a moment.');
    }
  }

  /** True (and the code is used up) when it matches; every try counts towards the attempt limit. */
  async consume(userId: string, purpose: EmailCodePurpose, code: string): Promise<boolean> {
    // Counting the attempt before comparing keeps parallel guesses within the limit.
    const { count } = await this.prisma.emailCode.updateMany({
      where: { userId, purpose, attempts: { lt: MAX_ATTEMPTS }, expiresAt: { gt: new Date() } },
      data: { attempts: { increment: 1 } },
    });
    if (count === 0) return false;

    const stored = await this.prisma.emailCode.findUnique({ where: { userId_purpose: { userId, purpose } } });
    if (!stored || !(await compare(code, stored.codeHash))) return false;

    const deleted = await this.prisma.emailCode.deleteMany({ where: { id: stored.id } });
    return deleted.count === 1;
  }

  private compose(fullName: string, code: string, purpose: EmailCodePurpose) {
    const { subject, intro } = COPY[purpose];
    const name = fullName.split(' ')[0] || fullName;
    const outro = `It expires in ${CODE_TTL_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`;
    return {
      subject,
      text: `Hi ${name},\n\n${intro}\n\n${code}\n\n${outro}\n\nCampus Swap`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1f2937">
<p>Hi ${escapeHtml(name)},</p>
<p>${intro}</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0">${code}</p>
<p style="color:#6b7280">${outro}</p>
<p>Campus Swap</p>
</div>`,
    };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

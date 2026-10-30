import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends email over SMTP. Defaults to Gmail: set `SMTP_USER` to the team's Gmail address and
 * `SMTP_PASS` to a Google "app password" (not the account password).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;

  get isConfigured(): boolean {
    return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.isConfigured) {
      // Local development without credentials: show the mail in the console instead of failing.
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(`SMTP is not configured; not sending "${message.subject}" to ${message.to}:\n${message.text}`);
        return;
      }
      throw new Error('SMTP_USER and SMTP_PASS are not set');
    }
    await this.transport().sendMail({
      from: process.env.MAIL_FROM ?? `Campus Swap <${process.env.SMTP_USER}>`,
      ...message,
    });
  }

  private transport(): Transporter {
    const port = Number(process.env.SMTP_PORT ?? 465);
    this.transporter ??= createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    return this.transporter;
  }
}

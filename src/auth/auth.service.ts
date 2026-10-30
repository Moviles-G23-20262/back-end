import { BadRequestException, HttpException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hashSync } from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/email-code.dto';
import { EmailCodesService } from './email-codes.service';

// Compared against when the email doesn't exist so response time doesn't reveal which emails are registered.
const DUMMY_HASH = hashSync('dummy-password', 10);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailCodes: EmailCodesService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    // The account works without it; the app can ask for the code again later.
    await this.emailCodes.send(user, 'VERIFY_EMAIL').catch((error: Error) =>
      this.logger.warn(`No verification email for new user ${user.id}: ${error.message}`),
    );
    return { user, accessToken: await this.signToken(user) };
  }

  async login({ email, password }: LoginDto) {
    const found = await this.usersService.findByEmailWithHash(email);
    const passwordMatches = await compare(password, found?.passwordHash ?? DUMMY_HASH);
    if (!found || !passwordMatches) throw new UnauthorizedException('Invalid credentials');

    const { passwordHash: _passwordHash, ...user } = found;
    return { user, accessToken: await this.signToken(user) };
  }

  me(userId: string) {
    return this.usersService.findOne(userId, { isAdmin: false, userId });
  }

  /** Emails a reset code. Says nothing about whether the email is registered, so the caller can't probe for accounts. */
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmailWithHash(email);
    if (!user) return;
    await this.emailCodes.send(user, 'RESET_PASSWORD').catch((error: unknown) => {
      // A second request within the cooldown is answered like the first one; the earlier code still works.
      if (error instanceof HttpException && error.getStatus() === 429) return;
      throw error;
    });
  }

  /** Sets the new password and signs the user in, so the app can go straight to the home screen. */
  async resetPassword({ email, code, newPassword }: ResetPasswordDto) {
    const found = await this.usersService.findByEmailWithHash(email);
    const valid = found && (await this.emailCodes.consume(found.id, 'RESET_PASSWORD', code));
    if (!found || !valid) throw new BadRequestException('Invalid or expired code');

    const user = await this.usersService.resetPassword(found.id, newPassword);
    return { user, accessToken: await this.signToken(user) };
  }

  async sendVerificationEmail(userId: string) {
    const user = await this.usersService.findSelf(userId);
    if (!user.emailVerifiedAt) await this.emailCodes.send(user, 'VERIFY_EMAIL');
  }

  async verifyEmail(userId: string, code: string) {
    const user = await this.usersService.findSelf(userId);
    if (user.emailVerifiedAt) return user;
    if (!(await this.emailCodes.consume(userId, 'VERIFY_EMAIL', code))) {
      throw new BadRequestException('Invalid or expired code');
    }
    return this.usersService.markEmailVerified(userId);
  }

  private signToken(user: { id: string; email: string }) {
    return this.jwtService.signAsync({ sub: user.id, email: user.email });
  }
}

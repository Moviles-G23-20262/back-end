import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const normaliseEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const SIX_DIGITS = /^\d{6}$/;

export class ForgotPasswordDto {
  @Transform(normaliseEmail)
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @Transform(normaliseEmail)
  @IsEmail()
  email!: string;

  @Matches(SIX_DIGITS, { message: 'code must be 6 digits' })
  code!: string;

  // Same rules as the password chosen at registration.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

export class VerifyEmailDto {
  @Matches(SIX_DIGITS, { message: 'code must be 6 digits' })
  code!: string;
}

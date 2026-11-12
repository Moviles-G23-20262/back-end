import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  AT_LEAST_TWO_LETTERS,
  CollapseSpaces,
  NO_EMOJI,
  NoControlChars,
  PERSON_NAME,
  StrongPassword,
} from '../../common/validation';

/** Only institutional addresses can sign up; the local part is the same one the app accepts. */
const INSTITUTIONAL_EMAIL = /^[a-z0-9%+_-]+(?:\.[a-z0-9%+_-]+)*@uniandes\.edu\.co$/;

export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  @Matches(INSTITUTIONAL_EMAIL, { message: 'email must be an institutional address (name@uniandes.edu.co)' })
  email!: string;

  // Plain-text password; UsersService hashes it before it reaches the database.
  // bcrypt only uses the first 72 bytes, hence the upper bound and the ASCII-only rule.
  @StrongPassword()
  password!: string;

  @CollapseSpaces()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(PERSON_NAME, { message: 'fullName must only have letters, spaces, periods and hyphens' })
  @Matches(AT_LEAST_TWO_LETTERS, { message: 'fullName must have at least 2 letters' })
  fullName!: string;

  @CollapseSpaces()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(AT_LEAST_TWO_LETTERS, { message: 'major must have at least 2 letters' })
  @Matches(NO_EMOJI, { message: 'major must not contain emojis' })
  @NoControlChars()
  major!: string;

  @IsOptional()
  @CollapseSpaces()
  @IsString()
  @MaxLength(80)
  @NoControlChars()
  faculty?: string;
}

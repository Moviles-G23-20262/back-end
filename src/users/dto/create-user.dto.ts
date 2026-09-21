import { IsEmail, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  passwordHash!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  major!: string;

  @IsOptional()
  @IsString()
  faculty?: string;

  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;
}

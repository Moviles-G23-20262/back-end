import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hashSync } from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

// Compared against when the email doesn't exist so response time doesn't reveal which emails are registered.
const DUMMY_HASH = hashSync('dummy-password', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
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
    return this.usersService.findOne(userId);
  }

  private signToken(user: { id: string; email: string }) {
    return this.jwtService.signAsync({ sub: user.id, email: user.email });
  }
}

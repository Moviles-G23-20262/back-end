import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma.service';
import { Prisma } from '../generated/prisma/client';
import { assertSelfOrAdmin, type AuthContext } from '../auth/auth-context';
import { publicUserSelect, userSummarySelect } from './public-user.select';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create({ password, ...data }: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: { ...data, passwordHash: await hash(password, BCRYPT_ROUNDS) },
        select: publicUserSelect,
      });
    } catch (error) {
      this.rethrowUniqueEmail(error);
    }
  }

  findAll() {
    return this.prisma.user.findMany({
      select: publicUserSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Your own profile (or an admin) gets the full public profile; anyone else only a summary. */
  async findOne(id: string, auth: AuthContext) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: auth.isAdmin || auth.userId === id ? publicUserSelect : userSummarySelect,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  // Internal use (auth): the only method that returns passwordHash. Never expose it from a controller.
  findByEmailWithHash(email: string) {
    return this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { ...publicUserSelect, passwordHash: true },
    });
  }

  async update(id: string, { password, ...data }: UpdateUserDto, auth: AuthContext) {
    assertSelfOrAdmin(auth, id);
    await this.ensureExists(id);
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...data,
          ...(password !== undefined && { passwordHash: await hash(password, BCRYPT_ROUNDS) }),
        },
        select: publicUserSelect,
      });
    } catch (error) {
      this.rethrowUniqueEmail(error);
    }
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.user.delete({
      where: { id },
      select: publicUserSelect,
    });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`User ${id} not found`);
  }

  private rethrowUniqueEmail(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A user with this email already exists');
    }
    throw error;
  }
}

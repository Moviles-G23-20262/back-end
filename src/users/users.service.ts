import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: createUserDto,
      select: this.publicUserSelect,
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      select: this.publicUserSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.publicUserSelect,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.ensureExists(id);
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: this.publicUserSelect,
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.user.delete({
      where: { id },
      select: this.publicUserSelect,
    });
  }

  private readonly publicUserSelect = {
    id: true,
    email: true,
    fullName: true,
    major: true,
    faculty: true,
    rating: true,
    createdAt: true,
  } as const;

  private async ensureExists(id: string) {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`User ${id} not found`);
  }
}

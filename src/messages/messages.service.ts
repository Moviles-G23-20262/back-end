import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createMessageDto: CreateMessageDto) {
    return this.prisma.message.create({
      data: createMessageDto,
      include: { sender: true, chatRoom: true },
    });
  }

  findAll() {
    return this.prisma.message.findMany({
      include: { sender: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: { sender: true, chatRoom: true },
    });
    if (!message) throw new NotFoundException(`Message ${id} not found`);
    return message;
  }

  async update(id: string, updateMessageDto: UpdateMessageDto) {
    await this.ensureExists(id);
    return this.prisma.message.update({
      where: { id },
      data: updateMessageDto,
      include: { sender: true, chatRoom: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.message.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.message.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Message ${id} not found`);
  }
}

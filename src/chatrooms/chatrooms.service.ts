import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateChatroomDto } from './dto/create-chatroom.dto';
import { UpdateChatroomDto } from './dto/update-chatroom.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ChatroomsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createChatroomDto: CreateChatroomDto) {
    if (createChatroomDto.buyerId === createChatroomDto.sellerId) {
      throw new BadRequestException('Buyer and seller must be different users');
    }
    return this.prisma.chatRoom.create({
      data: createChatroomDto,
      include: { material: true, buyer: true, seller: true, messages: true },
    });
  }

  findAll() {
    return this.prisma.chatRoom.findMany({
      include: { material: true, buyer: true, seller: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const chatroom = await this.prisma.chatRoom.findUnique({
      where: { id },
      include: { material: true, buyer: true, seller: true, messages: true },
    });
    if (!chatroom) throw new NotFoundException(`Chatroom ${id} not found`);
    return chatroom;
  }

  async update(id: string, updateChatroomDto: UpdateChatroomDto) {
    await this.ensureExists(id);
    if (updateChatroomDto.buyerId === updateChatroomDto.sellerId) {
      throw new BadRequestException('Buyer and seller must be different users');
    }
    return this.prisma.chatRoom.update({
      where: { id },
      data: updateChatroomDto,
      include: { material: true, buyer: true, seller: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.chatRoom.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.chatRoom.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Chatroom ${id} not found`);
  }
}

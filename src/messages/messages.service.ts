import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { FindMessagesQueryDto } from './dto/find-messages-query.dto';
import { PrismaService } from '../prisma.service';
import { actingUserId, participantWhere, requireUserId, type AuthContext } from '../auth/auth-context';
import { userSummarySelect } from '../users/public-user.select';

const withSender = { sender: { select: userSummarySelect } } as const;

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMessageDto: CreateMessageDto, auth: AuthContext) {
    const { chatRoomId, content } = createMessageDto;
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
      select: { buyerId: true, sellerId: true },
    });
    if (!room) throw new NotFoundException(`Chatroom ${chatRoomId} not found`);
    this.assertParticipant(room, auth);

    const senderId = actingUserId(auth, createMessageDto.senderId, 'senderId');
    return this.prisma.message.create({
      // From the app a new message is never "read"; the other side marks it when they open the chat.
      data: { chatRoomId, senderId, content, isRead: auth.isAdmin ? createMessageDto.isRead : false },
      include: withSender,
    });
  }

  findAll({ chatRoomId }: FindMessagesQueryDto, auth: AuthContext) {
    return this.prisma.message.findMany({
      where: {
        chatRoomId,
        ...(!auth.isAdmin && { chatRoom: participantWhere(requireUserId(auth)) }),
      },
      include: withSender,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, auth: AuthContext) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: { ...withSender, chatRoom: true },
    });
    if (!message) throw new NotFoundException(`Message ${id} not found`);
    this.assertParticipant(message.chatRoom, auth);
    return message;
  }

  async update(id: string, updateMessageDto: UpdateMessageDto) {
    await this.ensureExists(id);
    return this.prisma.message.update({
      where: { id },
      data: updateMessageDto,
      include: { ...withSender, chatRoom: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.message.delete({ where: { id } });
  }

  private assertParticipant(room: { buyerId: string; sellerId: string }, auth: AuthContext) {
    if (auth.isAdmin) return;
    if (auth.userId !== room.buyerId && auth.userId !== room.sellerId) {
      throw new ForbiddenException('You are not part of this conversation');
    }
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.message.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Message ${id} not found`);
  }
}

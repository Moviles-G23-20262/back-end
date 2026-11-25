import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { FindMessagesQueryDto } from './dto/find-messages-query.dto';
import { PrismaService } from '../prisma.service';
import { actingUserId, participantWhere, requireUserId, type AuthContext } from '../auth/auth-context';
import { userSummarySelect } from '../users/public-user.select';

const withSender = {
  sender: { select: userSummarySelect },
  // MEETING messages render as a card with the proposal's current status.
  meetingProposal: { include: { meetingPoint: true } },
} as const;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMessageDto: CreateMessageDto, auth: AuthContext) {
    const { id, chatRoomId, content, clientCreatedAt } = createMessageDto;
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
      select: { buyerId: true, sellerId: true },
    });
    if (!room) throw new NotFoundException(`Chatroom ${chatRoomId} not found`);
    this.assertParticipant(room, auth);

    const senderId = actingUserId(auth, createMessageDto.senderId, 'senderId');
    const createdAt = this.resolveCreatedAt(clientCreatedAt);

    try {
      return await this.prisma.message.create({
        // From the app a new message is never "read"; the other side marks it when they open the chat.
        data: {
          ...(id && { id }),
          chatRoomId,
          senderId,
          content,
          isRead: auth.isAdmin ? createMessageDto.isRead : false,
          ...(createdAt && { createdAt }),
        },
        include: withSender,
      });
    } catch (err: unknown) {
      // Idempotent offline retry: if the client UUID was already saved by the same sender in this
      // room, return the existing row instead of duplicating it.
      const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: unknown }).code : null;
      if (id && code === 'P2002') {
        const existing = await this.prisma.message.findUnique({
          where: { id },
          include: withSender,
        });
        if (existing && existing.senderId === senderId && existing.chatRoomId === chatRoomId) {
          return existing;
        }
        throw new ConflictException(`Message ${id} already exists`);
      }
      throw err;
    }
  }

  /** Accepts clientCreatedAt only if it is within the last 7 days and not in the future. */
  private resolveCreatedAt(raw?: string): Date | undefined {
    if (!raw) return undefined;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return undefined;
    const now = Date.now();
    const ts = parsed.getTime();
    if (ts > now || ts < now - SEVEN_DAYS_MS) return new Date(now);
    return parsed;
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

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateChatroomDto } from './dto/create-chatroom.dto';
import { UpdateChatroomDto } from './dto/update-chatroom.dto';
import { PrismaService } from '../prisma.service';
import { actingUserId, participantWhere, requireUserId, type AuthContext } from '../auth/auth-context';
import { userSummarySelect } from '../users/public-user.select';

const parties = {
  buyer: { select: userSummarySelect },
  seller: { select: userSummarySelect },
} as const;

@Injectable()
export class ChatroomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createChatroomDto: CreateChatroomDto, auth: AuthContext) {
    const { materialId } = createChatroomDto;
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { sellerId: true },
    });
    if (!material) throw new NotFoundException(`Material ${materialId} not found`);

    const buyerId = actingUserId(auth, createChatroomDto.buyerId, 'buyerId');
    // Nobody picks who the seller is: it is whoever owns the listing.
    const sellerId = auth.isAdmin ? (createChatroomDto.sellerId ?? material.sellerId) : material.sellerId;
    if (buyerId === sellerId) {
      throw new BadRequestException('Buyer and seller must be different users');
    }

    // Tapping "Message seller" twice must open the same conversation.
    const existing = await this.prisma.chatRoom.findFirst({
      where: { materialId, buyerId },
      include: { material: true, ...parties },
    });
    if (existing) return existing;

    return this.prisma.chatRoom.create({
      data: { materialId, buyerId, sellerId },
      include: { material: true, ...parties },
    });
  }

  /** Conversation list: the caller's rooms with the last message and how many are unread. */
  findAll(auth: AuthContext) {
    if (auth.isAdmin) {
      return this.prisma.chatRoom.findMany({
        include: { material: true, ...parties },
        orderBy: { createdAt: 'desc' },
      });
    }
    const userId = requireUserId(auth);
    return this.prisma.chatRoom.findMany({
      where: participantWhere(userId),
      orderBy: { createdAt: 'desc' },
      include: {
        material: true,
        ...parties,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: { where: { isRead: false, senderId: { not: userId } } } } },
      },
    });
  }

  async findOne(id: string, auth: AuthContext) {
    const chatroom = await this.prisma.chatRoom.findUnique({
      where: { id },
      include: {
        material: true,
        ...parties,
        messages: { orderBy: { createdAt: 'asc' }, include: { meetingProposal: { include: { meetingPoint: true } } } },
      },
    });
    if (!chatroom) throw new NotFoundException(`Chatroom ${id} not found`);
    this.assertParticipant(chatroom, auth);
    return chatroom;
  }

  /** The caller has seen the conversation: mark the other person's messages as read. */
  async markRead(id: string, auth: AuthContext) {
    const userId = requireUserId(auth);
    const chatroom = await this.prisma.chatRoom.findUnique({
      where: { id },
      select: { buyerId: true, sellerId: true },
    });
    if (!chatroom) throw new NotFoundException(`Chatroom ${id} not found`);
    this.assertParticipant(chatroom, auth);

    const { count } = await this.prisma.message.updateMany({
      where: { chatRoomId: id, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
    return { updated: count };
  }

  async update(id: string, updateChatroomDto: UpdateChatroomDto) {
    await this.ensureExists(id);
    if (updateChatroomDto.buyerId === updateChatroomDto.sellerId) {
      throw new BadRequestException('Buyer and seller must be different users');
    }
    return this.prisma.chatRoom.update({
      where: { id },
      data: updateChatroomDto,
      include: { material: true, ...parties },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.chatRoom.delete({ where: { id } });
  }

  private assertParticipant(room: { buyerId: string; sellerId: string }, auth: AuthContext) {
    if (auth.isAdmin) return;
    if (auth.userId !== room.buyerId && auth.userId !== room.sellerId) {
      throw new ForbiddenException('You are not part of this conversation');
    }
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.chatRoom.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Chatroom ${id} not found`);
  }
}

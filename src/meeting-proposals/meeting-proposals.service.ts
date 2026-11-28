import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateMeetingProposalDto } from './dto/create-meeting-proposal.dto';
import { UpdateMeetingProposalDto } from './dto/update-meeting-proposal.dto';
import { actingUserId, requireUserId, type AuthContext } from '../auth/auth-context';
import { formatCampusDate, formatCampusTime } from '../schedule-blocks/campus-time';
import { findSharedFreeSlots, suggestedSlot } from '../schedule-blocks/shared-free-slots';

const withPoint = { meetingPoint: true } as const;

const MAX_MEETING_MINUTES = 4 * 60;

type Room = { id: string; buyerId: string; sellerId: string; materialId: string };
type Reply = 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

@Injectable()
export class MeetingProposalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMeetingProposalDto, auth: AuthContext) {
    const proposerId = actingUserId(auth, dto.proposerId, 'proposerId');
    const { clientId, chatRoomId, meetingPointId } = dto;
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.roomFor(chatRoomId, proposerId, tx);
        if (clientId) {
          const existing = await this.findCreatedProposal(clientId, chatRoomId, proposerId, tx);
          if (existing) return existing;
        }

        const now = new Date();
        if (endsAt <= startsAt) throw new BadRequestException('The meeting has to end after it starts');
        if (startsAt <= now) throw new BadRequestException('The meeting has to be in the future');
        if (endsAt.getTime() - startsAt.getTime() > MAX_MEETING_MINUTES * 60_000) {
          throw new BadRequestException('A meeting can last at most 4 hours');
        }
        const point = await tx.meetingPoint.findUnique({ where: { id: meetingPointId } });
        if (!point) throw new BadRequestException('This meeting point is no longer available');

        // Only the newest unanswered proposal in a chat stays open.
        await tx.meetingProposal.updateMany({
          where: { chatRoomId, status: 'PENDING' },
          data: { status: 'CANCELLED', respondedAt: now },
        });
        const proposal = await tx.meetingProposal.create({
          data: { ...(clientId && { id: clientId }), chatRoomId, proposerId, meetingPointId: point.id, startsAt, endsAt },
          include: withPoint,
        });
        await tx.message.create({
          data: {
            chatRoomId,
            senderId: proposerId,
            type: 'MEETING',
            meetingProposalId: proposal.id,
            content: `Proposed meeting: ${point.name}, ${formatCampusDate(startsAt)} ${formatCampusTime(startsAt)} – ${formatCampusTime(endsAt)}`,
          },
        });
        return proposal;
      }, { isolationLevel: 'ReadCommitted' });
    } catch (error) {
      // On a concurrent retry, the primary key rejects the second insert and rolls back
      // that transaction's cancellation. The only visible result is the original proposal.
      if (clientId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.findCreatedProposal(clientId, chatRoomId, proposerId);
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async findCreatedProposal(
    id: string,
    chatRoomId: string,
    proposerId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const existing = await db.meetingProposal.findUnique({ where: { id }, include: withPoint });
    if (existing && (existing.chatRoomId !== chatRoomId || existing.proposerId !== proposerId)) {
      throw new ConflictException('This proposal could not be sent. Please create a new one.');
    }
    return existing;
  }

  async findAll(chatRoomId: string | undefined, auth: AuthContext) {
    if (!auth.isAdmin) {
      if (!chatRoomId) throw new BadRequestException('chatRoomId is required');
      await this.roomFor(chatRoomId, requireUserId(auth));
    }
    return this.prisma.meetingProposal.findMany({
      where: { chatRoomId },
      include: withPoint,
      orderBy: { createdAt: 'desc' },
    });
  }

  async suggestions(chatRoomId: string, auth: AuthContext) {
    const userId = requireUserId(auth);
    const room = await this.roomFor(chatRoomId, userId);
    const otherId = userId === room.buyerId ? room.sellerId : room.buyerId;

    const blocks = await this.prisma.scheduleBlock.findMany({
      where: { userId: { in: [userId, otherId] } },
      select: { userId: true, dayOfWeek: true, startMinute: true, endMinute: true },
    });
    const mine = blocks.filter((block) => block.userId === userId);
    const theirs = blocks.filter((block) => block.userId === otherId);

    const slots = findSharedFreeSlots(mine, theirs, new Date());
    return {
      slots,
      suggested: suggestedSlot(slots) ?? null,
      // Without a schedule we assume the person is free whenever campus is open.
      callerHasSchedule: mine.length > 0,
      otherHasSchedule: theirs.length > 0,
    };
  }

  accept(id: string, auth: AuthContext) {
    return this.reply(id, auth, 'ACCEPTED');
  }

  decline(id: string, auth: AuthContext) {
    return this.reply(id, auth, 'DECLINED');
  }

  cancel(id: string, auth: AuthContext) {
    return this.reply(id, auth, 'CANCELLED');
  }

  private async reply(id: string, auth: AuthContext, status: Reply) {
    const userId = requireUserId(auth);
    const { chatRoomId } = await this.find(id);

    return this.prisma.$transaction(async (tx) => {
      const room = await this.roomFor(chatRoomId, userId, tx);
      const proposal = await this.find(id, tx);
      const isProposer = proposal.proposerId === userId;
      if (status === 'CANCELLED' && !isProposer) {
        throw new ForbiddenException('Only who proposed the meeting can withdraw it');
      }
      if (status !== 'CANCELLED' && isProposer) {
        throw new ForbiddenException('The other person has to answer your proposal');
      }
      // A retry after a lost acceptance response returns the existing confirmation.
      if (status === 'ACCEPTED' && proposal.status === 'ACCEPTED') return proposal;
      if (proposal.status !== 'PENDING') throw new ConflictException('This proposal was already answered');

      const respondedAt = new Date();
      if (status === 'ACCEPTED' && proposal.startsAt <= respondedAt) {
        throw new BadRequestException('This meeting time has already passed');
      }
      const updated = await tx.meetingProposal.update({
        where: { id },
        data: { status, respondedAt },
        include: withPoint,
      });
      if (status !== 'ACCEPTED') return updated;

      // A newly agreed meetup replaces the one agreed before.
      await tx.meetingProposal.updateMany({
        where: { chatRoomId: room.id, status: 'ACCEPTED', id: { not: id } },
        data: { status: 'CANCELLED' },
      });
      await tx.exchange.updateMany({
        where: { materialId: room.materialId, buyerId: room.buyerId, status: 'PENDING' },
        data: {
          meetingPointId: updated.meetingPointId,
          meetingStartsAt: updated.startsAt,
          meetingEndsAt: updated.endsAt,
          lat: updated.meetingPoint.lat,
          lng: updated.meetingPoint.lng,
        },
      });
      await tx.message.create({
        data: {
          chatRoomId: room.id,
          senderId: userId,
          content: `Confirmed! See you at ${updated.meetingPoint.name} on ${formatCampusDate(updated.startsAt)} at ${formatCampusTime(updated.startsAt)}.`,
        },
      });
      return updated;
    }, { isolationLevel: 'ReadCommitted' });
  }

  async update(id: string, dto: UpdateMeetingProposalDto) {
    await this.find(id);
    return this.prisma.meetingProposal.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
      include: withPoint,
    });
  }

  async remove(id: string) {
    await this.find(id);
    return this.prisma.meetingProposal.delete({ where: { id } });
  }

  private async find(id: string, db: Prisma.TransactionClient = this.prisma) {
    const proposal = await db.meetingProposal.findUnique({ where: { id }, include: withPoint });
    if (!proposal) throw new NotFoundException(`Meeting proposal ${id} not found`);
    return proposal;
  }

  private async roomFor(chatRoomId: string, userId: string, tx?: Prisma.TransactionClient): Promise<Room> {
    // Proposal creation and replies take the same room lock before reading or changing status.
    const room = tx
      ? (await tx.$queryRaw<Room[]>`
          SELECT "id", "buyerId", "sellerId", "materialId" FROM "ChatRoom"
          WHERE "id" = ${chatRoomId}::uuid FOR NO KEY UPDATE
        `)[0]
      : await this.prisma.chatRoom.findUnique({
          where: { id: chatRoomId },
          select: { id: true, buyerId: true, sellerId: true, materialId: true },
        });
    if (!room) throw new NotFoundException(`Chatroom ${chatRoomId} not found`);
    if (userId !== room.buyerId && userId !== room.sellerId) {
      throw new ForbiddenException('You are not part of this conversation');
    }
    return room;
  }
}

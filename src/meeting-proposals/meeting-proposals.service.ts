import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMeetingProposalDto } from './dto/create-meeting-proposal.dto';
import { UpdateMeetingProposalDto } from './dto/update-meeting-proposal.dto';
import { actingUserId, requireUserId, type AuthContext } from '../auth/auth-context';
import { formatCampusDate, formatCampusTime } from '../schedule-blocks/campus-time';
import { findSharedFreeSlots, suggestedSlot } from '../schedule-blocks/shared-free-slots';

const withPoint = { meetingPoint: true } as const;

const MAX_MEETING_MINUTES = 4 * 60;

type Room = { id: string; buyerId: string; sellerId: string; materialId: string };

@Injectable()
export class MeetingProposalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMeetingProposalDto, auth: AuthContext) {
    const proposerId = actingUserId(auth, dto.proposerId, 'proposerId');
    await this.roomFor(dto.chatRoomId, proposerId);

    const point = await this.prisma.meetingPoint.findUnique({ where: { id: dto.meetingPointId } });
    if (!point) throw new BadRequestException(`Meeting point ${dto.meetingPointId} not found`);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('The meeting has to end after it starts');
    if (startsAt <= new Date()) throw new BadRequestException('The meeting has to be in the future');
    if (endsAt.getTime() - startsAt.getTime() > MAX_MEETING_MINUTES * 60_000) {
      throw new BadRequestException('A meeting can last at most 4 hours');
    }

    return this.prisma.$transaction(async (tx) => {
      // Only the newest unanswered proposal in a chat stays open.
      await tx.meetingProposal.updateMany({
        where: { chatRoomId: dto.chatRoomId, status: 'PENDING' },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });
      const proposal = await tx.meetingProposal.create({
        data: { chatRoomId: dto.chatRoomId, proposerId, meetingPointId: point.id, startsAt, endsAt },
        include: withPoint,
      });
      await tx.message.create({
        data: {
          chatRoomId: dto.chatRoomId,
          senderId: proposerId,
          type: 'MEETING',
          meetingProposalId: proposal.id,
          content: `Proposed meeting: ${point.name}, ${formatCampusDate(startsAt)} ${formatCampusTime(startsAt)} – ${formatCampusTime(endsAt)}`,
        },
      });
      return proposal;
    });
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

  async accept(id: string, auth: AuthContext) {
    const { proposal, room, userId } = await this.answerable(id, auth);
    if (proposal.startsAt <= new Date()) {
      throw new BadRequestException('This meeting time has already passed');
    }

    return this.prisma.$transaction(async (tx) => {
      // A newly agreed meetup replaces the one agreed before.
      await tx.meetingProposal.updateMany({
        where: { chatRoomId: room.id, status: 'ACCEPTED' },
        data: { status: 'CANCELLED' },
      });
      const accepted = await tx.meetingProposal.update({
        where: { id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
        include: withPoint,
      });
      await tx.exchange.updateMany({
        where: { materialId: room.materialId, buyerId: room.buyerId, status: 'PENDING' },
        data: {
          meetingPointId: accepted.meetingPointId,
          meetingStartsAt: accepted.startsAt,
          meetingEndsAt: accepted.endsAt,
          lat: accepted.meetingPoint.lat,
          lng: accepted.meetingPoint.lng,
        },
      });
      await tx.message.create({
        data: {
          chatRoomId: room.id,
          senderId: userId,
          content: `Confirmed! See you at ${accepted.meetingPoint.name} on ${formatCampusDate(accepted.startsAt)} at ${formatCampusTime(accepted.startsAt)}.`,
        },
      });
      return accepted;
    });
  }

  async decline(id: string, auth: AuthContext) {
    await this.answerable(id, auth);
    return this.prisma.meetingProposal.update({
      where: { id },
      data: { status: 'DECLINED', respondedAt: new Date() },
      include: withPoint,
    });
  }

  async cancel(id: string, auth: AuthContext) {
    const userId = requireUserId(auth);
    const proposal = await this.find(id);
    if (proposal.proposerId !== userId) {
      throw new ForbiddenException('Only who proposed the meeting can withdraw it');
    }
    if (proposal.status !== 'PENDING') throw new ConflictException('This proposal was already answered');
    return this.prisma.meetingProposal.update({
      where: { id },
      data: { status: 'CANCELLED', respondedAt: new Date() },
      include: withPoint,
    });
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

  /** A pending proposal the caller may answer: they are in the chat and did not propose it. */
  private async answerable(id: string, auth: AuthContext) {
    const userId = requireUserId(auth);
    const proposal = await this.find(id);
    const room = await this.roomFor(proposal.chatRoomId, userId);
    if (proposal.proposerId === userId) {
      throw new ForbiddenException('The other person has to answer your proposal');
    }
    if (proposal.status !== 'PENDING') throw new ConflictException('This proposal was already answered');
    return { proposal, room, userId };
  }

  private async find(id: string) {
    const proposal = await this.prisma.meetingProposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException(`Meeting proposal ${id} not found`);
    return proposal;
  }

  private async roomFor(chatRoomId: string, userId: string): Promise<Room> {
    const room = await this.prisma.chatRoom.findUnique({
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

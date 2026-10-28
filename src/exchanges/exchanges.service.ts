import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateExchangeDto } from './dto/create-exchange.dto';
import { UpdateExchangeDto } from './dto/update-exchange.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { CompleteExchangeDto } from './dto/complete-exchange.dto';
import { FindExchangesQueryDto } from './dto/find-exchanges-query.dto';
import { PrismaService } from '../prisma.service';
import { participantWhere, requireUserId, type AuthContext } from '../auth/auth-context';
import { userSummarySelect } from '../users/public-user.select';
import type { ExchangeStatus } from '../generated/prisma/client';

const details = {
  material: true,
  buyer: { select: userSummarySelect },
  seller: { select: userSummarySelect },
  meetingPoint: true,
} as const;

@Injectable()
export class ExchangesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createExchangeDto: CreateExchangeDto) {
    if (createExchangeDto.buyerId === createExchangeDto.sellerId) {
      throw new BadRequestException('Buyer and seller must be different users');
    }
    await this.validateLocation(createExchangeDto);

    const status = createExchangeDto.status ?? 'COMPLETED';
    return this.prisma.exchange.create({
      data: { ...createExchangeDto, status, ...this.statusDates(status) },
      include: details,
    });
  }

  /**
   * The buyer orders a listing: it becomes RESERVED so nobody else can order it,
   * and the seller gets a notification.
   */
  async placeOrder({ materialId }: PlaceOrderDto, auth: AuthContext) {
    const buyerId = requireUserId(auth);
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { id: true, sellerId: true, price: true },
    });
    if (!material) throw new NotFoundException(`Material ${materialId} not found`);
    if (material.sellerId === buyerId) throw new BadRequestException('You cannot order your own listing');

    return this.prisma.$transaction(async (tx) => {
      // Conditional update: two buyers ordering at once can't both win.
      const { count } = await tx.material.updateMany({
        where: { id: materialId, status: 'AVAILABLE' },
        data: { status: 'RESERVED' },
      });
      if (count === 0) throw new ConflictException('This listing is no longer available');

      // A meetup already agreed in the chat carries over to the order.
      const agreed = await tx.meetingProposal.findFirst({
        where: { status: 'ACCEPTED', chatRoom: { materialId, buyerId } },
        include: { meetingPoint: true },
        orderBy: { respondedAt: 'desc' },
      });

      const exchange = await tx.exchange.create({
        data: {
          materialId,
          buyerId,
          sellerId: material.sellerId,
          price: material.price,
          ...(agreed && {
            meetingPointId: agreed.meetingPointId,
            meetingStartsAt: agreed.startsAt,
            meetingEndsAt: agreed.endsAt,
            lat: agreed.meetingPoint.lat,
            lng: agreed.meetingPoint.lng,
          }),
        },
        include: details,
      });
      await tx.notification.create({
        data: { userId: material.sellerId, materialId, type: 'ORDER_PLACED' },
      });
      return exchange;
    });
  }

  /** The buyer checked the item at the meetup: the sale is done and the listing is SOLD. */
  async complete(id: string, { receivedCondition, lat, lng }: CompleteExchangeDto, auth: AuthContext) {
    const userId = requireUserId(auth);
    if ((lat === undefined) !== (lng === undefined)) {
      throw new BadRequestException('lat and lng must be sent together');
    }
    const exchange = await this.findOne(id, auth);
    if (exchange.buyerId !== userId) throw new ForbiddenException('Only the buyer can complete the exchange');
    this.assertPending(exchange.status);

    return this.prisma.$transaction(async (tx) => {
      await tx.material.update({ where: { id: exchange.materialId }, data: { status: 'SOLD' } });
      const completed = await tx.exchange.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date(), receivedCondition, ...(lat !== undefined && { lat, lng }) },
        include: details,
      });

      // BQ11: record completed sale analytics event
      await tx.analyticsEvent.create({
        data: {
          eventType: 'EXCHANGE_CONFIRMED',
          userId: exchange.buyerId,
          materialId: exchange.materialId,
          occurredAt: completed.completedAt ?? new Date(),
          metadata: {
            exchangeId: id,
            sellerId: exchange.sellerId,
            price: exchange.price.toString(),
            category: exchange.material?.category,
          },
        },
      });

      return completed;
    });
  }

  /** Either side backs out; the listing goes back on the market. */
  async cancel(id: string, auth: AuthContext) {
    requireUserId(auth);
    const exchange = await this.findOne(id, auth);
    this.assertPending(exchange.status);

    return this.prisma.$transaction(async (tx) => {
      await tx.material.updateMany({
        where: { id: exchange.materialId, status: 'RESERVED' },
        data: { status: 'AVAILABLE' },
      });
      return tx.exchange.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        include: details,
      });
    });
  }

  findAll({ materialId, status }: FindExchangesQueryDto, auth: AuthContext) {
    return this.prisma.exchange.findMany({
      where: {
        materialId,
        status,
        ...(!auth.isAdmin && participantWhere(requireUserId(auth))),
      },
      include: details,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, auth: AuthContext) {
    const exchange = await this.prisma.exchange.findUnique({
      where: { id },
      include: details,
    });
    if (!exchange) throw new NotFoundException(`Exchange ${id} not found`);
    if (!auth.isAdmin && auth.userId !== exchange.buyerId && auth.userId !== exchange.sellerId) {
      throw new ForbiddenException('You are not part of this exchange');
    }
    return exchange;
  }

  async update(id: string, updateExchangeDto: UpdateExchangeDto) {
    await this.ensureExists(id);
    if (
      updateExchangeDto.buyerId &&
      updateExchangeDto.sellerId &&
      updateExchangeDto.buyerId === updateExchangeDto.sellerId
    ) {
      throw new BadRequestException('Buyer and seller must be different users');
    }
    await this.validateLocation(updateExchangeDto);

    return this.prisma.exchange.update({
      where: { id },
      data: {
        ...updateExchangeDto,
        ...(updateExchangeDto.status && this.statusDates(updateExchangeDto.status)),
      },
      include: details,
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.exchange.delete({ where: { id } });
  }

  private assertPending(status: ExchangeStatus) {
    if (status !== 'PENDING') {
      throw new ConflictException(`This exchange is already ${status.toLowerCase()}`);
    }
  }

  /** Keeps completedAt / cancelledAt in step with a status set by an admin. */
  private statusDates(status: ExchangeStatus) {
    const now = new Date();
    return {
      completedAt: status === 'COMPLETED' ? now : null,
      cancelledAt: status === 'CANCELLED' ? now : null,
    };
  }

  private async validateLocation(dto: UpdateExchangeDto) {
    if ((dto.lat === undefined) !== (dto.lng === undefined)) {
      throw new BadRequestException('lat and lng must be sent together');
    }
    if (!dto.meetingPointId) return;
    const point = await this.prisma.meetingPoint.findUnique({
      where: { id: dto.meetingPointId },
      select: { id: true },
    });
    if (!point) throw new BadRequestException(`Meeting point ${dto.meetingPointId} not found`);
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.exchange.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Exchange ${id} not found`);
  }

  /**
   * BQ11: What is the average time (in days) it takes for a newly listed academic item to be marked as sold?
   */
  async getTimeToSell() {
    const exchanges = await this.prisma.exchange.findMany({
      where: { status: 'COMPLETED', completedAt: { not: null } },
      include: { material: { select: { category: true, createdAt: true } } },
    });

    const days: number[] = [];
    const byCategory = new Map<string, number[]>();
    let skipped = 0;

    for (const e of exchanges) {
      const listedAt = e.material?.createdAt;
      const soldAt = e.completedAt;
      if (!listedAt || !soldAt || soldAt < listedAt) {
        skipped++;
        continue;
      }
      const diffDays = (soldAt.getTime() - listedAt.getTime()) / (1000 * 60 * 60 * 24);
      days.push(diffDays);
      const cat = e.material.category;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(diffDays);
    }

    const buckets = [
      { upper: 1, label: 'Under 1 day' },
      { upper: 3, label: '1-3 days' },
      { upper: 7, label: '3-7 days' },
      { upper: 14, label: '1-2 weeks' },
      { upper: 30, label: '2-4 weeks' },
      { upper: null, label: '30+ days' },
    ];

    const histogram = buckets.map(({ upper, label }, idx) => {
      const lower = idx === 0 ? 0 : buckets[idx - 1].upper!;
      const count = days.filter((d) => d >= lower && (upper === null || d < upper)).length;
      return { bucket: label, sold: count };
    });

    const sorted = [...days].sort((a, b) => a - b);
    const mean = days.length ? Number((days.reduce((a, b) => a + b, 0) / days.length).toFixed(4)) : 0.0;
    const median = days.length ? Number(sorted[Math.floor(days.length / 2)].toFixed(4)) : 0.0;
    const p75 = days.length ? Number(sorted[Math.floor(days.length * 0.75)].toFixed(4)) : 0.0;
    const min = days.length ? Number(sorted[0].toFixed(4)) : 0.0;
    const max = days.length ? Number(sorted[sorted.length - 1].toFixed(4)) : 0.0;

    const categories = Array.from(byCategory.entries()).map(([cat, values]) => {
      const catSorted = [...values].sort((a, b) => a - b);
      const catMean = Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4));
      const catMedian = Number(catSorted[Math.floor(values.length / 2)].toFixed(4));
      return { category: cat, sold: values.length, mean_days: catMean, median_days: catMedian };
    });
    categories.sort((a, b) => a.median_days - b.median_days || a.category.localeCompare(b.category));

    return {
      sold_listings: days.length,
      skipped,
      days_to_sell: { mean, median, p75, min, max },
      histogram,
      by_category: categories,
    };
  }
}

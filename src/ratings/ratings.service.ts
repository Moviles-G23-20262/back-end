import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { FindRatingsQueryDto } from './dto/find-ratings-query.dto';
import { actingUserId, type AuthContext } from '../auth/auth-context';
import { userSummarySelect } from '../users/public-user.select';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRatingDto: CreateRatingDto, auth: AuthContext) {
    const { exchangeId, ratedId } = createRatingDto;
    const raterId = actingUserId(auth, createRatingDto.raterId, 'raterId');
    if (raterId === ratedId) {
      throw new BadRequestException('A user cannot rate themselves');
    }

    const exchange = await this.prisma.exchange.findUnique({
      where: { id: exchangeId },
      select: { buyerId: true, sellerId: true, status: true },
    });
    if (!exchange) throw new NotFoundException(`Exchange ${exchangeId} not found`);
    if (exchange.status !== 'COMPLETED') {
      throw new BadRequestException('You can rate each other once the exchange is completed');
    }

    const parties = [exchange.buyerId, exchange.sellerId];
    if (!parties.includes(raterId) || !parties.includes(ratedId)) {
      throw new BadRequestException('Only the buyer and the seller of this exchange can rate each other');
    }

    const existing = await this.prisma.rating.findUnique({
      where: { exchangeId_raterId: { exchangeId, raterId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('This user already rated this exchange');

    return this.prisma.$transaction(async (tx) => {
      const rating = await tx.rating.create({
        data: { ...createRatingDto, raterId, tags: createRatingDto.tags ?? [] },
      });
      const { _avg } = await tx.rating.aggregate({
        where: { ratedId },
        _avg: { stars: true },
      });
      await tx.user.update({ where: { id: ratedId }, data: { rating: _avg.stars ?? 0 } });
      return rating;
    });
  }

  findAll(query: FindRatingsQueryDto) {
    return this.prisma.rating.findMany({
      where: { ratedId: query.userId, exchangeId: query.exchangeId },
      include: { rater: { select: userSummarySelect } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rating = await this.prisma.rating.findUnique({ where: { id } });
    if (!rating) throw new NotFoundException(`Rating ${id} not found`);
    return rating;
  }
}
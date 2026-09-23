import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MeetingPointsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.meetingPoint.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const point = await this.prisma.meetingPoint.findUnique({ where: { id } });
    if (!point) throw new NotFoundException(`Meeting point ${id} not found`);
    return point;
  }
}

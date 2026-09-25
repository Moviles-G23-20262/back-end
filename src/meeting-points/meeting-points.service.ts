import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMeetingPointDto } from './dto/create-meeting-point.dto';
import { UpdateMeetingPointDto } from './dto/update-meeting-point.dto';

@Injectable()
export class MeetingPointsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createMeetingPointDto: CreateMeetingPointDto) {
    return this.prisma.meetingPoint.create({ data: createMeetingPointDto });
  }

  findAll() {
    return this.prisma.meetingPoint.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const point = await this.prisma.meetingPoint.findUnique({ where: { id } });
    if (!point) throw new NotFoundException(`Meeting point ${id} not found`);
    return point;
  }

  async update(id: string, updateMeetingPointDto: UpdateMeetingPointDto) {
    await this.ensureExists(id);
    return this.prisma.meetingPoint.update({ where: { id }, data: updateMeetingPointDto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.meetingPoint.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.meetingPoint.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Meeting point ${id} not found`);
  }
}

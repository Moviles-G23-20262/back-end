import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateScheduleBlockDto } from './dto/create-schedule-block.dto';
import { FindScheduleBlocksQueryDto } from './dto/find-schedule-blocks-query.dto';
import { UpdateScheduleBlockDto } from './dto/update-schedule-block.dto';
import { actingUserId, assertSelfOrAdmin, requireUserId, type AuthContext } from '../auth/auth-context';

const weekOrder = [{ dayOfWeek: 'asc' as const }, { startMinute: 'asc' as const }];

@Injectable()
export class ScheduleBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createScheduleBlockDto: CreateScheduleBlockDto, auth: AuthContext) {
    const { dayOfWeek, startMinute, endMinute, label } = createScheduleBlockDto;
    const userId = actingUserId(auth, createScheduleBlockDto.userId, 'userId');
    if (endMinute <= startMinute) {
      throw new BadRequestException('A class has to end after it starts');
    }

    const clash = await this.prisma.scheduleBlock.findFirst({
      where: { userId, dayOfWeek, startMinute: { lt: endMinute }, endMinute: { gt: startMinute } },
      select: { label: true },
    });
    if (clash) {
      throw new BadRequestException(`Overlaps with ${clash.label ?? 'another class'} on the same day`);
    }

    return this.prisma.scheduleBlock.create({
      data: { userId, dayOfWeek, startMinute, endMinute, label: label?.trim() || null },
    });
  }

  findAll({ userId }: FindScheduleBlocksQueryDto, auth: AuthContext) {
    return this.prisma.scheduleBlock.findMany({
      where: { userId: auth.isAdmin ? userId : requireUserId(auth) },
      orderBy: weekOrder,
    });
  }

  async update(id: string, updateScheduleBlockDto: UpdateScheduleBlockDto) {
    const block = await this.prisma.scheduleBlock.findUnique({ where: { id } });
    if (!block) throw new NotFoundException(`Schedule block ${id} not found`);
    const { startMinute = block.startMinute, endMinute = block.endMinute } = updateScheduleBlockDto;
    if (endMinute <= startMinute) {
      throw new BadRequestException('A class has to end after it starts');
    }
    return this.prisma.scheduleBlock.update({ where: { id }, data: updateScheduleBlockDto });
  }

  async remove(id: string, auth: AuthContext) {
    const block = await this.prisma.scheduleBlock.findUnique({ where: { id }, select: { userId: true } });
    if (!block) throw new NotFoundException(`Schedule block ${id} not found`);
    assertSelfOrAdmin(auth, block.userId);
    return this.prisma.scheduleBlock.delete({ where: { id } });
  }
}

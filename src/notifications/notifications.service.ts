import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createNotificationDto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        ...createNotificationDto,
        openedAt: createNotificationDto.openedAt
          ? new Date(createNotificationDto.openedAt)
          : undefined,
      },
      include: { user: true, material: true },
    });
  }

  findAll() {
    return this.prisma.notification.findMany({
      include: { user: true, material: true },
      orderBy: { sentAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: { user: true, material: true },
    });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    return notification;
  }

  async update(id: string, updateNotificationDto: UpdateNotificationDto) {
    await this.ensureExists(id);
    return this.prisma.notification.update({
      where: { id },
      data: {
        ...updateNotificationDto,
        openedAt: updateNotificationDto.openedAt
          ? new Date(updateNotificationDto.openedAt)
          : undefined,
      },
      include: { user: true, material: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.notification.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.notification.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Notification ${id} not found`);
  }
}

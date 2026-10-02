import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PrismaService } from '../prisma.service';
import { assertSelfOrAdmin, requireUserId, type AuthContext } from '../auth/auth-context';
import { userSummarySelect } from '../users/public-user.select';

const details = {
  user: { select: userSummarySelect },
  material: { include: { seller: { select: userSummarySelect } } },
} as const;

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
      include: details,
    });
  }

  findAll(auth: AuthContext) {
    return this.prisma.notification.findMany({
      where: auth.isAdmin ? undefined : { userId: requireUserId(auth) },
      include: details,
      orderBy: { sentAt: 'desc' },
    });
  }

  async findOne(id: string, auth: AuthContext) {
    const notification = await this.prisma.notification.findUnique({ where: { id }, include: details });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    assertSelfOrAdmin(auth, notification.userId);
    return notification;
  }

  async open(id: string, auth: AuthContext) {
    const notification = await this.findOne(id, auth);
    if (notification.openedAt) return notification;
    return this.prisma.notification.update({
      where: { id },
      data: { openedAt: new Date() },
      include: details,
    });
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
      include: details,
    });
  }

  async remove(id: string, auth: AuthContext) {
    const notification = await this.prisma.notification.findUnique({ where: { id }, select: { userId: true } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    assertSelfOrAdmin(auth, notification.userId);
    return this.prisma.notification.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.notification.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Notification ${id} not found`);
  }
}

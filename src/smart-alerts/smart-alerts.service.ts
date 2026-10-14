import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSmartAlertDto } from './dto/create-smart-alert.dto';
import { UpdateSmartAlertDto } from './dto/update-smart-alert.dto';
import { PrismaService } from '../prisma.service';
import { actingUserId, assertSelfOrAdmin, requireUserId, type AuthContext } from '../auth/auth-context';
import { alertMatches, type MatchableMaterial } from './smart-alert-matching';

@Injectable()
export class SmartAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createSmartAlertDto: CreateSmartAlertDto, auth: AuthContext) {
    const userId = actingUserId(auth, createSmartAlertDto.userId, 'userId');
    return this.prisma.smartAlert.create({ data: { ...createSmartAlertDto, userId } });
  }

  findAll(auth: AuthContext) {
    return this.prisma.smartAlert.findMany({
      where: auth.isAdmin ? undefined : { userId: requireUserId(auth) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, updateSmartAlertDto: UpdateSmartAlertDto, auth: AuthContext) {
    await this.ensureOwner(id, auth);
    return this.prisma.smartAlert.update({ where: { id }, data: updateSmartAlertDto });
  }

  async remove(id: string, auth: AuthContext) {
    await this.ensureOwner(id, auth);
    return this.prisma.smartAlert.delete({ where: { id } });
  }

  /**
   * Sends one SMART_MATCH notification to each student with an enabled alert that the new
   * listing satisfies (never to the seller, and once per student even if several alerts match).
   * Price and category are filtered in the database; keyword, course and condition here.
   */
  async notifyMatches(material: MatchableMaterial & { id: string; sellerId: string }): Promise<number> {
    const candidates = await this.prisma.smartAlert.findMany({
      where: {
        enabled: true,
        userId: { not: material.sellerId },
        maxPrice: { gte: material.price.toString() },
        OR: [{ category: null }, { category: material.category }],
      },
    });
    const owners = [...new Set(candidates.filter((alert) => alertMatches(alert, material)).map((alert) => alert.userId))];
    if (owners.length === 0) return 0;
    await this.prisma.notification.createMany({
      data: owners.map((userId) => ({ userId, materialId: material.id, type: 'SMART_MATCH' as const })),
    });
    return owners.length;
  }

  private async ensureOwner(id: string, auth: AuthContext) {
    const alert = await this.prisma.smartAlert.findUnique({ where: { id }, select: { userId: true } });
    if (!alert) throw new NotFoundException(`Smart alert ${id} not found`);
    assertSelfOrAdmin(auth, alert.userId);
  }
}

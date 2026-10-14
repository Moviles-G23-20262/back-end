import { Test, TestingModule } from '@nestjs/testing';
import { MaterialsService } from './materials.service';
import { PrismaService } from '../prisma.service';
import { SmartAlertsService } from '../smart-alerts/smart-alerts.service';

describe('MaterialsService', () => {
  let service: MaterialsService;
  const prisma = { material: { create: jest.fn() } };
  const smartAlerts = { notifyMatches: jest.fn() };

  const sellerId = '33333333-3333-4333-8333-333333333333';
  const dto = { title: 'Arduino UNO', description: 'Barely used', price: '45000', imageUrls: [], category: 'LAB_EQUIPMENT' as const };
  const created = { id: '11111111-1111-4111-8111-111111111111', sellerId, ...dto };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.material.create.mockResolvedValue(created);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaterialsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SmartAlertsService, useValue: smartAlerts },
      ],
    }).compile();

    service = module.get<MaterialsService>(MaterialsService);
  });

  it('publishing a listing notifies the students whose alerts it matches', async () => {
    smartAlerts.notifyMatches.mockResolvedValue(2);

    await expect(service.create(dto, { isAdmin: false, userId: sellerId })).resolves.toBe(created);
    expect(smartAlerts.notifyMatches).toHaveBeenCalledWith(created);
  });

  it('the listing is still published when the notifications fail', async () => {
    smartAlerts.notifyMatches.mockRejectedValue(new Error('database hiccup'));

    await expect(service.create(dto, { isAdmin: false, userId: sellerId })).resolves.toBe(created);
  });
});

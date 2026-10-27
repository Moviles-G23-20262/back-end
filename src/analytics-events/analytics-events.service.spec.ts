import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsEventsService } from './analytics-events.service';
import { PrismaService } from '../prisma.service';

describe('AnalyticsEventsService.createBatch', () => {
  let service: AnalyticsEventsService;
  const prisma = {
    material: { findMany: jest.fn() },
    analyticsEvent: { createMany: jest.fn() },
  };

  const userId = '22222222-2222-4222-8222-222222222222';
  const materialId = '11111111-1111-4111-8111-111111111111';
  const asUser = { isAdmin: false, userId };
  const event = (n: number, extra: Record<string, unknown> = {}) => ({
    client_id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`,
    eventType: 'LISTING_VIEW',
    occurredAt: '2026-10-12T15:30:00.000Z',
    clientCreatedAt: '2026-10-12T15:30:00.000Z',
    ...extra,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.material.findMany.mockResolvedValue([{ id: materialId }]);
    prisma.analyticsEvent.createMany.mockImplementation(({ data }: { data: unknown[] }) => ({ count: data.length }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsEventsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AnalyticsEventsService);
  });

  it('stores the events with their client id and creation time, as the signed-in user', async () => {
    const result = await service.createBatch([event(1, { materialId, userId: '99999999-9999-4999-8999-999999999999' })], asUser);

    expect(result).toEqual({ received: 1, created: 1, duplicates: 0, rejected: [] });
    const args = prisma.analyticsEvent.createMany.mock.calls[0][0];
    expect(args.skipDuplicates).toBe(true);
    expect(args.data[0]).toMatchObject({
      clientId: event(1).client_id,
      userId,
      materialId,
      eventType: 'LISTING_VIEW',
      occurredAt: new Date('2026-10-12T15:30:00.000Z'),
      clientCreatedAt: new Date('2026-10-12T15:30:00.000Z'),
    });
  });

  it('counts the events it already had as duplicates instead of failing', async () => {
    prisma.analyticsEvent.createMany.mockResolvedValue({ count: 1 });

    const result = await service.createBatch([event(1), event(2)], asUser);

    expect(result).toMatchObject({ received: 2, created: 1, duplicates: 1 });
  });

  it('skips an invalid event and still stores the others', async () => {
    const result = await service.createBatch(
      [event(1), event(2, { eventType: 'NOPE' }), event(3, { client_id: 'not-a-uuid' }), 'junk'],
      asUser,
    );

    expect(result.created).toBe(1);
    expect(result.rejected.map((r) => r.index)).toEqual([1, 2, 3]);
    expect(prisma.analyticsEvent.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it('rejects an event repeated inside the same batch', async () => {
    const result = await service.createBatch([event(1), event(1)], asUser);

    expect(result.created).toBe(1);
    expect(result.rejected).toEqual([{ index: 1, client_id: event(1).client_id, reason: 'Repeated inside the batch' }]);
  });

  it('keeps the event when its listing no longer exists', async () => {
    prisma.material.findMany.mockResolvedValue([]);

    await service.createBatch([event(1, { materialId })], asUser);

    expect(prisma.analyticsEvent.createMany.mock.calls[0][0].data[0].materialId).toBeUndefined();
  });

  it('uses occurredAt = clientCreatedAt when the app sends no occurredAt', async () => {
    const { occurredAt: _omit, ...withoutOccurredAt } = event(1);

    await service.createBatch([withoutOccurredAt], asUser);

    expect(prisma.analyticsEvent.createMany.mock.calls[0][0].data[0].occurredAt).toEqual(
      new Date('2026-10-12T15:30:00.000Z'),
    );
  });
});

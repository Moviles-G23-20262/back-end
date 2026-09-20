import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { SqlService } from './sql.service';

describe('SqlService', () => {
  let service: SqlService;
  const queryRaw = jest.fn<Promise<Record<string, unknown>[]>, [string]>();
  const executeRaw = jest.fn<Promise<number>, [string]>();
  const transaction = jest.fn((callback: (client: unknown) => unknown) =>
    Promise.resolve(
      callback({ $executeRawUnsafe: executeRaw, $queryRawUnsafe: queryRaw }),
    ),
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqlService,
        {
          provide: PrismaService,
          useValue: { $transaction: transaction },
        },
      ],
    }).compile();

    service = module.get<SqlService>(SqlService);
  });

  it('returns columns, rows, count, and duration for a SELECT query', async () => {
    queryRaw.mockResolvedValue([
      { id: 1n, title: 'Book', price: { constructor: { name: 'Decimal' }, toString: () => '32.50' } },
    ]);

    const result = await service.query('SELECT * FROM "Material" LIMIT 20');

    expect(result).toMatchObject({
      columns: ['id', 'title', 'price'],
      rows: [{ id: '1', title: 'Book', price: '32.50' }],
      rowCount: 1,
    });
    expect(typeof result.durationMs).toBe('number');
    expect(queryRaw).toHaveBeenCalledWith('SELECT * FROM "Material" LIMIT 20');
  });

  it('executes non-row statements and returns the affected row count', async () => {
    executeRaw.mockResolvedValue(3);

    const result = await service.query('UPDATE "Material" SET status = \'SOLD\'');

    expect(result).toMatchObject({
      columns: [],
      rows: [],
      rowCount: 3,
    });
    expect(executeRaw).toHaveBeenCalledWith(
      'UPDATE "Material" SET status = \'SOLD\'',
    );
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

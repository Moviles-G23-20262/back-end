import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type SqlRow = Record<string, unknown>;
type DecimalLike = { toString: () => string };

export interface SqlQueryResponse {
  columns: string[];
  rows: SqlRow[];
  rowCount: number;
  durationMs: number;
}

@Injectable()
export class SqlService {
  constructor(private readonly prisma: PrismaService) {}

  async query(query: string): Promise<SqlQueryResponse> {
    const sql = query.trim();

    if (!sql) {
      throw new BadRequestException('SQL query must not be empty');
    }

    const startedAt = performance.now();
    const result = await this.prisma.$transaction(async (transaction) => {
      if (this.returnsRows(sql)) {
        const rows = await transaction.$queryRawUnsafe<SqlRow[]>(sql);
        return { rows, rowCount: rows.length };
      }

      const rowCount = await transaction.$executeRawUnsafe(sql);
      return { rows: [], rowCount };
    });
    const durationMs = Math.round(performance.now() - startedAt);

    const columns = [
      ...result.rows.reduce((names, row) => {
        Object.keys(row).forEach((name) => names.add(name));
        return names;
      }, new Set<string>()),
    ];

    return {
      columns,
      rows: result.rows.map((row) => this.serializeRow(row)),
      rowCount: result.rowCount,
      durationMs,
    };
  }

  private returnsRows(sql: string): boolean {
    return /^(select|with|show|explain|values|table)\b/i.test(sql) ||
      /\breturning\b/i.test(sql);
  }

  private serializeRow(row: SqlRow): SqlRow {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, this.serializeValue(value)]),
    );
  }

  private serializeValue(value: unknown): unknown {
    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.serializeValue(item));
    }

    if (value && typeof value === 'object') {
      if (this.isDecimal(value)) {
        // Prisma Decimal values must retain their exact decimal representation.
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return value.toString();
      }

      return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          key,
          this.serializeValue(nestedValue),
        ]),
      );
    }

    return value;
  }

  private isDecimal(value: object): value is DecimalLike {
    return (
      value.constructor?.name === 'Decimal' &&
      typeof (value as Record<string, unknown>).toString === 'function'
    );
  }
}

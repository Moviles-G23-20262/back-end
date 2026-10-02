import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashSync } from 'bcryptjs';
import { MaterialCategory, MaterialCondition, PrismaClient } from '../src/generated/prisma/client';

const demoId = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const userId = (n: number) => demoId('a1000000', n);
const materialId = (n: number) => demoId('d1000000', n);
const exchangeId = (n: number) => demoId('e1000000', n);

const DEMO_DAYS = [
  '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11',
  '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18',
];

const exchangesPerHour: { point: string; hours: Record<number, number> }[] = [
  { point: 'Central Library lobby', hours: { 8: 1, 9: 2, 10: 4, 11: 3, 14: 3, 15: 4, 16: 2, 17: 1 } },
  { point: 'Mario Laserna lobby', hours: { 7: 1, 9: 1, 12: 2, 13: 2, 16: 3, 17: 4, 18: 3, 19: 2 } },
  { point: 'Plazoleta Lleras', hours: { 11: 2, 12: 5, 13: 6, 14: 3, 15: 1 } },
  { point: 'Student Center plaza', hours: { 12: 3, 13: 2, 18: 1 } },
  { point: 'Santo Domingo lobby', hours: { 8: 2, 10: 1, 19: 1 } },
];

const CATEGORIES = [MaterialCategory.BOOKS, MaterialCategory.CALCULATORS, MaterialCategory.LAB_EQUIPMENT, MaterialCategory.OTHER];
const DEMO_USERS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

function demoExchanges() {
  const rows: { n: number; point: string; completedAt: Date }[] = [];
  for (const { point, hours } of exchangesPerHour) {
    for (const [hour, count] of Object.entries(hours)) {
      for (let i = 0; i < count; i++) {
        const n = rows.length + 1;
        const day = DEMO_DAYS[n % DEMO_DAYS.length];
        const time = `${hour.padStart(2, '0')}:${String((n * 7) % 60).padStart(2, '0')}`;
        rows.push({ n, point, completedAt: new Date(`${day}T${time}:00-05:00`) });
      }
    }
  }
  return rows;
}

function isLocal(connectionString: string) {
  const host = new URL(connectionString).hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not defined');
  if (!isLocal(connectionString) && !process.argv.includes('--allow-remote')) {
    throw new Error('Refusing to write BQ12 demo data to a non-local database. Pass --allow-remote only if the team agreed.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const points = await prisma.meetingPoint.findMany({ select: { id: true, name: true, lat: true, lng: true } });
    const byName = new Map(points.map((point) => [point.name, point]));
    if (byName.size === 0) throw new Error('No meeting points found. Run prisma/seed-meeting-points.ts first.');

    const passwordHash = hashSync(randomUUID(), 10);
    for (let n = 1; n <= DEMO_USERS; n++) {
      const data = { email: `bq12.demo.${n}@campusswap.test`, fullName: `BQ12 Demo ${n}`, major: 'Demo', passwordHash };
      await prisma.user.upsert({ where: { id: userId(n) }, update: data, create: { id: userId(n), ...data } });
    }

    let created = 0;
    const missing = new Set<string>();
    for (const { n, point, completedAt } of demoExchanges()) {
      const meetingPoint = byName.get(point);
      if (!meetingPoint) {
        missing.add(point);
        continue;
      }
      const seller = (n % DEMO_USERS) + 1;
      const buyer = (seller % DEMO_USERS) + 1;
      const price = String(20000 + (n % 8) * 5000);

      const material = {
        title: `BQ12 demo item #${n}`,
        description: 'Demo exchange for BQ12',
        price,
        category: CATEGORIES[n % CATEGORIES.length],
        condition: MaterialCondition.GOOD,
        status: 'SOLD' as const,
        sellerId: userId(seller),
        createdAt: new Date(completedAt.getTime() - 3 * DAY_MS),
      };
      await prisma.material.upsert({ where: { id: materialId(n) }, update: material, create: { id: materialId(n), ...material } });

      const coordinates = n % 4 === 0 ? { lat: null, lng: null } : { lat: meetingPoint.lat, lng: meetingPoint.lng };
      const exchange = {
        materialId: materialId(n),
        buyerId: userId(buyer),
        sellerId: userId(seller),
        price,
        status: 'COMPLETED' as const,
        createdAt: new Date(completedAt.getTime() - 2 * DAY_MS),
        completedAt,
        meetingPointId: meetingPoint.id,
        ...coordinates,
      };
      await prisma.exchange.upsert({ where: { id: exchangeId(n) }, update: exchange, create: { id: exchangeId(n), ...exchange } });
      created++;
    }

    for (const point of missing) console.warn(`Skipped exchanges for "${point}": no meeting point with that name`);
    console.log(`BQ12 demo data ready: ${DEMO_USERS} users, ${created} completed exchanges`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

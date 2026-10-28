import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashSync } from 'bcryptjs';
import { MaterialCategory, MaterialCondition, PrismaClient } from '../src/generated/prisma/client';

const demoId = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const userId = (n: number) => demoId('b1000000', n);
const materialId = (n: number) => demoId('d2000000', n);
const exchangeId = (n: number) => demoId('e2000000', n);

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_USERS = 4;

const DEMO_ITEMS = [
  { title: 'TI-84 Plus CE Graphing Calculator', category: MaterialCategory.CALCULATORS, daysToSell: 1.5, price: '180000' },
  { title: 'Casio fx-991EX Scientific Calculator', category: MaterialCategory.CALCULATORS, daysToSell: 2.0, price: '85000' },
  { title: 'Stewart Calculus Early Transcendentals 8th Ed', category: MaterialCategory.BOOKS, daysToSell: 3.5, price: '120000' },
  { title: 'Campbell Biology 11th Edition', category: MaterialCategory.BOOKS, daysToSell: 4.0, price: '95000' },
  { title: 'Physics for Scientists and Engineers (Serway)', category: MaterialCategory.BOOKS, daysToSell: 5.5, price: '110000' },
  { title: 'Digital Multimeter with Probes', category: MaterialCategory.LAB_EQUIPMENT, daysToSell: 6.0, price: '75000' },
  { title: 'Organic Chemistry Model Kit (Molecular)', category: MaterialCategory.LAB_EQUIPMENT, daysToSell: 8.5, price: '60000' },
  { title: 'Laboratory Safety Goggles & Coat', category: MaterialCategory.LAB_EQUIPMENT, daysToSell: 12.0, price: '45000' },
  { title: 'Ergonomic Desk Study Lamp', category: MaterialCategory.OTHER, daysToSell: 18.0, price: '50000' },
  { title: 'Drafting Board Table with T-Square', category: MaterialCategory.OTHER, daysToSell: 35.0, price: '150000' },
];

function isLocal(connectionString: string) {
  const host = new URL(connectionString).hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not defined');
  if (!isLocal(connectionString) && !process.argv.includes('--allow-remote')) {
    throw new Error('Refusing to write BQ11 demo data to a non-local database. Pass --allow-remote only if the team agreed.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const passwordHash = hashSync(randomUUID(), 10);
    for (let n = 1; n <= DEMO_USERS; n++) {
      const data = { email: `bq11.demo.${n}@campusswap.test`, fullName: `BQ11 Demo ${n}`, major: 'Demo', passwordHash };
      await prisma.user.upsert({ where: { id: userId(n) }, update: data, create: { id: userId(n), ...data } });
    }

    const now = new Date();
    let created = 0;

    for (let i = 0; i < DEMO_ITEMS.length; i++) {
      const item = DEMO_ITEMS[i];
      const n = i + 1;
      const seller = (i % DEMO_USERS) + 1;
      const buyer = (seller % DEMO_USERS) + 1;

      const completedAt = new Date(now.getTime() - (i + 1) * DAY_MS);
      const listedAt = new Date(completedAt.getTime() - item.daysToSell * DAY_MS);

      const material = {
        title: item.title,
        description: `Academic material seeded for BQ11 demo. Took ~${item.daysToSell} days to sell.`,
        price: item.price,
        category: item.category,
        condition: MaterialCondition.GOOD,
        status: 'SOLD' as const,
        sellerId: userId(seller),
        createdAt: listedAt,
      };
      await prisma.material.upsert({ where: { id: materialId(n) }, update: material, create: { id: materialId(n), ...material } });

      const exchange = {
        materialId: materialId(n),
        buyerId: userId(buyer),
        sellerId: userId(seller),
        price: item.price,
        status: 'COMPLETED' as const,
        createdAt: new Date(completedAt.getTime() - 0.5 * DAY_MS),
        completedAt,
      };
      await prisma.exchange.upsert({ where: { id: exchangeId(n) }, update: exchange, create: { id: exchangeId(n), ...exchange } });
      created++;
    }

    console.log(`BQ11 demo data ready: ${DEMO_USERS} users, ${created} completed sales with varied time-to-sell`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

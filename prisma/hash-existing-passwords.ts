/**
 * One-off migration: users created before password hashing existed have a plain-text
 * string in "passwordHash". This hashes those values in place, so their password stays
 * the same (e.g. "12345678") but is now stored as a bcrypt hash. Safe to re-run: rows that
 * already hold a bcrypt hash are skipped.
 *
 * Run: npx tsx prisma/hash-existing-passwords.ts
 */
import 'dotenv/config';
import { hash } from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const BCRYPT_FORMAT = /^\$2[aby]\$\d{2}\$/;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not defined');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, passwordHash: true } });
    const plain = users.filter((user) => !BCRYPT_FORMAT.test(user.passwordHash));

    for (const user of plain) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hash(user.passwordHash, 10) },
      });
      console.log(`hashed ${user.email}`);
    }
    console.log(`Done: ${plain.length} hashed, ${users.length - plain.length} already hashed.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

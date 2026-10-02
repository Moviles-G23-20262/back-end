/**
 * Adds the campus safe zones the app suggests for meetups. Safe to run again: zones
 * that already exist (same name) are left alone. Coordinates are approximate; fix them
 * from the dashboard if a pin is off.
 *
 *   npx tsx prisma/seed-meeting-points.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type MeetingZoneType } from '../src/generated/prisma/client';

const zones: { name: string; detail: string; zoneType: MeetingZoneType; isMonitored: boolean; lat: number; lng: number }[] = [
  {
    name: 'Central Library lobby',
    detail: 'Main entrance, next to the security desk',
    zoneType: 'LIBRARY',
    isMonitored: true,
    lat: 4.60198,
    lng: -74.06532,
  },
  {
    name: 'Student Center plaza',
    detail: 'In front of the cafeteria, by the info point',
    zoneType: 'STUDENT_CENTER',
    isMonitored: true,
    lat: 4.60252,
    lng: -74.06588,
  },
  {
    name: 'Mario Laserna lobby',
    detail: 'Ground floor, next to the turnstiles',
    zoneType: 'BUILDING_LOBBY',
    isMonitored: true,
    lat: 4.60286,
    lng: -74.06485,
  },
  {
    name: 'Santo Domingo lobby',
    detail: 'Main hall, by the reception',
    zoneType: 'BUILDING_LOBBY',
    isMonitored: true,
    lat: 4.60446,
    lng: -74.06555,
  },
  {
    name: 'Plazoleta Lleras',
    detail: 'Open plaza by the Lleras building',
    zoneType: 'PLAZA',
    isMonitored: false,
    lat: 4.60165,
    lng: -74.06642,
  },
];

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    for (const zone of zones) {
      const existing = await prisma.meetingPoint.findFirst({ where: { name: zone.name }, select: { id: true } });
      if (existing) {
        console.log(`exists  ${zone.name}`);
        continue;
      }
      await prisma.meetingPoint.create({ data: zone });
      console.log(`added   ${zone.name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  MaterialCategory,
  MaterialCondition,
  MaterialStatus,
  MeetingZoneType,
  PrismaClient,
} from '../src/generated/prisma/client';

const userId = (n: number) => `a0000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const materialId = (n: number) => `b0000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const meetingPointId = (n: number) => `c0000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const historyMaterialId = (n: number) => `d0000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const historyExchangeId = (n: number) => `e0000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

const SEED_PASSWORD_HASH = 'seed-user-no-login';

const users = [
  { n: 0, email: 'daniel.seed@campusswap.test', fullName: 'Daniel Diab' },
  { n: 1, email: 'maria.seed@campusswap.test', fullName: 'Maria Gomez', rating: 4.8 },
  { n: 2, email: 'juan.seed@campusswap.test', fullName: 'Juan Restrepo', rating: 4.5 },
  { n: 3, email: 'luisa.seed@campusswap.test', fullName: 'Luisa Fernandez', rating: 4.9 },
  { n: 4, email: 'carlos.seed@campusswap.test', fullName: 'Carlos Pena', rating: 3.9 },
];

const { CALCULATORS, BOOKS, LAB_EQUIPMENT, OTHER } = MaterialCategory;
const { LIKE_NEW, GOOD, FAIR } = MaterialCondition;

const materials = [
  { n: 1, seller: 1, title: 'TI-Nspire CX CAS Graphing Calculator', price: '320000', category: CALCULATORS, condition: LIKE_NEW, courseCode: 'MATH-201' },
  { n: 2, seller: 2, title: 'Calculus: Early Transcendentals, 9th Ed.', price: '145000', category: BOOKS, condition: GOOD, courseCode: 'MATH-201', edition: '9th' },
  { n: 3, seller: 3, title: 'General Physics Lab Kit', price: '98000', category: LAB_EQUIPMENT, condition: GOOD, courseCode: 'PHYS-150' },
  { n: 4, seller: 4, title: 'Data Structures & Algorithms Notes (Full Semester)', price: '25000', category: OTHER, condition: LIKE_NEW, courseCode: 'CS-330' },
  { n: 5, seller: 1, title: 'Chemistry Safety Goggles + Lab Coat', price: '42000', category: LAB_EQUIPMENT, condition: FAIR, courseCode: 'CHEM-110' },
  { n: 6, seller: 2, title: 'Casio FX-991 Scientific Calculator', price: '65000', category: CALCULATORS, condition: GOOD, model: 'FX-991' },
  { n: 7, seller: 0, title: 'Technical Writing Style Guide', price: '38000', category: BOOKS, condition: LIKE_NEW, courseCode: 'ENG-201' },
  { n: 8, seller: 3, title: 'Scientific Notebook Bundle (x3)', price: '18000', category: OTHER, condition: LIKE_NEW },
  { n: 9, seller: 4, title: 'Probability & Statistics Solutions Manual', price: '52000', category: BOOKS, condition: GOOD, courseCode: 'STAT-220' },
  { n: 10, seller: 1, title: 'USB Microscope for Biology Lab', price: '210000', category: LAB_EQUIPMENT, condition: GOOD, courseCode: 'BIO-101' },
  { n: 11, seller: 2, title: 'Microeconomics Flashcard Deck', price: '15000', category: OTHER, condition: LIKE_NEW, courseCode: 'ECO-140' },
  { n: 12, seller: 3, title: 'Drafting Kit for Engineering Drawing', price: '60000', category: OTHER, condition: FAIR },
];

type Coordinates = { lat: number; lng: number } | null;

// TODO(carla): verificar en Google Maps que cada punto cae en la entrada correcta.
const CENTRAL_LIBRARY: Coordinates = { lat: 4.602948, lng: -74.064829 };
const STUDENT_CENTER: Coordinates = null; // TODO(carla): coordenadas — Centro Cívico is not mapped in OSM yet
const MARIO_LASERNA: Coordinates = { lat: 4.602725, lng: -74.064696 };
const PLAZOLETA_LLERAS: Coordinates = { lat: 4.601859, lng: -74.065176 };

type SeedMeetingPoint = {
  n: number;
  name: string;
  detail: string;
  zoneType: MeetingZoneType;
  isMonitored: boolean;
  coords: Coordinates;
};

const meetingPoints: SeedMeetingPoint[] = [
  { n: 1, name: 'Central Library lobby', detail: 'Main entrance, next to the security desk', zoneType: MeetingZoneType.LIBRARY, isMonitored: true, coords: CENTRAL_LIBRARY },
  { n: 2, name: 'Student Center plaza', detail: 'Open plaza by the food court', zoneType: MeetingZoneType.STUDENT_CENTER, isMonitored: true, coords: STUDENT_CENTER },
  { n: 3, name: 'Mario Laserna lobby', detail: 'Ground floor, engineering building', zoneType: MeetingZoneType.BUILDING_LOBBY, isMonitored: true, coords: MARIO_LASERNA },
  { n: 4, name: 'Plazoleta Lleras', detail: 'Open area in front of Lleras building', zoneType: MeetingZoneType.PLAZA, isMonitored: false, coords: PLAZOLETA_LLERAS },
];

const HISTORY_DAYS = [
  '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11',
  '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18',
];

const exchangesPerHour: { point: number; hours: Record<number, number> }[] = [
  { point: 1, hours: { 8: 1, 9: 2, 10: 4, 11: 3, 14: 3, 15: 4, 16: 2, 17: 1 } },
  { point: 3, hours: { 7: 1, 9: 1, 12: 2, 13: 2, 16: 3, 17: 4, 18: 3, 19: 2 } },
  { point: 4, hours: { 11: 2, 12: 5, 13: 6, 14: 3, 15: 1 } },
];

const HISTORY_CATEGORIES = [BOOKS, CALCULATORS, LAB_EQUIPMENT, OTHER];
const DAY_MS = 24 * 60 * 60 * 1000;

function historicalExchanges() {
  const rows: { n: number; point: number; completedAt: Date }[] = [];
  for (const { point, hours } of exchangesPerHour) {
    for (const [hour, count] of Object.entries(hours)) {
      for (let i = 0; i < count; i++) {
        const n = rows.length + 1;
        const day = HISTORY_DAYS[n % HISTORY_DAYS.length];
        const time = `${hour.padStart(2, '0')}:${String((n * 7) % 60).padStart(2, '0')}`;
        rows.push({ n, point, completedAt: new Date(`${day}T${time}:00-05:00`) });
      }
    }
  }
  return rows;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not defined');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    for (const { n, email, fullName, rating } of users) {
      const data = { email, fullName, rating: rating ?? 0, major: 'Undeclared', passwordHash: SEED_PASSWORD_HASH };
      await prisma.user.upsert({ where: { id: userId(n) }, update: data, create: { id: userId(n), ...data } });
    }

    for (const { n, seller, ...fields } of materials) {
      const data = { ...fields, description: fields.title, sellerId: userId(seller) };
      await prisma.material.upsert({ where: { id: materialId(n) }, update: data, create: { id: materialId(n), ...data } });
    }

    const seededPoints = new Map<number, { lat: number; lng: number }>();
    for (const { n, coords, ...fields } of meetingPoints) {
      if (!coords) {
        console.warn(`Skipping meeting point "${fields.name}": coordinates not set yet`);
        continue;
      }
      const data = { ...fields, ...coords };
      await prisma.meetingPoint.upsert({ where: { id: meetingPointId(n) }, update: data, create: { id: meetingPointId(n), ...data } });
      seededPoints.set(n, coords);
    }

    const history = historicalExchanges().filter(({ point }) => seededPoints.has(point));
    for (const { n, point, completedAt } of history) {
      const seller = (n % 4) + 1;
      const buyer = (seller % 4) + 1;
      const price = String(20000 + (n % 8) * 5000);
      const material = {
        title: `Campus exchange #${n}`,
        description: 'Historical exchange for BQ12',
        price,
        category: HISTORY_CATEGORIES[n % HISTORY_CATEGORIES.length],
        condition: GOOD,
        status: MaterialStatus.SOLD,
        sellerId: userId(seller),
        createdAt: new Date(completedAt.getTime() - 3 * DAY_MS),
      };
      await prisma.material.upsert({ where: { id: historyMaterialId(n) }, update: material, create: { id: historyMaterialId(n), ...material } });

      const coords = n % 4 === 0 ? { lat: null, lng: null } : seededPoints.get(point)!;
      const exchange = {
        materialId: historyMaterialId(n),
        buyerId: userId(buyer),
        sellerId: userId(seller),
        price,
        meetingPointId: meetingPointId(point),
        ...coords,
        completedAt,
      };
      await prisma.exchange.upsert({ where: { id: historyExchangeId(n) }, update: exchange, create: { id: historyExchangeId(n), ...exchange } });
    }

    console.log(`Seeded ${users.length} users, ${materials.length} materials and ${history.length} historical exchanges`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

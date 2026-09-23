import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  MaterialCategory,
  MaterialCondition,
  MeetingZoneType,
  PrismaClient,
} from '../src/generated/prisma/client';

// Fixed UUIDs mirror com.campusswap.app.data.SeedIds in the Android app, which still renders
// SampleData. Keep both files in sync until the catalog is served by this backend.
const userId = (n: number) => `a0000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const materialId = (n: number) => `b0000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const meetingPointId = (n: number) => `c0000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

// Auth is owned by another teammate; seeded users cannot log in with this value.
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

// n = SampleData product number (p1..p12), seller = SampleData seller number (0 = "me").
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

// Taken from OpenStreetMap (Sep 2026); must match SampleData in the Android app. Points left null are skipped.
// TODO(carla): verificar en Google Maps que cada punto cae en la entrada correcta.
const CENTRAL_LIBRARY: Coordinates = { lat: 4.602948, lng: -74.064829 }; // OSM library node "Ramon de Zubiria"
const STUDENT_CENTER: Coordinates = null; // TODO(carla): coordenadas — Centro Cívico is not mapped in OSM yet
const MARIO_LASERNA: Coordinates = { lat: 4.602725, lng: -74.064696 }; // OSM address point, Cra 1 Este #19A-40
const PLAZOLETA_LLERAS: Coordinates = { lat: 4.601859, lng: -74.065176 }; // OSM square "Plazoleta Lleras", centroid

type SeedMeetingPoint = {
  n: number;
  name: string;
  detail: string;
  zoneType: MeetingZoneType;
  isMonitored: boolean;
  coords: Coordinates;
};

// n = SampleData meeting point number (mp1..mp4).
const meetingPoints: SeedMeetingPoint[] = [
  { n: 1, name: 'Central Library lobby', detail: 'Main entrance, next to the security desk', zoneType: MeetingZoneType.LIBRARY, isMonitored: true, coords: CENTRAL_LIBRARY },
  { n: 2, name: 'Student Center plaza', detail: 'Open plaza by the food court', zoneType: MeetingZoneType.STUDENT_CENTER, isMonitored: true, coords: STUDENT_CENTER },
  { n: 3, name: 'Mario Laserna lobby', detail: 'Ground floor, engineering building', zoneType: MeetingZoneType.BUILDING_LOBBY, isMonitored: true, coords: MARIO_LASERNA },
  { n: 4, name: 'Plazoleta Lleras', detail: 'Open area in front of Lleras building', zoneType: MeetingZoneType.PLAZA, isMonitored: false, coords: PLAZOLETA_LLERAS },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not defined');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    // Upserts keep the seed idempotent: running it twice never duplicates rows.
    for (const { n, email, fullName, rating } of users) {
      const data = { email, fullName, rating: rating ?? 0, major: 'Undeclared', passwordHash: SEED_PASSWORD_HASH };
      await prisma.user.upsert({ where: { id: userId(n) }, update: data, create: { id: userId(n), ...data } });
    }

    for (const { n, seller, ...fields } of materials) {
      const data = { ...fields, description: fields.title, sellerId: userId(seller) };
      await prisma.material.upsert({ where: { id: materialId(n) }, update: data, create: { id: materialId(n), ...data } });
    }

    for (const { n, coords, ...fields } of meetingPoints) {
      if (!coords) {
        console.warn(`Skipping meeting point "${fields.name}": coordinates not set yet`);
        continue;
      }
      const data = { ...fields, ...coords };
      await prisma.meetingPoint.upsert({ where: { id: meetingPointId(n) }, update: data, create: { id: meetingPointId(n), ...data } });
    }

    console.log(`Seeded ${users.length} users and ${materials.length} materials`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

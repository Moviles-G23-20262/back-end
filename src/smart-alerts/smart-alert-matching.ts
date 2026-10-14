import type { MaterialCategory, MaterialCondition } from '../generated/prisma/client';

/** Best to worst; an alert's `minCondition` is the worst one it accepts. */
const CONDITION_RANK: Record<MaterialCondition, number> = { NEW: 0, LIKE_NEW: 1, GOOD: 2, FAIR: 3 };

export interface MatchableAlert {
  keyword: string;
  courseCode: string | null;
  category: MaterialCategory | null;
  maxPrice: { toString(): string };
  minCondition: MaterialCondition | null;
}

export interface MatchableMaterial {
  title: string;
  courseCode: string | null;
  category: MaterialCategory;
  price: { toString(): string };
  condition: MaterialCondition | null;
}

const normalize = (text: string | null | undefined) => (text ?? '').trim().toLowerCase();

/** Same rules the app used when it matched alerts on the phone. */
export function alertMatches(alert: MatchableAlert, material: MatchableMaterial): boolean {
  if (Number(material.price.toString()) > Number(alert.maxPrice.toString())) return false;
  if (alert.category && alert.category !== material.category) return false;
  if (alert.courseCode && normalize(alert.courseCode) !== normalize(material.courseCode)) return false;
  if (alert.minCondition) {
    if (!material.condition) return false;
    if (CONDITION_RANK[material.condition] > CONDITION_RANK[alert.minCondition]) return false;
  }
  const keyword = normalize(alert.keyword);
  if (!keyword) return true;
  return normalize(material.title).includes(keyword) || normalize(material.courseCode).includes(keyword);
}

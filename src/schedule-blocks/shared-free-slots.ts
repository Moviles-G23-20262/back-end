import {
  CAMPUS_CLOSES_AT,
  CAMPUS_DAYS,
  CAMPUS_OPENS_AT,
  addCampusDays,
  atMinute,
  campusDayOf,
} from './campus-time';

/** One recurring class: same shape as the `ScheduleBlock` row. */
export interface WeeklyBlock {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface FreeSlot {
  startsAt: Date;
  endsAt: Date;
  /** Both people have a class before and after it that day, so both are on campus anyway. */
  sharedBreak: boolean;
}

export interface SlotOptions {
  /** How many days ahead to look, starting with the day of `from`. */
  days?: number;
  slotMinutes?: number;
  /** Candidate start times are this many minutes apart. */
  stepMinutes?: number;
  perDay?: number;
  limit?: number;
}

/** How convenient a slot is: higher is better. */
enum Fit {
  /** Nobody has class that day; they would come to campus just for this. */
  NoClasses = 0,
  OneOnCampus = 1,
  BothOnCampus = 2,
  SharedBreak = 3,
}

interface Candidate extends FreeSlot {
  fit: Fit;
  /** Minutes from midday, to prefer reasonable hours when nothing else tells slots apart. */
  offMidday: number;
}

/** Someone with class that day is "on campus" from an hour before their first class to an hour after the last. */
const ON_CAMPUS_MARGIN = 60;
const MIDDAY = 12 * 60;

/**
 * Hour-long windows in the coming days when neither person has class, while campus is open.
 * Shared breaks between classes come first, then hours when both are on campus anyway;
 * each day contributes a few non-overlapping slots. The result is chronological.
 */
export function findSharedFreeSlots(
  a: WeeklyBlock[],
  b: WeeklyBlock[],
  from: Date,
  { days = 7, slotMinutes = 60, stepMinutes = 30, perDay = 2, limit = 6 }: SlotOptions = {},
): FreeSlot[] {
  const today = campusDayOf(from);
  const picked: Candidate[] = [];

  for (let offset = 0; offset < days; offset++) {
    const day = addCampusDays(today, offset);
    if (!CAMPUS_DAYS.includes(day.dayOfWeek)) continue;
    const classesA = a.filter((block) => block.dayOfWeek === day.dayOfWeek);
    const classesB = b.filter((block) => block.dayOfWeek === day.dayOfWeek);

    const candidates: Candidate[] = [];
    for (let start = CAMPUS_OPENS_AT; start + slotMinutes <= CAMPUS_CLOSES_AT; start += stepMinutes) {
      const end = start + slotMinutes;
      const startsAt = atMinute(day, start);
      if (startsAt <= from) continue;
      if (!isFree(classesA, start, end) || !isFree(classesB, start, end)) continue;

      const sharedBreak = isBetweenClasses(classesA, start, end) && isBetweenClasses(classesB, start, end);
      const onCampus = [classesA, classesB].filter((classes) => isOnCampus(classes, start, end)).length;
      candidates.push({
        startsAt,
        endsAt: atMinute(day, end),
        sharedBreak,
        fit: sharedBreak ? Fit.SharedBreak : (onCampus as Fit),
        offMidday: Math.abs(start - MIDDAY),
      });
    }

    const dayPicks: Candidate[] = [];
    for (const slot of candidates.sort(byPreference)) {
      if (dayPicks.length === perDay) break;
      if (dayPicks.some((other) => overlaps(slot, other))) continue;
      dayPicks.push(slot);
    }
    picked.push(...dayPicks);
  }

  return picked
    .sort(byPreference)
    .slice(0, limit)
    .sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime())
    .map(({ startsAt, endsAt, sharedBreak }) => ({ startsAt, endsAt, sharedBreak }));
}

/** The slot to put forward: the first shared break, else the earliest slot. */
export function suggestedSlot(slots: FreeSlot[]): FreeSlot | undefined {
  return slots.find((slot) => slot.sharedBreak) ?? slots[0];
}

/** Best fit first, then closer to midday, then sooner. */
function byPreference(x: Candidate, y: Candidate): number {
  return y.fit - x.fit || x.offMidday - y.offMidday || x.startsAt.getTime() - y.startsAt.getTime();
}

function overlaps(x: FreeSlot, y: FreeSlot): boolean {
  return x.startsAt < y.endsAt && y.startsAt < x.endsAt;
}

function isFree(classes: WeeklyBlock[], start: number, end: number): boolean {
  return classes.every((block) => block.endMinute <= start || block.startMinute >= end);
}

function isBetweenClasses(classes: WeeklyBlock[], start: number, end: number): boolean {
  return classes.some((block) => block.endMinute <= start) && classes.some((block) => block.startMinute >= end);
}

function isOnCampus(classes: WeeklyBlock[], start: number, end: number): boolean {
  if (classes.length === 0) return false;
  const arrives = Math.min(...classes.map((block) => block.startMinute)) - ON_CAMPUS_MARGIN;
  const leaves = Math.max(...classes.map((block) => block.endMinute)) + ON_CAMPUS_MARGIN;
  return start >= arrives && end <= leaves;
}

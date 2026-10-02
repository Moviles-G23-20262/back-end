/**
 * Campus clock. Schedules are stored as wall-clock minutes in Bogotá time, which has
 * no daylight saving, so a fixed offset is exact and avoids depending on the server's zone.
 */
export const CAMPUS_UTC_OFFSET_MINUTES = -5 * 60;

/** Hours the campus is open for meetups, as minutes after midnight. */
export const CAMPUS_OPENS_AT = 7 * 60;
export const CAMPUS_CLOSES_AT = 20 * 60;

/** Monday (1) … Saturday (6). */
export const CAMPUS_DAYS = [1, 2, 3, 4, 5, 6];

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A calendar day on campus. */
export interface CampusDay {
  /** UTC instant of local midnight. */
  midnight: Date;
  /** 1 = Monday … 7 = Sunday. */
  dayOfWeek: number;
}

/** The campus day `instant` falls on. */
export function campusDayOf(instant: Date): CampusDay {
  const shifted = new Date(instant.getTime() + CAMPUS_UTC_OFFSET_MINUTES * MINUTE_MS);
  const localMidnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return {
    midnight: new Date(localMidnight - CAMPUS_UTC_OFFSET_MINUTES * MINUTE_MS),
    dayOfWeek: ((shifted.getUTCDay() + 6) % 7) + 1,
  };
}

/** The day `days` after `day`. */
export function addCampusDays(day: CampusDay, days: number): CampusDay {
  return campusDayOf(new Date(day.midnight.getTime() + days * DAY_MS));
}

export function atMinute(day: CampusDay, minute: number): Date {
  return new Date(day.midnight.getTime() + minute * MINUTE_MS);
}

/** Minutes after local midnight. */
export function campusMinuteOf(instant: Date): number {
  return Math.round((instant.getTime() - campusDayOf(instant).midnight.getTime()) / MINUTE_MS);
}

/** "09:00" */
export function formatCampusTime(instant: Date): string {
  const minute = campusMinuteOf(instant);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

/** "Thu 17 Sep" */
export function formatCampusDate(instant: Date): string {
  const shifted = new Date(instant.getTime() + CAMPUS_UTC_OFFSET_MINUTES * MINUTE_MS);
  const { dayOfWeek } = campusDayOf(instant);
  return `${WEEKDAYS[dayOfWeek - 1]} ${shifted.getUTCDate()} ${MONTHS[shifted.getUTCMonth()]}`;
}

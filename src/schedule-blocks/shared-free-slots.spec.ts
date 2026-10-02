import { findSharedFreeSlots, suggestedSlot, type WeeklyBlock } from './shared-free-slots';
import { formatCampusDate, formatCampusTime } from './campus-time';

const h = (hours: number) => hours * 60;
// Monday 14 Sep 2026, 06:00 in Bogotá (11:00 UTC).
const mondayMorning = new Date('2026-09-14T11:00:00Z');
const label = (slot: { startsAt: Date; endsAt: Date }) =>
  `${formatCampusDate(slot.startsAt)} ${formatCampusTime(slot.startsAt)}-${formatCampusTime(slot.endsAt)}`;

describe('findSharedFreeSlots', () => {
  it('only offers hours when neither person has class', () => {
    const a: WeeklyBlock[] = [{ dayOfWeek: 1, startMinute: h(7), endMinute: h(10) }];
    const b: WeeklyBlock[] = [{ dayOfWeek: 1, startMinute: h(10), endMinute: h(12) }];

    const monday = findSharedFreeSlots(a, b, mondayMorning, { days: 1, perDay: 10, limit: 10 });

    expect(monday.map(label)).toEqual([
      'Mon 14 Sep 12:00-13:00',
      'Mon 14 Sep 13:00-14:00',
      'Mon 14 Sep 14:00-15:00',
      'Mon 14 Sep 15:00-16:00',
      'Mon 14 Sep 16:00-17:00',
      'Mon 14 Sep 17:00-18:00',
      'Mon 14 Sep 18:00-19:00',
      'Mon 14 Sep 19:00-20:00',
    ]);
  });

  it('marks a gap between classes for both people as a shared break and prefers it', () => {
    const a: WeeklyBlock[] = [
      { dayOfWeek: 3, startMinute: h(8), endMinute: h(10) },
      { dayOfWeek: 3, startMinute: h(11), endMinute: h(13) },
    ];
    const b: WeeklyBlock[] = [
      { dayOfWeek: 3, startMinute: h(7), endMinute: h(9.5) },
      { dayOfWeek: 3, startMinute: h(11), endMinute: h(12) },
    ];

    const slots = findSharedFreeSlots(a, b, mondayMorning);
    const wednesday = slots.filter((slot) => formatCampusDate(slot.startsAt) === 'Wed 16 Sep');

    expect(wednesday.map(label)).toContain('Wed 16 Sep 10:00-11:00');
    expect(wednesday.find((slot) => label(slot) === 'Wed 16 Sep 10:00-11:00')?.sharedBreak).toBe(true);
    expect(label(suggestedSlot(slots)!)).toBe('Wed 16 Sep 10:00-11:00');
  });

  it('skips Sundays and times that already passed', () => {
    // Saturday 19 Sep, 19:30 in Bogotá.
    const lateSaturday = new Date('2026-09-20T00:30:00Z');

    const slots = findSharedFreeSlots([], [], lateSaturday, { days: 2 });

    expect(slots).toEqual([]);
  });

  it('without schedules it offers hours around midday, at most `limit`, in order', () => {
    const slots = findSharedFreeSlots([], [], mondayMorning, { perDay: 2, limit: 4 });

    expect(slots.map(label)).toEqual([
      'Mon 14 Sep 12:00-13:00',
      'Tue 15 Sep 12:00-13:00',
      'Wed 16 Sep 12:00-13:00',
      'Thu 17 Sep 12:00-13:00',
    ]);
  });

  it('a shared break later in the week wins over free days that come first', () => {
    // Only Thursday has classes for both, with a gap at 10:00.
    const a: WeeklyBlock[] = [
      { dayOfWeek: 4, startMinute: h(8), endMinute: h(10) },
      { dayOfWeek: 4, startMinute: h(11), endMinute: h(13) },
    ];
    const b: WeeklyBlock[] = [
      { dayOfWeek: 4, startMinute: h(7), endMinute: h(9.5) },
      { dayOfWeek: 4, startMinute: h(11), endMinute: h(12) },
    ];

    const slots = findSharedFreeSlots(a, b, mondayMorning, { limit: 3 });

    expect(slots.map(label)).toContain('Thu 17 Sep 10:00-11:00');
    expect(label(suggestedSlot(slots)!)).toBe('Thu 17 Sep 10:00-11:00');
  });

  it('prefers hours next to classes over days nobody is on campus', () => {
    // Both have class Tuesday morning, nobody on Monday.
    const a: WeeklyBlock[] = [{ dayOfWeek: 2, startMinute: h(7), endMinute: h(9) }];
    const b: WeeklyBlock[] = [{ dayOfWeek: 2, startMinute: h(8), endMinute: h(10) }];

    const [first] = findSharedFreeSlots(a, b, mondayMorning, { limit: 1 });

    expect(label(first)).toBe('Tue 15 Sep 10:00-11:00');
  });
});

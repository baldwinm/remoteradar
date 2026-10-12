import type { OpeningPeriod } from '../api/types';

const DAY = 24 * 60;
const WEEK = 7 * DAY;

export const WORKDAY_START = 9 * 60;
export const WORKDAY_END = 17 * 60;

/** The viewer's own time zone, e.g. "America/New_York". */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return Boolean(timeZone);
  } catch {
    return false;
  }
}

/** Minutes ahead of UTC in `timeZone` at `when` (daylight saving included). */
export function utcOffsetMinutes(timeZone: string, when = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(when);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  const whole = Math.floor(when.getTime() / 60000) * 60000;
  return Math.round((asUtc - whole) / 60000);
}

/** 60 -> "UTC+1", -270 -> "UTC−4:30". */
export function formatUtcOffset(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`;
}

/** Wall-clock time in `timeZone`, e.g. "3:42 PM". */
export function clockIn(timeZone: string, when = new Date()): string {
  return when.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
}

/** Minutes from midnight -> "9 AM", "1:30 PM", "noon". */
export function minuteLabel(minutes: number): string {
  const m = ((Math.round(minutes) % DAY) + DAY) % DAY;
  if (m === 12 * 60) return 'noon';
  if (m === 0) return 'midnight';
  const hour = Math.floor(m / 60);
  const minute = m % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** "2026-10-12T07:31" (already local) -> "7:31 AM". */
export function isoClock(isoDateTime: string | null): string {
  if (!isoDateTime) return '–';
  const hour = Number(isoDateTime.slice(11, 13));
  const minute = Number(isoDateTime.slice(14, 16));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '–';
  return minuteLabel(hour * 60 + minute).replace('noon', '12 PM').replace('midnight', '12 AM');
}

/** 41460 -> "11 h 31 m". */
export function formatDaylight(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '–';
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)} h ${minutes % 60} m`;
}

export interface Overlap {
  /** Shared working minutes on a weekday. */
  minutes: number;
  /** Where the overlap falls in the city's local day, in minutes from midnight. */
  cityStart: number;
  cityEnd: number;
  /** The same overlap in the viewer's own time. */
  homeStart: number;
  homeEnd: number;
  /** The viewer's 9 to 5, in the city's local day: one or two [start, end) spans. */
  homeSpans: [number, number][];
  /** City minutes ahead of the viewer. */
  difference: number;
}

/** How much of a 9-to-5 in `homeZone` overlaps with a 9-to-5 in `cityZone`. */
export function workOverlap(homeZone: string, cityZone: string, when = new Date()): Overlap {
  const difference = utcOffsetMinutes(cityZone, when) - utcOffsetMinutes(homeZone, when);
  const start = (((WORKDAY_START + difference) % DAY) + DAY) % DAY;
  const end = start + (WORKDAY_END - WORKDAY_START);
  const homeSpans: [number, number][] = end <= DAY ? [[start, end]] : [[start, DAY], [0, end - DAY]];

  let best: [number, number] | null = null;
  for (const [s, e] of homeSpans) {
    const from = Math.max(s, WORKDAY_START);
    const to = Math.min(e, WORKDAY_END);
    if (to > from && (!best || to - from > best[1] - best[0])) best = [from, to];
  }
  const [cityStart, cityEnd] = best ?? [0, 0];
  return {
    minutes: cityEnd - cityStart,
    cityStart,
    cityEnd,
    homeStart: cityStart - difference,
    homeEnd: cityEnd - difference,
    homeSpans,
    difference,
  };
}

/** Day of week (0 = Sunday) and minutes from midnight, in `timeZone`. */
function localWeekMinute(timeZone: string, when: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(when);
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return Math.max(day, 0) * DAY + hour * 60 + minute;
}

export interface OpenState {
  open: boolean;
  /** "Open 24 hours", "Open until 7 PM", "Opens 8 AM", "Opens Mon 9 AM". */
  label: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Whether a place is open right now, from its weekly hours and the city's time zone. */
export function openState(periods: OpeningPeriod[] | null, timeZone: string, when = new Date()): OpenState | null {
  if (!periods || periods.length === 0 || !isValidTimeZone(timeZone)) return null;
  if (periods.some((period) => period.close_day === null || period.close_minute === null)) {
    return { open: true, label: 'Open 24 hours' };
  }
  const now = localWeekMinute(timeZone, when);
  const spans = periods.map((period) => {
    const start = period.open_day * DAY + period.open_minute;
    let end = (period.close_day ?? 0) * DAY + (period.close_minute ?? 0);
    if (end <= start) end += WEEK;
    return [start, end] as const;
  });

  for (const [start, end] of spans) {
    for (const t of [now, now + WEEK]) {
      if (start <= t && t < end) return { open: true, label: `Open until ${minuteLabel(end % DAY)}` };
    }
  }

  // Closed: find the next opening.
  const waits = spans.map(([start]) => (((start - now) % WEEK) + WEEK) % WEEK);
  const next = spans[waits.indexOf(Math.min(...waits))]?.[0] ?? 0;
  const sameDay = Math.floor(next / DAY) === Math.floor(now / DAY) && next > now;
  const time = minuteLabel(next % DAY).replace('noon', '12 PM').replace('midnight', '12 AM');
  return { open: false, label: sameDay ? `Opens ${time}` : `Opens ${WEEKDAYS[Math.floor(next / DAY) % 7]} ${time}` };
}

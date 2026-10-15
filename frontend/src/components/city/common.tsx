import type { City, ClimateMonth, Currency, PlaceType, Units } from '../../api/types';
import { jumpTo } from '../../lib/chrome';
import { isPhoneNow } from '../../lib/layout';
import { zoneDate } from '../../lib/time';
import type { IconName } from '../Icon';

/* Pieces shared by the city page's sections. */

export const TABS = [
  { id: 'score', label: 'Score' },
  { id: 'work', label: 'Work' },
  { id: 'weather', label: 'Weather' },
  { id: 'climate', label: 'Best time' },
  { id: 'stays', label: 'Stays' },
  { id: 'places', label: 'Places' },
] as const;

export type SectionId = (typeof TABS)[number]['id'];

export const isSectionId = (value: string): value is SectionId => TABS.some((tab) => tab.id === value);

/** Scrolls to a section, leaving room for the section bar (desktop) or the tabs (phones). */
export function goToSection(id: string, smooth = true) {
  jumpTo(id, isPhoneNow() ? -20 : 0, smooth);
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ---------- Places ---------- */

export interface PlaceKind {
  key: PlaceType | 'all';
  label: string;
  /** One of them: "Coffee", "Restaurant". */
  one: string;
  icon: IconName;
  /** Gyms, parks and laundry load only when someone picks them. */
  extra: boolean;
}

export const PLACE_KINDS: readonly PlaceKind[] = [
  { key: 'all', label: 'All', one: 'Place', icon: 'pin', extra: false },
  { key: 'coffee', label: 'Coffee', one: 'Coffee', icon: 'coffee', extra: false },
  { key: 'coworking', label: 'Coworking', one: 'Coworking', icon: 'desk', extra: false },
  { key: 'restaurant', label: 'Restaurants', one: 'Restaurant', icon: 'food', extra: false },
  { key: 'gym', label: 'Gyms', one: 'Gym', icon: 'gym', extra: true },
  { key: 'park', label: 'Parks', one: 'Park', icon: 'park', extra: true },
  { key: 'laundry', label: 'Laundry', one: 'Laundry', icon: 'laundry', extra: true },
];

export function placeKind(key: PlaceType | 'all'): PlaceKind {
  return PLACE_KINDS.find((kind) => kind.key === key) ?? PLACE_KINDS[0]!;
}

/** Price level as the local currency's sign ("€€"), or "$$" where the sign is longer than one letter. */
export function priceMarks(level: number, symbol: string | undefined): string {
  if (level <= 0) return 'Free';
  const sign = symbol && [...symbol].length === 1 ? symbol : '$';
  return sign.repeat(Math.min(4, level));
}

/** Straight-line distance in km. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "Rua da Prata 115, 1100-415 Lisboa, Portugal" -> "Rua da Prata 115". */
export function shortAddress(address: string): string {
  return address.split(',')[0]?.trim() ?? address;
}

/* ---------- Money ---------- */

export const usd = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

/** A dollar amount in the city's own money, "€122", when it isn't dollars and a rate is known. */
export function inLocal(amount: number | null | undefined, currency: Currency | null | undefined): string | null {
  if (amount === null || amount === undefined || !currency?.usd_rate || currency.code === 'USD') return null;
  const value = amount * currency.usd_rate;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.code,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency.symbol}${Math.round(value).toLocaleString('en-US')}`;
  }
}

/** "Euro (€)" */
export function currencyLabel(city: City): string {
  const name = city.currency_name || city.currency_code;
  if (!name) return '';
  const symbol = city.currency_symbol && city.currency_symbol !== city.currency_code ? ` (${city.currency_symbol})` : '';
  return `${name}${symbol}`;
}

/* ---------- Stays ---------- */

export const NIGHTS: readonly [number, string][] = [
  [1, '1 night'],
  [2, '2 nights'],
  [3, '3 nights'],
  [5, '5 nights'],
  [7, '1 week'],
  [14, '2 weeks'],
  [21, '3 weeks'],
  [30, '1 month'],
];

export const nightsLabel = (nights: number) =>
  NIGHTS.find(([value]) => value === nights)?.[1] ?? `${nights} ${nights === 1 ? 'night' : 'nights'}`;

export const guestsLabel = (guests: number) => `${guests} ${guests === 1 ? 'guest' : 'guests'}`;

export type SortOrder = 'price_asc' | 'price_desc' | 'rating_desc';

export const SORTS: readonly [SortOrder, string][] = [
  ['price_asc', 'Lowest price'],
  ['price_desc', 'Highest price'],
  ['rating_desc', 'Highest rated'],
];

/** A calendar day, "2026-10-21". */
export type IsoDay = string;

export function isoDay(year: number, month: number, day: number): IsoDay {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10);
}

export function addDays(day: IsoDay, days: number): IsoDay {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);
  return isoDay(year, month, date + days);
}

/** Today in the city. */
export function cityToday(timeZone: string, when: Date): IsoDay {
  const date = zoneDate(timeZone, when);
  return isoDay(date.year, date.month, date.day);
}

/** "2026-10-21" -> "Wed, Oct 21" or "Oct 21". */
export function dayLabel(day: IsoDay, withWeekday = true): string {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return `${withWeekday ? `${DAYS[weekday]}, ` : ''}${MONTHS[month - 1]} ${date}`;
}

/* ---------- Weather ---------- */

export function windLabel(speed: number | null | undefined, units: Units): string {
  if (speed === null || speed === undefined) return '–';
  return units === 'imperial' ? `${Math.round(speed)} mph` : `${Math.round(speed)} km/h`;
}

export function rainLabel(amount: number | null | undefined, units: Units): string {
  if (amount === null || amount === undefined) return '–';
  return units === 'imperial' ? `${amount.toFixed(amount >= 1 ? 1 : 2).replace(/\.?0+$/, '') || '0'} in` : `${Math.round(amount * 10) / 10} mm`;
}

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "a, b and c" */
export function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Best months grouped into runs, wrapping from December to January: [[5, 6], [9, 10]]. */
export function bestRuns(months: ClimateMonth[]): [number, number][] {
  const best = months.filter((month) => month.best).map((month) => month.month);
  if (best.length === 0) return [];
  if (best.length === 12) return [[1, 12]];
  const set = new Set(best);
  // Start each run at a best month whose previous month isn't best.
  const starts = best.filter((month) => !set.has(month === 1 ? 12 : month - 1));
  return starts.map((start) => {
    let end = start;
    while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
    return [start, end];
  });
}

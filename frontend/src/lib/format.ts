/** "2026-10-12" -> "Monday", read as a calendar date (not midnight UTC, which shifts the day west of UTC). */
export function weekdayName(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long' });
}

/** "2026-10-12T14:00" (already in the city's local time) -> "2 PM". */
export function hourLabel(isoDateTime: string): string {
  const hour = Number(isoDateTime.slice(11, 13));
  if (Number.isNaN(hour)) return isoDateTime;
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function round(value: number | null | undefined): string {
  return value === null || value === undefined ? '–' : String(Math.round(value));
}

export function formatMoney(amount: number | null | undefined, currency = 'USD'): string {
  if (amount === null || amount === undefined) return '–';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export const PRICE_LEVEL_LABELS = ['Free', '$', '$$', '$$$', '$$$$'] as const;

/** Headline prices: "€118" rather than "€118.40". */
export function formatWholeMoney(amount: number | null | undefined, currency = 'USD'): string {
  if (amount === null || amount === undefined) return '–';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${Math.round(amount)}`;
  }
}

/** 38.7223, -9.1393 -> "38.72° N, 9.14° W". */
export function formatCoords(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lng).toFixed(2)}° ${ew}`;
}

/** "2026-10-12" -> "Mon". */
export function shortWeekday(isoDate: string): string {
  return weekdayName(isoDate).slice(0, 3);
}

/** "2026-11-01" -> "Sun, Nov 1", read as a calendar date. */
export function shortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

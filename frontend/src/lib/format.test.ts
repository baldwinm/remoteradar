import { describe, expect, it } from 'vitest';

import { formatMoney, hourLabel, weekdayName } from './format';

describe('format helpers', () => {
  it('names the weekday of a calendar date regardless of time zone', () => {
    // 12 October 2026 is a Monday everywhere; parsing it as UTC midnight would
    // show "Sunday" for anyone west of Greenwich.
    expect(weekdayName('2026-10-12')).toBe('Monday');
  });

  it('labels hours in 12-hour time', () => {
    expect(hourLabel('2026-10-12T00:00')).toBe('12 AM');
    expect(hourLabel('2026-10-12T12:00')).toBe('12 PM');
    expect(hourLabel('2026-10-12T15:00')).toBe('3 PM');
  });

  it('formats money and handles missing values', () => {
    expect(formatMoney(125.5)).toBe('$125.50');
    expect(formatMoney(null)).toBe('–');
  });
});

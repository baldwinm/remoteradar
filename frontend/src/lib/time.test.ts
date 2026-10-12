import { describe, expect, it } from 'vitest';

import { formatDaylight, formatUtcOffset, isoClock, minuteLabel, openState, utcOffsetMinutes, workOverlap } from './time';

// Mid-October 2026: Lisbon is on summer time (UTC+1), New York on EDT (UTC−4).
const OCT_12 = new Date('2026-10-12T14:42:00Z');

describe('time zones', () => {
  it('reads UTC offsets including daylight saving', () => {
    expect(utcOffsetMinutes('Europe/Lisbon', OCT_12)).toBe(60);
    expect(utcOffsetMinutes('America/New_York', OCT_12)).toBe(-240);
    expect(utcOffsetMinutes('Asia/Kolkata', OCT_12)).toBe(330);
    expect(formatUtcOffset(-240)).toBe('UTC−4');
    expect(formatUtcOffset(330)).toBe('UTC+5:30');
  });

  it('works out the shared 9-to-5 hours', () => {
    const lisbon = workOverlap('America/New_York', 'Europe/Lisbon', OCT_12);
    expect(lisbon.minutes).toBe(3 * 60);
    expect(minuteLabel(lisbon.cityStart)).toBe('2 PM');
    expect(minuteLabel(lisbon.homeEnd)).toBe('noon');

    const mexico = workOverlap('America/New_York', 'America/Mexico_City', OCT_12);
    expect(mexico.minutes).toBe(6 * 60);

    const chiangMai = workOverlap('America/New_York', 'Asia/Bangkok', OCT_12);
    expect(chiangMai.minutes).toBe(0);
    // New York's 9 to 5 is 8 PM to 4 AM in Bangkok, so it wraps past midnight.
    expect(chiangMai.homeSpans).toEqual([
      [20 * 60, 24 * 60],
      [0, 4 * 60],
    ]);
  });

  it('formats clock times and daylight', () => {
    expect(isoClock('2026-10-12T07:31')).toBe('7:31 AM');
    expect(isoClock('2026-10-12T12:05')).toBe('12:05 PM');
    expect(formatDaylight(41460)).toBe('11 h 31 m');
  });
});

describe('openState', () => {
  // Monday to Friday, 8 AM to 6 PM.
  const weekdays = [1, 2, 3, 4, 5].map((day) => ({
    open_day: day,
    open_minute: 8 * 60,
    close_day: day,
    close_minute: 18 * 60,
  }));

  it('is open during hours and says until when', () => {
    // 14:42 UTC is 15:42 in Lisbon on Monday.
    expect(openState(weekdays, 'Europe/Lisbon', OCT_12)).toEqual({ open: true, label: 'Open until 6 PM' });
  });

  it('says when a closed place opens next', () => {
    const lateMonday = new Date('2026-10-12T19:00:00Z');
    expect(openState(weekdays, 'Europe/Lisbon', lateMonday)).toEqual({ open: false, label: 'Opens Tue 8 AM' });
    const earlyMonday = new Date('2026-10-12T05:00:00Z');
    expect(openState(weekdays, 'Europe/Lisbon', earlyMonday)).toEqual({ open: false, label: 'Opens 8 AM' });
  });

  it('handles overnight hours and 24-hour places', () => {
    const bar = [{ open_day: 1, open_minute: 20 * 60, close_day: 2, close_minute: 2 * 60 }];
    expect(openState(bar, 'Europe/Lisbon', new Date('2026-10-12T23:30:00Z'))?.open).toBe(true);
    const always = [{ open_day: 0, open_minute: 0, close_day: null, close_minute: null }];
    expect(openState(always, 'Europe/Lisbon', OCT_12)).toEqual({ open: true, label: 'Open 24 hours' });
    expect(openState(null, 'Europe/Lisbon', OCT_12)).toBeNull();
  });
});

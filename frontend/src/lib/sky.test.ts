import { describe, expect, it } from 'vitest';

import { isoMinutes, skyState, solarTimes, sunTimes } from './sky';

const RISE = 7 * 60; // 7:00
const SET = 19 * 60; // 19:00

describe('skyState', () => {
  it('moves through dawn, day, dusk and night', () => {
    expect(skyState(5 * 60, RISE, SET).phase).toBe('night');
    expect(skyState(7 * 60 + 10, RISE, SET).phase).toBe('dawn');
    expect(skyState(13 * 60, RISE, SET).phase).toBe('day');
    expect(skyState(18 * 60 + 30, RISE, SET).phase).toBe('dusk');
    expect(skyState(22 * 60, RISE, SET).phase).toBe('night');
  });

  it('puts the sun along its arc by day and the moon by night', () => {
    const noon = skyState(13 * 60, RISE, SET);
    expect(noon.moon).toBe(false);
    expect(noon.f).toBeCloseTo(0.5);
    const late = skyState(1 * 60, RISE, SET);
    expect(late.moon).toBe(true);
    expect(late.f).toBeGreaterThan(0.4);
    expect(late.f).toBeLessThan(0.6);
  });
});

describe('sun times', () => {
  it('reads local minutes from a forecast time', () => {
    expect(isoMinutes('2026-10-14T07:41')).toBe(461);
    expect(isoMinutes(null)).toBeNull();
  });

  it('prefers the forecast and falls back to the calculation', () => {
    expect(sunTimes({ sunrise: '2026-10-14T07:41', sunset: '2026-10-14T18:59' }, null)).toEqual({ rise: 461, set: 1139 });
    const lisbon = sunTimes(undefined, { lat: 38.72, lng: -9.14, timeZone: 'Europe/Lisbon' });
    expect(lisbon).not.toBeNull();
  });

  it('works out a plausible sunrise and sunset', () => {
    // Lisbon in mid-October: sunrise a little after 7:30, sunset a little before 19:00 (UTC+1).
    const { rise, set } = solarTimes(38.72, -9.14, 'Europe/Lisbon', new Date('2026-10-15T12:00:00Z'));
    expect(rise).toBeGreaterThan(7 * 60 + 20);
    expect(rise).toBeLessThan(7 * 60 + 55);
    expect(set).toBeGreaterThan(18 * 60 + 40);
    expect(set).toBeLessThan(19 * 60 + 15);
  });
});

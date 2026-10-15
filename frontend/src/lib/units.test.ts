import { afterEach, describe, expect, it } from 'vitest';

import { degrees, setUnits, unitsFrom } from './units';

describe('units', () => {
  afterEach(() => window.localStorage.clear());

  it('lets a link choose the units without changing the saved choice', () => {
    expect(unitsFrom('imperial', 'metric')).toBe('imperial');
    expect(unitsFrom('kelvin', 'metric')).toBe('metric');
    expect(unitsFrom(null, 'imperial')).toBe('imperial');
  });

  it('remembers the choice for every page', () => {
    setUnits('imperial');
    expect(window.localStorage.getItem('rr:units')).toBe('imperial');
  });

  it('rounds temperatures and shows a dash when unknown', () => {
    expect(degrees(17.6)).toBe('18°');
    expect(degrees(-0.4)).toBe('0°');
    expect(degrees(null)).toBe('–');
    expect(degrees(Number.NaN)).toBe('–');
  });
});

import { describe, expect, it } from 'vitest';

import { countryCodeFromId, defaultUnitsFor } from './cityId';

describe('city IDs', () => {
  it('reads the country code from current and legacy IDs', () => {
    expect(countryCodeFromId('santa-fe--nm--us')).toBe('us');
    expect(countryCodeFromId('singapore--sg')).toBe('sg');
    expect(countryCodeFromId('santa_fe_us')).toBe('us');
    expect(countryCodeFromId('paris')).toBe('');
  });

  it('defaults to imperial units only where Fahrenheit is used', () => {
    expect(defaultUnitsFor('austin--tx--us')).toBe('imperial');
    expect(defaultUnitsFor('lisbon--lisbon--pt')).toBe('metric');
  });
});

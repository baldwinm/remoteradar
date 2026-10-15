import { describe, expect, it } from 'vitest';

import { countryCodeFromId } from './cityId';

describe('city IDs', () => {
  it('reads the country code from current and legacy IDs', () => {
    expect(countryCodeFromId('santa-fe--nm--us')).toBe('us');
    expect(countryCodeFromId('singapore--sg')).toBe('sg');
    expect(countryCodeFromId('santa_fe_us')).toBe('us');
    expect(countryCodeFromId('paris')).toBe('');
  });
});

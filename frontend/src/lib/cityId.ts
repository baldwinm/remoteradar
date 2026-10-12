import type { Units } from '../api/types';

// Countries that use Fahrenheit day to day.
const IMPERIAL_COUNTRIES = new Set(['us', 'lr', 'mm']);

/**
 * The country code is the last part of a city ID, in both the current format
 * ("santa-fe--nm--us") and the format older shared links used ("santa_fe_us").
 */
export function countryCodeFromId(cityId: string): string {
  const parts = cityId.includes('--') ? cityId.split('--') : cityId.split('_');
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return last && /^[a-z]{2}$/.test(last) ? last : '';
}

export function defaultUnitsFor(cityId: string): Units {
  return IMPERIAL_COUNTRIES.has(countryCodeFromId(cityId)) ? 'imperial' : 'metric';
}

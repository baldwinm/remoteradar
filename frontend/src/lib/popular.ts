import { usePopularCities } from '../api/queries';
import type { PopularCity } from '../api/types';
import { browserTimeZone } from './time';

// Shown until enough people have searched to build a live list. Name + country IDs;
// the city page resolves them and switches to the full ID.
export const FALLBACK_POPULAR: PopularCity[] = [
  { id: 'lisbon--pt', name: 'Lisbon' },
  { id: 'mexico-city--mx', name: 'Mexico City' },
  { id: 'chiang-mai--th', name: 'Chiang Mai' },
  { id: 'medellín--co', name: 'Medellín' },
  { id: 'tbilisi--ge', name: 'Tbilisi' },
];

// Country names that read naturally after "in the".
const NEEDS_THE = new Set(['US', 'GB', 'NL', 'PH', 'AE', 'DO', 'BS', 'GM', 'MV', 'CF', 'KY']);

export function countryPhrase(code: string): string {
  let name = code;
  try {
    name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    // Very old browsers: fall back to the code itself.
  }
  return NEEDS_THE.has(code) ? `the ${name}` : name;
}

export interface Popular {
  /** Where the list comes from: people in the visitor's country, the whole site, or the built-in list. */
  scope: 'country' | 'site' | 'none';
  /** "the United States", when scope is "country". */
  place: string;
  cities: PopularCity[];
}

/** Cities opened most by people in the visitor's country (from the browser's time zone, never the IP). */
export function usePopular(): Popular {
  const live = usePopularCities(browserTimeZone()).data;
  if (live && live.cities.length > 0 && live.scope !== 'none') {
    return {
      scope: live.scope,
      place: live.scope === 'country' ? countryPhrase(live.country_code) : '',
      cities: live.cities,
    };
  }
  return { scope: 'none', place: '', cities: FALLBACK_POPULAR };
}

/** "Popular in the United States", "Popular on Remote Radar" or just "Popular". */
export function popularTitle(popular: Popular): string {
  if (popular.scope === 'country') return `Popular in ${popular.place}`;
  if (popular.scope === 'site') return 'Popular on Remote Radar';
  return 'Popular';
}

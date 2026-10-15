import type { City } from '../api/types';
import { countryCodeFromId } from './cityId';
import type { CityRef } from './savedCities';
import { FEATURED } from './world';

/** One row in the search results. */
export interface SearchItem {
  id: string;
  name: string;
  /** "New Mexico, USA" or "Portugal". */
  region: string;
  timeZone?: string;
  /** Set for API results, so the city page can render at once from what search returned. */
  city?: City;
}

/** Lowercase, without accents, so "medellin" finds Medellín. */
export function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function regionLabel(city: City): string {
  if (city.country_code === 'us') return [city.state, 'USA'].filter(Boolean).join(', ');
  return [city.state, city.country].filter(Boolean).join(', ');
}

let regionNames: Intl.DisplayNames | null | undefined;

/** "Portugal" from a city ID like "porto--pt", when nothing better is known. */
export function countryFromId(id: string): string {
  const code = countryCodeFromId(id).toUpperCase();
  if (!code) return '';
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function fromCity(city: City): SearchItem {
  return { id: city.id, name: city.name, region: regionLabel(city), timeZone: city.timezone || undefined, city };
}

export function fromRef(ref: CityRef): SearchItem {
  const featured = FEATURED.find((item) => item.id === ref.id);
  return {
    id: ref.id,
    name: ref.name,
    region: ref.country || featured?.country || countryFromId(ref.id),
    timeZone: ref.timezone || featured?.zone,
  };
}

/** A popular city (the API gives only its ID and name). */
export function fromPopular(city: { id: string; name: string }): SearchItem {
  const featured = FEATURED.find((item) => item.id === city.id || norm(item.name) === norm(city.name));
  return {
    id: city.id,
    name: city.name,
    region: featured?.country ?? countryFromId(city.id),
    timeZone: featured?.zone,
  };
}

/** Edit distance between two short strings. */
export function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** Close spellings from cities we already know about, for "Did you mean…" when a search finds nothing. */
export function suggestions(query: string, pool: SearchItem[], limit = 4): SearchItem[] {
  const q = norm(query);
  if (q.length < 4) return [];
  const max = q.length >= 7 ? 2 : 1;
  const seen = new Set<string>();
  return pool
    .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
    .map((item) => [item, levenshtein(q, norm(item.name).slice(0, q.length))] as const)
    .filter(([, distance]) => distance <= max)
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([item]) => item);
}

/** Splits `name` around the part that matches `query`, for bolding it. */
export function matchParts(name: string, query: string): [string, string, string] | null {
  const q = norm(query);
  if (!q) return null;
  const at = norm(name).indexOf(q);
  if (at < 0) return null;
  return [name.slice(0, at), name.slice(at, at + q.length), name.slice(at + q.length)];
}

import { useSyncExternalStore } from 'react';

import type { City } from '../api/types';
import { browserTimeZone, isValidTimeZone } from './time';

/** What's kept per city: enough to draw a link without asking the API. */
export interface CityRef {
  id: string;
  name: string;
  country: string;
  /** IANA zone, for showing the local time without an API call. */
  timezone?: string;
  /** For drawing the city's sky (sunrise and sunset) before its forecast loads. */
  lat?: number;
  lng?: number;
}

const SAVED_KEY = 'rr:saved-cities';
const RECENT_KEY = 'rr:recent-cities';
const HOME_ZONE_KEY = 'rr:home-time-zone';
const MAX_RECENT = 8;
const MAX_SAVED = 24;

// Everything lives in the browser only. Storage can be missing or throw (private
// windows, blocked site data), so every access is guarded and falls back to empty.
function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved; the in-memory snapshot below still updates for this visit.
  }
  snapshots.set(key, value);
  listeners.forEach((listener) => listener());
}

const listeners = new Set<() => void>();
const snapshots = new Map<string, unknown>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key) snapshots.delete(event.key);
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** A stable array per key, so useSyncExternalStore doesn't re-render forever. */
function snapshot(key: string): CityRef[] {
  if (!snapshots.has(key)) {
    const value = read<unknown>(key, []);
    snapshots.set(key, Array.isArray(value) ? value.filter(isCityRef) : []);
  }
  return snapshots.get(key) as CityRef[];
}

function isCityRef(value: unknown): value is CityRef {
  const ref = value as CityRef;
  return typeof ref?.id === 'string' && typeof ref.name === 'string' && typeof ref.country === 'string';
}

export function toRef(city: City): CityRef {
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    timezone: city.timezone || undefined,
    lat: city.lat,
    lng: city.lng,
  };
}

export function useSavedCities(): CityRef[] {
  return useSyncExternalStore(subscribe, () => snapshot(SAVED_KEY), () => []);
}

export function useRecentCities(): CityRef[] {
  return useSyncExternalStore(subscribe, () => snapshot(RECENT_KEY), () => []);
}

export function toggleSaved(city: CityRef) {
  const saved = snapshot(SAVED_KEY);
  const exists = saved.some((item) => item.id === city.id);
  write(SAVED_KEY, exists ? saved.filter((item) => item.id !== city.id) : [city, ...saved].slice(0, MAX_SAVED));
}

/** Removes a saved city and returns a function that puts it back where it was (for Undo). */
export function unsave(id: string): (() => void) | null {
  const saved = snapshot(SAVED_KEY);
  const index = saved.findIndex((item) => item.id === id);
  const city = saved[index];
  if (!city) return null;
  write(SAVED_KEY, saved.filter((item) => item.id !== id));
  return () => {
    const now = snapshot(SAVED_KEY).filter((item) => item.id !== id);
    write(SAVED_KEY, [...now.slice(0, index), city, ...now.slice(index)].slice(0, MAX_SAVED));
  };
}

export function recordVisit(city: CityRef) {
  const recent = snapshot(RECENT_KEY).filter((item) => item.id !== city.id);
  write(RECENT_KEY, [city, ...recent].slice(0, MAX_RECENT));
}

// Also kept in memory, so the choice holds for this visit even when storage is blocked.
let chosenZone: string | null = null;

function homeZoneSnapshot(): string {
  const saved = chosenZone ?? read<unknown>(HOME_ZONE_KEY, null);
  return typeof saved === 'string' && isValidTimeZone(saved) ? saved : browserTimeZone();
}

/** The time zone the viewer works in: their pick, or their browser's. Shared by every component. */
export function useHomeZone(): string {
  return useSyncExternalStore(subscribe, homeZoneSnapshot, () => 'UTC');
}

export function saveHomeZone(zone: string) {
  chosenZone = zone;
  write(HOME_ZONE_KEY, zone);
}

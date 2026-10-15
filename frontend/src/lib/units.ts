import { useCallback, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';

import type { Units } from '../api/types';

/* °C or °F, chosen once and used on every page. Until the visitor picks, it follows the browser's
   language: Fahrenheit for US English (and the two other places that use it), Celsius elsewhere.
   A link with ?units= still shows those units, without changing the saved choice. */

const STORAGE_KEY = 'rr:units';
const listeners = new Set<() => void>();

function isUnits(value: unknown): value is Units {
  return value === 'metric' || value === 'imperial';
}

export function localeUnits(): Units {
  if (typeof navigator === 'undefined') return 'metric';
  const language = navigator.languages?.[0] || navigator.language || 'en-US';
  return /^(en-US|en-LR|my)\b/i.test(language) ? 'imperial' : 'metric';
}

function readSaved(): Units | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isUnits(saved) ? saved : null;
  } catch {
    return null;
  }
}

let current: Units | null = typeof window === 'undefined' ? null : readSaved();

function snapshot(): Units {
  return current ?? localeUnits();
}

export function setUnits(units: Units) {
  current = units;
  try {
    window.localStorage.setItem(STORAGE_KEY, units);
  } catch {
    // Not saved, but used for the rest of this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    current = readSaved();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** The visitor's units: their pick, or their browser's default. */
export function useUnits(): Units {
  return useSyncExternalStore(subscribe, snapshot, () => 'metric');
}

/** Units for a page that may carry ?units= in its link. */
export function unitsFrom(param: string | null, saved: Units): Units {
  return isUnits(param) ? param : saved;
}

/** "18°" from a temperature already in the visitor's units. */
export function degrees(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value) ? '–' : `${Math.round(value)}°`;
}

/**
 * Units for the current page: a link with ?units= shows those; picking units saves the choice for
 * every page and drops the link's.
 */
export function usePageUnits(): [Units, (next: Units) => void] {
  const saved = useUnits();
  const [params, setParams] = useSearchParams();
  const units = unitsFrom(params.get('units'), saved);
  const change = useCallback(
    (next: Units) => {
      setUnits(next);
      if (params.has('units')) {
        setParams(
          (current) => {
            current.delete('units');
            return current;
          },
          { replace: true },
        );
      }
    },
    [params, setParams],
  );
  return [units, change];
}

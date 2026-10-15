import { useSyncExternalStore } from 'react';

/** "system" follows the device's light/dark setting; the others override it. */
export type ThemeChoice = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

// Also read by public/theme-init.js before the page paints.
const STORAGE_KEY = 'rr-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_COLORS: Record<Theme, string> = { light: '#f5f6f8', dark: '#0a0b0d' };

const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

let currentChoice: ThemeChoice = typeof window === 'undefined' ? 'system' : readChoice();

function deviceTheme(): Theme {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

function resolve(choice: ThemeChoice): Theme {
  return choice === 'system' ? deviceTheme() : choice;
}

/** Keeps the browser's address bar color in step with the page. */
function syncThemeColor() {
  const color = THEME_COLORS[resolve(currentChoice)];
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', color));
}

export function setThemeChoice(choice: ThemeChoice) {
  currentChoice = choice;
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === 'system') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Not saved, but still applied for this visit.
  }
  syncThemeColor();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia?.(DARK_QUERY);
  const onDeviceChange = () => {
    syncThemeColor();
    listener();
  };
  media?.addEventListener('change', onDeviceChange);
  return () => {
    listeners.delete(listener);
    media?.removeEventListener('change', onDeviceChange);
  };
}

/** The visitor's choice: system, light or dark. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, () => currentChoice, () => 'system');
}

/** The theme actually showing right now, after following the device if needed. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => resolve(currentChoice), () => 'light');
}

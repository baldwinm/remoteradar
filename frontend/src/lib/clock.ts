import { useSyncExternalStore } from 'react';

/* One shared clock for every local time on the page. It ticks at the start of each minute, so all
   the times on screen change together, and catches up when a hidden tab comes back. */

let now = Date.now();
let timer = 0;
const listeners = new Set<() => void>();

function tick() {
  now = Date.now();
  listeners.forEach((listener) => listener());
}

function schedule() {
  window.clearTimeout(timer);
  timer = window.setTimeout(
    () => {
      tick();
      schedule();
    },
    60000 - (Date.now() % 60000) + 50,
  );
}

function onVisible() {
  if (document.visibilityState !== 'visible') return;
  tick();
  schedule();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    schedule();
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
}

/** The current time in milliseconds, updated every minute. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}

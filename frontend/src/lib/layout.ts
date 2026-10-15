import { useEffect, useRef, useSyncExternalStore } from 'react';

/* Desktop and phone get separately designed layouts, not one layout squeezed. The page CSS styles
   each under a class on <html> (.is-desk or .is-phone), and components that render different
   markup per layout read useIsPhone(). public/theme-init.js sets the class before the first paint. */

export const PHONE_QUERY = '(max-width: 760px)';

function media(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY) : null;
}

/** True on phone-sized screens, read once (no re-render). */
export function isPhoneNow(): boolean {
  return media()?.matches ?? false;
}

function applyClass(phone: boolean) {
  const classes = document.documentElement.classList;
  classes.toggle('is-phone', phone);
  classes.toggle('is-desk', !phone);
}

if (typeof document !== 'undefined') applyClass(isPhoneNow());

function subscribe(listener: () => void) {
  const query = media();
  if (!query) return () => undefined;
  const onChange = () => {
    applyClass(query.matches);
    listener();
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** True on phone-sized screens. Re-renders when the window crosses the breakpoint. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, isPhoneNow, () => false);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** Smooth scrolling, unless the visitor asked for less motion. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

/** Calls `update` on the next frame after a scroll or resize, and once at the start. */
export function useOnScroll(update: () => void) {
  const latest = useRef(update);
  useEffect(() => {
    latest.current = update;
  });
  useEffect(() => {
    let frame = 0;
    const run = () => {
      frame = 0;
      latest.current();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
}

import { useEffect } from 'react';
import { useLocation } from 'react-router';

declare global {
  interface Window {
    goatcounter?: { count?: (vars: { path: string; title?: string; event?: boolean }) => void };
  }
}

/** Counts a GoatCounter page view on every client-side navigation (including the first page). */
export function usePageViews() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname + location.search;
    const count = () => window.goatcounter?.count?.({ path, title: document.title });
    if (window.goatcounter?.count) {
      count();
      return;
    }
    // The script loads async; on the very first page it may not be ready yet.
    const timer = window.setTimeout(count, 1500);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);
}

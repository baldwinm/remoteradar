import { useSyncExternalStore } from 'react';

import { isPhoneNow, scrollBehavior } from './layout';
import type { Phase } from './sky';

/* Small shared state for the page chrome: where overlays render, the toast, and how the header
   looks. Kept outside React context so a change re-renders only the pieces that read it. */

function createStore<T>(initial: T, equal: (a: T, b: T) => boolean = Object.is) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: T) {
      if (equal(state, next)) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function useStore<T>(store: ReturnType<typeof createStore<T>>, server: T): T {
  return useSyncExternalStore(store.subscribe, store.get, () => server);
}

/* ---------- Where overlays render ---------- */

// Sheets, the search palette, the toast and the phone map render in the fixed layer above the page;
// popovers render inside the page itself, so they scroll with what opened them.
const layerStore = createStore<HTMLElement | null>(null);
const siteStore = createStore<HTMLElement | null>(null);

export const setLayerElement = (element: HTMLElement | null) => layerStore.set(element);
export const setSiteElement = (element: HTMLElement | null) => siteStore.set(element);
export const useLayerElement = () => useStore(layerStore, null);
export const useSiteElement = () => useStore(siteStore, null);

/* ---------- Toast ---------- */

export interface ToastMessage {
  id: number;
  text: string;
  undo?: () => void;
  /** False while it slides in, and again as it fades out (the text stays for the fade). */
  on: boolean;
}

const toastStore = createStore<ToastMessage | null>(null);
let toastId = 0;
let toastTimer = 0;

/** A short message at the bottom of the screen, with an optional Undo. */
export function toast(text: string, options: { undo?: () => void } = {}) {
  toastId += 1;
  const id = toastId;
  window.clearTimeout(toastTimer);
  toastStore.set({ id, text, undo: options.undo, on: false });
  // Two frames, so the hidden state paints before the slide-in starts.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const current = toastStore.get();
      if (current?.id === id) toastStore.set({ ...current, on: true });
    }),
  );
  toastTimer = window.setTimeout(() => dismissToast(id), options.undo ? 4500 : 2600);
}

export function dismissToast(id: number) {
  const current = toastStore.get();
  if (current?.id === id && current.on) toastStore.set({ ...current, on: false });
}

export const useToastMessage = () => useStore(toastStore, null);

/** Copies the page's link on desktop; opens the share sheet on phones that have one. */
export async function sharePage(title: string, phone: boolean) {
  const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  if (phone && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
    } catch {
      // Closed without sharing.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    toast("Couldn't copy the link. Copy it from the address bar instead.");
  }
}

/* ---------- Header ---------- */

// Phones: the header tucks away while scrolling down and comes back on the way up.
const awayStore = createStore(false);
let lockedUntil = 0;

export const useHeaderAway = () => useStore(awayStore, false);
export const setHeaderAway = (away: boolean) => awayStore.set(away);

/** Keeps the phone header tucked away while a jump to a section scrolls the page. */
export function holdHeaderAway(ms = 1200) {
  lockedUntil = performance.now() + ms;
  awayStore.set(true);
}

export const headerHeld = () => performance.now() < lockedUntil;

/** On a city page the phone header sits on the sky and takes its colors. */
export interface HeaderSky {
  phase: Phase;
  /** Still over the sky (not yet scrolled past it). */
  onSky: boolean;
  /** Over the sky but scrolled a little, so it takes the sky's top color as a backdrop. */
  veiled: boolean;
}

const skyStore = createStore<HeaderSky | null>(
  null,
  (a, b) => a === b || (!!a && !!b && a.phase === b.phase && a.onSky === b.onSky && a.veiled === b.veiled),
);

export const setHeaderSky = (sky: HeaderSky | null) => skyStore.set(sky);
export const useHeaderSky = () => useStore(skyStore, null);

/* ---------- Jumping to a section ---------- */

/**
 * Scrolls to the element marked data-sec="id". `offset` is added to its top, so a page can leave
 * room for its sticky bars.
 */
export function jumpTo(id: string, offset = 0, smooth = true) {
  const element = document.querySelector(`[data-sec="${CSS.escape(id)}"]`);
  if (!element) return;
  if (isPhoneNow()) holdHeaderAway();
  const top = window.scrollY + element.getBoundingClientRect().top + offset;
  window.scrollTo({ top: Math.max(0, top), behavior: smooth ? scrollBehavior() : 'auto' });
}

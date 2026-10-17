import { useQueryClient } from '@tanstack/react-query';
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';

import { cityKeys, useCitySearch } from '../api/queries';
import { useLayerElement } from '../lib/chrome';
import { isPhoneNow, scrollBehavior, useIsPhone } from '../lib/layout';
import { popularTitle, usePopular } from '../lib/popular';
import { useRecentCities, useSavedCities } from '../lib/savedCities';
import {
  type SearchItem,
  fromCity,
  fromPopular,
  fromRef,
  matchParts,
  suggestions,
} from '../lib/search';
import { fmtClock, isValidTimeZone, localMinutes } from '../lib/time';
import { FEATURED } from '../lib/world';
import Icon from './Icon';
import { useDialogFocus, useScrollLock } from './overlays';

/* City search: the ⌘K palette on desktop, a full-screen sheet on phones, and the big box on the
   home page. Results show each city's local time. "compare" mode picks a city to add to the
   comparison instead of opening its page. */

export type SearchMode = 'go' | 'compare';

interface SearchRequest {
  open: boolean;
  /** Bumped on every open, so each search starts empty. */
  seq: number;
  mode: SearchMode;
  exclude: readonly string[];
  onPick?: (item: SearchItem) => void;
}

let request: SearchRequest = { open: false, seq: 0, mode: 'go', exclude: [] };
const listeners = new Set<() => void>();

function setRequest(next: SearchRequest) {
  request = next;
  listeners.forEach((listener) => listener());
}

function useSearchRequest(): SearchRequest {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => request,
    () => request,
  );
}

// The phone sheet stays mounted, so opening it can focus its input in the same tap: iOS raises the
// keyboard only for focus that happens inside the tap itself.
let phoneSheet: { root: HTMLElement; input: HTMLInputElement } | null = null;

/** Opens city search. On the desktop home page, ⌘K and the header button use the big search box instead. */
export function openSearch(options: { mode?: SearchMode; exclude?: readonly string[]; onPick?: (item: SearchItem) => void } = {}) {
  const mode = options.mode ?? 'go';
  if (!isPhoneNow() && mode === 'go') {
    const hero = document.querySelector<HTMLInputElement>('[data-hero-search]');
    if (hero) {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
      hero.focus({ preventScroll: true });
      return;
    }
  }
  if (isPhoneNow() && phoneSheet) {
    phoneSheet.root.inert = false;
    phoneSheet.root.classList.add('is-open');
    phoneSheet.input.value = '';
    phoneSheet.input.focus({ preventScroll: true });
  }
  setRequest({ open: true, seq: request.seq + 1, mode, exclude: options.exclude ?? [], onPick: options.onPick });
}

export function closeSearch() {
  if (request.open) setRequest({ ...request, open: false });
}

/* ---------- What to show for a query ---------- */

interface Group {
  title: string;
  items: SearchItem[];
}

export interface SearchModel {
  status: 'start' | 'loading' | 'error' | 'empty' | 'results';
  groups: Group[];
  items: SearchItem[];
  empty?: { title: string; text: string };
  note?: string;
  /** Nothing matched, so the list offers popular cities instead; Enter doesn't open one unasked. */
  fallback?: boolean;
}

function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const featuredItems: SearchItem[] = FEATURED.map((city) => ({
  id: city.id,
  name: city.name,
  region: city.country,
  timeZone: city.zone,
}));

export function useSearchModel(query: string, mode: SearchMode, exclude: readonly string[] = []): SearchModel {
  const trimmed = query.trim();
  const term = useDebounced(trimmed, 220);
  const search = useCitySearch(term);
  const saved = useSavedCities();
  const recent = useRecentCities();
  const popular = usePopular();
  const skip = new Set(exclude);

  if (trimmed.length < 2) {
    const groups: Group[] = [];
    const seen = new Set(exclude);
    const take = (items: SearchItem[], limit: number) => {
      const out = items.filter((item) => !seen.has(item.id)).slice(0, limit);
      out.forEach((item) => seen.add(item.id));
      return out;
    };
    const mine = take(saved.map(fromRef), mode === 'compare' ? 6 : 4);
    const lately = take(recent.map(fromRef), 4);
    if (mine.length) groups.push({ title: 'Your cities', items: mine });
    if (lately.length) groups.push({ title: 'Recently viewed', items: lately });
    if (mode === 'go') {
      const top = take(popular.cities.map(fromPopular), 6);
      if (top.length) groups.push({ title: popularTitle(popular), items: top });
    }
    return {
      status: 'start',
      groups,
      items: groups.flatMap((group) => group.items),
      note: mode === 'compare' && groups.length === 0 ? 'Type a city name to add it to the comparison.' : undefined,
    };
  }

  const waiting = term !== trimmed || search.isFetching;
  if (search.isError && !waiting) {
    return {
      status: 'error',
      groups: [],
      items: [],
      empty: { title: "Search isn't working right now", text: 'Check your connection, then try again.' },
    };
  }
  const found = search.data ?? [];
  const results = found.filter((city) => !skip.has(city.id)).slice(0, 8).map(fromCity);
  if (results.length > 0) return { status: 'results', groups: [{ title: 'Cities', items: results }], items: results };
  if (waiting || !search.data) return { status: 'loading', groups: [], items: [] };
  if (found.length > 0) {
    return {
      status: 'empty',
      groups: [],
      items: [],
      empty: { title: `${found[0]!.name} is already in the comparison`, text: 'Search for another city to add.' },
    };
  }
  const pool = [
    ...featuredItems,
    ...saved.map(fromRef),
    ...recent.map(fromRef),
    ...popular.cities.map(fromPopular),
  ].filter((item) => !skip.has(item.id));
  const close = suggestions(trimmed, pool);
  const groups: Group[] = close.length ? [{ title: '', items: close }] : [];
  if (mode === 'go') {
    const others = popular.cities
      .map(fromPopular)
      .filter((item) => !close.some((match) => match.id === item.id))
      .slice(0, 5);
    if (others.length) groups.push({ title: close.length ? 'Or try one of these' : 'Try one of these', items: others });
  }
  return {
    status: 'empty',
    groups,
    items: groups.flatMap((group) => group.items),
    empty: {
      title: `No city called “${trimmed}”`,
      text: close.length ? 'Did you mean one of these?' : 'Check the spelling, or try a larger city nearby.',
    },
    fallback: close.length === 0,
  };
}

/* ---------- Results list ---------- */

function Highlight({ name, query }: { name: string; query: string }) {
  const parts = matchParts(name, query);
  if (!parts) return <>{name}</>;
  return (
    <>
      {parts[0]}
      <mark>{parts[1]}</mark>
      {parts[2]}
    </>
  );
}

interface ResultsProps {
  model: SearchModel;
  query: string;
  listId: string;
  active: number;
  onActive?: (index: number) => void;
  onPick: (item: SearchItem) => void;
}

export function SearchResults({ model, query, listId, active, onActive, onPick }: ResultsProps) {
  const starts = model.groups.map((_, index) =>
    model.groups.slice(0, index).reduce((total, group) => total + group.items.length, 0),
  );
  return (
    <div className="palette-list" role="listbox" id={listId} aria-label="Cities">
      {model.status === 'loading' && <p className="p-note">Searching…</p>}
      {model.empty && (
        <div className="p-empty">
          <b>{model.empty.title}</b>
          <span>{model.empty.text}</span>
        </div>
      )}
      {model.groups.map((group, groupIndex) => (
        <div key={group.title || 'close'} role="group" aria-label={group.title || 'Close matches'}>
          {group.title && (
            <div className="p-group" aria-hidden="true">
              {group.title}
            </div>
          )}
          {group.items.map((item, itemIndex) => {
            const index = (starts[groupIndex] ?? 0) + itemIndex;
            return (
              <div
                key={item.id}
                id={`${listId}-${index}`}
                role="option"
                tabIndex={-1}
                className="p-item"
                aria-selected={index === active}
                onMouseMove={onActive && index !== active ? () => onActive(index) : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onPick(item)}
              >
                <span className="p-ic">
                  <Icon name="pin" size={17} />
                </span>
                <span className="p-main">
                  <span>
                    <Highlight name={item.name} query={model.status === 'results' ? query : ''} />
                  </span>
                  {item.region && <small>{item.region}</small>}
                </span>
                {item.timeZone && isValidTimeZone(item.timeZone) && (
                  <span className="p-meta">{fmtClock(localMinutes(item.timeZone))}</span>
                )}
                <span className="p-enter kbd" aria-hidden="true">
                  ↵
                </span>
              </div>
            );
          })}
        </div>
      ))}
      {model.note && <p className="p-note">{model.note}</p>}
    </div>
  );
}

/**
 * The highlighted result. `active` is -1 until the arrow keys or the mouse move it, which means the
 * first result, except when the list only offers popular cities after a failed search.
 */
export function currentIndex(model: SearchModel, active: number): number {
  return active < 0 && !model.fallback ? 0 : active;
}

/** Arrow keys move through the results; Enter opens the highlighted one. */
export function resultKeys(
  event: KeyboardEvent<HTMLInputElement>,
  model: SearchModel,
  active: number,
  setActive: (index: number) => void,
  pick: (item: SearchItem) => void,
  listId: string,
) {
  const count = model.items.length;
  const from = currentIndex(model, active);
  if (event.key === 'Enter') {
    const item = model.items[from];
    if (item) {
      event.preventDefault();
      pick(item);
    }
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  if (!count) return;
  event.preventDefault();
  const next = event.key === 'ArrowDown' ? (from + 1) % count : from <= 0 ? count - 1 : from - 1;
  setActive(next);
  document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' });
}

/** Opens the city page (or hands the city to whoever asked, in compare mode). */
export function usePickCity(onPick?: (item: SearchItem) => void) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (item: SearchItem) => {
    if (item.city) queryClient.setQueryData(cityKeys.city(item.city.id), item.city);
    closeSearch();
    if (onPick) onPick(item);
    else navigate(`/city/${encodeURIComponent(item.id)}`);
  };
}

/** Per-open state that starts fresh each time search opens, without an effect. */
function useFreshState<T>(seq: number, initial: T): [T, (value: T) => void] {
  const [state, setState] = useState({ seq, value: initial });
  const value = state.seq === seq ? state.value : initial;
  return [value, (next: T) => setState({ seq, value: next })];
}

/* ---------- Desktop palette and phone sheet ---------- */

/** Mounted once for the whole site: the palette on desktop, the sheet on phones, plus ⌘K and "/". */
export function SearchOverlay() {
  const phone = useIsPhone();

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing = !!target && (target.matches('input, textarea, select') || target.isContentEditable);
      const k = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey;
      if (k || (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey)) {
        event.preventDefault();
        if (request.open) closeSearch();
        else openSearch();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return phone ? <SearchSheet /> : <SearchPalette />;
}

function useSearchState() {
  const req = useSearchRequest();
  const [query, setQuery] = useFreshState(req.seq, '');
  const [active, setActive] = useFreshState(req.seq, -1);
  const model = useSearchModel(query, req.mode, req.exclude);
  const pick = usePickCity(req.onPick);
  return { req, query, setQuery, active, setActive, model, pick };
}

function SearchPalette() {
  const layer = useLayerElement();
  const { req, query, setQuery, active, setActive, model, pick } = useSearchState();
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useScrollLock(req.open);
  useDialogFocus(box, req.open, closeSearch, input);

  if (!layer) return null;
  const compare = req.mode === 'compare';
  return createPortal(
    <div
      className={`palette${req.open ? ' is-open' : ''}`}
      inert={!req.open}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSearch();
      }}
    >
      <div
        className="palette-box"
        role="dialog"
        aria-modal="true"
        aria-label={compare ? 'Add a city to compare' : 'Search cities'}
        ref={box}
      >
        <label className="palette-input">
          <Icon name="search" size={20} />
          <input
            ref={input}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(-1);
            }}
            onKeyDown={(event) => resultKeys(event, model, active, setActive, pick, listId)}
            placeholder={compare ? 'Add a city to compare' : 'Search any city in the world'}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={currentIndex(model, active) >= 0 && model.items.length ? `${listId}-${currentIndex(model, active)}` : undefined}
            aria-label="Search for a city"
          />
          <span className="kbd">esc</span>
        </label>
        <SearchResults
          model={model}
          query={query}
          listId={listId}
          active={currentIndex(model, active)}
          onActive={setActive}
          onPick={pick}
        />
        <div className="palette-foot">
          <span>
            <span className="kbd">↑</span>
            <span className="kbd">↓</span>to move
          </span>
          <span>
            <span className="kbd">↵</span>{compare ? 'to add' : 'to open'}
          </span>
          <span>
            <span className="kbd">esc</span>to close
          </span>
          <span className="pf-right">
            <Icon name="clock" size={14} />
            Local time in each city
          </span>
        </div>
      </div>
    </div>,
    layer,
  );
}

function SearchSheet() {
  const layer = useLayerElement();
  const { req, query, setQuery, model, pick } = useSearchState();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useScrollLock(req.open);
  useDialogFocus(panel, req.open, closeSearch, input);

  useEffect(() => {
    if (!root.current || !input.current) return;
    phoneSheet = { root: root.current, input: input.current };
    return () => {
      phoneSheet = null;
    };
  }, [layer]);

  if (!layer) return null;
  const compare = req.mode === 'compare';
  return createPortal(
    <div ref={root} className={`sheet full${req.open ? ' is-open' : ''}`} inert={!req.open}>
      <div className="sheet-panel" role="dialog" aria-modal="true" aria-label="Search cities" ref={panel}>
        <div className="sheet-content">
          <div className="search-sheet-input">
            <label className="box">
              <Icon name="search" size={18} />
              <input
                ref={input}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && model.items[0]) {
                    event.preventDefault();
                    input.current?.blur();
                    pick(model.items[0]);
                  }
                }}
                placeholder={compare ? 'Add a city to compare' : 'Search any city'}
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
                aria-label="Search for a city"
                aria-controls={listId}
              />
            </label>
            <button type="button" className="btn btn-ghost sheet-cancel" onClick={closeSearch}>
              Cancel
            </button>
          </div>
          <div className="search-sheet-body">
            <SearchResults model={model} query={query} listId={listId} active={-1} onPick={pick} />
          </div>
        </div>
      </div>
    </div>,
    layer,
  );
}

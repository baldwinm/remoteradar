import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { usePlaces } from '../../api/queries';
import type { City, Place, PlaceType, Units } from '../../api/types';
import { useLayerElement } from '../../lib/chrome';
import { useNow } from '../../lib/clock';
import { scrollBehavior, useIsPhone } from '../../lib/layout';
import { type OpenState, fmtClock, keepTimeTogether, localMinutes, openState } from '../../lib/time';
import Icon from '../Icon';
import { Popover, Sheet, SheetHead, useDialogFocus, usePresence, useScrollLock } from '../overlays';
import { SecHead, Seg, cssVars } from '../ui';
import CityMap, { type Padding, type Pinned, hasCoords } from './CityMap';
import { PLACE_KINDS, distanceKm, placeKind, priceMarks, shortAddress } from './common';
import { EmptyState, SectionError } from './states';

type Kind = PlaceType | 'all';
type ExtraKind = 'gym' | 'park' | 'laundry';

interface Refine {
  open: boolean;
  rating: number;
  /** 0 for any price; 3 also takes the priciest places (4). */
  price: number;
}

const NO_REFINE: Refine = { open: false, rating: 0, price: 0 };
const PAGE = 10;
const NONE: Place[] = [];
const DESK_PADDING: Padding = { top: 64, bottom: 52, left: 48, right: 72 };
const PHONE_PADDING: Padding = { top: 90, bottom: 210, left: 36, right: 36 };

const NOUNS: Record<Kind, string> = {
  all: 'places',
  coffee: 'coffee shops',
  coworking: 'coworking spaces',
  restaurant: 'restaurants',
  gym: 'gyms',
  park: 'parks',
  laundry: 'laundromats',
};

/** Best rated first, trusting a rating more the more reviews it has, so a 5.0 from three reviews doesn't lead. */
function weighted(place: Place): number {
  if (place.rating === null) return 0;
  const reviews = place.user_ratings_total;
  return (place.rating * reviews + 4.2 * 25) / (reviews + 25);
}

const byRating = (a: Place, b: Place) => weighted(b) - weighted(a) || b.user_ratings_total - a.user_ratings_total;

function priceMatches(place: Place, price: number): boolean {
  if (price === 0) return true;
  if (place.price_level === null) return false;
  return price >= 3 ? place.price_level >= 3 : place.price_level === price;
}

/** Google Maps directions to the place, from wherever the visitor is. */
export function directionsUrl(place: Place): string {
  const destination = hasCoords(place) ? `${place.lat},${place.lng}` : `${place.name}, ${place.address}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&destination_place_id=${encodeURIComponent(place.id)}`;
}

function distanceLabel(city: City, place: Place, units: Units): string | null {
  if (!hasCoords(place)) return null;
  const km = distanceKm(city.lat, city.lng, place.lat, place.lng);
  return units === 'imperial' ? `${(km * 0.621371).toFixed(1)} mi` : `${km.toFixed(1)} km`;
}

interface Props {
  city: City;
  dataId: string;
  zone: string;
  units: Units;
}

export default function PlacesSection({ city, dataId, zone, units }: Props) {
  const phone = useIsPhone();
  const now = useNow();
  const [kind, setKind] = useState<Kind>('all');
  const [refine, setRefine] = useState<Refine>(NO_REFINE);
  const [shown, setShown] = useState(PAGE);
  const sectionRef = useRef<HTMLElement>(null);

  const core = usePlaces(dataId);
  // Gyms, parks and laundry cost extra lookups, so each loads only once someone picks it.
  const gym = usePlaces(dataId, 'gym', kind === 'gym');
  const park = usePlaces(dataId, 'park', kind === 'park');
  const laundry = usePlaces(dataId, 'laundry', kind === 'laundry');
  const extras: Record<ExtraKind, typeof core> = { gym, park, laundry };
  const query = kind === 'gym' || kind === 'park' || kind === 'laundry' ? extras[kind] : core;
  const coreData = core.data;
  const kindData = query.data;

  const pool = useMemo(() => {
    const places = kindData?.places ?? NONE;
    return kind === 'all' || kind === 'gym' || kind === 'park' || kind === 'laundry'
      ? places
      : places.filter((place) => place.type === kind);
  }, [kind, kindData]);

  const states = useMemo(() => {
    const when = new Date(now);
    return new Map(pool.map((place) => [place.id, openState(place.opening_hours, zone, when)]));
  }, [pool, zone, now]);

  const hasHours = pool.some((place) => states.get(place.id));
  const hasPrices = pool.some((place) => (place.price_level ?? 0) > 0);
  // A filter the current kind can't use (no hours, no prices) is left out instead of emptying the list.
  const active: Refine = {
    open: refine.open && hasHours,
    rating: refine.rating,
    price: hasPrices ? refine.price : 0,
  };
  const refineCount = (active.open ? 1 : 0) + (active.rating ? 1 : 0) + (active.price ? 1 : 0);

  const list = useMemo(
    () =>
      pool
        .filter(
          (place) =>
            (!active.open || states.get(place.id)?.open) &&
            (place.rating ?? 0) >= active.rating &&
            priceMatches(place, active.price),
        )
        .sort(byRating),
    [pool, states, active.open, active.rating, active.price],
  );
  const pins = useMemo(() => list.filter(hasCoords), [list]);

  const totals: Partial<Record<Kind, number>> = {};
  if (coreData) {
    totals.all = coreData.places.length;
    for (const key of ['coffee', 'coworking', 'restaurant'] as const) {
      totals[key] = coreData.places.filter((place) => place.type === key).length;
    }
  }
  for (const key of ['gym', 'park', 'laundry'] as const) {
    const data = extras[key].data;
    if (data) totals[key] = data.places.length;
  }

  const minute = localMinutes(zone, new Date(now));
  const loading = query.isPending;
  const failed = query.isError && !kindData;
  const noun = NOUNS[kind];

  function chooseKind(next: Kind) {
    if (next === kind) return;
    setKind(next);
    // Price scales differ between kinds of places; the other filters carry over.
    setRefine((current) => ({ ...current, price: 0 }));
    setShown(PAGE);
  }

  function changeRefine(change: Partial<Refine>) {
    setRefine((current) => ({ ...current, ...change }));
    setShown(PAGE);
  }

  function clearRefine() {
    setRefine(NO_REFINE);
    setShown(PAGE);
  }

  const chips = <KindChips kind={kind} totals={totals} onChoose={chooseKind} />;

  const openSwitch = (
    <button
      type="button"
      className="switch"
      aria-pressed={refine.open}
      aria-label="Open now"
      onClick={() => changeRefine({ open: !refine.open })}
    >
      <span className="switch-track" aria-hidden="true" />
    </button>
  );

  const ratingSeg = (
    <Seg
      label="Minimum rating"
      value={refine.rating}
      options={[
        { value: 0, label: 'Any rating' },
        {
          value: 4,
          label: (
            <>
              <Icon name="star" size={12} className="star" />
              4.0+
            </>
          ),
        },
        {
          value: 4.5,
          label: (
            <>
              <Icon name="star" size={12} className="star" />
              4.5+
            </>
          ),
        },
      ]}
      onChange={(rating) => changeRefine({ rating })}
    />
  );

  const priceSeg = (
    <Seg
      label="Price"
      value={refine.price}
      options={[0, 1, 2, 3].map((level) => ({
        value: level,
        label: level === 0 ? 'Any price' : priceMarks(level, city.currency_symbol),
      }))}
      onChange={(price) => changeRefine({ price })}
    />
  );

  const moreCount = Math.max(0, list.length - shown);
  const more = !loading && moreCount > 0 && (
    <button type="button" className="btn btn-secondary more-btn" onClick={() => setShown((value) => value + PAGE)}>
      Show {Math.min(PAGE, moreCount)} more
    </button>
  );

  const partial = !loading && kind !== 'gym' && kind !== 'park' && kind !== 'laundry' && coreData?.partial && (
    <p className="pl-note">Some kinds of places didn&apos;t load, so this list may be missing a few.</p>
  );

  const countText = loading
    ? `Finding ${noun}…`
    : list.length === 1
      ? '1 place'
      : `${list.length} places`;

  // What the list shows instead of rows: loading, failed, nothing here, or nothing matching.
  let state: ReactNode = null;
  if (loading) {
    state = <SkeletonRows count={phone ? 4 : 6} />;
  } else if (failed) {
    state = (
      <EmptyState
        icon={<Icon name="alert" size={22} />}
        title={`${capitalize(noun)} didn't load`}
        text="Google didn't answer in time. Everything else on this page still works."
      >
        <button type="button" className="btn btn-secondary" onClick={() => void query.refetch()}>
          <Icon name="refresh" size={16} />
          Try again
        </button>
      </EmptyState>
    );
  } else if (pool.length === 0) {
    state = (
      <EmptyState
        icon={<Icon name={placeKind(kind).icon} size={22} />}
        title={`No ${noun} found in ${city.name}`}
        text="Results stay inside the city's limits, so smaller places can have only a few, or none."
      />
    );
  } else if (list.length === 0) {
    state = (
      <EmptyState
        icon={<Icon name="search" size={22} />}
        title={`No ${noun} match these filters`}
        text={
          active.open
            ? `It's ${fmtClock(minute)} in ${city.name}. Try turning off Open now or lowering the rating.`
            : 'Try a lower rating or any price.'
        }
      >
        <button type="button" className="btn btn-secondary" onClick={clearRefine}>
          Clear filters
        </button>
      </EmptyState>
    );
  }

  const head = (
    <SecHead
      id="places-title"
      icon={<Icon name="pin" size={16} />}
      kicker="Places"
      title="Places to work, eat and live"
      lede={`Coffee shops, coworking spaces and restaurants inside ${city.name}, with opening hours in local time. Gyms, parks and laundry load when you pick them.`}
    />
  );
  const foot = (
    <p className="pl-foot">
      Place data © Google. Results stay inside {city.name}&apos;s city limits.
    </p>
  );

  const shared = {
    loading,
    city,
    units,
    zone,
    list,
    pins,
    states,
    shown,
    state,
    more,
    chips,
    partial,
    foot,
    countText,
    minute,
  };

  return (
    <section className="sec" data-sec="places" id="places" aria-labelledby="places-title" ref={sectionRef}>
      <div className="wrap">
        {head}
        {core.isError && !coreData && kind === 'all' ? (
          <SectionError title="Places didn't load" error={core.error} onRetry={() => void core.refetch()} />
        ) : phone ? (
          <PhonePlaces
            {...shared}
            kind={kind}
            sectionRef={sectionRef}
            refineCount={refineCount}
            filters={
              <>
                {hasHours && (
                  <div className="sheet-row">
                    <div>
                      <b className="sheet-row-title">Open now</b>
                      <div className="hint">
                        At {fmtClock(minute)} {city.name} time
                      </div>
                    </div>
                    {openSwitch}
                  </div>
                )}
                <div>
                  <span className="field-label">Minimum rating</span>
                  {ratingSeg}
                </div>
                {hasPrices && (
                  <div>
                    <span className="field-label">Price</span>
                    {priceSeg}
                  </div>
                )}
              </>
            }
            onClear={clearRefine}
          />
        ) : (
          <DeskPlaces
            {...shared}
            kind={kind}
            openNow={active.open}
            refine={
              <DeskFilters count={refineCount} onClear={clearRefine}>
                {hasHours && (
                  <div className="sheet-row">
                    <div>
                      <b className="sheet-row-title">Open now</b>
                      <div className="hint">
                        At {fmtClock(minute)} {city.name} time
                      </div>
                    </div>
                    {openSwitch}
                  </div>
                )}
                <div>
                  <span className="field-label">Minimum rating</span>
                  {ratingSeg}
                </div>
                {hasPrices && (
                  <div>
                    <span className="field-label">Price</span>
                    {priceSeg}
                  </div>
                )}
              </DeskFilters>
            }
            onShow={setShown}
          />
        )}
      </div>
    </section>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const MAIN_KINDS = PLACE_KINDS.filter((item) => !item.extra);
const EXTRA_KINDS = PLACE_KINDS.filter((item) => item.extra);

/** The three everyday kinds of place as chips; gyms, parks and laundry sit behind More. */
function KindChips({
  kind,
  totals,
  onChoose,
}: {
  kind: Kind;
  totals: Partial<Record<Kind, number>>;
  onChoose: (kind: Kind) => void;
}) {
  const moreButton = useRef<HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const extra = EXTRA_KINDS.find((item) => item.key === kind);

  function choose(next: Kind) {
    setMoreOpen(false);
    onChoose(next);
  }

  return (
    <div className="chip-row" role="group" aria-label="Kind of place">
      {MAIN_KINDS.map((item) => {
        const total = totals[item.key];
        return (
          <button
            key={item.key}
            type="button"
            className="chip"
            aria-pressed={kind === item.key}
            // A kind with nothing in it can't be picked, so no one lands on an empty list.
            disabled={total === 0 && kind !== item.key}
            onClick={() => choose(item.key)}
          >
            {item.key !== 'all' && <span className={`dot dot-${item.key}`} aria-hidden="true" />}
            {item.label}
            {total !== undefined && <span className="n">{total}</span>}
          </button>
        );
      })}
      <button
        type="button"
        className="chip"
        ref={moreButton}
        aria-pressed={!!extra}
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((open) => !open)}
      >
        {extra ? (
          <>
            <span className={`dot dot-${extra.key}`} aria-hidden="true" />
            {extra.label}
            {totals[extra.key] !== undefined && <span className="n">{totals[extra.key]}</span>}
          </>
        ) : (
          'More'
        )}
        <Icon name="chevron-down" size={14} />
      </button>
      <Popover open={moreOpen} onClose={() => setMoreOpen(false)} anchor={moreButton} label="More kinds of place">
        <div className="mp-label">Loads when you pick it</div>
        {EXTRA_KINDS.map((item) => (
          <button key={item.key} type="button" aria-pressed={kind === item.key} onClick={() => choose(item.key)}>
            <Icon name={item.icon} size={16} />
            {item.label}
            {totals[item.key] !== undefined && <small>{totals[item.key]}</small>}
          </button>
        ))}
      </Popover>
    </div>
  );
}

/** Desktop: open now, rating and price behind one Filters button. */
function DeskFilters({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary filters-btn"
        ref={button}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="sliders" size={16} />
        Filters
        {count > 0 && (
          <span className="badge">
            {count}
            <span className="sr-only"> on</span>
          </span>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={button} label="Filters" align="right" className="pop filters-pop">
        <div className="filters-body">{children}</div>
        <div className="pop-foot">
          <button type="button" className="btn btn-ghost" onClick={onClear} disabled={count === 0}>
            Clear
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </Popover>
    </>
  );
}

interface Shared {
  loading: boolean;
  city: City;
  units: Units;
  zone: string;
  list: Place[];
  pins: Pinned[];
  states: Map<string, OpenState | null>;
  shown: number;
  /** Replaces the rows while loading, on an error, or when nothing matches. */
  state: ReactNode;
  more: ReactNode;
  chips: ReactNode;
  partial: ReactNode;
  foot: ReactNode;
  countText: string;
  minute: number;
}

/* ---------- Desktop: list beside a live map ---------- */

function DeskPlaces({
  loading,
  city,
  units,
  list,
  pins,
  states,
  shown,
  state,
  more,
  chips,
  partial,
  foot,
  countText,
  minute,
  kind,
  openNow,
  refine,
  onShow,
}: Shared & { kind: Kind; openNow: boolean; refine: ReactNode; onShow: (shown: number) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [byKeyboard, setByKeyboard] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const pendingRow = useRef<string | null>(null);
  const [mapRef, near] = useNear<HTMLDivElement>();
  // The card closes by itself when its place is filtered out.
  const focus = pins.find((pin) => pin.id === focusId) ?? null;
  const hot = hover ?? focus?.id ?? null;

  // A pin picked on the map scrolls its row into view, once the row exists.
  useEffect(() => {
    const id = pendingRow.current;
    const box = scroller.current;
    if (!id || !box) return;
    pendingRow.current = null;
    const row = box.querySelector<HTMLElement>(`[data-pid="${CSS.escape(id)}"]`);
    if (!row) return;
    const boxRect = box.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    if (rowRect.top >= boxRect.top && rowRect.bottom <= boxRect.bottom) return;
    box.scrollTo({ top: Math.max(0, box.scrollTop + rowRect.top - boxRect.top - 8), behavior: scrollBehavior() });
  }, [focusId, shown]);

  function pickRow(event: MouseEvent, id: string) {
    setByKeyboard(event.detail === 0);
    setFocusId(id);
  }

  function pickPin(id: string) {
    setByKeyboard(false);
    setFocusId(id);
    const index = list.findIndex((place) => place.id === id);
    if (index >= shown) onShow(Math.ceil((index + 1) / PAGE) * PAGE);
    pendingRow.current = id;
  }

  function closeCard() {
    const id = focusId;
    setFocusId(null);
    if (byKeyboard && id) {
      scroller.current?.querySelector<HTMLElement>(`[data-pid="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    }
  }

  return (
    <>
      <div className="pl-filters">
        {chips}
        {refine}
      </div>
      {partial}
      <div className="split">
        <div className="split-list">
          <div className="split-head">
            <span aria-live="polite">
              {loading ? (
                countText
              ) : (
                <>
                  <b>{countText}</b>
                  <span className="sep">by rating</span>
                </>
              )}
            </span>
            <span>{openNow ? `Open at ${fmtClock(minute)}` : `${city.name} city limits`}</span>
          </div>
          <div className="split-scroll" ref={scroller}>
            {state ??
              list.slice(0, shown).map((place) => (
                <PlaceRow
                  key={place.id}
                  place={place}
                  city={city}
                  units={units}
                  state={states.get(place.id) ?? null}
                  hot={hot === place.id}
                  onClick={(event) => pickRow(event, place.id)}
                  onHover={setHover}
                />
              ))}
            {more}
          </div>
        </div>
        {near ? (
          <CityMap
            label={`Map of ${NOUNS[kind]} in ${city.name}`}
            lat={city.lat}
            lng={city.lng}
            pins={pins}
            hot={hot}
            onPin={pickPin}
            onHover={setHover}
            onBackground={() => setFocusId(null)}
            fitKey={kind}
            padding={DESK_PADDING}
            focus={focus}
            focusCard={byKeyboard}
            card={
              focus && (
                <MapCard place={focus} city={city} state={states.get(focus.id) ?? null} onClose={closeCard} />
              )
            }
          />
        ) : (
          <div className="map" ref={mapRef} />
        )}
      </div>
      {foot}
    </>
  );
}

/** Mounts the map only once the section comes near the screen, so mapbox-gl isn't loaded for nothing. */
function useNear<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const node = ref.current;
    if (near || !node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);
  return [ref, near] as const;
}

/** The card that opens on the map for a place picked in the list or on a pin. */
function MapCard({
  place,
  city,
  state,
  onClose,
}: {
  place: Pinned;
  city: City;
  state: OpenState | null;
  onClose: () => void;
}) {
  const kind = placeKind(place.type);
  const price = place.price_level ? priceMarks(place.price_level, city.currency_symbol) : null;

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  }

  return (
    <div className="mc" onKeyDown={onKeyDown}>
      <h4>{place.name}</h4>
      <p>
        {kind.one}
        {price && ` · ${price}`}
        <span className="sep">{shortAddress(place.address)}</span>
      </p>
      {(place.rating !== null || state) && (
        <p>
          {place.rating !== null && <Rating place={place} />}
          {state && (
            <span className={`${place.rating !== null ? 'sep ' : ''}${state.open ? 'open' : 'closed'}`}>
              {keepTimeTogether(state.label)}
            </span>
          )}
        </p>
      )}
      <div className="acts">
        <a className="btn btn-primary" href={directionsUrl(place)} target="_blank" rel="noopener noreferrer">
          <Icon name="directions" size={15} />
          Directions
        </a>
        {place.website && (
          <a className="btn btn-secondary" href={place.website} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={15} />
            Website
          </a>
        )}
      </div>
      <button type="button" className="icon-btn x" onClick={onClose} aria-label="Close">
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

function Rating({ place, size = 13 }: { place: Place; size?: number }) {
  if (place.rating === null) return null;
  return (
    <span className="rating">
      <Icon name="star" size={size} className="star" />
      {place.rating.toFixed(1)}
      {place.user_ratings_total > 0 && (
        <small>
          ({place.user_ratings_total.toLocaleString('en-US')}
          <span className="sr-only"> reviews</span>)
        </small>
      )}
    </span>
  );
}

function PlaceRow({
  place,
  city,
  units,
  state,
  hot,
  phone = false,
  onClick,
  onHover,
}: {
  place: Place;
  city: City;
  units: Units;
  state: OpenState | null;
  hot: boolean;
  phone?: boolean;
  onClick: (event: MouseEvent) => void;
  onHover?: (id: string | null) => void;
}) {
  const kind = placeKind(place.type);
  const price = place.price_level ? priceMarks(place.price_level, city.currency_symbol) : null;
  const distance = distanceLabel(city, place, units);
  return (
    <button
      type="button"
      className={`place${hot ? ' is-hot' : ''}`}
      data-pid={place.id}
      style={cssVars({ '--tint': `var(--pin-${place.type})` })}
      onClick={onClick}
      onMouseEnter={onHover && (() => onHover(place.id))}
      onMouseLeave={onHover && (() => onHover(null))}
    >
      <span className="tile">
        <Icon name={kind.icon} size={20} />
      </span>
      <span>
        <span className="place-name">{place.name}</span>
        <span className="place-meta">
          <Rating place={place} />
          <span className={place.rating !== null ? 'sep' : undefined}>{kind.one}</span>
          {price && <span className="sep">{price}</span>}
        </span>
        <span className="place-meta2">
          {state && <span className={state.open ? 'open' : 'closed'}>{keepTimeTogether(state.label)}</span>}
          <span className={state ? 'addr sep' : 'addr'}>{shortAddress(place.address)}</span>
          {distance && (
            <span className="sep">
              {distance}
              <span className="sr-only"> from the center</span>
            </span>
          )}
        </span>
      </span>
      {!phone && (
        <span className="place-go" aria-hidden="true">
          <Icon name="chevron-right" size={18} />
        </span>
      )}
    </button>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="place place-skel" aria-hidden="true">
          <span className="skel" />
          <span className="pk-lines">
            <span className={`skel sk-line w${index % 4}`} />
            <span className={`skel sk-line w${(index + 2) % 4}`} />
          </span>
        </div>
      ))}
    </>
  );
}

/* ---------- Phones: a list, a filters sheet and a full-screen map ---------- */

function PhonePlaces({
  city,
  units,
  list,
  pins,
  states,
  shown,
  state,
  more,
  chips,
  partial,
  foot,
  countText,
  kind,
  sectionRef,
  refineCount,
  filters,
  onClear,
}: Shared & {
  kind: Kind;
  sectionRef: RefObject<HTMLElement | null>;
  refineCount: number;
  filters: ReactNode;
  onClear: () => void;
}) {
  const layer = useLayerElement();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapHot, setMapHot] = useState<string | null>(null);
  const [fabOn, setFabOn] = useState(false);
  const hot = pins.some((pin) => pin.id === mapHot) ? mapHot : (pins[0]?.id ?? null);

  // The Map button shows while the places section fills the middle of the screen.
  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const node = sectionRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const height = window.innerHeight;
      setFabOn(rect.top < height * 0.6 && rect.bottom > height * 0.4);
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sectionRef]);

  function openMap(id: string | null) {
    setMapHot(id);
    setMapOpen(true);
  }

  const fab = fabOn && !mapOpen && !filtersOpen && pins.length > 0;
  const countLabel = state ? countText : `${countText}, best rated first`;

  return (
    <>
      {chips}
      <div className="sheet-row pl-count">
        <span className="label" aria-live="polite">
          {countLabel}
        </span>
        <button
          type="button"
          className="btn btn-ghost filters-btn"
          aria-haspopup="dialog"
          onClick={() => setFiltersOpen(true)}
        >
          <Icon name="sliders" size={18} />
          Filters
          {refineCount > 0 && (
            <span className="badge">
              {refineCount}
              <span className="sr-only"> on</span>
            </span>
          )}
        </button>
      </div>
      {partial}
      <div className="p-list">
        {state ??
          list.slice(0, shown).map((place) => (
            <PlaceRow
              key={place.id}
              place={place}
              city={city}
              units={units}
              state={states.get(place.id) ?? null}
              hot={false}
              phone
              onClick={() => openMap(hasCoords(place) ? place.id : null)}
            />
          ))}
      </div>
      {more}
      {foot}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} label="Filters">
        <SheetHead title="Filters" onClose={() => setFiltersOpen(false)} />
        <div className="sheet-body">{filters}</div>
        <div className="sheet-foot">
          <button type="button" className="btn btn-secondary" onClick={onClear}>
            Clear
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setFiltersOpen(false)}>
            Show {list.length} {list.length === 1 ? 'place' : 'places'}
          </button>
        </div>
      </Sheet>

      <PhoneMap
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        city={city}
        units={units}
        kind={kind}
        pins={pins}
        states={states}
        hot={hot}
        onHot={setMapHot}
        refineCount={refineCount}
        onFilters={() => setFiltersOpen(true)}
      />

      {layer &&
        createPortal(
          <button
            type="button"
            className={`fab${fab ? ' is-on' : ''}`}
            tabIndex={fab ? 0 : -1}
            aria-hidden={!fab}
            onClick={() => openMap(null)}
          >
            <Icon name="map" size={18} />
            Map
          </button>,
          layer,
        )}
    </>
  );
}

function PhoneMap({
  open,
  onClose,
  city,
  units,
  kind,
  pins,
  states,
  hot,
  onHot,
  refineCount,
  onFilters,
}: {
  open: boolean;
  onClose: () => void;
  city: City;
  units: Units;
  kind: Kind;
  pins: Pinned[];
  states: Map<string, OpenState | null>;
  hot: string | null;
  onHot: (id: string) => void;
  refineCount: number;
  onFilters: () => void;
}) {
  const layer = useLayerElement();
  const { mounted, shown } = usePresence(open);
  const panel = useRef<HTMLDivElement>(null);
  const cards = useRef<HTMLDivElement>(null);
  const placed = useRef(false);
  // A programmatic scroll of the cards shouldn't pick a different place when it settles.
  const quietUntil = useRef(0);
  const settleTimer = useRef(0);
  useScrollLock(open);
  useDialogFocus(panel, open && mounted, onClose);

  // When the map opens, the cards start at the place that was tapped.
  useLayoutEffect(() => {
    if (!mounted) {
      placed.current = false;
      return;
    }
    if (placed.current) return;
    placed.current = true;
    const strip = cards.current;
    const card = hot && strip?.querySelector<HTMLElement>(`[data-pid="${CSS.escape(hot)}"]`);
    if (strip && card) strip.scrollLeft = card.offsetLeft - 16;
  }, [mounted, hot]);

  function scrollToCard(id: string) {
    const strip = cards.current;
    const card = strip?.querySelector<HTMLElement>(`[data-pid="${CSS.escape(id)}"]`);
    if (!strip || !card) return;
    quietUntil.current = performance.now() + 700;
    strip.scrollTo({ left: card.offsetLeft - 16, behavior: scrollBehavior() });
  }

  function pick(id: string) {
    onHot(id);
    scrollToCard(id);
  }

  // After a swipe settles, the first card fully in view becomes the highlighted pin.
  function settle() {
    const strip = cards.current;
    if (!strip || performance.now() < quietUntil.current) return;
    const box = strip.getBoundingClientRect();
    const fits = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= box.left - 2 && rect.right <= box.right + 2;
    };
    const all = Array.from(strip.querySelectorAll<HTMLElement>('.mcard[data-pid]'));
    const current = all.find((element) => element.dataset.pid === hot);
    if (current && fits(current)) return;
    const first = all.find(fits)?.dataset.pid;
    if (first) onHot(first);
  }

  function onCardsScroll() {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, 120);
  }

  if (!layer || !mounted) return null;
  const title = kind === 'all' ? 'All places' : placeKind(kind).label;
  return createPortal(
    <div
      className={`mapview${shown ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Map of ${NOUNS[kind]} in ${city.name}`}
      ref={panel}
    >
      <CityMap
        label={`Map of ${NOUNS[kind]} in ${city.name}`}
        lat={city.lat}
        lng={city.lng}
        pins={pins}
        hot={hot}
        onPin={pick}
        fitKey={kind}
        padding={PHONE_PADDING}
        followHot
        cooperative={false}
        controls={false}
      />
      <div className="mapview-top">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to the list">
          <Icon name="chevron-left" size={22} />
        </button>
        <div className="mapview-title">
          {title}
          <span>{pins.length} shown</span>
        </div>
        <button type="button" className="icon-btn filters-icon" onClick={onFilters} aria-label="Filters">
          <Icon name="sliders" size={20} />
          {refineCount > 0 && <span className="badge-dot" aria-hidden="true" />}
        </button>
      </div>
      <div className="mapview-cards">
        <div className="hscroll" ref={cards} onScroll={onCardsScroll}>
          {pins.map((place) => (
            <MapViewCard
              key={place.id}
              place={place}
              city={city}
              units={units}
              state={states.get(place.id) ?? null}
              hot={place.id === hot}
              onPick={() => pick(place.id)}
            />
          ))}
        </div>
      </div>
    </div>,
    layer,
  );
}

function MapViewCard({
  place,
  city,
  units,
  state,
  hot,
  onPick,
}: {
  place: Pinned;
  city: City;
  units: Units;
  state: OpenState | null;
  hot: boolean;
  onPick: () => void;
}) {
  const kind = placeKind(place.type);
  const distance = distanceLabel(city, place, units);
  return (
    <div
      className={`mcard${hot ? ' is-hot' : ''}`}
      data-pid={place.id}
      style={cssVars({ '--tint': `var(--pin-${place.type})` })}
    >
      <button type="button" className="mcard-hit" aria-label={`Show ${place.name} on the map`} onClick={onPick} />
      <span className="tile">
        <Icon name={kind.icon} size={20} />
      </span>
      <span className="mcard-text">
        <span className="place-name">{place.name}</span>
        <span className="place-meta">
          <Rating place={place} size={12} />
          <span className={place.rating !== null ? 'sep' : undefined}>{kind.one}</span>
        </span>
        <span className="place-meta">
          {state && <span className={state.open ? 'open' : 'closed'}>{keepTimeTogether(state.label)}</span>}
          {distance && <span className={state ? 'sep' : undefined}>{distance}</span>}
        </span>
      </span>
      <span className="mcard-acts">
        <a className="btn btn-primary" href={directionsUrl(place)} target="_blank" rel="noopener noreferrer">
          <Icon name="directions" size={15} />
          Directions
        </a>
        {place.website && (
          <a className="btn btn-secondary" href={place.website} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={15} />
            Website
          </a>
        )}
      </span>
    </div>
  );
}

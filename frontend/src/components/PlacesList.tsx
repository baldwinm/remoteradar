import { useMemo, useState } from 'react';

import type { ExtraPlaceType, Place, PlaceType } from '../api/types';
import { PRICE_LEVEL_LABELS } from '../lib/format';
import { openState } from '../lib/time';
import Icon, { type IconName, Star } from './Icon';
import Pagination from './Pagination';
import './PlacesList.css';

const PER_PAGE = 5;

export type PlaceFilter = PlaceType | 'all';

const FILTERS: { value: PlaceFilter; label: string; icon?: IconName }[] = [
  { value: 'all', label: 'All' },
  { value: 'coffee', label: 'Coffee', icon: 'coffee' },
  { value: 'coworking', label: 'Coworking', icon: 'desk' },
  { value: 'restaurant', label: 'Restaurants', icon: 'food' },
  { value: 'gym', label: 'Gyms', icon: 'gym' },
  { value: 'park', label: 'Parks', icon: 'park' },
  { value: 'laundry', label: 'Laundry', icon: 'laundry' },
];

export const EXTRA_TYPES: readonly ExtraPlaceType[] = ['gym', 'park', 'laundry'];
export const isExtraType = (value: PlaceFilter): value is ExtraPlaceType =>
  (EXTRA_TYPES as readonly string[]).includes(value);

const PLACE_ICONS: Record<PlaceType, IconName> = {
  coffee: 'coffee',
  coworking: 'desk',
  restaurant: 'food',
  gym: 'gym',
  park: 'park',
  laundry: 'laundry',
};
const TYPE_LABELS: Record<PlaceType, string> = {
  coffee: 'Coffee',
  coworking: 'Coworking',
  restaurant: 'Restaurant',
  gym: 'Gym',
  park: 'Park',
  laundry: 'Laundry',
};
const RATINGS = [
  { value: 0, label: 'Any rating' },
  { value: 4, label: '4.0+' },
  { value: 4.5, label: '4.5+' },
];

interface Props {
  /** Coffee, coworking and restaurants, plus any gyms, parks or laundromats loaded so far. */
  places: Place[];
  partial?: boolean;
  titleId?: string;
  /** The city's time zone, for "Open now". */
  timeZone?: string;
  /** Controlled category; omit to let the list manage it. */
  filter?: PlaceFilter;
  onFilterChange?: (filter: PlaceFilter) => void;
  /** Loading state of the on-demand category currently selected. */
  extraStatus?: 'pending' | 'error' | 'success';
}

export default function PlacesList({
  places,
  partial = false,
  titleId,
  timeZone = '',
  filter: controlledFilter,
  onFilterChange,
  extraStatus = 'success',
}: Props) {
  const [ownFilter, setOwnFilter] = useState<PlaceFilter>('all');
  const filter = controlledFilter ?? ownFilter;
  const [priceLevel, setPriceLevel] = useState<number | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [openNow, setOpenNow] = useState(false);
  const [page, setPage] = useState(1);

  // Worked out once per render so every row agrees on "now".
  const openStates = useMemo(() => {
    const now = new Date();
    return new Map(places.map((place) => [place.id, openState(place.opening_hours, timeZone, now)]));
  }, [places, timeZone]);

  const inCategory = useMemo(
    () => places.filter((place) => (filter === 'all' ? !isExtraType(place.type) : place.type === filter)),
    [places, filter],
  );
  const hasPrices = inCategory.some((place) => place.price_level !== null);
  const hasHours = inCategory.some((place) => openStates.get(place.id));

  const filtered = useMemo(
    () =>
      inCategory.filter(
        (place) =>
          (priceLevel === null || place.price_level === priceLevel) &&
          (place.rating ?? 0) >= minRating &&
          (!openNow || openStates.get(place.id)?.open),
      ),
    [inCategory, priceLevel, minRating, openNow, openStates],
  );

  const totals = useMemo(() => {
    const counts: Partial<Record<PlaceFilter, number>> = { all: 0 };
    for (const place of places) {
      counts[place.type] = (counts[place.type] ?? 0) + 1;
      if (!isExtraType(place.type)) counts.all = (counts.all ?? 0) + 1;
    }
    return counts;
  }, [places]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const loadingExtra = isExtraType(filter) && extraStatus !== 'success';

  function chooseFilter(value: PlaceFilter) {
    setOwnFilter(value);
    onFilterChange?.(value);
    setPriceLevel(null);
    setPage(1);
  }

  return (
    <div className="places">
      <div className="card-head">
        <h2 id={titleId}>Places to work, eat and live</h2>
        {!loadingExtra && (
          <span className="card-meta">{filtered.length === 1 ? '1 place' : `${filtered.length} places`}</span>
        )}
      </div>

      <div className="places-filters">
        <div className="chip-row" role="group" aria-label="Filter places">
          {FILTERS.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={filter === value}
              onClick={() => chooseFilter(value)}
            >
              {icon && <Icon name={icon} size={15} />}
              {label}
              {totals[value] !== undefined && (
                <span className="count" aria-hidden="true">
                  {totals[value]}
                </span>
              )}
            </button>
          ))}
        </div>

        {!loadingExtra && (hasHours || hasPrices || inCategory.length > 0) && (
          <div className="refine-row">
            {hasHours && (
              <button
                type="button"
                className="toggle"
                aria-pressed={openNow}
                onClick={() => {
                  setOpenNow(!openNow);
                  setPage(1);
                }}
              >
                <span className="toggle-track" aria-hidden="true" />
                Open now
              </button>
            )}
            <label className="refine-control">
              <span className="visually-hidden">Minimum rating</span>
              <select
                id="places-rating"
                className="select"
                value={minRating}
                onChange={(event) => {
                  setMinRating(Number(event.target.value));
                  setPage(1);
                }}
              >
                {RATINGS.map((rating) => (
                  <option key={rating.value} value={rating.value}>
                    {rating.label}
                  </option>
                ))}
              </select>
            </label>
            {hasPrices && (
              <div className="segmented" role="group" aria-label="Budget">
                {[null, 1, 2, 3, 4].map((level) => (
                  <button
                    key={level ?? 'all'}
                    type="button"
                    aria-pressed={priceLevel === level}
                    onClick={() => {
                      setPriceLevel(level);
                      setPage(1);
                    }}
                  >
                    {level === null ? 'Any' : PRICE_LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {partial && !isExtraType(filter) && (
        <p className="places-note">Some categories couldn't be loaded right now, so this list may be incomplete.</p>
      )}

      {loadingExtra ? (
        extraStatus === 'error' ? (
          <div className="widget-error">These places couldn't be loaded right now. Try again in a moment.</div>
        ) : (
          <div className="widget-loading">
            <div className="loading-spinner" aria-hidden="true" />
            <p>Finding {TYPE_LABELS[filter as PlaceType].toLowerCase()} spots…</p>
          </div>
        )
      ) : filtered.length === 0 ? (
        <p className="widget-empty">
          {inCategory.length === 0 ? 'No places found for this location.' : 'No places match these filters.'}
        </p>
      ) : (
        <>
          <ul className="places-list">
            {visible.map((place) => {
              const state = openStates.get(place.id);
              return (
                <li key={place.id} className="place">
                  <span className="icon-tile">
                    <Icon name={PLACE_ICONS[place.type]} />
                  </span>
                  <div className="place-details">
                    <h3 className="place-name">
                      <a href={place.website ?? place.maps_url} target="_blank" rel="noopener noreferrer">
                        {place.name}
                      </a>
                    </h3>
                    <p className="place-address">{place.address}</p>
                    <div className="place-meta">
                      {place.rating !== null && (
                        <span className="place-rating">
                          <Star />
                          {place.rating.toFixed(1)}
                          {place.user_ratings_total > 0 && (
                            <span className="rating-count">({place.user_ratings_total.toLocaleString()})</span>
                          )}
                        </span>
                      )}
                      <span className="pill">
                        {TYPE_LABELS[place.type]}
                        {place.price_level !== null ? ` · ${PRICE_LEVEL_LABELS[place.price_level]}` : ''}
                      </span>
                      {state && <span className={state.open ? 'open-state open' : 'open-state'}>{state.label}</span>}
                      {place.phone && (
                        <a href={`tel:${place.phone.replace(/[^\d+]/g, '')}`} className="place-phone">
                          {place.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <a href={place.maps_url} target="_blank" rel="noopener noreferrer" className="place-directions">
                    Map <Icon name="arrow" size={14} />
                  </a>
                </li>
              );
            })}
          </ul>
          <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
      <div className="card-foot">
        <span>Place data © Google. Gyms, parks and laundry load when you pick them.</span>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';

import type { Place, PlaceType } from '../api/types';
import { PRICE_LEVEL_LABELS } from '../lib/format';
import Icon, { type IconName, Star } from './Icon';
import Pagination from './Pagination';
import './PlacesList.css';

const PER_PAGE = 5;

const FILTERS: { value: PlaceType | 'all'; label: string; icon?: IconName }[] = [
  { value: 'all', label: 'All' },
  { value: 'coffee', label: 'Coffee', icon: 'coffee' },
  { value: 'coworking', label: 'Coworking', icon: 'desk' },
  { value: 'restaurant', label: 'Restaurants', icon: 'food' },
];

const PLACE_ICONS: Record<PlaceType, IconName> = { coffee: 'coffee', coworking: 'desk', restaurant: 'food' };
const TYPE_LABELS: Record<PlaceType, string> = { coffee: 'Coffee', coworking: 'Coworking', restaurant: 'Restaurant' };

interface Props {
  places: Place[];
  partial?: boolean;
  titleId?: string;
}

export default function PlacesList({ places, partial = false, titleId }: Props) {
  const [filter, setFilter] = useState<PlaceType | 'all'>('all');
  const [priceLevel, setPriceLevel] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      places.filter(
        (place) =>
          (filter === 'all' || place.type === filter) &&
          (filter !== 'restaurant' || priceLevel === null || place.price_level === priceLevel),
      ),
    [places, filter, priceLevel],
  );

  const totals = useMemo(() => {
    const counts: Record<PlaceType | 'all', number> = { all: places.length, coffee: 0, coworking: 0, restaurant: 0 };
    for (const place of places) counts[place.type] += 1;
    return counts;
  }, [places]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  function chooseFilter(value: PlaceType | 'all') {
    setFilter(value);
    setPriceLevel(null);
    setPage(1);
  }

  return (
    <div className="places">
      <div className="card-head">
        <h2 id={titleId}>Places to work and eat</h2>
        <span className="card-meta">{filtered.length === 1 ? '1 place' : `${filtered.length} places`}</span>
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
              <span className="count" aria-hidden="true">
                {totals[value]}
              </span>
            </button>
          ))}
        </div>

        {filter === 'restaurant' && (
          <div className="price-filter">
            <span className="price-filter-label">Budget</span>
            <div className="segmented" role="group" aria-label="Restaurant budget">
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
          </div>
        )}
      </div>

      {partial && (
        <p className="places-note">Some categories couldn't be loaded right now, so this list may be incomplete.</p>
      )}

      {filtered.length === 0 ? (
        <p className="widget-empty">
          {places.length === 0 ? 'No places found for this location.' : 'No places match this filter.'}
        </p>
      ) : (
        <>
          <ul className="places-list">
            {visible.map((place) => (
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
                      {place.type === 'restaurant' && place.price_level !== null
                        ? ` · ${PRICE_LEVEL_LABELS[place.price_level]}`
                        : ''}
                    </span>
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
            ))}
          </ul>
          <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
      <div className="card-foot">
        <span>Place data © Google</span>
      </div>
    </div>
  );
}

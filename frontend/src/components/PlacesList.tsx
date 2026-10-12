import { useMemo, useState } from 'react';

import type { Place, PlaceType } from '../api/types';
import { PRICE_LEVEL_LABELS } from '../lib/format';
import Pagination from './Pagination';
import './PlacesList.css';

const PER_PAGE = 5;

const FILTERS: { value: PlaceType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'coworking', label: 'Coworking' },
  { value: 'restaurant', label: 'Restaurants' },
];

const ICONS: Record<PlaceType, string> = { coffee: '☕', coworking: '💻', restaurant: '🍽️' };

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  return (
    <span className="stars" aria-hidden="true">
      {'★'.repeat(full)}
      {rating - full >= 0.5 && <span className="star-half">★</span>}
    </span>
  );
}

interface Props {
  places: Place[];
  partial?: boolean;
}

export default function PlacesList({ places, partial = false }: Props) {
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  function chooseFilter(value: PlaceType | 'all') {
    setFilter(value);
    setPriceLevel(null);
    setPage(1);
  }

  return (
    <section className="places-container">
      <div className="places-header">
        <h3>Local Amenities</h3>
        <div className="filter-tabs" role="group" aria-label="Filter places">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`filter-tab${filter === value ? ' active' : ''}`}
              aria-pressed={filter === value}
              onClick={() => chooseFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {filter === 'restaurant' && (
          <div className="price-filter-container">
            <div className="price-filter-label">Budget:</div>
            <div className="price-filter-buttons" role="group" aria-label="Restaurant budget">
              {[null, 1, 2, 3, 4].map((level) => (
                <button
                  key={level ?? 'all'}
                  type="button"
                  className={`price-filter-btn${priceLevel === level ? ' active' : ''}`}
                  aria-pressed={priceLevel === level}
                  onClick={() => {
                    setPriceLevel(level);
                    setPage(1);
                  }}
                >
                  {level === null ? 'All' : PRICE_LEVEL_LABELS[level]}
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
        <p className="no-places-message">
          {places.length === 0 ? 'No places found for this location.' : 'No places match this filter.'}
        </p>
      ) : (
        <>
          <p className="results-info">Found {filtered.length} places</p>
          <ul className="places-list">
            {visible.map((place) => (
              <li key={place.id} className="place-item">
                <div className="place-icon" aria-hidden="true">
                  {ICONS[place.type]}
                </div>
                <div className="place-details">
                  <div className="place-header">
                    <h4 className="place-name">
                      <a
                        href={place.website ?? place.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="place-link"
                      >
                        {place.name}
                      </a>
                    </h4>
                    {place.type === 'restaurant' && place.price_level !== null && (
                      <span className="price-level">{PRICE_LEVEL_LABELS[place.price_level]}</span>
                    )}
                  </div>
                  <p className="place-address">{place.address}</p>
                  {place.rating !== null && (
                    <div className="place-rating">
                      <Stars rating={place.rating} />
                      <span className="rating-value">{place.rating.toFixed(1)}</span>
                      {place.user_ratings_total > 0 && (
                        <span className="rating-count">({place.user_ratings_total.toLocaleString()})</span>
                      )}
                    </div>
                  )}
                  <div className="place-links">
                    {place.phone && (
                      <a href={`tel:${place.phone.replace(/[^\d+]/g, '')}`} className="place-phone-link">
                        {place.phone}
                      </a>
                    )}
                    <div className="external-links">
                      {place.website && (
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link website-link"
                        >
                          Website
                        </a>
                      )}
                      <a
                        href={place.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link maps-link"
                      >
                        View on Maps
                      </a>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
      <p className="places-attribution">Place data © Google</p>
    </section>
  );
}

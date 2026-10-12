import { useMemo, useState } from 'react';

import { useStays } from '../api/queries';
import type { Stay } from '../api/types';
import { formatMoney } from '../lib/format';
import Pagination from './Pagination';
import './StaysWidget.css';

const PER_PAGE = 3;

type SortOrder = 'price_asc' | 'price_desc' | 'rating_desc';

const SORTERS: Record<SortOrder, (a: Stay, b: Stay) => number> = {
  price_asc: (a, b) => (a.price_per_night ?? Infinity) - (b.price_per_night ?? Infinity),
  price_desc: (a, b) => (b.price_per_night ?? -Infinity) - (a.price_per_night ?? -Infinity),
  rating_desc: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
};

interface Props {
  cityId: string;
  occupants: number;
  onOccupantsChange: (occupants: number) => void;
}

export default function StaysWidget({ cityId, occupants, onOccupantsChange }: Props) {
  const { data, isPending, isError, error, isPlaceholderData } = useStays(cityId, occupants);
  const [sortOrder, setSortOrder] = useState<SortOrder>('price_asc');
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => [...(data?.stays ?? [])].sort(SORTERS[sortOrder]), [data, sortOrder]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visible = sorted.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  return (
    <section className={`stays-container${isPlaceholderData ? ' is-updating' : ''}`} aria-busy={isPlaceholderData}>
      <div className="stays-header">
        <h3 className="stays-title">Accommodation</h3>
        <label className="occupants-control">
          Guests
          <select
            value={occupants}
            onChange={(event) => {
              onOccupantsChange(Number(event.target.value));
              setPage(1);
            }}
          >
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count === 1 ? '1 person' : `${count} people`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isPending ? (
        <div className="widget-loading">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Loading prices…</p>
        </div>
      ) : isError ? (
        <div className="widget-error">Hotel prices are unavailable right now. {error.message}</div>
      ) : sorted.length === 0 ? (
        <p className="stays-empty">No hotels found for this city.</p>
      ) : (
        <>
          <div className="price-display">
            <div className="price-label">Average price per night</div>
            <div className="price-value">{formatMoney(data.average_price, data.currency)}</div>
            <div className="price-note">One night from {data.checkin}, via Booking.com</div>
          </div>

          <div className="sort-controls">
            <label htmlFor="stays-sort">Sort by:</label>
            <select
              id="stays-sort"
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value as SortOrder);
                setPage(1);
              }}
              className="sort-select"
            >
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating_desc">Highest Rated</option>
            </select>
          </div>

          <ul className="property-list">
            {visible.map((stay) => (
              <li key={stay.id} className="property-item">
                {stay.image_url && (
                  <div className="property-image-container">
                    <img src={stay.image_url} alt={stay.title} className="property-image" loading="lazy" />
                  </div>
                )}
                <div className="property-details">
                  <h4 className="property-title">{stay.title}</h4>
                  <div className="property-type">
                    {stay.property_type}
                    {stay.stars ? ` · ${'★'.repeat(Math.round(stay.stars))}` : ''}
                  </div>
                  {stay.rating !== null && (
                    <div className="property-rating">
                      <span className="rating-score">{stay.rating.toFixed(1)}</span>
                      {stay.rating_word && <span className="rating-word">{stay.rating_word}</span>}
                      {stay.review_count > 0 && (
                        <span className="rating-count">({stay.review_count.toLocaleString()} reviews)</span>
                      )}
                    </div>
                  )}
                  {stay.distance_to_center && <div className="property-distance">{stay.distance_to_center}</div>}
                  <div className="property-price">
                    {stay.price_per_night !== null
                      ? `${formatMoney(stay.price_per_night, stay.currency)} / night`
                      : 'Price unavailable'}
                  </div>
                  <div className="property-badges">
                    {stay.is_free_cancellable && <span className="badge">Free cancellation</span>}
                    {stay.has_pool && <span className="badge">Pool</span>}
                  </div>
                  <a href={stay.url} target="_blank" rel="noopener noreferrer" className="property-link">
                    View on Booking.com
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </section>
  );
}

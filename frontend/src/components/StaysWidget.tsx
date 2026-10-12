import { useMemo, useState } from 'react';

import { useStays } from '../api/queries';
import type { Stay } from '../api/types';
import { formatMoney, formatWholeMoney } from '../lib/format';
import Icon from './Icon';
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
    <section
      className={`card stays${isPlaceholderData ? ' is-updating' : ''}`}
      id="stays"
      aria-labelledby="stays-title"
      aria-busy={isPlaceholderData}
    >
      <div className="card-head">
        <h2 id="stays-title">Where to stay</h2>
        {data && <span className="card-meta">From {data.checkin}, via Booking.com</span>}
      </div>

      {isPending ? (
        <div className="widget-loading">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Loading prices…</p>
        </div>
      ) : isError ? (
        <div className="widget-error">Hotel prices are unavailable right now. {error.message}</div>
      ) : (
        <>
          <div className="stays-price">
            <span className="stays-price-value">{formatWholeMoney(data.average_price, data.currency)}</span>
            <span className="stays-price-label">average per night</span>
          </div>

          <div className="stays-controls">
            <label className="stays-control">
              Guests
              <select
                className="select"
                value={occupants}
                onChange={(event) => {
                  onOccupantsChange(Number(event.target.value));
                  setPage(1);
                }}
              >
                {[1, 2, 3, 4].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <label className="stays-control">
              Sort
              <select
                id="stays-sort"
                className="select"
                value={sortOrder}
                onChange={(event) => {
                  setSortOrder(event.target.value as SortOrder);
                  setPage(1);
                }}
              >
                <option value="price_asc">Lowest price</option>
                <option value="price_desc">Highest price</option>
                <option value="rating_desc">Highest rated</option>
              </select>
            </label>
          </div>

          {sorted.length === 0 ? (
            <p className="widget-empty">No hotels found for this city.</p>
          ) : (
            <>
              <ul className="stays-list">
                {visible.map((stay) => (
                  <li key={stay.id} className="stay">
                    <div className="stay-thumb">
                      {stay.image_url ? (
                        <img src={stay.image_url} alt="" loading="lazy" />
                      ) : (
                        <Icon name="bed" size={24} />
                      )}
                    </div>
                    <div className="stay-details">
                      <h3 className="stay-title">
                        <a href={stay.url} target="_blank" rel="noopener noreferrer">
                          {stay.title}
                        </a>
                      </h3>
                      <p className="stay-meta">
                        {[
                          stay.property_type,
                          stay.stars ? '★'.repeat(Math.round(stay.stars)) : '',
                          stay.distance_to_center,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {(stay.is_free_cancellable || stay.has_pool) && (
                        <div className="stay-badges">
                          {stay.is_free_cancellable && <span className="pill pill-signal">Free cancellation</span>}
                          {stay.has_pool && <span className="pill">Pool</span>}
                        </div>
                      )}
                      <div className="stay-bottom">
                        {stay.rating !== null ? (
                          <span className="stay-score">
                            <b>{stay.rating.toFixed(1)}</b>
                            {[stay.rating_word, stay.review_count > 0 && `${stay.review_count.toLocaleString()} reviews`]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className="stay-price">
                          {stay.price_per_night !== null ? (
                            <>
                              {formatMoney(stay.price_per_night, stay.currency)} <small>/ night</small>
                            </>
                          ) : (
                            'Price unavailable'
                          )}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </>
      )}
    </section>
  );
}

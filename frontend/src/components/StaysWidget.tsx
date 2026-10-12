import { useMemo, useState } from 'react';

import type { StayOptions } from '../api/client';
import { useStays } from '../api/queries';
import type { Currency, Stay } from '../api/types';
import { formatMoney, formatWholeMoney } from '../lib/format';
import Icon from './Icon';
import Pagination from './Pagination';
import './StaysWidget.css';

const PER_PAGE = 3;
const NIGHT_OPTIONS = [
  { value: 1, label: '1 night' },
  { value: 2, label: '2 nights' },
  { value: 3, label: '3 nights' },
  { value: 5, label: '5 nights' },
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
  { value: 21, label: '3 weeks' },
  { value: 30, label: '1 month' },
];

function isoDay(offsetDays: number) {
  const day = new Date();
  day.setDate(day.getDate() + offsetDays);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

/** "$118" -> "≈ €109" in the city's own currency, when it isn't USD and a rate is known. */
export function localPrice(usd: number | null | undefined, currency: Currency | null | undefined): string | null {
  if (usd === null || usd === undefined || !currency?.usd_rate || currency.code === 'USD') return null;
  return `≈ ${formatWholeMoney(usd * currency.usd_rate, currency.code)}`;
}

type SortOrder = 'price_asc' | 'price_desc' | 'rating_desc';

const SORTERS: Record<SortOrder, (a: Stay, b: Stay) => number> = {
  price_asc: (a, b) => (a.price_per_night ?? Infinity) - (b.price_per_night ?? Infinity),
  price_desc: (a, b) => (b.price_per_night ?? -Infinity) - (a.price_per_night ?? -Infinity),
  rating_desc: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
};

interface Props {
  cityId: string;
  options: StayOptions;
  onOptionsChange: (options: StayOptions) => void;
  /** The city's own currency, for "≈ €109" next to USD prices. */
  currency?: Currency | null;
}

export default function StaysWidget({ cityId, options, onOptionsChange, currency }: Props) {
  const { data, isPending, isError, error, isPlaceholderData } = useStays(cityId, options);
  const { occupants, nights } = options;
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
        <span className="card-meta">via Booking.com</span>
      </div>

      <div className="stays-controls">
        <label className="stays-control">
          Check-in
          <input
            id="stays-checkin"
            type="date"
            className="select"
            min={isoDay(0)}
            max={isoDay(360)}
            value={options.checkin ?? data?.checkin ?? ''}
            onChange={(event) => {
              if (event.target.value) onOptionsChange({ ...options, checkin: event.target.value });
              setPage(1);
            }}
          />
        </label>
        <label className="stays-control">
          Stay
          <select
            id="stays-nights"
            className="select"
            value={nights}
            onChange={(event) => {
              onOptionsChange({ ...options, nights: Number(event.target.value) });
              setPage(1);
            }}
          >
            {NIGHT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="stays-control">
          Guests
          <select
            id="stays-guests"
            className="select"
            value={occupants}
            onChange={(event) => {
              onOptionsChange({ ...options, occupants: Number(event.target.value) });
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
            <span className="stays-price-label">
              average per night{data.nights > 1 ? ` for ${data.nights} nights` : ''}
            </span>
            {(localPrice(data.average_price, currency) || (data.nights > 1 && data.average_price !== null)) && (
              <span className="stays-price-alt">
                {[
                  localPrice(data.average_price, currency),
                  data.nights > 1 && data.average_price !== null
                    ? `${formatWholeMoney(data.average_price * data.nights, data.currency)} total`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
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
                              {localPrice(stay.price_per_night, currency) && (
                                <small className="stay-local">{localPrice(stay.price_per_night, currency)}</small>
                              )}
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

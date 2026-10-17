import { type RefObject, useMemo, useRef, useState } from 'react';

import type { StayOptions } from '../../api/client';
import { useEssentials, useStays } from '../../api/queries';
import type { City, Currency, Stay } from '../../api/types';
import { hashSeed } from '../../lib/charts';
import { useNow } from '../../lib/clock';
import { useIsPhone } from '../../lib/layout';
import { DotPlot, PhotoArt } from '../charts';
import Icon from '../Icon';
import { Popover, Sheet, SheetHead } from '../overlays';
import { SecHead, cssVars } from '../ui';
import {
  type IsoDay,
  MONTHS_LONG,
  NIGHTS,
  SORTS,
  type SortOrder,
  addDays,
  capitalize,
  cityToday,
  dayLabel,
  guestsLabel,
  inLocal,
  nightsLabel,
  usd,
} from './common';
import { CardSkeleton, EmptyState, SectionError } from './states';

const MAX_DAYS_AHEAD = 359;
const MAX_GUESTS = 4;

const SORTERS: Record<SortOrder, (a: Stay, b: Stay) => number> = {
  price_asc: (a, b) => (a.price_per_night ?? Infinity) - (b.price_per_night ?? Infinity),
  price_desc: (a, b) => (b.price_per_night ?? -Infinity) - (a.price_per_night ?? -Infinity),
  rating_desc: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
};

interface Props {
  city: City;
  dataId: string;
  zone: string;
  stay: StayOptions;
  onStay: (stay: StayOptions) => void;
}

export default function StaysSection({ city, dataId, zone, stay, onStay }: Props) {
  const phone = useIsPhone();
  const now = useNow();
  const stays = useStays(dataId, stay);
  const essentials = useEssentials(dataId);
  const currency = essentials.data?.currency;
  const [sort, setSort] = useState<SortOrder>('price_asc');
  const [shown, setShown] = useState(3);
  const [hot, setHot] = useState<number | null>(null);
  const today = cityToday(zone, new Date(now));
  const data = stays.data;
  const checkin = data?.checkin ?? stay.checkin ?? addDays(today, 7);
  const checkout = data?.checkout ?? addDays(checkin, stay.nights);
  const sorted = useMemo(() => [...(data?.stays ?? [])].sort(SORTERS[sort]), [data, sort]);
  const prices = sorted.map((item) => item.price_per_night).filter((price) => price !== null);
  const average = data?.average_price ?? null;
  const local = inLocal(average, currency);

  function change(next: StayOptions) {
    setShown(3);
    onStay(next);
  }

  const sumParts: string[] = [];
  if (local) sumParts.push(`about ${local} a night`);
  if (average !== null && stay.nights > 1) sumParts.push(`${usd(average * stay.nights)} for ${nightsLabel(stay.nights)}`);
  const sumLine = sumParts.length ? capitalize(sumParts.join(', ')) : `Average of ${prices.length} hotels`;

  const title = average !== null ? `${usd(average)} a night on average` : `Where to stay in ${city.name}`;
  const lede = data
    ? `Hotel prices for your dates from Booking.com${local ? `, in dollars with ${currency?.name ?? 'local'} alongside` : ''}. ${
        data.stays.length
      } ${data.stays.length === 1 ? 'hotel' : 'hotels'} found.`
    : 'Hotel prices for your dates from Booking.com.';

  const pickerProps = { today, checkin, stay, onStay: change };

  let results;
  if (stays.isPending) {
    results = phone ? <CardSkeleton lines={4} /> : <CardSkeleton lines={5} tall />;
  } else if (stays.isError && !data) {
    results = (
      <SectionError
        title="Hotel prices didn't load"
        text="Booking.com didn't answer in time. Everything else on this page is up to date."
        error={stays.error}
        onRetry={() => void stays.refetch()}
      />
    );
  } else if (sorted.length === 0) {
    results = (
      <div className="card">
        <EmptyState
          icon={<Icon name="bed" size={22} />}
          title="No hotels found for these dates"
          text="Booking.com has nothing listed for this stay. Try other dates or fewer guests."
        />
      </div>
    );
  }

  const plot =
    prices.length > 0 && average !== null ? (
      <DotPlot prices={prices} average={average} width={phone ? 326 : 1104} height={phone ? 110 : 118} hot={hot} />
    ) : null;
  const updating = stays.isPlaceholderData ? ' is-updating' : '';

  if (phone) {
    return (
      <section className="sec" data-sec="stays" id="stays" aria-labelledby="stays-title">
        <div className="wrap">
          <SecHead id="stays-title" icon={<Icon name="bed" size={16} />} kicker="Where to stay" title={title} lede={lede} />
          <div className="stay-bar">
            <DatesSheetButton {...pickerProps} checkout={checkout} />
            {results ??
              (plot && (
                <div className={`card${updating}`}>
                  <div className="card-b stay-card-b">
                    <div className="contrib-top stay-top">
                      <span className="big">
                        {usd(average ?? 0)}
                        <small className="per">/ night</small>
                      </span>
                      <SortButton sort={sort} onSort={setSort} compact />
                    </div>
                    <div className="label stay-sum">{sumLine}</div>
                    {plot}
                  </div>
                </div>
              ))}
          </div>
          {!results && (
            <div className={`hscroll stay-scroll${updating}`}>
              {sorted.slice(0, 10).map((item, index) => (
                <HotelCard key={item.id} stay={item} index={index} currency={currency} />
              ))}
            </div>
          )}
          <p className="pl-foot">Prices from Booking.com, per room. Links open Booking.com.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="sec" data-sec="stays" id="stays" aria-labelledby="stays-title">
      <div className="wrap">
        <SecHead id="stays-title" icon={<Icon name="bed" size={16} />} kicker="Where to stay" title={title} lede={lede} />
        <div className={`card${updating}`}>
          <div className="card-b">
            <div className="stay-bar">
              <DatesPickers {...pickerProps} />
              <SortButton sort={sort} onSort={setSort} />
              {average !== null && (
                <div className="price-sum">
                  <div className="big">
                    {usd(average)}
                    <small>/ night</small>
                  </div>
                  <div className="label">{sumLine}</div>
                </div>
              )}
            </div>
            {plot && <div className="stay-plot">{plot}</div>}
          </div>
          {plot && (
            <div className="card-f">
              <span>
                Each dot is one hotel&apos;s nightly price for {dayLabel(checkin, false)} to {dayLabel(checkout, false)},{' '}
                {guestsLabel(stay.occupants)}.
              </span>
              <span>Prices from Booking.com</span>
            </div>
          )}
        </div>
        {results ?? (
          <>
            <div className={`hotels${updating}`}>
              {sorted.slice(0, shown).map((item, index) => (
                <HotelCard
                  key={item.id}
                  stay={item}
                  index={index}
                  currency={currency}
                  onHover={(on) => setHot(on ? item.price_per_night : null)}
                />
              ))}
            </div>
            {sorted.length > 3 && (
              <div className="center-row">
                {shown < sorted.length ? (
                  <button type="button" className="btn btn-secondary" onClick={() => setShown((count) => count + 6)}>
                    Show {Math.min(6, sorted.length - shown)} more hotels
                    <Icon name="plus" size={16} />
                  </button>
                ) : (
                  <button type="button" className="btn btn-secondary" onClick={() => setShown(3)}>
                    Show fewer
                    <Icon name="minus" size={16} />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ---------- Hotels ---------- */

function HotelCard({
  stay,
  index,
  currency,
  onHover,
}: {
  stay: Stay;
  index: number;
  currency: Currency | null | undefined;
  onHover?: (on: boolean) => void;
}) {
  const [broken, setBroken] = useState(false);
  const seed = hashSeed(stay.id);
  const local = inLocal(stay.price_per_night, currency);
  const badge = stay.is_free_cancellable ? 'Free cancellation' : stay.has_pool ? 'Pool' : '';
  const photo = stay.image_url && !broken;
  return (
    <a
      className="hotel"
      href={stay.url}
      target="_blank"
      rel="noopener noreferrer"
      onPointerEnter={(event) => event.pointerType === 'mouse' && onHover?.(true)}
      onPointerLeave={(event) => event.pointerType === 'mouse' && onHover?.(false)}
      onFocus={() => onHover?.(true)}
      onBlur={() => onHover?.(false)}
    >
      <div className="photo" style={cssVars({ '--ph': `hsl(${(seed % 360).toFixed(0)} 38% 62%)` })}>
        {photo ? (
          <img src={stay.image_url ?? ''} alt="" loading={index < 3 ? 'eager' : 'lazy'} onError={() => setBroken(true)} />
        ) : (
          <PhotoArt seed={seed} />
        )}
        {badge && <span className="pill">{badge}</span>}
      </div>
      <div className="hotel-b">
        <div className="hotel-name">
          <span>{stay.title}</span>
        </div>
        <div className="hotel-meta">
          {stay.property_type}
          {stay.stars ? (
            <span className="sep">
              <span aria-hidden="true">{'★'.repeat(Math.min(5, Math.round(stay.stars)))}</span>
              <span className="sr-only">{Math.round(stay.stars)}-star</span>
            </span>
          ) : null}
          {stay.distance_to_center && <span className="sep">{stay.distance_to_center}</span>}
        </div>
        <div className="hotel-row">
          {stay.rating !== null ? (
            <span className="review">
              <b>{stay.rating.toFixed(1)}</b>
              <span>
                <strong>{stay.rating_word || 'Rated'}</strong>
                <br />
                {stay.review_count.toLocaleString('en-US')} {stay.review_count === 1 ? 'review' : 'reviews'}
              </span>
            </span>
          ) : (
            <span className="review">No reviews yet</span>
          )}
          <span className="price">
            <b>{stay.price_per_night === null ? '–' : usd(stay.price_per_night)}</b>
            <small>per night{local ? `, about ${local}` : ''}</small>
          </span>
        </div>
        {/* The whole card is the link; this says where it goes. */}
        <span className="btn btn-secondary hotel-cta">
          View on Booking.com
          <Icon name="external" size={15} />
        </span>
      </div>
    </a>
  );
}

/* ---------- Dates, nights and guests ---------- */

interface PickerProps {
  today: IsoDay;
  checkin: IsoDay;
  stay: StayOptions;
  onStay: (stay: StayOptions) => void;
}

/** The draft being edited: applied when the panel closes, so trying dates doesn't fetch every click. */
interface Draft {
  checkin: IsoDay;
  nights: number;
  guests: number;
}

function Calendar({ today, draft, onDraft }: { today: IsoDay; draft: Draft; onDraft: (draft: Draft) => void }) {
  const [todayYear = 1970, todayMonth = 1] = today.split('-').map(Number);
  const [checkinYear = todayYear, checkinMonth = todayMonth] = draft.checkin.split('-').map(Number);
  const [offset, setOffset] = useState(() => Math.max(0, (checkinYear - todayYear) * 12 + checkinMonth - todayMonth));
  const base = new Date(Date.UTC(todayYear, todayMonth - 1 + offset, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const first = base.getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const checkout = addDays(draft.checkin, draft.nights);
  const last = addDays(today, MAX_DAYS_AHEAD);
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(<span key={`pad-${i}`} />);
  for (let day = 1; day <= days; day++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let cls = '';
    if (iso === draft.checkin) cls = 'sel start';
    else if (iso === checkout) cls = 'sel end';
    else if (iso > draft.checkin && iso < checkout) cls = 'in';
    const disabled = iso < today || iso > last;
    cells.push(
      <button
        key={iso}
        type="button"
        className={cls || undefined}
        disabled={disabled}
        aria-pressed={iso === draft.checkin}
        aria-label={`${dayLabel(iso)}${iso === draft.checkin ? ', check-in' : iso === checkout ? ', check-out' : ''}`}
        onClick={() => onDraft({ ...draft, checkin: iso })}
      >
        {day}
      </button>,
    );
  }
  return (
    <>
      <div className="cal-head">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous month"
          disabled={offset <= 0}
          onClick={() => setOffset((value) => Math.max(0, value - 1))}
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span aria-live="polite">
          {MONTHS_LONG[month]} {year}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next month"
          disabled={offset >= 11}
          onClick={() => setOffset((value) => Math.min(11, value + 1))}
        >
          <Icon name="chevron-right" size={18} />
        </button>
      </div>
      <div className="cal-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
          <small key={index} aria-hidden="true">
            {label}
          </small>
        ))}
        {cells}
      </div>
    </>
  );
}

function DatePicker({ today, draft, onDraft }: { today: IsoDay; draft: Draft; onDraft: (draft: Draft) => void }) {
  return (
    <>
      <Calendar today={today} draft={draft} onDraft={onDraft} />
      <div>
        <span className="field-label nights-label">How long</span>
        <div className="nights" role="group" aria-label="How long">
          {NIGHTS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={draft.nights === value}
              onClick={() => onDraft({ ...draft, nights: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="sheet-row guests-row">
        <div>
          <b>Guests</b>
          <div className="hint">Prices are per room</div>
        </div>
        <div className="stepper">
          <button
            type="button"
            aria-label="Fewer guests"
            disabled={draft.guests <= 1}
            onClick={() => onDraft({ ...draft, guests: Math.max(1, draft.guests - 1) })}
          >
            <Icon name="minus" size={18} />
          </button>
          <b aria-live="polite">{draft.guests}</b>
          <button
            type="button"
            aria-label="More guests"
            disabled={draft.guests >= MAX_GUESTS}
            onClick={() => onDraft({ ...draft, guests: Math.min(MAX_GUESTS, draft.guests + 1) })}
          >
            <Icon name="plus" size={18} />
          </button>
        </div>
      </div>
    </>
  );
}

function Summary({ draft }: { draft: Draft }) {
  return (
    <span className="sheet-sum">
      {dayLabel(draft.checkin, false)} to {dayLabel(addDays(draft.checkin, draft.nights), false)}
      <small>
        {nightsLabel(draft.nights)}, {guestsLabel(draft.guests)}
      </small>
    </span>
  );
}

/** Opens the picker with a fresh draft, and applies it when the picker closes. */
function useDraft({ checkin, stay, onStay }: PickerProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  function open() {
    setDraft({ checkin, nights: stay.nights, guests: stay.occupants });
  }
  function close() {
    if (draft && (draft.checkin !== checkin || draft.nights !== stay.nights || draft.guests !== stay.occupants)) {
      onStay({ checkin: draft.checkin, nights: draft.nights, occupants: draft.guests });
    }
    setDraft(null);
  }
  return { draft, setDraft, open, close };
}

/** Desktop: Check-in, Stay and Guests buttons share one popover. */
function DatesPickers(props: PickerProps) {
  const { draft, setDraft, open, close } = useDraft(props);
  const [anchor, setAnchor] = useState<'checkin' | 'stay' | 'guests'>('checkin');
  const checkinRef = useRef<HTMLButtonElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const guestsRef = useRef<HTMLButtonElement>(null);
  const refs: Record<typeof anchor, RefObject<HTMLButtonElement | null>> = {
    checkin: checkinRef,
    stay: stayRef,
    guests: guestsRef,
  };
  const { checkin, stay } = props;

  function toggle(which: typeof anchor) {
    if (draft && anchor === which) {
      close();
      return;
    }
    setAnchor(which);
    if (!draft) open();
  }

  const picker = (which: typeof anchor, ref: RefObject<HTMLButtonElement | null>, icon: 'calendar' | 'moon' | 'user', label: string, value: string) => (
    <button
      type="button"
      ref={ref}
      className="picker"
      aria-haspopup="dialog"
      aria-expanded={!!draft && anchor === which}
      onClick={() => toggle(which)}
    >
      <Icon name={icon} size={18} />
      <span className="picker-stack">
        <span className="label">{label}</span>
        {value}
      </span>
      <Icon name="chevron-down" size={16} />
    </button>
  );

  return (
    <>
      {picker('checkin', checkinRef, 'calendar', 'Check-in', dayLabel(checkin))}
      {picker('stay', stayRef, 'moon', 'Stay', nightsLabel(stay.nights))}
      {picker('guests', guestsRef, 'user', 'Guests', guestsLabel(stay.occupants))}
      <Popover open={!!draft} onClose={close} anchor={refs[anchor]} label="Dates and guests" className="pop">
        {draft && (
          <>
            <DatePicker today={props.today} draft={draft} onDraft={setDraft} />
            <div className="pop-foot">
              <Summary draft={draft} />
              <button type="button" className="btn btn-primary" onClick={close}>
                Done
              </button>
            </div>
          </>
        )}
      </Popover>
    </>
  );
}

/** Phones: one summary button opens a sheet with the calendar, nights and guests. */
function DatesSheetButton(props: PickerProps & { checkout: IsoDay }) {
  const { draft, setDraft, open, close } = useDraft(props);
  const { checkin, checkout, stay } = props;
  return (
    <>
      <button type="button" className="stay-summary" aria-haspopup="dialog" onClick={open}>
        <span className="tile">
          <Icon name="calendar" size={18} />
        </span>
        <span>
          <b>
            {dayLabel(checkin, false)} to {dayLabel(checkout, false)}
          </b>
          <span>
            {nightsLabel(stay.nights)}, {guestsLabel(stay.occupants)}
          </span>
        </span>
        <Icon name="chevron-right" size={18} />
      </button>
      <Sheet open={!!draft} onClose={close} label="Dates and guests">
        <SheetHead title="Dates and guests" onClose={close} />
        {draft && (
          <>
            <div className="sheet-body">
              <DatePicker today={props.today} draft={draft} onDraft={setDraft} />
            </div>
            <div className="sheet-foot">
              <Summary draft={draft} />
              <button type="button" className="btn btn-primary" onClick={close}>
                Show prices
              </button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}

function SortButton({ sort, onSort, compact = false }: { sort: SortOrder; onSort: (sort: SortOrder) => void; compact?: boolean }) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const label = SORTS.find(([value]) => value === sort)?.[1] ?? '';
  const close = () => setOpen(false);
  const rows = SORTS.map(([value, text]) => (
    <button
      key={value}
      type="button"
      aria-pressed={sort === value}
      onClick={() => {
        onSort(value);
        setOpen(false);
      }}
    >
      <Icon name="check" size={18} className={sort === value ? undefined : 'blank'} />
      {text}
    </button>
  ));
  return (
    <>
      {compact ? (
        <button
          type="button"
          ref={button}
          className="btn btn-ghost sort-btn"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {label}
          <Icon name="chevron-down" size={16} />
        </button>
      ) : (
        <button
          type="button"
          ref={button}
          className="picker"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name="sliders" size={18} />
          <span className="picker-stack">
            <span className="label">Sort</span>
            {label}
          </span>
          <Icon name="chevron-down" size={16} />
        </button>
      )}
      {phone ? (
        <Sheet open={open} onClose={close} label="Sort hotels">
          <SheetHead title="Sort hotels" onClose={close} />
          <div className="sheet-body">
            <div className="opt-list">{rows}</div>
          </div>
        </Sheet>
      ) : (
        <Popover open={open} onClose={close} anchor={button} label="Sort hotels">
          <div className="mp-label">Sort hotels by</div>
          {rows}
        </Popover>
      )}
    </>
  );
}

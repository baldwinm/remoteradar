import { type ReactNode, useRef, useState } from 'react';

import type { City, ScoreFactorKey, Units, WorkScore } from '../../api/types';
import { tierOf } from '../../lib/score';
import { useUnits } from '../../lib/units';
import Icon, { type IconName } from '../Icon';
import { Popover, Sheet, SheetHead } from '../overlays';

/* How the remote work score adds up, opened from the score card in the city hero: a popover on
   desktop, a sheet on phones. */

const FACTOR_ICONS: Record<ScoreFactorKey, IconName> = {
  internet: 'wifi',
  places: 'desk',
  cost: 'cash',
  climate: 'sun',
};

function comfortRange(units: Units): string {
  return units === 'imperial' ? '64 to 82 °F' : '18 to 28 °C';
}

/** How each factor is measured, the same for every city. */
function method(key: ScoreFactorKey, units: Units): string {
  switch (key) {
    case 'internet':
      return 'Average speeds from Speedtest by Ookla for the area. Download counts most, then upload, latency and mobile speed. 100 Mbps down, 50 up and 20 ms latency score full marks.';
    case 'places':
      return 'Coworking spaces within 10 km and how well they’re rated, plus cafés and how many open early or late. 10 coworking spaces and 20 cafés score full marks.';
    case 'cost':
      return 'The average hotel night a week from now on Booking.com, standing in for the cost of a stay. $60 a night scores full marks; $250 or more scores none.';
    case 'climate':
      return `How many months have highs of ${comfortRange(units)} and fewer than 10 rainy days, from recent years of weather history, plus hours of sun.`;
  }
}

function Breakdown({ city, score }: { city: City; score: WorkScore | undefined }) {
  const units = useUnits();
  const value = score?.score ?? null;
  return (
    <>
      {score && value === null && (
        <p className="how-intro">
          A score needs at least 3 of the 4 factors, and only {score.counted} {score.counted === 1 ? 'has' : 'have'} data for{' '}
          {city.name} right now.
        </p>
      )}
      <dl className="how-list">
        {(score?.factors ?? []).map((factor) => {
          const missing = factor.score === null;
          return (
            <div key={factor.key} className={`tier-${tierOf(factor.score).key}`}>
              <dt>
                <span className="tile">
                  <Icon name={FACTOR_ICONS[factor.key]} size={18} />
                </span>
                {factor.name}
                <span className="pill">{missing ? 'not counted' : `${factor.weight}%`}</span>
                <b className="how-num tier-text">{missing ? '–' : factor.score}</b>
              </dt>
              <dd>
                <span className="how-city">{missing ? `No data for ${city.name} right now.` : factor.detail}</span>
                {method(factor.key, units)}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="how-foot">
        80 and up is excellent, 65 to 79 good, 50 to 64 fair and under 50 challenging. A factor with no data drops out and
        the others share its weight. Work hours are never part of the score: you might be searching from a hotel, not from
        home, so the overlap with your workday is shown on its own.
      </p>
    </>
  );
}

/** A button that opens the score's breakdown. */
export default function ScoreDetails({
  city,
  score,
  phone,
  className,
  label,
  children,
}: {
  city: City;
  score: WorkScore | undefined;
  phone: boolean;
  className: string;
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  const value = score?.score ?? null;
  const title = value !== null ? `How ${value} is calculated` : 'How the score works';
  return (
    <>
      <button
        type="button"
        ref={button}
        className={className}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {children}
      </button>
      {phone ? (
        <Sheet open={open} onClose={close} label={title}>
          <SheetHead title={title} onClose={close} />
          <div className="sheet-body">
            <Breakdown city={city} score={score} />
          </div>
        </Sheet>
      ) : (
        <Popover open={open} onClose={close} anchor={button} label={title} className="pop how-pop">
          <div className="mp-label how-label">{title}</div>
          <Breakdown city={city} score={score} />
        </Popover>
      )}
    </>
  );
}

import { useRef, useState } from 'react';

import { useWorkScore } from '../../api/queries';
import type { City, ScoreFactor, ScoreFactorKey, Units } from '../../api/types';
import { useIsPhone } from '../../lib/layout';
import { useReveal } from '../../lib/reveal';
import { tierOf } from '../../lib/score';
import { useUnits } from '../../lib/units';
import Icon, { type IconName } from '../Icon';
import { Popover, Sheet, SheetHead } from '../overlays';
import { Bar, Ring, SecHead, cssVars } from '../ui';
import { CardSkeleton, SectionError } from './states';

const FACTOR_ICONS: Record<ScoreFactorKey, IconName> = {
  internet: 'wifi',
  places: 'desk',
  cost: 'cash',
  climate: 'sun',
};

const SCALE: [string, number][] = [
  ['low', 50],
  ['fair', 15],
  ['good', 15],
  ['excellent', 20],
];

export default function ScoreSection({ city, dataId }: { city: City; dataId: string }) {
  const phone = useIsPhone();
  const score = useWorkScore(dataId);
  const [ref, pre] = useReveal<HTMLDivElement>(score.isSuccess);
  const data = score.data;
  const value = data?.score ?? null;
  const tier = tierOf(value);

  let title = `How ${city.name} scores for remote work`;
  if (data && value !== null) title = `${city.name} scores ${value}, ${tier.label.toLowerCase()}`;
  else if (data) title = `Not enough data to score ${city.name} yet`;

  const head = (
    <SecHead
      id="score-title"
      icon={<Icon name="gauge" size={16} />}
      kicker="Remote work score"
      title={title}
      lede="Four factors from data already on this page, weighted by what matters most when you work remotely."
      tools={!phone && <HowItWorks />}
    />
  );

  let body;
  if (score.isPending) {
    body = phone ? (
      <div className="stack">
        <CardSkeleton lines={6} tall />
        <CardSkeleton lines={3} />
      </div>
    ) : (
      <div className="score-grid">
        <CardSkeleton lines={6} tall />
        <div className="stack">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={2} />
        </div>
      </div>
    );
  } else if (score.isError) {
    body = <SectionError title="The score didn't load" error={score.error} onRetry={() => void score.refetch()} />;
  } else if (value === null) {
    body = <NotEnoughData factors={score.data.factors} />;
  } else {
    const factors = score.data.factors;
    const counted = factors.filter((factor) => factor.score !== null);
    const breakdown = (
      <div className={`card tier-${tier.key}`}>
        <div className="card-b">
          <div className="contrib-top">
            <span className="big">
              {value}
              <small>/ 100</small>
            </span>
            <span className="tier-text contrib-tier">{tier.label}</span>
          </div>
          <div className="contrib-bar" role="img" aria-label="How much each factor adds to the score">
            {counted.map((factor) => (
              <span
                key={factor.key}
                className={`contrib-seg tier-${tierOf(factor.score).key}`}
                style={cssVars({ '--w': factor.weight, '--v': factor.score ?? 0 })}
              >
                <i />
              </span>
            ))}
          </div>
          <div className="contrib-keys">
            {counted.map((factor) => (
              <span key={factor.key} style={cssVars({ '--w': factor.weight })}>
                <b>{factor.name}</b>
                {factor.weight}%
              </span>
            ))}
          </div>
          <div className="factors">
            {factors.map((factor) => (
              <FactorRow key={factor.key} factor={factor} phone={phone} />
            ))}
          </div>
          {phone && <HowItWorks phone />}
        </div>
      </div>
    );
    const scale = (
      <>
        <div className="scale-wrap">
          <div className="scale">
            {SCALE.map(([key, width]) => (
              <span key={key} className={`tier-${key}`} style={cssVars({ '--w': width })} />
            ))}
          </div>
          <div className={`scale-mark tier-${tier.key}`} style={cssVars({ '--at': `${value}%` })}>
            <b>
              {city.name} {value}
            </b>
            <i />
          </div>
        </div>
        <div className="scale-ticks" aria-hidden="true">
          {[0, 50, 65, 80, 100].map((tick) => (
            <span key={tick} style={cssVars({ '--at': `${tick}%` })}>
              {tick}
            </span>
          ))}
        </div>
        <div className="legend">
          <span className="tier-excellent">
            <i />
            <b>80+</b> Excellent
          </span>
          <span className="tier-good">
            <i />
            <b>65 to 79</b> Good
          </span>
          <span className="tier-fair">
            <i />
            <b>50 to 64</b> Fair
          </span>
          <span className="tier-low">
            <i />
            <b>Under 50</b> Challenging
          </span>
        </div>
      </>
    );
    const note = (
      <div className="aside-note">
        <span className="tile">
          <Icon name="clock" size={20} />
        </span>
        <p>
          <b>Work hours aren&apos;t in the score.</b> You might be searching from a hotel, not from home, so the overlap
          with your workday is shown on its own, using the time zone you pick.
        </p>
      </div>
    );
    body = phone ? (
      <div className="stack">
        {breakdown}
        <div className="card">
          <div className="card-b">{scale}</div>
        </div>
        <div className="card">
          <div className="card-b">{note}</div>
        </div>
      </div>
    ) : (
      <div className="score-grid">
        {breakdown}
        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h3>Where {value} sits</h3>
              <span className="meta">0 to 100</span>
            </div>
            <div className="card-b">{scale}</div>
          </div>
          <div className="card">
            <div className="card-b">{note}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="sec" data-sec="score" id="score" aria-labelledby="score-title">
      <div className={`wrap${pre ? ' pre' : ''}`} ref={ref}>
        {head}
        {body}
      </div>
    </section>
  );
}

function FactorRow({ factor, phone }: { factor: ScoreFactor; phone: boolean }) {
  const missing = factor.score === null;
  const tier = tierOf(factor.score).key;
  const why = missing ? 'No data for this city right now, so the other factors share its weight.' : factor.detail;
  const num = missing ? '–' : factor.score;
  if (phone) {
    return (
      <div className={`factor tier-${tier}`}>
        <div className="factor-name">
          <Icon name={FACTOR_ICONS[factor.key]} size={17} />
          {factor.name}
          <span className="pill">{missing ? 'not counted' : `${factor.weight}%`}</span>
        </div>
        <div className="factor-num">{num}</div>
        <Bar value={factor.score ?? 0} />
        <div className="factor-why">{why}</div>
      </div>
    );
  }
  return (
    <div className={`factor tier-${tier}`}>
      <span className="tile">
        <Icon name={FACTOR_ICONS[factor.key]} size={20} />
      </span>
      <div>
        <div className="factor-name">
          {factor.name}
          <span className="pill">{missing ? 'not counted' : `${factor.weight}% of score`}</span>
        </div>
        <div className="factor-why">{why}</div>
      </div>
      <Bar value={factor.score ?? 0} />
      <div className="factor-num">{num}</div>
    </div>
  );
}

/** Shows what a score would need, instead of a misleading number. */
function NotEnoughData({ factors }: { factors: ScoreFactor[] }) {
  return (
    <div className="card">
      <div className="state-card">
        <Ring score={null} size={64} stroke={6} fontSize={18} />
        <h3>A score needs at least 3 of the 4 factors</h3>
        <p>Here&apos;s what&apos;s available for this city right now:</p>
        <div className="missing-list">
          {factors.map((factor) => (
            <span key={factor.key}>
              {factor.name}
              <em className={factor.score === null ? undefined : 'ok'}>
                {factor.score === null ? 'Not available' : factor.detail || 'Available'}
              </em>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- How it's measured ---------- */

function comfortRange(units: Units): string {
  return units === 'imperial' ? '64 to 82 °F' : '18 to 28 °C';
}

function HowList() {
  const units = useUnits();
  const rows: { key: ScoreFactorKey; name: string; weight: number; text: string }[] = [
    {
      key: 'internet',
      name: 'Internet',
      weight: 29,
      text: 'Average speeds from Speedtest by Ookla for the area. Download counts most, then upload, latency and mobile speed. 100 Mbps down, 50 up and 20 ms latency score full marks.',
    },
    {
      key: 'places',
      name: 'Places to work',
      weight: 29,
      text: 'Coworking spaces within 10 km and how well they’re rated, plus cafés and how many open early or late. 10 coworking spaces and 20 cafés score full marks.',
    },
    {
      key: 'cost',
      name: 'Cost',
      weight: 24,
      text: 'The average hotel night a week from now on Booking.com, standing in for the cost of a stay. $60 a night scores full marks; $250 or more scores none.',
    },
    {
      key: 'climate',
      name: 'Climate',
      weight: 18,
      text: `How many months have highs of ${comfortRange(units)} and fewer than 10 rainy days, from recent years of weather history, plus hours of sun.`,
    },
  ];
  return (
    <>
      <dl className="how-list">
        {rows.map((row) => (
          <div key={row.key}>
            <dt>
              <span className="tile">
                <Icon name={FACTOR_ICONS[row.key]} size={18} />
              </span>
              {row.name}
              <span className="pill">{row.weight}%</span>
            </dt>
            <dd>{row.text}</dd>
          </div>
        ))}
      </dl>
      <p className="how-foot">
        A factor with no data drops out and the others share its weight. A score needs at least 3 of the 4. Work hours are
        never part of it.
      </p>
    </>
  );
}

/** "How it's measured": a popover on desktop, a sheet on phones. */
function HowItWorks({ phone = false }: { phone?: boolean }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  return (
    <>
      <button
        type="button"
        ref={button}
        className={`btn btn-ghost${phone ? ' how-btn' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="info" size={17} />
        How it&apos;s measured
      </button>
      {phone ? (
        <Sheet open={open} onClose={close} label="How the score is measured">
          <SheetHead title="How the score is measured" onClose={close} />
          <div className="sheet-body">
            <HowList />
          </div>
        </Sheet>
      ) : (
        <Popover open={open} onClose={close} anchor={button} label="How the score is measured" align="right" className="pop how-pop">
          <div className="mp-label how-label">How the score is measured</div>
          <HowList />
        </Popover>
      )}
    </>
  );
}

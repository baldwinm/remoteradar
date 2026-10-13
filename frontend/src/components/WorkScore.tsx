import type { CSSProperties } from 'react';

import { useWorkScore } from '../api/queries';
import type { ScoreTier, WorkScore } from '../api/types';
import './WorkScore.css';

const LEGEND: { tier: ScoreTier; label: string }[] = [
  { tier: 'excellent', label: '80+ Excellent' },
  { tier: 'good', label: '65 to 79 Good' },
  { tier: 'fair', label: '50 to 64 Fair' },
  { tier: 'low', label: 'Under 50 Challenging' },
];

/** Same cut-offs as the backend, for coloring a single factor's score. */
export function tierFor(score: number): ScoreTier {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 50) return 'fair';
  return 'low';
}

const fill = (value: number) => ({ '--v': value }) as CSSProperties;

/** Color-coded ring beside the city name; links down to the breakdown card. */
export function ScoreBadge({ cityId }: { cityId: string }) {
  const query = useWorkScore(cityId);
  const data = query.data;
  if (query.isError || (data && data.score === null)) return null;
  const score = data?.score ?? null;

  return (
    <a className="score-badge" href="#score" aria-busy={!data}>
      <span className={`score-ring tier-${data?.tier ?? 'none'}`} style={fill(score ?? 0)} aria-hidden="true">
        <span>{score ?? '–'}</span>
      </span>
      <span className="score-badge-text">
        <span className="score-badge-title">Remote work score</span>
        <span className="score-badge-label">
          {data ? (
            <>
              <span className="visually-hidden">{score} out of 100, </span>
              {data.label}
            </>
          ) : (
            'Calculating…'
          )}
        </span>
        {data && <span className="score-badge-more">See breakdown</span>}
      </span>
    </a>
  );
}

/** Breakdown of the score: one bar per factor with the numbers behind it. */
export function ScoreCard({ cityId, cityName }: { cityId: string; cityName: string }) {
  const query = useWorkScore(cityId);

  return (
    <section className="card score-card" id="score" aria-labelledby="score-title">
      <div className="card-head">
        <h2 id="score-title">
          Remote work score
          {query.data?.score != null && (
            <>
              : <span className={`score-inline tier-${query.data.tier}`}>{query.data.score}</span>, {query.data.label}
            </>
          )}
        </h2>
        <span className="card-meta">How {cityName} scores for working remotely</span>
      </div>
      {query.isPending ? (
        <div className="widget-loading">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Scoring…</p>
        </div>
      ) : query.isError ? (
        <div className="widget-error">The score is unavailable right now. {query.error.message}</div>
      ) : (
        <ScoreBreakdown data={query.data} />
      )}
    </section>
  );
}

function ScoreBreakdown({ data }: { data: WorkScore }) {
  const total = data.factors.length;
  return (
    <>
      {data.score === null && (
        <p className="widget-empty">
          Not enough data to score this city: only {data.counted} of {total} factors are available.
        </p>
      )}
      <ul className="score-factors">
        {data.factors.map((factor) =>
          factor.score === null ? (
            <li key={factor.key} className="score-factor missing">
              <span className="score-factor-name">
                {factor.name} <small>not counted</small>
              </span>
              <span className="score-bar" aria-hidden="true" />
              <span className="score-factor-num">–</span>
              <span className="score-factor-why">No data for this city right now.</span>
            </li>
          ) : (
            <li key={factor.key} className={`score-factor tier-${tierFor(factor.score)}`} style={fill(factor.score)}>
              <span className="score-factor-name">
                {factor.name} <small>{factor.weight}% of score</small>
              </span>
              <span className="score-bar" aria-hidden="true">
                <i />
              </span>
              <span className="score-factor-num">
                {factor.score}
                <span className="visually-hidden"> out of 100</span>
              </span>
              <span className="score-factor-why">{factor.detail}</span>
            </li>
          ),
        )}
      </ul>
      <div className="card-foot">
        <span className="score-legend">
          {LEGEND.map((item) => (
            <span key={item.tier} className={`tier-${item.tier}`}>
              <i aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </span>
        {data.score !== null && data.counted < total && (
          <span>
            Based on {data.counted} of {total} factors
          </span>
        )}
      </div>
    </>
  );
}

/** Compact score for a table cell. */
export function ScoreChip({ data }: { data: WorkScore }) {
  if (data.score === null) return <span className="cmp-muted">Not enough data</span>;
  return (
    <span className={`score-chip tier-${data.tier}`}>
      <b>{data.score}</b>
      <span>{data.label}</span>
    </span>
  );
}

export function FactorScore({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="cmp-muted">–</span>;
  return <span className={`score-num tier-${tierFor(score)}`}>{score}</span>;
}

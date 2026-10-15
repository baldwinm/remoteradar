import { useState } from 'react';

import { useClimate } from '../../api/queries';
import type { City, ClimateMonth, Units } from '../../api/types';
import { useNow } from '../../lib/clock';
import { useIsPhone } from '../../lib/layout';
import { zoneDate } from '../../lib/time';
import { degrees } from '../../lib/units';
import { ClimateChart, climateMonthText } from '../charts';
import Icon from '../Icon';
import { SecHead } from '../ui';
import { MONTHS, MONTHS_LONG, bestRuns, list } from './common';
import { CardSkeleton, EmptyState, SectionError } from './states';

interface Props {
  city: City;
  dataId: string;
  zone: string;
  units: Units;
}

function bestTitle(months: ClimateMonth[]): string {
  const runs = bestRuns(months);
  if (runs.length === 0) return 'No month stands out';
  if (runs.length === 1 && runs[0]?.[0] === 1 && runs[0][1] === 12) return 'Good all year round';
  const parts = runs.map(([start, end]) =>
    start === end ? MONTHS_LONG[start - 1] ?? '' : `${MONTHS_LONG[start - 1]} to ${MONTHS_LONG[end - 1]}`,
  );
  return runs.every(([start, end]) => start === end) ? `Best in ${list(parts)}` : `Best from ${list(parts)}`;
}

/** "Warmest in August at 28°, coolest in January at 8°. November is the wettest, with about 9 rainy days." */
function summary(months: ClimateMonth[]): string {
  const withHigh = months.filter((month) => month.temperature_max !== null);
  const withLow = months.filter((month) => month.temperature_min !== null);
  const withRain = months.filter((month) => month.rainy_days !== null);
  const parts: string[] = [];
  if (withHigh.length && withLow.length) {
    const warmest = withHigh.reduce((a, b) => ((b.temperature_max ?? 0) > (a.temperature_max ?? 0) ? b : a));
    const coolest = withLow.reduce((a, b) => ((b.temperature_min ?? 0) < (a.temperature_min ?? 0) ? b : a));
    parts.push(
      `Warmest in ${MONTHS_LONG[warmest.month - 1]} at ${degrees(warmest.temperature_max)}, coolest in ${
        MONTHS_LONG[coolest.month - 1]
      } at ${degrees(coolest.temperature_min)}.`,
    );
  }
  if (withRain.length) {
    const wettest = withRain.reduce((a, b) => ((b.rainy_days ?? 0) > (a.rainy_days ?? 0) ? b : a));
    const days = Math.round(wettest.rainy_days ?? 0);
    if (days > 0) {
      parts.push(`${MONTHS_LONG[wettest.month - 1]} is the wettest, with about ${days} rainy ${days === 1 ? 'day' : 'days'}.`);
    }
  }
  return parts.join(' ');
}

export default function ClimateSection({ city, dataId, zone, units }: Props) {
  const phone = useIsPhone();
  const now = useNow();
  const climate = useClimate(dataId, units);
  const [selected, setSelected] = useState<number | null>(null);
  const nowMonth = zoneDate(zone, new Date(now)).month - 1;
  const data = climate.data;
  const hasData = data?.months.some((month) => month.temperature_max !== null) ?? false;
  const current = selected ?? nowMonth;
  const month = data?.months[current];
  const years = data?.years.replace('-', ' to ') ?? '';

  let body;
  if (climate.isPending) {
    body = <CardSkeleton lines={6} tall />;
  } else if (climate.isError && !data) {
    body = <SectionError title="Climate history didn't load" error={climate.error} onRetry={() => void climate.refetch()} />;
  } else if (!data || !hasData) {
    body = (
      <div className="card">
        <EmptyState
          icon={<Icon name="calendar" size={22} />}
          title="No climate history for this place"
          text={`There aren't enough years of weather records near ${city.name} to show monthly averages.`}
        />
      </div>
    );
  } else {
    const best = data.months.filter((m) => m.best);
    body = (
      <div className={`card${climate.isPlaceholderData ? ' is-updating' : ''}`}>
        <div className="card-b">
          <div className="best-wrap">
            <div>
              <span className="label">Best months</span>
              <div className="best-months">
                {best.length ? best.map((m) => <span key={m.month}>{MONTHS[m.month - 1]}</span>) : <span>None</span>}
              </div>
              <p className="best-copy">
                {phone ? 'Tap a month to see its numbers. ' : 'Point at a month to see its numbers. '}
                {summary(data.months)}
              </p>
              {month && (
                <div className="cl-detail" aria-live="polite">
                  <span>
                    <b>{MONTHS_LONG[month.month - 1]}</b>
                    {climateMonthText(month).slice(MONTHS_LONG[month.month - 1]?.length ?? 0)}
                  </span>
                  {month.best && <span className="pill pill-good">Best month</span>}
                </div>
              )}
            </div>
            <ClimateChart
              months={data.months}
              width={phone ? 358 : 832}
              height={phone ? 220 : 240}
              selected={current}
              nowMonth={nowMonth}
              onSelect={setSelected}
            />
          </div>
        </div>
        <div className="card-f">
          <span>
            Historical data from{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
              Open-Meteo.com
            </a>
          </span>
          <span>{phone ? 'd = rainy days' : 'Bars run from the average low to the average high'}</span>
        </div>
      </div>
    );
  }

  return (
    <section className="sec" data-sec="climate" id="climate" aria-labelledby="climate-title">
      <div className="wrap">
        <SecHead
          id="climate-title"
          icon={<Icon name="calendar" size={16} />}
          kicker="Best time to go"
          title={data && hasData ? bestTitle(data.months) : `When to go to ${city.name}`}
          lede={
            data && hasData
              ? `Average highs and lows by month, ${years}. Green months are mild with the least rain.`
              : undefined
          }
        />
        {body}
      </div>
    </section>
  );
}

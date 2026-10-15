import type { CSSProperties, ReactNode } from 'react';

import { tierOf } from '../lib/score';

/** Inline CSS custom properties, typed for React's style prop. */
export function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as CSSProperties;
}

interface RingProps {
  score: number | null | undefined;
  size?: number;
  stroke?: number;
  fontSize?: number;
}

/** The score as a colored ring that fills to its value. Starts empty inside a "pre" block. */
export function Ring({ score, size = 76, stroke = 7, fontSize }: RingProps) {
  const has = score !== null && score !== undefined;
  const tier = tierOf(score);
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const length = has ? (circumference * score) / 100 : 0;
  return (
    <span
      className={`ring tier-${tier.key}${has ? '' : ' empty'}`}
      style={{ width: size, height: size, ...cssVars({ '--off': `${length.toFixed(1)}px` }) }}
      aria-hidden="true"
    >
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle className="track" cx={c} cy={c} r={r} strokeWidth={stroke} />
        {has && (
          <circle
            className="val"
            cx={c}
            cy={c}
            r={r}
            strokeWidth={stroke}
            strokeDasharray={`${length.toFixed(1)} ${circumference.toFixed(1)}`}
          />
        )}
      </svg>
      <b style={{ fontSize: fontSize ?? Math.round(size * 0.34) }}>{has ? score : '–'}</b>
    </span>
  );
}

/** A thin bar filled to `value` percent, in its tier color. */
export function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className ? `bar ${className}` : 'bar'} style={cssVars({ '--v': value })} aria-hidden="true">
      <i />
    </span>
  );
}

export interface SegOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** For icon-only options. */
  ariaLabel?: string;
}

interface SegProps<T extends string | number> {
  label: string;
  value: T;
  options: SegOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/** A row of mutually exclusive buttons. */
export function Seg<T extends string | number>({ label, value, options, onChange, className }: SegProps<T>) {
  return (
    <div className={className ? `seg ${className}` : 'seg'} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={value === option.value}
          aria-label={option.ariaLabel}
          title={option.ariaLabel}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Section heading used on the city page: a small kicker, the title and an optional lede. */
export function SecHead({
  kicker,
  icon,
  title,
  lede,
  tools,
  id,
}: {
  kicker: string;
  icon: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  tools?: ReactNode;
  id?: string;
}) {
  return (
    <div className="sec-head">
      <div>
        <span className="sec-kicker">
          {icon}
          {kicker}
        </span>
        <h2 className="sec-title" id={id}>
          {title}
        </h2>
        {lede && <p className="sec-lede">{lede}</p>}
      </div>
      {tools && <div className="sec-tools">{tools}</div>}
    </div>
  );
}

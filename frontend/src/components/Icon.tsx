/* Line icons on a 24px grid. They take the text color; a part marked 'sun' takes the sun color, so
   weather icons read at a glance in both themes. */

type Part = readonly [d: string, sun?: 'sun'];

const ICONS = {
  coffee: 'M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zm12 1h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3m4-3v3',
  desk: 'M4 5h16v10H4zM2 19h20M9 15v4m6-4v4',
  food: 'M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10m10-18c-2 0-3 2.5-3 6v4h3v8',
  bed: 'M3 18V6m0 7h18v5M3 13V9h7a3 3 0 0 1 3 3v1m8 0v-2a3 3 0 0 0-3-3h-5',
  sun: [
    [
      'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
      'sun',
    ],
  ],
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  'cloud-sun': [
    ['M8 4V2.5M3.5 8H2m3-4.5 1 1M14 8a4 4 0 0 0-7.5-1.8', 'sun'],
    ['M7 20h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 20z'],
  ],
  'cloud-moon': [
    ['M13.5 4.5A4.5 4.5 0 0 0 9 9a4.4 4.4 0 0 0 .2 1.3'],
    ['M7 20h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 20z'],
  ],
  cloud: 'M7 19h10a4.5 4.5 0 0 0 .5-9A6 6 0 0 0 6 11.5 3.8 3.8 0 0 0 7 19z',
  fog: 'M7 13h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6 7a3 3 0 0 0 1 6zM4 17h16M6 21h12',
  drizzle: 'M7 15h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6 9a3 3 0 0 0 1 6zM9 19v1m6-1v1',
  rain: 'M7 15h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6 9a3 3 0 0 0 1 6zM8 18l-1 3m5-3-1 3m5-3-1 3',
  snow: 'M7 15h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6 9a3 3 0 0 0 1 6zM8 19h.01M12 21h.01M16 19h.01',
  storm: 'M7 15h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6 9a3 3 0 0 0 1 6zM13 15l-2 4h3l-2 4',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',
  droplet: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  arrow: 'M7 17 17 7M9 7h8v8',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2',
  wifi: 'M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  gym: 'M3 10v4m3-6v8m0-4h12m0-4v8m3-6v4',
  park: 'M12 21v-6m0 0-4-1.5A4 4 0 0 1 7 6.5 5 5 0 0 1 17 6.5a4 4 0 0 1-1 7z',
  laundry: 'M5 3h14v18H5zM5 7h14M8 5h.01M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4m8-4v4',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',
  cash: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 12h.01M18 12h.01',
  compare: 'M4 5h6v14H4zM14 5h6v14h-6z',
  device: 'M3 5h18v11H3zM8 20h8M12 16v4',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  x: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  share: 'M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zm0-14a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  globe:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
  sliders: 'M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5v5M9 14.5v5',
  map: 'M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5zM9 4v13.5M15 6.5V20',
  sunrise: [['M3 19h18'], ['M6.5 15.5a5.5 5.5 0 0 1 11 0M12 4v5M9.5 6.5 12 4l2.5 2.5', 'sun']],
  sunset: [['M3 19h18'], ['M6.5 15.5a5.5 5.5 0 0 1 11 0M12 4v5M9.5 6.5 12 9l2.5-2.5', 'sun']],
  wind: 'M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3',
  umbrella: 'M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v7a2 2 0 0 1-4 0',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  'user-x': 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 20a7 7 0 0 1 11.5-5.4M16.5 15.5l4 4m0-4-4 4',
  user: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0',
  cookie: 'M12 3a9 9 0 1 0 9 9 4 4 0 0 1-5-4 4 4 0 0 1-4-5zM8.5 11h.01M15 15.5h.01M10.5 16h.01M8 7.5h.01',
  ban: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  alert: 'M12 4 2.5 20h19zM12 10v4M12 17h.01',
  refresh: 'M20 11a8 8 0 0 0-14.7-3.5M4 4v4h4M4 13a8 8 0 0 0 14.7 3.5M20 20v-4h-4',
  layers: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5',
  locate: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  directions: 'M12 2.5 21.5 12 12 21.5 2.5 12zM9 13v-2.5h5.5M12.5 8l2.5 2.5-2.5 2.5',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-down': 'M12 5v14M6 13l6 6 6-6',
  gauge: 'M4.5 17a8.5 8.5 0 1 1 15 0M12 13l3.5-4.5M12 13h.01',
  offline:
    'M2 8.5a15 15 0 0 1 6-3.6M12 5a15 15 0 0 1 10 3.5M5.5 12a10 10 0 0 1 4-2.2M15.8 10.4A10 10 0 0 1 18.5 12M9 15.5a5 5 0 0 1 6 0M12 19h.01M3 3l18 18',
  home: 'M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z',
} as const satisfies Record<string, string | readonly Part[]>;

const STAR = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z';

export type IconName = keyof typeof ICONS | 'star';

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  /** Read out instead of hiding the icon from screen readers. */
  label?: string;
  /** Solid instead of outlined (a saved bookmark). */
  filled?: boolean;
  /** Position, when the icon sits inside a chart's SVG. */
  x?: number;
  y?: number;
}

export default function Icon({ name, size = 20, className, label, filled = false, x, y }: Props) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  const cls = className ? `ic ${className}` : 'ic';
  if (name === 'star') {
    return (
      <svg className={cls} x={x} y={y} width={size} height={size} viewBox="0 0 24 24" focusable="false" {...a11y}>
        <path fill="currentColor" d={STAR} />
      </svg>
    );
  }
  const def: string | readonly Part[] = ICONS[name];
  const parts: readonly Part[] = typeof def === 'string' ? [[def]] : def;
  return (
    <svg
      className={cls}
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...a11y}
    >
      {parts.map(([d, sun]) => (
        <path key={d} d={d} className={sun} />
      ))}
    </svg>
  );
}

/**
 * The Remote Radar mark: a radar scope with a sweep and one blip. Its green is too light to read on
 * white, so the scope always sits on its own dark badge and looks the same in both themes.
 */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg className="ic logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect className="lg-bg" width="32" height="32" rx="9" />
      <rect className="lg-edge" x="0.5" y="0.5" width="31" height="31" rx="8.5" />
      <path className="lg-sweep" d="M16 16 L16 5 A11 11 0 0 1 25.53 10.5 Z" />
      <circle className="lg-ring" cx="16" cy="16" r="11" strokeWidth="1.6" />
      <circle className="lg-ring lg-inner" cx="16" cy="16" r="6.4" strokeWidth="1.4" />
      <circle className="lg-dot" cx="16" cy="16" r="1.9" />
      <circle className="lg-blip" cx="21.1" cy="9.9" r="1.8" />
    </svg>
  );
}

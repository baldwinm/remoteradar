// Line icons drawn on a 24px grid. They inherit the text color, so they work in both themes.
const PATHS = {
  coffee: 'M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zm12 1h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3m4-3v3',
  desk: 'M4 5h16v10H4zM2 19h20M9 15v4m6-4v4',
  food: 'M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10m10-18c-2 0-3 2.5-3 6v4h3v8',
  bed: 'M3 18V6m0 7h18v5M3 13V9h7a3 3 0 0 1 3 3v1m8 0v-2a3 3 0 0 0-3-3h-5',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  'cloud-sun':
    'M8 4V2.5M3.5 8H2m3-4.5 1 1M14 8a4 4 0 0 0-7.5-1.8M7 20h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 20z',
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
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  gym: 'M3 10v4m3-6v8m0-4h12m0-4v8m3-6v4',
  park: 'M12 21v-6m0 0-4-1.5A4 4 0 0 1 7 6.5 5 5 0 0 1 17 6.5a4 4 0 0 1-1 7z',
  laundry: 'M5 3h14v18H5zM5 7h14M8 5h.01M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4m8-4v4',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',
  cash: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 12h.01M18 12h.01',
  compare: 'M4 5h6v14H4zM14 5h6v14h-6z',
  device: 'M3 5h18v11H3zM8 20h8M12 16v4',
} as const;

export type IconName = keyof typeof PATHS;

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  label?: string;
  /** Solid instead of outlined (used for "saved" bookmarks). */
  filled?: boolean;
}

export default function Icon({ name, size = 20, className, label, filled = false }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Star({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="star-icon">
      <path fill="currentColor" d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z" />
    </svg>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="logo-mark">
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
      <path d="M16 16 L16 2 A14 14 0 0 1 28.1 9 Z" fill="currentColor" opacity=".28" />
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
      <circle cx="22.5" cy="9.5" r="2" fill="var(--signal)" />
    </svg>
  );
}

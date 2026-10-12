import type { IconName } from '../components/Icon';

// WMO weather interpretation codes, https://open-meteo.com/en/docs
const ICONS: Record<number, IconName | [day: IconName, night: IconName]> = {
  0: ['sun', 'moon'],
  1: ['sun', 'moon'],
  2: ['cloud-sun', 'cloud'],
  3: 'cloud',
  45: 'fog',
  48: 'fog',
  51: 'drizzle',
  53: 'drizzle',
  55: 'rain',
  56: 'snow',
  57: 'snow',
  61: 'drizzle',
  63: 'rain',
  65: 'rain',
  66: 'snow',
  67: 'snow',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snow',
  80: 'drizzle',
  81: 'rain',
  82: 'rain',
  85: 'snow',
  86: 'snow',
  95: 'storm',
  96: 'storm',
  99: 'storm',
};

export function weatherIcon(code: number | null, isDay = true): IconName {
  const icon = code === null ? undefined : ICONS[code];
  if (!icon) return 'cloud';
  return typeof icon === 'string' ? icon : isDay ? icon[0] : icon[1];
}

/** Clear and sunny conditions get the warm highlight color. */
export function isSunny(icon: IconName): boolean {
  return icon === 'sun' || icon === 'cloud-sun';
}

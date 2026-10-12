// WMO weather interpretation codes, https://open-meteo.com/en/docs
const ICONS: Record<number, string | [day: string, night: string]> = {
  0: ['☀️', '🌙'],
  1: ['🌤️', '🌙'],
  2: ['⛅', '☁️'],
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  56: '🌨️',
  57: '🌨️',
  61: '🌦️',
  63: '🌧️',
  65: '🌧️',
  66: '🌨️',
  67: '🌨️',
  71: '🌨️',
  73: '🌨️',
  75: '❄️',
  77: '❄️',
  80: '🌦️',
  81: '🌧️',
  82: '🌧️',
  85: '🌨️',
  86: '❄️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️',
};

export function weatherIcon(code: number | null, isDay = true): string {
  const icon = code === null ? undefined : ICONS[code];
  if (!icon) return '🌥️';
  return typeof icon === 'string' ? icon : isDay ? icon[0] : icon[1];
}

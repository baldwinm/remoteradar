/* The world as dots, for the radar on the home page.

   The land mask was made once from Natural Earth land shapes on an Equal Earth projection, 1000
   map units wide and cropped from 79° N to 56° S: one bit per dot on a staggered 8-unit grid.
   Anything with a longitude and latitude can be placed on the same map with `project`. */

export const WORLD = {
  w: 1000,
  h: 427.6,
  step: 8,
  rowStep: 6.928,
  cols: 125,
  rows: 62,
  bits:
    'AAAAAACs/8BgABgAAAAA5+AAAAGEA/wAAQHwAAAAwT//gD4no4fgAgL///wB8j3//+P//xz4APr9////4//v//l///DDAA7//////y///9wOf/wYEAD3/////mA9+8MAMP/w8AAA3////8MAAPBgCA//z4AAkf////wIAADEAAAf//4ADv/////+IAAAgAAD//9AAF//////4QAAAAAAD//5gAH//////4AAAAAAAP//4AAH/Of///wAAAAAAAf/+AAA++G////kAAAAAAB//4AADhdc///+AAAAAAAD//gAADBX9///kAAAAAAAH/+AAAEAP7///kgAAAAAAP/8AAAPwD////LAAAAAAAf/gAAE/gP////AAAAAAAAP/AAAB/3/////AAAAAAAA/CAAAH//+///+AAAAAAAB8EAAAP//+///8AAAAAAAB4AAAA///9H//wAAAAAAABwQAAB//8/D//gAAAAAAADEQAAH//7+Hz4AAAAAAAAHIIAAH//78Hj0AAAAAAAAHgAAAf//3wOHggAAAAAAABwAAAf//3AMDxAAAAAAAADAAAB///4AYDCAAAAAAAABGAAB///gAQLDAAAAAAAAAfAAD///4BAEAAAAAAAAAD/AAD///wAgAEAAAAAAAAD+AADn//AAAhIAAAAAAAAD/gAAD/+AADCAAAAAAAAAP+AAAP/4AAGMAAAAAAAAAf+AAAP/wAAE5AAAAAAAAB/+AAA/+AAAJoQAAAAAAAB//gAA/8AAAJqcAAAAAAAH//gAB/4AAAQgdAAAAAAAH//AAB/wAAAYA4AAAAAAAP/+AAD/gAAAEgAgAAAAAAP/8AAH/AAAAAAAAAAAAAAf/wAAP+AAAAAwAAAAAAAAf/gAAf8QAAAFkABAAAAAA//AAB/7AAAAf4AAAAAAAAf+AAB/mAAAA/wAAAAAAAB/4AAH+IAAAH/gAAAAAAAB/4AAH8YAAAf/gAAAAAAAD/AAAP4gAAB/+AAAAAAAAH8AAAfgAAAD/+AAAAAAAAP4AAA/AAAAP/4AAAAAAAAfwAAA+AAAAP/wAAAAAAAA/AAABwAAAA8/AAAAAAAAA+AAADAAAABg+AACAAAAAD4AAAAAAAAABwAABAAAAAD4AAAAAAAAADAEACAAAAAPAAAAAAAAAAAAAAEAAAAAGAAAAAAAAAAICAAIAAAAAYAAAAAAAAAAAQAAAAAAAAYAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAkAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAA',
} as const;

// Equal Earth (Šavrič, Patterson and Jenny, 2018), scaled to 1000 units across like the dot mask.
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

function equalEarth(lng: number, lat: number): [number, number] {
  const lambda = (lng * Math.PI) / 180;
  const theta = Math.asin(M * Math.sin((lat * Math.PI) / 180));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  const x = (lambda * Math.cos(theta)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const y = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [x, y];
}

const SCALE = WORLD.w / 2 / equalEarth(180, 0)[0];
const TOP = equalEarth(0, 79)[1];

/** Longitude and latitude to map units: x from 0 to 1000, y down from 79° N. */
export function project(lng: number, lat: number): [number, number] {
  const [x, y] = equalEarth(lng, lat);
  return [WORLD.w / 2 + SCALE * x, SCALE * (TOP - y)];
}

let dots: [number, number][] | null = null;

/** Centers of the land dots, in map units. */
export function landDots(): [number, number][] {
  if (dots) return dots;
  const raw = atob(WORLD.bits);
  const bits = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bits[i] = raw.charCodeAt(i);
  const out: [number, number][] = [];
  for (let r = 0; r < WORLD.rows; r++) {
    for (let c = 0; c < WORLD.cols; c++) {
      const i = r * WORLD.cols + c;
      if ((bits[i >> 3] ?? 0) & (1 << (7 - (i & 7)))) {
        out.push([(r % 2 ? WORLD.step / 2 : 0) + WORLD.step / 2 + c * WORLD.step, r * WORLD.rowStep]);
      }
    }
  }
  dots = out;
  return out;
}

export interface FeaturedCity {
  /** A short ID the city page resolves, then swaps for the full one. */
  id: string;
  name: string;
  country: string;
  zone: string;
  lat: number;
  lng: number;
}

/** Popular remote-work cities shown on the radar and offered in search before anything is typed. */
export const FEATURED: readonly FeaturedCity[] = [
  { id: 'lisbon--pt', name: 'Lisbon', country: 'Portugal', zone: 'Europe/Lisbon', lat: 38.72, lng: -9.14 },
  { id: 'porto--pt', name: 'Porto', country: 'Portugal', zone: 'Europe/Lisbon', lat: 41.15, lng: -8.61 },
  { id: 'barcelona--es', name: 'Barcelona', country: 'Spain', zone: 'Europe/Madrid', lat: 41.39, lng: 2.17 },
  { id: 'valencia--es', name: 'Valencia', country: 'Spain', zone: 'Europe/Madrid', lat: 39.47, lng: -0.38 },
  { id: 'berlin--de', name: 'Berlin', country: 'Germany', zone: 'Europe/Berlin', lat: 52.52, lng: 13.4 },
  { id: 'tbilisi--ge', name: 'Tbilisi', country: 'Georgia', zone: 'Asia/Tbilisi', lat: 41.72, lng: 44.79 },
  { id: 'mexico-city--mx', name: 'Mexico City', country: 'Mexico', zone: 'America/Mexico_City', lat: 19.43, lng: -99.13 },
  { id: 'medellín--co', name: 'Medellín', country: 'Colombia', zone: 'America/Bogota', lat: 6.24, lng: -75.56 },
  {
    id: 'buenos-aires--ar',
    name: 'Buenos Aires',
    country: 'Argentina',
    zone: 'America/Argentina/Buenos_Aires',
    lat: -34.6,
    lng: -58.38,
  },
  { id: 'cape-town--za', name: 'Cape Town', country: 'South Africa', zone: 'Africa/Johannesburg', lat: -33.92, lng: 18.42 },
  { id: 'chiang-mai--th', name: 'Chiang Mai', country: 'Thailand', zone: 'Asia/Bangkok', lat: 18.79, lng: 98.99 },
  { id: 'bangkok--th', name: 'Bangkok', country: 'Thailand', zone: 'Asia/Bangkok', lat: 13.76, lng: 100.5 },
  { id: 'da-nang--vn', name: 'Da Nang', country: 'Vietnam', zone: 'Asia/Ho_Chi_Minh', lat: 16.05, lng: 108.2 },
  { id: 'bali--id', name: 'Bali', country: 'Indonesia', zone: 'Asia/Makassar', lat: -8.65, lng: 115.22 },
  { id: 'tokyo--jp', name: 'Tokyo', country: 'Japan', zone: 'Asia/Tokyo', lat: 35.69, lng: 139.69 },
  { id: 'austin--tx--us', name: 'Austin', country: 'United States', zone: 'America/Chicago', lat: 30.27, lng: -97.74 },
  { id: 'santa-fe--nm--us', name: 'Santa Fe', country: 'United States', zone: 'America/Denver', lat: 35.69, lng: -105.94 },
];

/* A reference city for common time zones: [longitude, latitude, name]. The visitor's dot on the
   radar and the "your 9 to 5 in …" labels come from the browser's time zone, never the IP address. */
const ZONES: Record<string, [number, number, string]> = {
  'America/Los_Angeles': [-118.24, 34.05, 'Los Angeles'],
  'America/Vancouver': [-123.12, 49.28, 'Vancouver'],
  'America/Denver': [-104.98, 39.74, 'Denver'],
  'America/Edmonton': [-113.49, 53.55, 'Edmonton'],
  'America/Phoenix': [-112.07, 33.45, 'Phoenix'],
  'America/Chicago': [-87.65, 41.85, 'Chicago'],
  'America/Winnipeg': [-97.14, 49.9, 'Winnipeg'],
  'America/Mexico_City': [-99.13, 19.43, 'Mexico City'],
  'America/New_York': [-74.01, 40.71, 'New York'],
  'America/Toronto': [-79.38, 43.65, 'Toronto'],
  'America/Halifax': [-63.57, 44.65, 'Halifax'],
  'America/Puerto_Rico': [-66.1, 18.47, 'San Juan'],
  'America/Bogota': [-74.07, 4.6, 'Bogotá'],
  'America/Lima': [-77.04, -12.05, 'Lima'],
  'America/Santiago': [-70.65, -33.45, 'Santiago'],
  'America/Sao_Paulo': [-46.63, -23.55, 'São Paulo'],
  'America/Argentina/Buenos_Aires': [-58.38, -34.6, 'Buenos Aires'],
  'America/Anchorage': [-149.9, 61.22, 'Anchorage'],
  'Pacific/Honolulu': [-157.86, 21.31, 'Honolulu'],
  'Atlantic/Reykjavik': [-21.94, 64.15, 'Reykjavík'],
  'Europe/London': [-0.13, 51.51, 'London'],
  'Europe/Dublin': [-6.26, 53.35, 'Dublin'],
  'Europe/Lisbon': [-9.14, 38.72, 'Lisbon'],
  'Europe/Madrid': [-3.7, 40.42, 'Madrid'],
  'Europe/Paris': [2.35, 48.86, 'Paris'],
  'Europe/Brussels': [4.35, 50.85, 'Brussels'],
  'Europe/Amsterdam': [4.9, 52.37, 'Amsterdam'],
  'Europe/Berlin': [13.4, 52.52, 'Berlin'],
  'Europe/Zurich': [8.54, 47.37, 'Zurich'],
  'Europe/Rome': [12.5, 41.9, 'Rome'],
  'Europe/Vienna': [16.37, 48.21, 'Vienna'],
  'Europe/Prague': [14.42, 50.08, 'Prague'],
  'Europe/Warsaw': [21.01, 52.23, 'Warsaw'],
  'Europe/Copenhagen': [12.57, 55.68, 'Copenhagen'],
  'Europe/Oslo': [10.75, 59.91, 'Oslo'],
  'Europe/Stockholm': [18.07, 59.33, 'Stockholm'],
  'Europe/Helsinki': [24.94, 60.17, 'Helsinki'],
  'Europe/Budapest': [19.04, 47.5, 'Budapest'],
  'Europe/Bucharest': [26.1, 44.43, 'Bucharest'],
  'Europe/Athens': [23.73, 37.98, 'Athens'],
  'Europe/Kyiv': [30.52, 50.45, 'Kyiv'],
  'Europe/Kiev': [30.52, 50.45, 'Kyiv'],
  'Europe/Istanbul': [28.98, 41.01, 'Istanbul'],
  'Europe/Moscow': [37.62, 55.76, 'Moscow'],
  'Africa/Casablanca': [-7.59, 33.57, 'Casablanca'],
  'Africa/Lagos': [3.39, 6.45, 'Lagos'],
  'Africa/Cairo': [31.24, 30.04, 'Cairo'],
  'Africa/Nairobi': [36.82, -1.29, 'Nairobi'],
  'Africa/Johannesburg': [28.05, -26.2, 'Johannesburg'],
  'Asia/Jerusalem': [35.22, 31.77, 'Jerusalem'],
  'Asia/Riyadh': [46.72, 24.71, 'Riyadh'],
  'Asia/Tbilisi': [44.79, 41.72, 'Tbilisi'],
  'Asia/Dubai': [55.3, 25.27, 'Dubai'],
  'Asia/Karachi': [67.01, 24.86, 'Karachi'],
  'Asia/Kolkata': [88.36, 22.57, 'Kolkata'],
  'Asia/Calcutta': [88.36, 22.57, 'Kolkata'],
  'Asia/Kathmandu': [85.32, 27.72, 'Kathmandu'],
  'Asia/Dhaka': [90.41, 23.81, 'Dhaka'],
  'Asia/Bangkok': [100.5, 13.75, 'Bangkok'],
  'Asia/Ho_Chi_Minh': [106.66, 10.76, 'Ho Chi Minh City'],
  'Asia/Jakarta': [106.85, -6.21, 'Jakarta'],
  'Asia/Makassar': [115.22, -8.65, 'Bali'],
  'Asia/Kuala_Lumpur': [101.69, 3.14, 'Kuala Lumpur'],
  'Asia/Singapore': [103.85, 1.29, 'Singapore'],
  'Asia/Manila': [120.98, 14.6, 'Manila'],
  'Asia/Hong_Kong': [114.16, 22.28, 'Hong Kong'],
  'Asia/Taipei': [121.56, 25.03, 'Taipei'],
  'Asia/Shanghai': [121.47, 31.23, 'Shanghai'],
  'Asia/Seoul': [126.98, 37.57, 'Seoul'],
  'Asia/Tokyo': [139.69, 35.69, 'Tokyo'],
  'Australia/Perth': [115.86, -31.95, 'Perth'],
  'Australia/Brisbane': [153.03, -27.47, 'Brisbane'],
  'Australia/Sydney': [151.21, -33.87, 'Sydney'],
  'Australia/Melbourne': [144.96, -37.81, 'Melbourne'],
  'Pacific/Auckland': [174.76, -36.85, 'Auckland'],
};

// Zones whose name says little about where they are on the map.
const SOUTH_AMERICA = /^America\/(Argentina|Asuncion|Bahia|Belem|Boa_Vista|Campo_Grande|Caracas|Cayenne|Cuiaba|Fortaleza|Guayaquil|Guyana|La_Paz|Maceio|Manaus|Montevideo|Noronha|Paramaribo|Porto_Velho|Punta_Arenas|Recife|Rio_Branco|Santarem)/;
const LATITUDE_BY_REGION: Record<string, number> = {
  Europe: 49,
  Africa: 4,
  Asia: 30,
  Australia: -30,
  Pacific: -12,
  Atlantic: 30,
  Indian: -12,
  Antarctica: -54,
  Arctic: 70,
};

/** "Chicago" for America/Chicago; for zones without a reference city, the last part of the name. */
export function zoneCity(zone: string): string {
  return ZONES[zone]?.[2] ?? (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
}

/** Where to put the visitor on the radar: the zone's reference city, or a fair guess from its offset. */
export function zonePoint(zone: string, offsetMinutes: number): [number, number] {
  const known = ZONES[zone];
  if (known) return project(known[0], known[1]);
  const region = zone.split('/')[0] ?? '';
  let lat = LATITUDE_BY_REGION[region] ?? 30;
  if (region === 'America') lat = SOUTH_AMERICA.test(zone) ? -15 : 38;
  const lng = Math.max(-170, Math.min(175, (offsetMinutes / 60) * 15));
  return project(lng, lat);
}

/** Time zones offered in the "Your time zone" picker before anything is typed. */
export const COMMON_ZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

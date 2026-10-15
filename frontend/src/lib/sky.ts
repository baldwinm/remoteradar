import { utcOffsetMinutes, zoneDate } from './time';

/* The sky on city pages follows the city's local time: the sun crosses an arc from sunrise to
   sunset, the moon from sunset to sunrise, and the colors move through dawn, day, dusk and night. */

export type Phase = 'dawn' | 'day' | 'dusk' | 'night';

export interface SkyState {
  phase: Phase;
  /** How far along its arc the sun (or moon) is, 0 to 1. */
  f: number;
  moon: boolean;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Sky phase and sun position at `minute` (local), given sunrise and sunset as local minutes. */
export function skyState(minute: number, rise: number, set: number): SkyState {
  let phase: Phase = 'day';
  if (minute < rise - 45 || minute > set + 60) phase = 'night';
  else if (minute < rise + 50) phase = 'dawn';
  else if (minute > set - 55) phase = 'dusk';
  let f: number;
  let moon = false;
  if (minute >= rise && minute <= set) {
    f = (minute - rise) / Math.max(1, set - rise);
  } else {
    moon = true;
    const night = 1440 - (set - rise);
    const since = minute > set ? minute - set : minute + 1440 - set;
    f = since / Math.max(1, night);
  }
  return { phase, f: clamp(f, 0.02, 0.98), moon };
}

/** "2026-10-14T07:41" (already local) -> 461. */
export function isoMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const hour = Number(iso.slice(11, 13));
  const minute = Number(iso.slice(14, 16));
  return Number.isNaN(hour) || Number.isNaN(minute) ? null : hour * 60 + minute;
}

export interface SunTimes {
  rise: number;
  set: number;
}

/** Sunrise and sunset in local minutes, worked out from the position (NOAA's approximation, good to a
    few minutes). Used until the forecast, which has the exact times, arrives. */
export function solarTimes(lat: number, lng: number, timeZone: string, when = new Date()): SunTimes {
  const date = zoneDate(timeZone, when);
  const dayOfYear = Math.round((Date.UTC(date.year, date.month - 1, date.day) - Date.UTC(date.year, 0, 0)) / 86400000);
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const phi = (lat * Math.PI) / 180;
  const cosH = Math.cos((90.833 * Math.PI) / 180) / (Math.cos(phi) * Math.cos(decl)) - Math.tan(phi) * Math.tan(decl);
  // Polar night or midnight sun.
  if (cosH > 1) return { rise: 720, set: 720 };
  if (cosH < -1) return { rise: 0, set: 1439 };
  const hourAngle = (Math.acos(cosH) * 180) / Math.PI;
  const offset = utcOffsetMinutes(timeZone, when);
  const wrap = (minutes: number) => ((Math.round(minutes) % 1440) + 1440) % 1440;
  return {
    rise: wrap(720 - 4 * (lng + hourAngle) - eqTime + offset),
    set: wrap(720 - 4 * (lng - hourAngle) - eqTime + offset),
  };
}

/** Exact times from the forecast when it has them, otherwise the calculated ones. */
export function sunTimes(
  daily: { sunrise: string | null; sunset: string | null } | undefined,
  position: { lat: number; lng: number; timeZone: string } | null,
): SunTimes | null {
  const rise = isoMinutes(daily?.sunrise);
  const set = isoMinutes(daily?.sunset);
  if (rise !== null && set !== null && set > rise) return { rise, set };
  if (position && position.timeZone) {
    try {
      return solarTimes(position.lat, position.lng, position.timeZone);
    } catch {
      return null;
    }
  }
  return null;
}

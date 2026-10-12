import type {
  City,
  CitySearchResponse,
  Climate,
  Essentials,
  ExtraPlaceType,
  PlacesResponse,
  StaysResponse,
  Units,
  Weather,
} from './types';

export interface StayOptions {
  occupants: number;
  /** "YYYY-MM-DD"; the API picks a week from today when it's missing. */
  checkin?: string;
  nights: number;
}

// Empty by default: the API serves the site, so calls go to same-origin /api URLs (in
// development, through the dev-server proxy). Set VITE_API_BASE_URL only if the API lives elsewhere.
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', 'Could not reach Remote Radar. Check your connection.');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new ApiError(
      response.status,
      body?.error ?? 'http_error',
      body?.message ?? `Request failed (${response.status}).`,
    );
  }
  return (await response.json()) as T;
}

const cityPath = (cityId: string) => `/cities/${encodeURIComponent(cityId)}`;

export const api = {
  searchCities: (query: string, signal?: AbortSignal) =>
    getJson<CitySearchResponse>(`/cities?q=${encodeURIComponent(query)}`, signal).then((r) => r.cities),
  city: (cityId: string, signal?: AbortSignal) => getJson<City>(cityPath(cityId), signal),
  weather: (cityId: string, units: Units, signal?: AbortSignal) =>
    getJson<Weather>(`${cityPath(cityId)}/weather?units=${units}`, signal),
  places: (cityId: string, type?: ExtraPlaceType, signal?: AbortSignal) =>
    getJson<PlacesResponse>(`${cityPath(cityId)}/places${type ? `?type=${type}` : ''}`, signal),
  stays: (cityId: string, { occupants, checkin, nights }: StayOptions, signal?: AbortSignal) => {
    const params = new URLSearchParams({ occupants: String(occupants), nights: String(nights) });
    if (checkin) params.set('checkin', checkin);
    return getJson<StaysResponse>(`${cityPath(cityId)}/stays?${params}`, signal);
  },
  essentials: (cityId: string, signal?: AbortSignal) => getJson<Essentials>(`${cityPath(cityId)}/essentials`, signal),
  climate: (cityId: string, units: Units, signal?: AbortSignal) =>
    getJson<Climate>(`${cityPath(cityId)}/climate?units=${units}`, signal),
};

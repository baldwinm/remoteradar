import type { City, CitySearchResponse, PlacesResponse, StaysResponse, Units, Weather } from './types';

// Empty by default: the API is served from the same origin as the site (directly, or
// through the dev-server proxy). Set VITE_API_BASE_URL only if the API lives elsewhere.
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
  places: (cityId: string, signal?: AbortSignal) =>
    getJson<PlacesResponse>(`${cityPath(cityId)}/places`, signal),
  stays: (cityId: string, occupants: number, signal?: AbortSignal) =>
    getJson<StaysResponse>(`${cityPath(cityId)}/stays?occupants=${occupants}`, signal),
};

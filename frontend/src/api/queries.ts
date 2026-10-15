import { QueryClient, keepPreviousData, useQuery } from '@tanstack/react-query';

import { ApiError, type StayOptions, api } from './client';
import type { ExtraPlaceType, Units } from './types';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data changes slowly and the API caches it too; avoid refetching on every focus.
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Retry network blips and upstream hiccups once; never retry 4xx or rate limits.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 1;
        },
      },
    },
  });
}

export const cityKeys = {
  search: (query: string) => ['cities', 'search', query] as const,
  city: (cityId: string) => ['city', cityId] as const,
  weather: (cityId: string, units: Units) => ['city', cityId, 'weather', units] as const,
  places: (cityId: string, type?: ExtraPlaceType) => ['city', cityId, 'places', type ?? 'core'] as const,
  stays: (cityId: string, options: StayOptions) =>
    ['city', cityId, 'stays', options.occupants, options.checkin ?? '', options.nights] as const,
  essentials: (cityId: string) => ['city', cityId, 'essentials'] as const,
  score: (cityId: string) => ['city', cityId, 'score'] as const,
  climate: (cityId: string, units: Units) => ['city', cityId, 'climate', units] as const,
  popular: (timeZone: string) => ['popular', timeZone] as const,
};

export function useCitySearch(query: string) {
  return useQuery({
    queryKey: cityKeys.search(query),
    queryFn: ({ signal }) => api.searchCities(query, signal),
    enabled: query.length >= 2,
    staleTime: 60 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

/* The city's own sections take an empty ID while the page is still working out which city it is,
   and wait until they get a real one. */

export function useCity(cityId: string) {
  return useQuery({
    queryKey: cityKeys.city(cityId),
    queryFn: ({ signal }) => api.city(cityId, signal),
    staleTime: Infinity,
    enabled: cityId !== '',
  });
}

export function useWeather(cityId: string, units: Units) {
  return useQuery({
    queryKey: cityKeys.weather(cityId, units),
    queryFn: ({ signal }) => api.weather(cityId, units, signal),
    placeholderData: keepPreviousData,
    enabled: cityId !== '',
  });
}

/** Coffee, coworking and restaurants; or, given `type`, that on-demand category alone. */
export function usePlaces(cityId: string, type?: ExtraPlaceType, enabled = true) {
  return useQuery({
    queryKey: cityKeys.places(cityId, type),
    queryFn: ({ signal }) => api.places(cityId, type, signal),
    enabled: enabled && cityId !== '',
  });
}

export function useStays(cityId: string, options: StayOptions) {
  return useQuery({
    queryKey: cityKeys.stays(cityId, options),
    queryFn: ({ signal }) => api.stays(cityId, options, signal),
    placeholderData: keepPreviousData,
    enabled: cityId !== '',
  });
}

export function useEssentials(cityId: string) {
  return useQuery({
    queryKey: cityKeys.essentials(cityId),
    queryFn: ({ signal }) => api.essentials(cityId, signal),
    enabled: cityId !== '',
  });
}

export function useWorkScore(cityId: string) {
  return useQuery({
    queryKey: cityKeys.score(cityId),
    queryFn: ({ signal }) => api.score(cityId, signal),
    enabled: cityId !== '',
  });
}

export function useClimate(cityId: string, units: Units) {
  return useQuery({
    queryKey: cityKeys.climate(cityId, units),
    queryFn: ({ signal }) => api.climate(cityId, units, signal),
    staleTime: 24 * 60 * 60 * 1000,
    placeholderData: keepPreviousData,
    enabled: cityId !== '',
  });
}

/** Cities opened most near the visitor (by browser time zone), or across the site. */
export function usePopularCities(timeZone: string) {
  return useQuery({
    queryKey: cityKeys.popular(timeZone),
    queryFn: ({ signal }) => api.popular(timeZone, signal),
    retry: false,
  });
}

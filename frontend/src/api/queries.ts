import { QueryClient, keepPreviousData, useQuery } from '@tanstack/react-query';

import { ApiError, api } from './client';
import type { Units } from './types';

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
  places: (cityId: string) => ['city', cityId, 'places'] as const,
  stays: (cityId: string, occupants: number) => ['city', cityId, 'stays', occupants] as const,
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

export function useCity(cityId: string) {
  return useQuery({
    queryKey: cityKeys.city(cityId),
    queryFn: ({ signal }) => api.city(cityId, signal),
    staleTime: Infinity,
  });
}

export function useWeather(cityId: string, units: Units) {
  return useQuery({
    queryKey: cityKeys.weather(cityId, units),
    queryFn: ({ signal }) => api.weather(cityId, units, signal),
    placeholderData: keepPreviousData,
  });
}

export function usePlaces(cityId: string) {
  return useQuery({
    queryKey: cityKeys.places(cityId),
    queryFn: ({ signal }) => api.places(cityId, signal),
  });
}

export function useStays(cityId: string, occupants: number) {
  return useQuery({
    queryKey: cityKeys.stays(cityId, occupants),
    queryFn: ({ signal }) => api.stays(cityId, occupants, signal),
    placeholderData: keepPreviousData,
  });
}

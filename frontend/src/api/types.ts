// Mirrors backend/app/models.py.

export type Units = 'metric' | 'imperial';
export type PlaceType = 'coffee' | 'coworking' | 'restaurant';

export interface City {
  id: string;
  name: string;
  state: string;
  state_code: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  formatted: string;
}

export interface CitySearchResponse {
  cities: City[];
}

export interface CurrentWeather {
  time: string;
  temperature: number | null;
  apparent_temperature: number | null;
  relative_humidity: number | null;
  precipitation: number | null;
  cloud_cover: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  weather_code: number | null;
  description: string;
  is_day: boolean;
}

export interface HourlyForecast {
  time: string;
  temperature: number | null;
  precipitation_probability: number | null;
  weather_code: number | null;
  is_day: boolean;
}

export interface DailyForecast {
  date: string;
  temperature_max: number | null;
  temperature_min: number | null;
  precipitation_probability_max: number | null;
  weather_code: number | null;
  description: string;
  sunrise: string | null;
  sunset: string | null;
}

export interface Weather {
  units: Units;
  timezone: string;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

export interface Place {
  id: string;
  name: string;
  type: PlaceType;
  address: string;
  rating: number | null;
  user_ratings_total: number;
  price_level: number | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  phone: string | null;
  maps_url: string;
}

export interface PlacesResponse {
  places: Place[];
  counts: Record<PlaceType | 'total', number>;
  partial: boolean;
}

export interface Stay {
  id: string;
  title: string;
  property_type: string;
  rating: number | null;
  rating_word: string;
  review_count: number;
  stars: number | null;
  price_per_night: number | null;
  currency: string;
  image_url: string | null;
  distance_to_center: string;
  is_free_cancellable: boolean;
  has_pool: boolean;
  url: string;
}

export interface StaysResponse {
  checkin: string;
  checkout: string;
  occupants: number;
  average_price: number | null;
  currency: string;
  stays: Stay[];
}

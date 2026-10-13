// Mirrors backend/app/models.py.

export type Units = 'metric' | 'imperial';
export type CorePlaceType = 'coffee' | 'coworking' | 'restaurant';
/** Fetched only when someone asks for them. */
export type ExtraPlaceType = 'gym' | 'park' | 'laundry';
export type PlaceType = CorePlaceType | ExtraPlaceType;

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
  timezone: string;
  currency_code: string;
  currency_symbol: string;
  currency_name: string;
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
  daylight_seconds: number | null;
}

export interface Weather {
  units: Units;
  timezone: string;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

/** Days run 0 (Sunday) to 6; minutes from midnight, local time. No close means open 24 hours. */
export interface OpeningPeriod {
  open_day: number;
  open_minute: number;
  close_day: number | null;
  close_minute: number | null;
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
  opening_hours: OpeningPeriod[] | null;
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
  nights: number;
  occupants: number;
  average_price: number | null;
  currency: string;
  stays: Stay[];
}

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  /** Units of this currency per 1 USD. */
  usd_rate: number | null;
  updated: string | null;
}

export interface Holiday {
  date: string;
  name: string;
  local_name: string;
}

export interface Advisory {
  level: number;
  title: string;
  url: string;
  updated: string | null;
}

export interface Speed {
  download_mbps: number;
  upload_mbps: number;
  latency_ms: number;
  tests: number;
}

export interface Internet {
  fixed: Speed | null;
  mobile: Speed | null;
  period: string;
}

export interface Essentials {
  timezone: string;
  currency: Currency | null;
  holidays: Holiday[] | null;
  advisory: Advisory | null;
  internet: Internet | null;
  partial: boolean;
}

export interface ClimateMonth {
  month: number;
  temperature_max: number | null;
  temperature_min: number | null;
  precipitation: number | null;
  rainy_days: number | null;
  sunshine_hours: number | null;
  best: boolean;
}

export interface Climate {
  units: Units;
  years: string;
  months: ClimateMonth[];
}

export interface PopularCity {
  id: string;
  name: string;
}

/** "country": most opened by people in the visitor's country; "site": across the whole site;
 * "none": not enough data yet, so the home page keeps its built-in list. */
export interface PopularCities {
  scope: 'country' | 'site' | 'none';
  country_code: string;
  cities: PopularCity[];
}

export type ScoreFactorKey = 'internet' | 'places' | 'cost' | 'safety' | 'climate';
export type ScoreTier = 'excellent' | 'good' | 'fair' | 'low' | 'none';

export interface ScoreFactor {
  key: ScoreFactorKey;
  name: string;
  /** Share of the score in percent once missing factors are left out; 0 when missing. */
  weight: number;
  score: number | null;
  detail: string;
}

export interface WorkScore {
  /** 0 to 100; null when too few factors have data. */
  score: number | null;
  tier: ScoreTier;
  label: string;
  counted: number;
  factors: ScoreFactor[];
}

"""Response shapes for the public API. The frontend's src/api/types.ts mirrors these."""

from typing import Literal

from pydantic import BaseModel, Field

from .city_ids import CITY_ID_PATTERN, MAX_ID_LENGTH

Units = Literal["metric", "imperial"]
PlaceType = Literal["coffee", "coworking", "restaurant", "gym", "park", "laundry"]


class City(BaseModel):
    id: str
    name: str
    state: str = ""
    state_code: str = ""
    country: str = ""
    country_code: str = ""
    lat: float
    lng: float
    formatted: str = ""
    # IANA time zone ("Europe/Lisbon") and local currency, from the geocoder's annotations.
    timezone: str = ""
    currency_code: str = ""
    currency_symbol: str = ""
    currency_name: str = ""


class CitySearchResponse(BaseModel):
    cities: list[City]


class CurrentWeather(BaseModel):
    time: str
    temperature: float | None
    apparent_temperature: float | None
    relative_humidity: float | None
    precipitation: float | None
    cloud_cover: float | None
    wind_speed: float | None
    wind_direction: float | None
    weather_code: int | None
    description: str
    is_day: bool


class HourlyForecast(BaseModel):
    time: str
    temperature: float | None
    precipitation_probability: float | None
    weather_code: int | None
    is_day: bool


class DailyForecast(BaseModel):
    date: str
    temperature_max: float | None
    temperature_min: float | None
    precipitation_probability_max: float | None
    weather_code: int | None
    description: str
    sunrise: str | None
    sunset: str | None
    daylight_seconds: float | None = None


class Weather(BaseModel):
    units: Units
    timezone: str
    current: CurrentWeather
    hourly: list[HourlyForecast]
    daily: list[DailyForecast]


class OpeningPeriod(BaseModel):
    """One opening span in the place's local time. Days run 0 (Sunday) to 6, minutes from midnight.
    A missing close means open around the clock."""

    open_day: int
    open_minute: int
    close_day: int | None
    close_minute: int | None


class Place(BaseModel):
    id: str
    name: str
    type: PlaceType
    address: str
    rating: float | None
    user_ratings_total: int
    price_level: int | None
    lat: float | None
    lng: float | None
    website: str | None
    phone: str | None
    maps_url: str
    # None when Google has no hours for the place.
    opening_hours: list[OpeningPeriod] | None = None


class PlaceCounts(BaseModel):
    coffee: int = 0
    coworking: int = 0
    restaurant: int = 0
    gym: int = 0
    park: int = 0
    laundry: int = 0
    total: int = 0


class PlacesResponse(BaseModel):
    places: list[Place]
    counts: PlaceCounts
    # True when one of the place categories couldn't be loaded and is missing.
    partial: bool = False


class Stay(BaseModel):
    id: str
    title: str
    property_type: str
    rating: float | None
    rating_word: str
    review_count: int
    stars: float | None
    price_per_night: float | None
    currency: str
    image_url: str | None
    distance_to_center: str
    is_free_cancellable: bool
    has_pool: bool
    url: str


class StaysResponse(BaseModel):
    checkin: str
    checkout: str
    nights: int = 1
    occupants: int
    average_price: float | None
    currency: str
    stays: list[Stay]


class Currency(BaseModel):
    code: str
    symbol: str
    name: str
    # Units of this currency per 1 USD; None when no rate is available.
    usd_rate: float | None
    updated: str | None


class Holiday(BaseModel):
    date: str
    name: str
    local_name: str


class Advisory(BaseModel):
    level: int
    title: str
    url: str
    updated: str | None


class Speed(BaseModel):
    download_mbps: float
    upload_mbps: float
    latency_ms: int
    tests: int


class Internet(BaseModel):
    fixed: Speed | None
    mobile: Speed | None
    period: str


class Essentials(BaseModel):
    """Practical facts for working from a city. Each part is None when its source has nothing."""

    timezone: str
    currency: Currency | None
    holidays: list[Holiday] | None
    advisory: Advisory | None
    internet: Internet | None
    # True when a source failed (as opposed to having no data for this city).
    partial: bool = False


class ClimateMonth(BaseModel):
    month: int
    temperature_max: float | None
    temperature_min: float | None
    precipitation: float | None
    rainy_days: float | None
    sunshine_hours: float | None
    best: bool


class Climate(BaseModel):
    units: Units
    years: str
    months: list[ClimateMonth]


class PopularCity(BaseModel):
    id: str
    name: str


class PopularCities(BaseModel):
    # "country": most opened by people in the visitor's country; "site": across the whole
    # site; "none": not enough data yet, so the frontend keeps its built-in list.
    scope: Literal["country", "site", "none"]
    country_code: str = ""
    cities: list[PopularCity] = []


class CityView(BaseModel):
    city_id: str = Field(max_length=MAX_ID_LENGTH, pattern=CITY_ID_PATTERN)
    # The browser's IANA time zone, used only to pick the visitor's country.
    time_zone: str = Field(default="", max_length=64)


class ErrorResponse(BaseModel):
    error: str
    message: str

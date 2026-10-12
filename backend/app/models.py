"""Response shapes for the public API. The frontend's src/api/types.ts mirrors these."""

from typing import Literal

from pydantic import BaseModel

Units = Literal["metric", "imperial"]
PlaceType = Literal["coffee", "coworking", "restaurant"]


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


class Weather(BaseModel):
    units: Units
    timezone: str
    current: CurrentWeather
    hourly: list[HourlyForecast]
    daily: list[DailyForecast]


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


class PlaceCounts(BaseModel):
    coffee: int
    coworking: int
    restaurant: int
    total: int


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
    occupants: int
    average_price: float | None
    currency: str
    stays: list[Stay]


class ErrorResponse(BaseModel):
    error: str
    message: str

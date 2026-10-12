"""Current conditions and forecast from Open-Meteo (no API key needed)."""

from typing import Any

from ..context import AppContext
from ..errors import UpstreamError
from ..http import request_json
from ..models import City, CurrentWeather, DailyForecast, HourlyForecast, Units, Weather

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
WEATHER_TTL = 30 * 60
HOURS_SHOWN = 24
DAYS_SHOWN = 7

# WMO weather interpretation codes, https://open-meteo.com/en/docs
WEATHER_DESCRIPTIONS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


def describe(code: int | None) -> str:
    return WEATHER_DESCRIPTIONS.get(code, "Unknown") if code is not None else "Unknown"


async def get_weather(ctx: AppContext, city: City, units: Units) -> Weather:
    # Rounding to ~1km lets nearby lookups share a cache entry.
    lat, lng = round(city.lat, 2), round(city.lng, 2)

    async def load() -> dict[str, Any]:
        imperial = units == "imperial"
        params = {
            "latitude": lat,
            "longitude": lng,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,"
            "precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m",
            "hourly": "temperature_2m,precipitation_probability,weather_code,is_day",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,"
            "precipitation_probability_max,sunrise,sunset,daylight_duration",
            "timezone": "auto",
            "forecast_days": DAYS_SHOWN,
            "temperature_unit": "fahrenheit" if imperial else "celsius",
            "wind_speed_unit": "mph" if imperial else "kmh",
            "precipitation_unit": "inch" if imperial else "mm",
        }
        raw = await request_json(ctx.http, "Open-Meteo", "GET", OPEN_METEO_URL, params=params)
        return parse_forecast(raw, units).model_dump()

    data = await ctx.loader.get_or_load(f"weather:{lat}:{lng}:{units}", WEATHER_TTL, load)
    return Weather.model_validate(data)


def parse_forecast(raw: dict[str, Any], units: Units) -> Weather:
    current = raw.get("current")
    if not isinstance(current, dict) or "time" not in current:
        raise UpstreamError("Open-Meteo", "response had no current conditions")

    hourly = raw.get("hourly") or {}
    daily = raw.get("daily") or {}

    # Hourly data starts at midnight local time; show the next 24 hours from now.
    hour_times: list[str] = hourly.get("time") or []
    current_hour = current["time"][:13]
    start = next((i for i, t in enumerate(hour_times) if t[:13] >= current_hour), len(hour_times))

    return Weather(
        units=units,
        timezone=str(raw.get("timezone") or "UTC"),
        current=CurrentWeather(
            time=current["time"],
            temperature=current.get("temperature_2m"),
            apparent_temperature=current.get("apparent_temperature"),
            relative_humidity=current.get("relative_humidity_2m"),
            precipitation=current.get("precipitation"),
            cloud_cover=current.get("cloud_cover"),
            wind_speed=current.get("wind_speed_10m"),
            wind_direction=current.get("wind_direction_10m"),
            weather_code=current.get("weather_code"),
            description=describe(current.get("weather_code")),
            is_day=bool(current.get("is_day", 1)),
        ),
        hourly=[
            HourlyForecast(
                time=hour_times[i],
                temperature=_at(hourly, "temperature_2m", i),
                precipitation_probability=_at(hourly, "precipitation_probability", i),
                weather_code=_at(hourly, "weather_code", i),
                is_day=bool(_at(hourly, "is_day", i, 1)),
            )
            for i in range(start, min(start + HOURS_SHOWN, len(hour_times)))
        ],
        daily=[
            DailyForecast(
                date=date,
                temperature_max=_at(daily, "temperature_2m_max", i),
                temperature_min=_at(daily, "temperature_2m_min", i),
                precipitation_probability_max=_at(daily, "precipitation_probability_max", i),
                weather_code=_at(daily, "weather_code", i),
                description=describe(_at(daily, "weather_code", i)),
                sunrise=_at(daily, "sunrise", i),
                sunset=_at(daily, "sunset", i),
                daylight_seconds=_at(daily, "daylight_duration", i),
            )
            for i, date in enumerate(daily.get("time") or [])
        ],
    )


def _at(series: dict[str, Any], key: str, index: int, default: Any = None) -> Any:
    values = series.get(key) or []
    return values[index] if index < len(values) and values[index] is not None else default

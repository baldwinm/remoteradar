"""Application settings, read from environment variables (and backend/.env in development)."""

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # "development" turns on the interactive API docs at /api/docs.
    environment: str = "production"

    opencage_api_key: str = ""
    google_api_key: str = ""
    # The Booking.com (apidojo) RapidAPI key. AIRBNB_API_KEY is the name the old
    # backend used, so existing deployments keep working without renaming it.
    rapidapi_key: str = Field(default="", validation_alias=AliasChoices("RAPIDAPI_KEY", "AIRBNB_API_KEY"))

    # When set, caches and rate limits are shared by every worker through Redis.
    # Without it each worker process keeps its own in-memory copy.
    redis_url: str | None = None
    # SQLite file for popular-city totals. The default folder is where the Render persistent
    # disk is mounted (/opt/render/project/src/data); if the folder is missing, totals stay in memory.
    stats_db_path: Path | None = BACKEND_DIR.parent / "data" / "popular.db"

    # Comma-separated list of extra origins allowed to call the API from a browser.
    # Not needed when the frontend is served from the same origin as the API.
    cors_origins: str = ""

    # The site's public address, used for canonical links and the sitemap.
    public_url: str = "https://remoteradar.net"

    # Where the built frontend lives. If the folder exists, the API also serves the site.
    frontend_dist: Path = BACKEND_DIR.parent / "frontend" / "build"

    rate_limits_enabled: bool = True
    upstream_timeout_seconds: float = 10.0
    log_level: str = "INFO"

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in {"dev", "development", "local"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

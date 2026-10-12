"""City IDs used in page URLs and API paths.

New IDs look like `santa-fe--nm--us`: a slug of the city name, an optional region
(state code where there is one), and the ISO country code, joined by `--`. Slugs never
contain `--`, so the parts can always be split apart again.

Older links used `santa_fe_us`-style IDs. Those can't be split reliably (is it
"Santa Fe" or "Santa, state FE"?), so they are treated as "name words + country".
"""

import re
import unicodedata
from dataclasses import dataclass

SEPARATOR = "--"
MAX_ID_LENGTH = 120
CITY_ID_PATTERN = r"^[\w-]{2,120}$"

_COUNTRY_CODE = re.compile(r"^[a-z]{2}$")


def slugify(text: str) -> str:
    """Lowercase, Unicode-aware slug: "Saint-Étienne" -> "saint-étienne", "St. Louis" -> "st-louis"."""
    text = unicodedata.normalize("NFKC", text).casefold()
    return re.sub(r"[\W_]+", "-", text).strip("-")


def make_city_id(name: str, region: str, country_code: str) -> str:
    parts = [slugify(name), slugify(region), country_code.lower().strip()]
    return SEPARATOR.join(part for part in parts if part)


@dataclass(frozen=True)
class CityRef:
    """What can be recovered from a city ID without asking the geocoder."""

    name: str
    region: str
    country_code: str

    @property
    def search_text(self) -> str:
        return f"{self.name}, {self.region}" if self.region else self.name


def parse_city_id(city_id: str) -> CityRef:
    if SEPARATOR in city_id:
        parts = city_id.split(SEPARATOR)
        country = parts.pop() if len(parts) > 1 and _COUNTRY_CODE.match(parts[-1]) else ""
        name = parts[0] if parts else ""
        region = parts[1] if len(parts) > 1 else ""
        return CityRef(_words(name), _words(region), country)

    # Legacy format: words_joined_by_underscores_cc
    parts = city_id.split("_")
    country = parts.pop() if len(parts) > 1 and _COUNTRY_CODE.match(parts[-1]) else ""
    return CityRef(" ".join(p for p in parts if p), "", country)


def _words(slug: str) -> str:
    return slug.replace("-", " ").strip()

"""Typical internet speeds near a city, from Ookla's open speed-test data.

The data ships with the app (app/data/internet_*.csv.gz, built by scripts/build_internet_speeds.py),
so a lookup is a few in-memory binary searches and never calls out to the network.

Source: Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps, licensed
CC BY-NC-SA 4.0 (https://github.com/teamookla/ookla-open-data). The license rules out
commercial use, so this feature has to go if the site starts making money.
"""

import gzip
import math
from array import array
from bisect import bisect_left
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Literal

from ..models import City, Internet, Speed

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
# Cells are 0.1° (about 11km). A 3x3 block around the city covers roughly a 30km square.
CELL = 10
MIN_TESTS = 50

Kind = Literal["fixed", "mobile"]


@dataclass(frozen=True)
class SpeedTable:
    """Sorted cell keys with parallel value arrays: a few MB, versus tens of MB as a dict."""

    period: str
    keys: array
    down_kbps: array
    up_kbps: array
    latency_ms: array
    tests: array

    def get(self, key: int) -> int | None:
        index = bisect_left(self.keys, key)
        return index if index < len(self.keys) and self.keys[index] == key else None


def _cell_key(lat10: int, lng10: int) -> int:
    # lat10 is in [-900, 900], lng10 in [-1800, 1800]; shift both to non-negative and pack.
    return (lat10 + 900) * 4000 + (lng10 + 1800)


@cache
def load_table(kind: Kind) -> SpeedTable | None:
    path = DATA_DIR / f"internet_{kind}.csv.gz"
    if not path.is_file():
        return None
    keys, down, up, latency, tests = array("q"), array("l"), array("l"), array("l"), array("l")
    period = ""
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("#"):
                period = line[1:].strip()
                continue
            lat10, lng10, d, u, lat, n = (int(part) for part in line.split(","))
            keys.append(_cell_key(lat10, lng10))
            down.append(d)
            up.append(u)
            latency.append(lat)
            tests.append(n)
    return SpeedTable(period, keys, down, up, latency, tests)


def _speed_near(table: SpeedTable, lat: float, lng: float) -> Speed | None:
    lat10, lng10 = math.floor(lat * CELL), math.floor(lng * CELL)
    total = down = up = latency = 0
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            # Wrap around the antimeridian so cities near ±180° still see both sides.
            neighbor_lng = (lng10 + dx + 1800) % 3600 - 1800
            index = table.get(_cell_key(lat10 + dy, neighbor_lng))
            if index is None:
                continue
            n = table.tests[index]
            total += n
            down += table.down_kbps[index] * n
            up += table.up_kbps[index] * n
            latency += table.latency_ms[index] * n
    if total < MIN_TESTS:
        return None
    return Speed(
        download_mbps=round(down / total / 1000, 1),
        upload_mbps=round(up / total / 1000, 1),
        latency_ms=round(latency / total),
        tests=total,
    )


def get_internet(city: City) -> Internet | None:
    fixed_table, mobile_table = load_table("fixed"), load_table("mobile")
    if fixed_table is None and mobile_table is None:
        return None
    fixed = _speed_near(fixed_table, city.lat, city.lng) if fixed_table else None
    mobile = _speed_near(mobile_table, city.lat, city.lng) if mobile_table else None
    if fixed is None and mobile is None:
        return None
    period = (fixed_table or mobile_table).period  # type: ignore[union-attr]
    return Internet(fixed=fixed, mobile=mobile, period=period)

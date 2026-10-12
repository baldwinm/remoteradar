"""Build backend/app/data/internet_<type>.csv.gz from Ookla's open speed-test data.

Ookla publishes quarterly averages for ~600m map tiles (Speedtest by Ookla Global Fixed and
Mobile Network Performance Maps, CC BY-NC-SA 4.0): https://github.com/teamookla/ookla-open-data

This script rolls those tiles up into 0.1° grid cells (about 11km), weighting each tile by its
number of tests, and keeps only cells with enough tests to be meaningful. The result is small
enough to ship with the app, so lookups need no network call.

Run it once a quarter or so (needs `pip install pyarrow`, which the app itself doesn't need):

    curl -o fixed.parquet https://ookla-open-data.s3.amazonaws.com/parquet/performance/type=fixed/year=2026/quarter=3/2026-07-01_performance_fixed_tiles.parquet
    curl -o mobile.parquet https://ookla-open-data.s3.amazonaws.com/parquet/performance/type=mobile/year=2026/quarter=3/2026-07-01_performance_mobile_tiles.parquet
    python scripts/build_internet_speeds.py fixed.parquet mobile.parquet --period "Q3 2026"
"""

import argparse
import gzip
import math
from collections import defaultdict
from pathlib import Path

import pyarrow.parquet as pq

OUT_DIR = Path(__file__).resolve().parent.parent / "app" / "data"
MIN_TESTS = 20
COLUMNS = ["tile_x", "tile_y", "avg_d_kbps", "avg_u_kbps", "avg_lat_ms", "tests"]


def roll_up(path: Path) -> dict[tuple[int, int], list[float]]:
    # cell -> [tests, sum(d*tests), sum(u*tests), sum(lat*tests)]
    cells: dict[tuple[int, int], list[float]] = defaultdict(lambda: [0, 0.0, 0.0, 0.0])
    parquet = pq.ParquetFile(path)
    for batch in parquet.iter_batches(columns=COLUMNS, batch_size=500_000):
        cols = batch.to_pydict()
        for x, y, d, u, lat, tests in zip(*(cols[c] for c in COLUMNS), strict=True):
            cell = cells[(math.floor(y * 10), math.floor(x * 10))]
            cell[0] += tests
            cell[1] += d * tests
            cell[2] += u * tests
            cell[3] += lat * tests
    return cells


def write(kind: str, cells: dict[tuple[int, int], list[float]], period: str) -> None:
    out = OUT_DIR / f"internet_{kind}.csv.gz"
    kept = 0
    with gzip.open(out, "wt", encoding="utf-8", newline="") as fh:
        fh.write(f"# {period}\n")
        for (lat10, lng10), (tests, d, u, lat) in sorted(cells.items()):
            if tests < MIN_TESTS:
                continue
            kept += 1
            row = (lat10, lng10, round(d / tests), round(u / tests), round(lat / tests), int(tests))
            fh.write(",".join(map(str, row)) + "\n")
    print(f"{kind}: kept {kept} of {len(cells)} cells -> {out} ({out.stat().st_size // 1024} KB)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("fixed", type=Path)
    parser.add_argument("mobile", type=Path)
    parser.add_argument("--period", required=True, help='Label shown on the site, e.g. "Q3 2026"')
    args = parser.parse_args()
    write("fixed", roll_up(args.fixed), args.period)
    write("mobile", roll_up(args.mobile), args.period)


if __name__ == "__main__":
    main()

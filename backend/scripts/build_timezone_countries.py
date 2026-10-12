"""Rebuild app/data/timezone_countries.json from the system tz database.

Maps every IANA time zone a browser might report (including old aliases such as
Asia/Calcutta) to the ISO country code it belongs to. Run from backend/:

    python scripts/build_timezone_countries.py [/usr/share/zoneinfo]
"""

import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "app" / "data" / "timezone_countries.json"


def main(zoneinfo: Path) -> None:
    countries: dict[str, str] = {}
    for line in (zoneinfo / "zone.tab").read_text().splitlines():
        if line and not line.startswith("#"):
            code, _coords, zone, *_ = line.split("\t")
            countries[zone] = code

    # tzdata.zi lists aliases as "L <target> <alias>"; give each alias its target's country.
    for line in (zoneinfo / "tzdata.zi").read_text().splitlines():
        parts = line.split()
        if len(parts) == 3 and parts[0] == "L" and parts[1] in countries:
            countries.setdefault(parts[2], countries[parts[1]])

    OUT.write_text(json.dumps(dict(sorted(countries.items())), separators=(",", ":")) + "\n")
    print(f"Wrote {len(countries)} time zones to {OUT}")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "/usr/share/zoneinfo"))

# Remote Radar

Remote Radar helps remote workers size up a city before they go: a 0-100 remote work score, current
weather and forecast, the best months to visit, coffee shops, coworking spaces, restaurants, gyms, parks and
laundromats, hotel prices for any dates, internet speed, local time and work-hours overlap, currency and
exchange rate, public holidays, and a map, all on one page. Cities can be saved (on the visitor's device) and
compared side by side, in light or dark and in °C or °F.

The site has four pages: home (`/`), a city (`/city/{id}`), compare (`/compare`) and the privacy policy
(`/privacy`).

## How it fits together

```
browser ──► FastAPI (backend/) ──► OpenCage, Google Places (New), Open-Meteo, Booking (RapidAPI),
              │                    ExchangeRate-API, Nager.Date
              ├── internet speeds from Ookla open data shipped in backend/app/data/
              ├── popular-city totals and daily provider usage in SQLite (data/popular.db)
              └── serves the built React app (frontend/build) from the same origin
```

- **frontend/** is a React 19 + TypeScript single-page app built with Vite. It only calls same-origin
  `/api/...` URLs, so no API keys or backend URLs are baked into it.
- **backend/** is a FastAPI app. It proxies the third-party APIs so their keys stay on the server,
  caches every upstream response, rate-limits each visitor (by a hash of their IP, never the IP itself),
  caps the total daily calls to the paid providers, and serves the built frontend. One service, one origin,
  one deploy.
- **Redis** (optional) shares the cache and rate-limit counters across workers and restarts. Without
  `REDIS_URL` the app falls back to an in-memory cache per worker.

The frontend and backend are separate codebases with their own tooling, but they deploy together as
one service.

## API

Every endpoint is `GET` except `POST /api/views`, and all return JSON. Errors look like
`{"error": "not_found", "message": "..."}`; a provider whose daily cap is spent answers 503
`service_unavailable`.

| Endpoint | What it returns |
| --- | --- |
| `/api/health` | `{"status": "ok"}` |
| `/api/cities?q=santa+fe` | Up to 5 matching cities, each with a stable `id` like `santa-fe--nm--us` |
| `/api/cities/{id}` | One city (name, region, country, coordinates, time zone, currency) |
| `/api/cities/{id}/weather?units=metric` | Current conditions, the next 24 hours, and 7 days (`metric` or `imperial`) |
| `/api/cities/{id}/places?type=coffee` | Coffee shops, coworking spaces and restaurants with opening hours (`type` narrows them; `gym`, `park` or `laundry` fetches that category on demand) |
| `/api/cities/{id}/stays?occupants=2&checkin=2026-11-02&nights=30` | Hotels with an average nightly price (`occupants` 1-8, default 1; `checkin` defaults to a week from today; `nights` defaults to 1, max 30) |
| `/api/cities/{id}/essentials` | Time zone, currency and USD rate, public holidays in the next 60 days, internet speed |
| `/api/cities/{id}/climate?units=metric` | Monthly averages over the last five years, with the three best months marked |
| `/api/cities/{id}/score` | The remote work score (0-100) and its factors: internet 29, places to work 29, cost 24, climate 18. A factor without data drops out and the rest are reweighted |
| `/api/popular?tz=Europe/Lisbon` | The cities opened most in the last 30 days by people in the visitor's country (from the browser time zone), or site-wide when there's too little data |
| `POST /api/views` | Body `{"city_id": "...", "time_zone": "..."}`. Counts one city page view toward the popular lists; returns 204 |
| `/sitemap.xml` | Home, privacy and featured city pages, for search engines |

City pages (`/city/{id}`) are sent with the city's own title, description and link-preview tags.
Each endpoint has its own per-visitor rate limit (see `backend/app/routes/api.py`).

### Internet speed data

Speeds come from Ookla's open data (Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps,
[CC BY-NC-SA 4.0](https://github.com/teamookla/ookla-open-data)), rolled up into ~11km cells and shipped in
`backend/app/data/`. The license is non-commercial. To refresh it each quarter, see
`backend/scripts/build_internet_speeds.py`.

City IDs from the old app (`paris_fr`) still resolve, and the city page redirects them to the new form.
With `ENVIRONMENT=development`, interactive API docs are at `/api/docs`.

## Running it locally

You need Python 3.12+ (3.13 recommended) and Node 20.19+ (24 recommended).

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # then fill in the API keys
uvicorn app.main:app --reload --port 8000

# Frontend, in a second terminal
cd frontend
npm ci
npm run dev                   # http://localhost:3000, proxies /api to :8000
```

To run the production setup locally instead, build the frontend (`npm run build`) and start the backend
with `gunicorn wsgi:app` from `backend/`; it then serves the whole site on port 8000.

## Configuration

Backend settings come from environment variables (or `backend/.env` locally):

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENCAGE_API_KEY` | Yes | City search and lookup |
| `GOOGLE_API_KEY` | Yes | Needs **Places API (New)** enabled in Google Cloud |
| `RAPIDAPI_KEY` | Yes | RapidAPI key subscribed to the apidojo Booking API (`AIRBNB_API_KEY` is still accepted) |
| `REDIS_URL` | No | Shared cache and rate limits; in-memory fallback without it |
| `STATS_DB_PATH` | No | SQLite file for popular-city totals and provider usage counts (default `data/popular.db` at the repo root; memory if that folder is missing) |
| `GOOGLE_PLACES_DAILY_LIMIT` | No | Site-wide cap on Google Places calls per UTC day (default 1000; `0` = no cap). A new city page costs 3, and a gym, park or laundry lookup 1 more |
| `OPENCAGE_DAILY_LIMIT` | No | Site-wide cap on geocoder calls per UTC day (default 2500, OpenCage's free-tier limit) |
| `BOOKING_DAILY_LIMIT` | No | Site-wide cap on RapidAPI Booking calls per UTC day (default 500) |
| `IP_HASH_SECRET` | No | Only with `REDIS_URL` and several processes: shared secret for hashing visitor IPs in rate-limit counters |
| `CORS_ORIGINS` | No | Comma-separated; only needed if a frontend on another origin calls the API |
| `ENVIRONMENT` | No | `production` (default) or `development` |
| `PUBLIC_URL` | No | The site's address for canonical links and the sitemap (default `https://remoteradar.net`) |
| `LOG_LEVEL` | No | Default `INFO` |
| `WEB_CONCURRENCY` | No | Gunicorn worker count (default 2) |
| `FORWARDED_ALLOW_IPS` | No | Proxies whose forwarded headers Gunicorn trusts (default `*`). Rate limits pick the visitor's address themselves and don't depend on it |

Frontend build-time variables (all optional):

| Variable | Notes |
| --- | --- |
| `VITE_MAPBOX_TOKEN` | Public Mapbox token. Restrict it to your domains in the Mapbox dashboard |
| `VITE_API_BASE_URL` | Only if the API is on a different origin than the site |

## Tests and checks

```bash
cd backend && pytest && ruff check . && ruff format --check .
cd frontend && npm run lint && npm test && npm run build
```

CI runs all of these plus a Docker build and smoke test on every push and pull request.

## Deploying

The site runs as one web service: the API serves the built frontend from the same origin.

**Render (the live setup).** A native Python web service with **Root Directory** left blank:

- Build command: `cd frontend && npm ci --include=dev && npm run build && cd ../backend && pip install -r requirements.txt`
- Start command: `cd backend && gunicorn wsgi:app` (the worker class and port come from
  `backend/gunicorn.conf.py`)
- Health check path: `/api/health`
- Environment: the three API keys above. Render picks up the Python and Node versions from
  `.python-version` and `.node-version`.
- Instance: a paid plan (`starter` in `render.yaml`) with a 5 GB persistent disk mounted at
  `/opt/render/project/src/data` (see below). A paid instance stays awake, so there's no cold start.

The custom domains `remoteradar.net` and `www.remoteradar.net` point at this service, and pushes to
`main` redeploy it. `render.yaml` is a Blueprint with the same settings, for recreating the service. To
share the cache and rate limits across workers and restarts, add a Render Key Value instance and set
`REDIS_URL` to its internal connection URL.

The home page's popular cities come from daily totals of city page views, grouped by the visitor's
country (from the browser time zone, never the IP). The totals, and the daily usage counts behind the
provider caps, live in a SQLite file on a Render persistent disk mounted at
`/opt/render/project/src/data`, so they survive restarts and deploys. A disk needs a paid instance, limits
the service to one instance, and means a few seconds of downtime on each deploy. Without the disk the
totals live in memory and reset on every restart, and the home page shows its built-in cities.

**Docker.** The `Dockerfile` builds the same single service for any host that runs containers. CI builds
and smoke-tests it on every push. Inside the image the default stats file would be `/app/data/popular.db`,
so mount a volume there (or set `STATS_DB_PATH`) to keep popular-city totals across restarts.

`Documentation_v1.pdf` describes the original Flask version and is kept only for history; this README is
the current documentation.

## License

MIT License

Copyright (c) [2026] [Mike Baldwin]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

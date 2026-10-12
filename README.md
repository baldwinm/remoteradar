# Remote Radar

Remote Radar helps remote workers size up a city before they go: current weather and forecast,
coffee shops, coworking spaces and restaurants, hotel prices, and a map, all on one page.

## How it fits together

```
browser ──► FastAPI (backend/) ──► OpenCage, Google Places (New), Open-Meteo, Booking (RapidAPI)
              │
              └── serves the built React app (frontend/build) from the same origin
```

- **frontend/** is a React 19 + TypeScript single-page app built with Vite. It holds no API keys.
  It calls `/api/...` on its own origin, unless `VITE_API_BASE_URL` points it at a separate API
  service (production builds do, via `frontend/.env.production`).
- **backend/** is a FastAPI app. It proxies the third-party APIs so their keys stay on the server,
  caches every upstream response, rate-limits per client IP, and can also serve the frontend build,
  so the whole site can run as one process on one origin.
- **Redis** (optional) shares the cache and rate-limit counters across workers and restarts. Without
  `REDIS_URL` the app falls back to an in-memory cache per worker.

The frontend and backend are separate codebases with their own tooling. They can be deployed together
(one service, same origin) or separately (a static site calling the API cross-origin).

## API

All endpoints are `GET` and return JSON. Errors look like `{"error": "not_found", "message": "..."}`.

| Endpoint | What it returns |
| --- | --- |
| `/api/health` | `{"status": "ok"}` |
| `/api/cities?q=santa+fe` | Up to 5 matching cities, each with a stable `id` like `santa-fe--nm--us` |
| `/api/cities/{id}` | One city (name, region, country, coordinates) |
| `/api/cities/{id}/weather?units=metric` | Current conditions, the next 24 hours, and 7 days (`metric` or `imperial`) |
| `/api/cities/{id}/places?type=coffee` | Coffee shops, coworking spaces and restaurants (`type` is optional) |
| `/api/cities/{id}/stays?occupants=2` | Hotels for one night a week from today, with an average nightly price |

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
| `CORS_ORIGINS` | No | Comma-separated browser origins allowed to call the API cross-origin; defaults to `https://remoteradar.net` and `https://www.remoteradar.net` |
| `ENVIRONMENT` | No | `production` (default) or `development` |
| `WEB_CONCURRENCY` | No | Gunicorn worker count (default 2) |

Frontend build-time variables (all optional):

| Variable | Notes |
| --- | --- |
| `VITE_MAPBOX_TOKEN` | Public Mapbox token. Restrict it to your domains in the Mapbox dashboard |
| `VITE_API_BASE_URL` | Where the API lives. Production builds use `https://remote-radar-backend.onrender.com` (set in `frontend/.env.production`); set it empty to use same-origin `/api` |

## Tests and checks

```bash
cd backend && pytest && ruff check . && ruff format --check .
cd frontend && npm run lint && npm test && npm run build
```

CI runs all of these plus a Docker build and smoke test on every push and pull request.

## Deploying

**Single service (recommended).** The `Dockerfile` builds the frontend and runs the API with gunicorn,
serving everything from one origin. `render.yaml` is a Render Blueprint for this setup with a free Redis
(Key Value) instance; set the three API keys in the Render dashboard.

**Two Render services (the current live setup).** The static site calls the API service cross-origin:

- Web service `remote-radar-backend`: root `backend`, build `pip install -r requirements.txt`, start
  `gunicorn wsgi:app` (the worker class and port come from `backend/gunicorn.conf.py`).
- Static site: root `frontend`, build command `npm run build`, publish directory `build`, with a rewrite
  from `/*` to `/index.html`. The build output is no longer committed, so the build command is required.
  Set `NODE_VERSION=24` if Render does not pick up `.node-version`.
- If the API service's URL or the site's domain changes, update `frontend/.env.production` or set
  `VITE_API_BASE_URL` on the static site, and set `CORS_ORIGINS` on the API service.

`Documentation_v1.pdf` describes the original Flask version and is out of date.

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

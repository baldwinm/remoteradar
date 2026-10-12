# syntax=docker/dockerfile:1
# One image that serves both the site and the API from the same origin.

# --- Build the frontend -------------------------------------------------------
FROM node:24-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Optional: override the Mapbox public token baked into the bundle.
ARG VITE_MAPBOX_TOKEN
# This image serves the API itself, so call it on the same origin instead of the
# separate Render API service that frontend/.env.production points at.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# --- Python runtime -----------------------------------------------------------
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=frontend /app/frontend/build /app/frontend/build
RUN useradd --create-home --uid 10001 app
USER app
EXPOSE 8000
# gunicorn.conf.py (in this directory) sets the worker class, port and proxy settings.
CMD ["gunicorn", "wsgi:app"]

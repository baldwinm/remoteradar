"""Search-engine and link-preview friendly city pages.

The site is a single-page app, so without help every URL would arrive with the same generic
title. For /city/... requests this fills in the city's own title, description, canonical URL
and Open Graph tags before sending index.html, plus a short text summary inside #root that
React replaces once it starts.
"""

import asyncio
import logging
import math
import re
import time
from html import escape
from urllib.parse import quote, unquote

from fastapi import Request

from .city_ids import CITY_ID_PATTERN
from .context import AppContext
from .models import City
from .ratelimit import client_ip
from .services import geocoding

logger = logging.getLogger(__name__)

RESOLVE_TIMEOUT_SECONDS = 3.0
# Crawlers can hit many cities quickly; past this, pages fall back to the generic title
# instead of spending geocoder quota.
LOOKUPS_PER_MINUTE = 30

# Cities listed in /sitemap.xml (the same ones the home page features).
SITEMAP_CITY_IDS = (
    "lisbon--pt",
    "mexico-city--mx",
    "chiang-mai--th",
    "medellín--co",
    "tbilisi--ge",
    "bali--id",
    "barcelona--es",
    "berlin--de",
    "buenos-aires--ar",
    "cape-town--za",
    "porto--pt",
    "valencia--es",
    "da-nang--vn",
    "bangkok--th",
    "tokyo--jp",
    "austin--tx--us",
    "santa-fe--nm--us",
)

_ID = re.compile(CITY_ID_PATTERN)
_TITLE = re.compile(r"<title>.*?</title>", re.DOTALL)
_DESCRIPTION = re.compile(r'<meta name="description"[^>]*>')
_GENERIC_OG = re.compile(r'\s*<meta property="og:[^"]*"[^>]*>')
_ROOT = '<div id="root"></div>'


async def city_page_html(request: Request, base_html: str, full_path: str) -> str:
    """index.html with this city's meta tags, or the unchanged page when the city can't be resolved."""
    city_id = unquote(full_path.removeprefix("city/")).strip("/")
    if not _ID.match(city_id):
        return base_html
    ctx: AppContext = request.app.state.context
    if not await _within_budget(ctx, request):
        return base_html
    try:
        city = await asyncio.wait_for(geocoding.resolve_city(ctx, city_id), RESOLVE_TIMEOUT_SECONDS)
    except Exception as exc:  # noqa: BLE001 - any failure just means the generic page
        logger.info("No city meta for %s: %s", city_id, type(exc).__name__)
        return base_html
    return render_city_meta(base_html, city, ctx.settings.public_url)


async def _within_budget(ctx: AppContext, request: Request) -> bool:
    window = math.floor(time.time() / 60)
    count = await ctx.cache.incr(f"rl:seo:{client_ip(request)}:{window}", 60)
    return count <= LOOKUPS_PER_MINUTE


def render_city_meta(base_html: str, city: City, public_url: str) -> str:
    place = ", ".join(part for part in (city.state if city.state != city.name else "", city.country) if part)
    full_name = f"{city.name}, {place}" if place else city.name
    title = f"{full_name}: remote work guide - Remote Radar"
    description = (
        f"Working from {city.name}? Weather and the best months to go, hotel prices, coffee shops, "
        f"coworking spaces, internet speed, local time and currency for {full_name}."
    )
    url = f"{public_url.rstrip('/')}/city/{quote(city.id)}"

    t, d, u = escape(title), escape(description), escape(url)
    tags = "\n    ".join(
        [
            f'<meta name="description" content="{d}" />',
            f'<link rel="canonical" href="{u}" />',
            '<meta property="og:type" content="website" />',
            '<meta property="og:site_name" content="Remote Radar" />',
            f'<meta property="og:title" content="{t}" />',
            f'<meta property="og:description" content="{d}" />',
            f'<meta property="og:url" content="{u}" />',
            '<meta name="twitter:card" content="summary" />',
        ]
    )
    summary = f'<div id="root"><main><h1>{escape(full_name)}</h1><p>{d}</p></main></div>'

    html = _TITLE.sub(lambda _: f"<title>{t}</title>", _GENERIC_OG.sub("", base_html))
    if _DESCRIPTION.search(html):
        html = _DESCRIPTION.sub(lambda _: tags, html, count=1)
    else:
        html = html.replace("</head>", f"    {tags}\n  </head>", 1)
    return html.replace(_ROOT, summary, 1)


def sitemap_xml(public_url: str) -> str:
    base = public_url.rstrip("/")
    urls = [f"{base}/", *(f"{base}/city/{quote(city_id)}" for city_id in SITEMAP_CITY_IDS)]
    entries = "\n".join(f"  <url><loc>{escape(url)}</loc></url>" for url in urls)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{entries}\n</urlset>\n"
    )

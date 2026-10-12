"""Entry point kept for the existing `gunicorn wsgi:app` start command.

Despite the file name the app is ASGI; gunicorn.conf.py (loaded automatically from this
directory) switches gunicorn to Uvicorn workers so the old command keeps working.
"""

from app.main import app

__all__ = ["app"]

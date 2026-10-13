# Gunicorn reads this file automatically when started from the backend/ directory,
# so `gunicorn wsgi:app` needs no extra flags.
import os

worker_class = "uvicorn_worker.UvicornWorker"
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
# Async workers handle many concurrent requests each; two is plenty for a small instance.
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
timeout = 60
graceful_timeout = 20
keepalive = 5
# Trust the platform's forwarded headers (mainly X-Forwarded-Proto). Rate limits don't rely
# on this: app/ratelimit.py picks the visitor's address itself, ignoring the forgeable
# first X-Forwarded-For entry that uvicorn would use here.
forwarded_allow_ips = os.environ.get("FORWARDED_ALLOW_IPS", "*")
accesslog = None  # the app logs one line per request itself

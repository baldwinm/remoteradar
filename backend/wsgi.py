# wsgi.py
from app import app

# Explicitly expose the app attribute for Gunicorn
app = app

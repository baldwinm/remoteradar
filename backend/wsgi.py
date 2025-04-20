# wsgi.py
from app import app as application

# This file is used by Gunicorn to serve the application
# The name 'application' is used because Gunicorn expects a WSGI callable named 'application'

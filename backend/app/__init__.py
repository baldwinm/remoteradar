"""Remote Radar backend."""


def __getattr__(name: str):
    # Lets `gunicorn app:app` keep working for deployments still using the old start command.
    if name == "app":
        from .main import app

        return app
    raise AttributeError(name)

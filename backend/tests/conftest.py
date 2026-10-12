import pytest
import respx
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def make_settings(**overrides) -> Settings:
    values = {
        "opencage_api_key": "test-opencage",
        "google_api_key": "test-google",
        "rapidapi_key": "test-rapidapi",
        "redis_url": None,
        "frontend_dist": "/nonexistent",
        "rate_limits_enabled": True,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.fixture
def mock_upstream():
    with respx.mock(assert_all_called=False) as router:
        yield router


@pytest.fixture
def client(mock_upstream):
    with TestClient(create_app(make_settings())) as test_client:
        yield test_client


def opencage_result(
    name="Santa Fe",
    state="New Mexico",
    state_code="NM",
    country="United States of America",
    country_code="us",
    lat=35.687,
    lng=-105.9378,
    kind="city",
):
    return {
        "components": {
            "_type": kind,
            kind: name,
            "state": state,
            "state_code": state_code,
            "country": country,
            "country_code": country_code,
        },
        "geometry": {"lat": lat, "lng": lng},
        "formatted": f"{name}, {state}, {country}",
    }


def opencage_response(*results):
    return {"status": {"code": 200, "message": "OK"}, "results": list(results)}

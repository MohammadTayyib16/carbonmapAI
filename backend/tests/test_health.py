from app.api.v1.endpoints.health import get_health
from app.core.config import settings

def test_health_endpoint():
    res = get_health()
    assert res.status == "ok"
    assert res.app == settings.APP_NAME
    assert res.version == settings.VERSION
    assert res.environment == "development"
    assert res.database in ("connected", "disconnected")

def test_cors_configuration():
    assert "http://localhost:3000" in settings.ALLOWED_ORIGINS
    assert "http://127.0.0.1:3000" in settings.ALLOWED_ORIGINS

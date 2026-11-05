from app.main import app

def test_app_metadata():
    assert app.title == "CarbonMap AI"
    assert app.version == "0.1.0"
    assert app.docs_url == "/docs"
    assert app.redoc_url == "/redoc"
    assert app.openapi_url == "/openapi.json"

def test_routes_registered():
    openapi_schema = app.openapi()
    paths = openapi_schema["paths"]
    assert "/api/health" in paths
    assert "/health" in paths
    assert "/api/v1/dashboard/summary" in paths
    assert "/api/v1/emissions" in paths
    assert "/api/v1/suppliers" in paths
    assert "/api/v1/documents" in paths
    assert "/api/v1/reports" in paths

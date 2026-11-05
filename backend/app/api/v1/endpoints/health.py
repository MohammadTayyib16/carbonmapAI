from fastapi import APIRouter
from app.schemas.health import HealthResponse
from app.core.config import settings
from app.core.database import engine

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
@router.get("/api/health", response_model=HealthResponse)
def get_health():
    """
    Service health check endpoint.
    Returns service operational status, version, and database connection readiness.
    """
    db_status = "connected" if engine is not None else "disconnected"
    return HealthResponse(
        status="ok",
        app=settings.APP_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        database=db_status,
    )

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.v1.api import api_router
from app.api.v1.endpoints.health import get_health
from app.schemas.health import HealthResponse

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager.
    Runs database schema initialization on startup.
    """
    init_db()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Backend API for CarbonMap AI — AI-assisted carbon footprint reporting for small businesses.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS Middleware for React frontend (http://localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root-level Health Check endpoints required by specification
@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
@app.get("/health", response_model=HealthResponse, tags=["Health"])
def root_health():
    """
    Direct health check endpoint returning service operational status.
    """
    return get_health()

# Register API v1 routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

@app.get("/", tags=["Root"])
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/docs",
        "health_url": "/api/health",
    }

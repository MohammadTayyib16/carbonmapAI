from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    dashboard,
    emissions,
    suppliers,
    documents,
    reports,
    gis,
)

api_router = APIRouter()

# Include feature endpoint routers
api_router.include_router(health.router)
api_router.include_router(dashboard.router)
api_router.include_router(emissions.router)
api_router.include_router(suppliers.router)
api_router.include_router(documents.router)
api_router.include_router(reports.router)
api_router.include_router(gis.router)

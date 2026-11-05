import math
import logging
from typing import List, Dict, Any, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.supplier import Supplier
from app.core.factors import VEHICLE_EMISSION_FACTORS, calculate_transport_emissions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gis", tags=["GIS & Spatial Routing"])

# Manufacturer Profile (Anchor OEM Company: Tata Motors, Pune, Maharashtra, India)
MANUFACTURER_PROFILE = {
    "id": "MFG-TM-PUNE",
    "company_name": "Tata Motors Ltd",
    "name": "Tata Motors Manufacturing Plant – Pune, Maharashtra",
    "plant_name": "Tata Motors Manufacturing Plant – Pune, Maharashtra",
    "facility_code": "MFG-TM-PUNE",
    "type": "Primary Manufacturing Plant (OEM Anchor)",
    "category": "Passenger & Commercial Vehicles Manufacturing",
    "location": "Pimpri Industrial Belt, Pune, Maharashtra 411018, India",
    "city": "Pune",
    "state": "Maharashtra",
    "country": "India",
    "latitude": 18.6445,
    "longitude": 73.8123,
    "scope1_emissions": 34.8,
    "scope2_emissions": 58.6,
    "coordinates_verification": "Verified Public Geographic Location (Pimpri Industrial Zone, Pune)",
}

# Regional Secondary Facilities in the Pune Industrial Cluster
SECONDARY_FACILITIES = [
    {
        "id": "FAC-IND-02",
        "name": "Tata Motors CV Assembly Plant (Bhosari)",
        "type": "Factory",
        "category": "Commercial Vehicle & Chassis Assembly",
        "location": "Bhosari MIDC, Pune, Maharashtra, India",
        "city": "Pune",
        "state": "Maharashtra",
        "country": "India",
        "latitude": 18.6276,
        "longitude": 73.8344,
        "scope1_emissions": 26.4,
        "scope2_emissions": 41.2,
        "coordinates_verification": "Verified Public Geographic Location (Bhosari MIDC, Pune)",
    },
    {
        "id": "FAC-IND-03",
        "name": "Talegaon Regional Inbound Logistics Hub",
        "type": "Warehouse",
        "category": "Auto Component Sequencing & Logistics Depot",
        "location": "Talegaon MIDC Logistics Park, Pune, Maharashtra, India",
        "city": "Pune",
        "state": "Maharashtra",
        "country": "India",
        "latitude": 18.7300,
        "longitude": 73.6700,
        "scope1_emissions": 12.1,
        "scope2_emissions": 18.5,
        "coordinates_verification": "Verified Public Geographic Location (Talegaon MIDC, Pune)",
    },
]


class RouteRequest(BaseModel):
    origin_lat: float = Field(..., ge=-90.0, le=90.0)
    origin_lng: float = Field(..., ge=-180.0, le=180.0)
    origin_name: Optional[str] = "Tata Motors Manufacturing Plant – Pune"
    destination_lat: float = Field(..., ge=-90.0, le=90.0)
    destination_lng: float = Field(..., ge=-180.0, le=180.0)
    destination_name: Optional[str] = "Supplier Facility"
    vehicle_type: Optional[str] = "hgv_diesel"
    cargo_tonnes: Optional[float] = Field(None, ge=0.0)
    return_trip: Optional[bool] = False


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance in kilometers using the Haversine formula."""
    R = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


@router.get("/factors")
def get_vehicle_factors():
    """
    Returns documented transport emission factor library with explicit country citations.
    """
    return VEHICLE_EMISSION_FACTORS


@router.get("/manufacturer")
def get_manufacturer_profile():
    """
    Returns the anchor manufacturing company profile (Tata Motors, Pune, Maharashtra).
    """
    return MANUFACTURER_PROFILE


@router.get("/locations")
def get_gis_locations(db: Session = Depends(get_db)):
    """
    Retrieves spatial points for the Tata Motors Pune plant, secondary facilities,
    and all suppliers in the database.
    Computes emission hotspots and Maharashtra regional industrial distribution.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    suppliers_db = db.query(Supplier).all()

    supplier_points = []
    regional_counts: Dict[str, Dict[str, float]] = {
        "Pimpri-Chinchwad Manufacturing Belt": {
            "count": 1,
            "emissions": MANUFACTURER_PROFILE["scope1_emissions"],
        },
        "Chakan Auto Industrial Corridor": {
            "count": 0,
            "emissions": 0.0,
        },
        "Talegaon Logistics & Warehousing Hub": {
            "count": 1,
            "emissions": SECONDARY_FACILITIES[1]["scope1_emissions"],
        },
        "Pune Urban & Hadapsar Industrial Zone": {
            "count": 1,
            "emissions": SECONDARY_FACILITIES[0]["scope1_emissions"],
        },
    }

    for sup in suppliers_db:
        loc_str = (sup.location or "").lower()
        name_str = (sup.name or "").lower()

        # Categorize into regional industrial cluster
        if "chakan" in loc_str or "chakan" in name_str:
            reg = "Chakan Auto Industrial Corridor"
        elif "talegaon" in loc_str or "talegaon" in name_str:
            reg = "Talegaon Logistics & Warehousing Hub"
        elif "hadapsar" in loc_str or "pune" in loc_str and "pimpri" not in loc_str:
            reg = "Pune Urban & Hadapsar Industrial Zone"
        else:
            reg = "Pimpri-Chinchwad Manufacturing Belt"

        if reg in regional_counts:
            regional_counts[reg]["count"] += 1
            regional_counts[reg]["emissions"] += round(sup.emissions_tons or 0.0, 2)

        # Hotspot classification based on emissions >= 20 tCO2e
        is_hotspot = (sup.emissions_tons or 0.0) >= 20.0

        # Component supply relationship mapping to Tata Motors
        category_lower = (sup.category or "").lower()
        if "powertrain" in category_lower or "component" in category_lower or "engine" in category_lower:
            relationship = "Supplies Powertrain & Engine Assemblies to Tata Motors Pimpri Plant"
        elif "steel" in category_lower or "stamping" in category_lower:
            relationship = "Supplies High-Tensile Body Panels & Structural Steel"
        elif "packaging" in category_lower:
            relationship = "Supplies Returnable Transit Crates & Dunnage"
        elif "logistic" in category_lower or "freight" in category_lower:
            relationship = "Inbound Component Sequencing & Cross-Dock Haulage"
        else:
            relationship = "Tier-1 Supply Chain Partner to Tata Motors Plant"

        supplier_points.append({
            "id": sup.supplier_code or f"SUP-IND-{sup.id:02d}",
            "db_id": sup.id,
            "name": sup.name,
            "type": "Supplier / Manufacturer",
            "category": sup.category,
            "location": sup.location,
            "latitude": sup.latitude,
            "longitude": sup.longitude,
            "distance_km": sup.distance_km,
            "annual_spend": sup.annual_spend,
            "emissions_tons": sup.emissions_tons,
            "intensity": sup.intensity,
            "esg_rating": sup.esg_rating,
            "status": sup.status,
            "is_hotspot": is_hotspot,
            "connected_to": MANUFACTURER_PROFILE["id"],
            "relationship": relationship,
            "is_synthetic": "[Synthetic Demo]" in (sup.name or "") or "[Synthetic" in (sup.name or ""),
        })

    # Sort hotspots descending by emissions
    hotspots = sorted(
        [s for s in supplier_points if s["is_hotspot"] or s["emissions_tons"] >= 10.0],
        key=lambda x: x["emissions_tons"],
        reverse=True,
    )

    return {
        "manufacturer": MANUFACTURER_PROFILE,
        "primary_facility": MANUFACTURER_PROFILE,
        "secondary_facilities": SECONDARY_FACILITIES,
        "suppliers": supplier_points,
        "hotspots": hotspots,
        "regional_distribution": regional_counts,
        "total_nodes": 1 + len(SECONDARY_FACILITIES) + len(supplier_points),
    }


@router.post("/route")
async def calculate_gis_route(req: RouteRequest):
    """
    Computes road routing between origin and destination via OSRM.
    Returns real road polyline coordinates, distance, duration, and deterministic DEFRA emissions.
    Falls back gracefully to road-detour Haversine if external OSRM is unreachable.
    """
    osrm_url = (
        f"http://router.project-osrm.org/route/v1/driving/"
        f"{req.origin_lng},{req.origin_lat};{req.destination_lng},{req.destination_lat}"
        f"?overview=full&geometries=geojson"
    )

    route_geometry = None
    distance_km = 0.0
    duration_min = 0.0
    engine_used = "OSRM Indian Road Network (OpenStreetMap)"

    try:
        async with httpx.AsyncClient(timeout=4.5) as client:
            resp = await client.get(osrm_url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    first_route = data["routes"][0]
                    # OSRM returns distance in meters
                    distance_km = round(first_route["distance"] / 1000.0, 2)
                    duration_min = round(first_route["duration"] / 60.0, 1)
                    # Coordinates in GeoJSON are [[lng, lat], ...]
                    route_geometry = first_route["geometry"]["coordinates"]
    except Exception as e:
        logger.info(f"OSRM service call skipped or timed out ({str(e)}). Using Haversine road detour fallback.")

    # Fallback to realistic Indian road network detour approximation if OSRM is offline
    if not route_geometry:
        straight_km = haversine_distance(req.origin_lat, req.origin_lng, req.destination_lat, req.destination_lng)
        # Indian arterial / state highway circuity factor is ~1.30x
        distance_km = round(straight_km * 1.30, 2)
        # Average freight speed in industrial corridor ~45-50 km/h
        duration_min = round((distance_km / 48.0) * 60.0, 1)
        engine_used = "Haversine Detour Approximation (1.30x Road Circuity Detour Factor - OSRM Offline)"

        # Generate an interpolated curved road line for visual representation
        num_points = 12
        route_geometry = []
        for i in range(num_points + 1):
            t = i / float(num_points)
            lat = req.origin_lat + t * (req.destination_lat - req.origin_lat)
            lng = req.origin_lng + t * (req.destination_lng - req.origin_lng)
            # Add slight industrial corridor curvature
            offset = math.sin(t * math.pi) * 0.025
            route_geometry.append([round(lng + offset, 5), round(lat, 5)])

    # Calculate deterministic transport emissions using documented factors
    emissions_data = calculate_transport_emissions(
        distance_km=distance_km,
        vehicle_type=req.vehicle_type or "hgv_diesel",
        cargo_tonnes=req.cargo_tonnes,
        return_trip=req.return_trip or False,
    )

    return {
        "engine": engine_used,
        "origin": {
            "name": req.origin_name,
            "latitude": req.origin_lat,
            "longitude": req.origin_lng,
        },
        "destination": {
            "name": req.destination_name,
            "latitude": req.destination_lat,
            "longitude": req.destination_lng,
        },
        "distance_km": distance_km,
        "duration_min": duration_min,
        "geometry": route_geometry,
        "emissions": emissions_data,
    }


@router.get("/geocode")
async def geocode_location(q: str = Query(..., min_length=2, description="Address or Indian city to geocode")):
    """
    Geocodes an address or city using Nominatim OpenStreetMap prioritizing India,
    with curated Maharashtra & Indian industrial city fallbacks.
    """
    clean_q = q.strip()
    url = f"https://nominatim.openstreetmap.org/search?q={httpx.URL(clean_q)}&format=json&limit=5&countrycodes=in"

    try:
        headers = {"User-Agent": "CarbonMapAI-Indian-Supply-Chain/1.0 (academic-sustainability-app)"}
        async with httpx.AsyncClient(timeout=3.5, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                results = resp.json()
                if results:
                    return [
                        {
                            "display_name": r.get("display_name"),
                            "latitude": float(r["lat"]),
                            "longitude": float(r["lon"]),
                            "type": r.get("type", "address"),
                        }
                        for r in results
                    ]
    except Exception:
        pass

    # Curated geographic fallbacks for Pune and Indian industrial centers
    INDIAN_CITIES = {
        "pune": {"display_name": "Pune, Maharashtra, India", "lat": 18.5204, "lon": 73.8567},
        "pimpri": {"display_name": "Pimpri-Chinchwad, Pune, Maharashtra, India", "lat": 18.6298, "lon": 73.7997},
        "chinchwad": {"display_name": "Chinchwad, Pune, Maharashtra, India", "lat": 18.6298, "lon": 73.7997},
        "chakan": {"display_name": "Chakan MIDC Industrial Area, Pune, Maharashtra, India", "lat": 18.7606, "lon": 73.8540},
        "talegaon": {"display_name": "Talegaon Dabhade Logistics Park, Pune, Maharashtra, India", "lat": 18.7300, "lon": 73.6700},
        "bhosari": {"display_name": "Bhosari MIDC, Pune, Maharashtra, India", "lat": 18.6276, "lon": 73.8344},
        "hadapsar": {"display_name": "Hadapsar Industrial Estate, Pune, Maharashtra, India", "lat": 18.5089, "lon": 73.9259},
        "mumbai": {"display_name": "Mumbai, Maharashtra, India", "lat": 19.0760, "lon": 72.8777},
        "thane": {"display_name": "Thane Industrial Belt, Maharashtra, India", "lat": 19.2183, "lon": 72.9781},
        "nashik": {"display_name": "Nashik Automotive Hub, Maharashtra, India", "lat": 19.9975, "lon": 73.7898},
        "aurangabad": {"display_name": "Aurangabad / Chhatrapati Sambhajinagar MIDC, Maharashtra, India", "lat": 19.8762, "lon": 75.3433},
        "nagpur": {"display_name": "Nagpur Multimodal Logistics Hub, Maharashtra, India", "lat": 21.1458, "lon": 79.0882},
        "bengaluru": {"display_name": "Bengaluru Industrial Corridor, Karnataka, India", "lat": 12.9716, "lon": 77.5946},
        "chennai": {"display_name": "Chennai Automotive Cluster, Tamil Nadu, India", "lat": 13.0827, "lon": 80.2707},
        "jamshedpur": {"display_name": "Jamshedpur Steel Hub, Jharkhand, India", "lat": 22.8046, "lon": 86.2029},
        "sanand": {"display_name": "Sanand Automotive Industrial Corridor, Gujarat, India", "lat": 22.9868, "lon": 72.3814},
    }

    match_key = clean_q.lower()
    for k, v in INDIAN_CITIES.items():
        if k in match_key:
            return [{
                "display_name": v["display_name"],
                "latitude": v["lat"],
                "longitude": v["lon"],
                "type": "city_fallback",
            }]

    return []

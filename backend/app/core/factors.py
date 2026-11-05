"""
Documented Transport & Logistics Emission Factors Library
Sources:
- UK Department for Energy Security and Net Zero & DEFRA GHG Conversion Factors 2024
- Global Logistics Emissions Council (GLEC) Framework v3.0
- Smart Freight Centre
- Central Electricity Authority (CEA) CO2 Baseline Database for Indian Power Sector (Reference)

Rule 10 Enforced: Country of origin and proxy nature of every factor is explicitly flagged.
Non-India specific factors are transparently identified.
"""

from typing import Dict, Any, Optional

VEHICLE_EMISSION_FACTORS: Dict[str, Dict[str, Any]] = {
    "hgv_diesel": {
        "id": "hgv_diesel",
        "label": "Heavy Commercial Vehicle (>16t Multi-Axle Diesel)",
        "factor_kg_per_km": 0.8524,
        "factor_t_per_tonne_km": 0.000108,
        "country": "International (DEFRA 2024 / GLEC v3.0 Proxy)",
        "is_india_specific": False,
        "proxy_note": (
            "Standard international freight proxy from DEFRA 2024 / GLEC Framework v3.0 (Articulated >33t, laden). "
            "Transparent proxy applied for Indian inter-city heavy transport corridors pending specific ARAI drive-cycle factor publication."
        ),
        "source": "DEFRA 2024 / GLEC Framework v3.0 (International Freight Transport)",
        "scope": "Scope 3 - Category 4 (Upstream Transportation)",
        "quality_tier": "Tier 2 - Distance-Based Modeled",
    },
    "rigid_diesel": {
        "id": "rigid_diesel",
        "label": "Medium Commercial Vehicle (7.5t - 16t Rigid Lorry)",
        "factor_kg_per_km": 0.5841,
        "factor_t_per_tonne_km": 0.000178,
        "country": "International (DEFRA 2024 Proxy)",
        "is_india_specific": False,
        "proxy_note": (
            "DEFRA 2024 Rigid Commercial Vehicle factor applied as distance proxy for regional Indian supply delivery lorries (e.g., Chakan-Pune)."
        ),
        "source": "DEFRA 2024 Commercial Goods Transport (Rigid 7.5t - 17t)",
        "scope": "Scope 3 - Category 4 (Upstream Transportation)",
        "quality_tier": "Tier 2 - Distance-Based Modeled",
    },
    "van_diesel": {
        "id": "van_diesel",
        "label": "Light Commercial Vehicle (LCV Diesel, e.g. Tata Ace / 407)",
        "factor_kg_per_km": 0.2612,
        "factor_t_per_tonne_km": 0.000420,
        "country": "International (DEFRA 2024 Proxy)",
        "is_india_specific": False,
        "proxy_note": (
            "International LCV delivery factor applied as proxy for last-mile intra-city component delivery vans."
        ),
        "source": "DEFRA 2024 Delivery Vans - Class III Diesel (Up to 3.5t)",
        "scope": "Scope 3 - Category 4 (Upstream Transportation)",
        "quality_tier": "Tier 2 - Distance-Based Modeled",
    },
    "van_electric": {
        "id": "van_electric",
        "label": "Electric Commercial Vehicle (BEV, Indian Grid CEA Basis)",
        "factor_kg_per_km": 0.0712,
        "factor_t_per_tonne_km": 0.000115,
        "country": "India (CEA Grid Baseline v20 + BEV Efficiency Proxy)",
        "is_india_specific": True,
        "proxy_note": (
            "India-Specific: Calculated from Central Electricity Authority (CEA) User Guide v20 weighted average emission factor "
            "(~0.716 kg CO2/kWh for national grid) combined with commercial EV consumption (0.10 kWh/km)."
        ),
        "source": "Central Electricity Authority (CEA) India v20 + Commercial BEV Rating",
        "scope": "Scope 3 - Category 4 (Upstream Transportation)",
        "quality_tier": "Tier 2 - Regional Grid Modeled",
    },
    "truck_hybrid": {
        "id": "truck_hybrid",
        "label": "CNG / LNG Commercial Freight Truck (12t - 16t)",
        "factor_kg_per_km": 0.4105,
        "factor_t_per_tonne_km": 0.000130,
        "country": "International (GLEC Framework Proxy)",
        "is_india_specific": False,
        "proxy_note": (
            "GLEC Framework commercial alternative-fuel freight proxy for clean fuel trucks operating in western India industrial corridors."
        ),
        "source": "GLEC Framework Commercial Low-Carbon Fleet Proxy",
        "scope": "Scope 3 - Category 4 (Upstream Transportation)",
        "quality_tier": "Tier 2 - Distance-Based Modeled",
    },
}


def calculate_transport_emissions(
    distance_km: float,
    vehicle_type: str = "hgv_diesel",
    cargo_tonnes: Optional[float] = None,
    return_trip: bool = False,
) -> Dict[str, Any]:
    """
    Deterministically computes estimated transport emissions based on documented factors.
    Preserves Rule 1 & 10: emissions calculated in Python functions without AI hallucination,
    and factor country of origin is explicitly flagged.
    """
    if vehicle_type not in VEHICLE_EMISSION_FACTORS:
        vehicle_type = "hgv_diesel"

    factor_info = VEHICLE_EMISSION_FACTORS[vehicle_type]
    effective_dist = distance_km * (2.0 if return_trip else 1.0)

    if cargo_tonnes is not None and cargo_tonnes > 0:
        tonne_km = effective_dist * cargo_tonnes
        emissions_tco2e = tonne_km * factor_info["factor_t_per_tonne_km"]
        emissions_kg = emissions_tco2e * 1000.0
        formula = (
            f"{effective_dist:,.1f} km × {cargo_tonnes:.1f} tonnes = {tonne_km:,.1f} tonne-km "
            f"× {factor_info['factor_t_per_tonne_km']} tCO₂e/tonne-km"
        )
        unit = "tonne-km"
        quantity = tonne_km
    else:
        emissions_kg = effective_dist * factor_info["factor_kg_per_km"]
        emissions_tco2e = emissions_kg / 1000.0
        formula = f"{effective_dist:,.1f} km × {factor_info['factor_kg_per_km']:.4f} kg CO₂e/km"
        unit = "km"
        quantity = effective_dist

    return {
        "distance_km": round(effective_dist, 2),
        "return_trip": return_trip,
        "vehicle_type": vehicle_type,
        "vehicle_label": factor_info["label"],
        "factor_country": factor_info["country"],
        "is_india_specific": factor_info["is_india_specific"],
        "proxy_note": factor_info["proxy_note"],
        "quantity": round(quantity, 2),
        "unit": unit,
        "factor": factor_info["factor_kg_per_km"] if cargo_tonnes is None else factor_info["factor_t_per_tonne_km"],
        "factor_source": factor_info["source"],
        "formula": formula,
        "quality_tier": factor_info["quality_tier"],
        "emissions_kg": round(emissions_kg, 2),
        "emissions_tco2e": round(emissions_tco2e, 4),
        "double_counting_warning": (
            "Double-Counting Guard: This distance-based estimate applies to Scope 3 Category 4 (Upstream Transportation). "
            "Ensure fuel receipts for this haulage corridor are not already logged under Scope 1 direct combustion."
        ),
    }

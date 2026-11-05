import pytest
from app.core.factors import VEHICLE_EMISSION_FACTORS, calculate_transport_emissions
from app.api.v1.endpoints.gis import haversine_distance

def test_vehicle_factors_structure():
    assert "hgv_diesel" in VEHICLE_EMISSION_FACTORS
    assert "rigid_diesel" in VEHICLE_EMISSION_FACTORS
    assert "van_diesel" in VEHICLE_EMISSION_FACTORS
    assert "van_electric" in VEHICLE_EMISSION_FACTORS

    hgv = VEHICLE_EMISSION_FACTORS["hgv_diesel"]
    assert hgv["factor_kg_per_km"] > 0
    assert "DEFRA" in hgv["source"]
    assert "country" in hgv
    assert "proxy_note" in hgv

    ev = VEHICLE_EMISSION_FACTORS["van_electric"]
    assert ev["is_india_specific"] is True
    assert "India" in ev["country"]
    assert "CEA" in ev["source"]


def test_deterministic_transport_calculation():
    # 100 km with HGV diesel: 100 * 0.8524 = 85.24 kg = 0.0852 t
    res = calculate_transport_emissions(distance_km=100.0, vehicle_type="hgv_diesel")
    assert res["distance_km"] == 100.0
    assert res["emissions_kg"] == 85.24
    assert res["emissions_tco2e"] == 0.0852
    assert "85.24" in res["formula"] or "100.0" in res["formula"]
    assert "Scope 1" in res["double_counting_warning"]


def test_transport_calculation_with_cargo_tonnes():
    # 200 km with 10 tonnes = 2000 tonne-km * 0.000108 = 0.216 tCO2e
    res = calculate_transport_emissions(
        distance_km=200.0,
        vehicle_type="hgv_diesel",
        cargo_tonnes=10.0,
        return_trip=False
    )
    assert res["quantity"] == 2000.0
    assert res["unit"] == "tonne-km"
    assert res["emissions_tco2e"] == 0.216


def test_haversine_formula():
    # Distance Tata Motors Pimpri Plant (18.6445, 73.8123) to Chakan Phase II MIDC (18.7606, 73.8540) ~ 13-16 km straight-line
    dist = haversine_distance(18.6445, 73.8123, 18.7606, 73.8540)
    assert 12.0 < dist < 18.0

"""
Live Server GIS & Spatial Routing Verification Script
Probes http://127.0.0.1:8000/api/v1/gis/*
"""
import json
import urllib.request
import urllib.parse

BASE_URL = "http://127.0.0.1:8000"

def get_json(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def post_json(url, payload):
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=12) as resp:
        return json.loads(resp.read().decode())

def run_gis_checks():
    print("Testing live FastAPI GIS Spatial & Routing Pipeline at", BASE_URL)
    passed = 0

    # 1. Factors Library
    factors = get_json(f"{BASE_URL}/api/v1/gis/factors")
    assert "hgv_diesel" in factors, "Missing hgv_diesel factor"
    assert "rigid_diesel" in factors, "Missing rigid_diesel factor"
    print(f"[PASS] Check 1: Vehicle factor library loaded ({len(factors)} vehicle types with DEFRA citations).")
    passed += 1

    # 2. Locations & Spatial Nodes
    locs = get_json(f"{BASE_URL}/api/v1/gis/locations")
    assert "primary_facility" in locs, "Missing primary facility"
    assert "Tata Motors" in locs["primary_facility"]["name"], "Primary facility must be Tata Motors"
    assert len(locs.get("secondary_facilities", [])) >= 2, "Missing secondary facilities"
    assert len(locs.get("suppliers", [])) >= 4, "Missing suppliers"
    assert "regional_distribution" in locs, "Missing regional distribution"
    assert "hotspots" in locs, "Missing hotspots"
    print(f"[PASS] Check 2: GIS Spatial Nodes aggregated for {locs['primary_facility']['name']} ({locs['total_nodes']} total nodes across {len(locs['regional_distribution'])} regions).")
    passed += 1

    # 3. OSRM Road Routing & DEFRA Calculation
    sup = locs["suppliers"][0]
    route_payload = {
        "origin_lat": locs["primary_facility"]["latitude"],
        "origin_lng": locs["primary_facility"]["longitude"],
        "origin_name": locs["primary_facility"]["name"],
        "destination_lat": sup["latitude"],
        "destination_lng": sup["longitude"],
        "destination_name": sup["name"],
        "vehicle_type": "hgv_diesel",
        "return_trip": False
    }
    route_res = post_json(f"{BASE_URL}/api/v1/gis/route", route_payload)
    assert route_res.get("distance_km", 0) > 0, "Distance must be greater than 0"
    assert len(route_res.get("geometry", [])) >= 2, "Geometry coordinates missing"
    em = route_res.get("emissions", {})
    assert em.get("emissions_tco2e", 0) > 0, "Emissions must be greater than 0"
    assert "DEFRA" in em.get("factor_source", ""), "Factor source must cite DEFRA"
    assert "Double-Counting" in em.get("double_counting_warning", ""), "Must contain double-counting warning"
    print(f"[PASS] Check 3: OSRM road corridor computed ({route_res['distance_km']} km, {em['emissions_tco2e']} tCO2e via {route_res['engine']}).")
    passed += 1

    # 4. Geocoding Service (Nominatim with Indian industrial fallbacks)
    geocode_res = get_json(f"{BASE_URL}/api/v1/gis/geocode?q=Chakan")
    assert len(geocode_res) > 0, "Geocoding should return at least 1 match for Chakan"
    c_match = geocode_res[0]
    assert 18.0 < c_match["latitude"] < 19.5, f"Expected Chakan latitude ~18.76, got {c_match['latitude']}"
    assert 73.0 < c_match["longitude"] < 74.5, f"Expected Chakan longitude ~73.85, got {c_match['longitude']}"
    print(f"[PASS] Check 4: Geocoding resolved 'Chakan' -> ({c_match['latitude']:.4f}, {c_match['longitude']:.4f}).")
    passed += 1

    # 5. Hotspot Identification
    hotspots = locs.get("hotspots", [])
    assert len(hotspots) > 0, "Should have at least 1 hotspot identified"
    print(f"[PASS] Check 5: Emission Hotspot identification verified (Top: {hotspots[0]['name']} with {hotspots[0]['emissions_tons']} tCO2e).")
    passed += 1

    print(f"\nALL {passed} LIVE GIS PIPELINE CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_gis_checks()

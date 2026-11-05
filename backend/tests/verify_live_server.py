import json
import urllib.request
import urllib.error
import sys

BASE_URL = "http://127.0.0.1:8000"

def request_json(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=5) as res:
        res_data = res.read().decode("utf-8")
        return res.status, json.loads(res_data) if res_data else None

def verify_all():
    print("=" * 60)
    print("CarbonMap AI — Live HTTP Server Verification Suite (Phase 3)")
    print(f"Target: {BASE_URL}")
    print("=" * 60)

    # 1. Health check
    status, data = request_json("/api/health")
    assert status == 200 and data["status"] == "ok"
    print("[PASS] GET /api/health -> 200 OK (DB: %s)" % data["database"])

    # 2. CORS
    req = urllib.request.Request(f"{BASE_URL}/api/health", headers={"Origin": "http://localhost:3000"})
    with urllib.request.urlopen(req, timeout=5) as res:
        assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"
        print("[PASS] CORS Header Verified for http://localhost:3000")

    # 3. Dashboard summary (Database aggregated)
    status, d = request_json("/api/v1/dashboard/summary")
    assert status == 200 and d["metrics"]["total_emissions_tco2e"] > 0
    print("[PASS] GET /api/v1/dashboard/summary -> 200 OK (Total: %s tCO2e, %d suppliers)" % (
        d["metrics"]["total_emissions_tco2e"],
        d["metrics"]["active_suppliers_count"]
    ))

    # 4. List suppliers
    status, suppliers = request_json("/api/v1/suppliers")
    assert status == 200 and len(suppliers) >= 4
    print("[PASS] GET /api/v1/suppliers -> 200 OK (%d suppliers retrieved from DB)" % len(suppliers))

    # 5. Create Supplier (CRUD: Create)
    new_sup = {
        "name": "Live Test Bio Logistics",
        "category": "Third-party Logistics",
        "location": "Chakan Industrial Belt, Pune",
        "latitude": 18.7606,
        "longitude": 73.8540,
        "annual_spend": "₹33,00,000",
        "distance_km": 25.0,
        "esg_rating": "A",
        "emissions_tons": 5.2,
        "intensity": "0.15 kg CO₂e/₹100",
        "status": "Verified Supplier",
    }
    status, created_sup = request_json("/api/v1/suppliers", method="POST", data=new_sup)
    assert status == 201 and created_sup["id"] is not None
    created_sup_id = created_sup["id"]
    print("[PASS] POST /api/v1/suppliers -> 201 Created (ID: %s, Name: %s)" % (created_sup_id, created_sup["name"]))

    # 6. Duplicate Prevention Check
    try:
        request_json("/api/v1/suppliers", method="POST", data=new_sup)
        assert False, "Should have thrown duplicate error"
    except urllib.error.HTTPError as err:
        assert err.code == 400
        print("[PASS] Duplicate Prevention Verified -> 400 Bad Request on duplicate name")

    # 7. Delete Supplier (CRUD: Delete)
    status, del_res = request_json(f"/api/v1/suppliers/{created_sup_id}", method="DELETE")
    assert status == 200 and del_res["status"] == "deleted"
    print("[PASS] DELETE /api/v1/suppliers/%s -> 200 OK" % created_sup_id)

    # 8. List & Create Emission Activity (CRUD: Create & Read)
    status, activities = request_json("/api/v1/emissions")
    assert status == 200 and len(activities) >= 5
    print("[PASS] GET /api/v1/emissions -> 200 OK (%d activities in DB)" % len(activities))

    new_act = {
        "name": "Live Test EV Delivery Fleet",
        "category": "Scope 1 - Mobile Combustion",
        "source": "Fleet Log Nov 2026",
        "quantity": 1200.0,
        "unit": "kWh",
        "factor": 0.000412,
        "factor_source": "DEFRA 2024",
        "formula": "Emissions = 1,200 kWh × 0.000412 tCO₂e/kWh",
        "quality": "Tier 1 - Primary Metered",
        "emissions": 0.49,
        "activity_date": "2026-11-04",
        "verified": True,
        "is_synthetic": True,
    }
    status, created_act = request_json("/api/v1/emissions", method="POST", data=new_act)
    assert status == 201 and created_act["id"] is not None
    print("[PASS] POST /api/v1/emissions -> 201 Created (ID: %s, Result: %s tCO2e)" % (
        created_act["id"], created_act["emissions"]
    ))

    # Delete test emission
    status, del_act = request_json(f"/api/v1/emissions/{created_act['id']}", method="DELETE")
    assert status == 200
    print("[PASS] DELETE /api/v1/emissions/%s -> 200 OK" % created_act["id"])

    # 9. Documents & Reports
    status, docs = request_json("/api/v1/documents")
    assert status == 200 and len(docs) >= 4
    print("[PASS] GET /api/v1/documents -> 200 OK (%d documents in DB)" % len(docs))

    status, reps = request_json("/api/v1/reports")
    assert status == 200 and len(reps) >= 1
    print("[PASS] GET /api/v1/reports -> 200 OK (%d reports in DB)" % len(reps))

    print("=" * 60)
    print("ALL LIVE DATABASE CRUD & PERSISTENCE TESTS PASSED")
    print("=" * 60)

if __name__ == "__main__":
    verify_all()

"""
Live Server Gemini & OCR Extraction Verification Script
Probes http://127.0.0.1:8000/api/v1/documents/extract and /review
"""
import os
import sys
import json
import urllib.request
import urllib.parse

BASE_URL = "http://127.0.0.1:8000"
BILLS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/bills"))

def post_multipart(url, fields, files):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = bytearray()

    for k, v in fields.items():
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode())
        body.extend(f"{v}\r\n".encode())

    for k, (filename, file_bytes) in files.items():
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(f'Content-Disposition: form-data; name="{k}"; filename="{filename}"\r\n'.encode())
        body.extend(b"Content-Type: application/pdf\r\n\r\n")
        body.extend(file_bytes)
        body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        url,
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())

def put_json(url, payload):
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="PUT"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def run_checks():
    print("Testing live FastAPI Phase 4 Extraction Pipeline at", BASE_URL)
    passed = 0

    # 1. Diesel PDF extraction
    diesel_pdf = os.path.join(BILLS_DIR, "bill_03_diesel_S01.pdf")
    with open(diesel_pdf, "rb") as f:
        bytes_data = f.read()

    res_diesel = post_multipart(
        f"{BASE_URL}/api/v1/documents/extract",
        fields={"doc_type": "fuel", "save_to_db": "true"},
        files={"file": ("bill_03_diesel_S01.pdf", bytes_data)}
    )
    d = res_diesel.get("extractedData", {})
    assert d.get("quantity") == 30.0, f"Expected 30.0, got {d.get('quantity')}"
    assert "litre" in str(d.get("unit")).lower(), f"Expected litres, got {d.get('unit')}"
    assert d.get("fuelType") == "High Speed Diesel", f"Expected High Speed Diesel, got {d.get('fuelType')}"
    assert d.get("provider", "").upper() == "DEMO FUELS PETROL BUNK", f"Expected DEMO FUELS PETROL BUNK, got {d.get('provider')}"
    assert d.get("customerId") == "S01", f"Expected S01, got {d.get('customerId')}"
    assert d.get("vehicleNumber") == "TN-00-XX-0000", f"Expected TN-00-XX-0000, got {d.get('vehicleNumber')}"
    print("[PASS] Check 1: Fuel Receipt extracted 30 litres & High Speed Diesel.")
    passed += 1

    # 2. Electricity PDF extraction
    elec_pdf = os.path.join(BILLS_DIR, "bill_01_electricity_E12.pdf")
    with open(elec_pdf, "rb") as f:
        bytes_data = f.read()

    res_elec = post_multipart(
        f"{BASE_URL}/api/v1/documents/extract",
        fields={"doc_type": "electricity", "save_to_db": "true"},
        files={"file": ("bill_01_electricity_E12.pdf", bytes_data)}
    )
    ed = res_elec.get("extractedData", {})
    assert ed.get("quantity") == 4500.0, f"Expected 4500.0, got {ed.get('quantity')}"
    assert ed.get("provider") == "BRITISH GRID UTILITIES", f"Expected BRITISH GRID UTILITIES, got {ed.get('provider')}"
    assert "fuelType" not in ed, "Fuel fields should not be present in electricity extraction"
    print("[PASS] Check 2: Electricity Bill extracted 4,500 kWh independently.")
    passed += 1

    # 3. Transport Waybill PDF extraction
    trans_pdf = os.path.join(BILLS_DIR, "waybill_02_transport.pdf")
    with open(trans_pdf, "rb") as f:
        bytes_data = f.read()

    res_trans = post_multipart(
        f"{BASE_URL}/api/v1/documents/extract",
        fields={"doc_type": "transport", "save_to_db": "true"},
        files={"file": ("waybill_02_transport.pdf", bytes_data)}
    )
    td = res_trans.get("extractedData", {})
    assert td.get("quantity") == 1840.0, f"Expected 1840.0, got {td.get('quantity')}"
    assert "tonne-km" in str(td.get("unit")).lower(), f"Expected tonne-km, got {td.get('unit')}"
    assert "transnational" in str(td.get("carrier")).lower(), f"Expected TransNational, got {td.get('carrier')}"
    print("[PASS] Check 3: Transport Waybill extracted 1,840 tonne-km.")
    passed += 1

    # 4. Supplier Invoice PDF extraction
    inv_pdf = os.path.join(BILLS_DIR, "invoice_05_packaging.pdf")
    with open(inv_pdf, "rb") as f:
        bytes_data = f.read()

    res_inv = post_multipart(
        f"{BASE_URL}/api/v1/documents/extract",
        fields={"doc_type": "invoices", "save_to_db": "true"},
        files={"file": ("invoice_05_packaging.pdf", bytes_data)}
    )
    inv_d = res_inv.get("extractedData", {})
    assert inv_d.get("quantity") == 3200.0, f"Expected 3200.0, got {inv_d.get('quantity')}"
    assert inv_d.get("unit") == "kg", f"Expected kg, got {inv_d.get('unit')}"
    assert "greenpack" in str(inv_d.get("supplier")).lower(), f"Expected GreenPack, got {inv_d.get('supplier')}"
    print("[PASS] Check 4: Supplier Invoice extracted 3,200 kg.")
    passed += 1

    # 5. Missing / Incomplete PDF extraction
    inc_pdf = os.path.join(BILLS_DIR, "bill_incomplete.pdf")
    with open(inc_pdf, "rb") as f:
        bytes_data = f.read()

    res_inc = post_multipart(
        f"{BASE_URL}/api/v1/documents/extract",
        fields={"doc_type": "electricity", "save_to_db": "false"},
        files={"file": ("bill_incomplete.pdf", bytes_data)}
    )
    inc_d = res_inc.get("extractedData", {})
    assert inc_d.get("quantity") is None
    assert res_inc.get("confidenceScore") <= 50.0
    assert any("missing" in w.lower() for w in res_inc.get("validationWarnings", []))
    print(f"[PASS] Check 5: Incomplete bill flagged missing quantity and low confidence ({res_inc.get('confidence')}).")
    passed += 1

    # 6. Category Mismatch Detection
    with open(diesel_pdf, "rb") as f:
        diesel_bytes = f.read()

    res_mismatch = post_multipart(
        f"{BASE_URL}/api/v1/documents/extract",
        fields={"doc_type": "electricity", "save_to_db": "false"},
        files={"file": ("bill_03_diesel_S01.pdf", diesel_bytes)}
    )
    assert res_mismatch.get("detectedCategory") == "fuel"
    assert any("category alert" in w.lower() or "mismatch" in w.lower() for w in res_mismatch.get("validationWarnings", []))
    print("[PASS] Check 6: Category mismatch detected and flagged when fuel bill uploaded under electricity.")
    passed += 1

    # 7. Human Review PUT Endpoint
    doc_id = res_diesel.get("id")
    if doc_id and doc_id.isdigit():
        rev_payload = {**d, "quantity": 32.5, "reviewNotes": "Audited by user"}
        rev_res = put_json(f"{BASE_URL}/api/v1/documents/{doc_id}/review", rev_payload)
        assert rev_res.get("status") == "Human Verified"
        print("[PASS] Check 7: Human review endpoint updated document status to 'Human Verified'.")
        passed += 1

    print(f"\nALL {passed} LIVE INTEGRATION CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_checks()

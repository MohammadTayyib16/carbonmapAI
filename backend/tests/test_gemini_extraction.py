import os
import pytest
from app.services.gemini_extractor import (
    process_document_pipeline,
    detect_document_category,
    validate_and_audit_extraction,
)
from app.services.document_parser import extract_text_and_confidence

BILLS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/bills"))

def test_diesel_pdf_gemini_pipeline():
    """
    Test Case 1: Diesel receipt (bill_03_diesel_S01.pdf)
    Expected:
    - Fuel Type: High Speed Diesel
    - Quantity: 30.0 litres
    - Supplier: DEMO FUELS PETROL BUNK
    - Customer ID: S01
    - Vehicle: TN-00-XX-0000
    - Status: Extracted (clean)
    """
    pdf_path = os.path.join(BILLS_DIR, "bill_03_diesel_S01.pdf")
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    res = process_document_pipeline(file_bytes, "bill_03_diesel_S01.pdf", "fuel")
    data = res["extractedData"]

    assert data["quantity"] == 30.0
    assert "litre" in data["unit"].lower()
    assert data["fuelType"] == "High Speed Diesel"
    assert data["provider"].upper() == "DEMO FUELS PETROL BUNK"
    assert data["customerId"] == "S01"
    assert data["vehicleNumber"] == "TN-00-XX-0000"
    assert res["status"] in ("Extracted", "Needs Review")
    assert res["confidenceScore"] > 80.0


def test_electricity_bill_gemini_pipeline():
    """
    Test Case 2: Electricity bill (bill_01_electricity_E12.pdf)
    Expected:
    - Active Energy: 4,500 kWh
    - Utility: BRITISH GRID UTILITIES
    - Meter: MTR-88219
    - Period: September 2026
    """
    pdf_path = os.path.join(BILLS_DIR, "bill_01_electricity_E12.pdf")
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    res = process_document_pipeline(file_bytes, "bill_01_electricity_E12.pdf", "electricity")
    data = res["extractedData"]

    assert data["quantity"] == 4500.0
    assert data["unit"].upper() == "KWH"
    assert data["provider"].upper() == "BRITISH GRID UTILITIES"
    assert data["meterNumber"] == "MTR-88219"


def test_transport_waybill_gemini_pipeline():
    """
    Test Case 3: Transport record (waybill_02_transport.pdf)
    Expected:
    - Carrier: TransNational Freight Express
    - Volume: 1,840 tonne-km
    - Waybill: WB-2026-9912
    """
    pdf_path = os.path.join(BILLS_DIR, "waybill_02_transport.pdf")
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    res = process_document_pipeline(file_bytes, "waybill_02_transport.pdf", "transport")
    data = res["extractedData"]

    assert data["quantity"] == 1840.0
    assert "tonne-km" in data["unit"].lower()
    assert "transnational" in data["carrier"].lower()
    assert data["waybillNumber"] == "WB-2026-9912"


def test_supplier_invoice_gemini_pipeline():
    """
    Test Case 4: Supplier invoice (invoice_05_packaging.pdf)
    Expected:
    - Supplier: GreenPack Solutions Ltd
    - Item: Corrugated Shipping Boxes
    - Quantity: 3,200 kg
    - Invoice Ref: INV-77281
    """
    pdf_path = os.path.join(BILLS_DIR, "invoice_05_packaging.pdf")
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    res = process_document_pipeline(file_bytes, "invoice_05_packaging.pdf", "invoices")
    data = res["extractedData"]

    assert data["quantity"] == 3200.0
    assert data["unit"].lower() == "kg"
    assert "greenpack" in data["supplier"].lower()
    assert data["invoiceNumber"] == "INV-77281"


def test_missing_and_unclear_fields():
    """
    Test Case 5: Missing and unclear fields (bill_incomplete.pdf)
    Expected:
    - Quantity is None
    - Explicit validation warning for missing quantity
    - requiresConfirmation is True
    - Confidence is low (<= 50%)
    """
    pdf_path = os.path.join(BILLS_DIR, "bill_incomplete.pdf")
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    res = process_document_pipeline(file_bytes, "bill_incomplete.pdf", "electricity")
    data = res["extractedData"]

    assert data["quantity"] is None
    assert any("missing" in w.lower() for w in res["validationWarnings"])
    assert res["requiresConfirmation"] is True
    assert res["confidenceScore"] <= 50.0


def test_category_mismatch_detection():
    """
    Test Case 6: Category mismatch:
    Upload diesel fuel bill under 'electricity' category.
    Expected:
    - detectedCategory is 'fuel'
    - isMismatch is True
    - Validation warning generated alerting user of category mismatch
    """
    pdf_path = os.path.join(BILLS_DIR, "bill_03_diesel_S01.pdf")
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    res = process_document_pipeline(file_bytes, "bill_03_diesel_S01.pdf", "electricity")

    assert res["detectedCategory"] == "fuel"
    assert res["isMismatch"] is True
    assert any("Category Alert" in w or "mismatch" in w.lower() for w in res["validationWarnings"])


def test_consecutive_uploads_independence():
    """
    Test Case 7: Consecutive uploads are completely independent.
    """
    fuel_path = os.path.join(BILLS_DIR, "bill_03_diesel_S01.pdf")
    elec_path = os.path.join(BILLS_DIR, "bill_01_electricity_E12.pdf")

    with open(fuel_path, "rb") as f:
        f_bytes = f.read()
    with open(elec_path, "rb") as f:
        e_bytes = f.read()

    res1 = process_document_pipeline(f_bytes, "bill_03_diesel_S01.pdf", "fuel")
    res2 = process_document_pipeline(e_bytes, "bill_01_electricity_E12.pdf", "electricity")

    assert res1["extractedData"]["quantity"] == 30.0
    assert res2["extractedData"]["quantity"] == 4500.0
    assert "fuelType" not in res2["extractedData"]
    assert "meterNumber" not in res1["extractedData"]

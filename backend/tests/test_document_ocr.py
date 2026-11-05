import os
import pytest
from app.services.document_parser import (
    extract_text_and_confidence,
    parse_document,
    parse_fuel,
    parse_electricity,
)

BILLS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/bills"))

def test_diesel_extraction_accuracy():
    """
    Test Case 1: Upload bill_03_diesel_S01.pdf
    Expected:
    - Fuel Type: High Speed Diesel
    - Quantity: 30 litres
    - Supplier: DEMO FUELS PETROL BUNK
    - Customer: Demo Steel Works
    - Customer ID: S01
    - Vehicle: TN-00-XX-0000
    - Date: 2026-10-05
    """
    pdf_path = os.path.join(BILLS_DIR, "bill_03_diesel_S01.pdf")
    assert os.path.exists(pdf_path), f"File {pdf_path} does not exist"

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    result = parse_document(file_bytes, "bill_03_diesel_S01.pdf", "fuel")

    assert result["type"] == "fuel"
    assert result["extractionMethod"] == "Digital PDF (Embedded Text)"
    assert result["status"] == "Extracted"
    assert result["confidenceScore"] > 80.0

    data = result["extractedData"]
    assert data["quantity"] == 30.0
    assert "litre" in data["unit"].lower()
    assert data["fuelType"] == "High Speed Diesel"
    assert data["provider"] == "DEMO FUELS PETROL BUNK"
    assert data["customer"] == "Demo Steel Works"
    assert data["customerId"] == "S01"
    assert data["vehicleNumber"] == "TN-00-XX-0000"
    assert data["date"] == "2026-10-05"


def test_electricity_extraction_independence():
    """
    Test Case 2: Upload bill_01_electricity_E12.pdf
    Expected:
    - Quantity: 4500 kWh
    - Utility: BRITISH GRID UTILITIES
    - Customer: Demo Steel Works
    - Meter: MTR-88219
    - Period: September 2026
    - No leftover fuel fields present in electricity schema
    """
    pdf_path = os.path.join(BILLS_DIR, "bill_01_electricity_E12.pdf")
    assert os.path.exists(pdf_path), f"File {pdf_path} does not exist"

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    result = parse_document(file_bytes, "bill_01_electricity_E12.pdf", "electricity")

    assert result["type"] == "electricity"
    data = result["extractedData"]
    assert data["quantity"] == 4500.0
    assert data["unit"].upper() == "KWH"
    assert data["provider"] == "BRITISH GRID UTILITIES"
    assert data["meterNumber"] == "MTR-88219"
    assert data["period"] == "September 2026"

    # Category switching isolation check: fuel fields must NOT be in electricity extractedData
    assert "fuelType" not in data
    assert "vehicleNumber" not in data


def test_second_fuel_receipt_independence():
    """
    Test Case 3: Upload bill_04_fuel_petrol_S02.pdf
    Ensures new upload never reuses previous document results.
    """
    pdf_path = os.path.join(BILLS_DIR, "bill_04_fuel_petrol_S02.pdf")
    assert os.path.exists(pdf_path), f"File {pdf_path} does not exist"

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    result = parse_document(file_bytes, "bill_04_fuel_petrol_S02.pdf", "fuel")
    data = result["extractedData"]

    assert data["quantity"] == 75.0
    assert "litre" in data["unit"].lower()
    assert data["fuelType"] == "Unleaded Petrol"
    assert data["provider"] == "CITY EXPRESS PETROLEUM"
    assert data["customerId"] == "S02"
    assert data["vehicleNumber"] == "KA-01-AB-1234"


def test_incomplete_document_missing_fields_and_confidence():
    """
    Test Case 4: Upload bill_incomplete.pdf
    Missing fields must be explicitly 'Not detected'.
    Confidence must be low (< 50%), not fixed 97%.
    """
    pdf_path = os.path.join(BILLS_DIR, "bill_incomplete.pdf")
    assert os.path.exists(pdf_path), f"File {pdf_path} does not exist"

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    result = parse_document(file_bytes, "bill_incomplete.pdf", "electricity")
    data = result["extractedData"]

    assert data["quantity"] is None
    assert data["unit"] == "Not detected"
    assert data["meterNumber"] == "Not detected"
    assert data["accountNumber"] == "Not detected"
    # Low confidence when missing crucial parameters
    assert result["confidenceScore"] <= 50.0
    assert result["status"] == "Failed / Low Quality"

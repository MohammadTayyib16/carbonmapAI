import os
import io
import pytest
from pathlib import Path
from app.core.config import settings
from app.services.document_parser import (
    extract_text_and_confidence,
    parse_electricity,
    parse_fuel,
    parse_transport,
    parse_invoices,
)
from app.services.gemini_extractor import (
    call_gemini_extraction,
    detect_document_category,
    process_document_pipeline,
)

BILLS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "bills"


def test_bills_directory_exists():
    assert BILLS_DIR.exists(), f"Bills directory not found at {BILLS_DIR}"
    files = list(BILLS_DIR.glob("*.pdf"))
    assert len(files) >= 6, f"Expected at least 6 sample PDFs, found {len(files)}"


def test_ocr_and_text_extraction_separate():
    """Verify raw OCR / text extraction without Gemini on all 6 sample files."""
    files_expected = {
        "bill_01_electricity_E12.pdf": ["BRITISH GRID UTILITIES", "4,500", "KWH"],
        "bill_03_diesel_S01.pdf": ["DEMO FUELS PETROL BUNK", "30", "litres"],
        "bill_04_fuel_petrol_S02.pdf": ["CITY EXPRESS PETROLEUM", "75", "litres"],
        "bill_incomplete.pdf": ["INVOICE"],
        "invoice_05_packaging.pdf": ["GreenPack Solutions Ltd", "3,200", "kg"],
        "waybill_02_transport.pdf": ["TransNational Freight Express", "1,840", "tonne-km"],
    }

    for fname, expected_snippets in files_expected.items():
        fpath = BILLS_DIR / fname
        assert fpath.exists(), f"File {fname} missing"
        bytes_data = fpath.read_bytes()
        raw_text, method, conf, status = extract_text_and_confidence(bytes_data, fname)

        assert raw_text is not None and len(raw_text) > 0, f"No text extracted from {fname}"
        assert conf > 0, f"Confidence zero for {fname}"
        for snippet in expected_snippets:
            assert snippet.lower() in raw_text.lower(), (
                f"Expected snippet '{snippet}' not found in OCR text of {fname}"
            )


def test_gemini_extraction_live_connectivity():
    """Verify live Gemini API connectivity with gemini-3.5-flash-lite on sample fuel receipt."""
    assert settings.GEMINI_API_KEY, "GEMINI_API_KEY is not configured"

    sample_text = (
        "DEMO FUELS PETROL BUNK\n"
        "Customer: Demo Steel Works\n"
        "Customer ID: S01\n"
        "Date: 2026-10-05\n"
        "Fuel Type: High Speed Diesel\n"
        "Quantity: 30 litres\n"
        "Vehicle No: TN-00-XX-0000\n"
        "Receipt: REC-2026-10-8842"
    )

    res = call_gemini_extraction(
        raw_text=sample_text,
        category="fuel",
        api_key=settings.GEMINI_API_KEY,
        model_name=settings.GEMINI_MODEL,
    )

    assert res is not None, "Gemini extraction returned None - API call failed or network unreachable"
    assert res.get("quantity") == 30 or res.get("quantity") == 30.0
    assert "DEMO FUELS" in res.get("provider", "").upper()
    assert "DIESEL" in res.get("fuelType", "").upper()


def test_pipeline_on_all_six_sample_documents():
    """Test full processing pipeline on all 6 sample documents."""
    manifest = [
        ("bill_01_electricity_E12.pdf", "electricity", 4500.0, "BRITISH GRID UTILITIES", "Extracted"),
        ("bill_03_diesel_S01.pdf", "fuel", 30.0, "DEMO FUELS PETROL BUNK", "Extracted"),
        ("bill_04_fuel_petrol_S02.pdf", "fuel", 75.0, "CITY EXPRESS PETROLEUM", "Extracted"),
        ("invoice_05_packaging.pdf", "invoices", 3200.0, "GreenPack Solutions Ltd", "Extracted"),
        ("waybill_02_transport.pdf", "transport", 1840.0, "TransNational Freight Express", "Extracted"),
        ("bill_incomplete.pdf", "electricity", None, "Not detected", "Low Confidence"),
    ]

    for fname, cat, expected_qty, expected_provider, expected_status in manifest:
        fpath = BILLS_DIR / fname
        bytes_data = fpath.read_bytes()
        res = process_document_pipeline(bytes_data, fname, cat)

        assert res["status"] == expected_status, f"Unexpected status for {fname}: {res['status']}"
        data = res["extractedData"]

        if expected_qty is not None:
            assert data.get("quantity") == expected_qty, (
                f"{fname}: expected quantity {expected_qty}, got {data.get('quantity')}"
            )
        else:
            assert data.get("quantity") is None, f"{fname}: expected null quantity, got {data.get('quantity')}"

        if expected_provider != "Not detected":
            prov = data.get("provider") or data.get("supplier") or data.get("carrier") or ""
            assert expected_provider.lower() in prov.lower(), (
                f"{fname}: expected provider '{expected_provider}', got '{prov}'"
            )


def test_category_mismatch_and_missing_fields_validation():
    """Test mismatch detection and missing field warnings."""
    # Upload fuel bill under electricity category
    fuel_path = BILLS_DIR / "bill_03_diesel_S01.pdf"
    res = process_document_pipeline(fuel_path.read_bytes(), fuel_path.name, "electricity")
    assert res["detectedCategory"] == "fuel"
    assert res["requiresConfirmation"] is True
    assert any("Category Alert" in w for w in res["validationWarnings"])

    # Upload incomplete bill
    incomp_path = BILLS_DIR / "bill_incomplete.pdf"
    res_incomp = process_document_pipeline(incomp_path.read_bytes(), incomp_path.name, "electricity")
    assert res_incomp["status"] == "Low Confidence"
    assert any("Missing Activity Quantity" in w for w in res_incomp["validationWarnings"])
    assert res_incomp["extractedData"]["quantity"] is None


def test_no_api_key_exposure_in_errors_or_objects():
    """Verify that settings.GEMINI_API_KEY is not leaked into output objects or strings."""
    if not settings.GEMINI_API_KEY:
        pytest.skip("No API key to check against")

    fpath = BILLS_DIR / "bill_03_diesel_S01.pdf"
    res = process_document_pipeline(fpath.read_bytes(), fpath.name, "fuel")

    serialized = str(res)
    assert settings.GEMINI_API_KEY not in serialized, "Security failure: API key exposed in response"

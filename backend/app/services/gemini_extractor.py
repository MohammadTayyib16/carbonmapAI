import os
import json
import logging
from typing import Dict, Any, Tuple, List, Optional
from app.core.config import settings
from app.services.document_parser import (
    extract_text_and_confidence,
    parse_document,
    parse_fuel,
    parse_electricity,
    parse_transport,
    parse_invoices,
)
from app.schemas.extraction import (
    FuelExtractionData,
    ElectricityExtractionData,
    TransportExtractionData,
    InvoiceExtractionData,
)

logger = logging.getLogger(__name__)

CATEGORY_NAMES = {
    "electricity": "Electricity Bill",
    "fuel": "Fuel Receipt",
    "transport": "Transport Record",
    "invoices": "Supplier Invoice",
}

def detect_document_category(raw_text: str, user_category: str) -> Tuple[str, bool]:
    """
    Analyzes document text to detect its true category and identifies mismatches.
    Returns: (detected_category, is_mismatch)
    """
    text_lower = raw_text.lower()
    scores = {
        "fuel": 0,
        "electricity": 0,
        "transport": 0,
        "invoices": 0,
    }

    # Fuel keywords
    for kw in ["diesel", "petrol", "gasoline", "fuel dispenser", "litres", "liters", "fleet card", "petrol bunk", "fuel station"]:
        if kw in text_lower:
            scores["fuel"] += 2
    if any(k in text_lower for k in ["bunk", "dispenser", "high speed diesel"]):
        scores["fuel"] += 3

    # Electricity keywords
    for kw in ["kwh", "mwh", "meter number", "grid utilities", "electricity", "active energy", "meter reading", "power distribution"]:
        if kw in text_lower:
            scores["electricity"] += 2
    if "active energy consumed" in text_lower or "meter number: mtr-" in text_lower:
        scores["electricity"] += 3

    # Transport keywords
    for kw in ["waybill", "consignment note", "freight", "haulier", "tonne-km", "ton-km", "carrier", "logistics depot", "gateway port"]:
        if kw in text_lower:
            scores["transport"] += 2
    if "freight activity" in text_lower or "waybill no" in text_lower:
        scores["transport"] += 3

    # Invoices keywords
    for kw in ["tax invoice", "purchase order", "invoice no", "packaging", "commercial invoice", "boxes", "materials", "unit price"]:
        if kw in text_lower:
            scores["invoices"] += 2

    # Find highest scoring category
    best_cat = max(scores, key=scores.get)
    best_score = scores[best_cat]

    user_cat_score = scores.get(user_category, 0)
    # Only flag mismatch if another category is clearly dominant (>= 3 points higher)
    if best_score >= 3 and (best_score - user_cat_score) >= 3:
        return best_cat, True

    return user_category, False


def call_gemini_extraction(
    raw_text: str,
    category: str,
    api_key: str,
    model_name: str = "gemini-3.5-flash-lite",
) -> Optional[Dict[str, Any]]:
    """
    Invokes Google Gemini API with structured output schemas.
    Returns parsed dictionary or None if API unavailable.
    """
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        category_instructions = {
            "fuel": (
                "Extract fuel purchase details into JSON with fields: "
                "provider (string), customer (string), customerId (string), fuelType (string), "
                "quantity (number or null), unit (string), date (YYYY-MM-DD or string), "
                "vehicleNumber (string), receiptNumber (string)."
            ),
            "electricity": (
                "Extract electricity statement details into JSON with fields: "
                "provider (string), customer (string), period (string), quantity (number or null), "
                "unit (string, e.g. kWh), accountNumber (string), meterNumber (string), date (string)."
            ),
            "transport": (
                "Extract freight and transport consignment details into JSON with fields: "
                "carrier (string), origin (string), destination (string), quantity (number or null), "
                "unit (string, e.g. tonne-km), date (string), vehicleNumber (string), waybillNumber (string)."
            ),
            "invoices": (
                "Extract supplier invoice details into JSON with fields: "
                "supplier (string), customer (string), invoiceNumber (string), item (string), "
                "quantity (number or null), unit (string, e.g. kg), date (string)."
            ),
        }

        instruction = category_instructions.get(category, category_instructions["electricity"])

        prompt = (
            f"You are an AI document extractor for a GHG Carbon Footprint Accounting system.\n"
            f"Document Type: {CATEGORY_NAMES.get(category, category)}\n"
            f"Instructions:\n"
            f"1. {instruction}\n"
            f"2. CRITICAL RULE: Never invent, extrapolate, or hallucinate missing information.\n"
            f"3. If any field is not explicitly present in the document text, return 'Not detected' for string fields, or null for quantity.\n"
            f"4. Never calculate emissions or GHG conversion factors.\n\n"
            f"Document Text:\n\"\"\"\n{raw_text}\n\"\"\""
        )

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,
            ),
        )

        if response and response.text:
            return json.loads(response.text)
    except Exception as e:
        logger.warning(f"Gemini API call skipped or failed ({str(e)}). Falling back to deterministic OCR parser.")
        return None

    return None


def validate_and_audit_extraction(
    data: Dict[str, Any],
    category: str,
    detected_category: str,
    is_mismatch: bool,
) -> Tuple[Dict[str, Any], List[str], bool]:
    """
    Validates data types using Pydantic, checks for anomalies or missing quantities,
    and returns: (validated_data, warnings_list, requires_user_confirmation)
    """
    warnings: List[str] = []
    requires_confirmation = False

    # 1. Pydantic schema validation & normalization
    if category == "fuel":
        validated_obj = FuelExtractionData(**data)
    elif category == "transport":
        validated_obj = TransportExtractionData(**data)
    elif category == "invoices":
        validated_obj = InvoiceExtractionData(**data)
    else:
        validated_obj = ElectricityExtractionData(**data)

    clean_dict = validated_obj.model_dump()

    # 2. Category Mismatch Warning
    if is_mismatch:
        clean_user_label = CATEGORY_NAMES.get(category, category)
        clean_det_label = CATEGORY_NAMES.get(detected_category, detected_category)
        warnings.append(
            f"Category Alert: Document appears to be a '{clean_det_label}', but '{clean_user_label}' was selected. "
            f"Please review extracted values carefully before proceeding."
        )
        requires_confirmation = True

    # 3. Missing Quantity Validation
    qty = clean_dict.get("quantity")
    if qty is None:
        warnings.append(
            "Missing Activity Quantity: Volume could not be automatically detected. Please enter the quantity manually."
        )
        requires_confirmation = True
    else:
        # 4. Anomaly / Extreme Quantity Checks
        if category == "fuel" and qty > 25000:
            warnings.append(f"Unusually High Volume: Extracted fuel quantity ({qty:,.0f} L) exceeds standard single vehicle capacity. Please verify.")
            requires_confirmation = True
        elif category == "electricity" and qty > 1000000:
            warnings.append(f"High Consumption Warning: Extracted {qty:,.0f} kWh exceeds typical monthly facility consumption. Please verify.")
            requires_confirmation = True
        elif category == "transport" and qty > 200000:
            warnings.append(f"High Freight Warning: Extracted {qty:,.0f} tonne-km is extraordinarily large. Please verify.")
            requires_confirmation = True
        elif category == "invoices" and qty > 500000:
            warnings.append(f"High Mass Warning: Extracted {qty:,.0f} kg exceeds typical batch order. Please verify.")
            requires_confirmation = True

    # 5. Missing Supplier / Issuer Validation
    provider_val = clean_dict.get("provider") or clean_dict.get("supplier") or clean_dict.get("carrier")
    if not provider_val or provider_val == "Not detected":
        warnings.append("Supplier / Issuer name could not be confidently identified from document.")

    # 6. Missing Date Validation
    date_val = clean_dict.get("date") or clean_dict.get("period")
    if not date_val or date_val == "Not detected":
        warnings.append("Document date or billing period is missing.")

    return clean_dict, warnings, requires_confirmation


def process_document_pipeline(
    file_bytes: bytes,
    filename: str,
    user_category: str,
) -> Dict[str, Any]:
    """
    Complete Phase 4 Document Extraction Pipeline:
    1. Extracts embedded text from PDF or applies Tesseract OCR.
    2. Identifies true category & checks for mismatch.
    3. Executes Gemini AI structured JSON extraction (with graceful fallback).
    4. Validates data with Pydantic & anomaly detection.
    5. Calculates transparent confidence metrics.
    """
    # 1. Base text & OCR extraction
    raw_text, base_method, ocr_conf, ocr_status = extract_text_and_confidence(file_bytes, filename)

    # 2. Detect category and flag mismatch
    detected_cat, is_mismatch = detect_document_category(raw_text, user_category)
    effective_cat = user_category  # Maintain user selected mode unless overridden

    extracted_dict = None
    extraction_method = base_method

    # 3. Gemini AI extraction if API key configured
    gemini_key = (settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if gemini_key:
        ai_res = call_gemini_extraction(
            raw_text=raw_text,
            category=effective_cat,
            api_key=gemini_key,
            model_name=settings.GEMINI_MODEL,
        )
        if ai_res:
            extracted_dict = ai_res
            extraction_method = f"Gemini AI ({settings.GEMINI_MODEL}) + {base_method}"

    # 4. Fallback to deterministic rule-based extractor
    if not extracted_dict:
        if effective_cat == "fuel":
            extracted_dict = parse_fuel(raw_text)
        elif effective_cat == "transport":
            extracted_dict = parse_transport(raw_text)
        elif effective_cat == "invoices":
            extracted_dict = parse_invoices(raw_text)
        else:
            extracted_dict = parse_electricity(raw_text)

        if "Gemini" not in extraction_method:
            extraction_method = f"Deterministic Parser + {base_method}"

    # 5. Pydantic validation & anomaly detection
    validated_data, warnings, req_confirm = validate_and_audit_extraction(
        extracted_dict,
        effective_cat,
        detected_cat,
        is_mismatch,
    )

    # 6. Confidence Scoring
    detected_fields = sum(1 for v in validated_data.values() if v not in (None, "Not detected", ""))
    total_fields = len(validated_data)
    completeness_ratio = detected_fields / max(total_fields, 1)

    if validated_data.get("quantity") is None:
        final_conf_score = min(45.0, ocr_conf * 0.5)
    else:
        final_conf_score = min(99.0, max(35.0, ocr_conf * (0.6 + 0.4 * completeness_ratio)))

    status_label = "Extracted"
    if req_confirm or len(warnings) > 0:
        status_label = "Needs Review"
    if final_conf_score < 50.0:
        status_label = "Low Confidence"

    return {
        "fileName": filename,
        "type": CATEGORY_NAMES.get(effective_cat, "Document"),
        "category": effective_cat,
        "detectedCategory": detected_cat,
        "isMismatch": is_mismatch,
        "status": status_label,
        "confidence": f"{round(final_conf_score)}%",
        "confidenceScore": round(final_conf_score, 1),
        "extractionMethod": extraction_method,
        "extractedData": validated_data,
        "validationWarnings": warnings,
        "requiresConfirmation": req_confirm,
        "rawTextSnippet": raw_text[:350].strip(),
    }

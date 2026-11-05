import io
import re
import shutil
from typing import Tuple, Dict, Any, Optional
from PIL import Image
import pypdf

# Configure Tesseract OCR path on Windows if installed
try:
    import pytesseract
    tesseract_bin = shutil.which("tesseract") or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    pytesseract.pytesseract.tesseract_cmd = tesseract_bin
    TESSERACT_AVAILABLE = True
except Exception:
    TESSERACT_AVAILABLE = False


GENERIC_TITLES = {
    "invoice copy", "tax invoice", "retail invoice", "receipt", "bill",
    "statement", "cash memo", "delivery note", "credit note", "purchase order",
    "invoice", "original", "duplicate", "triplicate", "customer copy"
}


def extract_text_and_confidence(file_bytes: bytes, filename: str) -> Tuple[str, str, float, str]:
    """
    Extracts text and computes actual confidence score.
    Returns: (extracted_text, method_used, confidence_percentage, status_summary)
    """
    lower_name = filename.lower()

    # 1. Text-based PDF processing
    if lower_name.endswith(".pdf"):
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            raw_pages = []
            for page in reader.pages:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    raw_pages.append(page_text.strip())

            combined_text = "\n\n".join(raw_pages)

            # If embedded text exists in the PDF, use it
            if len(combined_text.strip()) >= 30:
                method = "Digital PDF (Embedded Text)"
                # Compute confidence based on text density and readability
                words = combined_text.split()
                alpha_words = [w for w in words if any(c.isalpha() for c in w)]
                word_ratio = len(alpha_words) / max(len(words), 1)

                # Base confidence for clean digital PDF
                confidence = 94.0 + min(5.0, round(word_ratio * 5.0, 1))
                return combined_text, method, confidence, "Embedded text extracted"
        except Exception as e:
            # Fall back to OCR if digital parsing fails
            pass

        # 2. Scanned PDF fallback via Tesseract OCR
        if TESSERACT_AVAILABLE:
            try:
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                ocr_texts = []
                confs = []
                for page in reader.pages:
                    for img_obj in page.images:
                        pil_img = Image.open(io.BytesIO(img_obj.data))
                        ocr_data = pytesseract.image_to_data(pil_img, output_type=pytesseract.Output.DICT)
                        page_confs = [c for c in ocr_data["conf"] if c != -1]
                        if page_confs:
                            confs.extend(page_confs)
                        ocr_texts.append(pytesseract.image_to_string(pil_img))

                if ocr_texts:
                    combined = "\n".join(ocr_texts).strip()
                    avg_conf = (sum(confs) / len(confs)) if confs else 50.0
                    return combined, "Tesseract OCR (Scanned PDF)", round(avg_conf, 1), "Scanned pages processed via OCR"
            except Exception:
                pass

    # 3. Image OCR (PNG, JPG, TIFF, etc.)
    if any(lower_name.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"]):
        if TESSERACT_AVAILABLE:
            try:
                pil_img = Image.open(io.BytesIO(file_bytes))
                ocr_text = pytesseract.image_to_string(pil_img)
                ocr_data = pytesseract.image_to_data(pil_img, output_type=pytesseract.Output.DICT)
                confs = [c for c in ocr_data["conf"] if c != -1]
                avg_conf = (sum(confs) / len(confs)) if confs else 40.0
                return ocr_text, "Tesseract OCR (Image)", round(avg_conf, 1), "Image processed via OCR"
            except Exception as e:
                return f"OCR processing error: {str(e)}", "Tesseract OCR (Error)", 0.0, "OCR Failed"

    # Default fallback when unreadable or empty
    return "", "Unrecognized Format / Empty", 0.0, "No readable text or characters found"


def _clean_str(val: Optional[str]) -> str:
    if not val:
        return "Not detected"
    cleaned = val.strip().strip(":").strip("-").strip()
    return cleaned if cleaned else "Not detected"


def parse_fuel(text: str) -> Dict[str, Any]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    provider = "Not detected"
    customer = "Not detected"
    customer_id = "Not detected"
    fuel_type = "Not detected"
    quantity = None
    unit = "Not detected"
    date_val = "Not detected"
    vehicle_num = "Not detected"
    receipt_num = "Not detected"

    # 1. Provider / Station
    prov_match = re.search(r'(?:Supplier|Vendor|Merchant|Issued By)[\s:]+([^\n\r|]+)', text, re.I)
    if prov_match:
        cand = prov_match.group(1).strip()
        if cand.lower() not in GENERIC_TITLES:
            provider = cand
    else:
        for line in lines[:4]:
            if line.lower() in GENERIC_TITLES:
                continue
            if any(k in line.lower() for k in ['fuels', 'petrol', 'station', 'bunk', 'retail', 'corporation', 'oil', 'energy', 'gas']):
                if not any(k in line.lower() for k in ['gstin', 'invoice', 'receipt', 'tax', 'bill', 'date', 'rate', 'item', 'customer']):
                    provider = line
                    break
        if provider == "Not detected" and lines:
            if lines[0].lower() not in GENERIC_TITLES and not any(k in lines[0].lower() for k in ['gstin', 'invoice', 'receipt']):
                provider = lines[0]

    # 2. Fuel Type
    fuel_patterns = [
        r'High\s+Speed\s+Diesel',
        r'Diesel',
        r'Unleaded\s+Petrol',
        r'Petrol',
        r'Gasoline',
        r'Biofuel',
        r'CNG',
        r'LPG',
        r'Aviation\s+Fuel'
    ]
    # Check item row first
    for pattern in fuel_patterns:
        match = re.search(r'(?:Item(?:\s+Description)?|Product|Fuel)[\s:]*.*?' + pattern, text, re.I | re.DOTALL)
        if match:
            actual_match = re.search(pattern, match.group(0), re.I)
            if actual_match:
                fuel_type = actual_match.group(0)
                break
    if fuel_type == "Not detected":
        for pattern in fuel_patterns:
            m = re.search(r'\b' + pattern + r'\b', text, re.I)
            if m:
                fuel_type = m.group(0)
                break

    # 3. Customer & Customer ID
    cust_id_match = re.search(r'Customer\s*ID[\s:]+([A-Za-z0-9_-]+)', text, re.I)
    if cust_id_match:
        customer_id = cust_id_match.group(1).strip()

    cust_match = re.search(r'Customer(?!\s*ID)[\s:]+([^\n\r|]+)', text, re.I)
    if cust_match:
        cand_cust = cust_match.group(1).strip()
        if not cand_cust.lower().startswith('id'):
            customer = cand_cust

    # 4. Date
    date_match = re.search(r'(?:Date|Dated)[\s:]+([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}[/-][0-9]{2}[/-][0-9]{4}|[A-Za-z]+\s+[0-9]{1,2},?\s+[0-9]{4})', text, re.I)
    if date_match:
        date_val = date_match.group(1).strip()

    # 5. Vehicle Number
    veh_match = re.search(r'Vehicle(?:\s+No|\s+Number)?[\s:]+([A-Za-z0-9-]+)', text, re.I)
    if veh_match:
        vehicle_num = veh_match.group(1).strip()

    # 6. Receipt Number
    rec_match = re.search(r'(?:Receipt|Invoice|Bill|Ref)\s*(?:No\.?|Number|#|ID)[\s:]+([A-Za-z0-9_-]+)', text, re.I)
    if rec_match:
        receipt_num = rec_match.group(1).strip()

    # 7. Quantity & Unit
    qty_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(litres|liters|ltrs|ltr|l|gallons|gal)\b', text, re.I)
    if qty_match:
        val_str = qty_match.group(1).replace(',', '')
        try:
            quantity = float(val_str)
            unit = qty_match.group(2).strip()
        except ValueError:
            pass
    else:
        qty_col = re.search(r'Quantity[\s:]*(\d+(?:[.,]\d+)?)', text, re.I)
        if qty_col:
            try:
                quantity = float(qty_col.group(1).replace(',', ''))
                unit = 'litres'
            except ValueError:
                pass

    return {
        "provider": _clean_str(provider),
        "customer": _clean_str(customer),
        "customerId": _clean_str(customer_id),
        "fuelType": _clean_str(fuel_type),
        "quantity": quantity,
        "unit": _clean_str(unit),
        "date": _clean_str(date_val),
        "vehicleNumber": _clean_str(vehicle_num),
        "receiptNumber": _clean_str(receipt_num),
    }


def parse_electricity(text: str) -> Dict[str, Any]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    provider = "Not detected"
    customer = "Not detected"
    period = "Not detected"
    quantity = None
    unit = "Not detected"
    account_num = "Not detected"
    meter_num = "Not detected"
    date_val = "Not detected"

    # Provider
    prov_match = re.search(r'(?:Supplier|Utility|Provider|Company)[\s:]+([^\n\r|]+)', text, re.I)
    if prov_match:
        cand = prov_match.group(1).strip()
        if cand.lower() not in GENERIC_TITLES:
            provider = cand
    else:
        for line in lines[:4]:
            if line.lower() in GENERIC_TITLES:
                continue
            if any(k in line.lower() for k in ['grid', 'power', 'electric', 'energy', 'utilities', 'board']):
                if not any(k in line.lower() for k in ['statement', 'invoice', 'bill', 'date', 'account', 'customer']):
                    provider = line
                    break
        if provider == "Not detected" and lines:
            if lines[0].lower() not in GENERIC_TITLES and not any(k in lines[0].lower() for k in ['invoice', 'bill', 'receipt']):
                provider = lines[0]

    # Customer
    cust_match = re.search(r'Customer[\s:]+([^\n\r|]+)', text, re.I)
    if cust_match:
        customer = cust_match.group(1).strip()

    # Period
    per_match = re.search(r'(?:Billing\s+Period|Period)[\s:]+([^\n\r|]+)', text, re.I)
    if per_match:
        period = per_match.group(1).strip()

    # Account Number
    acc_match = re.search(r'(?:Account(?:\s+Number|\s+No\.?|#)?)[\s:]+([A-Za-z0-9_-]+)', text, re.I)
    if acc_match:
        account_num = acc_match.group(1).strip()

    # Meter Number
    mtr_match = re.search(r'(?:Meter(?:\s+Number|\s+No\.?|#)?)[\s:]+([A-Za-z0-9_-]+)', text, re.I)
    if mtr_match:
        meter_num = mtr_match.group(1).strip()

    # Date
    date_match = re.search(r'(?:Billing\s+Date|Date|Dated)[\s:]+([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}[/-][0-9]{2}[/-][0-9]{4}|[A-Za-z]+\s+[0-9]{1,2},?\s+[0-9]{4})', text, re.I)
    if date_match:
        date_val = date_match.group(1).strip()

    # Quantity & Unit
    qty_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(kwh|mwh|gwh)\b', text, re.I)
    if qty_match:
        try:
            quantity = float(qty_match.group(1).replace(',', ''))
            unit = qty_match.group(2).upper()
        except ValueError:
            pass
    else:
        qty_col = re.search(r'(?:Consumed|Usage|Total\s+Energy|Active\s+Energy)[\s:]*\n?\s*(\d+(?:[.,]\d+)?)\s*(kwh|mwh)?', text, re.I)
        if qty_col:
            try:
                quantity = float(qty_col.group(1).replace(',', ''))
                unit = (qty_col.group(2) or 'kWh').upper()
            except ValueError:
                pass

    return {
        "provider": _clean_str(provider),
        "customer": _clean_str(customer),
        "period": _clean_str(period),
        "quantity": quantity,
        "unit": _clean_str(unit),
        "accountNumber": _clean_str(account_num),
        "meterNumber": _clean_str(meter_num),
        "date": _clean_str(date_val),
    }


def parse_transport(text: str) -> Dict[str, Any]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    carrier = "Not detected"
    origin = "Not detected"
    destination = "Not detected"
    quantity = None
    unit = "Not detected"
    date_val = "Not detected"
    vehicle_num = "Not detected"
    waybill_num = "Not detected"

    carrier_match = re.search(r'(?:Carrier|Haulier|Transporter)[\s:]+([^\n\r|]+)', text, re.I)
    if carrier_match:
        carrier = carrier_match.group(1).strip()
    elif lines and lines[0].lower() not in GENERIC_TITLES:
        carrier = lines[0]

    orig_match = re.search(r'(?:Origin|From)[\s:]+([^\n\r|]+)', text, re.I)
    if orig_match:
        origin = orig_match.group(1).strip()

    dest_match = re.search(r'(?:Destination|To)[\s:]+([^\n\r|]+)', text, re.I)
    if dest_match:
        destination = dest_match.group(1).strip()

    qty_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(tonne-km|ton-km|km|miles|tonnes|tons)\b', text, re.I)
    if qty_match:
        try:
            quantity = float(qty_match.group(1).replace(',', ''))
            unit = qty_match.group(2).strip()
        except ValueError:
            pass

    date_match = re.search(r'(?:Date|Dated)[\s:]+([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}[/-][0-9]{2}[/-][0-9]{4})', text, re.I)
    if date_match:
        date_val = date_match.group(1).strip()

    veh_match = re.search(r'Vehicle(?:\s+No|\s+Reg)?[\s:]+([A-Za-z0-9-]+)', text, re.I)
    if veh_match:
        vehicle_num = veh_match.group(1).strip()

    wb_match = re.search(r'(?:Waybill|Consignment|Tracking)\s*(?:No\.?|Number|#|ID)[\s:]+([A-Za-z0-9_-]+)', text, re.I)
    if wb_match:
        waybill_num = wb_match.group(1).strip()

    return {
        "carrier": _clean_str(carrier),
        "origin": _clean_str(origin),
        "destination": _clean_str(destination),
        "quantity": quantity,
        "unit": _clean_str(unit),
        "date": _clean_str(date_val),
        "vehicleNumber": _clean_str(vehicle_num),
        "waybillNumber": _clean_str(waybill_num),
    }


def parse_invoices(text: str) -> Dict[str, Any]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    supplier = "Not detected"
    customer = "Not detected"
    invoice_num = "Not detected"
    item = "Not detected"
    quantity = None
    unit = "Not detected"
    date_val = "Not detected"

    supp_match = re.search(r'(?:Supplier|Vendor|From)[\s:]+([^\n\r|]+)', text, re.I)
    if supp_match:
        supplier = supp_match.group(1).strip()
    elif lines and lines[0].lower() not in GENERIC_TITLES:
        supplier = lines[0]

    cust_match = re.search(r'(?:Customer|Billed To|To)[\s:]+([^\n\r|]+)', text, re.I)
    if cust_match:
        customer = cust_match.group(1).strip()

    inv_match = re.search(r'(?:Invoice|Bill|Ref)\s*(?:No\.?|Number|#|ID)[\s:]+([A-Za-z0-9_-]+)', text, re.I)
    if inv_match:
        invoice_num = inv_match.group(1).strip()

    item_match = re.search(r'(?:Item|Product|Description)[\s:]+([^\n\r|]+)', text, re.I)
    if item_match:
        item = item_match.group(1).strip()

    qty_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(kg|tonnes|tons|units|pcs)\b', text, re.I)
    if qty_match:
        try:
            quantity = float(qty_match.group(1).replace(',', ''))
            unit = qty_match.group(2).strip()
        except ValueError:
            pass

    date_match = re.search(r'(?:Date|Invoice Date)[\s:]+([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}[/-][0-9]{2}[/-][0-9]{4})', text, re.I)
    if date_match:
        date_val = date_match.group(1).strip()

    return {
        "supplier": _clean_str(supplier),
        "customer": _clean_str(customer),
        "invoiceNumber": _clean_str(invoice_num),
        "item": _clean_str(item),
        "quantity": quantity,
        "unit": _clean_str(unit),
        "date": _clean_str(date_val),
    }


def parse_document(file_bytes: bytes, filename: str, doc_type: str) -> Dict[str, Any]:
    """
    Main entry point for document ingestion.
    Extracts text, identifies fields for the given doc_type, and computes accurate confidence.
    """
    text, method, raw_conf, status_msg = extract_text_and_confidence(file_bytes, filename)

    # Run category parser
    if doc_type == "fuel":
        extracted_data = parse_fuel(text)
    elif doc_type == "transport":
        extracted_data = parse_transport(text)
    elif doc_type == "invoices":
        extracted_data = parse_invoices(text)
    else:  # default electricity
        extracted_data = parse_electricity(text)

    # Calculate actual confidence based on extraction method and field detection
    detected_count = 0
    total_fields = len(extracted_data)
    for k, v in extracted_data.items():
        if v not in ("Not detected", None, ""):
            detected_count += 1

    field_ratio = detected_count / max(total_fields, 1)

    if raw_conf > 0:
        if extracted_data.get("quantity") is None:
            # Significant penalty if quantity is missing
            final_conf = min(raw_conf * 0.5, 45.0)
        else:
            final_conf = min(99.0, max(30.0, raw_conf * (0.6 + 0.4 * field_ratio)))
    else:
        final_conf = round(field_ratio * 40.0, 1)

    confidence_str = f"{round(final_conf)}%"

    return {
        "fileName": filename,
        "type": doc_type,
        "extractionMethod": method,
        "confidence": confidence_str,
        "confidenceScore": round(final_conf, 1),
        "status": "Extracted" if detected_count > 0 else "Failed / Low Quality",
        "extractedTextSnippet": text[:300].strip(),
        "extractedData": extracted_data,
        "detectedFieldCount": detected_count,
        "totalFieldCount": total_fields
    }

import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse
from app.schemas.extraction import DocumentExtractionResponse
from app.services.gemini_extractor import process_document_pipeline, CATEGORY_NAMES

router = APIRouter(prefix="/documents", tags=["Documents"])

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"}

@router.get("", response_model=List[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    """
    List all uploaded utility bills and receipts from the database.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return db.query(Document).order_by(Document.id.desc()).all()

@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: int, db: Session = Depends(get_db)):
    """
    Retrieve document metadata by ID.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document #{doc_id} not found")
    return doc

@router.post("/extract", response_model=DocumentExtractionResponse)
async def extract_document(
    file: UploadFile = File(...),
    doc_type: str = Form("electricity"),
    save_to_db: bool = Form(True),
    db: Session = Depends(get_db),
):
    """
    Phase 4 AI Document Processing Endpoint:
    - Extracts embedded text from PDF or applies Tesseract OCR.
    - Sends to Gemini AI for structured JSON extraction (with graceful deterministic fallback).
    - Validates data types with Pydantic and flags warnings for anomalies or category mismatch.
    - Persists document record in SQLite.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Extension validation
    dot_idx = file.filename.rfind(".")
    ext = file.filename[dot_idx:].lower() if dot_idx != -1 else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of 25MB ({len(file_bytes) / (1024*1024):.1f}MB detected)"
        )

    file_size_str = (
        f"{len(file_bytes) / (1024 * 1024):.2f} MB"
        if len(file_bytes) >= 1048576
        else f"{len(file_bytes) / 1024:.1f} KB"
    )

    norm_type = doc_type.lower()
    if norm_type not in CATEGORY_NAMES:
        norm_type = "electricity"

    # Execute complete extraction pipeline (OCR + Gemini + Pydantic validation)
    result = process_document_pipeline(file_bytes, file.filename, norm_type)

    type_name = CATEGORY_NAMES.get(norm_type, "Document")
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    db_id = None
    doc_code = None

    if save_to_db and db is not None:
        next_num = 1
        while db.query(Document).filter(Document.doc_code == f"DOC-00{next_num}").first():
            next_num += 1
        doc_code = f"DOC-00{next_num}"
        db_doc = Document(
            doc_code=doc_code,
            file_name=file.filename,
            file_type=type_name,
            file_size=file_size_str,
            upload_date=today_str,
            status=result["status"],
            confidence=result["confidence"],
            extracted_data_json=json.dumps(result["extractedData"]),
        )
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
        db_id = str(db_doc.id)

    return {
        "id": db_id or f"DOC-{int(datetime.now().timestamp()) % 10000}",
        "docCode": doc_code or f"DOC-{int(datetime.now().timestamp()) % 10000}",
        "fileName": file.filename,
        "type": type_name,
        "category": norm_type,
        "detectedCategory": result["detectedCategory"],
        "uploadDate": today_str,
        "fileSize": file_size_str,
        "status": result["status"],
        "confidence": result["confidence"],
        "confidenceScore": result["confidenceScore"],
        "extractionMethod": result["extractionMethod"],
        "extractedData": result["extractedData"],
        "validationWarnings": result["validationWarnings"],
        "requiresConfirmation": result["requiresConfirmation"],
        "rawTextSnippet": result["rawTextSnippet"],
    }

@router.put("/{doc_id}/review", response_model=DocumentResponse)
def review_document(
    doc_id: int,
    reviewed_data: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """
    Save user-edited / human-confirmed extracted document data.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document #{doc_id} not found")

    doc.status = "Human Verified"
    doc.extracted_data_json = json.dumps(reviewed_data)
    db.commit()
    db.refresh(doc)
    return doc

@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_document_record(doc: DocumentCreate, db: Session = Depends(get_db)):
    """
    Register a new ingested document record metadata into the database.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    data = doc.model_dump()
    if not data.get("doc_code"):
        next_num = 1
        while db.query(Document).filter(Document.doc_code == f"DOC-00{next_num}").first():
            next_num += 1
        data["doc_code"] = f"DOC-00{next_num}"

    db_item = Document(**data)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{doc_id}", response_model=DocumentResponse)
def update_document_record(
    doc_id: int,
    update_data: DocumentUpdate,
    db: Session = Depends(get_db),
):
    """
    Update document processing status or extracted JSON data.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document #{doc_id} not found")

    payload = update_data.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(doc, key, value)

    db.commit()
    db.refresh(doc)
    return doc

@router.delete("/{doc_id}", status_code=status.HTTP_200_OK)
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    """
    Delete document metadata from database.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document #{doc_id} not found")

    db.delete(doc)
    db.commit()
    return {"status": "deleted", "id": doc_id, "file_name": doc.file_name}

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])

@router.get("", response_model=List[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db)):
    """
    List all Scope 3 supply chain vendors from the database.
    """
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable",
        )
    return db.query(Supplier).order_by(Supplier.id.asc()).all()

@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    """
    Get a specific supplier by ID.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail=f"Supplier #{supplier_id} not found")
    return supplier

@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(supplier: SupplierCreate, db: Session = Depends(get_db)):
    """
    Register a new supplier with duplicate name prevention and persistence.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Duplicate Prevention: Check case-insensitive supplier name
    existing = db.query(Supplier).filter(
        func.lower(Supplier.name) == supplier.name.strip().lower()
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A supplier with name '{supplier.name}' already exists in the database.",
        )

    # Determine supplier code if not provided
    data = supplier.model_dump()
    if not data.get("supplier_code"):
        next_num = 1
        while db.query(Supplier).filter(Supplier.supplier_code == f"SUP-0{next_num}").first():
            next_num += 1
        data["supplier_code"] = f"SUP-0{next_num}"

    db_supplier = Supplier(**data)
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(supplier_id: int, update_data: SupplierUpdate, db: Session = Depends(get_db)):
    """
    Update an existing supplier's parameters.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail=f"Supplier #{supplier_id} not found")

    payload = update_data.model_dump(exclude_unset=True)

    # Duplicate check if updating name
    if "name" in payload and payload["name"]:
        name_clean = payload["name"].strip()
        conflict = db.query(Supplier).filter(
            func.lower(Supplier.name) == name_clean.lower(),
            Supplier.id != supplier_id,
        ).first()
        if conflict:
            raise HTTPException(
                status_code=400,
                detail=f"Another supplier named '{name_clean}' already exists.",
            )
        payload["name"] = name_clean

    for key, value in payload.items():
        setattr(supplier, key, value)

    db.commit()
    db.refresh(supplier)
    return supplier

@router.delete("/{supplier_id}", status_code=status.HTTP_200_OK)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    """
    Delete a supplier from the database.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail=f"Supplier #{supplier_id} not found")

    db.delete(supplier)
    db.commit()
    return {"status": "deleted", "id": supplier_id, "name": supplier.name}

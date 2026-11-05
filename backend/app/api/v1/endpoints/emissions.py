from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.activity import EmissionActivity
from app.schemas.activity import ActivityCreate, ActivityUpdate, ActivityResponse

router = APIRouter(prefix="/emissions", tags=["Emissions"])

@router.get("", response_model=List[ActivityResponse])
def list_emission_activities(db: Session = Depends(get_db)):
    """
    List itemized greenhouse gas emission activities with full audit trail from DB.
    Displays source, quantity, factor, formula, and data quality tier (Rule #4).
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return db.query(EmissionActivity).order_by(EmissionActivity.id.asc()).all()

@router.get("/{activity_id}", response_model=ActivityResponse)
def get_emission_activity(activity_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a single emission activity by ID.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    activity = db.query(EmissionActivity).filter(EmissionActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail=f"Activity #{activity_id} not found")
    return activity

@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_emission_activity(activity: ActivityCreate, db: Session = Depends(get_db)):
    """
    Record an emission activity entry in the database.
    All mathematical calculations must be executed deterministically in Python (Rule #2).
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    data = activity.model_dump()
    if not data.get("activity_code"):
        next_num = 1
        while db.query(EmissionActivity).filter(EmissionActivity.activity_code == f"ACT-00{next_num}").first():
            next_num += 1
        data["activity_code"] = f"ACT-00{next_num}"

    db_item = EmissionActivity(**data)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{activity_id}", response_model=ActivityResponse)
def update_emission_activity(
    activity_id: int,
    update_data: ActivityUpdate,
    db: Session = Depends(get_db),
):
    """
    Update an existing emission activity record.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    activity = db.query(EmissionActivity).filter(EmissionActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail=f"Activity #{activity_id} not found")

    payload = update_data.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(activity, key, value)

    db.commit()
    db.refresh(activity)
    return activity

@router.delete("/{activity_id}", status_code=status.HTTP_200_OK)
def delete_emission_activity(activity_id: int, db: Session = Depends(get_db)):
    """
    Delete an emission activity record from the inventory.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    activity = db.query(EmissionActivity).filter(EmissionActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail=f"Activity #{activity_id} not found")

    db.delete(activity)
    db.commit()
    return {"status": "deleted", "id": activity_id, "name": activity.name}

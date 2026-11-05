from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.report import Report
from app.models.activity import EmissionActivity
from app.schemas.report import ReportCreate, ReportResponse

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("", response_model=List[ReportResponse])
def list_reports(db: Session = Depends(get_db)):
    """
    List generated GHG compliance reports and audit summaries from the database.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return db.query(Report).order_by(Report.id.asc()).all()

@router.get("/{report_id}", response_model=ReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db)):
    """
    Retrieve report details by ID.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail=f"Report #{report_id} not found")
    return report

@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(report_in: ReportCreate, db: Session = Depends(get_db)):
    """
    Generate and save a compliance report into the database.
    If scope breakdown is not provided, dynamically sums live emission activities from the database.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    data = report_in.model_dump()

    # If emission numbers not explicitly supplied, calculate live from database
    if data.get("total_emissions") is None:
        activities = db.query(EmissionActivity).all()
        scope1 = sum(a.emissions for a in activities if "Scope 1" in a.category)
        scope2 = sum(a.emissions for a in activities if "Scope 2" in a.category)
        scope3 = sum(a.emissions for a in activities if "Scope 3" in a.category)
        data["scope1"] = round(scope1, 2)
        data["scope2"] = round(scope2, 2)
        data["scope3"] = round(scope3, 2)
        data["total_emissions"] = round(scope1 + scope2 + scope3, 2)

    if not data.get("report_code"):
        next_num = 1
        while db.query(Report).filter(Report.report_code == f"RPT-2026-TM{next_num:02d}").first():
            next_num += 1
        data["report_code"] = f"RPT-2026-TM{next_num:02d}"

    db_report = Report(**data)
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

@router.delete("/{report_id}", status_code=status.HTTP_200_OK)
def delete_report(report_id: int, db: Session = Depends(get_db)):
    """
    Delete a report record from the database.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail=f"Report #{report_id} not found")

    db.delete(report)
    db.commit()
    return {"status": "deleted", "id": report_id, "report_name": report.report_name}

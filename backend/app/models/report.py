from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    report_code = Column(String(50), unique=True, index=True, nullable=True)
    report_name = Column(String(255), nullable=False)
    reporting_year = Column(String(50), nullable=False)
    total_emissions = Column(Float, nullable=False)
    scope1 = Column(Float, nullable=False)
    scope2 = Column(Float, nullable=False)
    scope3 = Column(Float, nullable=False)
    format = Column(String(20), default="PDF")
    created_at = Column(DateTime, default=utc_now)

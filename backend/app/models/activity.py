from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class EmissionActivity(Base):
    __tablename__ = "emission_activities"

    id = Column(Integer, primary_key=True, index=True)
    activity_code = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)  # Scope 1, Scope 2, Scope 3
    source = Column(String(255), nullable=False)    # Source bill/receipt reference
    quantity = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)
    factor = Column(Float, nullable=False)
    factor_source = Column(String(255), nullable=False)
    formula = Column(String(255), nullable=False)
    quality = Column(String(100), nullable=False)   # Tier 1, Tier 2, Tier 3
    emissions = Column(Float, nullable=False)       # tCO2e
    activity_date = Column(String(50), nullable=False)
    verified = Column(Boolean, default=True)
    is_synthetic = Column(Boolean, default=True)    # Rule 5: Demo data labeled synthetic
    created_at = Column(DateTime, default=utc_now)

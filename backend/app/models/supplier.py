from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    supplier_code = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    location = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    annual_spend = Column(String(50), nullable=False)
    distance_km = Column(Float, nullable=False)
    esg_rating = Column(String(20), default="A-")
    emissions_tons = Column(Float, nullable=False)
    intensity = Column(String(50), default="0.32 kg CO₂e/₹100")
    status = Column(String(50), default="Verified Supplier")
    created_at = Column(DateTime, default=utc_now)

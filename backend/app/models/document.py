from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    doc_code = Column(String(50), unique=True, index=True, nullable=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)  # Electricity Bill, Fuel Receipt, etc.
    file_size = Column(String(50), nullable=False)
    upload_date = Column(String(50), nullable=False)
    status = Column(String(50), default="Extracted") # Extracted, Needs Review, Pending
    confidence = Column(String(20), default="95%")
    extracted_data_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

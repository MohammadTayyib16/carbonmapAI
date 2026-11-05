from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class ReportBase(BaseModel):
    report_name: str = Field(..., min_length=1, max_length=255)
    reporting_year: str = Field(..., min_length=1, max_length=50)
    total_emissions: float = Field(..., ge=0)
    scope1: float = Field(..., ge=0)
    scope2: float = Field(..., ge=0)
    scope3: float = Field(..., ge=0)
    format: str = Field("PDF / CSV", max_length=20)

class ReportCreate(BaseModel):
    report_name: str = Field(..., min_length=1, max_length=255)
    reporting_year: str = Field(..., min_length=1, max_length=50)
    total_emissions: Optional[float] = None
    scope1: Optional[float] = None
    scope2: Optional[float] = None
    scope3: Optional[float] = None
    format: str = "PDF / CSV"

class ReportResponse(ReportBase):
    id: int
    report_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

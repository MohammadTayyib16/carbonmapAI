from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class ActivityBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Activity description/name")
    category: str = Field(..., min_length=1, max_length=100, description="GHG Scope and category")
    source: str = Field(..., min_length=1, max_length=255, description="Source document reference")
    quantity: float = Field(..., gt=0, description="Measured quantity must be positive")
    unit: str = Field(..., min_length=1, max_length=50, description="Measurement unit (kWh, Liters, etc.)")
    factor: float = Field(..., ge=0, description="Emission factor")
    factor_source: str = Field(..., min_length=1, max_length=255, description="Authoritative factor database source")
    formula: str = Field(..., min_length=1, max_length=255, description="Explicit deterministic formula audit trail")
    quality: str = Field(..., min_length=1, max_length=100, description="Data quality tier (Tier 1, Tier 2, Tier 3)")
    emissions: float = Field(..., ge=0, description="Calculated emissions in tCO2e")
    activity_date: str = Field(..., min_length=1, max_length=50, description="Date of activity (YYYY-MM-DD)")
    verified: bool = True
    is_synthetic: bool = True

class ActivityCreate(ActivityBase):
    activity_code: Optional[str] = None

class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    quantity: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = None
    factor: Optional[float] = Field(None, ge=0)
    factor_source: Optional[str] = None
    formula: Optional[str] = None
    quality: Optional[str] = None
    emissions: Optional[float] = Field(None, ge=0)
    activity_date: Optional[str] = None
    verified: Optional[bool] = None

class ActivityResponse(ActivityBase):
    id: int
    activity_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

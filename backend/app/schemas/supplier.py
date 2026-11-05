from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class SupplierBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Supplier company name")
    category: str = Field(..., min_length=1, max_length=100, description="Supplier supply chain category")
    location: str = Field(..., min_length=1, max_length=255, description="City / Regional Hub location")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Geographic latitude coordinate")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Geographic longitude coordinate")
    annual_spend: str = Field(..., min_length=1, max_length=50, description="Annual procurement spend")
    distance_km: float = Field(..., ge=0, description="Route distance in kilometers")
    esg_rating: str = Field("A-", max_length=20, description="ESG compliance grade")
    emissions_tons: float = Field(..., ge=0, description="Allocated Scope 3 emissions in tCO2e")
    intensity: str = Field("0.32 kg CO₂e/₹100", max_length=50, description="Carbon intensity per spend")
    status: str = Field("Verified Supplier", max_length=50, description="Vendor verification status")

class SupplierCreate(SupplierBase):
    supplier_code: Optional[str] = None

class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    annual_spend: Optional[str] = None
    distance_km: Optional[float] = Field(None, ge=0)
    esg_rating: Optional[str] = None
    emissions_tons: Optional[float] = Field(None, ge=0)
    intensity: Optional[str] = None
    status: Optional[str] = None

class SupplierResponse(SupplierBase):
    id: int
    supplier_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

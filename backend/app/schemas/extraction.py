from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator

class FuelExtractionData(BaseModel):
    provider: str = Field("Not detected", description="Supplier, bunk or fuel station name")
    customer: str = Field("Not detected", description="Billed customer or business name")
    customerId: str = Field("Not detected", description="Customer reference or account identifier")
    fuelType: str = Field("Not detected", description="Type of fuel (e.g. High Speed Diesel, Petrol, Biofuel)")
    quantity: Optional[float] = Field(None, description="Dispensed volume in litres or gallons")
    unit: str = Field("litres", description="Measurement unit (e.g. litres, gallons)")
    date: str = Field("Not detected", description="Transaction date (YYYY-MM-DD)")
    vehicleNumber: str = Field("Not detected", description="Vehicle registration or fleet number")
    receiptNumber: str = Field("Not detected", description="Receipt, bill or invoice reference ID")

    @field_validator("quantity")
    @classmethod
    def validate_positive_quantity(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            return None
        return v


class ElectricityExtractionData(BaseModel):
    provider: str = Field("Not detected", description="Utility company or grid provider")
    customer: str = Field("Not detected", description="Customer or company name")
    period: str = Field("Not detected", description="Billing period (e.g. September 2026)")
    quantity: Optional[float] = Field(None, description="Active energy consumed in kWh")
    unit: str = Field("kWh", description="Energy unit")
    accountNumber: str = Field("Not detected", description="Utility account identifier")
    meterNumber: str = Field("Not detected", description="Physical meter serial number")
    date: str = Field("Not detected", description="Statement or billing date")

    @field_validator("quantity")
    @classmethod
    def validate_positive_quantity(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            return None
        return v


class TransportExtractionData(BaseModel):
    carrier: str = Field("Not detected", description="Freight haulier or shipping carrier")
    origin: str = Field("Not detected", description="Origin dispatch location or hub")
    destination: str = Field("Not detected", description="Destination receiving port or facility")
    quantity: Optional[float] = Field(None, description="Freight activity volume (tonne-km or km)")
    unit: str = Field("tonne-km", description="Transport measurement unit")
    date: str = Field("Not detected", description="Dispatch or delivery date")
    vehicleNumber: str = Field("Not detected", description="Truck registration or container ID")
    waybillNumber: str = Field("Not detected", description="Waybill, consignment note or tracking number")

    @field_validator("quantity")
    @classmethod
    def validate_positive_quantity(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            return None
        return v


class InvoiceExtractionData(BaseModel):
    supplier: str = Field("Not detected", description="Vendor or manufacturer business name")
    customer: str = Field("Not detected", description="Purchaser or client company")
    invoiceNumber: str = Field("Not detected", description="Invoice reference identifier")
    item: str = Field("Not detected", description="Purchased raw material or product description")
    quantity: Optional[float] = Field(None, description="Purchased quantity or mass in kg/tonnes")
    unit: str = Field("kg", description="Unit of mass or count")
    date: str = Field("Not detected", description="Invoice issue date")

    @field_validator("quantity")
    @classmethod
    def validate_positive_quantity(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            return None
        return v


class DocumentExtractionResponse(BaseModel):
    id: str
    docCode: str
    fileName: str
    type: str
    category: str
    detectedCategory: str
    uploadDate: str
    fileSize: str
    status: str
    confidence: str
    confidenceScore: float
    extractionMethod: str
    extractedData: Dict[str, Any]
    validationWarnings: List[str] = []
    requiresConfirmation: bool = False
    rawTextSnippet: str = ""

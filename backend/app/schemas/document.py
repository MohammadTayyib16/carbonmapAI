from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class DocumentBase(BaseModel):
    file_name: str = Field(..., min_length=1, max_length=255)
    file_type: str = Field(..., min_length=1, max_length=100)
    file_size: str = Field(..., min_length=1, max_length=50)
    upload_date: str = Field(..., min_length=1, max_length=50)
    status: str = Field("Extracted", max_length=50)
    confidence: str = Field("95%", max_length=20)
    extracted_data_json: Optional[str] = None

class DocumentCreate(DocumentBase):
    doc_code: Optional[str] = None

class DocumentUpdate(BaseModel):
    status: Optional[str] = None
    confidence: Optional[str] = None
    extracted_data_json: Optional[str] = None

class DocumentResponse(DocumentBase):
    id: int
    doc_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

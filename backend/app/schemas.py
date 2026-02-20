from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DocumentBase(BaseModel):
    name: str
    source: str
    type: str

class DocumentCreate(DocumentBase):
    pass

class Document(DocumentBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class RagConfig(BaseModel):
    enabled: bool = True
    selected_doc_ids: Optional[List[str]] = None

class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []
    rag_config: Optional[RagConfig] = None

class IngestURLRequest(BaseModel):
    url: str

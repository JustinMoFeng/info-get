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
    chat_id: Optional[str] = None
    rag_config: Optional[RagConfig] = None

class IngestURLRequest(BaseModel):
    url: str

# New Schemas for Chat History

class MessageBase(BaseModel):
    role: str
    content: str
    thought_steps: Optional[str] = None # JSON string

class MessageCreate(MessageBase):
    chat_id: str

class Message(MessageBase):
    id: str
    chat_id: str
    created_at: datetime
    is_summarized: bool = False

    class Config:
        from_attributes = True

class ChatBase(BaseModel):
    title: str
    summary: Optional[str] = None

class ChatCreate(ChatBase):
    pass

class Chat(ChatBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class GlobalMemoryBase(BaseModel):
    content: str

class GlobalMemory(GlobalMemoryBase):
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True

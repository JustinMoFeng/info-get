from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel
import shutil
import os
import uuid
from backend.app.rag.store import VectorStore
from backend.app.ingestion.web_loader import WebLoader
from backend.app.ingestion.file_loader import FileLoader
from backend.app.chat.llm import LLMService
from langchain_core.documents import Document
from backend.app.core.config import AppSettings, get_settings, save_settings

router = APIRouter()

# Simple in-memory dependency injection for now
class ServiceContainer:
    vector_store: VectorStore = None
    llm_service: LLMService = None

_services = ServiceContainer()

def get_services() -> ServiceContainer:
    global _services
    if not _services.vector_store:
        try:
            _services.vector_store = VectorStore()
            print("VectorStore initialized")
        except Exception as e:
            print(f"Failed to init VectorStore: {e}")
            
    if not _services.llm_service:
        _services.llm_service = LLMService()
        print("LLMService initialized")
        
    return _services

@router.get("/settings")
def read_settings():
    try:
        return get_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/settings")
def update_settings(settings: AppSettings):
    try:
        save_settings(settings)
        # Reset services to force reload with new settings
        global _services
        _services.vector_store = None
        _services.llm_service = None
        print("Settings updated, services reset")
        return {"message": "Settings updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def reset_services():
    global _services
    _services.vector_store = None
    _services.llm_service = None
    print("Services reset")

class IngestURLRequest(BaseModel):
    url: str

class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []

@router.post("/ingest/url")
def ingest_url(request: IngestURLRequest, svcs: ServiceContainer = Depends(get_services)):
    try:
        loader = WebLoader()
        content = loader.load(request.url)
        doc = Document(page_content=content, metadata={"source": request.url, "type": "url"})
        if svcs.vector_store:
            svcs.vector_store.add_documents([doc])
        return {"message": "URL ingested successfully", "length": len(content)}
    except Exception as e:
        print(f"Ingest URL error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...), svcs: ServiceContainer = Depends(get_services)):
    file_ext = os.path.splitext(file.filename)[1].lower()
    temp_path = f"temp_{uuid.uuid4()}{file_ext}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        loader = FileLoader()
        content = ""
        if file_ext == ".pdf":
            content = loader.load_pdf(temp_path)
        elif file_ext in [".md", ".txt"]:
            content = loader.load_markdown(temp_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
            
        doc = Document(page_content=content, metadata={"source": file.filename, "type": "file"})
        if svcs.vector_store:
            svcs.vector_store.add_documents([doc])
            
        return {"message": "File ingested successfully", "length": len(content)}
    except Exception as e:
        print(f"Ingest file error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.post("/chat")
async def chat(request: ChatRequest, svcs: ServiceContainer = Depends(get_services)):
    try:
        # Construct message history
        messages = []
        # Add system prompt if needed
        messages.append({"role": "system", "content": "You are a helpful assistant for a personal knowledge base. Use the provided context to answer questions. ALWAYS answer in Chinese."})
        
        # Add history
        for msg in request.history:
            messages.append(msg)
            
        # Add current message with context
        context = ""
        if svcs.vector_store:
            docs = svcs.vector_store.similarity_search(request.message, k=3)
            if docs:
                context = "\n\n".join([d.page_content for d in docs])
        
        if context:
            user_msg_content = f"Context:\n{context}\n\nQuestion: {request.message}"
        else:
            user_msg_content = request.message
            
        messages.append({"role": "user", "content": user_msg_content})
        
        # Use streaming response
        return StreamingResponse(
            svcs.llm_service.stream_chat(messages),
            media_type="text/event-stream"
        )
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

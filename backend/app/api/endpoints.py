from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional
from sqlalchemy.orm import Session
import shutil
import os
import uuid
import logging

from backend.app.rag.store import VectorStore
from backend.app.ingestion.web_loader import WebLoader
from backend.app.ingestion.file_loader import FileLoader
from backend.app.chat.llm import LLMService
from langchain_core.documents import Document as LangChainDocument
from backend.app.core.config import AppSettings, get_settings, save_settings
from backend.app.core.database import get_db
from backend.app import models, schemas

router = APIRouter()
logger = logging.getLogger(__name__)

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

# Document Management
@router.get("/documents", response_model=List[schemas.Document])
def get_documents(db: Session = Depends(get_db)):
    return db.query(models.Document).all()

@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db), svcs: ServiceContainer = Depends(get_services)):
    db_doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete from DB
    db.delete(db_doc)
    db.commit()
    
    # Delete from VectorStore
    if svcs.vector_store:
        svcs.vector_store.delete_document(doc_id)
        
    return {"message": "Document deleted"}

# Ingestion
@router.post("/ingest/url")
def ingest_url(request: schemas.IngestURLRequest, db: Session = Depends(get_db), svcs: ServiceContainer = Depends(get_services)):
    try:
        loader = WebLoader()
        content = loader.load(request.url)
        
        # Save to DB
        db_doc = models.Document(name=request.url, source=request.url, type="url")
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
        
        # Save to VectorStore with metadata
        doc = LangChainDocument(
            page_content=content, 
            metadata={
                "source": request.url, 
                "type": "url",
                "doc_id": str(db_doc.id)
            }
        )
        if svcs.vector_store:
            svcs.vector_store.add_documents([doc])
            
        return {"message": "URL ingested successfully", "doc_id": db_doc.id, "length": len(content)}
    except Exception as e:
        print(f"Ingest URL error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...), db: Session = Depends(get_db), svcs: ServiceContainer = Depends(get_services)):
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
            
        # Save to DB
        db_doc = models.Document(name=file.filename, source=file.filename, type="file")
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
        
        # Save to VectorStore
        doc = LangChainDocument(
            page_content=content, 
            metadata={
                "source": file.filename, 
                "type": "file",
                "doc_id": str(db_doc.id)
            }
        )
        if svcs.vector_store:
            svcs.vector_store.add_documents([doc])
            
        return {"message": "File ingested successfully", "doc_id": db_doc.id, "length": len(content)}
    except Exception as e:
        print(f"Ingest file error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.post("/chat")
async def chat(request: schemas.ChatRequest, svcs: ServiceContainer = Depends(get_services)):
    try:
        # Construct message history
        messages = []
        messages.append({"role": "system", "content": "You are a helpful assistant for a personal knowledge base. Use the provided context to answer questions. ALWAYS answer in Chinese."})
        
        for msg in request.history:
            messages.append(msg)
            
        context = ""
        
        # RAG Logic
        rag_enabled = True
        if request.rag_config and not request.rag_config.enabled:
            rag_enabled = False
            
        if rag_enabled and svcs.vector_store:
            filter_dict = None
            if request.rag_config and request.rag_config.selected_doc_ids:
                ids = request.rag_config.selected_doc_ids
                if len(ids) == 1:
                    filter_dict = {"doc_id": ids[0]}
                else:
                    filter_dict = {"doc_id": {"$in": ids}}
                    
            docs = svcs.vector_store.similarity_search(request.message, k=3, filter=filter_dict)
            if docs:
                context = "\n\n".join([d.page_content for d in docs])
        
        if context:
            user_msg_content = f"Context:\n{context}\n\nQuestion: {request.message}"
        else:
            user_msg_content = request.message
            
        messages.append({"role": "user", "content": user_msg_content})
        
        return StreamingResponse(
            svcs.llm_service.stream_chat(messages),
            media_type="text/event-stream"
        )
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

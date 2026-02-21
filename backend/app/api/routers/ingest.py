from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
import shutil
import os
import uuid
from langchain_core.documents import Document as LangChainDocument
from langchain_text_splitters import RecursiveCharacterTextSplitter

from backend.app import models, schemas
from backend.app.core.database import get_db
from backend.app.core.config import get_settings
from backend.app.api.deps import ServiceContainer, get_services
from backend.app.ingestion.web_loader import WebLoader
from backend.app.ingestion.file_loader import FileLoader

router = APIRouter()

def get_text_splitter():
    settings = get_settings()
    return RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        length_function=len,
    )

@router.post("/url")
def ingest_url(request: schemas.IngestURLRequest, db: Session = Depends(get_db), svcs: ServiceContainer = Depends(get_services)):
    try:
        loader = WebLoader()
        content = loader.load(request.url)
        
        # Save to DB
        db_doc = models.Document(name=request.url, source=request.url, type="url")
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
        
        # Split text into chunks
        text_splitter = get_text_splitter()
        chunks = text_splitter.split_text(content)
        
        # Create documents for each chunk
        docs = []
        for i, chunk in enumerate(chunks):
            doc = LangChainDocument(
                page_content=chunk, 
                metadata={
                    "source": request.url, 
                    "type": "url",
                    "doc_id": str(db_doc.id),
                    "chunk_index": i
                }
            )
            docs.append(doc)

        # Save to VectorStore with metadata
        if svcs.vector_store:
            svcs.vector_store.add_documents(docs)
            
        return {"message": "URL ingested successfully", "doc_id": db_doc.id, "length": len(content), "chunks": len(docs)}
    except Exception as e:
        print(f"Ingest URL error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/file")
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
        
        # Split text into chunks
        text_splitter = get_text_splitter()
        chunks = text_splitter.split_text(content)
        
        # Create documents for each chunk
        docs = []
        for i, chunk in enumerate(chunks):
            doc = LangChainDocument(
                page_content=chunk, 
                metadata={
                    "source": file.filename, 
                    "type": "file",
                    "doc_id": str(db_doc.id),
                    "chunk_index": i
                }
            )
            docs.append(doc)
        
        # Save to VectorStore
        if svcs.vector_store:
            svcs.vector_store.add_documents(docs)
            
        return {"message": "File ingested successfully", "doc_id": db_doc.id, "length": len(content), "chunks": len(docs)}
    except Exception as e:
        print(f"Ingest file error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

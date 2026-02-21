from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from backend.app import models, schemas
from backend.app.core.database import get_db
from backend.app.api.deps import ServiceContainer, get_services

router = APIRouter()

@router.get("", response_model=List[schemas.Document])
def get_documents(db: Session = Depends(get_db)):
    return db.query(models.Document).all()

@router.delete("/{doc_id}")
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

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.models import GlobalMemory as GlobalMemoryModel
from backend.app.schemas import GlobalMemory, GlobalMemoryBase
from datetime import datetime, timezone

router = APIRouter()

@router.get("/", response_model=GlobalMemory)
def get_global_memory(db: Session = Depends(get_db)):
    memory = db.query(GlobalMemoryModel).first()
    if not memory:
        # Initialize if not exists
        memory = GlobalMemoryModel(content="")
        db.add(memory)
        db.commit()
        db.refresh(memory)
    return memory

@router.put("/", response_model=GlobalMemory)
def update_global_memory(memory_update: GlobalMemoryBase, db: Session = Depends(get_db)):
    memory = db.query(GlobalMemoryModel).first()
    if not memory:
        memory = GlobalMemoryModel(content=memory_update.content)
        db.add(memory)
    else:
        memory.content = memory_update.content
        memory.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(memory)
    return memory

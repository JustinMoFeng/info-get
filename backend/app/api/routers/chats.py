from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend.app.core.database import get_db
from backend.app.models import Chat as ChatModel, Message as MessageModel
from backend.app.schemas import Chat, ChatCreate, Message
from uuid import uuid4
from datetime import datetime, timezone

router = APIRouter()

@router.get("/", response_model=List[Chat])
def get_chats(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    chats = db.query(ChatModel).order_by(ChatModel.updated_at.desc()).offset(skip).limit(limit).all()
    return chats

@router.post("/", response_model=Chat)
def create_chat(chat: ChatCreate, db: Session = Depends(get_db)):
    db_chat = ChatModel(id=str(uuid4()), title=chat.title, summary=chat.summary)
    db.add(db_chat)
    db.commit()
    db.refresh(db_chat)
    return db_chat

@router.get("/{chat_id}", response_model=Chat)
def get_chat(chat_id: str, db: Session = Depends(get_db)):
    chat = db.query(ChatModel).filter(ChatModel.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat

@router.put("/{chat_id}", response_model=Chat)
def update_chat(chat_id: str, chat_update: ChatCreate, db: Session = Depends(get_db)):
    chat = db.query(ChatModel).filter(ChatModel.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    chat.title = chat_update.title
    if chat_update.summary:
        chat.summary = chat_update.summary
    chat.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(chat)
    return chat

@router.delete("/{chat_id}")
def delete_chat(chat_id: str, db: Session = Depends(get_db)):
    chat = db.query(ChatModel).filter(ChatModel.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    db.delete(chat)
    db.commit()
    return {"ok": True}

@router.get("/{chat_id}/messages", response_model=List[Message])
def get_chat_messages(chat_id: str, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    messages = db.query(MessageModel).filter(MessageModel.chat_id == chat_id).order_by(MessageModel.created_at.asc()).offset(skip).limit(limit).all()
    return messages

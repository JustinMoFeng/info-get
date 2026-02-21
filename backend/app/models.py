from sqlalchemy import Column, String, DateTime, Text, Boolean, Integer, ForeignKey
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
from backend.app.core.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, index=True)
    source = Column(String)
    type = Column(String)  # 'file' or 'url'
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Chat(Base):
    __tablename__ = "chats"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, index=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_id = Column(String, ForeignKey("chats.id"))
    role = Column(String) # 'user', 'assistant', 'system'
    content = Column(Text)
    thought_steps = Column(Text, nullable=True) # JSON string of thought steps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_summarized = Column(Boolean, default=False)
    
    chat = relationship("Chat", back_populates="messages")

class GlobalMemory(Base):
    __tablename__ = "global_memory"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

from sqlalchemy import Column, String, DateTime
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

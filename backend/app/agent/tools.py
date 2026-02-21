from typing import List, Optional
from langchain_core.tools import tool
from backend.app.api.deps import get_services
from backend.app.models import GlobalMemory
from backend.app.core.database import SessionLocal
from datetime import datetime, timezone

@tool
def search_documents(query: str, selected_doc_ids: Optional[List[str]] = None) -> str:
    """Search for relevant documents in the knowledge base."""
    svcs = get_services()
    store = svcs.get_vector_store("documents")
    if not store:
        return "Vector store not available."
    
    filter_dict = None
    if selected_doc_ids:
        if len(selected_doc_ids) == 1:
            filter_dict = {"doc_id": selected_doc_ids[0]}
        else:
            filter_dict = {"doc_id": {"$in": selected_doc_ids}}
            
    docs = store.similarity_search(query, k=4, filter=filter_dict)
    if not docs:
        return "No relevant documents found."
        
    return "\n\n".join([f"Content: {doc.page_content}\nSource: {doc.metadata.get('source', 'Unknown')}" for doc in docs])

@tool
def search_chat_history(query: str, chat_id: Optional[str] = None) -> str:
    """Search for relevant past chat conversations."""
    svcs = get_services()
    store = svcs.get_vector_store("chats")
    if not store:
        return "Chat history store not available."
    
    filter_dict = None
    if chat_id:
        filter_dict = {"chat_id": chat_id}
        
    docs = store.similarity_search(query, k=5, filter=filter_dict)
    if not docs:
        return "No relevant chat history found."
        
    return "\n\n".join([f"Role: {doc.metadata.get('role')}\nContent: {doc.page_content}\nDate: {doc.metadata.get('timestamp')}" for doc in docs])

@tool
def read_global_memory() -> str:
    """Read the user's global memory/preferences."""
    db = SessionLocal()
    try:
        memory = db.query(GlobalMemory).first()
        return memory.content if memory else "No global memory set."
    finally:
        db.close()

@tool
def update_global_memory(content: str) -> str:
    """Append new information to the global memory."""
    db = SessionLocal()
    try:
        memory = db.query(GlobalMemory).first()
        if not memory:
            memory = GlobalMemory(content=content)
            db.add(memory)
        else:
            # Append with timestamp
            timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            if memory.content:
                memory.content += f"\n[{timestamp}] {content}"
            else:
                memory.content = f"[{timestamp}] {content}"
            memory.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        return "Global memory updated successfully."
    except Exception as e:
        return f"Failed to update memory: {str(e)}"
    finally:
        db.close()

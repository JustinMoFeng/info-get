from typing import Optional
from backend.app.rag.store import VectorStore
from backend.app.chat.llm import LLMService

class ServiceContainer:
    vector_store: Optional[VectorStore] = None
    llm_service: Optional[LLMService] = None

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

def reset_services():
    global _services
    _services.vector_store = None
    _services.llm_service = None
    print("Services reset")

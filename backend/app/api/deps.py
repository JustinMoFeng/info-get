from typing import Optional, Dict
from backend.app.rag.store import VectorStore
from backend.app.chat.llm import LLMService

class ServiceContainer:
    _vector_stores: Dict[str, VectorStore] = {}
    llm_service: Optional[LLMService] = None

    def get_vector_store(self, collection_name: str = "documents") -> Optional[VectorStore]:
        if collection_name not in self._vector_stores:
            try:
                self._vector_stores[collection_name] = VectorStore(collection_name=collection_name)
                print(f"VectorStore '{collection_name}' initialized")
            except Exception as e:
                print(f"Failed to init VectorStore '{collection_name}': {e}")
                return None
        return self._vector_stores[collection_name]

    @property
    def vector_store(self) -> Optional[VectorStore]:
        return self.get_vector_store("documents")

_services = ServiceContainer()

def get_services() -> ServiceContainer:
    global _services
    # Trigger default vector store init for backward compatibility check
    if not _services.vector_store:
        pass 

    if not _services.llm_service:
        try:
            _services.llm_service = LLMService()
            print("LLMService initialized")
        except Exception as e:
            print(f"Failed to init LLMService: {e}")
        
    return _services

def reset_services():
    global _services
    _services._vector_stores = {}
    _services.llm_service = None
    print("Services reset")

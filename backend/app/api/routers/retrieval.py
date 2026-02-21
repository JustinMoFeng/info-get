from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel

from backend.app.api.deps import ServiceContainer, get_services

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    k: int = 4
    selected_doc_ids: Optional[List[str]] = None

class SearchResult(BaseModel):
    content: str
    metadata: dict
    score: Optional[float] = None

@router.post("/search", response_model=List[SearchResult])
def search_documents(request: SearchRequest, svcs: ServiceContainer = Depends(get_services)):
    try:
        if not svcs.vector_store:
            raise HTTPException(status_code=503, detail="Vector store not initialized")
            
        filter_dict = None
        if request.selected_doc_ids:
            if len(request.selected_doc_ids) == 1:
                filter_dict = {"doc_id": request.selected_doc_ids[0]}
            else:
                filter_dict = {"doc_id": {"$in": request.selected_doc_ids}}
                
        # Use similarity_search_with_score if available, otherwise just search
        # Note: Chroma wrapper in LangChain usually has similarity_search_with_score
        
        # We'll use the standard similarity_search for now as implemented in our store wrapper
        # If we want scores, we need to update the wrapper.
        # Let's check store.py first.
        
        docs = svcs.vector_store.similarity_search(request.query, k=request.k, filter=filter_dict)
        
        results = []
        for doc in docs:
            results.append(SearchResult(
                content=doc.page_content,
                metadata=doc.metadata
            ))
            
        return results
    except Exception as e:
        print(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

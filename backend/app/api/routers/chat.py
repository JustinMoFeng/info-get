from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from backend.app import schemas
from backend.app.api.deps import ServiceContainer, get_services

router = APIRouter()

@router.post("")
async def chat(request: schemas.ChatRequest, svcs: ServiceContainer = Depends(get_services)):
    try:
        # Construct message history
        messages = []
        messages.append({"role": "system", "content": "You are a helpful assistant for a personal knowledge base. Use the provided context to answer questions. ALWAYS answer in Chinese."})
        
        for msg in request.history:
            messages.append(msg)
            
        context = ""
        
        # RAG Logic
        rag_enabled = True
        if request.rag_config and not request.rag_config.enabled:
            rag_enabled = False
            
        if rag_enabled and svcs.vector_store:
            filter_dict = None
            if request.rag_config and request.rag_config.selected_doc_ids:
                ids = request.rag_config.selected_doc_ids
                if len(ids) == 1:
                    filter_dict = {"doc_id": ids[0]}
                else:
                    filter_dict = {"doc_id": {"$in": ids}}
                    
            docs = svcs.vector_store.similarity_search(request.message, k=3, filter=filter_dict)
            if docs:
                context = "\n\n".join([d.page_content for d in docs])
        
        if context:
            user_msg_content = f"Context:\n{context}\n\nQuestion: {request.message}"
        else:
            user_msg_content = request.message
            
        messages.append({"role": "user", "content": user_msg_content})
        
        return StreamingResponse(
            svcs.llm_service.stream_chat(messages),
            media_type="text/event-stream"
        )
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

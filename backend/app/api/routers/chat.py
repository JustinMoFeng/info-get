from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, AsyncGenerator
import json
import asyncio

from backend.app.core.database import get_db
from backend.app.models import Chat as ChatModel, Message as MessageModel, GlobalMemory
from backend.app.schemas import ChatRequest, MessageCreate
from backend.app.agent.tools import search_documents, search_chat_history, read_global_memory, update_global_memory
from backend.app.core.config import get_settings

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage, BaseMessage
from langchain_core.tools import tool

router = APIRouter()

@router.post("/")
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    settings = get_settings()
    
    # 1. Handle Chat Session
    chat_id = request.chat_id
    if not chat_id:
        # Create new chat
        new_chat = ChatModel(title=request.message[:30])
        db.add(new_chat)
        db.commit()
        db.refresh(new_chat)
        chat_id = new_chat.id
    else:
        chat = db.query(ChatModel).filter(ChatModel.id == chat_id).first()
        if not chat:
            raise HTTPException(404, "Chat not found")
            
    # 2. Build Context
    # Global Memory
    memory = db.query(GlobalMemory).first()
    memory_content = memory.content if memory else ""
    
    # Chat Summary
    chat_obj = db.query(ChatModel).filter(ChatModel.id == chat_id).first()
    chat_summary = chat_obj.summary if chat_obj else ""
    
    # Recent Messages (Last 5 rounds = 10 messages)
    recent_messages_db = db.query(MessageModel).filter(
        MessageModel.chat_id == chat_id
    ).order_by(MessageModel.created_at.desc()).limit(10).all()
    recent_messages_db.reverse()
    
    # 3. Construct LangChain Messages
    lc_messages: List[BaseMessage] = []
    
    system_prompt = f"""You are an intelligent assistant for a personal knowledge base.
    
    Global Memory (User Preferences & Facts):
    {memory_content}
    
    Previous Conversation Summary:
    {chat_summary or 'No summary yet.'}
    
    Instructions:
    - Use the available tools to answer the user's question.
    - You can search documents, search chat history, or read/update global memory.
    - Always verify information with tools if you are unsure.
    - If you update global memory, do it only for important user preferences or facts.
    """
    
    lc_messages.append(SystemMessage(content=system_prompt))
    
    for m in recent_messages_db:
        if m.role == 'user':
            lc_messages.append(HumanMessage(content=m.content))
        elif m.role == 'assistant':
            lc_messages.append(AIMessage(content=m.content))
            
    lc_messages.append(HumanMessage(content=request.message))
    
    # 4. Prepare Tools
    # If selected_doc_ids provided, wrap the search tool
    tools = [search_chat_history, read_global_memory, update_global_memory]
    
    if request.rag_config and request.rag_config.selected_doc_ids:
        @tool
        def scoped_search(query: str) -> str:
            """Search within specific selected documents."""
            return search_documents.invoke({"query": query, "selected_doc_ids": request.rag_config.selected_doc_ids})
        
        # Override name and description manually if needed, but @tool decorator handles it
        scoped_search.name = "search_documents"
        scoped_search.description = "Search within specific selected documents."
        
        tools.append(scoped_search)
    else:
        tools.append(search_documents)

    # 5. Initialize LLM
    llm = ChatOpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        model=settings.openai_model or "gpt-4o", # Use a smart model for agent
        temperature=0,
        streaming=True
    )
    
    llm_with_tools = llm.bind_tools(tools)
    
    # 6. Generator for SSE
    async def event_generator():
        try:
            # Yield chat_id first so frontend knows where we are
            yield f"data: {json.dumps({'type': 'meta', 'chat_id': chat_id})}\n\n"
            
            current_messages = list(lc_messages)
            thought_steps_log = []
            
            # Agent Loop (Simple ReAct)
            # We'll do max 5 turns to prevent infinite loops
            for _ in range(5):
                # Call LLM
                response_message = await llm_with_tools.ainvoke(current_messages)
                current_messages.append(response_message)
                
                # Check for tool calls
                if response_message.tool_calls:
                    # Yield thought if any content exists before tool call
                    if response_message.content:
                        yield f"data: {json.dumps({'type': 'thought', 'content': response_message.content})}\n\n"
                        thought_steps_log.append({"type": "thought", "content": response_message.content})

                    # Yield tool calls
                    for tool_call in response_message.tool_calls:
                        yield f"data: {json.dumps({'type': 'tool_call', 'name': tool_call['name'], 'args': tool_call['args']})}\n\n"
                        thought_steps_log.append({"type": "tool_call", "name": tool_call['name'], "args": tool_call['args']})
                        
                        # Execute tool
                        tool_name = tool_call['name']
                        tool_args = tool_call['args']
                        
                        selected_tool = next((t for t in tools if t.name == tool_name), None)
                        if selected_tool:
                            try:
                                # Invoke tool
                                tool_result = selected_tool.invoke(tool_args)
                            except Exception as e:
                                tool_result = f"Error executing tool: {str(e)}"
                        else:
                            tool_result = "Tool not found."
                            
                        yield f"data: {json.dumps({'type': 'tool_output', 'content': str(tool_result)})}\n\n"
                        thought_steps_log.append({"type": "tool_output", "content": str(tool_result)})
                        
                        # Append tool result to messages
                        current_messages.append(ToolMessage(
                            tool_call_id=tool_call['id'],
                            content=str(tool_result),
                            name=tool_name
                        ))
                else:
                    # Final answer (Streaming)
                    # We need to stream the content of this final message if possible, 
                    # but ainvoke returns the full message. 
                    # To stream the final answer, we should have used astream on the LAST call.
                    # But we don't know which is the last call until we see no tool calls.
                    
                    # So, for the final response, we just yield it chunk by chunk? 
                    # Or simply yield the content.
                    # To get true streaming of the *final* answer, we'd need to use `.astream` 
                    # and handle chunks, buffering tool calls.
                    # For simplicity in this iteration, we yield the full content as "answer".
                    # Or better: We can re-stream the last generation if we want (inefficient).
                    
                    # Let's try to stream the content of response_message
                    yield f"data: {json.dumps({'type': 'answer', 'content': response_message.content})}\n\n"
                    break
            
            # Save to DB
            # User message
            user_msg = MessageModel(chat_id=chat_id, role="user", content=request.message)
            db.add(user_msg)
            
            # Assistant message (last one)
            last_msg = current_messages[-1]
            if isinstance(last_msg, AIMessage):
                ai_content = last_msg.content
                ai_msg = MessageModel(
                    chat_id=chat_id, 
                    role="assistant", 
                    content=ai_content,
                    thought_steps=json.dumps(thought_steps_log) if thought_steps_log else None
                )
                db.add(ai_msg)
                
                # Update Chat Title if it's new (first 2 messages)
                # Simple heuristic or use LLM later
                
                db.commit()
                
                # TODO: Trigger Background Task for Summarization
                
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            print(f"Error in chat generator: {e}")
            yield f"data: {json.dumps({'type': 'answer', 'content': f'Error: {str(e)}'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

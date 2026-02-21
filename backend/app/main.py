from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.database import engine, Base
from backend.app.api.routers import chat, documents, ingest, settings, retrieval, chats, memory
import backend.app.models  # Ensure models are registered

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Info-Get API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingest"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(retrieval.router, prefix="/api", tags=["retrieval"]) # Mounts /api/search
app.include_router(chats.router, prefix="/api/chats", tags=["chats"])
app.include_router(memory.router, prefix="/api/memory", tags=["memory"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Info-Get API"}

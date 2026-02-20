# Info-Get Design V1 (MVP)

## Architecture Overview
This document outlines the architecture for the "Info-Get" Personal Knowledge Base (RAG).

### 1. Backend (FastAPI)
- **Framework**: FastAPI (Python)
- **Core Modules**:
  - `src/api`: Routes for file upload, chat, and status.
  - `src/core`: Configuration and utilities.
  - `src/ingestion`: Logic for parsing Web, PDF, MD.
  - `src/rag`: Vector store (ChromaDB) and retrieval logic.
  - `src/llm`: Interface for LLM (OpenAI / Ollama).
- **Database**: 
  - Vector Store: ChromaDB (Local persistance).
  - Metadata: SQLite (via SQLAlchemy) for tracking uploaded files and history.

### 2. Frontend (React)
- **Framework**: React + Vite (Single Page Application).
- **Components**:
  - `ChatInterface`: Main chat window.
  - `UploadPanel`: Drag-and-drop for files and URL input.
  - `KnowledgeList`: List of indexed documents.

## Data Flow
1. **Ingestion**:
   - User uploads File/URL -> Backend API (`/ingest`).
   - Backend parses content (text extraction).
   - Text is chunked and embedded.
   - Embeddings stored in ChromaDB.
2. **Chat**:
   - User sends message -> Backend API (`/chat`).
   - Backend retrieves relevant chunks from ChromaDB.
   - Context + History + Query sent to LLM.
   - LLM generates response -> Frontend.

## API Endpoints (Planned)
- `POST /api/ingest/url`: Ingest a web page.
- `POST /api/ingest/file`: Ingest a file (PDF, MD).
- `POST /api/chat`: Send message and get RAG response.
- `GET /api/documents`: List indexed documents.
- `DELETE /api/documents/{id}`: Remove a document.

## Dependencies (Backend)
- `fastapi`, `uvicorn`
- `langchain`, `langchain-community`, `chromadb`
- `pypdf`, `beautifulsoup4`
- `python-multipart` (for file upload)

## Directory Structure
```
info-get/
├── backend/            # Python Backend
│   ├── main.py
│   ├── api/
│   ├── core/
│   ├── ingestion/
│   └── rag/
├── frontend/           # React Frontend (Later)
├── docs/
└── tests/
```

## Implementation Plan (Phase 1)
1. Setup Backend skeleton (FastAPI).
2. Implement Ingestion (URL, PDF, MD).
3. Implement Vector Store (ChromaDB).
4. Implement Basic Chat (Echo -> RAG).
5. Frontend Integration.

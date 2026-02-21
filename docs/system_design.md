# Info-Get System Design (Comprehensive)

## 1. Overview
**Info-Get** is a Personal Knowledge Base application leveraging RAG (Retrieval-Augmented Generation). It allows users to ingest local files and web URLs, manage their knowledge base, and interact with it via an AI-powered chat interface.

This document consolidates all design aspects (v1 MVP + v2 Knowledge Management) and reflects the current system state.

## 2. Architecture

### 2.1 Technology Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite + TailwindCSS
- **Database**: 
  - **Metadata**: SQLite (via SQLAlchemy) - Stores document records and status.
  - **Vector Store**: ChromaDB (Local persistence) - Stores text embeddings.
- **AI/LLM**: OpenAI / Compatible API (e.g., DeepSeek, Ollama).
- **Orchestration**: LangChain.

### 2.2 System Modules
1.  **Ingestion Module**:
    -   Handles file uploads (PDF, MD, TXT) and URL crawling.
    -   Extracts text, chunks it, and generates embeddings.
    -   Stores metadata in SQLite and embeddings in ChromaDB.
2.  **Knowledge Management Module** (v2 Feature):
    -   **Persistence**: Tracks all uploaded documents.
    -   **CRUD Operations**: List, Add (Multi-file support), Delete, Search documents.
    -   **Sync**: Deleting a document removes it from both SQLite and ChromaDB.
3.  **Chat Module (RAG Engine)**:
    -   **Hybrid Search**: Supports "Pure LLM" (no context) and "RAG" (context-aware) modes.
    -   **Context Control**: Allows users to select specific documents for context per message.
    -   **Streaming**: Real-time token streaming via Server-Sent Events (SSE).

## 3. Data Flow

### 3.1 Ingestion Flow
1.  **User Action**: Uploads file or submits URL via Frontend.
2.  **API Layer**: `POST /api/ingest/{type}` receives request.
3.  **Loader**: `FileLoader` or `WebLoader` extracts text.
4.  **Database**: A new record is created in `documents` table (id, name, type, source).
5.  **Chunking & Embedding**: Text is split into chunks (recursive character split). Each chunk is embedded and stored in ChromaDB with `doc_id` metadata.
6.  **Response**: Success message returned to UI.

### 3.2 Chat Flow
1.  **User Action**: Sends message with RAG settings (Enabled/Disabled, Selected Docs).
2.  **API Layer**: `POST /api/chat` receives `ChatRequest`.
3.  **Retrieval Strategy**:
    -   If `rag_enabled=False`: Skip retrieval.
    -   If `rag_enabled=True`:
        -   Query VectorStore.
        -   Apply filter: `where={"doc_id": {"$in": selected_doc_ids}}` (if selection exists).
4.  **LLM Execution**: Context + History + Query sent to LLM (AsyncStream).
5.  **Response**: Streamed back to Frontend via SSE.

## 4. Database Schema (SQLite)

### Table: `documents`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier |
| `name` | String | Display name (filename/title) |
| `source` | String | Original path or URL |
| `type` | String | 'file' or 'url' |
| `created_at` | DateTime | Upload timestamp |

## 5. API Design (Backend Endpoints)

Endpoints are organized by resource in `backend/app/api/routers/`.

### Chat (`/api/chat`)
- `POST /api/chat`: Send message and get streaming response.
    -   **Body**: 
        ```json
        {
          "message": "User query",
          "history": [{"role": "user", "content": "..."}],
          "rag_config": {
            "enabled": true,
            "selected_doc_ids": ["uuid-1", "uuid-2"]
          }
        }
        ```
    -   **Response**: `text/event-stream`

### Ingestion (`/api/ingest`)
- `POST /api/ingest/file`: Upload and ingest a file (Multipart form data).
    -   **Process**: File -> Text -> Chunks -> Embeddings -> Vector Store.
- `POST /api/ingest/url`: Ingest content from a URL.
    -   **Body**: `{"url": "https://..."}`
    -   **Process**: URL -> Text -> Chunks -> Embeddings -> Vector Store.

### Documents (`/api/documents`)
- `GET /api/documents`: List all indexed documents (metadata from SQLite).
- `DELETE /api/documents/{id}`: Delete a document (from SQLite) and its chunks (from ChromaDB).

### Settings (`/api/settings`)
- `GET /api/settings`: Retrieve current system settings.
- `POST /api/settings`: Update system settings (LLM keys, models, RAG chunking).
    -   **Configurable Parameters**:
        -   `chunk_size` (int): Max characters per chunk (default 1000).
        -   `chunk_overlap` (int): Overlap characters between chunks (default 200).

## 6. Frontend Design (UI/UX)
-   **Main Layout**: Sidebar (Chat History + Knowledge Manager) + Main Chat Area.
-   **Settings Modal**: Global configuration for LLM and RAG parameters (`chunk_size`, `chunk_overlap`).
-   **Knowledge Manager Modal**: Upload files/URLs, view status, delete documents.
-   **Chat Interface**: Real-time streaming response, markdown rendering.

The frontend is a Single Page Application (SPA) where different functional areas are implemented as Panels or Modals.

### Pages (Panels)
1.  **Main Chat Interface** (Core View)
    -   **Function**: Primary interaction area.
    -   **Components**: Message List (Markdown rendered), Input Box, RAG Toggle.
2.  **Sidebar Panel** (Navigation/Context)
    -   **Function**: Persistent side panel for navigation and context awareness.
    -   **Components**: "Manage Documents" button, Active Context list.
3.  **Knowledge Manager Modal** (Management Page)
    -   **Function**: Full overlay for document operations.
    -   **Components**: File Upload (Multi-file), URL Input, Document List (with Delete), Search Bar, Progress Indicators.
4.  **Settings Modal** (Configuration Page)
    -   **Function**: System configuration overlay.
    -   **Components**: API Key input, Model selection, Base URL config.

## 7. Directory Structure
```
info-get/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routers/          # New: Modular API routers
│   │   │   │   ├── chat.py
│   │   │   │   ├── documents.py
│   │   │   │   ├── ingest.py
│   │   │   │   └── settings.py
│   │   │   └── deps.py           # Dependency injection
│   │   ├── chat/
│   │   │   └── llm.py            # LLM service logic
│   │   ├── core/
│   │   │   ├── config.py         # Settings management
│   │   │   └── database.py       # SQLite connection
│   │   ├── ingestion/
│   │   │   ├── file_loader.py    # PDF/MD parsing
│   │   │   └── web_loader.py     # URL parsing
│   │   ├── models.py             # SQLAlchemy models
│   │   ├── rag/
│   │   │   └── store.py          # ChromaDB wrapper
│   │   ├── schemas.py            # Pydantic models
│   │   └── main.py               # App entry point
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Main UI logic (All panels)
│   │   ├── components/           # (Suggested refactor)
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── KnowledgeManager.tsx
│   │   │   └── SettingsModal.tsx
├── docs/
│   └── system_design.md          # This file
```

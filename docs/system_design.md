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
5.  **Vector Store**: Text is embedded and stored in ChromaDB with `doc_id` metadata.
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

### Chat & LLM
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

### Ingestion
- `POST /api/ingest/file`: Upload and ingest a file (Multipart form data).
- `POST /api/ingest/url`: Ingest content from a URL.
    -   **Body**: `{"url": "https://..."}`

### Knowledge Management (New)
- `GET /api/documents`: List all indexed documents.
- `DELETE /api/documents/{id}`: Delete a document and its embeddings.

### Settings
- `GET /api/settings`: Retrieve current system settings.
- `POST /api/settings`: Update system settings (LLM keys, models).

## 6. Frontend Design (UI/UX)

### Pages
- **Single Page Application (SPA)**: `App.tsx` handles the entire view.

### Components
1.  **Sidebar / Settings Panel**:
    -   **Settings Modal**: Configuration for OpenAI API Key, Model, Base URL.
    -   **Knowledge Manager Modal** (New):
        -   **Centralized Management**: Dedicated modal for all document operations.
        -   **Multi-File Upload**: Concurrent non-blocking uploads with progress queue.
        -   **Search**: Filter documents by name.
        -   **Ingestion**: Supports File (PDF/MD/TXT) and URL sources.
    -   **Sidebar**:
        -   **Access Point**: Button to open Knowledge Manager.
        -   **Context Summary**: Displays active/selected documents for the current chat session.
2.  **Chat Interface**:
    -   **Message List**: Displays conversation history with Markdown support.
    -   **Input Area**:
        -   **Text Input**: Multiline text area.
        -   **RAG Controls** (New):
            -   **Toggle Switch**: Enable/Disable Knowledge Search.
            -   **Context Selector**: Dropdown to select specific documents.
        -   **Send Button**: Triggers the chat request.

## 7. Directory Structure
```
info-get/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints.py      # All API routes defined here
│   │   ├── chat/
│   │   │   └── llm.py            # LLM service logic
│   │   ├── core/
│   │   │   ├── config.py         # Settings management
│   │   │   └── database.py       # SQLite connection (New)
│   │   ├── ingestion/
│   │   │   ├── file_loader.py    # PDF/MD parsing
│   │   │   └── web_loader.py     # URL parsing
│   │   ├── models.py             # SQLAlchemy models (New)
│   │   ├── rag/
│   │   │   └── store.py          # ChromaDB wrapper
│   │   ├── schemas.py            # Pydantic models (New)
│   │   └── main.py               # App entry point
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Main UI logic
│   │   ├── components/           # (Suggested refactor for v2)
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── KnowledgeManager.tsx
│   │   │   └── SettingsModal.tsx
├── docs/
│   └── system_design.md          # This file
```

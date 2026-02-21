# Info-Get System Design (Comprehensive)

## 1. Overview
**Info-Get** is a Personal Knowledge Base application leveraging Agentic RAG (Retrieval-Augmented Generation). It allows users to ingest local files and web URLs, manage their knowledge base, and interact with it via an AI-powered chat interface that remembers past conversations and user preferences.

This document consolidates all design aspects (v1 MVP + v2 Knowledge Management + v3 Memory & Agent) and reflects the current system state.

## 2. Architecture

### 2.1 Technology Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite + TailwindCSS
- **Database**: 
  - **Relational**: SQLite (via SQLAlchemy) - Stores documents, chat history, messages, and global memory.
  - **Vector Store**: ChromaDB (Local persistence) - Stores embeddings for documents, chat history, and memories.
- **AI/LLM**: OpenAI / Compatible API (e.g., DeepSeek, Ollama).
- **Orchestration**: LangChain / Custom Agent Loop.

### 2.2 System Modules
1.  **Ingestion Module**:
    -   Handles file uploads (PDF, MD, TXT) and URL crawling.
    -   Extracts text, chunks it, and generates embeddings.
    -   Stores metadata in SQLite and embeddings in ChromaDB.
2.  **Knowledge Management Module**:
    -   **Persistence**: Tracks all uploaded documents.
    -   **CRUD Operations**: List, Add (Multi-file support), Delete, Search documents.
3.  **Memory & Context Module** (v3 Feature):
    -   **Chat Persistence**: Stores full chat history and metadata.
    -   **Global Memory**: Stores user preferences and facts.
    -   **Context Manager**: Manages sliding window context (recent 5 turns) + summaries + global memory.
4.  **Agentic Chat Module**:
    -   **Agent Loop**: AI autonomously selects tools (Search Docs, Search History, Read/Update Memory).
    -   **Thinking Process**: Exposes AI's thought chain and tool usage to the frontend.

## 3. Data Flow

### 3.1 Ingestion Flow
1.  **User Action**: Uploads file or submits URL via Frontend.
2.  **API Layer**: `POST /api/ingest/{type}` receives request.
3.  **Loader**: `FileLoader` or `WebLoader` extracts text.
4.  **Database**: Record created in `documents` table.
5.  **Chunking & Embedding**: Text split -> Embedded -> Stored in ChromaDB (`documents` collection).

### 3.2 Agentic Chat Flow
1.  **User Action**: Sends message in a specific `chat_id`.
2.  **API Layer**: `POST /api/chat` receives `ChatRequest` (current message + chat_id).
3.  **Context Construction**:
    -   Load `GlobalMemory`.
    -   Load `Chat.summary` (for older context).
    -   Load recent 5 rounds of `Messages`.
4.  **Agent Execution**:
    -   LLM receives context + user query.
    -   LLM decides to call tools:
        -   `search_documents`: Search knowledge base.
        -   `search_chat_history`: Search past conversations.
        -   `read_global_memory` / `update_global_memory`.
    -   Tools execute and return results to LLM.
5.  **Response Generation**: LLM generates final answer based on tool outputs.
6.  **Streaming**: "Thoughts", "Tool Calls", and "Final Answer" are streamed to Frontend via SSE.
7.  **Post-Processing**:
    -   Save new message to `messages` table.
    -   Async task: Update `Chat.summary` if needed.
    -   Async task: Embed message and store in ChromaDB (`chats` collection).

## 4. Database Schema (SQLite)

### Table: `documents`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier |
| `name` | String | Display name (filename/title) |
| `source` | String | Original path or URL |
| `type` | String | 'file' or 'url' |
| `created_at` | DateTime | Upload timestamp |

### Table: `chats` (New)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier |
| `title` | String | Chat title (auto-generated) |
| `summary` | Text | Summary of older messages |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Last activity timestamp |

### Table: `messages` (New)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier |
| `chat_id` | UUID (FK) | References `chats.id` |
| `role` | String | 'user', 'assistant', 'system' |
| `content` | Text | Message content |
| `created_at` | DateTime | Timestamp |
| `is_summarized`| Boolean | If included in chat summary |

### Table: `global_memory` (New)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer (PK)| Single row ID |
| `content` | Text | Global memory content |
| `updated_at` | DateTime | Last update timestamp |

## 5. API Design

### Chat Management (`/api/chats`)
- `GET /api/chats`: List chat sessions.
- `POST /api/chats`: Create new chat.
- `GET /api/chats/{id}/messages`: Get history for a chat.
- `DELETE /api/chats/{id}`: Delete chat.

### Agent Interaction (`/api/chat`)
- `POST /api/chat`: Send message.
    -   **Body**: `{"message": "...", "chat_id": "..."}`
    -   **Response**: SSE Stream (Events: `thought`, `tool`, `answer`).

### Knowledge & Settings
- Existing endpoints (`/api/ingest`, `/api/documents`, `/api/settings`) remain.

## 6. Frontend Design (UI/UX)

### 6.1 Layout & Navigation
-   **Sidebar**:
    -   **History List**: Scrollable list of past chats with search.
    -   **Action Buttons**: "New Chat", "Import Files" (navigates to page), "Settings" (modal).
-   **Pages**:
    -   **Chat Interface**: Main conversation view.
    -   **File Management**: Dedicated page for managing knowledge base.

### 6.2 Chat Interface Features
-   **Thinking Process**: Collapsible section showing AI's thought chain and tool usage.
-   **Context Selector**: Dropdown/Modal to select specific files for current context.
-   **Instant Import**: Button near input to upload file immediately to knowledge base.

## 7. Directory Structure
```
info-get/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routers/
│   │   │   │   ├── chat.py           # Updated: Agent logic
│   │   │   │   ├── chats.py          # New: Chat history CRUD
│   │   │   │   ├── documents.py
│   │   │   │   ├── ingest.py
│   │   │   │   └── settings.py
│   │   ├── agent/                    # New: Agent & Tools
│   │   │   ├── agent.py
│   │   │   └── tools.py
│   │   ├── models.py                 # Updated: New tables
│   │   ├── schemas.py                # Updated: New Pydantic models
│   │   └── ...
├── frontend/
│   ├── src/
│   │   ├── pages/                    # New: Route pages
│   │   │   ├── ChatPage.tsx
│   │   │   └── FilesPage.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Chat/                 # Chat specific components
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── ThoughtChain.tsx
│   │   │   │   └── InputArea.tsx
│   │   └── ...
├── docs/
│   ├── system_design.md
│   └── design_v3.md                  # Archived design proposal
```

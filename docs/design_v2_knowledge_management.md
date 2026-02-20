# Knowledge Management & RAG Control Design (v2 - Updated)

## 1. Overview
The user wants to manage uploaded files and URLs (Knowledge Base) and have granular control over their usage during chat. This includes a persistence layer to track uploads, a management interface, and chat-time controls to toggle RAG and select specific context.

## 2. Architecture Changes

### 2.1 Backend (FastAPI + SQLite)
We will introduce a lightweight SQLite database (using `SQLAlchemy` + `Pydantic`).

#### Database Schema (`documents` table)
- `id` (UUID, PK): Unique identifier for the document.
- `name` (String): Display name (filename or URL title).
- `source` (String): Original source path or URL.
- `type` (String): 'file' or 'url'.
- `created_at` (DateTime): Upload timestamp.

#### API Endpoints
- `GET /api/documents`: List all documents.
- `DELETE /api/documents/{id}`: Delete document from DB and Vector Store.
- *Updated* `POST /api/ingest/file`: Save metadata to DB -> Ingest to Chroma with `doc_id` in metadata.
- *Updated* `POST /api/ingest/url`: Save metadata to DB -> Ingest to Chroma with `doc_id` in metadata.
- *Updated* `POST /api/chat`:
    - Accepts new parameters: `rag_enabled` (bool) and `selected_doc_ids` (list[str]).
    - If `rag_enabled` is False: Skip retrieval.
    - If `rag_enabled` is True:
        - If `selected_doc_ids` is provided: Filter retrieval by these IDs.
        - If `selected_doc_ids` is empty/null: Search across ALL documents.

### 2.2 Frontend (React)

#### Knowledge Base Manager (Modal/Panel)
- List of uploaded files/URLs with metadata.
- **Delete** button for each item to permanently remove it.

#### Chat Interface (Context Control)
- **RAG Toggle**: A switch/button near the input box (e.g., "🔍 Search Knowledge").
    - **OFF**: AI answers based on internal knowledge only.
    - **ON**: AI retrieves context from the Knowledge Base.
- **Context Selection**:
    - When RAG is **ON**, a "Select Context" dropdown/pill appears.
    - Default: "All Documents".
    - Action: Clicking it opens a multi-select list of available documents.
    - User can check/uncheck specific files to narrow down the search scope for the next question.

## 3. Implementation Steps

### Step 1: Backend - Database & Models
- Create `backend/app/core/database.py` for SQLite connection.
- Create `backend/app/models.py` for SQLAlchemy models.
- Create `backend/app/schemas.py` for Pydantic models.

### Step 2: Backend - Update Store & Ingestion
- Update `VectorStore` to accept `doc_id` and store it in metadata.
- Update `VectorStore.similarity_search` to accept a `filter` argument.
- Update `ingest_file` and `ingest_url` to:
    1. Create DB entry.
    2. Add documents to Chroma with `doc_id`.

### Step 3: Backend - Management API
- Implement `GET /api/documents`
- Implement `DELETE /api/documents/{id}` (Delete from DB + Chroma).

### Step 4: Backend - Chat Logic Update
- Update `ChatRequest` model.
- Implement conditional search logic:
    ```python
    if request.rag_enabled:
        filter_criteria = {}
        if request.selected_doc_ids:
            filter_criteria = {"doc_id": {"$in": request.selected_doc_ids}}
        docs = vector_store.similarity_search(query, filter=filter_criteria)
    else:
        docs = []
    ```

### Step 5: Frontend - UI Implementation
- Create `KnowledgeManager` component (List & Delete).
- Update `ChatInput` component:
    - Add RAG Toggle switch.
    - Add Context Selector (Multi-select dropdown).
- Integrate with updated `/api/chat` endpoint.

## 4. Verification Plan
- **Upload**: Upload a file -> Appears in Knowledge Manager list.
- **RAG Off**: Toggle RAG off -> Ask question about file -> AI does not know.
- **RAG On (All)**: Toggle RAG on -> Ask question -> AI answers with context.
- **RAG On (Specific)**: Select Doc A, ask about Doc B -> AI should not find Doc B context.
- **Delete**: Delete file -> Disappears from list -> Search yields no results.

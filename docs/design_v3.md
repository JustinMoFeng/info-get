# Design V3: 聊天记忆与增强上下文管理

## 1. 核心目标
1.  **聊天记录持久化与管理**：保存历史聊天，支持切换、总结。
2.  **全局记忆 (Global Memory)**：记录用户偏好与全局信息，支持 AI 读写与自动总结。
3.  **上下文优化**：智能管理 Context 长度（保留最近 5 轮 + 全局记忆 + 历史总结）。
4.  **工具化架构**：从单纯的 RAG 转变为 Agent 模式，AI 主动选择调用检索工具（文件/记忆）。
5.  **透明化思考**：前端展示 AI 的思考过程（Thought + Tool Calls）与最终回复。

---

## 2. 数据库设计 (Database Schema)

我们需要在 SQLite 中新增表来存储聊天记录和全局记忆。

### 2.1 Chat (会话)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String (UUID) | 会话唯一标识 |
| `title` | String | 会话标题 (由 AI 自动生成或用户修改) |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 最后更新时间 |
| `summary` | Text | 对早期对话的总结 (用于压缩 Context) |

### 2.2 Message (消息)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String (UUID) | 消息唯一标识 |
| `chat_id` | String (FK) | 关联的会话 ID |
| `role` | String | `user`, `assistant`, `system` |
| `content` | Text | 消息内容 |
| `created_at` | DateTime | 创建时间 |
| **`is_summarized`** | Boolean | 标记该消息是否已被包含在 Chat.summary 中 |

### 2.3 GlobalMemory (全局记忆)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer | 主键 (通常只有 1 行，或多行用于不同类别) |
| `content` | Text | 记忆内容 |
| `last_updated` | DateTime | 最后更新时间 |

---

## 3. 向量存储设计 (Vector Store - ChromaDB)

为了支持对“过去聊天”和“全局记忆”的检索，我们需要扩展向量存储。

*   **Collection `chats`**: 存储历史聊天记录的 Embeddings。
    *   Metadata: `chat_id`, `role`, `timestamp`.
*   **Collection `memories`**: 存储全局记忆的 Embeddings (如果 GlobalMemory 拆分为多条事实)。
    *   Metadata: `type`, `timestamp`.
*   **Collection `documents`** (现有): 保持不变，存储上传的文件。

---

## 4. 后端架构变更 (Backend)

### 4.1 新增 API 路由 (`/api/chats`)
*   `POST /chats`: 创建新会话。
*   `GET /chats`: 获取会话列表 (支持分页)。
*   `GET /chats/{chat_id}`: 获取特定会话详情。
*   `GET /chats/{chat_id}/messages`: 获取会话消息历史。
*   `DELETE /chats/{chat_id}`: 删除会话。
*   `PUT /chats/{chat_id}`: 更新标题等。

### 4.2 Agent 模式与工具定义 (LangChain / Custom Agent)
我们将改造 `POST /chat` 接口，使其支持 Agent Loop。

**可用工具 (Tools):**
1.  **`search_documents(query, strategy='hybrid')`**:
    *   检索上传的文档 (PDF/MD/URL)。
    *   支持关键词 (BM25) 和 向量 (Vector) 混合检索。
2.  **`search_chat_history(query, chat_id=None)`**:
    *   检索过去的聊天记录。
    *   如果不指定 `chat_id`，则搜索所有历史会话。
3.  **`read_global_memory()`**:
    *   读取当前的全局记忆。
4.  **`update_global_memory(content)`**:
    *   更新全局记忆 (追加或重写)。
    *   触发后台任务：检查字数，如果超出限制则触发 `summarize_memory`。

### 4.3 上下文管理策略 (Context Management)
在构建发送给 LLM 的 Prompt 时，执行以下逻辑：

1.  **加载 Global Memory**: 始终包含在 System Prompt 中。
2.  **加载近期对话**: 获取当前 Chat 的最近 5 轮 (10条) 消息。
3.  **处理历史对话**:
    *   检查第 6 轮及以前的消息。
    *   如果这些消息尚未标记为 `is_summarized`，则调用 LLM 生成/更新 `Chat.summary`。
    *   将 `Chat.summary` 放入 System Prompt 或 Context 开头。
4.  **最终 Context 结构**:
    ```text
    [System Prompt]
    You are an intelligent assistant...
    
    [Global Memory]
    User Preferences: ...
    Important Facts: ...

    [Conversation Summary]
    Previous discussion summary: ...

    [Recent Messages]
    User: ...
    Assistant: ...
    ...
    ```

---

## 5. 前端架构变更 (Frontend)

### 5.1 界面布局 (Layout & Navigation)
*   **左侧侧边栏 (Sidebar)**:
    *   **历史会话列表 (History)**: 显示最近的聊天记录，支持搜索过滤。
    *   **功能入口**:
        *   **新建聊天 (New Chat)**
        *   **文件导入 (Import Files)**: 点击跳转到独立的文件管理页面。
        *   **设置 (Settings)**: 打开设置模态框 (RAG 配置等)。
*   **独立页面 (Pages)**:
    *   **文件管理页 (File Management)**: 专门用于上传、查看、删除知识库文件 (PDF/MD/URL)。
    *   **聊天页 (Chat Interface)**: 核心交互区域。

### 5.2 聊天界面增强 (Chat Interface)
*   **上下文选择 (Context Selector)**:
    *   在输入框上方或工具栏提供“选择文件”功能。
    *   允许用户指定当前对话需要引用的特定文档 (Filter RAG scope)。
*   **即时导入 (Instant Import)**:
    *   在聊天输入框附近提供“上传/添加链接”按钮。
    *   允许在对话过程中直接上传文件并即时摄入 (Ingest) 到知识库。
*   **思考过程展示 (Thinking Process)**:
    *   支持折叠/展开 AI 的思考步骤 (Thought Chain & Tool Calls)。

### 5.3 状态管理
*   不再将完整的 `history` 存储在前端 State 中传给后端，而是只传 `current_message` 和 `chat_id`。
*   前端负责根据 `chat_id` 拉取消息列表进行渲染。

---

## 6. 开发计划 (Implementation Plan)

### Phase 1: 基础架构 (Backend)
1.  SQLAlchemy Models (`Chat`, `Message`, `GlobalMemory`).
2.  Database Migration (Alembic or manual init).
3.  CRUD APIs for Chats/Messages.

### Phase 2: Agent 与 工具链 (Backend)
1.  实现 `Tool` 接口 (Search Docs, Search History, Memory).
2.  重构 `chat` endpoint 为 Agent 模式 (使用 ReAct 或类似逻辑)。
3.  实现流式输出协议，支持传输 "Thinking" 事件和 "Answer" 事件。

### Phase 3: 上下文与记忆管理 (Backend)
1.  实现 `GlobalMemory` 的自动读写与总结逻辑。
2.  实现 `Chat` 的历史消息自动总结 (Sliding Window Summary)。
3.  集成 ChromaDB 存储聊天记录向量。

### Phase 4: 前端重构 (Frontend)
1.  侧边栏会话管理 UI。
2.  消息流式解析 (区分 Thought 和 Content)。
3.  全局状态管理更新 (Current Chat ID)。

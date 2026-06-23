# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-142: Feature Parity Sync

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-142 |
| Title | Feature Parity Sync — Đồng bộ 3 MCP Implementations |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-07-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-142.docx |
| Related FSD | FSD-v1-KSA-142.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-25 | SA Agent | Initial TDD from FSD KSA-142 |

---

## 1. Introduction

### 1.1 Purpose

This TDD defines the technical architecture, database schema migrations,
class designs, and implementation strategy for porting missing features
across the 3 MCP Code Intelligence implementations to achieve 100%
feature parity.

### 1.2 Scope

| Feature | Port To | Reference Implementation |
|---------|---------|--------------------------|
| F1: Core Memory | Python & Kotlin | Node.js `core-memory.ts` |
| F2: Conversation History | Python & Kotlin | Node.js `conversation-repo.ts` |
| F3: Structured Map | Python & Kotlin | Node.js `structured-map.ts` |
| F4: Cache Layer | Node.js | Python `orchestration/cache/` |
| F5: File Watcher | Node.js | Python `file_watcher.py` |
| F6: Viewer UI | Node.js & Kotlin | Python `viewer/` |
| F7: Nested Detection | Kotlin | Node.js `nested-detection.ts` |

### 1.3 Technology Stack

| Implementation | Language | Runtime | DB | HTTP | Key Libraries |
|----------------|----------|---------|-----|------|---------------|
| Node.js | TypeScript 5.x | Node 20+ | better-sqlite3 | Express | chokidar, onnxruntime-node |
| Python | Python 3.11+ | CPython | sqlite3 (stdlib) | FastAPI/Starlette | watchdog, onnxruntime |
| Kotlin | Kotlin 2.x | JVM 21 (target 11) | sqlite-jdbc | Ktor (Netty) | kotlinx-coroutines, onnxruntime |

### 1.4 Design Principles

1. **Behavioral Parity** — Ported features must produce identical tool outputs
2. **Schema Compatibility** — All 3 implementations share the same SQLite schema
3. **Idiomatic Code** — Each port uses language-native patterns (coroutines in Kotlin, async/await in Python)
4. **Minimal Dependencies** — Reuse existing libraries; no new deps unless justified
5. **Incremental Migration** — Schema changes via versioned migrations (V3)

### 1.5 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-142.docx |
| FSD | FSD-v1-KSA-142.docx |
| Node.js Schema V3 | `mcp-code-intelligence-nodejs/src/memory/schema-v3.ts` |
| Kotlin Schema | `mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/db/Schema.kt` |
| Python Cache | `mcp-code-intelligence-python/src/mcp_code_intel/orchestration/cache/` |

---

## 2. System Architecture

### 2.1 High-Level Architecture

![Architecture](diagrams/architecture.png)
*[Edit in draw.io](diagrams/architecture.drawio)*

All 3 implementations follow the same layered architecture:

```
┌─────────────────────────────────────────────┐
│              MCP Tool Interface              │
│  (mem_pin, mem_conversation, mem_map, ...)   │
├─────────────────────────────────────────────┤
│            Tool Dispatcher Layer             │
│  Routes tool calls to feature managers       │
├─────────────────────────────────────────────┤
│           Feature Manager Layer              │
│  CoreMemoryManager | ConversationRepo |      │
│  StructuredMapExtractor | CacheManager |     │
│  FileWatcher | ViewerServer | NestedDetector │
├─────────────────────────────────────────────┤
│          Repository / Data Layer             │
│  SQLite (shared schema) | File System        │
└─────────────────────────────────────────────┘
```

### 2.2 Component Mapping Across Implementations

| Component | Node.js | Python | Kotlin |
|-----------|---------|--------|--------|
| Entry Point | `src/index.ts` | `__main__.py` | `Main.kt` |
| MCP Server | `McpServer` class | `server.py` | `McpServer.kt` |
| Tool Dispatcher | `tool-dispatcher-consolidated.ts` | `dispatcher_consolidated.py` | `ToolDispatcher.kt` |
| Memory Engine | `memory-engine.ts` | `engine.py` | `MemoryEngine.kt` |
| DB Manager | `memory-db.ts` | `db.py` | `DatabaseManager.kt` |
| Schema | `schema-v3.ts` | `schema_v3.py` | `Schema.kt` |
| Core Memory | `core-memory.ts` | **NEW** | **NEW** |
| Conversation | `conversation-repo.ts` | **NEW** | **NEW** |
| Structured Map | `structured-map.ts` + `structured-map-extractor.ts` | **NEW** | **NEW** |
| Cache Layer | **NEW** | `orchestration/cache/` | `orchestration/cache/` |
| File Watcher | **NEW** | `file_watcher.py` | `indexer/FileWatcher.kt` |
| Viewer UI | **NEW** | `viewer/` | `http/ViewerServer.kt` |
| Nested Detection | `orchestration/nested-detection.ts` | `orchestration/nested_detection.py` | **NEW** |

### 2.3 Deployment Architecture

Each implementation runs as a standalone process:
- **Node.js**: `npx tsx src/index.ts` or compiled JS
- **Python**: `python -m mcp_code_intel` or `uvx mcp-code-intel`
- **Kotlin**: `java -jar mcp-code-intelligence-latest.jar`

All use local SQLite database (no external DB server required).
Viewer UI served on localhost:3001 (configurable port).

---

## 3. Database Design

### 3.1 Schema V3 Migrations (Shared Across All Implementations)

All 3 implementations MUST apply identical migrations to maintain schema compatibility.

#### 3.1.1 Migration: Core Memory Columns

```sql
-- Add pinned columns to knowledge_entries
ALTER TABLE knowledge_entries ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_entries ADD COLUMN pin_order INTEGER NOT NULL DEFAULT 0;

-- Index for fast pinned entry retrieval
CREATE INDEX IF NOT EXISTS idx_ke_pinned ON knowledge_entries(pinned, pin_order);
```

#### 3.1.2 Migration: Conversation Turns Table

```sql
CREATE TABLE IF NOT EXISTS conversation_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL,
  tool_calls TEXT,
  metadata TEXT,
  summarized INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ct_session ON conversation_turns(session_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_ct_role ON conversation_turns(role);
CREATE INDEX IF NOT EXISTS idx_ct_created ON conversation_turns(created_at);
CREATE INDEX IF NOT EXISTS idx_ct_summarized ON conversation_turns(summarized);
CREATE INDEX IF NOT EXISTS idx_ct_session_time ON conversation_turns(session_id, created_at);
```

#### 3.1.3 Migration: Structured Map & Entity Index

```sql
-- Add structured_map JSON column to knowledge_entries
ALTER TABLE knowledge_entries ADD COLUMN structured_map TEXT NOT NULL DEFAULT '{}';

-- Entity index table for fast entity-based search
CREATE TABLE IF NOT EXISTS entity_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ei_name ON entity_index(entity_name);
CREATE INDEX IF NOT EXISTS idx_ei_type ON entity_index(entity_type);
CREATE INDEX IF NOT EXISTS idx_ei_entry ON entity_index(entry_id);

-- FTS5 for entity name search
CREATE VIRTUAL TABLE IF NOT EXISTS entity_index_fts USING fts5(
  entity_name,
  content='entity_index',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS entity_index_ai AFTER INSERT ON entity_index BEGIN
  INSERT INTO entity_index_fts(rowid, entity_name) VALUES (new.id, new.entity_name);
END;

CREATE TRIGGER IF NOT EXISTS entity_index_ad AFTER DELETE ON entity_index BEGIN
  INSERT INTO entity_index_fts(entity_index_fts, rowid, entity_name)
  VALUES ('delete', old.id, old.entity_name);
END;
```

#### 3.1.4 Migration: Quality & Archive (Supporting)

```sql
ALTER TABLE knowledge_entries ADD COLUMN quality_score INTEGER DEFAULT NULL;
ALTER TABLE knowledge_entries ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ke_archived ON knowledge_entries(archived);
CREATE INDEX IF NOT EXISTS idx_ke_quality ON knowledge_entries(quality_score);
CREATE INDEX IF NOT EXISTS idx_ke_tier_archived ON knowledge_entries(tier, archived, created_at);
```

### 3.2 Migration Strategy

Each implementation applies migrations at startup:
1. Check `schema_version` table for current version
2. If version < 3, apply V3 migrations in order
3. Use `BEGIN TRANSACTION` / `COMMIT` for atomicity
4. Handle `ALTER TABLE` failures gracefully (column may already exist)

---

## 4. Feature Design: F1 — Core Memory (Python & Kotlin)

### 4.1 Class Design

#### Python Implementation

```
mcp-code-intelligence-python/src/mcp_code_intel/memory/
├── core_memory.py          # NEW — CoreMemoryManager class
└── schema_v3.py            # UPDATE — add V3 migration SQL
```

```python
# core_memory.py
class CoreMemoryManager:
    MAX_TOKENS = 2000
    WARNING_THRESHOLD = 1800
    MAX_PINNED_ENTRIES = 10

    def __init__(self, db: sqlite3.Connection):
        self.db = db

    def pin(self, entry_id: int) -> str: ...
    def unpin(self, entry_id: int) -> str: ...
    def list_pinned(self) -> list[PinnedEntrySummary]: ...
    def reorder(self, entry_id: int, new_order: int) -> str: ...
    def get_context(self) -> str: ...
    def get_budget_status(self) -> BudgetStatus: ...
```

#### Kotlin Implementation

```
mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/memory/
├── core/
│   └── CoreMemoryManager.kt    # NEW
├── schema/
│   └── SchemaV3.kt             # NEW — V3 migration constants
└── tools/
    └── MemPinTool.kt           # NEW — tool registration
```

```kotlin
// CoreMemoryManager.kt
package com.codeintel.memory.core

class CoreMemoryManager(
    private val db: Connection,
    private val config: CoreMemoryConfig = CoreMemoryConfig()
) {
    data class CoreMemoryConfig(
        val maxTokens: Int = 2000,
        val warningThreshold: Int = 1800,
        val maxPinnedEntries: Int = 10
    )

    fun pin(entryId: Int): String { ... }
    fun unpin(entryId: Int): String { ... }
    fun listPinned(): List<PinnedEntrySummary> { ... }
    fun reorder(entryId: Int, newOrder: Int): String { ... }
    fun getContext(): String { ... }
    fun getBudgetStatus(): BudgetStatus { ... }
}
```

### 4.2 Tool Registration

Both implementations register `mem_pin` tool with identical schema:

```json
{
  "name": "mem_pin",
  "description": "Core/Archival Memory: pin entries for auto-recall",
  "inputSchema": {
    "type": "object",
    "required": ["action"],
    "properties": {
      "action": {
        "type": "string",
        "description": "Action: pin, unpin, list, reorder, get_context, budget"
      },
      "entry_id": { "type": "number", "description": "Entry ID" },
      "order": { "type": "number", "description": "New position for reorder" }
    }
  }
}
```

### 4.3 Token Counting

All implementations use the same approximation: `tokens ≈ chars / 4`.
Node.js reference uses this in `token-counter.ts`. Python and Kotlin must match.

### 4.4 Auto-Recall Integration

The `get_context()` output is prepended to `mem_search` results automatically.
Integration point: `hybrid-search` / `search_repo` module.

---

## 5. Feature Design: F2 — Conversation History (Python & Kotlin)

### 5.1 Class Design

#### Python Implementation

```
mcp-code-intelligence-python/src/mcp_code_intel/memory/
├── conversation_repo.py    # NEW — ConversationRepository
├── conversation_summarizer.py  # NEW — session summarization
└── schema_v3.py            # UPDATE
```

```python
# conversation_repo.py
class ConversationRepository:
    def __init__(self, db: sqlite3.Connection):
        self.db = db

    def save_turn(self, session_id: str, role: str, content: str,
                  tool_calls: list | None = None) -> int: ...
    def get_session(self, session_id: str, limit: int = 100) -> list[ConversationTurn]: ...
    def list_sessions(self, limit: int = 20) -> list[SessionSummary]: ...
    def search_turns(self, query: str, limit: int = 20) -> list[ConversationTurn]: ...
    def summarize_session(self, session_id: str) -> str: ...
```

#### Kotlin Implementation

```
mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/memory/
├── conversation/
│   ├── ConversationRepository.kt   # NEW
│   ├── ConversationSummarizer.kt   # NEW
│   └── Models.kt                   # NEW — ConversationTurn, SessionSummary
└── tools/
    └── MemConversationTool.kt      # NEW
```

```kotlin
// ConversationRepository.kt
package com.codeintel.memory.conversation

class ConversationRepository(private val db: Connection) {
    fun saveTurn(sessionId: String, role: String, content: String,
                 toolCalls: List<Any>? = null): Long { ... }
    fun getSession(sessionId: String, limit: Int = 100): List<ConversationTurn> { ... }
    fun listSessions(limit: Int = 20): List<SessionSummary> { ... }
    fun searchTurns(query: String, limit: Int = 20): List<ConversationTurn> { ... }
    fun summarizeSession(sessionId: String): String { ... }
}
```

### 5.2 Tool Registration

```json
{
  "name": "mem_conversation",
  "description": "Structured conversation history: save turns, query sessions",
  "inputSchema": {
    "type": "object",
    "required": ["action"],
    "properties": {
      "action": { "type": "string", "description": "save_turn, get_session, list_sessions, search, summarize" },
      "session_id": { "type": "string" },
      "role": { "type": "string", "description": "user, assistant, system, tool" },
      "content": { "type": "string" },
      "query": { "type": "string" },
      "tool_calls": { "type": "string", "description": "JSON array of tool calls" },
      "limit": { "type": "number", "default": 20 }
    }
  }
}
```

### 5.3 Session Management

- Sessions auto-created on first `save_turn` with a given `session_id`
- If `session_id` omitted, generate: `session-{YYYY-MM-DD-HHmmss}`
- Max 1000 turns per session (archive oldest on overflow)
- Max 100 sessions total (archive oldest on overflow)

---

## 6. Feature Design: F3 — Structured Map & Entity Index (Python & Kotlin)

### 6.1 Class Design

#### Python Implementation

```
mcp-code-intelligence-python/src/mcp_code_intel/memory/
├── structured_map.py           # NEW — StructuredMap model
├── structured_map_extractor.py # NEW — extraction logic
├── entity_repo.py              # NEW — EntityRepository
└── schema_v3.py                # UPDATE
```

```python
@dataclass
class StructuredMap:
    topic: str = ""
    entities_mentioned: list[str] = field(default_factory=list)
    decisions_made: list[str] = field(default_factory=list)
    action_items: list[str] = field(default_factory=list)
    context_refs: list[str] = field(default_factory=list)
    sentiment: str = "neutral"  # positive|neutral|negative|mixed

class StructuredMapExtractor:
    def extract(self, content: str) -> StructuredMap: ...
    def re_extract(self, entry_id: int) -> StructuredMap: ...

class EntityRepository:
    def index_entities(self, entry_id: int, entities: list[str], entity_type: str): ...
    def search_by_entity(self, entity_name: str, limit: int = 10) -> list[int]: ...
    def search_by_topic(self, topic: str, limit: int = 10) -> list[int]: ...
```

#### Kotlin Implementation

```
mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/memory/
├── map/
│   ├── StructuredMap.kt            # NEW — data class
│   ├── StructuredMapExtractor.kt   # NEW — extraction logic
│   └── EntityRepository.kt        # NEW
└── tools/
    └── MemMapTool.kt              # NEW
```

```kotlin
@Serializable
data class StructuredMap(
    val topic: String = "",
    val entitiesMentioned: List<String> = emptyList(),
    val decisionsMade: List<String> = emptyList(),
    val actionItems: List<String> = emptyList(),
    val contextRefs: List<String> = emptyList(),
    val sentiment: String = "neutral"
)

class StructuredMapExtractor(private val db: Connection) {
    fun extract(content: String): StructuredMap { ... }
    fun reExtract(entryId: Int): StructuredMap { ... }
}

class EntityRepository(private val db: Connection) {
    fun indexEntities(entryId: Int, entities: List<String>, entityType: String) { ... }
    fun searchByEntity(entityName: String, limit: Int = 10): List<Int> { ... }
    fun searchByTopic(topic: String, limit: Int = 10): List<Int> { ... }
}
```

### 6.2 Entity Extraction Strategy

Extraction uses regex-based heuristics (matching Node.js reference):
1. **Code entities**: Match PascalCase words (class/interface names)
2. **File references**: Match paths like `src/...` or `*.ts`
3. **Tool names**: Match `mem_*`, `kb_*`, `code_*` patterns
4. **Decisions**: Lines starting with "Decision:", "Decided:", "Chose:"
5. **Action items**: Lines starting with "TODO:", "Action:", "- [ ]"

### 6.3 Tool Registration

```json
{
  "name": "mem_map",
  "description": "Structured Map: view/update entry metadata",
  "inputSchema": {
    "type": "object",
    "required": ["action"],
    "properties": {
      "action": { "type": "string", "description": "get, update, search_entity, search_topic, reextract" },
      "entry_id": { "type": "number" },
      "entity": { "type": "string" },
      "topic": { "type": "string" },
      "map": { "type": "object", "description": "Partial StructuredMap to merge" },
      "limit": { "type": "number", "default": 10 }
    }
  }
}
```

---

## 7. Feature Design: F4 — Cache Layer (Node.js)

### 7.1 Architecture

Port Python's `orchestration/cache/` to Node.js TypeScript.

```
mcp-code-intelligence-nodejs/src/orchestration/
├── cache/
│   ├── adaptive-cache.ts       # NEW — AdaptiveTokenCache
│   ├── cache-entry.ts          # NEW — CacheEntry model
│   ├── invalidation.ts         # NEW — LRU eviction + staleness
│   └── persistence.ts          # NEW — DebouncedPersistence (JSON file)
└── orchestration-engine.ts     # UPDATE — integrate cache
```

### 7.2 Class Design

```typescript
// cache-entry.ts
export interface CacheEntry {
  key: string;
  tokens: Set<string>;
  result: string;
  hash: string;
  lastAccess: number;
  hitCount: number;
}

// adaptive-cache.ts
export class AdaptiveTokenCache {
  private entries: Map<string, CacheEntry> = new Map();
  private persistence: DebouncedPersistence;
  private maxSize = 100;

  constructor(cachePath: string, debounceMs = 5000) { ... }
  findFuzzy(queryTokens: Set<string>, threshold = 0.7): CacheEntry | null { ... }
  add(key: string, tokens: Set<string>, result: string, hash: string): void { ... }
  invalidateStale(currentHash: string): number { ... }
}

// persistence.ts
export class DebouncedPersistence {
  private timer: NodeJS.Timeout | null = null;
  constructor(private path: string, private debounceMs = 5000) { ... }
  scheduleWrite(data: object): void { ... }
  flush(): void { ... }
  load(): object | null { ... }
}
```

### 7.3 Cache Invalidation Strategy

- **Staleness**: Compare content hash at query time; evict if hash changed
- **LRU Eviction**: When cache exceeds `maxSize`, evict least-recently-used entries
- **Token Overlap**: Fuzzy match uses Jaccard similarity on tokenized query
- **Persistence**: Debounced write to `.code-intel/cache.json` (5s debounce)

### 7.4 Integration Point

Cache wraps `find_tools` and `code_search` tool calls in orchestration engine:
1. Before executing tool → check cache with fuzzy match
2. If hit (overlap ≥ 0.7) → return cached result
3. If miss → execute tool → cache result with content hash

---

## 8. Feature Design: F5 — File Watcher (Node.js)

### 8.1 Architecture

```
mcp-code-intelligence-nodejs/src/
├── indexer/
│   └── file-watcher.ts     # NEW — FileWatcher class
└── index.ts                # UPDATE — start watcher on init
```

### 8.2 Class Design

```typescript
// file-watcher.ts
import chokidar from 'chokidar';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingPaths: Set<string> = new Set();
  private debounceMs = 500;

  constructor(
    private rootPath: string,
    private onChanges: (paths: string[]) => Promise<void>,
    private ignorePatterns: string[] = ['**/node_modules/**', '**/.git/**']
  ) {}

  start(): void { ... }
  stop(): void { ... }
  private handleChange(path: string): void { ... }
  private flush(): void { ... }
}
```

### 8.3 Behavior

- Watch workspace root recursively
- Ignore: `node_modules`, `.git`, `build`, `dist`, `__pycache__`
- Debounce 500ms — batch changes before triggering re-index
- On change: call `IndexingEngine.reindexFiles(changedPaths)`
- Graceful shutdown on process exit

---

## 9. Feature Design: F6 — Viewer UI (Node.js & Kotlin)

### 9.1 Architecture

Viewer UI is a set of static HTML/JS/CSS files served by the HTTP server.
Python already has the full implementation in `viewer/`. Strategy: **share static files**.

```
shared/viewer/                  # Shared static files (already exists)
├── index.html
├── dashboard.html
├── analytics.html
├── quality.html
├── tags.html
├── *.js, *.css

mcp-code-intelligence-nodejs/src/http/
├── viewer-routes.ts            # NEW — serve static files + API proxy

mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/http/
├── ViewerServer.kt             # EXISTS — already serves viewer
```

### 9.2 Node.js Implementation

```typescript
// viewer-routes.ts
import express from 'express';
import path from 'path';

export function registerViewerRoutes(app: express.Application, viewerPath: string) {
  // Serve static files
  app.use('/viewer', express.static(viewerPath));
  // API routes already exist — viewer JS calls them directly
}
```

### 9.3 Kotlin Status

Kotlin already has `ViewerServer.kt` and `KbViewerRoutes.kt` with `copyViewer` Gradle task.
**No additional work needed for Kotlin** — already implemented.

---

## 10. Feature Design: F7 — Nested Detection (Kotlin)

### 10.1 Architecture

```
mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/orchestration/
├── nested/
│   └── NestedDetector.kt       # NEW
└── OrchestrationEngine.kt      # UPDATE — integrate nested detection
```

### 10.2 Class Design

```kotlin
// NestedDetector.kt
package com.codeintel.orchestration.nested

class NestedDetector(
    private val registeredServers: List<ServerConfig>,
    private val httpClient: HttpClient
) {
    data class ChildServer(
        val name: String,
        val url: String,
        val tools: List<ToolDefinition>
    )

    suspend fun detectChildren(): List<ChildServer> { ... }
    suspend fun probeServer(url: String): List<ToolDefinition>? { ... }
    fun isNestedServer(tools: List<ToolDefinition>): Boolean {
        return tools.any { it.name == "find_tools" }
    }
}
```

### 10.3 Detection Strategy

1. On startup, scan registered MCP servers
2. For each server, call `tools/list` to get available tools
3. If server exposes `find_tools` → mark as nested (child) server
4. Register child server's tools in orchestration routing table
5. Re-scan periodically (every 60s) for dynamic server discovery

---

## 11. Integration Design

### 11.1 Tool Dispatcher Integration

Each new feature registers tools via the existing dispatcher pattern:

**Node.js** — Add to `tool-definitions-consolidated.ts`:
```typescript
export const CACHE_TOOLS = [...]; // No new MCP tools — cache is internal
export const FILE_WATCHER_TOOLS = [...]; // No new MCP tools — watcher is internal
```

**Python** — Add to `definitions_consolidated.py`:
```python
CORE_MEMORY_TOOLS = [mem_pin_definition]
CONVERSATION_TOOLS = [mem_conversation_definition]
STRUCTURED_MAP_TOOLS = [mem_map_definition]
```

**Kotlin** — Add to `ToolDefinitions.kt`:
```kotlin
val CORE_MEMORY_TOOLS = listOf(memPinDefinition)
val CONVERSATION_TOOLS = listOf(memConversationDefinition)
val STRUCTURED_MAP_TOOLS = listOf(memMapDefinition)
val NESTED_DETECTION_TOOLS = listOf(findToolsDefinition) // if exposing
```

### 11.2 Memory Engine Integration

The MemoryEngine (central coordinator) must be updated in Python and Kotlin to:
1. Initialize `CoreMemoryManager` on startup
2. Initialize `ConversationRepository` on startup
3. Initialize `StructuredMapExtractor` on startup
4. Hook `CoreMemoryManager.getContext()` into search results (auto-recall)
5. Hook `StructuredMapExtractor.extract()` into ingest pipeline (auto-extract on new entries)

### 11.3 Ingest Pipeline Hook

When a new knowledge entry is ingested:
1. Run `StructuredMapExtractor.extract(content)` → get StructuredMap
2. Store JSON in `knowledge_entries.structured_map` column
3. Index entities in `entity_index` table
4. This happens automatically — no user action needed

---

## 12. Security Design

### 12.1 Viewer UI Security

- Bind to `localhost` only (127.0.0.1) — no external access
- No authentication required (local-only assumption)
- CORS: allow only same-origin requests
- CSP headers: restrict script sources to self

### 12.2 Data Security

- SQLite database file permissions: 0600 (owner read/write only)
- No sensitive data in cache files (only tool results, no credentials)
- Conversation content stored as-is (no encryption at rest for local SQLite)

### 12.3 Input Validation

All tool inputs validated before processing:
- `action` must be in allowed set
- `entry_id` must be positive integer
- `content` max 10,000 chars
- `session_id` max 100 chars, alphanumeric + hyphens
- `query` max 500 chars

---

## 13. Performance & Scalability

### 13.1 Performance Targets (from BRD NFRs)

| Operation | Target | Strategy |
|-----------|--------|----------|
| Core Memory auto-recall | < 5ms | Single indexed query on `pinned=1` |
| Conversation search | < 50ms | FTS5 full-text search |
| Cache hit | < 1ms | In-memory HashMap lookup |
| File watcher debounce | 500ms | Batch changes before re-index |
| Entity search | < 20ms | FTS5 on entity_index |

### 13.2 Caching Strategy

- **Orchestration cache** (F4): In-memory LRU with JSON persistence
- **Pinned context**: Cached in memory after first load, invalidated on pin/unpin
- **Entity index**: SQLite indexes provide sufficient performance

### 13.3 Connection Pooling

- SQLite: Single connection per process (WAL mode for concurrent reads)
- No external database connections needed
- HTTP client (Kotlin nested detection): Connection pool with 5 max connections

---

## 14. Testing Strategy

### 14.1 Unit Tests

| Feature | Test File | Key Tests |
|---------|-----------|-----------|
| F1 Core Memory (Python) | `tests/test_core_memory.py` | pin/unpin, budget enforcement, reorder, get_context |
| F1 Core Memory (Kotlin) | `src/test/.../CoreMemoryManagerTest.kt` | Same as Python |
| F2 Conversation (Python) | `tests/test_conversation.py` | save_turn, get_session, search, summarize |
| F2 Conversation (Kotlin) | `src/test/.../ConversationRepositoryTest.kt` | Same as Python |
| F3 Structured Map (Python) | `tests/test_structured_map.py` | extract, search_entity, search_topic |
| F3 Structured Map (Kotlin) | `src/test/.../StructuredMapTest.kt` | Same as Python |
| F4 Cache (Node.js) | `src/orchestration/cache/__tests__/` | fuzzy match, LRU eviction, persistence |
| F5 File Watcher (Node.js) | `src/indexer/__tests__/file-watcher.test.ts` | debounce, ignore patterns |
| F7 Nested Detection (Kotlin) | `src/test/.../NestedDetectorTest.kt` | probe, detect children |

### 14.2 Integration Tests

- **Cross-implementation parity**: Run same test scenarios against all 3 implementations
- **Schema migration**: Test V3 migration on existing V2 databases
- **Tool output comparison**: Verify identical JSON output for same inputs

---

## 15. Implementation Checklist

### Phase 1: Schema Migration (All implementations)

- [ ] Python: Add V3 migration SQL to `schema_v3.py`
- [ ] Python: Apply migration in `db.py` startup
- [ ] Kotlin: Add V3 migration SQL to `SchemaV3.kt`
- [ ] Kotlin: Apply migration in `DatabaseManager.kt` startup
- [ ] Node.js: Verify existing V3 migrations work (already implemented)

### Phase 2: F1 Core Memory (Python & Kotlin)

- [ ] Python: Create `core_memory.py` with CoreMemoryManager
- [ ] Python: Register `mem_pin` tool in dispatcher
- [ ] Python: Hook auto-recall into search
- [ ] Python: Unit tests
- [ ] Kotlin: Create `CoreMemoryManager.kt`
- [ ] Kotlin: Register `mem_pin` tool
- [ ] Kotlin: Hook auto-recall into search
- [ ] Kotlin: Unit tests

### Phase 3: F2 Conversation History (Python & Kotlin)

- [ ] Python: Create `conversation_repo.py`
- [ ] Python: Create `conversation_summarizer.py`
- [ ] Python: Register `mem_conversation` tool
- [ ] Python: Unit tests
- [ ] Kotlin: Create `ConversationRepository.kt`
- [ ] Kotlin: Create `ConversationSummarizer.kt`
- [ ] Kotlin: Register `mem_conversation` tool
- [ ] Kotlin: Unit tests

### Phase 4: F3 Structured Map (Python & Kotlin)

- [ ] Python: Create `structured_map.py` + `structured_map_extractor.py`
- [ ] Python: Create `entity_repo.py`
- [ ] Python: Register `mem_map` tool
- [ ] Python: Hook extraction into ingest pipeline
- [ ] Python: Unit tests
- [ ] Kotlin: Create `StructuredMap.kt` + `StructuredMapExtractor.kt`
- [ ] Kotlin: Create `EntityRepository.kt`
- [ ] Kotlin: Register `mem_map` tool
- [ ] Kotlin: Hook extraction into ingest pipeline
- [ ] Kotlin: Unit tests

### Phase 5: F4 Cache Layer (Node.js)

- [ ] Create `src/orchestration/cache/` directory
- [ ] Implement `cache-entry.ts`
- [ ] Implement `adaptive-cache.ts`
- [ ] Implement `invalidation.ts`
- [ ] Implement `persistence.ts`
- [ ] Integrate into orchestration engine
- [ ] Unit tests

### Phase 6: F5 File Watcher (Node.js)

- [ ] Add `chokidar` dependency
- [ ] Create `src/indexer/file-watcher.ts`
- [ ] Integrate into startup (index.ts)
- [ ] Unit tests

### Phase 7: F6 Viewer UI (Node.js)

- [ ] Create `src/http/viewer-routes.ts`
- [ ] Configure static file serving from `shared/viewer/`
- [ ] Verify all viewer pages load correctly

### Phase 8: F7 Nested Detection (Kotlin)

- [ ] Create `NestedDetector.kt`
- [ ] Integrate into OrchestrationEngine
- [ ] Unit tests

---

## 16. Monitoring & Observability

### 16.1 Logging

All implementations use structured logging:
- **Node.js**: `console.log` with `[module]` prefix
- **Python**: `logging` module with `%(name)s` format
- **Kotlin**: `println` with `[module]` prefix (no SLF4J dependency)

Key log events:
- Schema migration applied: `[DB] Applied V3 migration: {feature}`
- Pin/unpin: `[CoreMemory] Pinned entry {id} (tokens: {n})`
- Cache hit/miss: `[Cache] HIT key={key} overlap={score}` / `[Cache] MISS`
- File change detected: `[FileWatcher] Changed: {n} files, reindexing...`
- Nested server detected: `[Nested] Found child server: {name} with {n} tools`

### 16.2 Health Checks

Viewer UI dashboard shows:
- Memory usage (pinned entries, budget)
- Conversation stats (sessions, turns)
- Cache stats (hit rate, size, evictions)
- File watcher status (watching, last change)

---

## 17. Deployment & Rollback

### 17.1 Deployment

No infrastructure changes needed. Each implementation is a standalone binary:
- Update version in `package.json` / `pyproject.toml` / `build.gradle.kts`
- Build: `npm run build` / `pip install -e .` / `./gradlew shadowJar`
- Deploy: Replace binary, restart process
- Schema migration runs automatically on startup

### 17.2 Rollback Strategy

- Schema V3 adds columns and tables — **non-destructive**
- Rollback to V2 binary: V3 columns ignored (DEFAULT values ensure compatibility)
- No data loss on rollback
- Cache file can be deleted safely (regenerated on next run)

---

## Appendix A: Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 3 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
| 4 | Core Memory Sequence | [sequence-core-memory.png](diagrams/sequence-core-memory.png) | [sequence-core-memory.drawio](diagrams/sequence-core-memory.drawio) |
| 5 | Cache State | [state-cache-entry.png](diagrams/state-cache-entry.png) | [state-cache-entry.drawio](diagrams/state-cache-entry.drawio) |

---

*End of Document*

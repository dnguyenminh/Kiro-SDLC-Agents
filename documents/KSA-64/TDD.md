# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-64: Session Replay: Redesign for richer event data and AI context value

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-64 |
| Title | Session Replay: Redesign for richer event data and AI context value |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-20 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-64.docx |
| Related FSD | FSD-v1-KSA-64.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-20 | SA Agent | Initiate document — technical design for session replay redesign |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical implementation of the Session Replay redesign across three modules: Kotlin server (audit schema expansion), Node.js bridge (API enhancements), and shared viewer (UI redesign).

### 1.2 Scope

- Kotlin: Schema migration, AuditRepository expansion, duration measurement wrapper
- Node.js: Enhanced API handlers, new export endpoint, response mapping
- Viewer: Refactored sessions.js with task grouping, duration badges, export functionality

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Server Language | Kotlin | 1.9+ |
| Server Runtime | JVM | 17+ |
| Bridge Language | TypeScript | 5.x |
| Bridge Runtime | Node.js | 18+ |
| UI | Vanilla JavaScript | ES2020 |
| Database | SQLite | 3.x |
| Build (Kotlin) | Gradle (Kotlin DSL) | 8.x |
| Build (Node.js) | npm | 9+ |

### 1.4 Design Principles

- **Backward Compatibility**: All new fields nullable, existing callers unchanged
- **Single Responsibility**: Each module handles one concern (write/read/display)
- **Incremental Enhancement**: New features additive, no breaking changes
- **Performance First**: No DOM rebuild on playback step, efficient SQL queries

### 1.5 Constraints

- SQLite ALTER TABLE only supports ADD COLUMN (no DROP/RENAME in older versions)
- Viewer must work without build tools (vanilla JS, no bundler)
- Node.js bridge reads same SQLite file that Kotlin writes (shared file access)
- Max file size for sessions.js: 200 lines (per code standards)

---

## 2. System Architecture

### 2.1 Architecture Overview

![Architecture Diagram](diagrams/architecture.png)

The system follows a layered architecture with clear separation:
- **Write Layer** (Kotlin): Captures enriched audit data during tool execution
- **Storage Layer** (SQLite): Persists audit entries with new schema columns
- **Read Layer** (Node.js): Serves data via HTTP API with JSON/markdown responses
- **Presentation Layer** (Viewer): Renders timeline UI with interactive controls

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| AuditRepository | Write enriched audit entries to SQLite | Kotlin + JDBC |
| SchemaManager | Run ALTER TABLE migrations on startup | Kotlin + SQL |
| DurationWrapper | Measure operation duration (start/end) | Kotlin |
| SessionHandler | Handle /sessions API requests | Node.js + http |
| EventHandler | Handle /sessions/:id/events API requests | Node.js + http |
| ExportHandler | Generate markdown export | Node.js + http |
| SessionTimeline | Render visual timeline with task groups | JavaScript |
| EventCard | Render rich event detail cards | JavaScript |
| ExportButton | Trigger export and clipboard copy | JavaScript |
| PlaybackController | Manage play/pause/step/speed controls | JavaScript |

### 2.3 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| Kotlin Server | SQLite | JDBC | Sync write | INSERT audit entries |
| Node.js Bridge | SQLite | better-sqlite3 | Sync read | SELECT sessions/events |
| Viewer | Node.js | HTTP/JSON | Async request | Fetch session data |
| Viewer | Node.js | HTTP/text | Async request | Fetch markdown export |

---

## 3. API Design

### 3.1 API Overview

| # | Endpoint | Method | Description | Source |
|---|----------|--------|-------------|--------|
| 1 | /sessions | GET | List sessions with aggregates | UC-02 |
| 2 | /sessions/:id/events | GET | Get enriched events for session | UC-03 |
| 3 | /sessions/:id/export | GET | Export session as markdown | UC-04 |

### 3.2 API: List Sessions (Enhanced)

**Implements:** UC-02

| Attribute | Value |
|-----------|-------|
| Method | GET |
| Path | /sessions |
| Auth | None (local tool) |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| agent | string | No | "" | Filter by agent name (partial match) |
| status | string | No | "" | Filter: "active" or "ended" |
| limit | integer | No | 50 | Max results (1-200) |

**Response — 200 OK:**

```json
[
  {
    "id": "sess_abc123",
    "agentName": "kiro-agent",
    "startedAt": "2026-05-20T10:00:00Z",
    "endedAt": "2026-05-20T10:05:30Z",
    "status": "ended",
    "observationCount": 42,
    "totalDurationMs": 12500,
    "taskCount": 3
  }
]
```

**Error Responses:**

| Status | Message | Description |
|--------|---------|-------------|
| 503 | "Memory not initialized" | Engine not ready |

### 3.3 API: Get Session Events (Enhanced)

**Implements:** UC-03

| Attribute | Value |
|-----------|-------|
| Method | GET |
| Path | /sessions/:id/events |
| Auth | None |

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Session ID |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | integer | No | 200 | Max events (1-1000) |

**Response — 200 OK:**

```json
[
  {
    "id": 1234,
    "operation": "SEARCH",
    "toolName": "kb_search",
    "entryId": null,
    "sessionId": "sess_abc123",
    "details": "query: session replay",
    "arguments": "{\"query\":\"session replay\",\"top_k\":5}",
    "resultSummary": "Found 3 entries matching query",
    "durationMs": 245,
    "taskId": "task_001",
    "createdAt": "2026-05-20T10:00:01Z"
  }
]
```

### 3.4 API: Export Session (New)

**Implements:** UC-04

| Attribute | Value |
|-----------|-------|
| Method | GET |
| Path | /sessions/:id/export |
| Auth | None |

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Session ID |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| format | string | No | "markdown" | Export format |

**Response — 200 OK:**

```
Content-Type: text/markdown; charset=utf-8

# Session: kiro-agent — 2026-05-20T10:00:00Z
Duration: 5m 30s | Events: 42 | Tasks: 3

## Task: task_001
- [10:00:01] **kb_search** (245ms): query="session replay", top_k=5 → Found 3 entries
- [10:00:02] **mem_ingest** (120ms): content="..." → Entry #456 created

## Ungrouped Events
- [10:05:00] **SESSION_END**: Session completed
```

**Error Responses:**

| Status | Message | Description |
|--------|---------|-------------|
| 404 | "Session not found" | Invalid session ID |
| 503 | "Memory not initialized" | Engine not ready |

---

## 4. Database Design

### 4.1 Schema Migration

**Migration Strategy:** ALTER TABLE ADD COLUMN (safe for SQLite, no data loss)

```sql
-- Migration: V_KSA64_expand_audit_schema.sql
-- Run on Kotlin server startup (idempotent)

ALTER TABLE memory_audit ADD COLUMN arguments TEXT;
ALTER TABLE memory_audit ADD COLUMN result_summary TEXT;
ALTER TABLE memory_audit ADD COLUMN duration_ms INTEGER;
ALTER TABLE memory_audit ADD COLUMN task_id TEXT;
ALTER TABLE memory_audit ADD COLUMN tool_name TEXT;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_session_task 
  ON memory_audit(session_id, task_id);
CREATE INDEX IF NOT EXISTS idx_audit_tool_name 
  ON memory_audit(tool_name) WHERE tool_name IS NOT NULL;
```

### 4.2 Migration Implementation (Kotlin)

```kotlin
// In MemoryDatabaseManager.ensureSchema() or similar startup hook
private fun migrateAuditSchema() {
    val existingColumns = getColumnNames("memory_audit")
    val migrations = mapOf(
        "arguments" to "ALTER TABLE memory_audit ADD COLUMN arguments TEXT",
        "result_summary" to "ALTER TABLE memory_audit ADD COLUMN result_summary TEXT",
        "duration_ms" to "ALTER TABLE memory_audit ADD COLUMN duration_ms INTEGER",
        "task_id" to "ALTER TABLE memory_audit ADD COLUMN task_id TEXT",
        "tool_name" to "ALTER TABLE memory_audit ADD COLUMN tool_name TEXT"
    )
    for ((col, sql) in migrations) {
        if (col !in existingColumns) {
            conn.createStatement().execute(sql)
        }
    }
    // Create indexes (IF NOT EXISTS is idempotent)
    conn.createStatement().execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_session_task ON memory_audit(session_id, task_id)"
    )
}
```

### 4.3 Query Patterns

| Operation | Query Pattern | Expected Performance |
|-----------|--------------|---------------------|
| List sessions with aggregates | SELECT + GROUP BY session_id with SUM(duration_ms), COUNT(DISTINCT task_id) | < 50ms for 1000 sessions |
| Get events for session | SELECT WHERE session_id = ? ORDER BY created_at ASC | < 100ms for 500 events |
| Export (same as events) | Same query, processed in Node.js | < 200ms total |

---

## 5. Class / Module Design

### 5.1 Kotlin — AuditRepository Changes

**File:** `mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/memory/repository/AuditRepository.kt`

```kotlin
data class AuditEntry(
    val id: Long = 0,
    val operation: String,
    val entryId: Long? = null,
    val sessionId: String? = null,
    val agentName: String? = null,
    val details: String? = null,
    // New fields (KSA-64)
    val arguments: String? = null,
    val resultSummary: String? = null,
    val durationMs: Long? = null,
    val taskId: String? = null,
    val toolName: String? = null,
    val createdAt: String = ""
)

class AuditRepository(private val db: MemoryDatabaseManager) {

    /** Log an operation with enriched data. Backward compatible. */
    fun log(
        operation: String,
        entryId: Long? = null,
        sessionId: String? = null,
        agentName: String? = null,
        details: String? = null,
        // New optional params (KSA-64)
        arguments: String? = null,
        resultSummary: String? = null,
        durationMs: Long? = null,
        taskId: String? = null,
        toolName: String? = null
    ) {
        val sql = """
            INSERT INTO memory_audit 
            (operation, entry_id, session_id, agent_name, details,
             arguments, result_summary, duration_ms, task_id, tool_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent()
        // ... prepared statement execution
    }
}
```

### 5.2 Node.js — Enhanced Handlers

**File:** `mcp-code-intelligence-nodejs/src/http/api-routes.ts`

New/modified functions:

```typescript
// Enhanced: includes aggregate fields
function handleSessions(url: URL, res: http.ServerResponse, engine: MemoryEngine | null): void {
  // Query sessions with: totalDurationMs, taskCount
}

// Enhanced: includes new fields in response
function handleSessionEvents(path: string, url: URL, res: http.ServerResponse, engine: MemoryEngine | null): void {
  // Map: arguments, resultSummary, durationMs, taskId, toolName
}

// NEW: Export session as markdown
function handleSessionExport(path: string, url: URL, res: http.ServerResponse, engine: MemoryEngine | null): void {
  // Generate markdown from events grouped by taskId
}
```

### 5.3 Viewer — File Split (Code Standards: max 200 lines)

Current `sessions.js` is ~130 lines. With new features it would exceed 200 lines. Split into:

| File | Responsibility | Est. Lines |
|------|---------------|------------|
| `sessions.js` | Session list + main orchestration | ~80 |
| `session-timeline.js` | Timeline rendering + task grouping | ~120 |
| `session-playback.js` | Playback controls + keyboard shortcuts | ~80 |
| `session-export.js` | Export button + clipboard logic | ~40 |

### 5.4 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Default Parameters | AuditRepository.log() | Backward compatibility without overloads |
| Idempotent Migration | SchemaManager | Safe to run multiple times on startup |
| Incremental DOM Update | session-timeline.js | Performance: no rebuild on step |
| Strategy (duration format) | Duration badge rendering | Different display for different ranges |

---

## 6. Integration Design

### 6.1 Kotlin → SQLite (Write Path)

| Attribute | Value |
|-----------|-------|
| Protocol | JDBC (SQLite) |
| Connection | Single file, shared with Node.js |
| Timeout | N/A (local file) |
| Concurrency | WAL mode enabled (concurrent read/write) |

**Key Consideration:** Both Kotlin and Node.js access the same SQLite file. WAL mode must be enabled to allow concurrent reads while Kotlin writes.

### 6.2 Node.js → SQLite (Read Path)

| Attribute | Value |
|-----------|-------|
| Protocol | better-sqlite3 (synchronous) |
| Connection | Read-only mode |
| Timeout | N/A (local file) |

### 6.3 Duration Measurement Integration

```kotlin
// Wrapper pattern for measuring tool execution duration
fun <T> measureAndLog(
    operation: String,
    toolName: String,
    sessionId: String?,
    taskId: String?,
    arguments: String?,
    block: () -> T
): T {
    val start = System.currentTimeMillis()
    return try {
        val result = block()
        val duration = System.currentTimeMillis() - start
        audit.log(
            operation = operation,
            toolName = toolName,
            sessionId = sessionId,
            taskId = taskId,
            arguments = arguments?.take(10240), // BR-01: max 10KB
            resultSummary = result.toString().take(2000), // BR-02: max 2000
            durationMs = duration
        )
        result
    } catch (e: Exception) {
        val duration = System.currentTimeMillis() - start
        audit.log(
            operation = operation,
            toolName = toolName,
            sessionId = sessionId,
            taskId = taskId,
            arguments = arguments?.take(10240),
            resultSummary = "ERROR: ${e.message}".take(2000),
            durationMs = duration
        )
        throw e
    }
}
```

---

## 7. Security Design

### 7.1 Authentication

No authentication required — this is a local development tool. All endpoints accessible without credentials.

### 7.2 Data Protection

| Data Type | At Rest | In Transit | In Logs |
|-----------|---------|------------|---------|
| Tool arguments | Plain (SQLite file) | Plain (localhost HTTP) | Truncated to 200 chars |
| Result summaries | Plain | Plain | Truncated to 100 chars |
| Session metadata | Plain | Plain | Full |

### 7.3 Input Validation

| Field | Validation | Sanitization |
|-------|-----------|--------------|
| arguments (write) | Max 10KB, must be valid JSON or null | Truncate if exceeds |
| result_summary (write) | Max 2000 chars | Truncate + "[truncated]" |
| limit (API param) | Integer, 1-1000 | Clamp to range |
| session ID (path) | Non-empty string | No SQL injection (prepared stmt) |

---

## 8. Performance & Scalability

### 8.1 Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| AuditRepository.log() | < 5ms | Time from call to INSERT complete |
| GET /sessions | < 50ms | Response time for 50 sessions |
| GET /sessions/:id/events | < 100ms | Response time for 200 events |
| GET /sessions/:id/export | < 200ms | Response time for 500 events |
| Timeline render (200 events) | < 100ms | Time from data received to DOM ready |
| Playback step | < 16ms | Time to update highlight (1 frame) |

### 8.2 Optimization Strategies

| Strategy | Component | Description |
|----------|-----------|-------------|
| Prepared statements | Kotlin AuditRepository | Reuse statement for repeated inserts |
| Index on session_id + task_id | SQLite | Fast session event lookup |
| Incremental DOM update | Viewer timeline | Only update highlight + detail, not rebuild list |
| Lazy argument display | Viewer event card | Don't parse JSON until user expands |

---

## 9. Monitoring & Observability

### 9.1 Logging

| Log Event | Level | Fields | Destination |
|-----------|-------|--------|-------------|
| Schema migration applied | INFO | column_name | stderr |
| Audit write failure | ERROR | operation, error_message | stderr |
| Export generated | DEBUG | session_id, event_count, markdown_size | stderr |

---

## 10. Implementation Checklist

### 10.1 Files to Create/Modify

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `mcp-code-intelligence-kotlin/.../AuditRepository.kt` | MODIFY | Add new fields to AuditEntry + log() |
| 2 | `mcp-code-intelligence-kotlin/.../MemoryDatabaseManager.kt` | MODIFY | Add schema migration |
| 3 | `mcp-code-intelligence-nodejs/src/http/api-routes.ts` | MODIFY | Enhance handlers + add export |
| 4 | `mcp-code-intelligence-nodejs/src/memory/session-repository.ts` | MODIFY | Add aggregate queries |
| 5 | `shared/viewer/sessions.js` | MODIFY | Refactor to orchestration only |
| 6 | `shared/viewer/session-timeline.js` | CREATE | Timeline + task grouping |
| 7 | `shared/viewer/session-playback.js` | CREATE | Playback controls + keyboard |
| 8 | `shared/viewer/session-export.js` | CREATE | Export button + clipboard |
| 9 | `shared/viewer/index.html` | MODIFY | Add new script tags + speed selector |

### 10.2 Implementation Order

1. **Kotlin schema migration** (no dependencies)
2. **Kotlin AuditRepository expansion** (depends on #1)
3. **Node.js enhanced handlers** (depends on #1 for new columns)
4. **Node.js export endpoint** (depends on #3)
5. **Viewer file split** (independent)
6. **Viewer timeline + task grouping** (depends on #3 for API data)
7. **Viewer playback + export** (depends on #4, #6)

### 10.3 Rollback Strategy

- Schema migration is additive (new nullable columns) — no rollback needed
- If issues found: revert Node.js/viewer code, new columns remain but unused
- No data migration required — existing entries have NULL for new fields

---

## 11. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

### Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Should task_id be auto-generated or passed by caller? | Resolved | Passed by caller (agent decides task boundaries) |
| 2 | Max session export size limit? | Resolved | 50KB soft limit (truncate oldest events if exceeded) |
| 3 | Should we add WebSocket for live session streaming? | Deferred | Out of scope for KSA-64, future enhancement |

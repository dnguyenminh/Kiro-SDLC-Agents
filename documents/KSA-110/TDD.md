# Technical Design Document (TDD)

## mcp-code-intelligence-nodejs — KSA-110: KB System Upgrade v0.6.0

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-110 |
| Title | KB System Upgrade v0.6.0 |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-05-22 |
| Status | Draft |
| Related BRD | BRD-v1.1-KSA-110.docx |
| Related FSD | FSD-v1.0-KSA-110.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | SA Agent – Solution Architect | Create document |
| Peer Reviewer | Duc Nguyen Minh – Product Owner | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-05-22 | SA Agent | Initial TDD from FSD v1.0 — 4 features, 14 use cases |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| Duc Nguyen Minh | ☐ I agree and confirm the technical design in this TDD |
| | ☐ I agree and confirm the technical design in this TDD |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical implementation of KB System Upgrade v0.6.0 for mcp-code-intelligence-nodejs. It covers architecture, class design, database DDL, API implementation, and deployment for 4 features: Core Memory (F1), Conversation History (F2), Structured Map (F3), and Anti-Pattern Protection (F4).

### 1.2 Scope

- New classes: `QualityGate`, `AgentScopeFilter`, `WorkingTierExpiry`, `ConversationSummarizer`
- Extended classes: `HybridSearch` (agent_scope + max_tokens), `IngestPipeline` (quality gate + structured map)
- Schema migrations: 5 new columns on `knowledge_entries`, 3 new tables
- 3 new MCP tools: `mem_pin`, `mem_conversation`, `mem_map`
- Enhanced existing tools: `mem_search` (agent_scope, max_tokens), `mem_ingest` (quality gate)

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x |
| Runtime | Node.js | ≥18 |
| Database | SQLite (better-sqlite3) | 3.x |
| Embedding | ONNX Runtime (all-MiniLM-L6-v2) | 384d |
| Protocol | MCP (Model Context Protocol) | stdio |
| Build Tool | npm / tsc | latest |
| Test | Vitest | latest |

### 1.4 Design Principles

- **Additive-only migrations** — never DROP or ALTER existing columns
- **Single Responsibility** — each class handles one concern
- **Backward compatibility** — all 14 existing MCP tools unchanged
- **No external dependencies** — rule-based extraction, no LLM calls
- **Lazy evaluation** — auto-expiry runs on search, not background jobs
- **Fail-safe** — quality gate failures don't crash ingest pipeline

### 1.5 Constraints

- SQLite single-writer (no concurrent writes from multiple processes)
- No network calls during extraction (rule-based only)
- Token counting uses chars/4 approximation (no tiktoken dependency)
- Maximum 10 pinned entries, 2000 token budget
- ONNX model already loaded — no additional ML models

### 1.6 References

| Document | Location |
|----------|----------|
| BRD v1.1 | BRD-v1.1-KSA-110.docx |
| FSD v1.0 | FSD-v1.0-KSA-110.docx |
| Current Schema | src/memory/schema.ts, schema-v2.ts, schema-v3.ts |
| Core Memory | src/memory/core-memory.ts |
| Conversation Repo | src/memory/conversation-repo.ts |
| Structured Map | src/memory/structured-map-extractor.ts |

---

## 2. System Architecture

### 2.1 Architecture Overview

The KB system is a single-process Node.js MCP server communicating via stdio. The upgrade adds 4 functional layers to the existing memory engine without changing the deployment model.

![Architecture Diagram](diagrams/architecture.png)

**Layers (bottom-up):**
1. **Storage Layer** — SQLite database with better-sqlite3 (synchronous API)
2. **Repository Layer** — Data access classes (KnowledgeRepo, ConversationRepo, EntityRepo, etc.)
3. **Service Layer** — Business logic (CoreMemoryManager, QualityGate, AgentScopeFilter, WorkingTierExpiry)
4. **Search Layer** — HybridSearch with RRF fusion, pinned prepend, scope filter, token budget
5. **Tool Layer** — MCP tool dispatchers (consolidated pattern: one tool = multiple actions)
6. **Protocol Layer** — MCP stdio transport (unchanged)

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| CoreMemoryManager | Pin/unpin/reorder, token budget, context injection | TypeScript class |
| ConversationRepository | CRUD for conversation_turns, session queries | TypeScript class |
| ConversationSummarizer | Auto-summarize old sessions into KB entries | TypeScript class |
| StructuredMapExtractor | Rule-based entity/decision/action extraction | Pure functions |
| EntityRepository | CRUD for entity_index, entity search | TypeScript class |
| QualityGate | Validate content before ingest (length, duplicates, score) | TypeScript class |
| AgentScopeFilter | Tag-based filtering per agent role | TypeScript class |
| WorkingTierExpiry | Lazy auto-expiry of stale WORKING entries | TypeScript class |
| HybridSearch | BM25 + graph + vector fusion, pinned prepend, scope, budget | TypeScript class |
| IngestPipeline | Orchestrates: quality gate → store → extract map → index entities | TypeScript class |
| ToolDispatcher | Routes MCP tool calls to appropriate service methods | TypeScript class |

### 2.3 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| AI Agent | MCP Server | stdio (JSON-RPC) | Sync request/response | Tool calls |
| ToolDispatcher | Services | In-process function call | Sync | Direct method invocation |
| Services | SQLite | better-sqlite3 | Sync | Prepared statements |
| HybridSearch | CoreMemoryManager | In-process | Sync | getContext() for auto-recall |
| IngestPipeline | QualityGate | In-process | Sync | Validate before store |
| IngestPipeline | StructuredMapExtractor | In-process | Sync | Extract after store |
| HybridSearch | WorkingTierExpiry | In-process | Sync (lazy) | Process stale entries on search |

---

## 3. API Design (MCP Tools)

### 3.1 API Overview

| # | Tool | Actions | Description | Source |
|---|------|---------|-------------|--------|
| 1 | mem_pin | pin, unpin, list, reorder, get_context, budget | Core memory management | UC-01, UC-02, UC-03 |
| 2 | mem_conversation | save_turn, get_session, list_sessions, search, summarize | Conversation history | UC-04, UC-05, UC-06 |
| 3 | mem_map | get, update, search_entity, search_topic, reextract | Structured map management | UC-07, UC-08, UC-09 |
| 4 | mem_search (enhanced) | — | +agent_scope, +max_tokens params | UC-10, UC-13, UC-14 |
| 5 | mem_ingest (enhanced) | — | +quality gate, +auto-extract map | UC-07, UC-12 |

### 3.2 Tool: mem_pin

**Implements:** UC-01, UC-02, UC-03 | **BR:** BR-F1-01 through BR-F1-06

**Input Schema:**

```json
{
  "type": "object",
  "required": ["action"],
  "properties": {
    "action": { "type": "string", "enum": ["pin", "unpin", "list", "reorder", "get_context", "budget"] },
    "entry_id": { "type": "integer", "description": "Required for pin/unpin/reorder" },
    "order": { "type": "integer", "description": "Required for reorder (0-based)" }
  }
}
```

**Dispatch Logic:**

```typescript
// tool-dispatcher handles routing
switch (action) {
  case 'pin':    return coreMemory.pin(entry_id);
  case 'unpin':  return coreMemory.unpin(entry_id);
  case 'list':   return coreMemory.listPinned();
  case 'reorder': return coreMemory.reorder(entry_id, order);
  case 'get_context': return coreMemory.getContext();
  case 'budget': return coreMemory.getBudgetStatus();
}
```

**Error Responses:**

| Condition | Error Message | HTTP-equiv |
|-----------|--------------|------------|
| entry_id not found | "Entry {id} not found" | 404 |
| Budget exceeded | "Token budget exceeded. Current: {n}/2000. Entry requires {m} tokens." | 422 |
| Max pins reached | "Maximum pinned entries (10) reached. Unpin an entry first." | 422 |
| Already pinned | "Entry {id} is already pinned" | 409 |

---

### 3.3 Tool: mem_conversation

**Implements:** UC-04, UC-05, UC-06 | **BR:** BR-F2-01 through BR-F2-05

**Input Schema:**

```json
{
  "type": "object",
  "required": ["action"],
  "properties": {
    "action": { "type": "string", "enum": ["save_turn", "get_session", "list_sessions", "search", "summarize"] },
    "session_id": { "type": "string", "description": "Required for save_turn/get_session/summarize" },
    "role": { "type": "string", "enum": ["user", "assistant", "system", "tool"] },
    "content": { "type": "string", "maxLength": 50000 },
    "tool_calls": { "type": "string", "description": "JSON array of tool calls" },
    "query": { "type": "string", "description": "Required for search" },
    "limit": { "type": "integer", "default": 20, "minimum": 1, "maximum": 100 }
  }
}
```

**Dispatch Logic:**

```typescript
switch (action) {
  case 'save_turn':    return conversationRepo.saveTurn(session_id, role, content, tool_calls);
  case 'get_session':  return conversationRepo.getSession(session_id, limit);
  case 'list_sessions': return conversationRepo.listSessions(limit);
  case 'search':       return conversationRepo.searchTurns(query, limit);
  case 'summarize':    return conversationSummarizer.summarize(session_id);
}
```

**Error Responses:**

| Condition | Error Message |
|-----------|--------------|
| Invalid role | "Invalid role. Must be: user, assistant, system, tool" |
| Empty content | "Content cannot be empty" |
| Session not found | "Session '{id}' not found" |
| Invalid tool_calls JSON | "tool_calls must be a valid JSON array" |

---

### 3.4 Tool: mem_map

**Implements:** UC-07, UC-08, UC-09 | **BR:** BR-F3-01 through BR-F3-05

**Input Schema:**

```json
{
  "type": "object",
  "required": ["action"],
  "properties": {
    "action": { "type": "string", "enum": ["get", "update", "search_entity", "search_topic", "reextract"] },
    "entry_id": { "type": "integer", "description": "Required for get/update/reextract" },
    "entity": { "type": "string", "description": "Required for search_entity" },
    "topic": { "type": "string", "description": "Required for search_topic" },
    "map": { "type": "object", "description": "Partial map to merge (for update)" },
    "limit": { "type": "integer", "default": 10, "minimum": 1, "maximum": 50 }
  }
}
```

**Dispatch Logic:**

```typescript
switch (action) {
  case 'get':           return mapService.getMap(entry_id);
  case 'update':        return mapService.updateMap(entry_id, map);
  case 'search_entity': return entityRepo.findByEntity(entity, limit);
  case 'search_topic':  return mapService.searchByTopic(topic, limit);
  case 'reextract':     return mapService.reextract(entry_id);
}
```

---

### 3.5 Enhanced Tool: mem_search

**New Parameters (additive):**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| agent_scope | string | null | Agent role for tag-based filtering (QA, DEV, BA, SA, DevOps) |
| max_tokens | integer | 2000 | Token budget for results |

**Enhanced Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| tokens_used | integer | Actual tokens consumed |
| tokens_budget | integer | Budget applied |
| results_truncated | boolean | Whether budget limiting was applied |
| expiry_actions | array | Auto-expiry actions taken during this search |

**Implementation Flow:**

```typescript
async function enhancedSearch(params: EnhancedSearchParams): SearchResponse {
  // 1. Lazy auto-expiry (F4)
  const expiryActions = workingTierExpiry.processStale();
  
  // 2. Load pinned context (F1)
  const pinnedContext = coreMemory.getContext();
  
  // 3. Execute hybrid search (existing)
  let results = hybridSearch.search(params);
  
  // 4. Apply agent scope filter (F4)
  if (params.agent_scope) {
    results = agentScopeFilter.filter(results, params.agent_scope);
  }
  
  // 5. Apply token budget (F4)
  const { limited, tokensUsed } = tokenBudget.apply(results, params.max_tokens ?? 2000);
  
  // 6. Prepend pinned entries (F1)
  return { pinnedContext, results: limited, tokens_used: tokensUsed, expiry_actions: expiryActions };
}
```

---

### 3.6 Enhanced Tool: mem_ingest

**New Behavior (quality gate + auto-extract):**

```typescript
async function enhancedIngest(params: IngestParams): IngestResponse {
  // 1. Quality Gate (F4) — validate before storing
  const quality = qualityGate.validate(params.content, params);
  if (quality.decision === 'reject') {
    return { error: quality.message, quality_score: quality.score };
  }
  
  // 2. Store entry (existing pipeline)
  const entry = await knowledgeRepo.create(params);
  
  // 3. Extract structured map (F3)
  const structuredMap = extractStructuredMap(entry.content);
  await knowledgeRepo.updateStructuredMap(entry.id, structuredMap);
  
  // 4. Index entities (F3)
  const entities = classifyEntities(structuredMap.entities_mentioned);
  entityRepo.indexEntities(entry.id, entities);
  
  // 5. Return enriched response
  return { ...entry, quality_score: quality.score, structured_map: structuredMap };
}
```

---

## 4. Database Design

### 4.1 Schema Overview

![Database Schema](diagrams/db-schema.png)

The upgrade extends the existing `knowledge_entries` table with 5 new columns and creates 3 new tables. All changes are additive-only (no DROP, no ALTER existing columns).

### 4.2 DDL Scripts

#### Migration 1: Core Memory Columns (F1)

```sql
-- V3.1: Add pinned entries support
ALTER TABLE knowledge_entries ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_entries ADD COLUMN pin_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ke_pinned ON knowledge_entries(pinned, pin_order);
```

#### Migration 2: Structured Map Column (F3)

```sql
-- V3.2: Add structured map metadata
ALTER TABLE knowledge_entries ADD COLUMN structured_map TEXT NOT NULL DEFAULT '{}';
```

#### Migration 3: Quality & Archive Columns (F4)

```sql
-- V3.3: Add quality score and archive flag
ALTER TABLE knowledge_entries ADD COLUMN quality_score INTEGER DEFAULT NULL;
ALTER TABLE knowledge_entries ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ke_archived ON knowledge_entries(archived);
CREATE INDEX IF NOT EXISTS idx_ke_quality ON knowledge_entries(quality_score);
CREATE INDEX IF NOT EXISTS idx_ke_tier_archived ON knowledge_entries(tier, archived, created_at);
```

#### Migration 4: Conversation Turns Table (F2)

```sql
-- V3.4: Structured conversation history
CREATE TABLE IF NOT EXISTS conversation_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
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
```

#### Migration 5: Entity Index Table (F3)

```sql
-- V3.5: Entity extraction index
CREATE TABLE IF NOT EXISTS entity_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('ticket', 'person', 'system', 'file', 'url', 'concept')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ei_name ON entity_index(entity_name);
CREATE INDEX IF NOT EXISTS idx_ei_type ON entity_index(entity_type);
CREATE INDEX IF NOT EXISTS idx_ei_entry ON entity_index(entry_id);
```

#### Migration 6: Agent Scope Config Table (F4)

```sql
-- V3.6: Agent-level KB isolation configuration
CREATE TABLE IF NOT EXISTS agent_scope_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_role TEXT NOT NULL UNIQUE,
  tag_set TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default scope mappings
INSERT OR IGNORE INTO agent_scope_config (agent_role, tag_set) VALUES
  ('QA', '["testing","qa","test-plan","test-case","bug"]'),
  ('DEV', '["code","api","architecture","implementation","design"]'),
  ('BA', '["requirement","business","stakeholder","process"]'),
  ('SA', '["architecture","design","infrastructure","security"]'),
  ('DevOps', '["deployment","infrastructure","ci-cd","monitoring"]');
```

#### Migration 7: FTS5 on Entity Index (F3)

```sql
-- V3.7: Full-text search on entity names
CREATE VIRTUAL TABLE IF NOT EXISTS entity_index_fts USING fts5(
  entity_name,
  content='entity_index',
  content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS entity_index_ai AFTER INSERT ON entity_index BEGIN
  INSERT INTO entity_index_fts(rowid, entity_name) VALUES (new.id, new.entity_name);
END;

CREATE TRIGGER IF NOT EXISTS entity_index_ad AFTER DELETE ON entity_index BEGIN
  INSERT INTO entity_index_fts(entity_index_fts, rowid, entity_name) VALUES ('delete', old.id, old.entity_name);
END;
```

#### Migration 8: Conversation Turns Index (F2)

```sql
-- V3.8: Composite index for session + time queries
CREATE INDEX IF NOT EXISTS idx_ct_session_time ON conversation_turns(session_id, created_at);
```

### 4.3 Migration Plan

| Order | Script | Tables Affected | Estimated Time | Rollback |
|-------|--------|-----------------|----------------|----------|
| 1 | V3.1 Core Memory | knowledge_entries (ALTER) | <1s | DROP COLUMN (SQLite 3.35+) |
| 2 | V3.2 Structured Map | knowledge_entries (ALTER) | <1s | DROP COLUMN |
| 3 | V3.3 Quality/Archive | knowledge_entries (ALTER) | <1s | DROP COLUMN |
| 4 | V3.4 Conversation | conversation_turns (CREATE) | <1s | DROP TABLE |
| 5 | V3.5 Entity Index | entity_index (CREATE) | <1s | DROP TABLE |
| 6 | V3.6 Agent Scope | agent_scope_config (CREATE) | <1s | DROP TABLE |
| 7 | V3.7 Entity FTS | entity_index_fts (CREATE) | <1s | DROP TABLE |
| 8 | V3.8 Conv Index | conversation_turns (INDEX) | <1s | DROP INDEX |

**Execution strategy:** All migrations run sequentially on first startup. Each migration is idempotent (IF NOT EXISTS / OR IGNORE). Migration state tracked in `schema_version` table.

### 4.4 Query Patterns

| Operation | Query Pattern | Expected Performance |
|-----------|--------------|---------------------|
| Get pinned entries | `SELECT ... WHERE pinned=1 ORDER BY pin_order` | <5ms (indexed) |
| Get session turns | `SELECT ... WHERE session_id=? ORDER BY turn_number` | <10ms (indexed) |
| Search by entity | `SELECT ... FROM entity_index WHERE entity_name LIKE ?` | <50ms |
| WORKING tier expiry | `SELECT ... WHERE tier='WORKING' AND archived=0 AND created_at < ?` | <20ms (indexed) |
| Quality duplicate check | Vector similarity search (existing) | <100ms |
| Agent scope filter | `JOIN tags WHERE tag IN (?)` | <10ms (post-filter) |

---

## 5. Class / Module Design

### 5.1 Package Structure

```
src/memory/
├── core-memory.ts              # [EXISTING] CoreMemoryManager — pin/unpin/budget
├── conversation-repo.ts        # [EXISTING] ConversationRepository — CRUD turns
├── conversation-summarizer.ts  # [EXISTING] ConversationSummarizer — auto-summarize
├── structured-map-extractor.ts # [EXISTING] extractStructuredMap() — rule-based
├── structured-map.ts           # [EXISTING] StructuredMap interface + empty factory
├── entity-repo.ts              # [EXISTING] EntityRepository — entity_index CRUD
├── entity-classifier.ts        # [EXISTING] classifyEntity() — pattern → type
├── token-counter.ts            # [EXISTING] countTokens(), truncateToFit()
├── role-filter.ts              # [EXISTING] typesForRole() — role → type filter
├── hybrid-search.ts            # [MODIFY] HybridSearch — add scope + budget
├── ingest-pipeline.ts          # [MODIFY] IngestPipeline — add quality gate + map
├── v2/
│   ├── quality-gate.ts         # [NEW] QualityGate — validate before ingest
│   ├── agent-scope-filter.ts   # [NEW] AgentScopeFilter — tag-based filtering
│   ├── working-tier-expiry.ts  # [NEW] WorkingTierExpiry — lazy auto-expiry
│   ├── token-budget.ts         # [NEW] TokenBudget — cap search results
│   └── backfill-script.ts      # [NEW] Backfill existing entries with maps
├── tool-defs-tier1.ts          # [MODIFY] Add mem_pin, mem_conversation, mem_map
├── tool-dispatcher.ts          # [MODIFY] Route new tools
├── schema-v3.ts                # [EXISTING] Migration DDL constants
├── migrations-v3.ts            # [MODIFY] Execute V3 migrations
└── models.ts                   # [MODIFY] Add new interfaces
```

### 5.2 Key Interfaces

```typescript
// === NEW: v2/quality-gate.ts ===
export interface QualityResult {
  score: number;          // 0-100
  decision: 'accept' | 'warn' | 'reject';
  message: string | null;
  duplicate_detected: boolean;
  duplicate_entry_id: number | null;
}

export interface IngestMeta {
  tags?: string;
  type?: string;
  source?: string;
}

export class QualityGate {
  constructor(private readonly db: Database.Database, private readonly vectorRepo: VectorRepository);
  validate(content: string, meta: IngestMeta): QualityResult;
  private calculateScore(content: string, meta: IngestMeta): number;
  private checkDuplicate(content: string): { similarity: number; entryId: number | null };
}
```

```typescript
// === NEW: v2/agent-scope-filter.ts ===
export interface AgentScope {
  role: string;
  tags: string[];
}

export class AgentScopeFilter {
  constructor(private readonly db: Database.Database);
  getScope(agentRole: string): AgentScope | null;
  filter(results: SearchResult[], agentRole: string): SearchResult[];
  updateScope(agentRole: string, tags: string[]): void;
}
```

```typescript
// === NEW: v2/working-tier-expiry.ts ===
export interface ExpiryAction {
  entry_id: number;
  action: 'promoted' | 'archived';
  quality_score: number;
  to_tier?: string;
}

export class WorkingTierExpiry {
  constructor(private readonly db: Database.Database, private readonly expiryHours: number = 24);
  processStale(): ExpiryAction[];
  private getStaleEntries(): Array<{ id: number; quality_score: number | null }>;
}
```

```typescript
// === NEW: v2/token-budget.ts ===
export interface BudgetResult {
  results: SearchResult[];
  tokensUsed: number;
  truncated: boolean;
  totalMatches: number;
}

export class TokenBudget {
  apply(results: SearchResult[], maxTokens: number): BudgetResult;
  private truncateResult(result: SearchResult, remainingTokens: number): SearchResult;
}
```

```typescript
// === MODIFIED: hybrid-search.ts ===
export interface EnhancedSearchParams extends SearchParams {
  agent_scope?: string;   // NEW: agent role for tag filtering
  max_tokens?: number;    // NEW: token budget (default 2000)
}

export interface EnhancedSearchResponse {
  pinnedContext: string;
  results: SearchResult[];
  tokens_used: number;
  tokens_budget: number;
  results_truncated: boolean;
  expiry_actions: ExpiryAction[];
}
```

```typescript
// === MODIFIED: models.ts — new interfaces ===
export interface ConversationTurn {
  id: number;
  session_id: string;
  turn_number: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls: string | null;
  metadata: string | null;
  summarized: boolean;
  created_at: string;
}

export interface StructuredMap {
  topic: string;
  entities_mentioned: string[];
  decisions_made: string[];
  action_items: string[];
  context_refs: string[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
}

export interface EntityRecord {
  id: number;
  entry_id: number;
  entity_name: string;
  entity_type: 'ticket' | 'person' | 'system' | 'file' | 'url' | 'concept';
}
```

### 5.3 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Repository | ConversationRepo, EntityRepo, KnowledgeRepo | Encapsulate SQL, testable |
| Pipeline | IngestPipeline (quality → store → extract → index) | Sequential processing with early exit |
| Strategy | AgentScopeFilter (configurable tag sets) | Different filtering per role |
| Observer/Lazy | WorkingTierExpiry (triggered on search) | No background threads needed |
| Facade | ToolDispatcher (routes actions to services) | Single entry point per tool |
| Builder | QualityGate.calculateScore (additive scoring) | Composable quality factors |

### 5.4 Error Handling

| Exception/Error | Trigger | Response | Recovery |
|----------------|---------|----------|----------|
| EntryNotFound | pin/unpin/reorder non-existent ID | Return error message string | Agent retries with valid ID |
| BudgetExceeded | Pin would exceed 2000 tokens | Return error with current/needed | Agent unpins something first |
| MaxPinsReached | Already 10 pinned entries | Return error message | Agent unpins first |
| QualityRejected | Content score < 30 | Return error + score + suggestions | Agent improves content |
| DuplicateDetected | Cosine similarity > 0.95 | Return error + existing entry ID | Agent merges or skips |
| InvalidRole | save_turn with bad role | Return error listing valid roles | Agent fixes role |
| EmptyContent | save_turn with empty content | Return error message | Agent provides content |
| MigrationFailed | DDL execution error | Log + throw (server won't start) | Admin investigates |

---

## 6. Integration Design

### 6.1 Internal Integration: Existing MCP Tools

All 14 existing tools continue working unchanged. The integration points are:

| Existing Tool | Integration Point | Change Type |
|---------------|------------------|-------------|
| mem_search | Prepend pinned + scope filter + token budget + expiry | Behavioral (additive) |
| mem_ingest | Quality gate + auto-extract structured map | Behavioral (additive) |
| mem_crud | Include pinned/structured_map/quality_score in responses | Response enrichment |
| mem_consolidate | Preserve pin state on merge, re-extract map | Logic extension |
| mem_lifecycle | Pin exemption from expiry | Filter addition |
| mem_scoring | Quality score as source | Data source |

### 6.2 Integration Sequence: mem_search with All Features

![Sequence Diagram](diagrams/sequence-search-enhanced.png)

```
Agent → ToolDispatcher: mem_search(query, agent_scope, max_tokens)
ToolDispatcher → WorkingTierExpiry: processStale()
WorkingTierExpiry → DB: SELECT stale WORKING entries
WorkingTierExpiry → DB: UPDATE tier/archived
WorkingTierExpiry → ToolDispatcher: ExpiryAction[]
ToolDispatcher → CoreMemoryManager: getContext()
CoreMemoryManager → DB: SELECT pinned entries
CoreMemoryManager → ToolDispatcher: formatted context string
ToolDispatcher → HybridSearch: search(query, limit, role)
HybridSearch → DB: FTS5 search + graph boost
HybridSearch → ToolDispatcher: SearchResult[]
ToolDispatcher → AgentScopeFilter: filter(results, agent_scope)
AgentScopeFilter → DB: SELECT tag_set FROM agent_scope_config
AgentScopeFilter → ToolDispatcher: filtered results
ToolDispatcher → TokenBudget: apply(results, max_tokens)
TokenBudget → ToolDispatcher: BudgetResult
ToolDispatcher → Agent: { pinnedContext, results, tokens_used, expiry_actions }
```

### 6.3 Integration Sequence: mem_ingest with Quality Gate

![Sequence Diagram](diagrams/sequence-ingest-enhanced.png)

```
Agent → ToolDispatcher: mem_ingest(content, tags, source, type)
ToolDispatcher → QualityGate: validate(content, meta)
QualityGate → QualityGate: calculateScore(content, meta)
QualityGate → VectorRepo: findSimilar(content, top_k=5)
VectorRepo → QualityGate: similarity scores
QualityGate → ToolDispatcher: QualityResult {score, decision}
  [if reject] → ToolDispatcher → Agent: error response
ToolDispatcher → KnowledgeRepo: create(entry)
KnowledgeRepo → DB: INSERT INTO knowledge_entries
KnowledgeRepo → ToolDispatcher: entry with ID
ToolDispatcher → StructuredMapExtractor: extractStructuredMap(content)
StructuredMapExtractor → ToolDispatcher: StructuredMap
ToolDispatcher → DB: UPDATE structured_map WHERE id=?
ToolDispatcher → EntityClassifier: classifyEntities(entities_mentioned)
EntityClassifier → ToolDispatcher: classified entities
ToolDispatcher → EntityRepo: indexEntities(entry_id, entities)
EntityRepo → DB: INSERT INTO entity_index
ToolDispatcher → Agent: { entry, quality_score, structured_map }
```

---

## 7. Security Design

### 7.1 Authentication & Authorization

The MCP server runs locally via stdio — no network authentication required. Authorization is handled via agent_scope (tag-based filtering):

| Agent Role | Visible Tags | Invisible Tags |
|-----------|-------------|----------------|
| QA | testing, qa, test-plan, test-case, bug | code, deployment, business |
| DEV | code, api, architecture, implementation, design | testing, deployment |
| BA | requirement, business, stakeholder, process | code, testing, deployment |
| SA | architecture, design, infrastructure, security | testing, business |
| DevOps | deployment, infrastructure, ci-cd, monitoring | testing, business, code |
| (no scope) | ALL tags visible | None |

**Note:** Untagged entries are visible to ALL agents regardless of scope (backward compatible).

### 7.2 Data Protection

| Data Type | At Rest | In Transit | In Logs |
|-----------|---------|------------|---------|
| Knowledge content | Plain (SQLite file) | N/A (local stdio) | Truncated (first 100 chars) |
| Conversation turns | Plain (SQLite) | N/A | Session ID only |
| Entity index | Plain (SQLite) | N/A | Entity name only |
| Quality scores | Plain (SQLite) | N/A | Score value only |

### 7.3 Input Validation

| Field | Validation | Sanitization |
|-------|-----------|--------------|
| content (ingest) | ≥50 chars, ≤100KB | Trim whitespace |
| role (conversation) | enum: user/assistant/system/tool | Lowercase |
| action (all tools) | enum per tool | Exact match |
| entry_id | Integer > 0, exists in DB | parseInt |
| session_id | Non-empty string, ≤255 chars | Trim |
| tool_calls | Valid JSON array or null | JSON.parse validation |
| agent_scope | Known role or null | Uppercase lookup |
| max_tokens | Integer 100-10000 | Clamp to range |

---

## 8. Performance & Scalability

### 8.1 Performance Targets

| Operation | Target | Measurement Method |
|-----------|--------|-------------------|
| Pin retrieval (getContext) | <50ms | Benchmark: 10 pinned entries, 2000 tokens |
| Conversation query (getSession) | <100ms | Benchmark: session with 100 turns |
| Entity search | <100ms | Benchmark: 1000+ entries in entity_index |
| Structured map extraction | <200ms | Benchmark: 5000-char content |
| Quality gate validation | <50ms | Benchmark: including duplicate check |
| Token counting | <1ms | Benchmark: 10KB content |
| Agent scope filter | <10ms | Benchmark: 50 results, 5 tags |
| WORKING tier expiry | <100ms | Benchmark: 100 stale entries |

### 8.2 Caching Strategy

| Cache | What | TTL | Eviction | Technology |
|-------|------|-----|----------|------------|
| Agent scope config | tag_set per role | Session lifetime | On config update | In-memory Map |
| Pinned entries | Formatted context string | Until pin/unpin | On mutation | Instance variable |
| Entity patterns | Compiled RegExp | Permanent | Never | Module-level const |

### 8.3 Connection Pooling

| Resource | Strategy | Notes |
|----------|----------|-------|
| SQLite | Single connection (better-sqlite3) | Synchronous API, no pool needed |
| ONNX Runtime | Single instance | Loaded once at startup |

### 8.4 Optimization Notes

- **Prepared statements** — all SQL queries use `db.prepare()` (compiled once, reused)
- **Batch inserts** — entity indexing uses transaction for multiple INSERT
- **Lazy expiry** — no background timer, runs only when search is called
- **Early exit** — quality gate rejects before expensive operations (embedding, storage)
- **Index coverage** — all WHERE clauses have supporting indexes

---

## 9. Monitoring & Observability

### 9.1 Logging

| Log Event | Level | Fields | Destination |
|-----------|-------|--------|-------------|
| Pin/Unpin operation | INFO | entry_id, action, budget_state | Console + audit_trail |
| Quality rejection | WARN | content_hash, score, reason | Console + audit_trail |
| Auto-expiry action | INFO | entry_id, action, quality_score | audit_trail |
| Migration executed | INFO | migration_name, duration_ms | Console |
| Migration failed | ERROR | migration_name, error_message | Console |
| Duplicate detected | WARN | entry_id, similarity, existing_id | Console + audit_trail |
| Agent scope applied | DEBUG | agent_role, results_before, results_after | audit_trail |
| Token budget applied | DEBUG | tokens_used, tokens_budget, truncated | audit_trail |

### 9.2 Metrics (via mem_admin tool)

| Metric | Type | Description |
|--------|------|-------------|
| pinned_entries_count | Gauge | Current number of pinned entries |
| pinned_tokens_used | Gauge | Current token budget usage |
| quality_rejections_total | Counter | Total ingest rejections |
| quality_score_avg | Gauge | Average quality score of recent ingests |
| expiry_promotions_total | Counter | Total WORKING→EPISODIC promotions |
| expiry_archives_total | Counter | Total WORKING archives |
| conversation_turns_total | Counter | Total conversation turns stored |
| entity_index_size | Gauge | Total entities indexed |
| search_tokens_avg | Gauge | Average tokens per search response |

### 9.3 Audit Trail

All significant operations are recorded in the existing `audit_trail` table:

```sql
INSERT INTO audit_trail (operation, entry_id, session_id, details, created_at)
VALUES (?, ?, ?, ?, datetime('now'));
```

Operations logged: `PIN`, `UNPIN`, `QUALITY_REJECT`, `QUALITY_WARN`, `EXPIRY_PROMOTE`, `EXPIRY_ARCHIVE`, `SCOPE_FILTER`, `DUPLICATE_DETECT`.

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Module | Test File | Key Scenarios |
|--------|-----------|---------------|
| CoreMemoryManager | core-memory.test.ts | Pin/unpin/budget/reorder/getContext |
| QualityGate | quality-gate.test.ts | Score calculation, reject/warn/accept, duplicates |
| AgentScopeFilter | agent-scope-filter.test.ts | Filter by role, untagged visible, unknown role |
| WorkingTierExpiry | working-tier-expiry.test.ts | Promote/archive/pin-exempt |
| TokenBudget | token-budget.test.ts | Limit results, truncate, single-result-over-budget |
| ConversationRepo | conversation-repo.test.ts | Save/get/list/search turns |
| ConversationSummarizer | conversation-summarizer.test.ts | Summarize session, mark turns |
| StructuredMapExtractor | structured-map-extractor.test.ts | Extract entities/decisions/actions |
| EntityRepo | entity-repo.test.ts | Index/find/search entities |

### 10.2 Integration Tests

| Test | Description | Dependencies |
|------|-------------|-------------|
| Full search pipeline | Search with pins + scope + budget + expiry | SQLite in-memory |
| Full ingest pipeline | Ingest with quality gate + map extraction + entity index | SQLite in-memory |
| Migration idempotency | Run all migrations twice, verify no errors | SQLite temp file |
| Backfill script | Process 100 entries, verify maps + entities | SQLite temp file |
| Cross-feature: pin + expiry | Pinned WORKING entry not expired | SQLite in-memory |

### 10.3 Coverage Target

- **≥80% line coverage** on all new code
- **100% coverage** on critical paths: quality gate decisions, token budget, pin operations
- **Regression tests** for all 14 existing tools (verify no behavioral changes)

---

## 11. Deployment Considerations

### 11.1 Environment Configuration

| Property | Default | Description |
|----------|---------|-------------|
| CORE_MEMORY_MAX_TOKENS | 2000 | Pin budget limit |
| CORE_MEMORY_WARNING_THRESHOLD | 1800 | Warning at 90% |
| CORE_MEMORY_MAX_PINNED | 10 | Max pinned entries |
| QUALITY_GATE_MIN_LENGTH | 50 | Minimum content chars |
| QUALITY_GATE_REJECT_THRESHOLD | 30 | Auto-reject below this score |
| QUALITY_GATE_WARN_THRESHOLD | 50 | Warning below this score |
| QUALITY_GATE_DUPLICATE_THRESHOLD | 0.95 | Cosine similarity for duplicate |
| WORKING_EXPIRY_HOURS | 24 | Hours before WORKING entries expire |
| WORKING_EXPIRY_PROMOTE_THRESHOLD | 60 | Quality score for promotion |
| SEARCH_DEFAULT_MAX_TOKENS | 2000 | Default token budget for search |
| CONVERSATION_MAX_CONTENT_LENGTH | 50000 | Max chars per turn |

### 11.2 Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| ENABLE_QUALITY_GATE | true | Enable/disable ingest quality validation |
| ENABLE_AUTO_EXPIRY | true | Enable/disable WORKING tier auto-expiry |
| ENABLE_AGENT_SCOPE | true | Enable/disable tag-based filtering |
| ENABLE_AUTO_EXTRACT_MAP | true | Enable/disable structured map extraction on ingest |
| ENABLE_SEARCH_TOKEN_BUDGET | true | Enable/disable token budget on search |

### 11.3 Rollback Strategy

1. **Schema rollback** — All migrations are additive. To rollback:
   - New columns: `ALTER TABLE ... DROP COLUMN` (SQLite 3.35+)
   - New tables: `DROP TABLE IF EXISTS`
   - New indexes: `DROP INDEX IF EXISTS`
2. **Code rollback** — Revert to previous git commit. New columns/tables are ignored by old code (nullable/default values).
3. **Data preservation** — No data is lost on rollback. New columns simply become unused.

### 11.4 Upgrade Path

1. Pull new code (v0.6.0)
2. Start server — migrations auto-run on first startup
3. Verify: `mem_admin(action: "status")` shows new tables
4. Optional: Run backfill script for existing entries: `node scripts/backfill-structured-maps.js`
5. Verify: `mem_map(action: "search_entity", entity: "KSA-110")` returns results

---

## 12. Implementation Checklist

### Files to Create

| # | File | Description | Priority |
|---|------|-------------|----------|
| 1 | src/memory/v2/quality-gate.ts | Ingest quality validation | High |
| 2 | src/memory/v2/agent-scope-filter.ts | Tag-based KB isolation | High |
| 3 | src/memory/v2/working-tier-expiry.ts | Lazy auto-expiry | Medium |
| 4 | src/memory/v2/token-budget.ts | Search result token limiting | High |
| 5 | src/memory/v2/backfill-script.ts | Backfill structured maps | Low |
| 6 | src/memory/tests/quality-gate.test.ts | Unit tests | High |
| 7 | src/memory/tests/agent-scope-filter.test.ts | Unit tests | High |
| 8 | src/memory/tests/working-tier-expiry.test.ts | Unit tests | Medium |
| 9 | src/memory/tests/token-budget.test.ts | Unit tests | High |
| 10 | src/memory/tests/integration-v3.test.ts | Integration tests | High |

### Files to Modify

| # | File | Changes | Priority |
|---|------|---------|----------|
| 1 | src/memory/hybrid-search.ts | Add scope filter + token budget + expiry trigger | High |
| 2 | src/memory/ingest-pipeline.ts | Add quality gate + auto-extract map | High |
| 3 | src/memory/tool-defs-tier1.ts | Add mem_pin, mem_conversation, mem_map definitions | High |
| 4 | src/memory/tool-dispatcher.ts | Route new tool actions | High |
| 5 | src/memory/migrations-v3.ts | Add V3.3-V3.8 migrations | High |
| 6 | src/memory/models.ts | Add new interfaces | Medium |
| 7 | src/memory/schema-v3.ts | Add new DDL constants | Medium |
| 8 | package.json | Bump version to 0.6.0 | Low |

### Implementation Order

| Phase | Files | Dependencies | Estimated Effort |
|-------|-------|-------------|-----------------|
| 1. Schema | schema-v3.ts, migrations-v3.ts | None | 2h |
| 2. Core Memory | core-memory.ts (already exists), tool-defs | Schema | 1h (wire up) |
| 3. Conversation | conversation-repo.ts (exists), summarizer | Schema | 2h (summarizer) |
| 4. Structured Map | extractor (exists), entity-repo (exists) | Schema | 1h (wire up) |
| 5. Quality Gate | v2/quality-gate.ts | Vector repo | 3h |
| 6. Agent Scope | v2/agent-scope-filter.ts | Schema (agent_scope_config) | 2h |
| 7. Token Budget | v2/token-budget.ts | Token counter | 1h |
| 8. Working Expiry | v2/working-tier-expiry.ts | Schema (quality_score, archived) | 2h |
| 9. Integration | hybrid-search.ts, ingest-pipeline.ts | All above | 4h |
| 10. Tests | All test files | All above | 6h |
| 11. Backfill | v2/backfill-script.ts | Extractor + entity repo | 2h |

**Total estimated: ~26 hours**

---

## 13. Appendix

### Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — JSON-RPC over stdio for AI agent tools |
| Pinned Entry | Knowledge entry marked for automatic context injection |
| Structured Map | JSON metadata extracted from content (entities, decisions, etc.) |
| Quality Gate | Validation step before ingest (length, duplicates, score) |
| Agent Scope | Tag-based filtering per agent role |
| Token Budget | Maximum tokens allowed in search results |
| Auto-Expiry | Lazy promotion/archive of stale WORKING tier entries |
| RRF | Reciprocal Rank Fusion — score combination method |
| FTS5 | SQLite Full-Text Search extension v5 |

### Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Should quality gate check run on mem_ingest_file too? | Resolved | Yes — same pipeline |
| 2 | Should pinned entries bypass agent_scope filter? | Resolved | Yes — pins always visible |
| 3 | Should conversation summarization be automatic or manual? | Resolved | Both — auto on threshold + manual via action |
| 4 | Should backfill run automatically on upgrade? | Resolved | No — manual script, can be slow on large DBs |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
| 3 | Database Schema | [db-schema.png](diagrams/db-schema.png) | [db-schema.drawio](diagrams/db-schema.drawio) |
| 4 | Search Enhanced Sequence | [sequence-search-enhanced.png](diagrams/sequence-search-enhanced.png) | [sequence-search-enhanced.drawio](diagrams/sequence-search-enhanced.drawio) |
| 5 | Ingest Enhanced Sequence | [sequence-ingest-enhanced.png](diagrams/sequence-ingest-enhanced.png) | [sequence-ingest-enhanced.drawio](diagrams/sequence-ingest-enhanced.drawio) |
| 6 | Class Diagram | [class-diagram.png](diagrams/class-diagram.png) | [class-diagram.drawio](diagrams/class-diagram.drawio) |

# User Guide — KB Contradiction Resolution

## KSA-248: ContradictionResolver

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-248 |
| Version | 1.0 |
| Date | 2026-06-09 |
| Platforms | NodeJS, Python, Kotlin/MCP, Kotlin/SDLC-Memory |
| Related BRD | BRD-v1-KSA-248.docx |
| Related FSD | FSD-v1-KSA-248.docx |
| Related TDD | TDD-v1-KSA-248.docx |

---

## 1. Overview

The ContradictionResolver automatically detects and resolves conflicting or outdated information in the Knowledge Base. When new information is ingested that contradicts existing entries, the system marks old entries as superseded so AI agents never receive conflicting context.

### Key Capabilities

- **Automatic detection on ingest** — keyword-based signal detection (Vietnamese + English)
- **Search result filtering** — superseded entries excluded from search results
- **Optional LLM consolidation** — advanced contradiction detection via LLM (off by default)
- **Manual supersession API** — admin can explicitly mark entries as superseded
- **Revalidation** — undo wrongly-superseded entries
- **Diagnostics** — stats on KB health (active vs superseded counts)

### Three Resolution Strategies

| # | Strategy | Default | Description |
|---|----------|---------|-------------|
| 1 | Metadata/Status Marking | ON | Sets `validity_status='SUPERSEDED'` on old entries |
| 2 | LLM Consolidation | OFF | Calls LLM to identify outdated entries in search results |
| 3 | Graph SUPERSEDES Edges | ON | Creates directed SUPERSEDES edges in knowledge graph |

---

## 2. Installation and Quick Start

### 2.1 Prerequisites

- Existing Knowledge Base with `knowledge_entries` table (SQLite)
- `knowledge_graph_edges` table for graph relationships
- `entity_index` table for entity extraction
- `knowledge_fts` virtual table (FTS5)

### 2.2 Database Schema Setup

The resolver automatically adds required columns on first instantiation. No manual migration needed. If you prefer explicit migration:

```sql
ALTER TABLE knowledge_entries ADD COLUMN validity_status TEXT DEFAULT 'ACTIVE';
ALTER TABLE knowledge_entries ADD COLUMN superseded_by INTEGER DEFAULT NULL;
ALTER TABLE knowledge_entries ADD COLUMN superseded_at TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_ke_validity ON knowledge_entries(validity_status);
```

### 2.3 Quick Start — NodeJS (TypeScript)

```typescript
import { ContradictionResolver } from './memory/contradiction-resolver.js';
import type { GraphRepository } from './memory/graph-repo.js';

// Initialize with database and graph repository
const resolver = new ContradictionResolver(db, graphRepo, {
  enableStatusMarking: true,
  enableGraphSupersedes: true,
  enableLlmConsolidation: false,
});

// On ingest: detect and resolve contradictions
const result = resolver.detectAndResolve(newEntryId);
console.log(`Resolved: ${result.resolved}, Superseded: ${result.supersededEntries}`);

// On search: filter superseded entries from results
const filtered = resolver.filterSuperseded(searchResults);
```

### 2.4 Quick Start — Python

```python
from mcp_code_intel.memory.contradiction_resolver import (
    ContradictionResolver, ContradictionConfig
)

# Initialize
config = ContradictionConfig(
    enable_status_marking=True,
    enable_graph_supersedes=True,
    enable_llm_consolidation=False,
)
resolver = ContradictionResolver(conn=db_connection, config=config)

# On ingest
result = resolver.detect_and_resolve(new_entry_id)

# On search
filtered = resolver.filter_superseded(search_results)
```

### 2.5 Quick Start — Kotlin (MCP / SDLC-Memory)

```kotlin
import com.codeintel.memory.contradiction.ContradictionResolver
import com.codeintel.memory.contradiction.ContradictionConfig

// Initialize
val config = ContradictionConfig(
    enableStatusMarking = true,
    enableGraphSupersedes = true,
    enableLlmConsolidation = false
)
val resolver = ContradictionResolver(connection, graphRepo, config)

// On ingest
val result = resolver.detectAndResolve(newEntryId)

// On search
val filtered = resolver.filterSuperseded(searchResults)
```

---

## 3. Configuration Reference

### 3.1 Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enableStatusMarking` | boolean | `true` | Enable Strategy 1: mark entries as SUPERSEDED |
| `enableLlmConsolidation` | boolean | `false` | Enable Strategy 2: LLM post-search consolidation |
| `enableGraphSupersedes` | boolean | `true` | Enable Strategy 3: SUPERSEDES graph edges |
| `entityOverlapThreshold` | float | `0.5` | Min overlap ratio for entity-based conflict detection |
| `llmEndpoint` | string/null | `null` | OpenAI-compatible API endpoint URL |
| `llmApiKey` | string/null | `null` | API key for LLM endpoint |
| `llmModel` | string/null | `null` | Model name (default: `gpt-4o-mini`) |

### 3.2 Strategy Auto-Disable Rules

- Strategy 2 (LLM) auto-disables if `llmEndpoint` is `null` or empty
- Setting `enableLlmConsolidation = true` without `llmEndpoint` has no effect

### 3.3 Runtime Configuration Update

All strategies can be toggled at runtime without restart:

**NodeJS:**
```typescript
resolver.updateConfig({ enableStatusMarking: false });
```

**Python:**
```python
resolver.update_config(enable_status_marking=False)
```

**Kotlin:**
```kotlin
resolver.updateConfig(ContradictionConfig(enableStatusMarking = false))
```

### 3.4 Minimal Configuration (recommended)

```typescript
// Default — Strategies 1+3 enabled, LLM disabled
const resolver = new ContradictionResolver(db, graphRepo);
```

### 3.5 Full Configuration (with LLM)

```typescript
const resolver = new ContradictionResolver(db, graphRepo, {
  enableStatusMarking: true,
  enableLlmConsolidation: true,
  enableGraphSupersedes: true,
  entityOverlapThreshold: 0.5,
  llmEndpoint: 'https://api.openai.com/v1/chat/completions',
  llmApiKey: process.env.OPENAI_API_KEY,
  llmModel: 'gpt-4o-mini',
});
```

---

## 4. API Reference

### 4.1 detectAndResolve(newEntryId)

Detects contradictions for a newly ingested entry and resolves them.

**When to call:** After every new entry is stored in `knowledge_entries`.

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `newEntryId` | number/int | ID of the newly ingested entry |

**Returns:** `ResolutionResult`

```typescript
{
  detected: ContradictionDetection[];  // All detections (even below threshold)
  resolved: number;                    // Count of entries actually resolved
  supersededEntries: number[];         // IDs of entries marked SUPERSEDED
  edgesCreated: number;                // Count of SUPERSEDES edges created
}
```

**Behavior:**

1. Reads new entry content
2. Scans for supersession signal keywords
3. If signal found, finds conflicting entries (entity overlap or FTS fallback)
4. Computes confidence score
5. If confidence >= 0.6, marks old entries SUPERSEDED + creates graph edges
6. Logs resolution to audit table

**Example:**

```typescript
const result = resolver.detectAndResolve(42);
if (result.resolved > 0) {
  console.log(`Superseded ${result.supersededEntries.length} entries`);
  console.log(`Signal: ${result.detected[0].signal}`);
  console.log(`Confidence: ${result.detected[0].confidence}`);
}
```

---

### 4.2 filterSuperseded(results)

Filters search results to exclude superseded entries.

**When to call:** After hybrid search retrieves raw Top-K results, before returning to caller.

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `results` | SearchResult[] | Raw search results from hybrid search |

**Returns:** Filtered array with superseded entries removed.

**Filtering logic:**

1. If Strategy 1 enabled: removes entries with `validity_status = 'SUPERSEDED'`
2. If Strategy 3 enabled: removes entries with incoming SUPERSEDES edge from an ACTIVE entry
3. Chain resolution: if superseding entry is itself SUPERSEDED, target is NOT filtered

**Example:**

```typescript
const rawResults = await hybridSearch(query, topK);
const filtered = resolver.filterSuperseded(rawResults);
// filtered only contains ACTIVE, non-superseded entries
```

---

### 4.3 consolidateWithLlm(results, query) — async

Optional LLM-powered consolidation for complex contradictions.

**When to call:** After `filterSuperseded`, before returning final results. Only effective if Strategy 2 enabled.

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `results` | SearchResult[] | Pre-filtered results |
| `query` | string | Original user query |

**Returns:** `LlmConsolidationResult` (NodeJS) or filtered list (Python/Kotlin)

**Graceful degradation:**

- No LLM endpoint configured: returns original results unchanged
- LLM timeout or error: returns original results unchanged
- LLM returns unparseable response: returns original results unchanged

---

### 4.4 manualSupersede(oldEntryId, newEntryId, reason?)

Manually mark an entry as superseded by another.

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `oldEntryId` | number | Entry to mark as SUPERSEDED |
| `newEntryId` | number | Entry that supersedes it |
| `reason` | string (optional) | Reason for supersession (default: "manual") |

**Behavior:**

- Sets confidence = 1.0 (manual = authoritative)
- Creates SUPERSEDES edge if Strategy 3 enabled
- Entry immediately filtered from search results

**Example:**

```typescript
resolver.manualSupersede(oldId, correctedId, 'incorrect pricing info');
```

---

### 4.5 revalidate(entryId)

Restores a superseded entry to ACTIVE status.

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `entryId` | number | Entry to revalidate |

**Behavior:**

- Resets `validity_status` to `'ACTIVE'`
- Clears `superseded_by` and `superseded_at`
- Does NOT remove SUPERSEDES edges (they become orphaned gracefully)
- Entry appears in search results again

**Example:**

```typescript
resolver.revalidate(entryId);
```

---

### 4.6 getStats()

Returns contradiction diagnostics for KB health monitoring.

**Returns:**

```typescript
{
  totalSuperseded: number;   // Count of entries with SUPERSEDED status
  totalActive: number;       // Count of ACTIVE entries
  supersededEdges: number;   // Count of SUPERSEDES edges in graph
}
```

**Example:**

```typescript
const stats = resolver.getStats();
console.log(`KB Health: ${stats.totalActive} active, ${stats.totalSuperseded} superseded`);
console.log(`Graph: ${stats.supersededEdges} SUPERSEDES edges`);
```

---

### 4.7 updateConfig(partial) / getConfig()

Runtime configuration management.

```typescript
// Check current config
const config = resolver.getConfig();

// Toggle strategy at runtime
resolver.updateConfig({ enableStatusMarking: false });
```

---

## 5. Supersession Signal Keywords

The system detects these keywords in entry content to trigger contradiction detection:

### Vietnamese Signals

`hủy bỏ`, `hủy`, `bãi bỏ`, `thay thế`, `không còn`, `đã xóa`, `cập nhật lại`, `sửa lại`, `thay đổi`, `chuyển sang`, `dừng`, `ngừng`, `loại bỏ`, `deprecated`, `đã cũ`, `không dùng nữa`

### English Signals

`cancel`, `cancelled`, `revoke`, `revoked`, `supersede`, `superseded`, `replace`, `replaced`, `override`, `overridden`, `deprecate`, `no longer`, `removed`, `deleted`, `instead of`, `changed to`, `updated to`, `migrated to`, `switched to`, `stop using`, `do not use`, `obsolete`, `invalid`, `was wrong`, `correction`

### Strong Signals (confidence +0.2 boost)

`hủy bỏ`, `cancel`, `replace`, `supersede`, `deprecated`, `obsolete`, `revoke`

---

## 6. Confidence Scoring

Confidence determines whether a detected contradiction is actually resolved (threshold: **0.6**).

| Factor | Score | Condition |
|--------|-------|-----------|
| Base | 0.5 | Always applied |
| Strong signal | +0.2 | Signal keyword is in strong list |
| Temporal | +0.15 | New entry is newer than all conflicting entries |
| Same source | +0.1 | Any conflicting entry shares same source |
| Same type | +0.05 | Any conflicting entry shares same type |
| **Maximum** | **1.0** | Capped |

### Examples

| Scenario | Score | Resolves? |
|----------|-------|-----------|
| Strong signal + newer + same source + same type | 1.0 | Yes |
| Strong signal + newer | 0.85 | Yes |
| Weak signal + newer | 0.65 | Yes |
| Weak signal only | 0.50 | No (below 0.6) |

---

## 7. Integration Guide

### 7.1 Integrating with Ingest Pipeline

Call `detectAndResolve()` after the entry is stored and entity extraction is complete:

```typescript
async function ingestEntry(content: string, metadata: Metadata) {
  // 1. Store entry
  const entryId = await store(content, metadata);
  
  // 2. Extract entities (must complete before contradiction check)
  await extractEntities(entryId);
  
  // 3. Detect and resolve contradictions
  const resolution = resolver.detectAndResolve(entryId);
  
  return { entryId, resolution };
}
```

### 7.2 Integrating with Search Pipeline

Call `filterSuperseded()` after hybrid search and before returning results:

```typescript
async function search(query: string, topK: number = 20) {
  // 1. Hybrid search (vector + FTS)
  const raw = await hybridSearch(query, topK);
  
  // 2. Filter superseded entries
  const filtered = resolver.filterSuperseded(raw);
  
  // 3. Optional: LLM consolidation
  const final = await resolver.consolidateWithLlm(filtered, query);
  
  return final.consolidatedResults;
}
```

---

## 8. Troubleshooting

### 8.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Entries not being superseded | Signal keyword not in content | Check content contains keywords from section 5 |
| Confidence too low (below 0.6) | Weak signal + no temporal/source match | Use `manualSupersede()` for known contradictions |
| Superseded entries still in search | Strategy 1 or 3 disabled | Check `getConfig()` and ensure strategies enabled |
| LLM consolidation not running | No `llmEndpoint` configured | Set `llmEndpoint` in config |
| Entity overlap not found | Entity extraction did not run first | Ensure entity extraction runs before `detectAndResolve()` |
| Wrongly superseded entry | False positive from signal detection | Call `revalidate(entryId)` to restore |

### 8.2 Debugging

```typescript
// Check entry status
const status = db.prepare(
  'SELECT validity_status, superseded_by, superseded_at FROM knowledge_entries WHERE id = ?'
).get(entryId);

// Check SUPERSEDES edges for an entry
const edges = db.prepare(
  "SELECT * FROM knowledge_graph_edges WHERE target_id = ? AND relation = 'SUPERSEDES'"
).all(entryId);

// Check audit log
const audit = db.prepare(
  "SELECT * FROM memory_audit WHERE operation = 'CONTRADICTION_RESOLVED' ORDER BY created_at DESC LIMIT 10"
).all();
```

### 8.3 Performance Considerations

- **Ingest detection**: less than 50ms per entry (entity lookup indexed, FTS limited to 10 results)
- **Search filtering**: less than 10ms per result set (status column indexed)
- **LLM consolidation**: adds LLM latency (typically 1-3s) — off by default
- If performance degrades, check entity_index table size and run `ANALYZE` on SQLite

---

## 9. FAQ

**Q: Does contradiction detection delete entries?**
A: No. Entries are never deleted. They are soft-marked as SUPERSEDED and can be restored via `revalidate()`.

**Q: What happens if the superseding entry is later superseded?**
A: Chain resolution — if B supersedes A, then C supersedes B, entry A is NOT filtered (because B is inactive). Only C is shown.

**Q: Can I disable specific strategies?**
A: Yes, all 3 strategies are independently configurable at runtime via `updateConfig()`.

**Q: What if I ingest content with signal keywords but do not want detection?**
A: Currently no opt-out per entry. If this is a recurring issue, disable strategy 1 and use `manualSupersede()` only.

**Q: Is the behavior identical across all 4 platforms?**
A: Yes — same signals, same confidence formula, same threshold (0.6), same resolution logic. Only syntax differs.

---

## 10. Platform-Specific Notes

### NodeJS

- File: `mcp-code-intelligence-nodejs/src/memory/contradiction-resolver.ts`
- Async LLM calls via `fetch()`
- Uses `better-sqlite3` for synchronous DB operations
- GraphRepository injected as constructor parameter

### Python

- File: `mcp-code-intelligence-python/src/mcp_code_intel/memory/contradiction_resolver.py`
- LLM calls via `urllib.request` (no external HTTP dependency)
- Uses stdlib `sqlite3` module
- Graph operations via internal methods (no separate GraphRepository class)

### Kotlin/MCP

- Directory: `mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/memory/contradiction/`
- Files: `ContradictionConfig.kt`, `ContradictionModels.kt`, `ContradictionSignals.kt`, `ContradictionResolver.kt`
- Uses JDBC for SQLite operations
- Graph operations via GraphRepository interface

### Kotlin/SDLC-Memory

- File: `sdlc-memory/src/main/kotlin/com/fec/memory/contradiction/ContradictionResolver.kt`
- Single-file implementation with mu-logging
- Uses JDBC for SQLite operations
- Self-contained (no separate GraphRepository)

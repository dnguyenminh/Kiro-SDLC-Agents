# Technical Design Document (TDD)

## FEC Code Intelligence — KSA-248: KB Contradiction Resolution

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-248 |
| Title | KB Contradiction Resolution — Technical Design |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-09 |
| Status | Draft (Retroactive) |
| Related BRD | BRD-v1-KSA-248.docx |
| Related FSD | FSD-v1-KSA-248.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-09 | SA Agent | Initial TDD — retroactive from implemented code |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical design for implementing KB Contradiction Resolution across 4 platform variants. It documents architecture decisions, class design, database schema, and integration patterns consistent across NodeJS (TypeScript), Python, Kotlin/MCP, and Kotlin/SDLC-Memory.

### 1.2 Scope

- ContradictionResolver class design and internal architecture
- Database schema additions (columns, indexes)
- Integration points with ingest pipeline and search engine
- Configuration management and runtime toggling
- LLM integration contract (OpenAI-compatible API)
- Cross-platform consistency requirements

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| NodeJS | TypeScript + better-sqlite3 | Node 18+ |
| Python | Python + sqlite3 (stdlib) | Python 3.11+ |
| Kotlin/MCP | Kotlin + JDBC (SQLite) | Kotlin 1.9+ / JVM 17+ |
| Kotlin/SDLC | Kotlin + JDBC (SQLite) + mu-logging | Kotlin 1.9+ / JVM 17+ |
| Database | SQLite (all platforms) | 3.35+ (FTS5) |

### 1.4 Design Principles

- **Single Responsibility**: ContradictionResolver handles ONLY contradiction logic
- **Strategy Pattern**: 3 resolution strategies independently configurable
- **Graceful Degradation**: Every failure path returns valid results
- **No Deletion**: SUPERSEDED is soft-mark; revalidation always possible
- **Cross-Platform Consistency**: Same algorithm, signals, thresholds

### 1.5 Constraints

- SQLite only (no PostgreSQL/MySQL)
- No external dependencies beyond existing project deps
- Must not break existing ingest/search performance SLAs
- Entity extraction must complete before contradiction check

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-248.docx |
| FSD | FSD-v1-KSA-248.docx |

---

## 2. System Architecture

### 2.1 Architecture Overview

The ContradictionResolver is a **library-pattern module** embedded within each platform Memory Engine. No standalone runtime — instantiated by Memory Engine, called at integration points.

![Architecture Diagram](diagrams/architecture.png)

**Key decisions:**
1. Direct function call integration (no event bus — SQLite is single-writer)
2. Synchronous detection on ingest (< 50ms acceptable for write path)
3. Config object injected at construction, runtime updates via updateConfig()
4. Graph edges stored in same SQLite DB (sufficient at scale)

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| ContradictionResolver | Main orchestrator — detection, marking, edge creation | Class (all platforms) |
| ContradictionConfig | Strategy enable/disable flags | Data class |
| SupersessionSignals | Keyword constants + signal detection | Module/Companion |
| ContradictionModels | DTOs: Detection, Result, Stats | Data classes |
| GraphRepository | Edge CRUD on knowledge_graph_edges | Existing (injected) |

### 2.3 Deployment Architecture

No additional deployment — module compiled/bundled into existing artifacts:

| Platform | Artifact | Packaging |
|----------|----------|-----------|
| NodeJS | npm package | TypeScript to JS |
| Python | pip package | Python source |
| Kotlin/MCP | JAR | Gradle shadowJar |
| Kotlin/SDLC | JAR | Gradle shadowJar |

### 2.4 Communication Patterns

| From | To | Protocol | Pattern |
|------|----|----------|---------|
| Ingest Pipeline | ContradictionResolver | Function call | Sync |
| Search Engine | ContradictionResolver | Function call | Sync |
| ContradictionResolver | SQLite DB | JDBC/sqlite3 | Sync |
| ContradictionResolver | LLM Service | HTTP POST | Async(JS)/Sync |
| ContradictionResolver | GraphRepository | Function call | Sync |

---

## 3. API Design

### 3.1 API Overview

| # | Method | Description | Source |
|---|--------|-------------|--------|
| 1 | detectAndResolve(newEntryId) | Detect + resolve contradictions on ingest | UC-01 |
| 2 | filterSuperseded(results) | Filter superseded from search | UC-02 |
| 3 | consolidateWithLlm(results, query) | Optional LLM consolidation | UC-03 |
| 4 | manualSupersede(oldId, newId, reason) | Manual supersession | UC-04 |
| 5 | revalidate(entryId) | Undo supersession | UC-05 |
| 6 | getStats() | Diagnostic stats | UC-06 |
| 7 | updateConfig(config) | Runtime config update | Config |
| 8 | getConfig() | Get current config | Diagnostics |

### 3.2 Algorithm: detectAndResolve

```
1. getEntry(newEntryId) -> entry or null (return empty if null)
2. detectSupersessionSignal(entry.content) -> signal or null (return if null)
3. findConflicting:
   a. extractEntities(newEntryId) from entity_index
   b. entities found -> query entries sharing entities (LIMIT 20)
   c. no entities -> FTS fallback on summary (LIMIT 10)
   d. Exclude SUPERSEDED and archived entries
4. computeConfidence(entry, conflicting, signal) -> float
5. If confidence >= 0.6:
   a. For each conflicting:
      - enableStatusMarking: UPDATE validity_status = SUPERSEDED
      - enableGraphSupersedes AND !edgeExists: INSERT SUPERSEDES edge
6. logResolution() -> INSERT memory_audit
7. Return ResolutionResult
```

### 3.3 Algorithm: filterSuperseded

```
1. Both strategies disabled -> return original
2. Layer 1 (enableStatusMarking): check validity_status for each result
3. Layer 2 (enableGraphSupersedes): check SUPERSEDES edges
   - Chain check: only filter if superseder is ACTIVE
4. Return results minus supersededIds
```

### 3.4 LLM Integration Contract

```json
POST {llmEndpoint}
Headers: Content-Type: application/json, Authorization: Bearer {apiKey}
Body: {
  "model": "{llmModel or gpt-4o-mini}",
  "messages": [{"role": "user", "content": "{consolidation prompt}"}],
  "temperature": 0,
  "max_tokens": 200
}
Response: { "choices": [{ "message": { "content": "[1, 5, 8]" } }] }
```

---

## 4. Database Design

### 4.1 Schema Migration

```sql
ALTER TABLE knowledge_entries ADD COLUMN validity_status TEXT DEFAULT 'ACTIVE';
ALTER TABLE knowledge_entries ADD COLUMN superseded_by INTEGER DEFAULT NULL;
ALTER TABLE knowledge_entries ADD COLUMN superseded_at TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_ke_validity ON knowledge_entries(validity_status);
```

For sdlc-memory:
```sql
ALTER TABLE memories ADD COLUMN validity_status TEXT DEFAULT 'ACTIVE';
ALTER TABLE memories ADD COLUMN superseded_by INTEGER DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_mem_validity ON memories(validity_status);
```

Migration is idempotent (try/catch on ALTER TABLE). Runs at construction time.

### 4.2 Query Patterns

| Operation | Query | Performance |
|-----------|-------|-------------|
| Get entry | SELECT * WHERE id = ? | < 1ms (PK) |
| Get status | SELECT validity_status WHERE id = ? | < 1ms |
| Entity overlap | JOIN entity_index + filter | < 10ms |
| FTS fallback | knowledge_fts MATCH ? LIMIT 10 | < 20ms |
| Mark superseded | UPDATE SET validity_status... WHERE id = ? | < 1ms |
| Check edge | SELECT 1 WHERE source=? AND target=? AND relation=? | < 1ms |
| Insert edge | INSERT INTO knowledge_graph_edges... | < 1ms |

---

## 5. Class / Module Design

### 5.1 Package Structure

**NodeJS:** `src/memory/contradiction-resolver.ts` (single file)
**Python:** `src/mcp_code_intel/memory/contradiction_resolver.py` (single file)
**Kotlin/MCP:** 4 files in `com.codeintel.memory.contradiction/`
- ContradictionConfig.kt, ContradictionModels.kt, SupersessionSignals.kt, ContradictionResolver.kt
**Kotlin/SDLC:** `com.fec.memory.contradiction/ContradictionResolver.kt` (all-in-one)

### 5.2 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Strategy | 3 resolution strategies via config flags | Independent toggle |
| Template Method | findConflicting: entities first, FTS fallback | Graceful degradation |
| Null Object | Empty ResolutionResult on early exit | Never null |
| Self-healing Schema | ensureSchema() at construction | Auto-migrate |

### 5.3 Error Handling

| Error | Impact | Handling |
|-------|--------|----------|
| Entry not found | None | Return empty result |
| ALTER TABLE column exists | None | Catch and ignore |
| FTS table missing | Reduced detection | Catch, empty candidates |
| Edge duplicate | None | edgeExists check prevents |
| LLM HTTP error | Reduced filtering | Return original results |
| LLM timeout | Reduced filtering | Return original results |
| LLM parse error | Reduced filtering | Return original results |

---

## 6. Integration Design

### 6.1 Ingest Pipeline Integration

```typescript
// After entry stored:
const resolution = contradictionResolver.detectAndResolve(entryId);
// resolution is informational — ingest succeeds regardless
```

### 6.2 Search Engine Integration

```kotlin
val rawResults = hybridSearch.execute(query, topK)
val filtered = contradictionResolver.filterSuperseded(rawResults)
return contradictionResolver.consolidateWithLlm(filtered, query)
```

---

## 7. Security Design

### 7.1 Access Control

| Operation | Access Level |
|-----------|-------------|
| detectAndResolve, filterSuperseded | System (internal only) |
| manualSupersede, revalidate, getStats | Admin (MCP tool layer enforces) |

### 7.2 Data Protection

| Data | Protection |
|------|-----------|
| LLM API Key | In config memory only, NEVER logged |
| Entry content in LLM prompt | Truncated to 300 chars |
| FTS query | Sanitized (remove non-alphanumeric) to prevent injection |

---

## 8. Performance

### 8.1 Targets

| Operation | Target |
|-----------|--------|
| detectAndResolve (entity hit) | < 30ms |
| detectAndResolve (FTS fallback) | < 50ms |
| filterSuperseded (20 results) | < 10ms |
| manualSupersede | < 5ms |
| revalidate | < 2ms |
| getStats | < 5ms |

### 8.2 No Caching

Queries are indexed and < 10ms. Cache invalidation overhead exceeds query cost at current scale.

---

## 9. Monitoring

### 9.1 Logging

| Event | Level |
|-------|-------|
| Contradiction resolved | INFO |
| LLM consolidation failed | WARN |
| Schema migration applied | INFO |

### 9.2 Audit

All resolutions logged to memory_audit:
```json
{"operation": "CONTRADICTION_RESOLVED", "details": {"superseded": [12,15], "edges": 2, "signal": "cancel"}}
```

---

## 10. Deployment

### 10.1 Configuration

| Property | Default | Description |
|----------|---------|-------------|
| enableStatusMarking | true | Strategy 1 |
| enableLlmConsolidation | false | Strategy 2 |
| enableGraphSupersedes | true | Strategy 3 |
| llmEndpoint | null | LLM URL |
| llmApiKey | null | LLM auth |
| llmModel | gpt-4o-mini | LLM model |

### 10.2 Rollback

1. Set all enable flags to false (pass-through mode)
2. DROP COLUMN validity_status, superseded_by, superseded_at
3. DELETE FROM knowledge_graph_edges WHERE relation = 'SUPERSEDES'
4. No data loss — entries never deleted

---

## 11. Implementation Checklist

| # | Platform | File | Action |
|---|----------|------|--------|
| 1 | NodeJS | src/memory/contradiction-resolver.ts | CREATE |
| 2 | Python | src/mcp_code_intel/memory/contradiction_resolver.py | CREATE |
| 3 | Kotlin/MCP | src/.../contradiction/ContradictionConfig.kt | CREATE |
| 4 | Kotlin/MCP | src/.../contradiction/ContradictionModels.kt | CREATE |
| 5 | Kotlin/MCP | src/.../contradiction/SupersessionSignals.kt | CREATE |
| 6 | Kotlin/MCP | src/.../contradiction/ContradictionResolver.kt | CREATE |
| 7 | Kotlin/SDLC | src/.../contradiction/ContradictionResolver.kt | CREATE |
| 8 | All | Ingest pipeline | MODIFY (add detectAndResolve call) |
| 9 | All | Search engine | MODIFY (add filterSuperseded call) |

### Cross-Platform Consistency

| Aspect | Requirement |
|--------|-------------|
| Signals | 40 keywords (16 Vietnamese + 24 English) |
| Strong signals | 7 keywords |
| Confidence | Base 0.5 + signal 0.2 + temporal 0.15 + source 0.1 + type 0.05 |
| Threshold | 0.6 |
| Entity LIMIT | 20 |
| FTS LIMIT | 10 |
| Summary sanitize | Remove non-alphanumeric, trim, take(60) |

---

## 12. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
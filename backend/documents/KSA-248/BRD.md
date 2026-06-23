# Business Requirements Document (BRD)

## FEC Code Intelligence — KSA-248: KB Contradiction Resolution

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-248 |
| Title | KB Contradiction Resolution — Detect and resolve conflicting/outdated information in Knowledge Base |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-09 |
| Status | Draft (Retroactive) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-09 | BA Agent | Initiate document — retroactive from implemented code |

---

## 1. Introduction

### 1.1 Scope

This CR implements a **Contradiction Resolution** system for the Knowledge Base across all platform variants (NodeJS, Python, Kotlin/MCP, Kotlin/SDLC-Memory). The system detects when newly ingested information contradicts or supersedes existing KB entries, and automatically resolves conflicts to prevent AI agents from receiving outdated/conflicting context.

The feature addresses the core RAG problem: when "Do X" (day 1) and "Cancel X" (day 2) both exist as vectors, similarity search returns both — causing AI hallucination or conflicting responses.

### 1.2 Out of Scope

- Full Knowledge Graph refactoring (only SUPERSEDES edges added)
- LLM-powered consolidation enabled by default (requires separate LLM configuration)
- Automatic expiry/TTL-based eviction of entries
- UI for managing superseded entries (CLI/API only)
- Cross-instance contradiction detection (each KB instance is independent)

### 1.3 Preliminary Requirement

- Knowledge Base with existing `knowledge_entries` table (SQLite/JDBC)
- `knowledge_graph_edges` table for graph relationships
- `entity_index` table for entity extraction results
- `knowledge_fts` virtual table for full-text search
- Existing ingest pipeline, hybrid search, and memory engine components

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Contradiction Resolution system operates at two critical points in the KB lifecycle:

1. **On Ingest** — When new information enters KB, detect if it contradicts existing entries and automatically mark old entries as superseded
2. **On Search** — When retrieving information, filter out superseded entries so AI agents only see current/valid information

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a KB system, I want to automatically detect contradictions on ingest so that outdated info is marked invalid | MUST HAVE | KSA-248 |
| 2 | As an AI agent, I want search results to exclude superseded entries so that I never receive conflicting context | MUST HAVE | KSA-248 |
| 3 | As a system admin, I want to manually supersede entries via API so that I can correct KB mistakes | MUST HAVE | KSA-248 |
| 4 | As a system admin, I want to revalidate (undo supersession) entries so that wrongly-superseded info can be restored | MUST HAVE | KSA-248 |
| 5 | As a KB system, I want optional LLM-powered consolidation on search results so that complex contradictions are caught | SHOULD HAVE | KSA-248 |
| 6 | As a system admin, I want contradiction stats/diagnostics so that I can monitor KB health | SHOULD HAVE | KSA-248 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Ingest Flow (Contradiction Detection):**

**Step 1:** New entry is ingested into KB (via ingest pipeline)

**Step 2:** ContradictionResolver checks if new entry content contains supersession signals (Vietnamese + English keywords like "hủy bỏ", "cancel", "replaced", "deprecated", etc.)

**Step 3:** If signal detected, find conflicting entries by:
- (a) Entity overlap — entries sharing same entities in `entity_index`
- (b) Fallback: FTS similarity search on summary

**Step 4:** Compute confidence score (0.0-1.0) based on:
- Signal strength (strong keywords +0.2)
- Temporal ordering (new entry is newer +0.15)
- Same source (+0.1)
- Same type (+0.05)

**Step 5:** If confidence >= 0.6:
- Strategy 1: Mark old entries `validity_status = 'SUPERSEDED'`, set `superseded_by = newEntryId`
- Strategy 3: Create `SUPERSEDES` edge in knowledge graph

**Step 6:** Log resolution in audit table

---

**Search Flow (Superseded Filtering):**

**Step 1:** Hybrid search returns Top-K results

**Step 2:** ContradictionResolver.filterSuperseded() removes entries where:
- `validity_status = 'SUPERSEDED'` (Strategy 1 check)
- Entry has incoming SUPERSEDES edge from an active entry (Strategy 3 check)

**Step 3:** (Optional) If LLM configured, call LLM consolidation to detect remaining contradictions

**Step 4:** Return filtered results to AI agent

---

![Business Flow](diagrams/business-flow.png)

---

#### STORY 1: Automatic Contradiction Detection on Ingest

> As a KB system, I want to automatically detect contradictions on ingest so that outdated information is marked invalid without manual intervention.

**Requirement Details:**

1. On every new KB entry ingest, run contradiction detection pipeline
2. Detection uses keyword-based supersession signals (bilingual: Vietnamese + English)
3. Conflicting entries found via entity overlap OR FTS similarity
4. Only resolve when confidence >= 0.6 (prevent false positives)
5. Resolution marks old entries as SUPERSEDED (not deleted — preserves history)
6. Creates SUPERSEDES relationship edge in knowledge graph

**Supersession Signal Keywords:**

| Language | Signals |
|----------|---------|
| Vietnamese | hủy bỏ, hủy, bãi bỏ, thay thế, không còn, đã xóa, cập nhật lại, sửa lại, thay đổi, chuyển sang, dừng, ngừng, loại bỏ, deprecated, đã cũ, không dùng nữa |
| English | cancel, cancelled, revoke, revoked, supersede, superseded, replace, replaced, override, overridden, deprecate, no longer, removed, deleted, instead of, changed to, updated to, migrated to, switched to, stop using, do not use, obsolete, invalid, was wrong, correction |

**Confidence Calculation:**

| Factor | Score Boost | Condition |
|--------|-------------|-----------|
| Base | 0.5 | Always applied |
| Strong signal | +0.2 | Signal is in strong list (hủy bỏ, cancel, replace, supersede, deprecated, obsolete, revoke) |
| Temporal | +0.15 | New entry is more recent than all conflicting entries |
| Same source | +0.1 | Any conflicting entry shares same source |
| Same type | +0.05 | Any conflicting entry shares same type |
| **Maximum** | **1.0** | Capped |

**Acceptance Criteria:**

1. When new entry containing "hủy bỏ" is ingested AND shares entity with existing entry, old entry is marked SUPERSEDED
2. When confidence < 0.6, no resolution applied (detection stored but no marking)
3. Already-SUPERSEDED entries are not considered as candidates for re-supersession
4. SUPERSEDES edge created in graph when strategy 3 enabled
5. Resolution logged in audit table with signal, confidence, affected entry IDs

---

#### STORY 2: Search Result Filtering of Superseded Entries

> As an AI agent, I want search results to exclude superseded entries so that I never receive conflicting/outdated context.

**Requirement Details:**

1. Filter runs automatically after hybrid search retrieves raw results
2. Two-layer filtering:
   - Layer 1: Check `validity_status` column (Strategy 1)
   - Layer 2: Check SUPERSEDES graph edges — only filter if superseding entry is still ACTIVE (Strategy 3)
3. If entry is superseded by another entry that is ALSO superseded (chain), do NOT filter original

**Acceptance Criteria:**

1. Search results never contain entries with `validity_status = 'SUPERSEDED'`
2. Entry with incoming SUPERSEDES edge from ACTIVE entry is filtered out
3. Entry with incoming SUPERSEDES edge from SUPERSEDED entry is NOT filtered (chain resolution)
4. Performance: filtering adds < 10ms overhead for typical result sets (20 results or fewer)

---

#### STORY 3: Manual Supersession via API

> As a system admin, I want to manually supersede entries via API so that I can correct KB mistakes without waiting for signal detection.

**Requirement Details:**

1. Expose `manualSupersede(oldEntryId, newEntryId, reason?)` function
2. Always marks with confidence 1.0 (manual = authoritative)
3. Creates SUPERSEDES edge with reason metadata

**Acceptance Criteria:**

1. After manualSupersede(A, B), entry A has `validity_status = 'SUPERSEDED'` and `superseded_by = B`
2. SUPERSEDES edge exists from B to A with weight 1.0
3. Entry A no longer appears in search results

---

#### STORY 4: Revalidation (Undo Supersession)

> As a system admin, I want to revalidate entries so that wrongly-superseded information can be restored.

**Requirement Details:**

1. Expose `revalidate(entryId)` function
2. Resets `validity_status` to 'ACTIVE', clears `superseded_by` and `superseded_at`
3. Does NOT remove SUPERSEDES edges (edges can be orphaned gracefully)

**Acceptance Criteria:**

1. After revalidate(A), entry A has `validity_status = 'ACTIVE'`
2. Entry A appears in search results again
3. SUPERSEDES edges pointing to A still exist but are ignored because source entry may also be superseded

---

#### STORY 5: Optional LLM Consolidation (Strategy 2)

> As a KB system, I want optional LLM-powered consolidation on search results so that complex contradictions (beyond keyword matching) are caught.

**Requirement Details:**

1. LLM consolidation is OFF by default
2. Auto-disables if `llmEndpoint` is not configured (graceful degradation)
3. When enabled: post-search, calls LLM with retrieved entries + query, LLM identifies outdated entries
4. LLM returns JSON array of entry IDs to remove
5. On LLM failure: returns original results unchanged (graceful degradation)

**Acceptance Criteria:**

1. With no LLM endpoint configured, consolidation silently skipped, results unchanged
2. With LLM configured and enabled, LLM called, contradictory entries removed from results
3. On LLM timeout/error, original results returned (no data loss)
4. LLM prompt includes entry timestamps to enable temporal reasoning

---

#### STORY 6: Contradiction Diagnostics and Stats

> As a system admin, I want contradiction stats so that I can monitor KB health and understand resolution patterns.

**Requirement Details:**

1. `getStats()` returns: total superseded count, total active count, SUPERSEDES edge count
2. Resolution events logged to `memory_audit` table

**Acceptance Criteria:**

1. Stats reflect actual DB state (query-time, not cached)
2. Audit log contains: operation='CONTRADICTION_RESOLVED', details with signal/confidence/affected IDs, timestamp

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Knowledge Base (SQLite) | System | N/A | Existing knowledge_entries, knowledge_graph_edges tables |
| Entity Index | System | N/A | entity_index table for entity-based conflict detection |
| Full-Text Search | System | N/A | knowledge_fts virtual table for FTS-based fallback detection |
| Graph Repository | System | N/A | GraphRepository/KnowledgeGraph for edge management |
| Ingest Pipeline | System | N/A | Integration point: call detectAndResolve on new entries |
| Hybrid Search | System | N/A | Integration point: call filterSuperseded on search results |
| LLM Endpoint (optional) | External | N/A | Required only for Strategy 2 (LLM Consolidation) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Developer | FEC Team | Implementation across 4 platform variants |
| Product Owner | FEC Team | Define contradiction rules, threshold values |
| AI Agent Users | Internal | Consume filtered search results |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| False positive supersession (valid info marked as superseded) | High | Medium | Confidence threshold >= 0.6 + revalidate() API |
| Keyword-only detection misses complex contradictions | Medium | Medium | Optional LLM consolidation (Strategy 2) as safety net |
| Performance impact on ingest (extra queries) | Low | Low | Entity-based lookup first (O(1) index), FTS fallback limited to 10 results |
| LLM consolidation latency on search | Medium | Low | Off by default; on failure returns original results |

### 5.2 Assumptions

- KB entries have meaningful `content` and `summary` fields for signal detection
- Entity extraction already populates `entity_index` table before contradiction check runs
- All platform variants (NodeJS, Python, Kotlin/MCP, Kotlin/SDLC) share same schema
- SQLite is sufficient for contradiction queries at expected scale (< 100K entries per KB instance)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Ingest detection < 50ms per entry | Entity lookup + FTS query, capped at 20 candidates |
| Performance | Search filtering < 10ms per result set | Status column check + edge lookup, indexed queries |
| Reliability | Graceful degradation | If entity_index missing then FTS fallback; if LLM fails then return unfiltered |
| Data Integrity | No data deletion | Superseded entries preserved (status change only), revalidation available |
| Compatibility | Multi-platform consistent | Same logic across NodeJS, Python, Kotlin/MCP, Kotlin/SDLC variants |
| Auditability | All resolutions logged | memory_audit table with full resolution details |
| Configuration | Runtime configurable | All 3 strategies can be enabled/disabled without restart |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-248 | KB Contradiction Resolution | Story | Main ticket |

---

## 8. Appendix

### 8.1 Three Resolution Strategies

| # | Strategy | When Active | Mechanism | Integration Point |
|---|----------|-------------|-----------|-------------------|
| 1 | Metadata/Status Marking | Always (default ON) | Sets `validity_status='SUPERSEDED'` + `superseded_by` column | On ingest + On search filter |
| 2 | LLM Consolidation | Only when `llmEndpoint` configured AND `enableLlmConsolidation = true` | Calls LLM to identify outdated entries in search results | On search (post-filter) |
| 3 | Graph SUPERSEDES Edges | Always (default ON) | Creates SUPERSEDES edge in knowledge_graph_edges | On ingest + On search filter |

### 8.2 Platform Implementation Matrix

| Platform | Module | Files |
|----------|--------|-------|
| NodeJS | mcp-code-intelligence-nodejs | `src/memory/contradiction-resolver.ts` |
| Python | mcp-code-intelligence-python | `src/mcp_code_intel/memory/contradiction_resolver.py` |
| Kotlin/MCP | mcp-code-intelligence-kotlin | `src/main/kotlin/com/codeintel/memory/contradiction/` (4 files: Config, Models, Signals, Resolver) |
| Kotlin/SDLC | sdlc-memory | `src/main/kotlin/com/fec/memory/contradiction/ContradictionResolver.kt` |

### 8.3 Database Schema Changes

```sql
-- Added columns to knowledge_entries / memories table
ALTER TABLE knowledge_entries ADD COLUMN validity_status TEXT DEFAULT 'ACTIVE';
ALTER TABLE knowledge_entries ADD COLUMN superseded_by INTEGER DEFAULT NULL;
ALTER TABLE knowledge_entries ADD COLUMN superseded_at TEXT DEFAULT NULL;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_ke_validity ON knowledge_entries(validity_status);
```

### 8.4 Glossary

| Term | Definition |
|------|------------|
| Supersession | When new information replaces/invalidates existing information |
| Contradiction | When two KB entries provide conflicting answers to the same question |
| Confidence Score | 0.0-1.0 score indicating how certain the system is that a contradiction exists |
| SUPERSEDES Edge | Directed graph relationship from new entry to old entry indicating replacement |
| Graceful Degradation | System continues functioning with reduced capability when a component fails |

### Reference Documents

| Document | Location |
|----------|----------|
| Supermemory Analysis | documents/Invalid-Info_in-KB.md |
| NodeJS Implementation | mcp-code-intelligence-nodejs/src/memory/contradiction-resolver.ts |
| Python Implementation | mcp-code-intelligence-python/src/mcp_code_intel/memory/contradiction_resolver.py |
| Kotlin/MCP Implementation | mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/memory/contradiction/ |
| Kotlin/SDLC Implementation | sdlc-memory/src/main/kotlin/com/fec/memory/contradiction/ContradictionResolver.kt |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

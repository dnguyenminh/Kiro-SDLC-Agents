# Functional Specification Document (FSD)

## FEC Code Intelligence — KSA-248: KB Contradiction Resolution

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-248 |
| Title | KB Contradiction Resolution — Detect and resolve conflicting/outdated information in Knowledge Base |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-09 |
| Status | Draft (Retroactive) |
| Related BRD | BRD-v1-KSA-248.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-09 | BA Agent | Initial FSD — retroactive from implemented code |
| 1.0 | 2026-06-09 | TA Agent | Technical enrichment — API contracts, integration specs, pseudocode |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the KB Contradiction Resolution system. It defines use cases, business rules, data specifications, and integration contracts for detecting and resolving conflicting information across 4 platform variants (NodeJS, Python, Kotlin/MCP, Kotlin/SDLC-Memory).

### 1.2 Scope

- Automatic contradiction detection on KB entry ingest
- Superseded entry filtering on search results
- Optional LLM-powered consolidation (graceful degradation when unavailable)
- Graph-based SUPERSEDES relationship tracking
- Manual supersession and revalidation APIs
- Diagnostic/stats endpoint

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Supersession | When newer information invalidates/replaces existing KB entry |
| Contradiction | Two KB entries providing conflicting answers for same topic |
| SUPERSEDES Edge | Directed graph relationship from new entry to old entry |
| Validity Status | Column marking entry as ACTIVE or SUPERSEDED |
| Confidence Score | 0.0-1.0 score quantifying certainty of detected contradiction |
| FTS | Full-Text Search — SQLite virtual table for text matching |
| Entity Index | Table mapping KB entries to extracted named entities |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-248.docx |
| Supermemory Analysis | documents/Invalid-Info_in-KB.md |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The Contradiction Resolution module sits within the KB Memory Engine. It intercepts two flows:
1. **Ingest Flow** — called after a new entry is stored, before returning success
2. **Search Flow** — called after hybrid search retrieves raw results, before returning to caller

External actors:
- **AI Agent** — consumes filtered search results
- **System Admin** — invokes manual supersede/revalidate APIs
- **LLM Service** (optional) — provides consolidation judgments

### 2.2 System Architecture

The module integrates with existing KB components:
- **Knowledge Entries Table** — stores entries with new `validity_status` column
- **Knowledge Graph Edges** — stores SUPERSEDES relationships
- **Entity Index** — used for conflict candidate detection
- **FTS Virtual Table** — fallback conflict detection when no entity overlap
- **Memory Audit** — logs all resolution events

---

## 3. Functional Requirements

### 3.1 Feature: Automatic Contradiction Detection on Ingest

**Source:** BRD Story 1

#### 3.1.1 Description

When a new KB entry is ingested, the system scans its content for supersession signal keywords. If found, it searches for existing entries that share entities or similar content, computes a confidence score, and (if confidence >= 0.6) marks old entries as SUPERSEDED and creates SUPERSEDES graph edges.

#### 3.1.2 Use Case: UC-01 — Detect and Resolve Contradiction on Ingest

**Use Case ID:** UC-01
**Actor:** KB Ingest Pipeline (automated)
**Preconditions:** New entry successfully stored in `knowledge_entries` table with a valid ID
**Postconditions:** Conflicting old entries marked SUPERSEDED; SUPERSEDES edges created; audit logged

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Ingest Pipeline | | Calls `detectAndResolve(newEntryId)` after storing entry |
| 2 | | ContradictionResolver | Retrieves new entry from DB by ID |
| 3 | | ContradictionResolver | Scans content for supersession signal keywords |
| 4 | | ContradictionResolver | Signal found — extracts entities from `entity_index` for this entry |
| 5 | | ContradictionResolver | Queries entries sharing entities (max 20 candidates) |
| 6 | | ContradictionResolver | Computes confidence score based on signal strength, temporal order, source, type |
| 7 | | ContradictionResolver | Confidence >= 0.6 — marks old entries `validity_status = 'SUPERSEDED'` |
| 8 | | ContradictionResolver | Creates SUPERSEDES edges in graph (new to old, weight = confidence) |
| 9 | | ContradictionResolver | Logs resolution to `memory_audit` table |
| 10 | | ContradictionResolver | Returns `ResolutionResult` with detection details |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | No supersession signal found in content | Return empty result immediately (Step 3 exit) |
| AF-02 | No entities in entity_index for new entry | Fallback to FTS similarity search on summary (max 10 results) |
| AF-03 | No conflicting entries found | Return result with empty detected list |
| AF-04 | Confidence < 0.6 | Record detection but do NOT mark entries as superseded |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Entry ID not found in DB | Return empty result (entry may have been deleted) |
| EF-02 | DB error during entity lookup | Fall through to FTS fallback; if FTS also fails, return empty |
| EF-03 | DB error during marking | Log error, return partial result (detection recorded but not resolved) |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | Confidence threshold for resolution is 0.6 (configurable at runtime) | BRD Story 1 |
| BR-02 | Strong signals (huy bo, cancel, replace, supersede, deprecated, obsolete, revoke) add +0.2 to confidence | BRD Confidence Table |
| BR-03 | Temporal ordering (new entry newer than all conflicting) adds +0.15 | BRD Confidence Table |
| BR-04 | Same source adds +0.1, same type adds +0.05 | BRD Confidence Table |
| BR-05 | Max confidence capped at 1.0 | BRD Confidence Table |
| BR-06 | Already-SUPERSEDED entries excluded from candidate search | BRD Story 1 AC3 |
| BR-07 | Archived entries (archived_at IS NOT NULL) excluded from candidates | Code implementation |
| BR-08 | Entity-based search limited to 20 candidates per entity | Performance constraint |
| BR-09 | FTS fallback limited to 10 candidates | Performance constraint |
| BR-10 | All 3 strategies independently configurable at runtime | BRD NFR |

#### 3.1.4 Data Specifications

**Input Data:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| newEntryId | Integer/Long | Yes | Must exist in knowledge_entries | ID of newly ingested entry |

**Output Data (ResolutionResult):**

| Field | Type | Description |
|-------|------|-------------|
| detected | List of ContradictionDetection | All detected contradictions (even unresolved) |
| resolved | Integer | Count of entries that were marked SUPERSEDED |
| supersededEntries | List of Integer | IDs of entries marked SUPERSEDED |
| edgesCreated | Integer | Number of SUPERSEDES edges created |

**ContradictionDetection:**

| Field | Type | Description |
|-------|------|-------------|
| newEntryId | Integer | The triggering new entry |
| conflictingEntryIds | List of Integer | IDs of conflicting entries found |
| signal | String | The keyword that triggered detection |
| confidence | Float (0.0-1.0) | Calculated confidence score |

#### 3.1.5 API Contract (Functional View)

**Function:** `detectAndResolve(newEntryId: Long): ResolutionResult`

**Purpose:** Called by ingest pipeline after storing new KB entry. Detects contradictions and resolves them by marking old entries.

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| newEntryId | Long | Yes | Must be valid entry ID | ID of the newly stored entry |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| ResolutionResult | Object | Contains detection list, resolved count, superseded IDs, edges count |

**Business Error Scenarios:**

| Scenario | Behavior | Trigger Condition |
|----------|----------|-------------------|
| Entry not found | Returns empty result | Entry deleted between store and resolution call |
| DB failure on marking | Returns partial result | Database write error — detection still returned |

---

### 3.2 Feature: Search Result Filtering

**Source:** BRD Story 2

#### 3.2.1 Description

After hybrid search returns raw Top-K results, the system filters out entries that have been superseded — either via `validity_status` column (Strategy 1) or via SUPERSEDES graph edges from active entries (Strategy 3).

#### 3.2.2 Use Case: UC-02 — Filter Superseded Entries from Search

**Use Case ID:** UC-02
**Actor:** AI Agent (via search API)
**Preconditions:** Hybrid search completed, raw results available
**Postconditions:** Superseded entries removed, only valid/current entries returned

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Search Engine | | Calls `filterSuperseded(results)` with raw search results |
| 2 | | ContradictionResolver | For each result, checks `validity_status` column |
| 3 | | ContradictionResolver | Entries with status = SUPERSEDED added to exclusion set |
| 4 | | ContradictionResolver | For remaining entries, queries SUPERSEDES edges (incoming) |
| 5 | | ContradictionResolver | If superseding entry is ACTIVE — add target to exclusion set |
| 6 | | ContradictionResolver | Returns filtered results (exclusion set removed) |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Both strategies disabled in config | Return original results unchanged |
| AF-02 | Superseding entry is also SUPERSEDED (chain) | Do NOT filter target — chain resolution protects it |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | DB error during status check | Skip that entry (do not filter it) — fail-open for search |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-11 | Two-layer filtering: status check THEN graph edge check | BRD Story 2 |
| BR-12 | Chain resolution: if A superseded by B, and B superseded by C, then A is NOT filtered (B is inactive superseder) | BRD Story 2 AC3 |
| BR-13 | Filtering adds < 10ms overhead for 20 or fewer results | BRD NFR |
| BR-14 | Fail-open: on error, return unfiltered results (never lose data) | Design principle |

#### 3.2.4 Data Specifications

**Input Data:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| results | List of SearchResult | Yes | Non-null | Raw search results from hybrid search |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| filteredResults | List of SearchResult | Results with superseded entries removed |

#### 3.2.5 API Contract (Functional View)

**Function:** `filterSuperseded(results: List<SearchResult>): List<SearchResult>`

**Purpose:** Post-search filter to remove contradicted/outdated entries before returning to AI agent.

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| results | List of SearchResult | Yes | BR-11, BR-12 | Raw results from hybrid search |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| List of SearchResult | Same type as input | Filtered list with superseded entries removed |

---

### 3.3 Feature: Optional LLM Consolidation (Strategy 2)

**Source:** BRD Story 5

#### 3.3.1 Description

When LLM endpoint is configured and strategy 2 is enabled, post-search results are sent to an LLM for semantic contradiction detection. The LLM identifies entries that contain outdated information based on context and temporal reasoning. This catches contradictions that keyword-based detection misses.

#### 3.3.2 Use Case: UC-03 — LLM Consolidation of Search Results

**Use Case ID:** UC-03
**Actor:** AI Agent (via search API, transparent)
**Preconditions:** LLM endpoint configured AND enableLlmConsolidation = true AND search results available
**Postconditions:** Contradictory entries removed based on LLM judgment

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Search Engine | | Calls `consolidateWithLlm(results, query)` after basic filtering |
| 2 | | ContradictionResolver | Builds consolidation prompt with entries + timestamps + query |
| 3 | | ContradictionResolver | Calls LLM endpoint (POST, JSON, temperature=0) |
| 4 | | ContradictionResolver | Parses LLM response: JSON array of entry IDs to remove |
| 5 | | ContradictionResolver | Validates IDs exist in result set |
| 6 | | ContradictionResolver | Returns results with LLM-identified entries removed |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | LLM not configured (no endpoint) | Skip entirely, return results unchanged |
| AF-02 | LLM disabled in config | Skip entirely, return results unchanged |
| AF-03 | LLM returns empty array | No entries removed, return original results |
| AF-04 | LLM returns IDs not in result set | Ignore invalid IDs, only remove valid ones |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | LLM timeout (> 10s) | Return original results unchanged (graceful degradation) |
| EF-02 | LLM HTTP error (4xx/5xx) | Return original results unchanged |
| EF-03 | LLM response not parseable | Return original results unchanged |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-15 | LLM auto-disables when no endpoint configured | BRD Story 5 |
| BR-16 | LLM uses temperature=0 for deterministic output | Implementation |
| BR-17 | Max tokens for LLM response: 200 | Implementation |
| BR-18 | Entry content truncated to 300 chars in prompt (token budget) | Implementation |
| BR-19 | On any LLM failure: graceful degradation (return unfiltered) | BRD Story 5 AC3 |
| BR-20 | Prompt includes entry timestamps for temporal reasoning | BRD Story 5 AC4 |

---

### 3.4 Feature: Manual Supersession

**Source:** BRD Story 3

#### 3.4.1 Description

System admins can explicitly mark an entry as superseded by another, bypassing automatic detection. This is used to correct KB mistakes or handle complex contradictions that automatic detection misses.

#### 3.4.2 Use Case: UC-04 — Manual Supersede Entry

**Use Case ID:** UC-04
**Actor:** System Admin
**Preconditions:** Both old and new entry IDs are valid
**Postconditions:** Old entry marked SUPERSEDED; SUPERSEDES edge created with weight 1.0

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Admin | | Calls `manualSupersede(oldId, newId, reason)` |
| 2 | | ContradictionResolver | Marks old entry: validity_status = SUPERSEDED, superseded_by = newId |
| 3 | | ContradictionResolver | Creates SUPERSEDES edge (new to old) with weight 1.0 |
| 4 | | ContradictionResolver | Returns success |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | SUPERSEDES edge already exists | Skip edge creation, still mark status |
| AF-02 | Graph strategy disabled | Skip edge creation, only mark status |

#### 3.4.3 API Contract (Functional View)

**Function:** `manualSupersede(oldEntryId: Long, newEntryId: Long, reason: String = "manual"): void`

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| oldEntryId | Long | Yes | Must exist | Entry to be superseded |
| newEntryId | Long | Yes | Must exist | Entry that supersedes |
| reason | String | No | Default: "manual" | Reason for manual action |

---

### 3.5 Feature: Revalidation (Undo Supersession)

**Source:** BRD Story 4

#### 3.5.1 Use Case: UC-05 — Revalidate Entry

**Use Case ID:** UC-05
**Actor:** System Admin
**Preconditions:** Entry exists with validity_status = SUPERSEDED
**Postconditions:** Entry restored to ACTIVE; superseded_by and superseded_at cleared

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Admin | | Calls `revalidate(entryId)` |
| 2 | | ContradictionResolver | Updates: validity_status = ACTIVE, superseded_by = NULL, superseded_at = NULL |
| 3 | | ContradictionResolver | Does NOT remove SUPERSEDES edges (orphaned gracefully) |
| 4 | | ContradictionResolver | Entry reappears in search results |

**Business Rules:**

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-21 | Revalidation does NOT delete graph edges | BRD Story 4 |
| BR-22 | Orphaned edges ignored because superseding entry status is checked at filter time | BR-12 |

---

### 3.6 Feature: Contradiction Diagnostics

**Source:** BRD Story 6

#### 3.6.1 Use Case: UC-06 — Get Contradiction Stats

**Use Case ID:** UC-06
**Actor:** System Admin
**Preconditions:** None
**Postconditions:** Stats returned (no side effects)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Admin | | Calls `getStats()` |
| 2 | | ContradictionResolver | Queries COUNT of SUPERSEDED entries |
| 3 | | ContradictionResolver | Queries COUNT of ACTIVE entries |
| 4 | | ContradictionResolver | Queries COUNT of SUPERSEDES edges |
| 5 | | ContradictionResolver | Returns stats object |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| totalSuperseded | Integer | Count of entries with validity_status = SUPERSEDED |
| totalActive | Integer | Count of entries with ACTIVE or NULL status |
| supersedesEdges | Integer | Count of SUPERSEDES relationships in graph |

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

![ER Diagram](diagrams/er-diagram.png)

### 4.2 Logical Entities

#### Entity: KnowledgeEntry (extended)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | Integer | Yes | Auto-increment PK | Unique entry identifier |
| content | Text | Yes | | Full text content of KB entry |
| summary | Text | Yes | | Short summary for FTS matching |
| type | String | No | BR-04 | Entry type (decision, requirement, etc.) |
| source | String | No | BR-04 | Origin source identifier |
| created_at | DateTime | Yes | BR-03 | Timestamp of creation |
| validity_status | String | No | BR-01, BR-06 | ACTIVE (default) or SUPERSEDED |
| superseded_by | Integer | No | FK to self | ID of entry that superseded this one |
| superseded_at | DateTime | No | | When supersession was applied |
| archived_at | DateTime | No | BR-07 | Soft-delete timestamp |

#### Entity: GraphEdge

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| source_id | Integer | Yes | FK to KnowledgeEntry | Entry that supersedes (newer) |
| target_id | Integer | Yes | FK to KnowledgeEntry | Entry that was superseded (older) |
| relation | String | Yes | = SUPERSEDES | Relationship type |
| weight | Float | Yes | = confidence score | Edge weight (0.0-1.0) |
| metadata | JSON/Text | No | | Signal, timestamp info |

#### Entity: EntityIndex

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| entry_id | Integer | Yes | FK to KnowledgeEntry | Entry this entity belongs to |
| entity_name | String | Yes | | Extracted named entity |

#### Entity: MemoryAudit

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| operation | String | Yes | = CONTRADICTION_RESOLVED | Audit operation type |
| details | JSON/Text | Yes | | Signal, confidence, affected IDs |
| created_at | DateTime | Yes | | Timestamp of resolution |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| KnowledgeEntry | GraphEdge | 1:N | Entry can have many SUPERSEDES edges (as source or target) |
| KnowledgeEntry | EntityIndex | 1:N | Entry has many extracted entities |
| KnowledgeEntry | KnowledgeEntry | 1:1 (via superseded_by) | Self-reference for direct supersession |

---

## 5. Integration Specifications

### 5.1 Integration Point: Ingest Pipeline

| Attribute | Value |
|-----------|-------|
| Purpose | Trigger contradiction detection after new entry stored |
| Direction | Inbound (pipeline calls resolver) |
| Data Format | Function call with entry ID |
| Frequency | Real-time (every ingest operation) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| newEntryId | Ingest pipeline provides | Receive | Entry must be stored before calling |
| ResolutionResult | Ingest pipeline receives | Send | Informational — pipeline continues regardless |

### 5.2 Integration Point: Search/Hybrid Search

| Attribute | Value |
|-----------|-------|
| Purpose | Filter superseded entries before returning results |
| Direction | Inbound (search calls resolver) |
| Data Format | Function call with SearchResult list |
| Frequency | Real-time (every search operation) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| SearchResult list | Search engine provides | Receive | Raw results from vector+FTS hybrid search |
| Filtered list | Search engine receives | Send | Same type, fewer entries |

### 5.3 Integration Point: LLM Service (Optional)

| Attribute | Value |
|-----------|-------|
| Purpose | Semantic contradiction detection via LLM |
| Direction | Outbound (resolver calls LLM) |
| Data Format | JSON (OpenAI-compatible chat completion API) |
| Frequency | On-demand (only when LLM enabled AND search occurs) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Prompt with entries + query | LLM endpoint | Send | Entries truncated to 300 chars |
| JSON array of IDs to remove | LLM response | Receive | Validated against result set |

---

## 6. Processing Logic

### 6.1 Confidence Score Computation

**Trigger:** Signal keyword detected in new entry content
**Input:** New entry, conflicting entries list, detected signal
**Output:** Float 0.0-1.0

**Processing Steps (Pseudocode):**

```
function computeConfidence(newEntry, conflicting, signal):
    confidence = 0.5  // base score

    // Step 1: Signal strength boost
    if signal IN STRONG_SIGNALS:
        confidence += 0.2

    // Step 2: Temporal ordering boost
    if ALL conflicting.created_at < newEntry.created_at:
        confidence += 0.15

    // Step 3: Same source boost
    if ANY conflicting.source == newEntry.source:
        confidence += 0.1

    // Step 4: Same type boost
    if ANY conflicting.type == newEntry.type:
        confidence += 0.05

    return MIN(confidence, 1.0)
```

### 6.2 Conflict Candidate Discovery

**Trigger:** Supersession signal found in new entry
**Input:** New entry ID
**Output:** List of conflicting entry snapshots

**Processing Steps:**

```
function findConflicting(newEntry, newEntryId):
    // Step 1: Try entity-based discovery (preferred — more precise)
    entities = SELECT entity_name FROM entity_index WHERE entry_id = newEntryId

    if entities NOT EMPTY:
        candidates = []
        for entity in entities:
            rows = SELECT ke.* FROM knowledge_entries ke
                   JOIN entity_index ei ON ke.id = ei.entry_id
                   WHERE ei.entity_name = entity
                   AND ke.id != newEntryId
                   AND (ke.validity_status = 'ACTIVE' OR validity_status IS NULL)
                   AND ke.archived_at IS NULL
                   ORDER BY ke.created_at DESC
                   LIMIT 20
            candidates.addAll(rows)
        return deduplicate(candidates)

    // Step 2: Fallback — FTS similarity search
    sanitized = newEntry.summary.removeNonAlphanumeric().trim().take(60)
    if sanitized EMPTY: return []

    return SELECT ke.* FROM knowledge_fts
           JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
           WHERE knowledge_fts MATCH sanitized
           AND ke.id != newEntryId
           AND (ke.validity_status = 'ACTIVE' OR validity_status IS NULL)
           ORDER BY rank LIMIT 10
```

### 6.3 SUPERSEDES Edge Filtering Logic

**Trigger:** Search results ready for filtering
**Input:** List of SearchResult
**Output:** Filtered list

**Processing Steps:**

```
function filterSuperseded(results):
    supersededIds = SET()

    // Layer 1: Check validity_status column
    if config.enableStatusMarking:
        for result in results:
            status = SELECT validity_status FROM knowledge_entries WHERE id = result.id
            if status == 'SUPERSEDED':
                supersededIds.add(result.id)

    // Layer 2: Check SUPERSEDES graph edges
    if config.enableGraphSupersedes:
        for result in results:
            if result.id IN supersededIds: continue  // already excluded
            edges = SELECT source_id FROM knowledge_graph_edges
                    WHERE target_id = result.id AND relation = 'SUPERSEDES'
            for edge in edges:
                // Chain resolution: only filter if superseder is still active
                supersederStatus = SELECT validity_status WHERE id = edge.source_id
                if supersederStatus != 'SUPERSEDED':
                    supersededIds.add(result.id)
                    break  // one active superseder is enough

    return results.filter(r => r.id NOT IN supersededIds)
```

---

## 7. Security Requirements

### 7.1 Authentication and Authorization

| Role | Permissions | Features |
|------|-------------|----------|
| KB System (automated) | Execute | detectAndResolve, filterSuperseded (internal calls) |
| System Admin | Execute | manualSupersede, revalidate, getStats |
| AI Agent | Read only | Receives filtered results (no direct resolver access) |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| KB Entry Content | Internal | Business context, not PII |
| Confidence Scores | Internal | Diagnostic/operational data |
| LLM API Key | Confidential | Must not appear in logs or responses |
| Audit Log | Internal | Operational audit trail |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance — Ingest | Detection should not slow down ingest significantly | < 50ms per entry (entity lookup + FTS, 20 candidates max) |
| Performance — Search | Filtering should be imperceptible to users | < 10ms per result set (20 results or fewer, indexed queries) |
| Reliability | System must never lose search results due to errors | Graceful degradation: on error, return unfiltered results |
| Data Integrity | No permanent data loss from supersession | Status change only (no deletion); revalidation available |
| Compatibility | Same behavior across all platform variants | Same algorithm, same signals, same thresholds in NodeJS/Python/Kotlin |
| Auditability | All resolutions must be traceable | Every resolution logged with signal, confidence, entry IDs, timestamp |
| Configuration | Strategies toggleable without restart | Runtime config update API (updateConfig) |
| Scalability | Must work at expected KB scale | < 100K entries per instance; indexed queries |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Entry not found during detection | Info | None | Silent return of empty result |
| DB error during status marking | Warning | None | Detection result returned without resolution |
| LLM timeout | Info | None | Return unfiltered results (transparent to user) |
| LLM parse error | Info | None | Return unfiltered results |
| FTS table missing | Warning | None | Entity-based detection still works; FTS fallback unavailable |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Resolution applied (1+ entry superseded) | memory_audit table | DB record | Immediate |
| LLM consolidation failure | stderr/logger | Log file | Immediate |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Entry with "huy bo" signal + shared entity supersedes | New entry with signal + existing entry sharing entity | Old entry SUPERSEDED, confidence >= 0.7 | High |
| TC-02 | Entry with "cancel" + no shared entities | New entry with signal but no entity overlap | FTS fallback finds similar entries | High |
| TC-03 | Low confidence (< 0.6) does not resolve | Weak signal, no temporal/source match | Detection recorded but no marking | High |
| TC-04 | Search filters SUPERSEDED entries | Search returns mix of ACTIVE and SUPERSEDED | Only ACTIVE entries in final result | High |
| TC-05 | Chain resolution protects entry | B supersedes A, C supersedes B | A not filtered (B is inactive), B filtered, C returned | High |
| TC-06 | Manual supersede immediate effect | Admin calls manualSupersede(A, B) | A has status SUPERSEDED, SUPERSEDES edge exists | High |
| TC-07 | Revalidate restores entry | Admin calls revalidate(A) | A has status ACTIVE, appears in search | Medium |
| TC-08 | LLM disabled passthrough | LLM not configured | consolidateWithLlm returns original results | High |
| TC-09 | LLM timeout graceful degradation | LLM configured but unresponsive | Original results returned unchanged | High |
| TC-10 | Both strategies disabled no filtering | config: status=false, graph=false | filterSuperseded returns original list | Medium |
| TC-11 | Stats reflect DB state | After several resolutions | Correct counts for superseded, active, edges | Low |
| TC-12 | Duplicate edge prevention | Same contradiction detected twice | Only 1 SUPERSEDES edge created | Medium |

---

## 11. Appendix

### Supersession Signal Keywords (Complete List)

**Vietnamese:** huy bo, huy, bai bo, thay the, khong con, da xoa, cap nhat lai, sua lai, thay doi, chuyen sang, dung, ngung, loai bo, deprecated, da cu, khong dung nua

**English:** cancel, cancelled, revoke, revoked, supersede, superseded, replace, replaced, override, overridden, deprecate, no longer, removed, deleted, instead of, changed to, updated to, migrated to, switched to, stop using, do not use, obsolete, invalid, was wrong, correction

**Strong Signals (extra +0.2):** huy bo, cancel, replace, supersede, deprecated, obsolete, revoke

### Platform Implementation Matrix

| Platform | Language | Module Path | Entry Point |
|----------|----------|-------------|-------------|
| NodeJS | TypeScript | mcp-code-intelligence-nodejs/src/memory/contradiction-resolver.ts | class ContradictionResolver |
| Python | Python 3.11+ | mcp-code-intelligence-python/src/mcp_code_intel/memory/contradiction_resolver.py | class ContradictionResolver |
| Kotlin/MCP | Kotlin | mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/memory/contradiction/ | class ContradictionResolver |
| Kotlin/SDLC | Kotlin | sdlc-memory/src/main/kotlin/com/fec/memory/contradiction/ContradictionResolver.kt | class ContradictionResolver |

### State Diagram — Entry Validity Lifecycle

![State Diagram](diagrams/state-validity.png)

### Sequence Diagram — Ingest Flow

![Sequence Diagram](diagrams/sequence-ingest.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
| 3 | State — Validity Lifecycle | [state-validity.png](diagrams/state-validity.png) | [state-validity.drawio](diagrams/state-validity.drawio) |
| 4 | Sequence — Ingest Flow | [sequence-ingest.png](diagrams/sequence-ingest.png) | [sequence-ingest.drawio](diagrams/sequence-ingest.drawio) |

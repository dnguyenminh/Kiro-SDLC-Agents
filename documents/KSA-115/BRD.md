# Business Requirements Document (BRD)

## Code Intelligence MCP Server — KSA-115: Auto-Linking Logic on KB Ingest

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-115 |
| Title | Auto-Linking Logic on KB Ingest |
| Author | BA Agent (SM-driven) |
| Version | 1.0 |
| Date | 2026-05-31 |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-31 | SM Agent | Initiate document — feature planning for auto-linking on ingest |

---

## 1. Introduction

### 1.1 Scope

Implement automatic relationship detection and graph edge creation when new knowledge entries are ingested into the Knowledge Base (KB). Currently, the `IngestPipeline` stores entries, generates embeddings, and extracts structured maps, but does NOT create graph edges to related existing entries. Users must manually call `mem_graph` (action: `add_edge`) to link entries.

This feature will add an **auto-linking step** at the end of the ingest pipeline that:
1. Detects semantically related existing entries
2. Identifies shared entities, tags, and topic overlap
3. Automatically creates weighted graph edges between the new entry and related entries

### 1.2 Out of Scope

- Modifying the existing `mem_graph` manual edge creation API (it remains as-is)
- Changing the graph visualization (KSA-120 handles that separately)
- Cross-workspace linking (only within the same SQLite DB)
- Real-time re-linking of existing entries when they are updated (future enhancement)
- Removing or merging duplicate entries (handled by `mem_consolidate`)

### 1.3 Preliminary Requirements

| Prerequisite | Status |
|-------------|--------|
| `knowledge_graph_edges` table exists | ✅ Already in schema |
| `knowledge_vectors` table with embeddings | ✅ Already populated on ingest |
| `knowledge_fts` FTS5 index | ✅ Already populated on ingest |
| Entity extraction (`structured_map`) | ✅ Already runs on ingest |
| `GraphRepository.addEdge()` method | ✅ Already implemented |

---

## 2. Business Requirements

### 2.1 High Level Process Map

![Ingest Pipeline Flow](diagrams/ingest-pipeline-flow.png)

When a new entry is ingested via `mem_ingest` or `mem_ingest_file`:

**Step 1:** Quality gate validation (existing)
**Step 2:** Insert entry into `knowledge_entries` (existing)
**Step 3:** Generate embedding vector (existing)
**Step 4:** Extract structured map + entities (existing)
**Step 5:** **[NEW] Auto-link: detect related entries and create graph edges**
**Step 6:** Return ingest result (existing, enhanced with link count)

### 2.2 List of User Stories

| # | Story | Priority | Source |
|---|-------|----------|--------|
| 1 | Auto-link by semantic similarity (vector cosine) | MUST HAVE | KSA-115 |
| 2 | Auto-link by shared entities | MUST HAVE | KSA-115 |
| 3 | Auto-link by shared tags | SHOULD HAVE | KSA-115 |
| 4 | Auto-link by FTS topic overlap | SHOULD HAVE | KSA-115 |
| 5 | Configurable linking thresholds | MUST HAVE | KSA-115 |
| 6 | Link deduplication (no duplicate edges) | MUST HAVE | KSA-115 |
| 7 | Ingest response includes link count | SHOULD HAVE | KSA-115 |
| 8 | Batch re-link existing entries (backfill) | COULD HAVE | KSA-115 |

---

### 2.3 Details of User Stories

---

#### STORY 1: Auto-link by Semantic Similarity

> As a developer using the KB, I want newly ingested entries to be automatically linked to semantically similar existing entries so that the knowledge graph grows organically without manual effort.

**Requirement Details:**

1. After embedding is generated for the new entry, perform a vector similarity search against all existing entries in `knowledge_vectors`
2. Use cosine similarity as the distance metric
3. Entries with similarity score >= threshold (default: 0.75) are candidates for linking
4. Create a graph edge with relation type `SIMILAR_TO` and weight = similarity score
5. Limit: max 5 auto-links per ingest (configurable)

**Algorithm:**

```
newVector = embed(newEntry.summary)
candidates = vectorSearch(newVector, limit=10, minScore=0.75)
for each candidate where candidate.id != newEntry.id:
    if not edgeExists(newEntry.id, candidate.id):
        addEdge(source=newEntry.id, target=candidate.id, relation="SIMILAR_TO", weight=score)
```

**Acceptance Criteria:**

1. When a new entry is ingested with embedding enabled, related entries with cosine similarity >= 0.75 get linked automatically
2. Edge weight reflects the actual similarity score (0.75 - 1.0)
3. No duplicate edges are created (check before insert)
4. Maximum 5 edges created per ingest operation
5. If embedding service is unavailable, this step is skipped gracefully (no error)

---

#### STORY 2: Auto-link by Shared Entities

> As a developer, I want entries that mention the same entities (classes, functions, modules, people) to be automatically linked so that I can trace knowledge about specific concepts.

**Requirement Details:**

1. After structured map extraction, read `entities_mentioned` from the new entry
2. Query `entity_index` table for other entries that share >= 1 entity
3. Score: number of shared entities / total unique entities between both entries (Jaccard coefficient)
4. Create edge with relation type `SHARES_ENTITY` if Jaccard >= 0.3
5. Store shared entity names in edge `metadata` field as JSON

**Data Fields:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| relation | TEXT | Edge relation type | `SHARES_ENTITY` |
| weight | REAL | Jaccard coefficient (0.3 - 1.0) | 0.67 |
| metadata | JSON | Shared entity names | `{"shared": ["UserService", "AuthModule"]}` |

**Acceptance Criteria:**

1. Entries sharing >= 1 entity with Jaccard >= 0.3 get linked with `SHARES_ENTITY` relation
2. Edge metadata contains the list of shared entities
3. Works even when embedding service is unavailable
4. Maximum 5 entity-based edges per ingest

---

#### STORY 3: Auto-link by Shared Tags

> As a developer, I want entries with overlapping tags to be linked so that tag-based knowledge clusters form automatically.

**Requirement Details:**

1. Compare new entry's tags with existing entries' tags
2. Score: number of shared tags / total unique tags (Jaccard)
3. Create edge with relation `SHARES_TAG` if >= 2 tags overlap
4. Weight = Jaccard coefficient of tag sets

**Acceptance Criteria:**

1. Entries sharing >= 2 tags get linked with `SHARES_TAG` relation
2. Single shared tag is NOT sufficient (too noisy)
3. Edge weight reflects tag overlap ratio
4. Maximum 3 tag-based edges per ingest

---

#### STORY 4: Auto-link by FTS Topic Overlap

> As a developer, I want entries about the same topic (detected via full-text search) to be linked when other signals are weak.

**Requirement Details:**

1. Extract top 5 significant words from new entry's summary (length > 3, not stopwords)
2. Run FTS5 MATCH query with these words
3. Score results by FTS rank
4. Create edge with relation `TOPIC_OVERLAP` for top matches not already linked by other methods
5. This is a fallback — only creates edges if the entry has < 2 edges from Stories 1-3

**Acceptance Criteria:**

1. FTS-based linking only triggers when entry has fewer than 2 edges from other methods
2. Maximum 3 FTS-based edges per ingest
3. Relation type is `TOPIC_OVERLAP` with weight based on FTS rank (normalized 0-1)

---

#### STORY 5: Configurable Linking Thresholds

> As a system administrator, I want to configure auto-linking behavior so that I can tune aggressiveness based on KB size and use case.

**Requirement Details:**

1. Configuration stored in a config object (not DB — runtime config)
2. Configurable parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `autoLink.enabled` | `true` | Master switch for auto-linking |
| `autoLink.semantic.minScore` | `0.75` | Minimum cosine similarity |
| `autoLink.semantic.maxEdges` | `5` | Max edges from semantic similarity |
| `autoLink.entity.minJaccard` | `0.3` | Minimum entity Jaccard score |
| `autoLink.entity.maxEdges` | `5` | Max edges from shared entities |
| `autoLink.tag.minOverlap` | `2` | Minimum shared tags |
| `autoLink.tag.maxEdges` | `3` | Max edges from shared tags |
| `autoLink.fts.enabled` | `true` | Enable FTS fallback |
| `autoLink.fts.maxEdges` | `3` | Max edges from FTS |
| `autoLink.totalMaxEdges` | `10` | Total max edges per ingest |

**Acceptance Criteria:**

1. All thresholds are configurable at runtime
2. Setting `autoLink.enabled = false` disables all auto-linking
3. Individual methods can be disabled independently
4. `totalMaxEdges` caps the total regardless of individual method limits

---

#### STORY 6: Link Deduplication

> As a system, I must not create duplicate edges between the same pair of entries.

**Requirement Details:**

1. Before creating any edge, check if an edge already exists between source and target (in either direction)
2. If edge exists with same relation type → skip
3. If edge exists with different relation type → create new edge (multiple relation types allowed)
4. Use a single SQL query for batch dedup check

**Acceptance Criteria:**

1. No duplicate edges (same source, target, relation) are ever created
2. Multiple edges between same pair with DIFFERENT relations are allowed (e.g., `SIMILAR_TO` + `SHARES_ENTITY`)
3. Direction-agnostic check: edge(A->B) prevents creating edge(B->A) with same relation

---

#### STORY 7: Ingest Response Enhancement

> As a developer calling `mem_ingest`, I want to see how many auto-links were created so I can verify the KB is growing its graph.

**Requirement Details:**

1. `mem_ingest` response includes: `"Auto-linked: {N} edges created ({methods})"`
2. Methods listed: e.g., "3 semantic, 2 entity, 1 tag"
3. If auto-linking is disabled or no links created: `"Auto-linked: 0 (disabled/no matches)"`

**Acceptance Criteria:**

1. Ingest response always includes auto-link count
2. Breakdown by method is included
3. Zero links is reported (not silently omitted)

---

#### STORY 8: Batch Re-link (Backfill)

> As a developer, I want to run auto-linking on all existing entries that have no graph edges so that the knowledge graph is populated for entries ingested before this feature.

**Requirement Details:**

1. New tool action: `mem_graph` action `auto_link` with optional `entry_id` parameter
2. If `entry_id` provided → run auto-linking for that specific entry
3. If no `entry_id` → find all entries with 0 edges and run auto-linking (batch, max 50 per call)
4. Report: `"Backfill: processed {N} entries, created {M} edges"`

**Acceptance Criteria:**

1. `mem_graph` action `auto_link` triggers auto-linking for specified or orphan entries
2. Batch mode processes max 50 entries per call (pagination via repeated calls)
3. Does not create duplicate edges
4. Reports progress

---

## 3. Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| EmbeddingService | System | Required for semantic similarity (Story 1). Graceful degradation if unavailable. |
| EntityRepository | System | Required for entity-based linking (Story 2). Already injected into IngestPipeline. |
| GraphRepository | System | Required for edge creation. Already available via MemoryEngine. |
| knowledge_vectors table | Data | Must be populated for vector search. Already done during ingest. |
| knowledge_fts table | Data | Must be populated for FTS overlap. Already done via trigger. |

---

## 4. Stakeholders

| Role | Responsibility |
|------|----------------|
| Developer (user) | Uses KB via MCP tools, benefits from auto-linked graph |
| SM Agent | Orchestrates pipeline, verifies KB ingest includes linking |
| SA Agent | Designs technical implementation |
| DEV Agent | Implements auto-linking in IngestPipeline |
| QA Agent | Tests linking accuracy and performance |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Over-linking (too many noisy edges) | Medium | Medium | Configurable thresholds + max edge caps |
| Performance degradation on large KBs (>10K entries) | High | Medium | Limit candidate search to top-N, use indexed queries |
| Embedding service latency blocks ingest | High | Low | Make auto-linking async/fire-and-forget like current embedding |
| Circular edge creation | Low | Low | Direction-agnostic dedup prevents A->B + B->A |

### 5.2 Assumptions

- Embedding vectors are available synchronously (or cached) by the time auto-linking runs. If async, auto-linking may need to be deferred.
- The KB typically has < 50,000 entries per workspace (performance target)
- Edge creation is cheap (single INSERT, no cascading effects)
- Existing `SuggestionEngine.computeRelated()` logic can be partially reused for scoring

---

## 6. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | Auto-linking must complete within 500ms for KBs with < 10K entries | < 500ms |
| Performance | Auto-linking must complete within 2s for KBs with < 50K entries | < 2000ms |
| Reliability | Auto-linking failure must NOT block or fail the ingest operation | Fire-and-forget |
| Scalability | Must handle KBs growing to 50K entries without degradation | O(log N) search |
| Observability | Log auto-link results (entry ID, edges created, time taken) | stderr logging |

---

## 7. Technical Context (for SA/DEV reference)

### Architecture Overview

![Auto-Link Architecture](diagrams/auto-link-architecture.png)

### Current Architecture

```
IngestPipeline.ingestEntry()
  |-- qualityGate.validate()
  |-- repo.insert()           -> knowledge_entries
  |-- tryEmbed()              -> knowledge_vectors (async)
  |-- tryExtractMap()         -> structured_map + entity_index
  +-- [MISSING] tryAutoLink() -> knowledge_graph_edges
```

### Key Files

| File | Purpose |
|------|---------|
| `src/memory/ingest-pipeline.ts` | Main ingest flow — add auto-link step here |
| `src/memory/graph-repo.ts` | GraphRepository — `addEdge()`, `getConnected()` |
| `src/memory/v2/suggestion-engine.ts` | Related entry scoring logic (reusable) |
| `src/memory/schema.ts` | DB schema — `knowledge_graph_edges` table |
| `src/memory/embedding/index.ts` | EmbeddingService — vector search |
| `src/memory/entity-repo.ts` | EntityRepository — entity index queries |

### Proposed New Files

| File | Purpose |
|------|---------|
| `src/memory/auto-linker.ts` | AutoLinker class — orchestrates all linking strategies |
| `src/memory/linking-strategies/` | Directory for individual strategy implementations |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Auto-linking | Automatic creation of graph edges between related KB entries during ingest |
| Cosine similarity | Vector distance metric (0-1) measuring semantic closeness |
| Jaccard coefficient | Set overlap metric: |A intersection B| / |A union B| |
| Graph edge | Directed relationship between two KB entries in `knowledge_graph_edges` |
| FTS5 | SQLite full-text search engine used for topic matching |

### Relation Types (New)

| Relation | Created By | Weight Range | Description |
|----------|-----------|--------------|-------------|
| `SIMILAR_TO` | Semantic similarity | 0.75 - 1.0 | Entries with similar meaning/content |
| `SHARES_ENTITY` | Entity overlap | 0.3 - 1.0 | Entries mentioning same code entities |
| `SHARES_TAG` | Tag overlap | 0.4 - 1.0 | Entries with overlapping tags |
| `TOPIC_OVERLAP` | FTS matching | 0.3 - 1.0 | Entries about similar topics (fallback) |
| `RELATES_TO` | Manual (existing) | 1.0 | Manually created by user via mem_graph |

### Reference: Existing Edge Relations in Use

Currently, edges are only created manually via `mem_graph add_edge`. Common manual relations:
- `RELATES_TO` (default)
- `DEPENDS_ON`
- `IMPLEMENTS`
- `CONTRADICTS`

Auto-linking will introduce new relation types that coexist with manual ones.

---

## 9. Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Ingest Pipeline Flow | [ingest-pipeline-flow.png](diagrams/ingest-pipeline-flow.png) | [ingest-pipeline-flow.drawio](diagrams/ingest-pipeline-flow.drawio) |
| 2 | Auto-Link Architecture | [auto-link-architecture.png](diagrams/auto-link-architecture.png) | [auto-link-architecture.drawio](diagrams/auto-link-architecture.drawio) |

# Functional Specification Document (FSD)

## Code Intelligence MCP Server — KSA-190: Auto-Linking Logic on KB Ingest

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-190 |
| Title | Auto-Linking Logic on KB Ingest |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-31 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-190.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-31 | BA + TA Agent | Initial FSD — full specification from BRD |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Auto-Linking feature for the Knowledge Base ingest pipeline. It defines use cases, business rules, data specifications, and API contracts that enable automatic graph edge creation when new entries are ingested.

### 1.2 Scope

- Automatic detection of related entries using 4 strategies: semantic similarity, shared entities, shared tags, and FTS topic overlap
- Graph edge creation with typed relations and weighted scores
- Configurable thresholds and limits
- Batch backfill capability for existing entries
- Enhanced ingest response with link count

### 1.3 Definitions and Acronyms

| Term | Definition |
|------|------------|
| Auto-linking | Automatic creation of graph edges between related KB entries during ingest |
| Cosine similarity | Vector distance metric (0-1) measuring semantic closeness |
| Jaccard coefficient | Set overlap metric: intersection / union of two sets |
| FTS5 | SQLite full-text search engine |
| Edge | Directed relationship in knowledge_graph_edges table |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-190.docx |
| Ingest Pipeline Source | src/memory/ingest-pipeline.ts |
| Graph Repository | src/memory/graph-repo.ts |
| Entity Repository | src/memory/entity-repo.ts |
| Vector Repository | src/memory/vector-repo.ts |
| Suggestion Engine | src/memory/v2/suggestion-engine.ts |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The Auto-Linking subsystem operates within the IngestPipeline after entry storage and embedding generation. It interacts with:
- **VectorRepository** — for semantic similarity search
- **EntityRepository** — for shared entity detection
- **KnowledgeRepository** — for tag and FTS queries
- **GraphRepository** — for edge creation and dedup checks

### 2.2 Current vs. Proposed Flow

**Current IngestPipeline flow:**
1. Quality gate validation
2. Insert entry into knowledge_entries
3. Generate embedding (async)
4. Extract structured map + entities

**Proposed flow (additions in bold):**
1. Quality gate validation
2. Insert entry into knowledge_entries
3. Generate embedding (async)
4. Extract structured map + entities
5. **Auto-link: detect related entries and create graph edges**
6. **Return enhanced result with link count**

---

## 3. Use Cases

### 3.1 UC-01: Auto-Link on Single Entry Ingest

**Actor:** Developer (via mem_ingest MCP tool)
**Precondition:** KB has existing entries with embeddings and entities indexed
**Trigger:** Developer calls mem_ingest with content, summary, type, tags

#### Main Flow

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer calls mem_ingest | Validates quality gate |
| 2 | | Inserts entry, generates embedding, extracts entities |
| 3 | | Invokes AutoLinker.link(entryId) |
| 4 | | Runs semantic similarity strategy |
| 5 | | Runs shared entity strategy |
| 6 | | Runs shared tag strategy |
| 7 | | Runs FTS fallback (if < 2 edges from steps 4-6) |
| 8 | | Deduplicates candidate edges |
| 9 | | Creates edges (respecting totalMaxEdges cap) |
| 10 | | Returns IngestEntryResult with linkCount |

#### Alternative Flow: Embedding Unavailable

| Step | Condition | System |
|------|-----------|--------|
| 4a | EmbeddingService is null or embed fails | Skip semantic similarity strategy |
| 4b | | Continue with entity, tag, and FTS strategies only |

#### Alternative Flow: Auto-Linking Disabled

| Step | Condition | System |
|------|-----------|--------|
| 3a | autoLink.enabled = false | Skip all linking |
| 3b | | Return IngestEntryResult with linkCount = 0 |

#### Exception Flow: Auto-Linking Error

| Step | Condition | System |
|------|-----------|--------|
| 3x | Any error in AutoLinker | Log error to stderr |
| 3y | | Return IngestEntryResult normally (linking is fire-and-forget) |

**Postcondition:** Entry is stored, 0-10 graph edges created to related entries

---

### 3.2 UC-02: Auto-Link on File Ingest

**Actor:** Developer (via mem_ingest_file MCP tool)
**Precondition:** File exists at specified path
**Trigger:** Developer calls mem_ingest_file with file_path

#### Main Flow

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer calls mem_ingest_file | Reads file, chunks by sections |
| 2 | | For each chunk: insert, embed, extract map |
| 3 | | For each chunk: invoke AutoLinker.link(chunkEntryId) |
| 4 | | Aggregate link counts across all chunks |
| 5 | | Return result with total linkCount |

#### Alternative Flow: Large File (many chunks)

| Step | Condition | System |
|------|-----------|--------|
| 3a | File produces > 10 chunks | Auto-link only first 5 chunks (performance guard) |
| 3b | | Log: "Auto-linking limited to first 5 chunks for performance" |

---

### 3.3 UC-03: Batch Backfill (Re-link Existing Entries)

**Actor:** Developer (via mem_graph action: auto_link)
**Precondition:** KB has entries with 0 graph edges
**Trigger:** Developer calls mem_graph with action=auto_link

#### Main Flow

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer calls mem_graph action=auto_link | Queries entries with 0 edges |
| 2 | | Selects up to 50 orphan entries |
| 3 | | For each: invoke AutoLinker.link(entryId) |
| 4 | | Aggregate results |
| 5 | | Return: "Backfill: processed N entries, created M edges" |

#### Alternative Flow: Specific Entry

| Step | Condition | System |
|------|-----------|--------|
| 1a | entry_id parameter provided | Run auto-linking for that specific entry only |
| 1b | | Return: "Auto-linked entry #ID: N edges created" |

---

### 3.4 UC-04: Configure Auto-Linking Thresholds

**Actor:** System Administrator
**Precondition:** Server is running
**Trigger:** Configuration change (environment variable or config object)

#### Main Flow

| Step | Actor | System |
|------|-------|--------|
| 1 | Admin sets autoLink.semantic.minScore = 0.8 | Config loaded at startup |
| 2 | | AutoLinker uses new threshold for all subsequent ingests |

**Note:** Configuration is runtime-only (in-memory). No DB persistence for config.

---

## 4. Business Rules

| ID | Rule | Applies To |
|----|------|-----------|
| BR-01 | Semantic similarity threshold must be >= 0.5 and <= 1.0 | UC-01, UC-03 |
| BR-02 | Entity Jaccard threshold must be >= 0.1 and <= 1.0 | UC-01, UC-03 |
| BR-03 | Tag overlap minimum must be >= 1 (integer) | UC-01, UC-03 |
| BR-04 | FTS fallback only triggers when entry has < 2 edges from other strategies | UC-01, UC-03 |
| BR-05 | No duplicate edges: same (source, target, relation) pair cannot exist twice | All |
| BR-06 | Direction-agnostic dedup: edge(A,B,R) prevents edge(B,A,R) | All |
| BR-07 | Multiple relations between same pair are allowed (SIMILAR_TO + SHARES_ENTITY) | All |
| BR-08 | totalMaxEdges caps all strategies combined per single ingest | UC-01, UC-02 |
| BR-09 | Auto-linking failure must never block or fail the ingest operation | All |
| BR-10 | Self-linking is prohibited (entry cannot link to itself) | All |

---

## 5. Data Specifications

### 5.1 Auto-Link Configuration Schema

```typescript
interface AutoLinkConfig {
  enabled: boolean;                    // Master switch (default: true)
  semantic: {
    enabled: boolean;                  // default: true
    minScore: number;                  // default: 0.75, range [0.5, 1.0]
    maxEdges: number;                  // default: 5
  };
  entity: {
    enabled: boolean;                  // default: true
    minJaccard: number;                // default: 0.3, range [0.1, 1.0]
    maxEdges: number;                  // default: 5
  };
  tag: {
    enabled: boolean;                  // default: true
    minOverlap: number;                // default: 2, range [1, 10]
    maxEdges: number;                  // default: 3
  };
  fts: {
    enabled: boolean;                  // default: true
    maxEdges: number;                  // default: 3
    fallbackThreshold: number;         // default: 2 (only trigger if < N edges)
  };
  totalMaxEdges: number;               // default: 10
}
```

### 5.2 Auto-Link Result Schema

```typescript
interface AutoLinkResult {
  entryId: number;
  edgesCreated: number;
  breakdown: {
    semantic: number;
    entity: number;
    tag: number;
    fts: number;
  };
  skipped: number;                     // edges skipped due to dedup
  timeMs: number;                      // execution time in milliseconds
}
```

### 5.3 Edge Data Model (existing table: knowledge_graph_edges)

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| source_id | INTEGER FK | References knowledge_entries.id |
| target_id | INTEGER FK | References knowledge_entries.id |
| relation | TEXT | SIMILAR_TO, SHARES_ENTITY, SHARES_TAG, TOPIC_OVERLAP, RELATES_TO |
| weight | REAL | Score (0.0 - 1.0) |
| metadata | TEXT (JSON) | Strategy-specific data |
| created_at | TEXT | ISO timestamp |

### 5.4 Metadata JSON Schemas by Relation Type

**SIMILAR_TO:**
```json
{ "method": "cosine", "model": "onnx-minilm" }
```

**SHARES_ENTITY:**
```json
{ "shared": ["UserService", "AuthModule"], "jaccard": 0.67 }
```

**SHARES_TAG:**
```json
{ "shared_tags": ["architecture", "memory"], "overlap_count": 3 }
```

**TOPIC_OVERLAP:**
```json
{ "query_words": ["ingest", "pipeline", "embedding"], "fts_rank": 0.82 }
```

---

## 6. API Contracts

### 6.1 Enhanced mem_ingest Response

**Current response format:**
```
Ingested entry #42 (type: ARCHITECTURE, tier: SEMANTIC, quality: 78/100)
```

**New response format:**
```
Ingested entry #42 (type: ARCHITECTURE, tier: SEMANTIC, quality: 78/100). Auto-linked: 4 edges (2 semantic, 1 entity, 1 tag)
```

**When auto-linking disabled or no matches:**
```
Ingested entry #42 (type: ARCHITECTURE, tier: SEMANTIC, quality: 78/100). Auto-linked: 0 (disabled)
```

### 6.2 New mem_graph Action: auto_link

**Input parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | Must be "auto_link" |
| entry_id | number | No | Specific entry to auto-link. If omitted, batch backfill orphans |

**Response (specific entry):**
```
Auto-linked entry #42: 5 edges created (3 semantic, 1 entity, 1 tag). Time: 120ms
```

**Response (batch backfill):**
```
Backfill: processed 23 entries, created 67 edges. Time: 2340ms
Breakdown: 34 semantic, 18 entity, 10 tag, 5 fts
```

### 6.3 Error Responses

| Scenario | Response |
|----------|----------|
| entry_id not found | "Error: entry #99 not found" |
| Auto-linking disabled globally | "Auto-linking is disabled (autoLink.enabled = false)" |
| No orphan entries for backfill | "Backfill: 0 entries need linking (all entries have edges)" |

---

## 7. Integration Requirements

### 7.1 IngestPipeline Integration Point

The AutoLinker must be called AFTER:
- Entry is inserted (has valid ID)
- Embedding is generated (for semantic strategy)
- Structured map is extracted (for entity strategy)

**Integration code location:** `src/memory/ingest-pipeline.ts` method `ingestEntry()`

**Injection pattern:** Same as existing services (constructor injection or setter):
```typescript
class IngestPipeline {
  private autoLinker: AutoLinker | null = null;
  
  setAutoLinker(linker: AutoLinker): void {
    this.autoLinker = linker;
  }
}
```

### 7.2 MemoryEngine Integration

The `MemoryEngine` (main orchestrator) must:
1. Create AutoLinker instance with dependencies (GraphRepo, VectorRepo, EntityRepo, EmbeddingService)
2. Inject into IngestPipeline via `setAutoLinker()`
3. Register `auto_link` action in mem_graph tool handler

### 7.3 Dependency Graph

```
MemoryEngine
  └── IngestPipeline
        └── AutoLinker
              ├── SemanticStrategy → EmbeddingService + VectorRepository
              ├── EntityStrategy → EntityRepository
              ├── TagStrategy → KnowledgeRepository (SQL query)
              └── FtsStrategy → KnowledgeRepository (FTS5 query)
              └── GraphRepository (edge creation + dedup)
```

---

## 8. Non-Functional Requirements

| Category | Requirement | Target | Measurement |
|----------|-------------|--------|-------------|
| Performance | Auto-link latency (< 10K entries) | < 500ms | Timer in AutoLinkResult.timeMs |
| Performance | Auto-link latency (< 50K entries) | < 2000ms | Timer in AutoLinkResult.timeMs |
| Performance | Batch backfill (50 entries) | < 30s | Total execution time |
| Reliability | Ingest must not fail due to auto-linking | 100% | Error isolation via try/catch |
| Scalability | Vector search must use indexed approach | O(N) brute-force acceptable for < 50K | Profile at scale |
| Observability | Log auto-link results | Every ingest | stderr logging with entry ID, edge count, time |

---

## 9. UI Specifications

This feature has no UI component. All interaction is via MCP tool calls (CLI/API).

---

## 10. State Diagram

![Auto-Link State](diagrams/auto-link-state.png)

**States for a single auto-link operation:**
- IDLE → LINKING (triggered by ingest)
- LINKING → SEMANTIC_SEARCH → ENTITY_SEARCH → TAG_SEARCH → FTS_SEARCH → DEDUP → COMMIT → DONE
- Any state → ERROR → DONE (graceful failure)

---

## 11. Sequence Diagrams

### 11.1 Single Entry Ingest with Auto-Linking

![Ingest Sequence](diagrams/ingest-sequence.png)

### 11.2 Batch Backfill Sequence

![Backfill Sequence](diagrams/backfill-sequence.png)

---

## 12. Open Issues

| ID | Issue | Impact | Decision Needed |
|----|-------|--------|-----------------|
| OI-01 | Should embedding be awaited before auto-linking? Currently async. | If not awaited, semantic strategy may have no vector | Await embed before auto-link, or skip semantic if vector not ready |
| OI-02 | Should auto-linking run synchronously or in background? | Sync adds latency to ingest; async may miss edges on immediate query | Recommend sync (< 500ms target is acceptable) |
| OI-03 | Should backfill respect totalMaxEdges per entry? | Consistency vs. allowing more edges for backfill | Yes, same limits apply |

---

## 13. Pseudocode

### 13.1 AutoLinker.link(entryId)

```
function link(entryId: number): AutoLinkResult {
  if (!config.enabled) return emptyResult(entryId)
  
  startTime = now()
  candidates: Map<number, CandidateEdge[]> = new Map()
  
  // Strategy 1: Semantic similarity
  if (config.semantic.enabled) {
    vector = vectorRepo.getVector(entryId)
    if (vector) {
      allVectors = vectorRepo.findAll()
      for each (otherId, otherVector) in allVectors:
        if otherId == entryId: continue
        score = cosineSimilarity(vector, otherVector)
        if score >= config.semantic.minScore:
          addCandidate(candidates, otherId, "SIMILAR_TO", score, {method: "cosine"})
    }
    // Sort by score desc, take top maxEdges
    trimCandidates(candidates, "SIMILAR_TO", config.semantic.maxEdges)
  }
  
  // Strategy 2: Shared entities
  if (config.entity.enabled) {
    myEntities = entityRepo.getEntities(entryId)
    if (myEntities.length > 0) {
      // Find other entries sharing entities
      for each entity in myEntities:
        otherEntryIds = entityRepo.findByEntity(entity.name)
        for each otherId in otherEntryIds:
          if otherId == entryId: continue
          otherEntities = entityRepo.getEntities(otherId)
          jaccard = computeJaccard(myEntities, otherEntities)
          if jaccard >= config.entity.minJaccard:
            shared = intersection(myEntities, otherEntities)
            addCandidate(candidates, otherId, "SHARES_ENTITY", jaccard, {shared})
    }
    trimCandidates(candidates, "SHARES_ENTITY", config.entity.maxEdges)
  }
  
  // Strategy 3: Shared tags
  if (config.tag.enabled) {
    myTags = getEntryTags(entryId)
    if (myTags.length >= config.tag.minOverlap) {
      // Query entries with overlapping tags
      matchingEntries = findEntriesWithTags(myTags, entryId)
      for each (otherId, sharedTags) in matchingEntries:
        if sharedTags.length >= config.tag.minOverlap:
          jaccard = sharedTags.length / union(myTags, otherTags).length
          addCandidate(candidates, otherId, "SHARES_TAG", jaccard, {shared_tags: sharedTags})
    }
    trimCandidates(candidates, "SHARES_TAG", config.tag.maxEdges)
  }
  
  // Strategy 4: FTS fallback
  currentEdgeCount = countCandidates(candidates)
  if (config.fts.enabled && currentEdgeCount < config.fts.fallbackThreshold) {
    summary = repo.getSummary(entryId)
    words = extractSignificantWords(summary, 5)
    ftsResults = ftsSearch(words, entryId, 10)
    for each (otherId, rank) in ftsResults:
      if not inCandidates(candidates, otherId):
        normalizedScore = normalizeRank(rank)
        addCandidate(candidates, otherId, "TOPIC_OVERLAP", normalizedScore, {query_words: words})
    trimCandidates(candidates, "TOPIC_OVERLAP", config.fts.maxEdges)
  }
  
  // Dedup and commit
  allEdges = flattenCandidates(candidates)
  allEdges = allEdges.sortByScore(desc).take(config.totalMaxEdges)
  
  created = 0, skipped = 0
  for each edge in allEdges:
    if edgeExists(edge.source, edge.target, edge.relation):
      skipped++
    else:
      graphRepo.addEdge(edge)
      created++
  
  return { entryId, edgesCreated: created, breakdown: countByType(allEdges), skipped, timeMs: elapsed() }
}
```

### 13.2 Cosine Similarity

```
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for i in 0..a.length:
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  return dot / (sqrt(normA) * sqrt(normB))
}
```

### 13.3 Edge Deduplication Check

```
function edgeExists(sourceId: number, targetId: number, relation: string): boolean {
  // Check both directions
  return db.prepare(`
    SELECT 1 FROM knowledge_graph_edges 
    WHERE ((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?))
    AND relation = ?
    LIMIT 1
  `).get(sourceId, targetId, targetId, sourceId, relation) !== undefined
}
```

---

## 14. Acceptance Criteria Summary

| UC | Criteria | Verification |
|----|----------|-------------|
| UC-01 | Ingest creates 0-10 edges automatically | Unit test: mock strategies, verify edge count |
| UC-01 | Semantic edges have weight >= 0.75 | Unit test: verify score threshold |
| UC-01 | Entity edges have Jaccard >= 0.3 | Unit test: verify Jaccard calculation |
| UC-01 | Tag edges require >= 2 shared tags | Unit test: verify minimum overlap |
| UC-01 | FTS only triggers when < 2 edges exist | Integration test: verify fallback logic |
| UC-01 | No duplicate edges created | Integration test: ingest same entry twice |
| UC-01 | Auto-link failure does not break ingest | Unit test: throw in AutoLinker, verify entry still created |
| UC-02 | File ingest auto-links each chunk | Integration test: ingest multi-section file |
| UC-03 | Backfill processes max 50 entries | Integration test: create 100 orphans, verify batch limit |
| UC-03 | Specific entry_id links only that entry | Unit test: verify single entry mode |
| UC-04 | Disabled config prevents all linking | Unit test: set enabled=false, verify 0 edges |

---

## 15. Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Auto-Link State | [auto-link-state.png](diagrams/auto-link-state.png) | [auto-link-state.drawio](diagrams/auto-link-state.drawio) |
| 3 | Ingest Sequence | [ingest-sequence.png](diagrams/ingest-sequence.png) | [ingest-sequence.drawio](diagrams/ingest-sequence.drawio) |
| 4 | Backfill Sequence | [backfill-sequence.png](diagrams/backfill-sequence.png) | [backfill-sequence.drawio](diagrams/backfill-sequence.drawio) |

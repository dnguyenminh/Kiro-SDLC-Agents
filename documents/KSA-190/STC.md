# Software Test Cases (STC)

## KSA-190: Auto-Linking Logic on KB Ingest

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-190 |
| Version | 1.0 |
| Date | 2026-05-31 |
| Related STP | STP-v1-KSA-190.docx |

---

## 1. Property-Based Tests (PBT)

### PBT-01: Cosine Similarity Properties

| Property | Description | Generator |
|----------|-------------|-----------|
| PBT-01a | cosineSimilarity(v, v) === 1.0 (self-similarity) | Random float32 vectors |
| PBT-01b | cosineSimilarity(v, -v) === -1.0 (opposite) | Random float32 vectors |
| PBT-01c | 0 <= cosineSimilarity(v, w) <= 1.0 for non-negative vectors | Random positive vectors |
| PBT-01d | cosineSimilarity is symmetric: sim(a,b) === sim(b,a) | Random vector pairs |

### PBT-02: Jaccard Coefficient Properties

| Property | Description | Generator |
|----------|-------------|-----------|
| PBT-02a | jaccard(A, A) === 1.0 (self) | Random string sets |
| PBT-02b | jaccard(A, empty) === 0.0 | Random set + empty |
| PBT-02c | 0 <= jaccard(A, B) <= 1.0 | Random set pairs |
| PBT-02d | jaccard is symmetric: jaccard(A,B) === jaccard(B,A) | Random set pairs |

---

## 2. Unit Tests (UT)

### SemanticStrategy

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-01 | Returns candidates above threshold | Entry with vector, 3 similar entries (scores: 0.9, 0.8, 0.6) | 2 candidates (0.9, 0.8); 0.6 excluded | P0 |
| UT-02 | Returns empty when no vector exists | Entry without embedding | [] | P0 |
| UT-03 | Respects maxEdges limit | 10 candidates above threshold, maxEdges=5 | Top 5 by score | P0 |

### EntityStrategy

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-04 | Detects shared entities with Jaccard >= 0.3 | Entry with [A,B,C], other with [B,C,D] | Jaccard=0.5, candidate created | P0 |
| UT-05 | Excludes low Jaccard | Entry with [A,B,C,D,E], other with [E] | Jaccard=0.2, excluded | P0 |
| UT-06 | Returns empty when entry has no entities | Entry with 0 entities | [] | P0 |

### TagStrategy

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-07 | Detects >= 2 shared tags | Entry tags="a,b,c", other tags="b,c,d" | Candidate with overlap=2 | P0 |
| UT-08 | Excludes single tag overlap | Entry tags="a,b", other tags="b,x" | [] (only 1 shared) | P0 |
| UT-09 | Handles empty tags gracefully | Entry tags="" | [] | P1 |

### FtsStrategy

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-10 | Extracts significant words and finds matches | Summary with 5+ words | FTS candidates returned | P1 |
| UT-11 | Returns empty on short summary | Summary="hi" | [] | P1 |

### AutoLinker (Orchestrator)

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-12 | Disabled config returns 0 edges | config.enabled=false | edgesCreated=0 | P0 |
| UT-13 | Individual strategy disabled | config.semantic.enabled=false | No semantic candidates | P0 |
| UT-14 | totalMaxEdges caps output | 15 candidates, totalMaxEdges=10 | 10 edges max | P0 |
| UT-15 | Dedup removes same (target, relation) | 2 candidates with same target+relation | 1 edge | P0 |
| UT-16 | Direction-agnostic dedup | Edge A->B exists, candidate B->A same relation | Skipped | P0 |
| UT-17 | Multiple relations allowed | Edge A->B SIMILAR_TO exists, candidate A->B SHARES_ENTITY | Both created | P0 |
| UT-18 | Backfill processes orphans | 5 entries with 0 edges | All 5 processed | P1 |

---

## 3. Integration Tests (IT)

| ID | Test Case | Setup | Action | Verification | Priority |
|----|-----------|-------|--------|-------------|----------|
| IT-01 | Full semantic linking | Insert 5 entries with vectors (3 similar) | Ingest new entry | 2-3 SIMILAR_TO edges created | P0 |
| IT-02 | Semantic unavailable graceful | No vectors in DB | Ingest entry | 0 semantic edges, no error | P0 |
| IT-03 | Entity linking end-to-end | Insert entries with shared entities | Ingest entry with overlapping entities | SHARES_ENTITY edges created | P0 |
| IT-04 | Tag linking end-to-end | Insert entries with tags "a,b,c" | Ingest entry with tags "b,c,d" | SHARES_TAG edge created | P0 |
| IT-05 | FTS fallback triggers | Insert entries, no vectors/entities | Ingest entry (< 2 edges from other methods) | TOPIC_OVERLAP edges created | P1 |
| IT-06 | Config change at runtime | Set minScore=0.9 | Ingest entry with 0.8 similarity | No semantic edge (below new threshold) | P1 |
| IT-07 | No duplicate edges on re-ingest | Ingest entry A, creates edge to B | Ingest entry A again (backfill) | No new duplicate edge | P0 |
| IT-08 | Backfill batch mode | Create 10 entries with 0 edges | Call backfill() | All 10 processed, edges created | P1 |

---

## 4. E2E-API Tests

| ID | Test Case | MCP Call | Expected Response | Priority |
|----|-----------|----------|-------------------|----------|
| E2E-01 | mem_ingest with auto-linking | mem_ingest(content, tags) | Response includes "Auto-linked: N edges" | P0 |
| E2E-02 | mem_ingest response format | mem_ingest(content) | Contains breakdown "(X semantic, Y entity, Z tag)" | P1 |
| E2E-03 | mem_graph auto_link backfill | mem_graph action=auto_link | "Backfill: processed N entries, created M edges" | P1 |
| E2E-04 | mem_graph auto_link specific entry | mem_graph action=auto_link entry_id=42 | "Auto-linked entry #42: N edges created" | P1 |
| E2E-05 | Auto-linking disabled response | Set enabled=false, mem_ingest | "Auto-linked: 0 (disabled)" | P1 |

---

## 5. Test Data

### 5.1 Vector Test Data (dim=4 for simplicity)

| Entry ID | Vector | Purpose |
|----------|--------|---------|
| 1 | [1.0, 0.0, 0.0, 0.0] | Base vector |
| 2 | [0.95, 0.05, 0.0, 0.0] | Very similar to #1 (cosine ~0.999) |
| 3 | [0.7, 0.7, 0.0, 0.0] | Moderately similar to #1 (cosine ~0.707) |
| 4 | [0.0, 0.0, 1.0, 0.0] | Orthogonal to #1 (cosine = 0) |
| 5 | [0.8, 0.1, 0.1, 0.0] | Similar to #1 (cosine ~0.98) |

### 5.2 Entity Test Data

| Entry ID | Entities |
|----------|----------|
| 10 | [IngestPipeline, AutoLinker, GraphRepository] |
| 11 | [AutoLinker, SemanticStrategy, VectorRepository] |
| 12 | [GraphRepository, EntityRepository] |
| 13 | [UserService, AuthModule] (no overlap with 10-12) |

### 5.3 Tag Test Data

| Entry ID | Tags |
|----------|------|
| 20 | architecture, memory, graph |
| 21 | memory, graph, performance |
| 22 | security, auth |
| 23 | memory, embedding |

---

## 6. Summary

| Level | Total Cases | Automated | Manual |
|-------|-------------|-----------|--------|
| PBT | 8 properties | 8 | 0 |
| UT | 18 cases | 18 | 0 |
| IT | 8 cases | 8 | 0 |
| E2E-API | 5 cases | 5 | 0 |
| E2E-UI | 0 (no UI) | 0 | 0 |
| SIT | 2 scenarios | 0 | 2 |
| **Total** | **41** | **39** | **2** |

---

## 7. Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |

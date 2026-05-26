# Software Test Plan (STP)

## MCP Code Intelligence — KSA-177: [Kotlin] Similarity + Infrastructure

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-177 |
| Title | [Kotlin] Similarity + Infrastructure — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-177.docx |
| Related FSD | FSD-v1-KSA-177.docx |
| Related TDD | TDD-v1-KSA-177.docx |

---

## 1. Test Strategy Overview

### 1.1 Scope

Test the Similarity + Infrastructure module covering:
- 3 MCP tools: `find_duplicates`, `find_dead_code`, `git_search`
- Supporting components: EmbeddingService, VectorMath, ClusterBuilder, DeadCodeDetector, GitMiner
- ONNX Runtime integration
- Git CLI integration

### 1.2 Test Levels

| Level | Scope | Automation |
|-------|-------|------------|
| PBT | VectorMath invariants, Union-Find properties | 100% automated |
| UT | Individual classes/functions | 100% automated |
| IT | Service + DB + ONNX + Git interactions | 100% automated |
| E2E-API | MCP tool calls end-to-end | 100% automated |
| SIT | Parity with Python implementation | 80% automated |

### 1.3 Test Environment

| Component | Technology |
|-----------|-----------|
| Test Framework | JUnit 5 + Kotest |
| Mocking | MockK |
| Database | In-memory SQLite |
| ONNX | Real model (integration) / Mock (unit) |
| Git | Test repository (integration) |
| Property Testing | Kotest property testing |

---

## 2. Requirements Traceability Matrix

| BRD Story | FSD UC | Test Cases |
|-----------|--------|------------|
| Story 1: find_duplicates | UC-01 | PBT-01, UT-01..UT-06, IT-01..IT-03, E2E-01..E2E-03 |
| Story 2: find_dead_code | UC-02 | UT-07..UT-12, IT-04..IT-06, E2E-04..E2E-06 |
| Story 3: git_search | UC-03 | UT-13..UT-16, IT-07..IT-09, E2E-07..E2E-10 |
| Story 4: Suggestions | FSD §3.1 | UT-05..UT-06 |
| Story 5: Confidence | FSD §3.2 | UT-09..UT-12 |
| Story 6: Git filters | FSD §3.3 | UT-16, IT-09, E2E-09..E2E-10 |

---

## 3. Test Cases by Level

### 3.1 Property-Based Testing (PBT)

| ID | Property | Invariant |
|----|----------|-----------|
| PBT-01 | Cosine similarity range | -1.0 <= cosineSimilarity(a, b) <= 1.0 for all vectors |
| PBT-02 | Cosine self-similarity | cosineSimilarity(a, a) == 1.0 for non-zero vectors |
| PBT-03 | Union-Find idempotent | find(x) == find(x) always |
| PBT-04 | Union-Find transitive | union(a,b) + union(b,c) => find(a) == find(c) |
| PBT-05 | Cluster sizes sum | sum(cluster.sizes) == total unique elements unioned |

### 3.2 Unit Testing (UT)

| ID | Component | Test | Expected |
|----|-----------|------|----------|
| UT-01 | VectorMath | cosineSimilarity identical vectors | 1.0 |
| UT-02 | VectorMath | cosineSimilarity orthogonal vectors | 0.0 |
| UT-03 | VectorMath | cosineSimilarity zero vector | 0.0 |
| UT-04 | VectorMath | bytesToFloats/floatsToBytes roundtrip | Original array |
| UT-05 | ClusterBuilder | 3 unions forming 1 cluster | 1 cluster with 4 members |
| UT-06 | SuggestionGenerator | Cluster of 2 similar functions | extract_method suggestion |
| UT-07 | DeadCodeDetector | Function with no callers | confidence >= 90 |
| UT-08 | DeadCodeDetector | Function only called from tests | confidence 70-89 |
| UT-09 | DeadCodeDetector | Public function no callers | confidence reduced (public) |
| UT-10 | DeadCodeDetector | Interface implementation | confidence reduced (dynamic dispatch) |
| UT-11 | DeadCodeDetector | Entry point function | NOT in candidates |
| UT-12 | DeadCodeDetector | Test function | NOT in candidates |
| UT-13 | GitLogParser | Parse standard git log | List of GitCommit |
| UT-14 | GitLogParser | Parse empty log | Empty list |
| UT-15 | GitMiner | Search with no results | Empty list |
| UT-16 | GitMiner | Apply author filter | Only matching author |

### 3.3 Integration Testing (IT)

| ID | Scenario | Setup | Verification |
|----|----------|-------|-------------|
| IT-01 | Duplicate detection with known duplicates | DB with 2 identical embeddings | 1 pair found, 1 cluster |
| IT-02 | Duplicate detection no duplicates | DB with diverse embeddings | 0 pairs, 0 clusters |
| IT-03 | Duplicate detection file filter | DB with multi-file embeddings | Only specified file scanned |
| IT-04 | Dead code with isolated function | Call graph with unreachable node | Function in candidates |
| IT-05 | Dead code all reachable | Fully connected call graph | 0 candidates |
| IT-06 | Dead code entry points excluded | Entry point with no callers | NOT in candidates |
| IT-07 | Git indexing new commits | Test git repo | Commits stored in DB |
| IT-08 | Git search semantic | Indexed commits + query | Relevant commit ranked first |
| IT-09 | Git search with date filter | Commits across dates | Only matching dates |

### 3.4 E2E API Testing (E2E-API)

| ID | Tool | Input | Expected |
|----|------|-------|----------|
| E2E-01 | find_duplicates | {} (no params) | Report with scan results |
| E2E-02 | find_duplicates | {file: "specific.kt"} | Only that file scanned |
| E2E-03 | find_duplicates | {min_similarity: 0.99} | Fewer/no duplicates |
| E2E-04 | find_dead_code | {} | Report with candidates |
| E2E-05 | find_dead_code | {min_confidence: 90} | Only high-confidence |
| E2E-06 | find_dead_code | {file: "specific.kt"} | Only that file |
| E2E-07 | git_search | {query: "fix bug"} | Relevant commits |
| E2E-08 | git_search | {query: "x", index: true} | Index then search |
| E2E-09 | git_search | {query: "x", author: "john"} | Only John's commits |
| E2E-10 | git_search | {query: "x", since: "2026-01-01"} | Only recent commits |

### 3.5 System Integration Testing (SIT)

| ID | Test | Pass Criteria |
|----|------|---------------|
| SIT-01 | Same embeddings → same duplicate pairs | Pairs match Python output |
| SIT-02 | Same call graph → same dead code | Candidates match |
| SIT-03 | Same query → similar git results | Top 3 in same order |
| SIT-04 | Confidence scores within 5 points | abs(kotlin - python) <= 5 |

---

## 4. Entry/Exit Criteria

### 4.1 Exit Criteria

| Criteria | Target |
|----------|--------|
| PBT properties hold | 100% (1000 iterations) |
| UT pass rate | 100% |
| IT pass rate | 100% |
| E2E-API pass rate | 100% |
| SIT parity | 80% |
| Code coverage | >= 80% |
| No Critical bugs | 0 |

---

## 5. Risks

| Risk | Mitigation |
|------|-----------|
| ONNX model not available in CI | Mock EmbeddingService in UT; real model in IT (optional) |
| Git not available in CI | Use test repo fixture; skip git tests if unavailable |
| Embedding dimension mismatch | Validate 384 dimensions in EmbeddingService tests |

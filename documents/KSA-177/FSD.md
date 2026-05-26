# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-177: [Kotlin] Similarity + Infrastructure

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-177 |
| Title | [Kotlin] Similarity + Infrastructure — Functional Specification |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-177.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Similarity and Infrastructure module for the Kotlin MCP Code Intelligence server. It defines three MCP tools (`find_duplicates`, `find_dead_code`, `git_search`) that provide code similarity analysis and git history search.

### 1.2 Scope

Port the complete Similarity module from Python to Kotlin, maintaining functional parity while leveraging Kotlin idioms and ONNX Runtime for JVM embedding inference.

### 1.3 Definitions

| Term | Definition |
|------|------------|
| Cosine Similarity | dot(a,b) / (norm(a) * norm(b)) — measures vector similarity |
| Union-Find | Disjoint set data structure for clustering |
| ONNX | Open Neural Network Exchange format |
| ANN | Approximate Nearest Neighbor search |
| BFS | Breadth-First Search for graph reachability |

---

## 2. System Overview

### 2.1 Module Dependencies

| Module | Provided By | Used For |
|--------|-------------|----------|
| SymbolResolver | KSA-173 | Resolve symbols for dead code |
| CallGraphService | KSA-173 | Reachability analysis |
| EntryPointDetector | KSA-175 | Identify entry points for dead code |
| DatabaseManager | KSA-172 | SQLite access |
| EmbeddingService | This module | ONNX inference for embeddings |

---

## 3. Functional Requirements

### 3.1 Feature: Duplicate Detection (find_duplicates)

#### 3.1.1 Use Case

**Use Case ID:** UC-01
**Actor:** AI Agent
**Preconditions:** Codebase indexed with embeddings generated
**Postconditions:** Agent receives duplicate clusters with suggestions

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Calls find_duplicates | |
| 2 | | Loads function embeddings from DB |
| 3 | | Computes pairwise cosine similarity |
| 4 | | Filters pairs above threshold |
| 5 | | Clusters using Union-Find |
| 6 | | Generates refactoring suggestions |
| 7 | | Returns formatted report |

**Alternative Flows:**

| ID | Condition | Action |
|----|-----------|--------|
| AF-01 | file parameter provided | Only load embeddings for that file |
| AF-02 | n > 10000 functions | Use ANN instead of brute force |
| AF-03 | No embeddings in DB | Return empty report with message |

#### 3.1.2 Business Rules

| Rule ID | Rule |
|---------|------|
| BR-01 | Default similarity threshold = 0.85 |
| BR-02 | Default minimum lines = 5 |
| BR-03 | Only function/method symbols considered (not classes, variables) |
| BR-04 | Clusters use transitive closure (if A~B and B~C, then {A,B,C} is one cluster) |
| BR-05 | Suggestions generated only for clusters with 2+ members |

#### 3.1.3 API Contract

**Request:**
```json
{
  "name": "find_duplicates",
  "arguments": {
    "file": "src/context/AIContextService.kt",
    "min_similarity": 0.85,
    "min_lines": 5
  }
}
```

**Response (text format):**
```
Duplicate Detection Report
========================================
Functions scanned: 45
Similar pairs found: 3
Clusters: 2

Duplicate Clusters:
------------------------------

Cluster 1 (2 members):
  - src/context/AIContextService.kt:fetchCallers
  - src/context/EditContextService.kt:getCallerContext

Cluster 2 (3 members):
  - src/tools/AIContextTools.kt:handleGetAIContext
  - src/tools/AIContextTools.kt:handleGetEditContext
  - src/tools/AIContextTools.kt:handleGetCuratedContext

Refactoring Suggestions:
------------------------------

[extract_method] Extract shared caller-fetching logic
  Estimated lines saved: ~25
  Members: fetchCallers, getCallerContext

[parameterize] Parameterize handler functions (differ only in service call)
  Estimated lines saved: ~40
  Members: handleGetAIContext, handleGetEditContext, handleGetCuratedContext
```

---

### 3.2 Feature: Dead Code Detection (find_dead_code)

#### 3.2.1 Use Case

**Use Case ID:** UC-02
**Actor:** AI Agent
**Preconditions:** Codebase indexed with call graph built
**Postconditions:** Agent receives dead code candidates with confidence

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Calls find_dead_code | |
| 2 | | Identifies entry points (main, HTTP handlers, exports) |
| 3 | | Performs BFS from all entry points on call graph |
| 4 | | Marks all reachable functions |
| 5 | | Unreachable functions = dead code candidates |
| 6 | | Scores confidence for each candidate |
| 7 | | Returns formatted report |

#### 3.2.2 Business Rules

| Rule ID | Rule |
|---------|------|
| BR-06 | Entry points are never dead code (main, HTTP handlers, CLI commands, event handlers) |
| BR-07 | Exported/public API functions get lower confidence (might be used externally) |
| BR-08 | Test functions are excluded from dead code analysis |
| BR-09 | Confidence 90-100: No callers, not exported, not entry point |
| BR-10 | Confidence 70-89: Only called from tests |
| BR-11 | Confidence 60-69: No direct callers but dynamic dispatch possible |

#### 3.2.3 API Contract

**Request:**
```json
{
  "name": "find_dead_code",
  "arguments": {
    "file": "src/context/",
    "min_confidence": 60
  }
}
```

**Response (text format):**
```
Dead Code Detection Report
========================================
Total functions analyzed: 120
Entry points identified: 15
Reachable functions: 98
Dead code candidates: 7

Candidates (7):
------------------------------

[95%] unusedHelper  (src/utils/helpers.kt:45-52)
  Reasons: no callers, private visibility, not an entry point

[85%] oldFormatOutput  (src/formatters/legacy.kt:12-30)
  Reasons: only called from tests, deprecated annotation

[72%] processEvent  (src/handlers/events.kt:88-95)
  Reasons: no direct callers, but implements interface (dynamic dispatch possible)
```

---

### 3.3 Feature: Git Semantic Search (git_search)

#### 3.3.1 Use Case

**Use Case ID:** UC-03
**Actor:** AI Agent
**Preconditions:** Git repository exists; embedding service available
**Postconditions:** Agent receives semantically relevant commits

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Calls git_search with query | |
| 2 | | Checks if commits indexed (auto-index if empty) |
| 3 | | Generates embedding for query |
| 4 | | Computes cosine similarity with all commit embeddings |
| 5 | | Applies filters (author, file, date) |
| 6 | | Returns top-N ranked results |

#### 3.3.2 Business Rules

| Rule ID | Rule |
|---------|------|
| BR-12 | Auto-index on first search if no commits in DB |
| BR-13 | Incremental indexing: only process commits not yet in DB |
| BR-14 | Commit embedding = embedding of (subject + body) |
| BR-15 | Filters applied post-ranking (don't affect relevance score) |
| BR-16 | Default limit = 10 results |

#### 3.3.3 API Contract

**Request:**
```json
{
  "name": "git_search",
  "arguments": {
    "query": "fix memory leak in context service",
    "limit": 5,
    "author": "john",
    "since": "2026-01-01"
  }
}
```

**Response (text format):**
```
Git History Search: "fix memory leak in context service"
Found 3 relevant commits:

[0.89] a1b2c3d4 -- Fix memory leak in AIContextService disposal
  Author: John Doe | Date: 2026-03-15
  Files: src/context/AIContextService.kt, src/context/Types.kt
  Changes: +12 -8

[0.76] e5f6g7h8 -- Optimize context service memory usage
  Author: John Doe | Date: 2026-02-20
  Files: src/context/TokenBudgetManager.kt
  Changes: +25 -10

[0.65] i9j0k1l2 -- Add dispose pattern to services
  Author: John Doe | Date: 2026-01-10
  Files: src/context/AIContextService.kt, src/context/EditContextService.kt
  Changes: +45 -5
```

---

## 4. Data Model

### 4.1 Embeddings Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| symbol_id | INTEGER FK | References symbols.id |
| vector | BLOB | 384 floats (1536 bytes) little-endian |
| model_version | TEXT | ONNX model version used |
| created_at | TEXT | ISO 8601 timestamp |

### 4.2 Git Commits Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| hash | TEXT UNIQUE | Full commit hash |
| short_hash | TEXT | First 8 chars |
| author | TEXT | Author name |
| date | TEXT | ISO 8601 date |
| message | TEXT | Commit subject + body |
| files_changed | TEXT | JSON array of file paths |
| insertions | INTEGER | Lines added |
| deletions | INTEGER | Lines removed |
| embedding | BLOB | 384 floats (1536 bytes) |

---

## 5. Processing Logic

### 5.1 Cosine Similarity

```
function cosineSimilarity(a: FloatArray, b: FloatArray): Float {
    var dot = 0f; var normA = 0f; var normB = 0f
    for (i in a.indices) {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    val denom = sqrt(normA) * sqrt(normB)
    return if (denom > 0) dot / denom else 0f
}
```

### 5.2 Union-Find Clustering

```
class UnionFind {
    private val parent = mutableMapOf<String, String>()
    
    fun find(x: String): String {
        if (parent[x] != x) parent[x] = find(parent[x]!!)  // path compression
        return parent[x]!!
    }
    
    fun union(a: String, b: String) {
        parent.putIfAbsent(a, a)
        parent.putIfAbsent(b, b)
        val rootA = find(a); val rootB = find(b)
        if (rootA != rootB) parent[rootA] = rootB
    }
    
    fun getClusters(): List<List<String>> {
        return parent.keys.groupBy { find(it) }.values.filter { it.size > 1 }
    }
}
```

### 5.3 Dead Code Reachability

```
function findDeadCode(callGraph, entryPoints): List<DeadCodeCandidate> {
    val reachable = mutableSetOf<Long>()
    val queue = ArrayDeque(entryPoints.map { it.id })
    
    while (queue.isNotEmpty()) {
        val current = queue.removeFirst()
        if (current in reachable) continue
        reachable.add(current)
        queue.addAll(callGraph.getCallees(current))
    }
    
    val allFunctions = getAllFunctions()
    return allFunctions
        .filter { it.id !in reachable && !it.isTest && !it.isEntryPoint }
        .map { scoreConfidence(it) }
        .filter { it.confidence >= minConfidence }
}
```

---

## 6. Integration Specifications

### 6.1 ONNX Runtime

| Attribute | Value |
|-----------|-------|
| Purpose | Generate embeddings for code and commit messages |
| Model | all-MiniLM-L6-v2 (384 dimensions) |
| Input | Tokenized text (max 512 tokens) |
| Output | 384-dimensional float vector |
| Loading | Lazy (first use), cached in memory |

### 6.2 Git CLI

| Attribute | Value |
|-----------|-------|
| Purpose | Read commit history for indexing |
| Command | `git log --format=...` with custom format |
| Direction | Read-only |
| Graceful Degradation | If git unavailable, git_search returns error message |

---

## 7. Non-Functional Requirements

| Category | Requirement | Criteria |
|----------|-------------|----------|
| Performance | Duplicate detection < 5s (1000 functions) | Brute force acceptable |
| Performance | Dead code < 2s | BFS on call graph |
| Performance | Git search < 500ms | After indexing |
| Performance | Embedding generation < 10ms per function | ONNX batch inference |
| Storage | ~1.5KB per function embedding | 384 * 4 bytes |
| Reliability | ONNX unavailable → disable similarity tools | No crash |

---

## 8. Error Handling

| Scenario | Response |
|----------|----------|
| No embeddings in DB | "No embeddings found. Run indexing first." |
| ONNX model not found | "Embedding service unavailable. Similarity tools disabled." |
| Git not available | "Git not available. Cannot search commit history." |
| Empty call graph | "Call graph empty. Run indexing first." |
| File not found | "File not found in index: {path}" |

---

## 9. Testing Considerations

| ID | Scenario | Priority |
|----|----------|----------|
| TC-01 | Duplicate detection with known duplicates | High |
| TC-02 | No duplicates above threshold | High |
| TC-03 | Dead code with isolated function | High |
| TC-04 | Entry points excluded from dead code | High |
| TC-05 | Git search returns relevant commits | High |
| TC-06 | Git search with filters | Medium |
| TC-07 | Incremental git indexing | Medium |
| TC-08 | Large codebase (10000 functions) performance | Medium |
| TC-09 | ONNX unavailable graceful degradation | High |
| TC-10 | Union-Find clustering correctness | High |

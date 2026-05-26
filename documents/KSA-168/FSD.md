# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-168: [Similarity] Duplicates + Dead Code + Git Mining

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-168 |
| Title | [Similarity] Duplicates + Dead Code + Git Mining |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-168.docx |

---

## 1. Use Cases

### UC-168-01: Find Duplicate Code

**Actor:** Developer / AI Agent

**Main Flow:**
1. User calls `find_duplicates` with optional parameters
2. System loads all function body embeddings (from KSA-169)
3. Compute pairwise cosine similarity for all function pairs
4. Filter pairs with similarity > threshold (default: 0.85)
5. Group into clusters using transitive closure
6. For each cluster: identify canonical member (largest/oldest)
7. Return clusters with similarity scores and suggestions

**Alternative Flows:**
- 2a. No body embeddings available → fall back to signature similarity (less accurate)
- 3a. Too many functions (> 10K) → use approximate nearest neighbor (ANN)
- 4a. No pairs above threshold → return empty (no duplicates found)
- 5a. Single-file scope → only compare within that file

### UC-168-02: Detect Dead Code

**Actor:** Developer / AI Agent

**Main Flow:**
1. User calls `find_dead_code` with optional parameters
2. System loads call graph (from KSA-154)
3. Identify all entry points (main, HTTP handlers, exports, CLI)
4. Compute reachability from entry points (BFS/DFS traversal)
5. Functions NOT reachable = dead code candidates
6. Apply confidence scoring (callers, exports, tests, dynamic dispatch)
7. Filter by min_confidence threshold
8. Return dead code list with confidence scores and reasons

**Alternative Flows:**
- 2a. Call graph not available → use simpler heuristic (no callers in file)
- 3a. No entry points detected → warn user, use exports as roots
- 6a. Function used via reflection → reduce confidence significantly
- 6b. Function referenced in config/DI → reduce confidence

### UC-168-03: Search Git History

**Actor:** Developer / AI Agent

**Main Flow:**
1. User calls `mine_git_history` with natural language query
2. System checks if git history is indexed
3. If not indexed: parse git log, embed commit messages + diff summaries
4. Generate query embedding
5. Semantic search against commit embeddings
6. Apply optional filters (file, author, date range)
7. Return relevant commits ranked by relevance

**Alternative Flows:**
- 2a. Git history already indexed → use existing index
- 3a. Repository has > 50K commits → index only last 10K (configurable)
- 6a. File filter specified → only return commits touching that file
- 6b. Author filter → only return commits by that author

### UC-168-04: Index Git History (Background)

**Actor:** System (Background Task)

**Main Flow:**
1. Triggered on first `mine_git_history` call or explicit `index_git_history`
2. Parse git log: hash, author, date, message, files changed
3. For each commit: generate summary (message + file list)
4. Embed summaries using same embedding model
5. Store in vector index with commit metadata
6. Track last indexed commit hash for incremental updates

---

## 2. Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-168-01 | Duplicate threshold default = 0.85 cosine similarity | Balances precision vs recall |
| BR-168-02 | Functions < 5 lines excluded from duplicate detection | Trivial functions (getters) always similar |
| BR-168-03 | Dead code confidence requires no callers + not exported | Both conditions needed for high confidence |
| BR-168-04 | Dynamic dispatch (reflection, DI) reduces confidence by 30% | May be called at runtime |
| BR-168-05 | Recently modified (< 30 days) reduces dead confidence by 10% | Active development |
| BR-168-06 | Test utility functions excluded from dead code by default | Tests have different reachability |
| BR-168-07 | Git history index is incremental (only new commits) | Performance for large repos |
| BR-168-08 | Git index limited to 50K commits by default | Memory/storage constraints |
| BR-168-09 | Duplicate clusters use transitive closure | If A~B and B~C, then {A,B,C} is one cluster |
| BR-168-10 | Canonical member = oldest file in cluster | Suggests which copy is "original" |

---

## 3. Data Specifications

### 3.1 Duplicate Cluster Schema

```json
{
  "clusters": [
    {
      "id": "DUP-001",
      "size": 3,
      "avg_similarity": 0.92,
      "canonical": {"file": "src/utils/sort.py", "function": "quicksort", "lines": [10, 45]},
      "members": [
        {"file": "src/utils/sort.py", "function": "quicksort", "lines": [10, 45], "similarity_to_canonical": 1.0},
        {"file": "src/legacy/sorting.py", "function": "fast_sort", "lines": [22, 58], "similarity_to_canonical": 0.94},
        {"file": "src/v2/algorithms.py", "function": "qsort", "lines": [5, 40], "similarity_to_canonical": 0.88}
      ],
      "total_duplicate_lines": 105,
      "suggestion": "Extract shared sorting logic into common module"
    }
  ],
  "summary": {
    "total_clusters": 5,
    "total_duplicate_functions": 12,
    "total_duplicate_lines": 340,
    "potential_reduction": "28% of codebase"
  }
}
```

### 3.2 Dead Code Finding Schema

```json
{
  "dead_code": [
    {
      "file": "src/legacy/old_parser.py",
      "function": "parse_v1",
      "kind": "function",
      "lines": [10, 85],
      "line_count": 75,
      "confidence": 92,
      "confidence_level": "high",
      "reasons": [
        {"factor": "no_callers", "impact": +40},
        {"factor": "not_exported", "impact": +20},
        {"factor": "no_tests", "impact": +15},
        {"factor": "has_deprecated_comment", "impact": +15},
        {"factor": "base_score", "impact": +2}
      ],
      "last_modified": "2024-01-15",
      "last_author": "john.doe"
    }
  ],
  "summary": {
    "total_dead": 15,
    "total_lines": 450,
    "by_confidence": {"high": 8, "medium": 5, "low": 2},
    "safe_to_remove_lines": 280
  }
}
```

### 3.3 Git History Index Schema

**Table: `git_commits`**

| Column | Type | Description |
|--------|------|-------------|
| hash | TEXT PK | Commit SHA |
| author | TEXT | Author name |
| date | TEXT | ISO timestamp |
| message | TEXT | Commit message |
| files_changed | TEXT | JSON array of file paths |
| insertions | INTEGER | Lines added |
| deletions | INTEGER | Lines removed |
| embedding | BLOB | Vector embedding of message + context |

---

## 4. API Specifications

### 4.1 MCP Tool: `find_duplicates`

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file_path | string | No | Scope to specific file |
| min_similarity | float | No | Minimum similarity (default: 0.85) |
| min_lines | integer | No | Minimum function size (default: 5) |
| cross_file | boolean | No | Search across files (default: true) |
| limit | integer | No | Max clusters to return (default: 20) |

**Output:** Cluster list + summary (see schema above)

### 4.2 MCP Tool: `find_dead_code`

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file_path | string | No | Scope to specific file |
| min_confidence | integer | No | Minimum confidence % (default: 60) |
| include_tests | boolean | No | Include test-only code (default: false) |
| limit | integer | No | Max results (default: 50) |

**Output:** Dead code list + summary (see schema above)

### 4.3 MCP Tool: `mine_git_history`

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Natural language search query |
| file_path | string | No | Filter to commits touching this file |
| author | string | No | Filter by author name |
| since | string | No | Date filter (ISO format) |
| limit | integer | No | Max results (default: 10) |

**Output:**

```json
{
  "commits": [
    {
      "hash": "abc123def",
      "author": "John Doe",
      "date": "2025-03-15T14:30:00Z",
      "message": "Add connection pooling to database module",
      "files_changed": ["src/db/pool.py", "src/db/connection.py"],
      "relevance_score": 0.92,
      "insertions": 45,
      "deletions": 12
    }
  ],
  "total_indexed_commits": 5000,
  "query_time_ms": 120
}
```

### 4.4 MCP Tool: `index_git_history`

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| max_commits | integer | No | Max commits to index (default: 10000) |
| force | boolean | No | Re-index from scratch (default: false) |

**Output:** Indexing summary (commits indexed, duration, storage size)

---

## 5. Processing Logic

### 5.1 Duplicate Detection Algorithm

```
1. Load all function embeddings (body vectors) from DB
2. Filter: only functions with >= min_lines
3. If total > 10K: use ANN index (HNSW) for approximate search
4. Else: brute-force pairwise cosine similarity
5. Build similarity graph: nodes=functions, edges=similarity > threshold
6. Find connected components (clusters) using Union-Find
7. For each cluster:
   a. Sort members by file creation date (oldest = canonical)
   b. Compute avg similarity within cluster
   c. Generate refactoring suggestion
8. Sort clusters by total_duplicate_lines (largest first)
9. Return top-K clusters
```

### 5.2 Dead Code Detection Algorithm

```
1. Load call graph (nodes + edges)
2. Identify entry points:
   - main() functions
   - HTTP handlers (from KSA-162)
   - Exported symbols (public API)
   - CLI command handlers
   - Event listeners
3. BFS from all entry points → mark reachable nodes
4. Unreachable nodes = dead code candidates
5. For each candidate, compute confidence:
   score = 0
   if no_callers: score += 40
   if not_exported: score += 20
   if no_test_references: score += 15
   if has_deprecated_comment: score += 15
   if used_via_reflection: score -= 30
   if referenced_in_config: score -= 20
   if recently_modified: score -= 10
   confidence = clamp(score, 0, 100)
6. Filter by min_confidence
7. Sort by confidence (highest first)
```

### 5.3 Git History Indexing

```
1. git log --format="%H|%an|%aI|%s" --numstat -n {max_commits}
2. Parse each commit: hash, author, date, message, files, stats
3. For each commit:
   summary = f"{message}\nFiles: {', '.join(files)}\n+{insertions} -{deletions}"
   embedding = embed(summary)
4. Store in git_commits table
5. Track last_indexed_hash for incremental updates
```

---

## 6. Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Performance | Duplicate scan | < 30s for 1000 functions |
| Performance | Dead code scan | < 20s for 1000 functions |
| Performance | Git search | < 500ms query time |
| Performance | Git indexing | < 60s for 10K commits |
| Accuracy | Duplicate precision | >= 90% at threshold 0.85 |
| Accuracy | Dead code FP | < 20% at confidence >= 80% |
| Storage | Git index | < 100MB for 10K commits |

---

## 7. Error Handling

| Scenario | Severity | Behavior |
|----------|----------|----------|
| No body embeddings (KSA-169 not done) | Warning | Fall back to signature similarity |
| No call graph (KSA-154 not done) | Warning | Use simple heuristic (no callers) |
| Git not available | Error | Return error, suggest git init |
| Too many functions for brute-force | Info | Switch to ANN automatically |
| Embedding model OOM | Error | Reduce batch size, retry |

---

## 8. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Duplicate Detection Sequence | [sequence-duplicates.png](diagrams/sequence-duplicates.png) | [sequence-duplicates.drawio](diagrams/sequence-duplicates.drawio) |
| 3 | Dead Code State | [state-dead-code.png](diagrams/state-dead-code.png) | [state-dead-code.drawio](diagrams/state-dead-code.drawio) |

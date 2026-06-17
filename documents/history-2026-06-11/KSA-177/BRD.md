# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-177: [Kotlin] Similarity + Infrastructure

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-177 |
| Title | [Kotlin] Similarity + Infrastructure — Port similarity analysis and infrastructure tools from Node.js/Python to Kotlin |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-177.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-25 | BA Agent | Initial document — inferred from Python reference implementation |

---

## 1. Introduction

### 1.1 Scope

Port the Similarity Analysis and Infrastructure module from the Python MCP Code Intelligence server (`mcp-code-intelligence-python/src/mcp_code_intel/analyzers/similarity/`) to the Kotlin implementation (`mcp-code-intelligence-kotlin`). This includes:

- **Duplicate Detection**: Find near-duplicate functions using embedding cosine similarity, cluster them, and suggest refactoring strategies
- **Dead Code Detection**: Identify potentially unreachable code using call graph reachability analysis with confidence scoring
- **Git Semantic Search**: Semantic search over git commit history using embeddings with filters (author, date, file)

The Kotlin implementation must expose the same MCP tool interfaces and produce equivalent output.

### 1.2 Out of Scope

- AI Context Tools (covered by KSA-174)
- Code Quality analysis (covered by KSA-175)
- Security analysis (covered by KSA-176)
- Python track implementation (covered by KSA-183)
- Embedding model training or fine-tuning
- UI/frontend changes

### 1.3 Preliminary Requirements

- KSA-172 (Tree-sitter Core + Parsers) must be complete — provides symbol indexing
- KSA-173 (Graph Engine) must be complete — provides call graph for dead code detection
- KSA-174 (AI Context Tools) should be complete — shares infrastructure (DB, resolver)
- KSA-175 (Code Quality) should be complete — shares graph analysis patterns
- ONNX Runtime for JVM — for embedding inference
- Existing Kotlin project structure with `com.codeintel` package hierarchy

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Similarity module provides code analysis tools that help AI agents identify redundancy and unused code:

1. **Embedding Generation**: During indexing, generate embeddings for function bodies using ONNX model
2. **Storage**: Store embeddings as BLOB in SQLite alongside symbol metadata
3. **Duplicate Detection**: Compute pairwise cosine similarity, cluster similar functions, suggest refactoring
4. **Dead Code Detection**: Analyze call graph reachability from entry points, score unreachable functions
5. **Git Search**: Index git commit messages as embeddings, enable semantic search with filters

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source |
|---|------------------|----------|--------|
| 1 | As an AI agent, I want to find near-duplicate functions so that I can suggest consolidation | MUST HAVE | Python ref |
| 2 | As an AI agent, I want to detect dead/unreachable code so that I can suggest removal | MUST HAVE | Python ref |
| 3 | As an AI agent, I want to search git history semantically so that I can find relevant commits by meaning | MUST HAVE | Python ref |
| 4 | As an AI agent, I want duplicate clusters with refactoring suggestions so that I can provide actionable advice | SHOULD HAVE | Python ref |
| 5 | As an AI agent, I want confidence scores on dead code candidates so that I can prioritize cleanup | SHOULD HAVE | Python ref |
| 6 | As an AI agent, I want to filter git search by author/date/file so that I can narrow results | SHOULD HAVE | Python ref |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Codebase is indexed — symbols extracted, embeddings generated for function bodies

**Step 2:** AI agent calls `find_duplicates` — system computes pairwise cosine similarity between all function embeddings

**Step 3:** Similar pairs (above threshold) are clustered using Union-Find algorithm

**Step 4:** Refactoring suggestions generated based on cluster analysis (extract method, merge, etc.)

**Step 5:** AI agent calls `find_dead_code` — system performs reachability analysis from entry points on call graph

**Step 6:** Unreachable functions scored by confidence (considering dynamic dispatch, reflection, etc.)

**Step 7:** AI agent calls `git_search` — system searches indexed commit embeddings by semantic similarity

---

#### STORY 1: Duplicate Detection (`find_duplicates`)

> As an AI agent, I want to find near-duplicate functions so that I can suggest consolidation.

**Requirement Details:**

1. Load function body embeddings from database (pre-computed during indexing)
2. Compute pairwise cosine similarity between all function embeddings
3. Filter pairs above minimum similarity threshold (default: 0.85)
4. Cluster similar functions using Union-Find algorithm
5. Generate refactoring suggestions per cluster
6. Support filtering by file path and minimum function line count

**MCP Tool Interface:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | string | No | Filter to specific file path |
| min_similarity | number | No | Cosine similarity threshold 0.0-1.0 (default: 0.85) |
| min_lines | number | No | Minimum function line count (default: 5) |

**Acceptance Criteria:**

1. Tool `find_duplicates` is registered and callable via MCP protocol
2. Correctly computes cosine similarity between embedding vectors
3. Clusters are formed using Union-Find (transitive closure)
4. Refactoring suggestions include: extract_method, merge_functions, parameterize
5. Performance: < 5s for 1000 functions (brute force), < 30s for 10000 (ANN)
6. Output format matches Python reference implementation

---

#### STORY 2: Dead Code Detection (`find_dead_code`)

> As an AI agent, I want to detect dead/unreachable code so that I can suggest removal.

**Requirement Details:**

1. Build reachability set from entry points (main, HTTP handlers, event handlers, exports)
2. Mark all functions reachable via BFS/DFS from entry points
3. Functions NOT in reachability set are dead code candidates
4. Score confidence based on: no callers (high), only test callers (medium), dynamic dispatch possible (low)
5. Support filtering by file path and minimum confidence

**MCP Tool Interface:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | string | No | Filter to specific file path |
| min_confidence | number | No | Minimum confidence 0-100 (default: 60) |

**Acceptance Criteria:**

1. Tool `find_dead_code` is registered and callable via MCP protocol
2. Correctly identifies functions with no callers in call graph
3. Entry points are excluded from dead code candidates
4. Confidence scoring accounts for dynamic dispatch, reflection, test-only usage
5. No false positives for exported/public API functions
6. Output includes file path, line numbers, reasons, confidence score

---

#### STORY 3: Git Semantic Search (`git_search`)

> As an AI agent, I want to search git history semantically so that I can find relevant commits.

**Requirement Details:**

1. Index git commit messages as embeddings (incremental — only new commits)
2. Search by computing cosine similarity between query embedding and commit embeddings
3. Support filters: author, file path, date range (since/until)
4. Return ranked results with relevance score, commit details, files changed
5. Auto-index on first search if no commits indexed yet

**MCP Tool Interface:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Natural language search query |
| limit | number | No | Max results (default: 10) |
| author | string | No | Filter by author name (substring) |
| file | string | No | Filter by file path (substring) |
| since | string | No | Filter after date (ISO 8601) |
| until | string | No | Filter before date (ISO 8601) |
| index | boolean | No | Re-index before searching (default: false) |
| force_reindex | boolean | No | Force full re-index (default: false) |

**Acceptance Criteria:**

1. Tool `git_search` is registered and callable via MCP protocol
2. Incremental indexing only processes new commits
3. Semantic search returns relevant commits (not just keyword match)
4. Filters correctly narrow results
5. Auto-indexes on first use if empty
6. Performance: search < 500ms after indexing

---

#### STORY 4: Refactoring Suggestions

> As an AI agent, I want refactoring suggestions for duplicate clusters.

**Requirement Details:**

1. For each cluster, analyze member functions to determine best refactoring strategy
2. Strategies: extract_shared_method, merge_into_one, parameterize_differences
3. Estimate lines saved by refactoring
4. Provide specific member list for each suggestion

**Acceptance Criteria:**

1. Each cluster with 2+ members gets at least one suggestion
2. Suggestions include type, description, estimated savings, member list
3. Suggestions are actionable (AI agent can implement them)

---

#### STORY 5: Confidence Scoring for Dead Code

> As an AI agent, I want confidence scores so that I can prioritize cleanup.

**Requirement Details:**

1. Score 90-100: No callers at all, not exported, not an entry point
2. Score 70-89: Only called from tests, not exported
3. Score 60-69: No direct callers but could be called via dynamic dispatch/reflection
4. Score < 60: Excluded (too uncertain)
5. Provide reasons list explaining why code is considered dead

**Acceptance Criteria:**

1. Confidence scores are consistent and reproducible
2. Reasons are human-readable and specific
3. Higher confidence = more likely truly dead

---

#### STORY 6: Git Search Filters

> As an AI agent, I want to filter git search results.

**Requirement Details:**

1. Author filter: substring match on commit author name
2. File filter: substring match on any file changed in commit
3. Date filters: since (inclusive) and until (exclusive)
4. Filters applied AFTER semantic ranking (filter doesn't affect relevance score)

**Acceptance Criteria:**

1. Author filter correctly narrows results
2. File filter matches against changed files list
3. Date filters use ISO 8601 format
4. Combining multiple filters works (AND logic)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Tree-sitter Parsers | System | KSA-172 | Symbol indexing for embedding generation |
| Graph Engine | System | KSA-173 | Call graph for dead code reachability |
| AI Context Tools | System | KSA-174 | Shared infrastructure (DB, resolver) |
| Code Quality | System | KSA-175 | Entry point detection for dead code |
| ONNX Runtime | Library | N/A | Embedding model inference on JVM |
| Git CLI | External | N/A | Git log for commit indexing |
| SQLite | System | Existing | Embedding storage (BLOB) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Accept/reject implementation |
| Developer | Kotlin Dev | Implement the module |
| QA | QA Agent | Verify parity with Python |
| Architect | SA Agent | Design Kotlin-idiomatic architecture |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| ONNX Runtime JVM performance for large codebases | High | Medium | Batch embedding generation; cache results in DB |
| O(n^2) pairwise comparison for large function sets | High | Medium | Use ANN (approximate nearest neighbor) for n>10000 |
| Git history indexing slow for repos with 100K+ commits | Medium | Medium | Incremental indexing; limit to recent N commits |
| Embedding model size (ONNX) adds to JAR size | Medium | Low | Load model lazily; support external model path |

### 5.2 Assumptions

- ONNX Runtime for JVM is available and supports the embedding model format
- Embedding model produces 384-dimensional float vectors (same as Python sentence-transformers)
- Git CLI is available on PATH
- SQLite supports BLOB storage for embedding vectors
- KSA-175 provides entry point detection (reused for dead code analysis)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Duplicate detection < 5s for 1000 functions | Brute force O(n^2) acceptable for n<10000 |
| Performance | Dead code detection < 2s | BFS on call graph |
| Performance | Git search < 500ms | After indexing complete |
| Performance | Git indexing < 30s for 10000 commits | Incremental preferred |
| Compatibility | Output parity with Python | Same tool names, same output format |
| Storage | Embeddings ~1.5KB per function | 384 floats * 4 bytes = 1536 bytes |
| Reliability | Graceful degradation | If ONNX unavailable, disable similarity tools (not crash) |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-177 | [Kotlin] Similarity + Infrastructure | Story | Main ticket |
| KSA-171 | Code Intelligence v2 — Feature Parity Sync | Epic | Parent epic |
| KSA-172 | [Kotlin] Tree-sitter Core + Parsers | Story | Dependency (K1) |
| KSA-173 | [Kotlin] Graph Engine | Story | Dependency (K2) |
| KSA-174 | [Kotlin] AI Context Tools | Story | Dependency (K3) |
| KSA-175 | [Kotlin] Code Quality | Story | Dependency (K4) — entry points |
| KSA-176 | [Kotlin] Security Analysis | Story | Dependency (K5) |
| KSA-144 | mcp-code-intelligence-nodejs v2 | Epic | Source reference |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Cosine Similarity | Measure of similarity between two vectors (0=orthogonal, 1=identical) |
| Union-Find | Data structure for grouping elements into disjoint sets (clustering) |
| ANN | Approximate Nearest Neighbor — fast similarity search for large datasets |
| ONNX | Open Neural Network Exchange — portable model format |
| Embedding | Dense vector representation of text/code for similarity comparison |
| BFS | Breadth-First Search — graph traversal for reachability |
| Dead Code | Code that is never executed (unreachable from any entry point) |

### MCP Tools Summary

| Tool Name | Category | Description |
|-----------|----------|-------------|
| `find_duplicates` | Similarity | Find near-duplicate functions via embedding similarity |
| `find_dead_code` | Dead Code | Detect unreachable code via call graph analysis |
| `git_search` | Git Mining | Semantic search over git commit history |

### Python Source Files (Reference)

| File | Purpose |
|------|---------|
| `analyzers/similarity_tools.py` | Tool definitions and handlers |
| `analyzers/similarity/duplicate_detector.py` | Duplicate detection with embeddings |
| `analyzers/similarity/dead_code_detector.py` | Dead code detection |
| `analyzers/similarity/cluster_builder.py` | Union-Find clustering |
| `analyzers/similarity/suggestion_generator.py` | Refactoring suggestions |
| `git/git_miner.py` | Git history indexing and search |

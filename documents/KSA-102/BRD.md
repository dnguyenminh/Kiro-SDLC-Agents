# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-102: Adaptive Token Cache + Model Manager for multilingual find_tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-102 |
| Title | Adaptive Token Cache + Model Manager for multilingual find_tools |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-21 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review technical feasibility |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-21 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-102 and design decisions |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request implements a **self-learning multilingual tool discovery system** for the MCP Code Intelligence platform. The system enhances `find_tools` with:

1. **Adaptive Token Cache** — learns from embedding search results to accelerate future queries
2. **Model Manager** — allows users to download, switch, and manage embedding models (including multilingual models for Vietnamese search)

The implementation spans all 3 MCP modules: Python, Node.js Bridge, and Kotlin Server.

### 1.2 Out of Scope

- Training custom embedding models
- Cloud-hosted embedding inference (all inference is local ONNX)
- Changes to the MCP protocol itself
- UI/frontend for model management (uses MCP Elicitation pattern only)
- Automatic multilingual model download (user must opt-in)

### 1.3 Preliminary Requirement

- KSA-101: find_tools FAILED server retry mechanism must be implemented (provides the retry infrastructure this feature builds upon)
- ONNX Runtime already bundled as optional dependency (`pip install mcp-code-intel[embedding]`)
- Existing `all-MiniLM-L6-v2` model (90MB, English-only) already available at `.code-intel/models/`

---

## 2. Business Requirements

### 2.1 High Level Process Map

The system implements a **tiered search strategy** with self-learning capability:

1. **Tier 1 — Tokenized Search** (0ms): Current exact/fuzzy token matching in registry
2. **Tier 2 — Learned Cache Lookup** (0ms): Check if query has been previously resolved via embedding
3. **Tier 3 — Embedding Search** (10-50ms): Semantic similarity search using ONNX model
4. **Tier 4 — Learn & Cache**: If embedding finds a match (score > 0.75), cache the mapping
5. **Tier 5 — Delegate/KB Fallback**: Existing nested delegation and KB search

Over time, the cache grows and Tier 3 calls decrease — the system "learns" common queries.

### 2.2 List of User Stories / Use Cases

![Use Case Diagram](diagrams/use-case.png)

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want find_tools to understand semantic queries so that I can find tools even when my query doesn't match exact token names | MUST HAVE | KSA-102 |
| 2 | As a developer, I want find_tools to learn from successful embedding searches so that repeated queries are instant | MUST HAVE | KSA-102 |
| 3 | As a developer, I want to manage embedding models (list, download, switch) so that I can enable multilingual search | MUST HAVE | KSA-102 |
| 4 | As a developer, I want the system to auto-download the smallest model on first use so that embedding works out-of-the-box | SHOULD HAVE | KSA-102 |
| 5 | As a developer, I want the system to remind me about multilingual models when Vietnamese queries fail so that I know how to enable full language support | SHOULD HAVE | KSA-102 |
| 6 | As a developer, I want the token cache to persist across sessions so that learned mappings survive restarts | MUST HAVE | KSA-102 |
| 7 | As a developer, I want cache invalidation when tools change so that stale mappings don't return wrong results | MUST HAVE | KSA-102 |

---

### 2.3 Details of User Stories

---

#### Business Flow

![Business Flow](diagrams/business-flow.png)

**Step 1:** User calls `find_tools(query)` with a natural language query (e.g., "search jira issues")

**Step 2:** System performs tokenized search in registry (current behavior, ~0ms)

**Step 3:** If tokenized search returns results → return immediately (no change from current)

**Step 4:** If tokenized search misses → check learned token cache for this query

**Step 5:** If cache hit → return cached tool mapping instantly (~0ms)

**Step 6:** If cache miss → perform embedding search using ONNX model (~10-50ms)

**Step 7:** If embedding search finds match (cosine similarity > 0.75) → return result AND cache the query→tool mapping

**Step 8:** If embedding also misses → fall through to existing delegate/KB fallback

**Step 9:** Next time same/similar query arrives → cache hit at Step 5, skipping expensive embedding

> **Note:** The cache uses fuzzy matching — similar queries (e.g., "jira search" and "search jira") can share cached results via token normalization.

---

#### STORY 1: Semantic Tool Discovery via Embedding

> As a developer, I want find_tools to understand semantic queries so that I can find tools even when my query doesn't match exact token names

**Requirement Details:**

1. When tokenized search returns no results, system MUST attempt embedding-based semantic search
2. Embedding search computes cosine similarity between query embedding and all registered tool embeddings
3. Results with similarity score > 0.75 are considered matches
4. Embedding search MUST use the locally-installed ONNX model (no network calls during search)
5. If no model is installed, embedding search is skipped gracefully (no error, just falls through to next tier)

**Acceptance Criteria:**

1. Given a query "search jira issues" and tool named "jira_search" exists, when tokenized search misses, then embedding search finds "jira_search" with score > 0.75
2. Given no ONNX model installed, when embedding search is attempted, then it gracefully skips without error and falls through to delegate/KB
3. Given embedding search takes > 100ms, then it times out and falls through (hard timeout)
4. Embedding search MUST NOT block the main event loop

---

#### STORY 2: Self-Learning Token Cache

> As a developer, I want find_tools to learn from successful embedding searches so that repeated queries are instant

**Requirement Details:**

1. When embedding search successfully finds a tool (score > 0.75), the system MUST cache the mapping: `query_tokens → tool_name`
2. Cache key is the normalized token set of the query (not raw string) — enables fuzzy matching
3. Cache stores: `{ tokens: Set<string>, tool_name: string, score: float, timestamp: ISO8601 }`
4. On subsequent calls, if query tokens match a cached entry, return cached tool directly (0ms)
5. Fuzzy cache match: if ≥80% of query tokens match a cached entry's tokens, consider it a hit

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| tokens | Set\<string\> | Yes | Normalized token set from query | `{"search", "jira", "issues"}` |
| tool_name | string | Yes | Resolved tool name | `"jira_search"` |
| score | float | Yes | Original embedding similarity score | `0.87` |
| timestamp | string | Yes | ISO8601 when cached | `"2026-05-21T10:00:00Z"` |
| hit_count | int | Yes | Times this cache entry was used | `15` |

**Acceptance Criteria:**

1. Given query "search jira" resolved via embedding to "jira_search", when same query is called again, then result comes from cache (0ms, no embedding call)
2. Given query "jira search" (reordered tokens), when called after "search jira" was cached, then cache hit occurs (fuzzy match)
3. Given cache has 1000 entries, when lookup is performed, then it completes in < 1ms
4. Cache entries with hit_count = 0 after 30 days are eligible for eviction

---

#### STORY 3: Model Manager Tool

> As a developer, I want to manage embedding models (list, download, switch) so that I can enable multilingual search

**Requirement Details:**

1. New MCP tool: `mem_model_manager` with actions: `list`, `download`, `status`, `switch`
2. Uses MCP Elicitation pattern for interactive model selection (user picks from dropdown)
3. Models stored globally at `~/.code-intel/models/` (shared across all workspaces)
4. Registry file: `~/.code-intel/models/registry.json` tracks downloaded models
5. Available models:
   - `all-MiniLM-L6-v2` (English-only, ~90MB, 30K vocab) — default
   - `paraphrase-multilingual-MiniLM-L12-v2` (50+ languages including Vietnamese, ~470MB, 250K vocab)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| action | string | Yes | One of: list, download, status, switch | `"download"` |
| model_name | string | No | Model identifier (required for download/switch) | `"paraphrase-multilingual-MiniLM-L12-v2"` |

**Acceptance Criteria:**

1. Given action="list", then return all available models with download status and size
2. Given action="download" with model_name, then download model from HuggingFace to ~/.code-intel/models/{model_name}/
3. Given action="status", then return current active model name, path, and capabilities
4. Given action="switch" with model_name (already downloaded), then switch active model and rebuild tool embeddings
5. If model not downloaded and action="switch", then return error with download instructions
6. Elicitation UI shows dropdown with model options when user calls without specifying model_name

---

#### STORY 4: Auto-Download Smallest Model

> As a developer, I want the system to auto-download the smallest model on first use so that embedding works out-of-the-box

**Requirement Details:**

1. On first `find_tools` call that reaches embedding tier, if no model exists, auto-download `all-MiniLM-L6-v2`
2. Download happens in background (non-blocking) — current call falls through to delegate/KB
3. Next call after download completes will use embedding
4. Download progress logged to stderr (visible in MCP server logs)
5. If download fails (network error), log warning and continue without embedding (graceful degradation)

**Acceptance Criteria:**

1. Given fresh install with no models, when first find_tools misses tokenized search, then model download starts in background
2. Given download in progress, when find_tools is called, then it does NOT block — falls through to delegate/KB
3. Given download completed, when next find_tools misses tokenized search, then embedding search is used
4. Given no network available, when auto-download fails, then system continues working without embedding (no crash)

---

#### STORY 5: Multilingual Model Reminder

> As a developer, I want the system to remind me about multilingual models when Vietnamese queries fail so that I know how to enable full language support

**Requirement Details:**

1. When a query contains non-ASCII characters (Vietnamese, Chinese, etc.) AND embedding search returns no results AND current model is English-only
2. System adds a hint in the response: "💡 Tip: Download multilingual model for better {language} support. Use: mem_model_manager(action='download', model_name='paraphrase-multilingual-MiniLM-L12-v2')"
3. Hint appears at most once per session (don't spam)
4. Does NOT force download — user decides

**Acceptance Criteria:**

1. Given English-only model active and query "tìm kiếm jira" returns no embedding results, then response includes multilingual model hint
2. Given hint already shown in this session, when another Vietnamese query fails, then no duplicate hint
3. Given multilingual model already active, when Vietnamese query is used, then no hint shown (model already supports it)

---

#### STORY 6: Cache Persistence

> As a developer, I want the token cache to persist across sessions so that learned mappings survive restarts

**Requirement Details:**

1. Cache persisted to `{workspace}/.code-intel/token-cache.json`
2. Loaded on server startup (lazy — only when first cache lookup needed)
3. Saved after each new cache entry (debounced — max 1 write per 5 seconds)
4. File format: JSON array of cache entries
5. Max cache size: 10,000 entries (LRU eviction when exceeded)

**Acceptance Criteria:**

1. Given cache has entries, when server restarts, then cache is loaded and entries are available
2. Given new entry cached, then file is updated within 5 seconds
3. Given cache exceeds 10,000 entries, then least-recently-used entries are evicted
4. Given corrupted cache file, then system starts with empty cache (no crash) and logs warning

---

#### STORY 7: Cache Invalidation

> As a developer, I want cache invalidation when tools change so that stale mappings don't return wrong results

**Requirement Details:**

1. Cache entries include a `tool_version` field (hash of tool registry state when cached)
2. On server startup, compute current tool registry hash
3. If registry hash differs from cached entries' tool_version → invalidate those entries
4. When new tools are registered (nested discovery) → mark affected cache entries as stale
5. Stale entries are not deleted immediately — they're skipped during lookup and cleaned up on next persist

**Acceptance Criteria:**

1. Given tool "jira_search" was cached, when server restarts with different tool set, then cache entry for "jira_search" is invalidated
2. Given nested discovery adds new tools, when cache lookup finds a stale entry, then it's skipped (falls through to embedding)
3. Given 50% of cache entries are stale after tool change, then only stale entries are invalidated (valid entries preserved)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| KSA-101 | System | KSA-101 | find_tools FAILED server retry — provides retry infrastructure |
| KSA-62/63 | System | KSA-62, KSA-63 | find_tools core requirements and architecture |
| ONNX Runtime | External | N/A | Already bundled as optional dep for embedding inference |
| HuggingFace Hub | External | N/A | Model download source (sentence-transformers models) |
| all-MiniLM-L6-v2 | External | N/A | Default English embedding model (90MB) |
| paraphrase-multilingual-MiniLM-L12-v2 | External | N/A | Optional multilingual model (470MB) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter | Duc Nguyen Minh | Product Owner, requirements definition | Jira reporter |
| Developer | Development Team | Implementation across 3 MCP modules | Jira assignee |
| Architect | SA Agent | Technical design and feasibility review | Review |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Model download fails on restricted networks | Medium | Medium | Graceful degradation — system works without embedding, just slower |
| Cache grows unbounded in active workspaces | Low | Low | LRU eviction at 10K entries, debounced writes |
| Embedding model produces false positives (score > 0.75 but wrong tool) | High | Low | Conservative threshold (0.75), cache entries can be invalidated |
| ONNX Runtime not installed (optional dep) | Medium | Medium | Graceful skip — embedding tier disabled, no crash |
| Multilingual model too large for some users (470MB) | Low | Medium | Never auto-download large model, only remind user |
| Cross-platform path issues (~/.code-intel/) | Medium | Low | Use pathlib for all path operations, test on Windows/Mac/Linux |

### 5.2 Assumptions

- ONNX Runtime is already available as optional dependency in the Python module
- The existing `model_downloader.py` and `onnx_provider.py` provide working embedding infrastructure
- Users have internet access for initial model download (but system works offline after)
- The 0.75 confidence threshold is appropriate (may need tuning based on real usage)
- Token cache JSON format is sufficient for 10K entries (no need for SQLite)
- All 3 MCP modules (Python, Node.js, Kotlin) will implement the same algorithm

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Tokenized search + cache lookup | < 1ms combined |
| Performance | Embedding search (when needed) | < 100ms (hard timeout) |
| Performance | Cache persistence write | Debounced, max 1 write per 5 seconds |
| Storage | Cache file size | < 5MB for 10K entries |
| Storage | Model storage (global) | 90MB (English) or 470MB (multilingual) |
| Reliability | Graceful degradation | System MUST work without embedding model installed |
| Reliability | Corrupted cache handling | Start fresh, no crash |
| Scalability | Cache capacity | 10,000 entries per workspace |
| Compatibility | Cross-platform | Windows, macOS, Linux |
| Compatibility | Multi-module | Same algorithm in Python, Node.js, Kotlin |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-102 | Adaptive Token Cache + Model Manager for multilingual find_tools | In Progress | Task | Main ticket |
| KSA-101 | find_tools FAILED server retry | — | Task | Dependency (retry infrastructure) |
| KSA-62 | find_tools requirements | — | Task | Related (core requirements) |
| KSA-63 | find_tools requirements | — | Task | Related (core requirements) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Token Cache | JSON file storing learned query→tool mappings from embedding search results |
| Embedding | Dense vector representation of text, enabling semantic similarity comparison |
| ONNX | Open Neural Network Exchange — portable model format for local inference |
| Cosine Similarity | Measure of similarity between two vectors (0 = unrelated, 1 = identical) |
| Elicitation | MCP pattern for interactive user input (forms, dropdowns) during tool execution |
| LRU | Least Recently Used — eviction strategy for cache capacity management |
| Tokenized Search | Current search method splitting tool names into tokens for exact/fuzzy matching |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Current find_tools implementation | `mcp-code-intelligence-python/src/mcp_code_intel/orchestration/meta/find_tools.py` |
| Current tokenizer | `mcp-code-intelligence-python/src/mcp_code_intel/orchestration/registry/tokenizer.py` |
| Model downloader | `mcp-code-intelligence-python/src/mcp_code_intel/memory/embedding/model_downloader.py` |
| ONNX provider | `mcp-code-intelligence-python/src/mcp_code_intel/memory/embedding/onnx_provider.py` |
| Orchestration architecture | `.kiro/steering/orchestration.md` |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

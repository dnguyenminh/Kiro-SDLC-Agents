# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-160: [AI Context] get_curated_context - NL query cross-codebase

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-160 |
| Title | [AI Context] get_curated_context - NL query cross-codebase |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-01 | BA Agent | Initial document — auto-generated from Jira ticket KSA-160 |

---

## 1. Introduction

### 1.1 Scope

Implement `get_curated_context` MCP tool that provides cross-codebase context for natural language queries. This tool combines:
- **Symbol search** (FTS5 + semantic embedding)
- **Memory search** (knowledge base entries)
- **Graph traversal** (related symbols via call/import/inheritance edges)

The tool answers questions like "How does authentication work in this project?" by assembling relevant code, documentation, and architectural context into a coherent response.

### 1.2 Out of Scope

- Intent-aware context (KSA-158 get_ai_context — different approach, intent-based)
- Edit-focused context (KSA-159 get_edit_context — file-specific)
- Graph traversal implementation (KSA-157 — prerequisite)
- Embedding model training/fine-tuning
- Natural language understanding/LLM inference (uses existing search)

### 1.3 Preliminary Requirements

- Symbol search working (FTS5 + embedding via existing code_search)
- Memory/KB search working (existing mem_search)
- Graph traversal API available (KSA-157)
- get_ai_context available (KSA-158) for reference architecture

---

## 2. Business Requirements

### 2.1 High Level Process Map

Current code intelligence provides:
- `code_search`: Find symbols by name/keyword (single-dimension)
- `mem_search`: Find knowledge entries (separate from code)
- No way to combine code + knowledge + relationships in one query

`get_curated_context` bridges this gap by:
1. Parsing the NL query to identify search terms and intent
2. Running parallel searches across code symbols, memory, and graph
3. Ranking and deduplicating results
4. Assembling a curated context package within token budget
5. Returning structured context with source attribution

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As an AI agent, I want to query the codebase in natural language and get relevant context | MUST HAVE | KSA-160 |
| 2 | As an AI agent, I want results from multiple sources (code + KB + graph) combined | MUST HAVE | KSA-160 |
| 3 | As an AI agent, I want results ranked by relevance with source attribution | MUST HAVE | KSA-160 |
| 4 | As an AI agent, I want token budget control so context fits in my prompt | SHOULD HAVE | KSA-160 |
| 5 | As an AI agent, I want to scope queries to specific modules or file patterns | SHOULD HAVE | KSA-160 |
| 6 | As an AI agent, I want related symbols included via graph traversal | SHOULD HAVE | KSA-160 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** AI agent calls `get_curated_context` with NL query and optional parameters

**Step 2:** Tool extracts search terms from query (keywords, symbol names, concepts)

**Step 3:** Tool runs parallel searches:
- Symbol search (FTS5 + embedding similarity)
- Memory search (KB entries matching query)
- Graph traversal (if specific symbols found, get related nodes)

**Step 4:** Tool merges and ranks results using Reciprocal Rank Fusion (RRF)

**Step 5:** Tool assembles context within token budget:
- High-relevance: full source code
- Medium-relevance: signatures + docstrings
- Low-relevance: names + file paths only

**Step 6:** Tool returns structured response with sections and attribution

---

#### STORY 1: Natural Language Codebase Query

> As an AI agent, I want to query the codebase in natural language and get relevant context.

**API Design:**

```
get_curated_context({
  query: "How does the authentication middleware validate JWT tokens?",
  max_tokens: 4000,
  scope: "src/**/*.ts",           // optional file pattern
  include_source: true,           // include code snippets
  include_memory: true,           // include KB entries
  include_graph: true             // include related symbols
})
```

**Acceptance Criteria:**

1. Accepts free-form natural language query
2. Returns relevant code symbols matching the query
3. Returns relevant KB entries (decisions, architecture notes)
4. Results are coherent and answer the query (not random matches)
5. Response time <2 seconds for typical queries

---

#### STORY 2: Multi-Source Result Combination

> As an AI agent, I want results from multiple sources combined.

**Sources:**

| Source | Search Method | Result Type |
|--------|--------------|-------------|
| Code symbols | FTS5 keyword + embedding similarity | Function/class signatures + source |
| Knowledge base | BM25 + vector + graph (existing mem_search) | Decisions, architecture, lessons |
| Graph neighbors | Traversal from top symbol matches | Related callers/callees/imports |

**Acceptance Criteria:**

1. All three sources queried in parallel
2. Results from each source clearly labeled with source type
3. Deduplication: same symbol from multiple sources appears once (highest rank)
4. If one source returns no results, others still included
5. Source weights configurable (default: code 0.5, memory 0.3, graph 0.2)

---

#### STORY 3: Relevance Ranking with Attribution

> As an AI agent, I want results ranked by relevance with source attribution.

**Ranking Algorithm:**

1. Each source produces ranked results independently
2. Reciprocal Rank Fusion (RRF) combines rankings: `score = Σ 1/(k + rank_i)` where k=60
3. Final results sorted by combined RRF score
4. Each result includes: source type, individual score, combined score

**Acceptance Criteria:**

1. Results ordered by relevance (most relevant first)
2. Each result has `source` field: "code", "memory", or "graph"
3. Each result has `relevance_score` (0.0 - 1.0)
4. Top results are genuinely relevant to the query (manual verification)
5. Ranking is deterministic for same query + same data

---

#### STORY 4: Token Budget Control

> As an AI agent, I want token budget control so context fits in my prompt.

**Budget Strategy:**

| Relevance Tier | Content Included | Approx Tokens |
|----------------|-----------------|---------------|
| High (top 20%) | Full source code + docstring | 200-500 per symbol |
| Medium (20-60%) | Signature + first docstring line | 50-100 per symbol |
| Low (60-100%) | Name + file + line number | 10-20 per symbol |

**Acceptance Criteria:**

1. `max_tokens` parameter controls total output size
2. Token estimation uses tiktoken-compatible counting (4 chars ≈ 1 token)
3. High-relevance items always included first
4. Progressive degradation: reduce detail level as budget fills
5. Response includes `tokens_used` and `tokens_budget` metadata
6. Default budget: 4000 tokens

---

#### STORY 5: Scope Filtering

> As an AI agent, I want to scope queries to specific modules or file patterns.

**Scope Options:**

| Parameter | Example | Effect |
|-----------|---------|--------|
| `scope` (glob) | `"src/auth/**"` | Only search files matching pattern |
| `modules` (list) | `["auth", "user"]` | Only search in named modules |
| `languages` (list) | `["typescript", "python"]` | Only search files of these languages |
| `exclude` (glob) | `"**/*.test.*"` | Exclude matching files |

**Acceptance Criteria:**

1. Scope filters applied to code symbol search
2. Memory search not affected by scope (KB entries are cross-cutting)
3. Graph traversal respects scope (don't follow edges outside scope)
4. Multiple scope parameters combine with AND logic
5. Invalid scope returns clear error (not empty results)

---

#### STORY 6: Graph-Enhanced Results

> As an AI agent, I want related symbols included via graph traversal.

**Acceptance Criteria:**

1. For top-N symbol matches, run graph traversal (depth 1-2)
2. Include callers and callees of matched functions
3. Include parent classes/interfaces of matched methods
4. Include imported modules of matched files
5. Graph results marked with `source: "graph"` and `relationship: "calls/imports/inherits"`
6. Graph expansion respects token budget (don't overflow)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Graph traversal API (KSA-157) | System | KSA-157 | Graph query capability |
| get_ai_context (KSA-158) | Reference | KSA-158 | Architecture reference |
| get_edit_context (KSA-159) | Reference | KSA-159 | Architecture reference |
| Existing code_search | System | N/A | FTS5 + embedding search |
| Existing mem_search | System | N/A | KB search |
| Symbol embeddings | System | N/A | Vector similarity |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve API design |
| Developer | Code Intelligence Team | Implement curated context tool |
| QA | QA Team | Verify result quality |
| Users | AI Agents (all) | Primary consumers |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| NL query parsing produces poor search terms | High | Medium | Use multiple extraction strategies, fallback to full-text |
| Result quality varies significantly by query type | Medium | Medium | Benchmark with query suite, tune weights |
| Token budget estimation inaccurate | Low | Medium | Conservative estimation, allow 10% overflow |
| Parallel searches slow down response | Medium | Low | Timeout per source (500ms), return partial results |

### 5.2 Assumptions

- Existing FTS5 + embedding search provides good base relevance
- RRF is sufficient for combining heterogeneous result sources
- AI agents typically need 2000-8000 tokens of context
- Graph traversal depth 1-2 is sufficient for context enrichment
- Query parsing doesn't need LLM — keyword extraction + embedding is enough

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Response <2 seconds | For typical queries on <100K symbol graphs |
| Performance | Response <5 seconds | For complex queries with graph expansion |
| Quality | Top-5 results relevant >80% of time | Manual evaluation on test query set |
| Scalability | Handle codebases up to 500K LOC | With appropriate indexing |
| Reliability | Partial results on timeout | If one source slow, return others |

---

## 7. Related Tickets

| Ticket Key | Summary | Relationship |
|------------|---------|--------------|
| KSA-160 | [AI Context] get_curated_context | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | Parent epic |
| KSA-157 | [Graph] Graph Traversal API | Prerequisite (graph queries) |
| KSA-158 | [AI Context] get_ai_context | Sibling (intent-aware context) |
| KSA-159 | [AI Context] get_edit_context | Sibling (edit-focused context) |
| KSA-153 | [Graph] Data Model & Storage | Foundation (graph storage) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| RRF | Reciprocal Rank Fusion — algorithm for combining multiple ranked lists |
| Token budget | Maximum number of tokens the context can consume in an LLM prompt |
| NL query | Natural Language query — free-form text question |
| Cross-codebase | Searching across all indexed files and modules |
| Curated | Intelligently selected and organized (not raw dump) |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| KSA-158 BRD (get_ai_context) | documents/KSA-158/BRD.md |
| KSA-159 BRD (get_edit_context) | documents/KSA-159/BRD.md |
| KSA-157 BRD (Graph Traversal) | documents/KSA-157/BRD.md |

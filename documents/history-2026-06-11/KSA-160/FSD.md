# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-160: [AI Context] get_curated_context

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-160 |
| Title | [AI Context] get_curated_context - NL query cross-codebase |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-160.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the `get_curated_context` MCP tool that combines symbol search, memory search, and graph traversal to answer natural language queries about the codebase. It assembles a curated context package within a token budget.

### 1.2 Scope

- MCP tool `get_curated_context` implementation
- Multi-source search (code symbols + KB memory + graph neighbors)
- Reciprocal Rank Fusion (RRF) for result merging
- Token budget management with progressive detail levels
- Scope filtering (file patterns, modules, languages)

---

## 2. System Overview

### 2.1 Architecture

```
get_curated_context (MCP Tool)
    │
    ├── QueryAnalyzer (extract search terms from NL query)
    ├── ParallelSearcher
    │     ├── SymbolSearch (FTS5 + embedding similarity)
    │     ├── MemorySearch (KB BM25 + vector)
    │     └── GraphExpander (traverse from top matches)
    ├── ResultMerger (RRF ranking + deduplication)
    ├── BudgetAllocator (token budget → detail levels)
    └── ResponseFormatter (structured output with attribution)
```

### 2.2 Data Flow

```
NL Query → Analyze → Parallel Search (3 sources) → Merge (RRF) → Budget Allocation → Format → Response
```

---

## 3. Functional Requirements

### 3.1 Feature: MCP Tool Interface

#### 3.1.1 Tool Registration

```json
{
  "name": "get_curated_context",
  "description": "Get curated cross-codebase context for a natural language query. Combines code search, knowledge base, and graph traversal.",
  "inputSchema": {
    "type": "object",
    "required": ["query"],
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language question about the codebase"
      },
      "max_tokens": {
        "type": "integer",
        "default": 4000,
        "minimum": 500,
        "maximum": 16000
      },
      "scope": {
        "type": "string",
        "description": "Glob pattern to limit search (e.g., 'src/auth/**')"
      },
      "modules": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Module names to search within"
      },
      "languages": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Languages to filter (e.g., ['typescript', 'python'])"
      },
      "include_source": {
        "type": "boolean",
        "default": true
      },
      "include_memory": {
        "type": "boolean",
        "default": true
      },
      "include_graph": {
        "type": "boolean",
        "default": true
      },
      "source_weights": {
        "type": "object",
        "properties": {
          "code": { "type": "number", "default": 0.5 },
          "memory": { "type": "number", "default": 0.3 },
          "graph": { "type": "number", "default": 0.2 }
        }
      }
    }
  }
}
```

### 3.2 Feature: Query Analysis

#### 3.2.1 Use Case: UC-01 — Extract Search Terms

**Input:** "How does the authentication middleware validate JWT tokens?"

**Extraction Strategy:**
1. **Keywords:** authentication, middleware, validate, JWT, tokens
2. **Symbol candidates:** (words that look like code identifiers) — middleware, JWT
3. **Concepts:** (multi-word phrases) — "authentication middleware", "JWT tokens", "validate JWT"

**Algorithm:**
```pseudocode
function analyzeQuery(query):
  // Step 1: Tokenize and remove stop words
  tokens = tokenize(query).filter(not stopWord)
  
  // Step 2: Identify potential symbol names (camelCase, PascalCase, snake_case)
  symbolCandidates = tokens.filter(looksLikeIdentifier)
  
  // Step 3: Extract bigrams/trigrams for phrase search
  phrases = extractNGrams(tokens, 2, 3)
  
  // Step 4: Generate embedding for full query
  queryEmbedding = embed(query)
  
  return { tokens, symbolCandidates, phrases, queryEmbedding }
```

### 3.3 Feature: Parallel Search

#### 3.3.1 Symbol Search

```pseudocode
function searchSymbols(terms, queryEmbedding, scope):
  // FTS5 keyword search
  ftsResults = db.query("SELECT * FROM symbols_fts WHERE symbols_fts MATCH ?", terms.join(" OR "))
  
  // Embedding similarity search
  embResults = vectorSearch(queryEmbedding, limit=20, scope=scope)
  
  // Combine with RRF
  return rrfMerge(ftsResults, embResults, k=60)
```

#### 3.3.2 Memory Search

```pseudocode
function searchMemory(query):
  // Use existing mem_search infrastructure
  return memSearch(query, limit=10, detail=true)
```

#### 3.3.3 Graph Expansion

```pseudocode
function expandGraph(topSymbols):
  expanded = []
  for symbol in topSymbols.slice(0, 5):  // Top 5 only
    neighbors = code_traverse({
      start: symbol.name,
      edge_types: ["Calls", "Imports", "Inherits"],
      direction: "both",
      max_depth: 1,
      max_results: 10
    })
    expanded.push(...neighbors)
  return deduplicate(expanded)
```

### 3.4 Feature: Result Merging (RRF)

**Algorithm:**
```pseudocode
function rrfMerge(codeResults, memoryResults, graphResults, weights):
  k = 60  // RRF constant
  scores = {}
  
  for (rank, item) in enumerate(codeResults):
    scores[item.id] = (scores[item.id] || 0) + weights.code * (1 / (k + rank))
  
  for (rank, item) in enumerate(memoryResults):
    scores[item.id] = (scores[item.id] || 0) + weights.memory * (1 / (k + rank))
  
  for (rank, item) in enumerate(graphResults):
    scores[item.id] = (scores[item.id] || 0) + weights.graph * (1 / (k + rank))
  
  return sortByScore(scores)
```

### 3.5 Feature: Token Budget Allocation

**Tiered detail levels:**

| Tier | Condition | Content | Tokens/item |
|------|-----------|---------|-------------|
| High | Top 20% by score | Full source + docstring | 200-500 |
| Medium | 20-60% | Signature + first line of doc | 50-100 |
| Low | 60-100% | Name + file + line | 10-20 |

**Algorithm:**
```pseudocode
function allocateBudget(results, maxTokens):
  allocated = []
  tokensUsed = 100  // overhead
  
  highCount = ceil(results.length * 0.2)
  medCount = ceil(results.length * 0.4)
  
  for (i, result) in enumerate(results):
    if tokensUsed >= maxTokens: break
    
    if i < highCount:
      detail = "full"
      tokens = estimateTokens(result.source)
    elif i < highCount + medCount:
      detail = "signature"
      tokens = estimateTokens(result.signature)
    else:
      detail = "reference"
      tokens = 15
    
    if tokensUsed + tokens <= maxTokens:
      allocated.push({...result, detail, tokens})
      tokensUsed += tokens
  
  return { allocated, tokensUsed, budget: maxTokens }
```

### 3.6 Feature: Response Format

```json
{
  "query": "How does authentication middleware validate JWT tokens?",
  "sections": [
    {
      "title": "Relevant Code",
      "source": "code",
      "items": [
        {
          "name": "AuthMiddleware.validateToken",
          "kind": "method",
          "file": "src/middleware/auth.ts",
          "line": 23,
          "relevance": 0.92,
          "detail": "full",
          "content": "async validateToken(token: string): Promise<Claims> {\n  const decoded = jwt.verify(token, this.secret);\n  return decoded as Claims;\n}"
        }
      ]
    },
    {
      "title": "Architecture & Decisions",
      "source": "memory",
      "items": [
        {
          "title": "JWT Authentication Architecture",
          "type": "ARCHITECTURE",
          "relevance": 0.85,
          "content": "We use RS256 for JWT signing..."
        }
      ]
    },
    {
      "title": "Related Symbols",
      "source": "graph",
      "items": [
        {
          "name": "JwtService.verify",
          "relationship": "called_by AuthMiddleware.validateToken",
          "file": "src/services/jwt.ts",
          "line": 15
        }
      ]
    }
  ],
  "metadata": {
    "tokens_used": 3200,
    "tokens_budget": 4000,
    "sources_queried": ["code", "memory", "graph"],
    "total_candidates": 156,
    "results_returned": 18,
    "execution_time_ms": 850
  }
}
```

---

## 4. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Response time | <2s (typical), <5s (complex with graph) |
| Result quality | Top-5 relevant >80% of time |
| Token accuracy | Estimation within ±10% of actual |
| Partial results | If one source times out, return others |

---

## 5. Error Handling

| Error | Handling |
|-------|----------|
| No results from any source | Return empty with suggestion to broaden query |
| Graph traversal timeout | Skip graph results, return code + memory |
| Embedding service unavailable | Fall back to FTS5 only |
| Token budget too small (<500) | Return references only (no source) |

---

## 6. Test Strategy

| Test Type | Coverage |
|-----------|----------|
| Unit tests | Query analysis, RRF merge, budget allocation |
| Integration tests | Full pipeline with test codebase |
| Quality tests | Benchmark query set with expected results |
| Performance tests | Response time under various graph sizes |
| Edge cases | Empty codebase, no KB entries, very long queries |

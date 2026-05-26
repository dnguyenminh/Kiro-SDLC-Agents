# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-159: [AI Context] get_edit_context

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-159 |
| Title | [AI Context] get_edit_context - source + callers + tests + git |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |
| Priority | Highest |
| Estimate | 0.5 week |

---

## 1. Executive Summary

Implement `get_edit_context` MCP tool that provides everything an AI agent needs before editing a symbol: the source code, its callers, related tests, relevant memories from KB, and recent git history. This is the "one-stop shop" context tool that eliminates the need for agents to make 5+ separate tool calls before making a code change.

---

## 2. Business Context

### 2.1 Problem Statement

Currently, before editing code, an AI agent must:
1. `readCode` to get the source
2. `code_callers` to understand who calls it
3. `code_dependencies` to see imports
4. `mem_search` to find relevant decisions/patterns
5. `git log` to see recent changes

This is 5 tool calls, consuming tokens and time. A single `get_edit_context` call provides all of this in one optimized response.

### 2.2 Business Value

- **Token efficiency:** 1 call instead of 5 = ~80% fewer tokens for context gathering
- **Better edits:** Agent has complete picture before modifying code
- **Consistency:** Standard context format ensures nothing is missed
- **Speed:** Single round-trip instead of sequential calls

### 2.3 Dependencies

| Dependency | Ticket | Status |
|-----------|--------|--------|
| Call graph | KSA-154 | Done |
| Dependency graph | KSA-155 | In Progress |
| Impact analysis | KSA-156 | In Progress |
| KB memory system | Existing | Done |

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: get_edit_context MCP Tool

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| symbol | string | Yes | - | Symbol to edit (name, qualified name, or file:line) |
| include_callers | boolean | No | true | Include caller context |
| include_tests | boolean | No | true | Include related test code |
| include_memories | boolean | No | true | Include KB memories |
| include_git | boolean | No | true | Include git history |
| token_budget | integer | No | 4000 | Max tokens for response |
| caller_depth | integer | No | 1 | Depth for caller search |

#### FR-2: Context Sections

The response includes these sections, prioritized by relevance:

| Section | Priority | Content |
|---------|----------|---------|
| source | 1 (always) | Full source code of the symbol |
| signature | 1 (always) | Function/class signature for quick reference |
| callers | 2 | Direct callers with call site context (2 lines around call) |
| tests | 3 | Related test code (test function bodies) |
| dependencies | 4 | What this symbol imports/uses |
| memories | 5 | Relevant KB entries (decisions, patterns, lessons) |
| git_history | 6 | Recent commits touching this symbol (last 5) |
| siblings | 7 | Other functions in the same file/class |

#### FR-3: Token Budget Management

The tool MUST respect the token_budget parameter:
1. Always include source + signature (minimum)
2. Add sections in priority order until budget exhausted
3. Truncate lower-priority sections if needed
4. Report what was included vs excluded

#### FR-4: Output Format

```json
{
  "symbol": "CallGraphService.findCallers",
  "file": "src/graph/call-graph-service.ts",
  "line": 35,
  "kind": "method",
  
  "source": "async findCallers(...) { ... }",
  "signature": "async findCallers(symbolName: string, depth: number, limit: number): Promise<CallGraphResponse>",
  
  "callers": [
    {
      "symbol": "code_callers handler",
      "file": "src/tools/call-graph-tools.ts",
      "line": 15,
      "context": "const result = await service.findCallers(\n  params.symbol, params.depth, params.limit\n);"
    }
  ],
  
  "tests": [
    {
      "file": "tests/graph/call-graph.test.ts",
      "testName": "should find direct callers",
      "source": "test('should find direct callers', () => { ... })"
    }
  ],
  
  "dependencies": [
    { "symbol": "GraphRepository", "from": "../database/graph-repository" },
    { "symbol": "SymbolResolver", "from": "./symbol-resolver" }
  ],
  
  "memories": [
    { "id": 42, "type": "DECISION", "summary": "Use BFS for graph traversal to avoid stack overflow" }
  ],
  
  "git_history": [
    { "hash": "abc123", "message": "KSA-154: Implement call graph BFS", "date": "2026-05-28", "author": "dev" }
  ],
  
  "metadata": {
    "tokenCount": 3200,
    "tokenBudget": 4000,
    "sectionsIncluded": ["source", "callers", "tests", "dependencies", "memories", "git_history"],
    "sectionsExcluded": ["siblings"],
    "queryTimeMs": 150
  }
}
```

#### FR-5: Performance

| Metric | Target |
|--------|--------|
| Full context (all sections) | < 300ms |
| Minimal context (source only) | < 50ms |

### 3.2 Non-Functional Requirements

- Token counting must be approximate but consistent (use word count * 1.3)
- Git history should not shell out if possible (use git log parsing)
- Memories should be filtered by relevance to the symbol/file

---

## 4. User Stories

### STORY-1: As an AI agent, I want complete context before editing a function

**Acceptance Criteria:**
- Single tool call returns source + callers + tests + memories
- Token budget respected
- Response structured for easy consumption

### STORY-2: As an AI agent, I want to know recent changes to a symbol before modifying it

**Acceptance Criteria:**
- Git history shows last 5 commits touching the file/symbol
- Commit messages help understand intent of previous changes

### STORY-3: As an AI agent, I want relevant architectural decisions when editing code

**Acceptance Criteria:**
- KB memories related to the symbol/file/module are included
- Decisions and patterns are prioritized over raw context

---

## 5. Acceptance Criteria (Summary)

| # | Criterion | Priority |
|---|-----------|----------|
| AC-1 | Source code of symbol returned | Critical |
| AC-2 | Direct callers with context returned | Critical |
| AC-3 | Related tests identified and included | High |
| AC-4 | Token budget respected | High |
| AC-5 | KB memories included | High |
| AC-6 | Git history included | Medium |
| AC-7 | < 300ms response time | High |
| AC-8 | Graceful degradation if sections unavailable | Medium |

---

## 6. Out of Scope

- Automatic edit suggestions (just context, not actions)
- Multi-symbol context (one symbol per call)
- Real-time file watching (uses indexed data)
- IDE integration (MCP tool only)

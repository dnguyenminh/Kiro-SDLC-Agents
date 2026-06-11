# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-158: [AI Context] get_ai_context

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-158 |
| Title | [AI Context] get_ai_context - intent-aware + token budgeting |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-158.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the `get_ai_context` MCP tool — the primary context retrieval interface for AI agents. It assembles relevant code context based on the agent's intent (explain/modify/debug/test) and respects a token budget to fit within context windows.

### 1.2 Scope

- MCP tool interface definition
- Intent-based context assembly logic
- Token budgeting algorithm
- Section prioritization per intent
- Integration with call graph, symbol search, and memory

---

## 2. Functional Requirements

### 2.1 Feature: MCP Tool Interface

#### 2.1.1 Tool Registration

```json
{
  "name": "get_ai_context",
  "description": "Get intent-aware code context for a symbol. Returns source, callers, callees, tests, imports based on intent (explain/modify/debug/test). Respects token budget.",
  "inputSchema": {
    "type": "object",
    "required": ["symbol"],
    "properties": {
      "symbol": {
        "type": "string",
        "description": "Symbol name, qualified name, or file:symbol format"
      },
      "intent": {
        "type": "string",
        "enum": ["explain", "modify", "debug", "test"],
        "default": "explain",
        "description": "What the agent intends to do with this context"
      },
      "token_budget": {
        "type": "integer",
        "default": 4000,
        "minimum": 500,
        "maximum": 32000,
        "description": "Maximum tokens in response (approximate, ±10%)"
      },
      "include_source": {
        "type": "boolean",
        "default": true,
        "description": "Include full source code of the symbol"
      },
      "caller_depth": {
        "type": "integer",
        "default": 1,
        "maximum": 3,
        "description": "Depth for caller/callee traversal"
      }
    }
  }
}
```

---

### 2.2 Feature: Intent-Based Context Assembly

#### 2.2.1 Context Sections by Intent

| Section | explain | modify | debug | test | Description |
|---------|---------|--------|-------|------|-------------|
| source | P1 (always) | P1 (always) | P1 (always) | P1 (always) | Full source code of target symbol |
| doc_comment | P2 | P4 | P3 | P4 | JSDoc/docstring |
| siblings | P3 | P6 | P5 | P6 | Other symbols in same file (signatures only) |
| imports | P4 | P5 | P4 | P5 | Import statements of the file |
| callers | P5 (summary) | P2 (full) | P2 (full) | P7 | Who calls this symbol |
| callees | P6 | P3 | P6 | P3 | What this symbol calls |
| tests | - | P4 | P7 | P2 | Related test files/cases |
| type_defs | P7 | P5 | - | P4 | Type definitions used by symbol |
| error_patterns | - | - | P3 | - | try/catch, throw in function |
| recent_changes | - | P7 | P4 | - | Git commits touching this symbol |
| test_patterns | - | - | - | P3 | Testing patterns used in project |
| mocks_needed | - | - | - | P5 | Dependencies needing mocks |

**Priority Legend:** P1 = highest (always included), P7 = lowest (cut first when budget tight)

#### 2.2.2 Use Case: Explain Intent

**Use Case ID:** UC-01 — Get Context for Explaining Code

| Step | Action | Token Cost |
|------|--------|-----------|
| 1 | Resolve symbol → get source code | ~source_lines × 10 tokens |
| 2 | Get doc_comment | ~50-200 tokens |
| 3 | Get sibling signatures (same file) | ~20 tokens per sibling |
| 4 | Get import statements | ~10 tokens per import |
| 5 | Get caller summary (names only) | ~10 tokens per caller |
| 6 | Get callee summary | ~10 tokens per callee |
| 7 | Get type definitions used | ~50 tokens per type |
| 8 | Trim to budget | Remove lowest priority sections |

#### 2.2.3 Use Case: Modify Intent

**Use Case ID:** UC-02 — Get Context for Modifying Code

| Step | Action | Token Cost |
|------|--------|-----------|
| 1 | Resolve symbol → get source code | ~source_lines × 10 |
| 2 | Get callers with call-site snippets | ~50 tokens per caller |
| 3 | Get callees (what it depends on) | ~30 tokens per callee |
| 4 | Find related tests | ~100 tokens per test case |
| 5 | Get import statements | ~10 per import |
| 6 | Get type definitions | ~50 per type |
| 7 | Get sibling signatures | ~20 per sibling |
| 8 | Trim to budget | Remove P5+ sections first |

#### 2.2.4 Use Case: Debug Intent

**Use Case ID:** UC-03 — Get Context for Debugging

| Step | Action | Token Cost |
|------|--------|-----------|
| 1 | Resolve symbol → get source code | ~source_lines × 10 |
| 2 | Get callers (likely stack trace) | ~50 per caller |
| 3 | Extract error patterns (try/catch/throw) | ~30 per pattern |
| 4 | Get recent git changes | ~100 per commit |
| 5 | Get imports | ~10 per import |
| 6 | Get siblings | ~20 per sibling |
| 7 | Query KB for related errors | ~50 per match |
| 8 | Trim to budget | |

#### 2.2.5 Use Case: Test Intent

**Use Case ID:** UC-04 — Get Context for Writing Tests

| Step | Action | Token Cost |
|------|--------|-----------|
| 1 | Resolve symbol → get source code | ~source_lines × 10 |
| 2 | Find existing tests for this symbol | ~200 per test file |
| 3 | Identify test patterns in project | ~100 |
| 4 | Get callees (dependencies to mock) | ~30 per callee |
| 5 | Get type definitions (for assertions) | ~50 per type |
| 6 | Identify mocks needed | ~30 per mock |
| 7 | Get siblings (for context) | ~20 per sibling |
| 8 | Trim to budget | |

---

### 2.3 Feature: Token Budgeting Algorithm

#### 2.3.1 Algorithm

```
function assemblContext(symbol, intent, budget):
    sections = getSectionsForIntent(intent)  // ordered by priority
    result = {}
    tokensUsed = 0
    
    for section in sections:
        content = fetchSection(section, symbol)
        sectionTokens = estimateTokens(content)
        
        if tokensUsed + sectionTokens <= budget:
            result[section.name] = content
            tokensUsed += sectionTokens
        else:
            // Try to fit partial content
            remaining = budget - tokensUsed
            if remaining > 100:  // minimum useful content
                truncated = truncateToTokens(content, remaining)
                result[section.name] = truncated
                result[section.name + "_truncated"] = true
                tokensUsed += remaining
            break  // budget exhausted
    
    return {
        context: result,
        metadata: {
            budget_used: tokensUsed,
            budget_total: budget,
            sections_included: keys(result),
            sections_omitted: remaining sections not included
        }
    }
```

#### 2.3.2 Token Estimation

| Content Type | Estimation Rule |
|-------------|-----------------|
| Source code | chars / 4 |
| Signatures | chars / 4 |
| JSON/structured | chars / 3.5 |
| Natural language | chars / 4.5 |
| Minimum section | 50 tokens |

#### 2.3.3 Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-01 | Source always included | Even if budget is tiny, include source (truncated if needed) |
| BR-02 | Budget tolerance ±10% | Actual may be 90-110% of budget |
| BR-03 | Minimum budget 500 | Below 500 tokens, only source returned |
| BR-04 | Section granularity | Sections are atomic — include fully or truncate, never skip partially |
| BR-05 | Metadata excluded from budget | metadata object doesn't count toward token budget |

---

### 2.4 Feature: Response Format

#### 2.4.1 Full Response Structure

```json
{
  "symbol": "parseConfig",
  "file_path": "src/config.ts",
  "kind": "function",
  "intent": "modify",
  "context": {
    "source": "export async function parseConfig(path: string): Promise<Config> {\n  ...\n}",
    "callers": [
      {
        "symbol": "initApp",
        "file_path": "src/app.ts",
        "call_site_line": 42,
        "snippet": "  const config = await parseConfig(configPath);"
      }
    ],
    "callees": [
      { "symbol": "readFile", "file_path": "src/fs.ts" },
      { "symbol": "validateSchema", "file_path": "src/validator.ts" }
    ],
    "tests": [
      {
        "file_path": "tests/config.test.ts",
        "test_names": ["parseConfig handles valid YAML", "parseConfig throws on invalid"]
      }
    ],
    "imports": [
      "import { readFile } from 'fs/promises'",
      "import { Schema } from './types'"
    ],
    "type_definitions": [
      "interface Config { port: number; host: string; db: DatabaseConfig; }"
    ]
  },
  "metadata": {
    "budget_used": 3450,
    "budget_total": 4000,
    "sections_included": ["source", "callers", "callees", "tests", "imports", "type_definitions"],
    "sections_omitted": ["siblings", "recent_changes"],
    "query_time_ms": 85
  }
}
```

---

## 3. Non-Functional Requirements

| Metric | Target |
|--------|--------|
| Response time (explain, budget ≤4K) | <200ms |
| Response time (modify, budget ≤8K) | <500ms |
| Response time (debug, with git) | <1000ms |
| Token accuracy | ±10% of budget |
| Availability | Always returns source (minimum) |

---

## 4. Error Handling

| Error | Response |
|-------|----------|
| Symbol not found | Error + fuzzy suggestions |
| No graph data available | Return source only + note "Graph not indexed" |
| Git not available (debug intent) | Skip recent_changes section, proceed |
| KB not available | Skip error_patterns from KB, proceed |
| Budget too small (<500) | Return source only + warning |

---

## 5. Integration Points

| System | Usage | Direction |
|--------|-------|-----------|
| code_callers (KSA-154) | Get caller chain | Call |
| code_callees (KSA-154) | Get callee list | Call |
| code_search (existing) | Resolve symbol | Call |
| code_context (existing) | Get source code | Call |
| mem_search (existing) | Error patterns from KB | Call |
| Git CLI | Recent changes | Call |
| Symbols table | Type definitions, siblings | SQL query |

---

## 6. Open Issues

| # | Issue | Decision Needed |
|---|-------|-----------------|
| 1 | Should test discovery use file naming convention or import analysis? | Both (convention first, imports as fallback) |
| 2 | How to handle monorepo with multiple test frameworks? | Detect from package.json/config files |
| 3 | Should recent_changes use git log or git blame? | git log for debug, git blame for modify |

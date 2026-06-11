# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-158: [AI Context] get_ai_context - intent-aware + token budgeting

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-158 |
| Title | [AI Context] get_ai_context - intent-aware + token budgeting |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-28 | BA Agent | Initial document — auto-generated from Jira ticket KSA-158 |

---

## 1. Introduction

### 1.1 Scope

Implement `get_ai_context` MCP tool — the **primary context retrieval tool** for AI agents. This tool is intent-aware (explain/modify/debug/test) and respects token budgets. Based on the intent, it returns different combinations of:
- Source code of the target symbol
- Related symbols (callers, callees, siblings)
- Import context
- Debug hints (error patterns, stack traces)
- Test context (related tests, test patterns)

This is the **highest-value tool** in the Code Intelligence v2 suite — it's what AI agents call most frequently to understand code before taking action.

### 1.2 Out of Scope

- `get_edit_context` tool (source + callers + tests + memories + git history — separate ticket)
- `get_curated_context` tool (NL query cross-codebase — separate ticket)
- Graph data model (KSA-153 — prerequisite)
- Call graph tools (KSA-154 — prerequisite for caller/callee data)
- Memory layer integration (already exists in FEC)

### 1.3 Preliminary Requirements

- Graph data model with relationships (KSA-153)
- Call graph tools working (KSA-154)
- At least one language parser populating relationships (KSA-146)
- Symbol search working (existing code_search tool)

---

## 2. Business Requirements

### 2.1 High Level Process Map

Currently, AI agents must manually:
1. Search for a symbol (`code_search`)
2. Read the file (`code_context`)
3. Guess what other code is relevant
4. Manually search for callers, tests, imports

`get_ai_context` replaces this multi-step process with a **single intelligent call** that returns exactly the right context based on what the agent intends to do.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As an AI agent, I want intent-aware context so I get different data for explain vs modify vs debug | MUST HAVE | KSA-158 |
| 2 | As an AI agent, I want token budgeting so context fits my context window | MUST HAVE | KSA-158 |
| 3 | As an AI agent, I want source + callers + imports in one call for modify intent | MUST HAVE | KSA-158 |
| 4 | As an AI agent, I want debug hints (error patterns, related failures) for debug intent | SHOULD HAVE | KSA-158 |
| 5 | As an AI agent, I want related test context for test intent | SHOULD HAVE | KSA-158 |
| 6 | As an AI agent, I want sibling symbols (same file/class) for explain intent | MUST HAVE | KSA-158 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** AI agent needs to understand/modify/debug/test a symbol

**Step 2:** Agent calls `get_ai_context(symbol="parseConfig", intent="modify", token_budget=4000)`

**Step 3:** Tool resolves symbol to its definition (file, line range)

**Step 4:** Based on intent, tool assembles context package:
- **explain**: source + docstring + siblings + imports
- **modify**: source + callers + callees + tests + imports
- **debug**: source + callers + error patterns + stack traces + recent changes
- **test**: source + existing tests + test patterns + dependencies

**Step 5:** Token budgeting trims context to fit budget (prioritized sections)

**Step 6:** Return structured context package to agent

---

#### STORY 1: Intent-Aware Context

> As an AI agent, I want intent-aware context so I get exactly the right information for my current task.

**Intent Definitions:**

| Intent | Use Case | Context Sections (priority order) |
|--------|----------|----------------------------------|
| `explain` | Understand what code does | 1. Source, 2. Doc comments, 3. Siblings, 4. Imports, 5. Callers (summary) |
| `modify` | Change/refactor code | 1. Source, 2. Callers (full), 3. Callees, 4. Tests, 5. Imports, 6. Type definitions |
| `debug` | Fix a bug | 1. Source, 2. Callers, 3. Error patterns, 4. Recent git changes, 5. Related failures |
| `test` | Write/fix tests | 1. Source, 2. Existing tests, 3. Test patterns, 4. Dependencies, 5. Mocks needed |

**Acceptance Criteria:**

1. All 4 intents supported: explain, modify, debug, test
2. Each intent returns different context sections in different priority order
3. Default intent is `explain` if not specified
4. Invalid intent returns error with list of valid intents

---

#### STORY 2: Token Budgeting

> As an AI agent, I want token budgeting so the returned context fits within my available context window.

**Requirement Details:**

1. `token_budget` parameter specifies max tokens in response (approximate)
2. Sections filled in priority order until budget exhausted
3. Lower-priority sections truncated or omitted when budget is tight
4. Source code of target symbol is ALWAYS included (minimum viable context)
5. Token estimation: ~4 chars per token (rough approximation)

**Budget Allocation Strategy:**

| Budget Range | Behavior |
|-------------|----------|
| < 1000 tokens | Source only (truncated if needed) |
| 1000-2000 | Source + imports + doc comments |
| 2000-4000 | Source + callers/callees (summaries) + imports |
| 4000-8000 | Full context per intent definition |
| > 8000 | Full context + extended (more callers, full test files) |

**Acceptance Criteria:**

1. Response token count stays within budget (±10% tolerance)
2. Source code always included regardless of budget
3. Sections clearly labeled so agent knows what was included/omitted
4. `budget_used` and `budget_remaining` in response metadata
5. `sections_omitted` lists what was cut due to budget

---

#### STORY 3: Modify Intent Context

> As an AI agent, I want source + callers + imports in one call when I intend to modify code, so I understand the blast radius.

**Response Structure for `intent=modify`:**

```json
{
  "symbol": "parseConfig",
  "file_path": "src/config.ts",
  "intent": "modify",
  "context": {
    "source": "// full source code of parseConfig function",
    "callers": [
      { "symbol": "initApp", "file": "src/app.ts", "line": 42, "snippet": "const cfg = parseConfig(path)" }
    ],
    "callees": [
      { "symbol": "readFile", "file": "src/fs.ts", "line": 10 },
      { "symbol": "validateSchema", "file": "src/validator.ts", "line": 5 }
    ],
    "tests": [
      { "file": "tests/config.test.ts", "test_name": "parseConfig handles invalid YAML" }
    ],
    "imports": ["import { readFile } from 'fs'", "import { Schema } from './types'"],
    "type_definitions": ["interface ConfigOptions { ... }"]
  },
  "metadata": {
    "budget_used": 3200,
    "budget_total": 4000,
    "sections_included": ["source", "callers", "callees", "tests", "imports"],
    "sections_omitted": ["type_definitions"]
  }
}
```

**Acceptance Criteria:**

1. Modify intent includes callers with call-site snippets
2. Modify intent includes callees for understanding dependencies
3. Modify intent includes related tests (if found)
4. All sections labeled and structured for easy agent consumption

---

#### STORY 4: Debug Intent Context

> As an AI agent, I want debug hints (error patterns, related failures) when debugging, so I can quickly identify the issue.

**Debug-specific sections:**

| Section | Source | Description |
|---------|--------|-------------|
| error_patterns | Code analysis | try/catch blocks, throw statements in the function |
| recent_changes | Git history | Recent commits touching this file/function |
| related_failures | Memory/KB | Known error patterns from KB |
| stack_trace_hints | Code analysis | Functions likely in stack trace (callers chain) |

**Acceptance Criteria:**

1. Debug intent includes error handling patterns from the function
2. Debug intent includes caller chain (likely stack trace)
3. Debug intent queries KB for related error patterns (if available)
4. Graceful when git history or KB data unavailable

---

#### STORY 5: Test Intent Context

> As an AI agent, I want related test context when writing tests, so I can follow existing patterns.

**Test-specific sections:**

| Section | Source | Description |
|---------|--------|-------------|
| existing_tests | File search | Test files that import/test this symbol |
| test_patterns | Analysis | Describe/it structure, assertion patterns used |
| dependencies | Call graph | What the function depends on (need mocking) |
| mocks_needed | Analysis | External dependencies that need mocking |

**Acceptance Criteria:**

1. Test intent finds existing test files for the symbol
2. Test intent identifies dependencies that need mocking
3. Test intent shows test patterns used in the project (describe/it, test(), etc.)
4. Graceful when no existing tests found

---

#### STORY 6: Sibling Context for Explain

> As an AI agent, I want sibling symbols (same file/class) for explain intent, so I understand the symbol in context.

**Acceptance Criteria:**

1. Explain intent includes other symbols in the same file (signatures only)
2. If symbol is a method, include other methods of the same class
3. Siblings shown as signatures (not full source) to save tokens
4. Siblings ordered by proximity (closest in file first)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Graph data model (KSA-153) | System | KSA-153 | Relationships for callers/callees |
| Call graph tools (KSA-154) | System | KSA-154 | code_callers/code_callees queries |
| TypeScript parser (KSA-146) | System | KSA-146 | Populated relationship data |
| Symbol search (existing) | System | N/A | Resolve symbol name to definition |
| Memory/KB layer (existing) | System | N/A | Error patterns, known issues |
| Git integration | System | N/A | Recent changes (optional) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve context strategy |
| Developer | Code Intelligence Team | Implement context assembly |
| QA | QA Team | Verify context quality |
| Users | AI Agents (Claude, Copilot, etc.) | Primary consumers |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Token estimation inaccurate | Medium | Medium | Use conservative estimate, allow ±10% |
| Graph data incomplete (missing relationships) | Medium | Medium | Graceful degradation, return what's available |
| Performance with large context assembly | Medium | Low | Cache frequently accessed symbols |
| Intent classification ambiguous | Low | Low | Default to explain, let agent specify |

### 5.2 Assumptions

- AI agents know their available token budget
- 4 intents cover 90%+ of agent use cases
- Graph data (callers/callees) is available for most symbols
- Token estimation at ~4 chars/token is sufficient accuracy
- Git history access is optional (graceful without it)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Response <200ms | For typical symbol with depth=1 callers |
| Performance | Response <500ms | For complex symbol with depth=2 + tests |
| Accuracy | Token budget ±10% | Actual tokens within 10% of budget |
| Reliability | Always return source | Even if other sections fail |
| Usability | Structured JSON response | Easy for agents to parse sections |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-158 | [AI Context] get_ai_context | To Do | Task | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | To Do | Epic | Parent epic |
| KSA-153 | [Graph] Data Model & Storage | To Do | Task | Prerequisite |
| KSA-154 | [Graph] Call Graph | To Do | Task | Prerequisite |
| KSA-145 | [Tree-sitter] Core Integration | To Do | Task | Foundation |
| KSA-146 | [Tree-sitter] TypeScript/JavaScript Parser | To Do | Task | Data source |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Intent | The purpose of the AI agent's query (explain/modify/debug/test) |
| Token budget | Maximum number of tokens the response should contain |
| Context window | Total available tokens for an AI model's input |
| Blast radius | All code affected by a change (transitive callers) |
| Sibling | Other symbols in the same file or class |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| CodeGraph AI Context tools | Section 4 of comparison doc |
| MCP Protocol specification | https://modelcontextprotocol.io/ |

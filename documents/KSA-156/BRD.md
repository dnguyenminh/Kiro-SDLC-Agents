# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-156: [Graph] Impact Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-156 |
| Title | [Graph] Impact Analysis - blast radius prediction |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |
| Priority | Highest |
| Estimate | 1 week |

---

## 1. Executive Summary

Implement `code_impact` MCP tool that predicts what breaks if you modify, delete, or rename a symbol. Combines call graph (KSA-154) + dependency graph (KSA-155) to compute blast radius — the set of files, functions, and tests affected by a change.

---

## 2. Business Context

### 2.1 Problem Statement

Before making changes, developers and AI agents need to know: "If I modify function X, what else might break?" Currently this requires manual grep/search which misses transitive dependencies and indirect callers.

### 2.2 Business Value

- **Safer refactoring:** Know full impact before changing code
- **Better PR reviews:** Understand scope of changes
- **AI agent confidence:** Agents can make targeted changes knowing the blast radius
- **Test selection:** Run only tests affected by a change

### 2.3 Dependencies

| Dependency | Ticket | Status |
|-----------|--------|--------|
| Call graph (callers/callees) | KSA-154 | Done |
| Dependency graph (imports) | KSA-155 | In Progress |
| Graph data model | KSA-153 | Done |

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: code_impact MCP Tool

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| symbol | string | Yes | - | Symbol name or file:symbol |
| action | enum | No | "modify" | "modify", "delete", "rename" |
| depth | integer | No | 3 | How deep to trace impact (1-5) |
| include_tests | boolean | No | true | Include test files in results |
| severity_threshold | enum | No | "low" | "critical", "high", "medium", "low" |

#### FR-2: Impact Categories

| Category | Severity | Description |
|----------|----------|-------------|
| Direct callers | Critical | Functions that directly call the modified symbol |
| Transitive callers | High | Functions that call direct callers (depth 2+) |
| Interface implementors | Critical | Classes implementing modified interface method |
| Dependent files | Medium | Files importing the modified file |
| Related tests | High | Test files that test the modified symbol or its callers |
| Type users | Medium | Symbols using the modified type in signatures |

#### FR-3: Action-Specific Analysis

| Action | Additional Analysis |
|--------|-------------------|
| modify | Callers may need update if signature changes |
| delete | All callers WILL break, all imports WILL break |
| rename | All callers need update, all imports need update |

#### FR-4: Output Format

```json
{
  "symbol": "GraphRepository.findCallers",
  "action": "modify",
  "blastRadius": {
    "summary": { "critical": 2, "high": 5, "medium": 12, "low": 3 },
    "totalAffected": 22,
    "affectedFiles": 8,
    "affectedTests": 3
  },
  "impacts": [
    {
      "symbol": "CallGraphService.findCallers",
      "file": "src/graph/call-graph-service.ts",
      "line": 45,
      "severity": "critical",
      "reason": "Direct caller",
      "callSite": "this.graphRepo.findCallers(current, kindFilter, limit)"
    },
    {
      "symbol": "code_callers handler",
      "file": "src/tools/call-graph-tools.ts",
      "line": 12,
      "severity": "high",
      "reason": "Transitive caller (depth 2)",
      "chain": ["GraphRepository.findCallers", "CallGraphService.findCallers", "code_callers handler"]
    }
  ],
  "affectedTests": [
    { "file": "tests/graph/call-graph.test.ts", "reason": "Tests CallGraphService" }
  ],
  "recommendations": [
    "Update CallGraphService.findCallers if signature changes",
    "Run tests: tests/graph/call-graph.test.ts, tests/tools/call-graph-tools.test.ts"
  ]
}
```

#### FR-5: Performance

| Metric | Target |
|--------|--------|
| Depth 1 analysis | < 100ms |
| Depth 3 analysis | < 500ms |
| Depth 5 analysis | < 2000ms |

### 3.2 Non-Functional Requirements

- Must handle symbols with many callers (>100) without timeout
- Cycle-safe (same symbol can appear in multiple paths)
- Results sorted by severity (critical first)

---

## 4. User Stories

### STORY-1: As an AI agent, I want to know what breaks if I modify a function

**Acceptance Criteria:**
- `code_impact(symbol: "findCallers", action: "modify")` returns all direct + transitive callers
- Results include severity classification
- Affected test files identified

### STORY-2: As an AI agent, I want to safely delete unused code

**Acceptance Criteria:**
- `code_impact(symbol: "oldHelper", action: "delete")` shows if anything still uses it
- If blastRadius.totalAffected = 0, safe to delete
- If > 0, shows exactly what would break

### STORY-3: As an AI agent, I want to rename a symbol and update all references

**Acceptance Criteria:**
- `code_impact(symbol: "getUserName", action: "rename")` lists all call sites
- Includes import statements that reference the symbol
- Includes test files that reference it

---

## 5. Acceptance Criteria (Summary)

| # | Criterion | Priority |
|---|-----------|----------|
| AC-1 | Direct callers identified with call site info | Critical |
| AC-2 | Transitive callers traced to configured depth | Critical |
| AC-3 | Severity classification (critical/high/medium/low) | High |
| AC-4 | Affected test files identified | High |
| AC-5 | Action-specific analysis (modify/delete/rename) | High |
| AC-6 | Recommendations generated | Medium |
| AC-7 | < 500ms for depth 3 | High |
| AC-8 | Handles 100+ callers without timeout | Medium |

---

## 6. Out of Scope

- Automatic code modification (just analysis, not fix)
- Runtime impact (only static analysis)
- Cross-repository impact
- Semantic versioning impact (breaking change detection)

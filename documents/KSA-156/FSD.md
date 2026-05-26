# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-156: [Graph] Impact Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-156 |
| Title | [Graph] Impact Analysis - blast radius prediction |
| Author | BA + TA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-156.docx |

---

## 1. Overview

Impact analysis combines call graph traversal (KSA-154) and dependency graph (KSA-155) to compute the "blast radius" of a code change. It answers: "What symbols, files, and tests are affected if I modify/delete/rename symbol X?"

---

## 2. Use Cases

### UC-1: Analyze Modify Impact

| Field | Value |
|-------|-------|
| Actor | AI Agent |
| Trigger | Agent calls `code_impact` before modifying a function |

**Main Flow:**
1. Agent provides symbol name and action="modify"
2. Service resolves symbol to ID(s) via SymbolResolver
3. Find direct callers (depth 1) -> severity: critical
4. Find transitive callers (depth 2+) -> severity: high/medium
5. Find interface implementors if symbol is interface method -> severity: critical
6. Find dependent files (via import graph) -> severity: medium
7. Find related test files -> severity: high
8. Classify and sort results by severity
9. Generate recommendations
10. Return ImpactResult

**Alternative Flow — Symbol Not Found:**
1. SymbolResolver returns empty
2. Return error with suggestions (fuzzy matches)

### UC-2: Analyze Delete Impact

**Main Flow:**
1. Same as UC-1 but ALL callers are severity: critical (they WILL break)
2. ALL importers of the file are severity: high
3. Recommendations include "Remove all references before deleting"

### UC-3: Analyze Rename Impact

**Main Flow:**
1. Same as UC-1 for callers
2. Additionally find all import statements referencing the symbol name
3. All call sites need text replacement
4. Recommendations include list of files needing update

---

## 3. Detailed Specifications

### 3.1 MCP Tool Schema

```json
{
  "name": "code_impact",
  "description": "Predict blast radius of modifying, deleting, or renaming a symbol",
  "inputSchema": {
    "type": "object",
    "required": ["symbol"],
    "properties": {
      "symbol": {
        "type": "string",
        "description": "Symbol name, qualified name (Class.method), or file:symbol"
      },
      "action": {
        "type": "string",
        "enum": ["modify", "delete", "rename"],
        "default": "modify"
      },
      "depth": {
        "type": "integer",
        "minimum": 1,
        "maximum": 5,
        "default": 3
      },
      "include_tests": {
        "type": "boolean",
        "default": true
      },
      "severity_threshold": {
        "type": "string",
        "enum": ["critical", "high", "medium", "low"],
        "default": "low"
      }
    }
  }
}
```

### 3.2 Severity Classification Rules

| Condition | Severity | Rationale |
|-----------|----------|-----------|
| Direct caller of modified symbol | Critical | Will likely break if signature changes |
| Implements modified interface method | Critical | Contract violation |
| Transitive caller (depth 2) | High | May need cascading updates |
| Test file testing the symbol | High | Tests will fail |
| File importing modified file | Medium | May need import update |
| Transitive caller (depth 3+) | Medium | Indirect impact |
| Type user (uses in signature) | Medium | Type compatibility |
| Transitive caller (depth 4+) | Low | Very indirect |

**Action modifiers:**
- `delete`: All callers escalate to Critical (they WILL break)
- `rename`: All reference sites escalate to High (they WILL need update)

### 3.3 Test File Detection

A file is considered a "test file" if:
- Path contains `/test/`, `/tests/`, `/__tests__/`, `/spec/`
- Filename matches `*.test.ts`, `*.spec.ts`, `*_test.py`, `test_*.py`, `*Test.kt`
- File imports test frameworks (`jest`, `vitest`, `pytest`, `junit`)

**Test relevance:** A test is "related" to symbol X if:
- Test file directly calls X (from call graph)
- Test file imports the file containing X
- Test file name matches the source file name pattern

### 3.4 Recommendation Generation

Based on action and impact:

| Condition | Recommendation |
|-----------|---------------|
| action=modify, has callers | "Update callers if signature changes: {list}" |
| action=modify, has tests | "Run affected tests: {list}" |
| action=delete, has callers | "Remove all {N} references before deleting" |
| action=delete, no callers | "Safe to delete — no references found" |
| action=rename, has references | "Update {N} files with new name" |
| any, has interface impl | "Check interface contract compatibility" |

### 3.5 Impact Chain Tracking

For transitive impacts, track the full chain:

```json
{
  "symbol": "handler",
  "severity": "high",
  "reason": "Transitive caller (depth 2)",
  "chain": ["targetSymbol", "directCaller", "handler"]
}
```

This helps developers understand WHY something is affected.

---

## 4. Algorithm

```
function analyzeImpact(symbol, action, depth):
  resolved = symbolResolver.resolve(symbol)
  impacts = []
  
  // 1. Direct callers (from call graph)
  for each resolved symbol:
    callers = callGraphService.findCallers(symbol, depth)
    for each caller:
      severity = classifySeverity(caller.depth, action)
      impacts.push({ ...caller, severity, reason: "Caller" })
  
  // 2. Interface implementors
  if resolved.kind == 'method' and parent is interface:
    implementors = findImplementors(parent, symbol.name)
    for each impl:
      impacts.push({ ...impl, severity: "critical", reason: "Implements interface" })
  
  // 3. Dependent files (from dependency graph)
  fileDeps = dependencyGraphService.query(resolved.file, "incoming", depth)
  for each dep:
    impacts.push({ file: dep.file, severity: "medium", reason: "Imports modified file" })
  
  // 4. Related tests
  if include_tests:
    tests = findRelatedTests(resolved, impacts)
    for each test:
      impacts.push({ ...test, severity: "high", reason: "Tests affected symbol" })
  
  // 5. Deduplicate and sort
  impacts = deduplicate(impacts)
  impacts.sort(bySeverityThenFile)
  
  // 6. Generate recommendations
  recommendations = generateRecommendations(impacts, action)
  
  return { symbol, action, blastRadius: summarize(impacts), impacts, recommendations }
```

---

## 5. Error Handling

| Scenario | Response |
|----------|----------|
| Symbol not found | Error with fuzzy suggestions |
| No callers/deps | `{ blastRadius: { totalAffected: 0 }, impacts: [], recommendations: ["Safe to proceed"] }` |
| Timeout (>2s) | Partial results with truncated=true |
| Graph not indexed | Error: "Run indexer first" |

---

## 6. Integration Points

| Component | Usage |
|-----------|-------|
| CallGraphService (KSA-154) | findCallers() for call chain |
| DependencyGraphService (KSA-155) | query(incoming) for file deps |
| SymbolResolver (KSA-154) | Resolve symbol name to IDs |
| GraphRepository (KSA-153) | Direct queries for implementors |

---

## 7. Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| T-1 | Modify function with 3 callers | 3 critical impacts |
| T-2 | Delete unused function | totalAffected = 0, "safe to delete" |
| T-3 | Delete used function | All callers = critical |
| T-4 | Rename with imports | Import sites listed |
| T-5 | Interface method modify | Implementors = critical |
| T-6 | Deep transitive (depth 3) | Chain tracked correctly |
| T-7 | Test file detection | Related tests found |
| T-8 | Cycle in call graph | No infinite loop |
| T-9 | Symbol not found | Error with suggestions |
| T-10 | Large blast radius (50+) | Results truncated, performance OK |

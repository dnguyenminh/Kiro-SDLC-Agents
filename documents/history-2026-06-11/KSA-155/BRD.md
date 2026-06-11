# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-155: [Graph] Dependency Graph

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-155 |
| Title | [Graph] Dependency Graph - imports with direction & depth |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Draft |
| Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |
| Priority | Highest |
| Estimate | 0.5 week |

---

## 1. Executive Summary

Implement `code_dependencies` MCP tool that exposes file/module import relationships as a navigable dependency graph. Supports direction control (incoming/outgoing/both) and depth traversal for understanding module coupling and dependency chains.

---

## 2. Business Context

### 2.1 Problem Statement

Currently no way to answer: "What modules depend on this file?" or "What does this module import transitively?" These questions are critical for impact analysis, refactoring planning, and understanding module boundaries.

### 2.2 Dependencies

| Dependency | Ticket | Status |
|-----------|--------|--------|
| Graph data model (relationships table) | KSA-153 | Done |
| Call graph tools (BFS pattern) | KSA-154 | Done |
| Tree-sitter parsers (import extraction) | KSA-145/146/147/148 | Done/In Progress |

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: code_dependencies MCP Tool

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| file | string | Yes | - | File path or module name |
| direction | enum | No | "outgoing" | "incoming", "outgoing", or "both" |
| depth | integer | No | 1 | Traversal depth (1-5) |
| include_external | boolean | No | false | Include node_modules/stdlib imports |
| format | enum | No | "tree" | "tree", "flat", or "graph" |
| limit | integer | No | 50 | Max results |

#### FR-2: Direction Semantics

| Direction | Meaning | Use Case |
|-----------|---------|----------|
| outgoing | Files that THIS file imports | "What does this module depend on?" |
| incoming | Files that import THIS file | "Who depends on this module?" |
| both | Union of incoming + outgoing | "Full dependency neighborhood" |

#### FR-3: Output Formats

**Tree format** (default):
```json
{
  "root": "src/graph/call-graph-service.ts",
  "direction": "outgoing",
  "depth": 2,
  "tree": {
    "src/graph/call-graph-service.ts": {
      "src/database/graph-repository.ts": {
        "src/database/db.ts": {}
      },
      "src/graph/symbol-resolver.ts": {
        "src/database/db.ts": {}
      }
    }
  },
  "metadata": { "totalNodes": 4, "totalEdges": 4, "maxDepthReached": 2 }
}
```

**Flat format:**
```json
{
  "root": "src/graph/call-graph-service.ts",
  "dependencies": [
    { "file": "src/database/graph-repository.ts", "depth": 1, "importedSymbols": ["GraphRepository"] },
    { "file": "src/graph/symbol-resolver.ts", "depth": 1, "importedSymbols": ["SymbolResolver"] },
    { "file": "src/database/db.ts", "depth": 2, "importedSymbols": ["Database"] }
  ]
}
```

**Graph format** (for visualization):
```json
{
  "nodes": [
    { "id": "src/graph/call-graph-service.ts", "label": "call-graph-service", "depth": 0 },
    { "id": "src/database/graph-repository.ts", "label": "graph-repository", "depth": 1 }
  ],
  "edges": [
    { "from": "src/graph/call-graph-service.ts", "to": "src/database/graph-repository.ts", "symbols": ["GraphRepository"] }
  ]
}
```

#### FR-4: External Dependency Handling

| Category | Example | Default Behavior |
|----------|---------|-----------------|
| Project files | `./utils`, `../core/base` | Always included |
| node_modules | `express`, `better-sqlite3` | Excluded by default |
| stdlib | `path`, `fs`, `os` | Excluded by default |
| Workspace packages | `@company/shared` | Included |

#### FR-5: Performance

| Metric | Target |
|--------|--------|
| Depth 1 query | < 50ms |
| Depth 3 query | < 200ms |
| Depth 5 query | < 500ms |

### 3.2 Non-Functional Requirements

- Cycle detection: if A imports B imports A, don't infinite loop
- Consistent with call graph tool patterns (KSA-154)
- Works with all supported languages (TS, Kotlin, Python)

---

## 4. User Stories

### STORY-1: As an AI agent, I want to see what a module depends on so I can understand its coupling

**Acceptance Criteria:**
- `code_dependencies(file: "src/server.ts", direction: "outgoing")` returns all direct imports
- Depth 2 shows transitive dependencies
- External packages excluded by default

### STORY-2: As an AI agent, I want to find all files that depend on a module so I can assess refactoring impact

**Acceptance Criteria:**
- `code_dependencies(file: "src/utils/logger.ts", direction: "incoming")` returns all importers
- Depth 2 shows indirect dependents
- Result includes which symbols are imported

### STORY-3: As an AI agent, I want a dependency graph for visualization

**Acceptance Criteria:**
- `format: "graph"` returns nodes + edges suitable for rendering
- No duplicate edges
- Cycle-safe (visited set)

---

## 5. Acceptance Criteria (Summary)

| # | Criterion | Priority |
|---|-----------|----------|
| AC-1 | Outgoing dependencies (depth 1-5) work correctly | Critical |
| AC-2 | Incoming dependencies (depth 1-5) work correctly | Critical |
| AC-3 | Cycle detection prevents infinite loops | Critical |
| AC-4 | External dependencies filtered by default | High |
| AC-5 | All 3 output formats work | High |
| AC-6 | Imported symbol names included in results | High |
| AC-7 | < 50ms for depth 1 | High |
| AC-8 | Works across TS, Kotlin, Python files | Medium |

---

## 6. Out of Scope

- Dynamic imports (`require()` with variables, `importlib.import_module()`)
- Re-export chains resolution
- Package.json dependency analysis (npm audit territory)
- Circular dependency breaking suggestions

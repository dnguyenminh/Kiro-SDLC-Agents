# Functional Specification Document (FSD)

## MCP Code Intelligence Python — KSA-179: [Python] Graph Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-179 |
| Title | [Python] Graph Engine |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-179.docx |
| Related FSD | FSD-v1-KSA-179.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-25 | BA + TA Agent | Initial — inferred from nodejs source + PARALLEL-PLAN |

---

## 1. System Overview

### 1.1 System Context

The Graph Engine is a module within `mcp-code-intelligence-python` that provides code relationship analysis. It reads from a SQLite database populated by tree-sitter parsers (KSA-178) and exposes graph traversal capabilities via MCP tools.

### 1.2 Module Location

```
mcp-code-intelligence-python/src/mcp_code_intel/graph/
├── __init__.py
├── symbol_resolver.py
├── call_graph_service.py
├── dependency_graph_service.py
├── impact_analysis_service.py
├── traverser.py
├── test_detector.py
├── file_resolver.py
└── formatters.py
```

---

## 2. Use Cases

### UC-01: Find Callers

| Field | Value |
|-------|-------|
| ID | UC-01 |
| Name | Find Callers |
| Actor | Developer, AI Agent |
| Priority | MUST HAVE |
| Precondition | Database indexed with symbols and relationships |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Provides symbol name, depth, limit, file_filter | |
| 2 | | Resolves symbol via SymbolResolver |
| 3 | | Performs BFS on relationships (kind='calls', direction=incoming) |
| 4 | | Applies file filter if provided |
| 5 | | Returns CallGraphResponse with results + metadata |

**Alternative Flow — Symbol Not Found:**

| Step | System |
|------|--------|
| 2a | Symbol not found → return empty response with suggestions |

**Exception Flow — Database Error:**

| Step | System |
|------|--------|
| 3a | SQLite error → return empty response, log error |

---

### UC-02: Find Callees

| Field | Value |
|-------|-------|
| ID | UC-02 |
| Name | Find Callees |
| Actor | Developer, AI Agent |
| Priority | MUST HAVE |
| Precondition | Database indexed |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Provides symbol name, depth, limit, include_external | |
| 2 | | Resolves symbol via SymbolResolver |
| 3 | | Performs BFS on relationships (kind='calls', direction=outgoing) |
| 4 | | For each callee, re-resolves to get file/line info |
| 5 | | Filters external if include_external=False |
| 6 | | Returns CallGraphResponse |

---

### UC-03: Query Dependency Graph

| Field | Value |
|-------|-------|
| ID | UC-03 |
| Name | Query Dependency Graph |
| Actor | Developer, AI Agent |
| Priority | MUST HAVE |
| Precondition | Database indexed with import relationships |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Provides file path, direction, depth, include_external | |
| 2 | | Resolves file via FileResolver |
| 3 | | Performs BFS on relationships (kind='imports') |
| 4 | | Tracks imported symbols per dependency |
| 5 | | Detects cycles during traversal |
| 6 | | Returns DependencyResult with results + cycles + metadata |

**Alternative Flow — Direction='both':**

| Step | System |
|------|--------|
| 3a | Run outgoing BFS + incoming BFS separately |
| 3b | Merge results (deduplicate by file path) |

---

### UC-04: Analyze Impact

| Field | Value |
|-------|-------|
| ID | UC-04 |
| Name | Analyze Impact (Blast Radius) |
| Actor | Developer, AI Agent, CI/CD |
| Priority | MUST HAVE |
| Precondition | Database indexed |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Provides symbol name, action, depth, include_tests, severity_threshold | |
| 2 | | Resolves symbol |
| 3 | | Finds callers via CallGraphService |
| 4 | | Finds interface implementors |
| 5 | | Finds file-level dependents via DependencyGraphService |
| 6 | | Finds related tests via TestDetector |
| 7 | | Classifies severity for each impact |
| 8 | | Filters by severity threshold |
| 9 | | Deduplicates and sorts |
| 10 | | Generates recommendations |
| 11 | | Returns ImpactResult |

---

### UC-05: Traverse Graph

| Field | Value |
|-------|-------|
| ID | UC-05 |
| Name | Generic Graph Traversal |
| Actor | Developer, AI Agent |
| Priority | MUST HAVE |
| Precondition | Database indexed |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Provides symbol, edge_types, node_types, direction, max_depth, include_source | |
| 2 | | Resolves start node via SymbolResolver |
| 3 | | Performs BFS with edge/node type filters |
| 4 | | Optionally reads source code snippets |
| 5 | | Formats response with path information |
| 6 | | Returns TraverseResponse |

---

## 3. Functional Requirements

### 3.1 Symbol Resolver

#### 3.1.1 Resolution Strategies

| Priority | Strategy | Input Format | SQL Query |
|----------|----------|-------------|-----------|
| 1 | Exact match | `processData` | `WHERE s.name = ?` |
| 2 | Qualified name | `DataService.processData` | `WHERE s.name = ? AND p.name = ?` (join parent) |
| 3 | File:symbol | `utils.py:helper` | `WHERE s.name = ? AND f.relative_path LIKE ?` |
| 4 | Fuzzy suggest | `procDat` | `WHERE s.name LIKE ?` |

#### 3.1.2 Data Model — ResolvedSymbol

```python
@dataclass
class ResolvedSymbol:
    id: int
    name: str
    kind: str          # function, class, method, interface, variable
    file_path: str     # relative path
    line: int          # start line
    parent_symbol_id: int | None
```

---

### 3.2 Call Graph Service

#### 3.2.1 API Contract — find_callers

```python
def find_callers(
    symbol_name: str,
    depth: int = 1,          # 1-5, clamped
    limit: int = 20,
    file_filter: str | None = None,  # glob pattern
    kind_filter: str = "calls"
) -> CallGraphResponse
```

#### 3.2.2 API Contract — find_callees

```python
def find_callees(
    symbol_name: str,
    depth: int = 1,
    limit: int = 20,
    file_filter: str | None = None,
    include_external: bool = True
) -> CallGraphResponse
```

#### 3.2.3 Response Schema — CallGraphResponse

```python
@dataclass
class CallGraphItem:
    symbol: str
    qualified_name: str
    kind: str
    file_path: str
    definition_line: int
    call_site_line: int
    depth_level: int
    parameters: str | None = None
    is_async: bool = False

@dataclass
class CallGraphResponse:
    symbol: str
    resolved_to: list[dict]  # [{id, file, line, kind}]
    results: list[CallGraphItem]
    metadata: dict  # {totalCount, depthSearched, truncated, queryTimeMs}
```

#### 3.2.4 BFS Algorithm

```
queue = [(resolved_symbols, depth=0)]
visited = set()

while queue not empty AND results < limit:
    current, current_depth = queue.pop(0)
    if current_depth >= max_depth: continue
    
    callers = db.find_callers(current.name, kind_filter)
    for caller in callers:
        if caller.id in visited: continue
        visited.add(caller.id)
        
        if file_filter and not match(caller.file, file_filter): continue
        results.append(caller)
        
        if current_depth + 1 < max_depth:
            queue.append((caller, current_depth + 1))
```

---

### 3.3 Dependency Graph Service

#### 3.3.1 API Contract

```python
def query(
    file: str,
    direction: Literal["incoming", "outgoing", "both"] = "outgoing",
    depth: int = 1,
    include_external: bool = False,
    limit: int = 50
) -> DependencyResult
```

#### 3.3.2 Response Schema

```python
@dataclass
class DependencyNode:
    file: str
    depth: int
    imported_symbols: list[str]
    is_external: bool

@dataclass
class DependencyResult:
    root: str
    direction: str
    results: list[DependencyNode]
    cycles: list[list[str]]
    metadata: dict  # {totalNodes, maxDepthReached, truncated, queryTimeMs, externalCount}
```

#### 3.3.3 Cycle Detection

During BFS, maintain path from root. If target already in path → cycle detected:

```
path = [root]
if resolved_target in path:
    cycles.append([*path, resolved_target])
    continue  # don't follow cycle
```

---

### 3.4 Impact Analysis Service

#### 3.4.1 API Contract

```python
def analyze_impact(
    symbol_name: str,
    action: Literal["modify", "delete", "rename"] = "modify",
    depth: int = 3,
    include_tests: bool = True,
    severity_threshold: Literal["critical", "high", "medium", "low"] = "low"
) -> ImpactResult
```

#### 3.4.2 Severity Classification

| Action | Depth 1 | Depth 2 | Depth 3 | Depth 4+ |
|--------|---------|---------|---------|----------|
| delete | critical | high | medium | low |
| modify | critical | high | medium | low |
| rename | high | medium | low | low |

#### 3.4.3 Response Schema

```python
@dataclass
class ImpactItem:
    symbol: str
    qualified_name: str | None
    file: str
    line: int
    severity: Literal["critical", "high", "medium", "low"]
    reason: str
    chain: list[str] | None = None

@dataclass
class ImpactResult:
    symbol: str
    action: str
    blast_radius: dict  # {summary: {critical:N, high:N, ...}, totalAffected, affectedFiles, affectedTests}
    impacts: list[ImpactItem]
    affected_tests: list[dict]  # [{file, reason}]
    recommendations: list[str]
    metadata: dict  # {queryTimeMs, depthSearched, truncated}
```

---

### 3.5 Graph Traverser

#### 3.5.1 API Contract

```python
def traverse(
    identifier: str,
    edge_types: list[str] = [],      # empty = all
    node_types: list[str] = [],      # empty = all
    direction: Literal["outgoing", "incoming", "both"] = "outgoing",
    max_depth: int = 3,
    max_results: int = 50,
    include_source: bool = False,
    source_lines: int = 5
) -> TraverseResponse
```

#### 3.5.2 Response Schema

```python
@dataclass
class TraverseResponse:
    start: dict  # {name, kind, file, line}
    results: list[dict]  # [{name, kind, file, line, depth, edge_type, source?}]
    metadata: dict  # {total_traversed, total_results, max_depth_reached, truncated, execution_time_ms}
```

---

### 3.6 Test Detector

#### 3.6.1 Test File Patterns

**Path patterns:**
- `/tests?/` (test or tests directory)
- `/__tests__/`
- `/spec/`

**File name patterns:**
- `*.test.{ts,tsx,js,jsx}`
- `*.spec.{ts,tsx,js,jsx}`
- `*Test.kt`
- `*_test.py`
- `test_*.py`

#### 3.6.2 API Contract

```python
def is_test_file(file_path: str) -> bool

def find_related_tests(
    symbols: list[ResolvedSymbol],
    impact_files: list[str]
) -> list[RelatedTest]
```

---

### 3.7 File Resolver

#### 3.7.1 Responsibilities

- Resolve relative/absolute file paths to database records
- Determine if a module path is external (third-party)
- Resolve import targets (e.g., `./utils` → `src/utils.py`)

#### 3.7.2 API Contract

```python
def resolve_file(file: str) -> str | None
def is_external(module_path: str) -> bool
def resolve_import_target(source_file: str, target: str) -> str | None
```

---

## 4. MCP Tool Integration

### 4.1 Tool Definitions

| Tool Name | Service | Description |
|-----------|---------|-------------|
| `code_callers` | CallGraphService.find_callers | Find all callers of a symbol |
| `code_callees` | CallGraphService.find_callees | Find all callees of a symbol |
| `code_dependencies` | DependencyGraphService.query | Query file dependency graph |
| `code_impact` | ImpactAnalysisService.analyze_impact | Analyze blast radius |
| `code_traverse` | GraphTraverser.traverse | Generic graph traversal |

### 4.2 Tool Registration

Tools are registered in `mcp_code_intel/tools.py` using the MCP SDK's `@server.tool()` decorator pattern already established in the project.

---

## 5. Database Schema (Required)

The graph engine reads from these tables (created by KSA-178 parsers):

### 5.1 files table

```sql
CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    relative_path TEXT UNIQUE NOT NULL,
    language TEXT,
    content_hash TEXT,
    last_indexed_at TEXT
);
```

### 5.2 symbols table

```sql
CREATE TABLE symbols (
    id INTEGER PRIMARY KEY,
    file_id INTEGER REFERENCES files(id),
    name TEXT NOT NULL,
    kind TEXT NOT NULL,  -- function, class, method, interface, variable
    start_line INTEGER,
    end_line INTEGER,
    parent_symbol_id INTEGER REFERENCES symbols(id),
    parameters TEXT,     -- serialized parameter info
    is_async INTEGER DEFAULT 0,
    is_exported INTEGER DEFAULT 0
);
CREATE INDEX idx_symbols_name ON symbols(name);
CREATE INDEX idx_symbols_file ON symbols(file_id);
```

### 5.3 relationships table

```sql
CREATE TABLE relationships (
    id INTEGER PRIMARY KEY,
    file_path TEXT NOT NULL,
    source_symbol_id INTEGER REFERENCES symbols(id),
    target_symbol TEXT NOT NULL,
    target_symbol_id INTEGER REFERENCES symbols(id),
    kind TEXT NOT NULL,  -- calls, imports, implements, extends
    line INTEGER,
    metadata TEXT
);
CREATE INDEX idx_rel_source ON relationships(source_symbol_id);
CREATE INDEX idx_rel_target ON relationships(target_symbol_id);
CREATE INDEX idx_rel_kind ON relationships(kind);
CREATE INDEX idx_rel_file ON relationships(file_path);
```

---

## 6. Error Handling

| Error Scenario | Behavior |
|---------------|----------|
| Symbol not found | Return empty result with `resolved_to: []` |
| File not found | Return empty DependencyResult |
| Database not initialized | Raise `GraphEngineError("Database not indexed")` |
| Depth exceeds max (5) | Clamp to 5, proceed normally |
| Query timeout (>5s) | Return partial results with `truncated: true` |
| Invalid file filter pattern | Ignore filter, return unfiltered results |

---

## 7. Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Query latency (depth=1) | < 100ms | time.perf_counter() |
| Query latency (depth=5) | < 2000ms | time.perf_counter() |
| Memory usage | < 100MB for 100K symbols | Process RSS |
| API compatibility | 100% response structure match | JSON schema comparison with nodejs |
| Test coverage | > 80% | pytest-cov |

---

## 8. Integration Points

| System | Direction | Protocol | Data |
|--------|-----------|----------|------|
| Tree-sitter Parsers (KSA-178) | Reads from | SQLite | symbols, relationships tables |
| MCP Server | Exposes via | JSON-RPC (stdio) | Tool responses |
| AI Context (KSA-180) | Consumed by | Python import | Graph traversal results |
| Code Quality (KSA-181) | Consumed by | Python import | Dependency graph for complexity |
| Security (KSA-182) | Consumed by | Python import | Call graph for taint analysis |

---

## 9. Appendix

### 9.1 JSON Response Examples

#### find_callers response

```json
{
  "symbol": "processData",
  "resolvedTo": [{"id": 42, "file": "src/processor.py", "line": 15, "kind": "function"}],
  "results": [
    {
      "symbol": "handleRequest",
      "qualifiedName": "RequestHandler.handleRequest",
      "kind": "method",
      "filePath": "src/handler.py",
      "definitionLine": 30,
      "callSiteLine": 45,
      "depthLevel": 1,
      "parameters": "RequestHandler",
      "isAsync": true
    }
  ],
  "metadata": {
    "totalCount": 1,
    "depthSearched": 1,
    "truncated": false,
    "queryTimeMs": 12
  }
}
```

#### analyze_impact response

```json
{
  "symbol": "processData",
  "action": "delete",
  "blastRadius": {
    "summary": {"critical": 3, "high": 2, "medium": 1, "low": 0},
    "totalAffected": 6,
    "affectedFiles": 4,
    "affectedTests": 2
  },
  "impacts": [...],
  "affectedTests": [{"file": "tests/test_processor.py", "reason": "Tests processData"}],
  "recommendations": [
    "Remove all 6 references before deleting \"processData\"",
    "Run affected tests: tests/test_processor.py, tests/test_handler.py"
  ],
  "metadata": {"queryTimeMs": 45, "depthSearched": 3, "truncated": false}
}
```

### 9.2 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Find Callers | [sequence-find-callers.png](diagrams/sequence-find-callers.png) | [sequence-find-callers.drawio](diagrams/sequence-find-callers.drawio) |
| 3 | State — Traversal | [state-traversal.png](diagrams/state-traversal.png) | [state-traversal.drawio](diagrams/state-traversal.drawio) |

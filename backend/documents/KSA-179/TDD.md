# Technical Design Document (TDD)

## MCP Code Intelligence Python — KSA-179: [Python] Graph Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-179 |
| Title | [Python] Graph Engine |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-179.docx |
| Related TDD | TDD-v1-KSA-179.docx |

---

## 1. Architecture Overview

### 1.1 Module Structure

```
mcp-code-intelligence-python/src/mcp_code_intel/graph/
├── __init__.py              # Public API exports
├── symbol_resolver.py       # Symbol name → DB record resolution
├── call_graph_service.py    # Caller/callee BFS traversal
├── dependency_graph_service.py  # File import/export graph
├── impact_analysis_service.py   # Blast radius prediction
├── traverser.py             # Generic BFS/DFS engine
├── test_detector.py         # Test file identification
├── file_resolver.py         # File path resolution
└── types.py                 # Shared dataclasses/types
```

### 1.2 Design Principles

1. **Port fidelity** — Output structures match nodejs exactly (camelCase JSON keys)
2. **Pythonic internals** — Use snake_case internally, convert at serialization boundary
3. **Dependency injection** — Services receive `sqlite3.Connection` via constructor
4. **Lazy initialization** — Prepared statements created on first use
5. **No NetworkX** — Simple BFS/DFS with raw SQL is sufficient and faster for our use case

### 1.3 Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Language | Python 3.11+ | Project standard |
| Database | sqlite3 (stdlib) | Already used in project, no extra dependency |
| Serialization | dataclasses + dict conversion | Lightweight, type-safe |
| Testing | pytest | Project standard |
| Type checking | Type hints + mypy | Catch errors early |

![Architecture](diagrams/architecture.png)

---

## 2. Detailed Design

### 2.1 types.py — Shared Types

```python
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal
import time

Severity = Literal["critical", "high", "medium", "low"]
ImpactAction = Literal["modify", "delete", "rename"]
Direction = Literal["incoming", "outgoing", "both"]

@dataclass
class ResolvedSymbol:
    id: int
    name: str
    kind: str
    file_path: str
    line: int
    parent_symbol_id: int | None = None

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

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "qualifiedName": self.qualified_name,
            "kind": self.kind,
            "filePath": self.file_path,
            "definitionLine": self.definition_line,
            "callSiteLine": self.call_site_line,
            "depthLevel": self.depth_level,
            "parameters": self.parameters,
            "isAsync": self.is_async,
        }

@dataclass
class CallGraphResponse:
    symbol: str
    resolved_to: list[dict]
    results: list[CallGraphItem]
    metadata: dict

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "resolvedTo": self.resolved_to,
            "results": [r.to_dict() for r in self.results],
            "metadata": self.metadata,
        }

@dataclass
class DependencyNode:
    file: str
    depth: int
    imported_symbols: list[str]
    is_external: bool

    def to_dict(self) -> dict:
        return {
            "file": self.file,
            "depth": self.depth,
            "importedSymbols": self.imported_symbols,
            "isExternal": self.is_external,
        }

@dataclass
class DependencyResult:
    root: str
    direction: str
    results: list[DependencyNode]
    cycles: list[list[str]]
    metadata: dict

    def to_dict(self) -> dict:
        return {
            "root": self.root,
            "direction": self.direction,
            "results": [r.to_dict() for r in self.results],
            "cycles": self.cycles,
            "metadata": self.metadata,
        }

@dataclass
class ImpactItem:
    symbol: str
    file: str
    line: int
    severity: Severity
    reason: str
    qualified_name: str | None = None
    chain: list[str] | None = None

    def to_dict(self) -> dict:
        d = {
            "symbol": self.symbol,
            "file": self.file,
            "line": self.line,
            "severity": self.severity,
            "reason": self.reason,
        }
        if self.qualified_name:
            d["qualifiedName"] = self.qualified_name
        if self.chain:
            d["chain"] = self.chain
        return d

@dataclass
class RelatedTest:
    file: str
    reason: str

@dataclass
class ImpactResult:
    symbol: str
    action: str
    blast_radius: dict
    impacts: list[ImpactItem]
    affected_tests: list[RelatedTest]
    recommendations: list[str]
    metadata: dict

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "action": self.action,
            "blastRadius": self.blast_radius,
            "impacts": [i.to_dict() for i in self.impacts],
            "affectedTests": [{"file": t.file, "reason": t.reason} for t in self.affected_tests],
            "recommendations": self.recommendations,
            "metadata": self.metadata,
        }

@dataclass
class TraverseResponse:
    start: dict
    results: list[dict]
    metadata: dict

    def to_dict(self) -> dict:
        return {
            "start": self.start,
            "results": self.results,
            "metadata": self.metadata,
        }
```

### 2.2 symbol_resolver.py

**Key Design:** Uses cascading resolution strategies with early return on first match.

```python
class SymbolResolver:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def resolve(self, input_name: str) -> list[ResolvedSymbol]:
        # Strategy 1: Exact match
        results = self._exact_match(input_name)
        if results: return results

        # Strategy 2: Qualified name (Class.method)
        if '.' in input_name:
            results = self._qualified_match(input_name)
            if results: return results

        # Strategy 3: file:symbol format
        if ':' in input_name:
            results = self._file_match(input_name)
            if results: return results

        return []

    def suggest(self, input_name: str, limit: int = 5) -> list[str]:
        rows = self._conn.execute(
            "SELECT DISTINCT name FROM symbols WHERE name LIKE ? LIMIT ?",
            (f"%{input_name}%", limit)
        ).fetchall()
        return [r[0] for r in rows]
```

### 2.3 call_graph_service.py

**Key Design:** BFS with visited set to prevent infinite loops. Uses `collections.deque` for O(1) popleft.

```python
from collections import deque

class CallGraphService:
    def __init__(self, conn: sqlite3.Connection, resolver: SymbolResolver):
        self._conn = conn
        self._resolver = resolver

    def find_callers(self, symbol_name: str, depth: int = 1,
                     limit: int = 20, file_filter: str | None = None,
                     kind_filter: str = "calls") -> CallGraphResponse:
        start_time = time.perf_counter_ns()
        clamped_depth = min(max(depth, 1), 5)

        resolved = self._resolver.resolve(symbol_name)
        if not resolved:
            return self._not_found_response(symbol_name, start_time)

        results: list[CallGraphItem] = []
        visited: set[int] = set()
        queue = deque((sym.name, 0) for sym in resolved)

        while queue and len(results) < limit:
            current_name, current_depth = queue.popleft()
            if current_depth >= clamped_depth:
                continue

            callers = self._query_callers(current_name, kind_filter, limit - len(results))
            for caller in callers:
                if caller["id"] in visited:
                    continue
                visited.add(caller["id"])

                item = CallGraphItem(
                    symbol=caller["name"],
                    qualified_name=f"{caller['parameters']}.{caller['name']}" if caller["parameters"] else caller["name"],
                    kind=caller["kind"],
                    file_path=caller["file_path"],
                    definition_line=caller["def_line"],
                    call_site_line=caller["call_line"],
                    depth_level=current_depth + 1,
                    parameters=caller["parameters"],
                    is_async=bool(caller["is_async"]),
                )

                if file_filter and not self._match_filter(item.file_path, file_filter):
                    continue

                results.append(item)
                if current_depth + 1 < clamped_depth:
                    queue.append((caller["name"], current_depth + 1))

        elapsed_ms = (time.perf_counter_ns() - start_time) // 1_000_000
        return CallGraphResponse(
            symbol=symbol_name,
            resolved_to=[{"id": s.id, "file": s.file_path, "line": s.line, "kind": s.kind} for s in resolved],
            results=results,
            metadata={"totalCount": len(results), "depthSearched": clamped_depth, "truncated": len(results) >= limit, "queryTimeMs": elapsed_ms},
        )
```

### 2.4 dependency_graph_service.py

**Key Design:** BFS with path tracking for cycle detection. Uses `collections.deque`.

```python
class DependencyGraphService:
    def __init__(self, conn: sqlite3.Connection, file_resolver: FileResolver):
        self._conn = conn
        self._file_resolver = file_resolver

    def query(self, file: str, direction: Direction = "outgoing",
              depth: int = 1, include_external: bool = False,
              limit: int = 50) -> DependencyResult:
        start_time = time.perf_counter_ns()
        clamped_depth = min(max(depth, 1), 5)

        resolved = self._file_resolver.resolve_file(file)
        if not resolved:
            return self._not_found_response(file)

        if direction == "both":
            out_results, out_cycles = self._bfs(resolved, "outgoing", clamped_depth, include_external, limit)
            in_results, in_cycles = self._bfs(resolved, "incoming", clamped_depth, include_external, limit)
            results = self._merge(out_results, in_results)
            cycles = out_cycles + in_cycles
        else:
            results, cycles = self._bfs(resolved, direction, clamped_depth, include_external, limit)

        elapsed_ms = (time.perf_counter_ns() - start_time) // 1_000_000
        return DependencyResult(
            root=resolved, direction=direction, results=results, cycles=cycles,
            metadata={
                "totalNodes": len(results),
                "maxDepthReached": max((r.depth for r in results), default=0),
                "truncated": len(results) >= limit,
                "queryTimeMs": elapsed_ms,
                "externalCount": sum(1 for r in results if r.is_external),
            },
        )
```

### 2.5 impact_analysis_service.py

**Key Design:** Orchestrates multiple services, deduplicates, classifies severity, generates recommendations.

```python
class ImpactAnalysisService:
    def __init__(self, conn, call_graph, dep_graph, resolver, test_detector):
        self._conn = conn
        self._call_graph = call_graph
        self._dep_graph = dep_graph
        self._resolver = resolver
        self._test_detector = test_detector

    def analyze_impact(self, symbol_name, action="modify", depth=3,
                       include_tests=True, severity_threshold="low"):
        start_time = time.perf_counter_ns()
        resolved = self._resolver.resolve(symbol_name)
        if not resolved:
            return self._empty_result(symbol_name, action)

        impacts = []
        # 1. Callers
        caller_result = self._call_graph.find_callers(symbol_name, depth, 100)
        for caller in caller_result.results:
            severity = self._classify_severity(caller.depth_level, action)
            impacts.append(ImpactItem(...))

        # 2. Interface implementors
        impacts.extend(self._find_implementors(resolved, symbol_name))

        # 3. File dependents
        source_file = resolved[0].file_path
        dep_result = self._dep_graph.query(source_file, "incoming", min(depth, 2), False, 50)
        for dep in dep_result.results:
            if not any(i.file == dep.file for i in impacts):
                impacts.append(ImpactItem(...))

        # 4. Tests
        affected_tests = []
        if include_tests:
            affected_tests = self._test_detector.find_related_tests(resolved, [i.file for i in impacts])

        # 5. Filter, deduplicate, sort, recommend
        filtered = self._filter_by_severity(impacts, severity_threshold)
        deduped = self._deduplicate(filtered)
        deduped.sort(key=lambda i: self._severity_order(i.severity))
        recommendations = self._generate_recommendations(deduped, action, symbol_name)

        return ImpactResult(...)
```

### 2.6 traverser.py

**Key Design:** Generic BFS with configurable edge/node type filters. Optional source code snippet reading.

```python
class GraphTraverser:
    def __init__(self, conn, resolver, workspace):
        self._conn = conn
        self._resolver = resolver
        self._workspace = workspace

    def traverse(self, identifier, edge_types=None, node_types=None,
                 direction="outgoing", max_depth=3, max_results=50,
                 include_source=False, source_lines=5):
        start_time = time.perf_counter_ns()
        start_node = self._resolve_node(identifier)
        if not start_node:
            return TraverseResponse(start={}, results=[], metadata={...})

        visited = set()
        queue = deque([(start_node, 0)])
        results = []

        while queue and len(results) < max_results:
            node, depth = queue.popleft()
            if node["id"] in visited: continue
            visited.add(node["id"])

            if depth > 0:
                if not node_types or node["kind"] in node_types:
                    result_item = {
                        "name": node["name"], "kind": node["kind"],
                        "file": node["file"], "line": node["line"],
                        "depth": depth, "edge_type": node.get("edge_type", "unknown"),
                    }
                    if include_source:
                        result_item["source"] = self._read_source(node["file"], node["line"], source_lines)
                    results.append(result_item)

            if depth < max_depth:
                neighbors = self._get_neighbors(node["id"], direction, edge_types)
                for n in neighbors:
                    if n["id"] not in visited:
                        queue.append((n, depth + 1))

        elapsed_ms = (time.perf_counter_ns() - start_time) // 1_000_000
        return TraverseResponse(
            start={"name": start_node["name"], "kind": start_node["kind"], "file": start_node["file"], "line": start_node["line"]},
            results=results,
            metadata={"total_traversed": len(visited), "total_results": len(results), "max_depth_reached": max((r["depth"] for r in results), default=0), "truncated": len(results) >= max_results, "execution_time_ms": elapsed_ms},
        )
```

---

## 3. Service Initialization

```python
def create_graph_services(conn: sqlite3.Connection, workspace: str) -> dict:
    resolver = SymbolResolver(conn)
    file_resolver = FileResolver(conn)
    test_detector = TestDetector(conn)
    call_graph = CallGraphService(conn, resolver)
    dep_graph = DependencyGraphService(conn, file_resolver)
    impact = ImpactAnalysisService(conn, call_graph, dep_graph, resolver, test_detector)
    traverser = GraphTraverser(conn, resolver, workspace)
    return {
        "resolver": resolver,
        "call_graph": call_graph,
        "dep_graph": dep_graph,
        "impact": impact,
        "traverser": traverser,
    }
```

---

## 4. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Repeated symbol resolution | Cache resolved symbols per request |
| Large BFS result sets | Hard limit at 100 results, `truncated` flag |
| Deep traversals (depth=5) | Clamp depth to 5, `visited` set prevents re-processing |
| SQLite lock contention | WAL mode, `check_same_thread=False` |
| Memory for large graphs | Stream results, don't load entire graph |
| deque vs list | Use `collections.deque` for O(1) popleft |

---

## 5. Error Handling

```python
class GraphEngineError(Exception):
    """Base exception for graph engine errors."""
    pass

class SymbolNotFoundError(GraphEngineError):
    """Symbol could not be resolved."""
    pass

class DatabaseNotIndexedError(GraphEngineError):
    """Database has no indexed data."""
    pass
```

All public methods catch exceptions and return empty/graceful responses.

---

## 6. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| SQL injection | Parameterized queries exclusively |
| Path traversal | Validate file_filter doesn't escape workspace |
| DoS via deep traversal | Hard cap depth=5, limit=100 |
| Information disclosure | Only return relative paths |

---

## 7. Implementation Checklist

| # | File | Description | Est. LOC |
|---|------|-------------|----------|
| 1 | `graph/types.py` | Dataclasses and type definitions | ~150 |
| 2 | `graph/__init__.py` | Public exports | ~20 |
| 3 | `graph/symbol_resolver.py` | Symbol resolution (3 strategies) | ~80 |
| 4 | `graph/file_resolver.py` | File path resolution | ~60 |
| 5 | `graph/call_graph_service.py` | BFS caller/callee traversal | ~150 |
| 6 | `graph/dependency_graph_service.py` | BFS dependency + cycle detection | ~180 |
| 7 | `graph/test_detector.py` | Test file pattern matching | ~60 |
| 8 | `graph/impact_analysis_service.py` | Blast radius (all services combined) | ~200 |
| 9 | `graph/traverser.py` | Generic BFS/DFS with filters | ~150 |
| 10 | `tools.py` (update) | Register 5 new MCP tools | ~80 |
| 11 | `tests/test_graph.py` | Unit + integration tests | ~300 |
| | **Total** | | **~1430** |

---

## 8. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit | Each service class | Mock sqlite3.Connection, verify BFS logic |
| Integration | Full pipeline | In-memory SQLite with test data |
| Compatibility | JSON output | Compare with nodejs output for same input |

---

## 9. nodejs → Python Mapping

| nodejs (TypeScript) | Python | Notes |
|--------------------|--------|-------|
| `better-sqlite3` | `sqlite3` (stdlib) | Sync API, no extra dep |
| `Database.prepare().all()` | `conn.execute().fetchall()` | Different API |
| `interface` | `@dataclass` | Python has no interfaces |
| `path.basename()` | `PurePosixPath().name` | Cross-platform |
| `Date.now()` | `time.perf_counter_ns() // 1_000_000` | Milliseconds |
| `Set<number>` | `set[int]` | Direct |
| `queue.shift()` | `collections.deque.popleft()` | O(1) vs O(n) |
| `Math.min/max` | `min()/max()` | Direct |

---

## 10. Appendix

### 10.1 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

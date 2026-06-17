# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-181: [Python] Code Quality

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-181 |
| Title | [Python] Code Quality — Technical Design |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-181.docx |
| Related FSD | FSD-v1-KSA-181.docx |
| Related TDD | TDD-v1-KSA-175.docx (Kotlin equivalent) |

---

## 1. Introduction

### 1.1 Purpose

Technical design for implementing the Code Quality module in the Python MCP Code Intelligence server.

### 1.2 Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | Python | 3.11+ |
| Async | asyncio + aiosqlite | — |
| Database | SQLite | 3.x |
| Graph Library | networkx | >= 3.2 |
| Complexity | radon | >= 6.0 |
| AST Parsing | tree-sitter | >= 0.22 |
| Testing | pytest + pytest-asyncio | >= 8.0 |
| Type Checking | mypy (strict) | >= 1.10 |

---

## 2. Architecture Overview

### 2.1 Package Structure

```
mcp_code_intel/analyzers/quality/
├── __init__.py
├── types.py
├── complexity/
│   ├── __init__.py
│   ├── analyzer.py
│   ├── calculator.py
│   ├── store.py
│   ├── grade_assigner.py
│   ├── tool.py
│   └── counters/
│       ├── __init__.py
│       ├── base.py
│       ├── typescript_counter.py
│       ├── python_counter.py
│       ├── java_counter.py
│       ├── kotlin_counter.py
│       └── go_counter.py
├── entrypoints/
│   ├── __init__.py
│   ├── detector.py
│   ├── store.py
│   ├── tool.py
│   ├── framework_detector.py
│   ├── pattern_registry.py
│   └── route_resolver.py
└── graph_analysis/
    ├── __init__.py
    ├── circular_dep_detector.py
    ├── dead_import_detector.py
    ├── hot_path_analyzer.py
    ├── related_test_finder.py
    ├── module_summarizer.py
    ├── tools.py
    └── graph_loader.py
```

### 2.2 Integration with Existing Modules

| Existing Module | Integration Point | Usage |
|----------------|-------------------|-------|
| `parsers/` (KSA-178) | tree-sitter Node | AST traversal for counters |
| `graph/` (KSA-179) | `edges` table | Call graph for networkx |
| `db.py` | aiosqlite connection | Shared DB instance |
| `tools.py` | Tool registration | Register 7 new MCP tools |
| `indexer.py` | Indexing hooks | Trigger analysis during index |

---

## 3. Detailed Class Design

### 3.1 types.py — Shared Data Classes

```python
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

class Grade(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    F = "F"

class EntryType(str, Enum):
    HTTP_HANDLER = "HTTP_HANDLER"
    MAIN = "MAIN"
    CLI_COMMAND = "CLI_COMMAND"
    EVENT_HANDLER = "EVENT_HANDLER"
    SCHEDULED = "SCHEDULED"

class Confidence(str, Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"

class Severity(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

@dataclass
class DecisionPointCounts:
    branches: int = 0
    loops: int = 0
    logical_ops: int = 0
    exception_handlers: int = 0

@dataclass
class ComplexityResult:
    symbol_id: int
    symbol_name: str
    file_path: str
    start_line: int
    end_line: int
    grade: Grade
    cyclomatic_complexity: int
    branches: int
    loops: int
    logical_ops: int
    exception_handlers: int
    nesting_depth: int
    early_returns: int

@dataclass
class ComplexityFilters:
    file_path: Optional[str] = None
    symbol_name: Optional[str] = None
    min_complexity: Optional[int] = None
    grade_filter: Optional[list[Grade]] = None
    module: Optional[str] = None
    limit: int = 20
    sort_by: str = "complexity"

@dataclass
class EntryPoint:
    symbol_id: int
    symbol_name: str
    file_path: str
    start_line: int
    entry_type: EntryType
    framework: Optional[str] = None
    http_method: Optional[str] = None
    route_path: Optional[str] = None
    full_route: Optional[str] = None
    middleware: list[str] = field(default_factory=list)
    has_auth: bool = False
    controller: Optional[str] = None
    confidence: Confidence = Confidence.MEDIUM

@dataclass
class CircularDep:
    nodes: list[int]
    edges: list[tuple[int, int]]
    length: int
    severity: Severity

@dataclass
class HotPath:
    symbol_id: int
    symbol_name: str
    file_path: str
    kind: str
    direct_callers: int
    transitive_callers: int
```

### 3.2 counters/base.py — Abstract Base Counter

```python
from abc import ABC, abstractmethod
from ..types import DecisionPointCounts

class BaseNodeCounter(ABC):
    @property
    @abstractmethod
    def language(self) -> str: ...

    @abstractmethod
    def count_decision_points(self, node) -> DecisionPointCounts: ...

    @abstractmethod
    def calculate_nesting_depth(self, node) -> int: ...

    @abstractmethod
    def count_early_returns(self, node) -> int: ...

    def _walk_children(self, node, visitor):
        for child in node.children:
            visitor(child)
            self._walk_children(child, visitor)
```

### 3.3 counters/python_counter.py

```python
import radon.complexity as radon_cc
from .base import BaseNodeCounter
from ..types import DecisionPointCounts

class PythonCounter(BaseNodeCounter):
    language = "python"
    BRANCH_NODES = {"if_statement", "elif_clause", "case_clause"}
    LOOP_NODES = {"for_statement", "while_statement"}
    LOGICAL_OPS = {"boolean_operator"}
    EXCEPTION_NODES = {"except_clause"}

    def count_decision_points(self, node) -> DecisionPointCounts:
        branches = loops = logical = exceptions = 0
        def visit(child):
            nonlocal branches, loops, logical, exceptions
            if child.type in self.BRANCH_NODES: branches += 1
            elif child.type in self.LOOP_NODES: loops += 1
            elif child.type in self.LOGICAL_OPS: logical += 1
            elif child.type in self.EXCEPTION_NODES: exceptions += 1
        self._walk_children(node, visit)
        return DecisionPointCounts(branches, loops, logical, exceptions)

    @staticmethod
    def radon_complexity(source: str):
        """Native Python CC via radon."""
        return [(r.name, r.lineno, r.complexity) for r in radon_cc.cc_visit(source)]
```

### 3.4 grade_assigner.py

```python
from .types import Grade

def assign_grade(cc: int) -> Grade:
    if cc <= 5: return Grade.A
    elif cc <= 10: return Grade.B
    elif cc <= 20: return Grade.C
    elif cc <= 50: return Grade.D
    else: return Grade.F
```

### 3.5 graph_analysis/graph_loader.py

```python
import networkx as nx
import aiosqlite

class GraphLoader:
    def __init__(self, db: aiosqlite.Connection):
        self.db = db

    async def load_call_graph(self, module: str = None) -> nx.DiGraph:
        G = nx.DiGraph()
        sql = "SELECT e.source_id, e.target_id FROM edges e"
        if module:
            sql += " JOIN symbols s ON s.id = e.source_id"
            sql += " JOIN files f ON f.id = s.file_id"
            sql += " WHERE e.type = 'calls' AND f.module = ?"
            params = (module,)
        else:
            sql += " WHERE e.type = 'calls'"
            params = ()
        async with self.db.execute(sql, params) as cursor:
            async for row in cursor:
                G.add_edge(row[0], row[1])
        return G

    async def get_symbol_info(self, symbol_id: int):
        sql = """SELECT s.name, f.relative_path, s.kind, s.start_line
                 FROM symbols s JOIN files f ON f.id = s.file_id
                 WHERE s.id = ?"""
        async with self.db.execute(sql, (symbol_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                return {"name": row[0], "file_path": row[1],
                        "kind": row[2], "start_line": row[3]}
        return None
```

### 3.6 graph_analysis/circular_dep_detector.py

```python
import networkx as nx
from ..types import CircularDep, Severity

class CircularDepDetector:
    def __init__(self, graph_loader):
        self.graph_loader = graph_loader

    async def detect(self, module=None, max_length=None) -> list[CircularDep]:
        G = await self.graph_loader.load_call_graph(module)
        sccs = list(nx.strongly_connected_components(G))
        results = []
        for scc in sccs:
            if len(scc) <= 1:
                continue
            if max_length and len(scc) > max_length:
                continue
            length = len(scc)
            severity = (Severity.HIGH if length <= 3
                       else Severity.MEDIUM if length <= 6
                       else Severity.LOW)
            subgraph = G.subgraph(scc)
            try:
                edges = list(nx.find_cycle(subgraph))
            except nx.NetworkXNoCycle:
                continue
            results.append(CircularDep(
                nodes=list(scc), edges=edges,
                length=length, severity=severity
            ))
        return sorted(results, key=lambda x: x.severity.value)
```

### 3.7 graph_analysis/hot_path_analyzer.py

```python
import networkx as nx

class HotPathAnalyzer:
    def __init__(self, graph_loader):
        self.graph_loader = graph_loader

    async def analyze(self, module=None, limit=20, min_callers=2):
        G = await self.graph_loader.load_call_graph(module)
        results = []
        for node in G.nodes:
            direct = G.in_degree(node)
            if direct < min_callers:
                continue
            transitive = len(nx.ancestors(G, node))
            info = await self.graph_loader.get_symbol_info(node)
            if info:
                results.append({
                    "symbol_id": node,
                    "symbol_name": info["name"],
                    "file_path": info["file_path"],
                    "kind": info["kind"],
                    "direct_callers": direct,
                    "transitive_callers": transitive
                })
        results.sort(key=lambda x: x["transitive_callers"], reverse=True)
        return results[:limit]
```

---

## 4. Database Schema

```sql
CREATE TABLE IF NOT EXISTS complexity_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol_id INTEGER NOT NULL UNIQUE REFERENCES symbols(id) ON DELETE CASCADE,
    cyclomatic_complexity INTEGER NOT NULL,
    branches INTEGER NOT NULL,
    loops INTEGER NOT NULL,
    logical_ops INTEGER NOT NULL,
    exception_handlers INTEGER NOT NULL,
    nesting_depth INTEGER NOT NULL,
    early_returns INTEGER NOT NULL,
    grade TEXT NOT NULL CHECK(grade IN ('A','B','C','D','F')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_complexity_grade ON complexity_results(grade);
CREATE INDEX IF NOT EXISTS idx_complexity_cc ON complexity_results(cyclomatic_complexity DESC);

CREATE TABLE IF NOT EXISTS entry_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol_id INTEGER NOT NULL UNIQUE REFERENCES symbols(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL,
    framework TEXT,
    http_method TEXT,
    route_path TEXT,
    full_route TEXT,
    middleware TEXT,
    has_auth INTEGER NOT NULL DEFAULT 0,
    controller TEXT,
    event_name TEXT,
    confidence TEXT NOT NULL CHECK(confidence IN ('High','Medium','Low')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_entry_type ON entry_points(entry_type);
```

---

## 5. MCP Tool Registration

```python
# In server.py or tools.py:
from .analyzers.quality.complexity.tool import register_complexity_tool
from .analyzers.quality.entrypoints.tool import register_entry_point_tool
from .analyzers.quality.graph_analysis.tools import register_graph_tools

def register_quality_tools(server, db):
    register_complexity_tool(server, db)
    register_entry_point_tool(server, db)
    register_graph_tools(server, db)  # 5 tools
```

---

## 6. Error Handling

| Error | Handling |
|-------|----------|
| Null AST body | Return None, skip, log warning |
| Unsupported language | Return None, log info |
| DB constraint | Upsert pattern (ON CONFLICT) |
| Deep nesting | Cap recursion at 20 |
| Empty graph | Return empty list |
| radon parse error | Fallback to tree-sitter counter |

---

## 7. Performance

| Concern | Solution |
|---------|----------|
| Large codebase | Batch inserts with executemany |
| networkx SCC | O(V+E), handles 10K nodes |
| Query speed | Indexed columns |
| Memory | Load graph per-module |
| GIL | ProcessPoolExecutor for CPU-bound |

---

## 8. Implementation Checklist

### Files to Create (30 files)

| # | File | Purpose |
|---|------|---------|
| 1 | `analyzers/quality/__init__.py` | Module exports |
| 2 | `analyzers/quality/types.py` | Dataclasses, enums |
| 3-7 | `analyzers/quality/complexity/counters/*.py` | 5 language counters + base |
| 8-12 | `analyzers/quality/complexity/*.py` | calculator, grade, store, analyzer, tool |
| 13-18 | `analyzers/quality/entrypoints/*.py` | detector, store, tool, framework, patterns, routes |
| 19-25 | `analyzers/quality/graph_analysis/*.py` | circular, dead, hot, test, summary, tools, loader |

### Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `tools.py` | Register 7 new tools |
| 2 | `indexer.py` | Hook analysis during indexing |
| 3 | `db.py` | Add table creation |
| 4 | `pyproject.toml` | Add radon, networkx deps |

---

## 9. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit | Each counter | pytest with known AST |
| Unit | GradeAssigner | Boundary values |
| Unit | CircularDepDetector | Known graphs |
| Integration | Full pipeline | Index files, query tools |
| Parity | Node.js vs Python | Same input/output |

---

## 10. Security

| Concern | Mitigation |
|---------|-----------|
| SQL injection | Parameterized queries |
| Path traversal | LIKE only, no fs access |
| DoS | Limit cap at 1000 |
| Stack overflow | Depth cap at 20 |

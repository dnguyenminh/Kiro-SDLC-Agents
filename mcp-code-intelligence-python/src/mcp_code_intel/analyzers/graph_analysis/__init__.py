"""KSA-163: Graph Analysis — Models and types."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CycleNode:
    symbol_id: int
    name: str
    file_path: str
    kind: str


@dataclass
class CycleChain:
    nodes: list[CycleNode]
    edges: list[str]


@dataclass
class CircularDep:
    cycle: CycleChain
    length: int
    severity: str  # high, medium, low
    module: Optional[str] = None


@dataclass
class TestReference:
    symbol_id: int
    test_name: str
    file_path: str
    depth: int
    path: list[str]


@dataclass
class SymbolRef:
    id: int
    name: str
    file_path: str


@dataclass
class RelatedTestResult:
    symbol: SymbolRef
    direct_tests: list[TestReference]
    indirect_tests: list[TestReference]
    total_tests: int


@dataclass
class HotPath:
    symbol_id: int
    symbol_name: str
    file_path: str
    direct_callers: int
    transitive_callers: int
    kind: str


@dataclass
class DeadImport:
    file_path: str
    line: int
    imported_symbol: str
    from_module: str


@dataclass
class ModuleSummary:
    module: str
    file_count: int
    symbol_count: int
    circular_deps: int
    hot_paths: list[HotPath]
    dead_imports: int
    avg_complexity: Optional[float]


@dataclass
class SymbolInfo:
    id: int
    name: str
    kind: str
    file_path: str


AdjacencyList = dict[int, list[int]]

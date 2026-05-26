"""Graph engine data models — KSA-179."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ImpactAction(str, Enum):
    MODIFY = "modify"
    DELETE = "delete"
    RENAME = "rename"


@dataclass
class DependencyNode:
    file: str
    depth: int
    imported_symbols: list[str] = field(default_factory=list)
    is_external: bool = False


@dataclass
class DependencyMetadata:
    total_nodes: int = 0
    max_depth_reached: int = 0
    truncated: bool = False
    query_time_ms: int = 0
    external_count: int = 0


@dataclass
class DependencyResult:
    root: str
    direction: str
    results: list[DependencyNode] = field(default_factory=list)
    cycles: list[list[str]] = field(default_factory=list)
    metadata: DependencyMetadata = field(default_factory=DependencyMetadata)


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
class CallGraphMetadata:
    total_count: int = 0
    depth_searched: int = 0
    truncated: bool = False
    query_time_ms: int = 0


@dataclass
class ResolvedTo:
    id: int
    file: str
    line: int
    kind: str


@dataclass
class CallGraphResponse:
    symbol: str
    resolved_to: list[ResolvedTo] = field(default_factory=list)
    results: list[CallGraphItem] = field(default_factory=list)
    metadata: CallGraphMetadata = field(default_factory=CallGraphMetadata)


@dataclass
class GraphNode:
    id: int
    name: str
    kind: str
    file_path: str
    start_line: int
    incoming_edge_type: str | None = None


@dataclass
class TraverseConfig:
    edge_types: list[str] = field(default_factory=list)
    node_types: list[str] = field(default_factory=list)
    direction: str = "outgoing"
    max_depth: int = 3
    max_results: int = 50


@dataclass
class TraverseResultItem:
    node: GraphNode
    depth: int
    path: list[str] = field(default_factory=list)
    edge_type: str = "unknown"


@dataclass
class TraverseResponse:
    start: dict[str, Any] = field(default_factory=dict)
    results: list[dict[str, Any]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ImpactItem:
    symbol: str
    file: str
    line: int
    severity: Severity
    reason: str
    qualified_name: str | None = None
    chain: list[str] | None = None


@dataclass
class BlastRadius:
    summary: dict[str, int] = field(default_factory=lambda: {
        "critical": 0, "high": 0, "medium": 0, "low": 0
    })
    total_affected: int = 0
    affected_files: int = 0
    affected_tests: int = 0


@dataclass
class ImpactResult:
    symbol: str
    action: ImpactAction
    blast_radius: BlastRadius = field(default_factory=BlastRadius)
    impacts: list[ImpactItem] = field(default_factory=list)
    affected_tests: list[RelatedTest] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RelatedTest:
    file: str
    reason: str


@dataclass
class ResolvedSymbol:
    id: int
    name: str
    kind: str
    file_path: str
    line: int
    parent_symbol_id: int | None = None

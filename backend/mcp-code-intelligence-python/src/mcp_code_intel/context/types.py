"""Shared types for AI Context tools. KSA-171."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class AIContextParams:
    symbol: str
    intent: str = "explain"
    token_budget: int = 4000
    caller_depth: int = 1


@dataclass
class AIContextResponse:
    symbol: str
    file_path: str
    kind: str
    intent: str
    context: dict[str, Any]
    metadata: dict[str, Any]


@dataclass
class EditContextParams:
    symbol: str
    include_callers: bool = True
    include_tests: bool = True
    include_memories: bool = False
    include_git: bool = True
    token_budget: int = 4000
    caller_depth: int = 1


@dataclass
class CallerContext:
    symbol: str
    file: str
    line: int
    context: str


@dataclass
class TestContext:
    file: str
    test_name: str
    source: str


@dataclass
class DependencyContext:
    file: str
    symbols: list[str]
    direction: str  # 'imports' | 'imported_by'


@dataclass
class MemoryContext:
    id: int
    type: str
    summary: str


@dataclass
class GitCommit:
    hash: str
    message: str


@dataclass
class SiblingContext:
    name: str
    kind: str
    signature: str | None
    line: int


@dataclass
class EditContextResult:
    symbol: str
    file: str
    line: int
    kind: str
    source: str
    signature: str | None
    callers: list[CallerContext] | None = None
    tests: list[TestContext] | None = None
    dependencies: list[DependencyContext] | None = None
    memories: list[MemoryContext] | None = None
    git_history: list[GitCommit] | None = None
    siblings: list[SiblingContext] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class SourceWeights:
    code: float = 0.5
    memory: float = 0.3
    graph: float = 0.2


@dataclass
class CuratedContextParams:
    query: str
    max_tokens: int = 4000
    scope: str | None = None
    modules: list[str] | None = None
    languages: list[str] | None = None
    include_source: bool = True
    include_memory: bool = True
    include_graph: bool = True
    source_weights: SourceWeights | None = None


@dataclass
class ContextItem:
    name: str
    kind: str | None = None
    file: str | None = None
    line: int | None = None
    relevance: float = 0.0
    detail: str = "reference"  # 'full' | 'signature' | 'reference'
    content: str = ""
    relationship: str | None = None


@dataclass
class ContextSection:
    title: str
    source: str  # 'code' | 'memory' | 'graph'
    items: list[ContextItem] = field(default_factory=list)


@dataclass
class CuratedContextResponse:
    query: str
    sections: list[ContextSection] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class QueryAnalysis:
    original_query: str
    keywords: list[str]
    symbol_candidates: list[str]
    phrases: list[str]
    fts_query: str


@dataclass
class MergedResult:
    name: str
    id: int | None = None
    kind: str | None = None
    file: str | None = None
    line: int | None = None
    signature: str | None = None
    source_code: str | None = None
    content: str | None = None
    relevance_score: float = 0.0
    sources: list[str] = field(default_factory=list)
    relationship: str | None = None

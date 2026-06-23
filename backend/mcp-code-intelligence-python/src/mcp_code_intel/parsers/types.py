"""
KSA-178: Tree-sitter Core Integration — Type definitions.
Shared interfaces for language parsers, parse results, and extracted symbols.
Matches nodejs AST structure exactly (from mcp-code-intelligence-nodejs/src/parsers/types.ts).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

# Re-export tree-sitter Node type
from tree_sitter import Node as SyntaxNode  # noqa: F401

SymbolKind = Literal[
    "function", "class", "method", "interface",
    "type", "enum", "variable", "namespace",
    "constructor", "property", "module",
    "trait", "struct", "constant",
]

RelationshipKind = Literal[
    "calls", "imports", "inherits",
    "implements", "uses", "decorates",
    "dml", "soql", "trigger-on", "wire", "apex-import",
]


@dataclass
class ExtractedSymbol:
    name: str
    kind: SymbolKind
    file_path: str
    start_line: int
    end_line: int
    signature: str
    parameters: str | None = None
    return_type: str | None = None
    modifiers: list[str] | None = None
    decorators: list[str] | None = None
    parent_name: str | None = None
    is_async: bool | None = None
    is_exported: bool | None = None
    doc_comment: str | None = None
    complexity: int | None = None


@dataclass
class ExtractedRelationship:
    source_symbol: str
    target_symbol: str
    kind: RelationshipKind
    file_path: str | None = None
    line: int = 0
    metadata: dict[str, Any] | None = None


@dataclass
class ParseError:
    message: str
    line: int
    column: int


@dataclass
class ParseResult:
    symbols: list[ExtractedSymbol] = field(default_factory=list)
    relationships: list[ExtractedRelationship] = field(default_factory=list)
    errors: list[ParseError] = field(default_factory=list)


@dataclass
class IndexResult:
    file_path: str
    symbol_count: int
    relationship_count: int
    parse_errors: int
    duration: float
    method: Literal["tree-sitter", "regex-fallback"]


class ILanguageParser(Protocol):
    """Interface for language-specific parsers."""

    @property
    def language_id(self) -> str: ...

    def parse(self, source: str, file_path: str) -> ParseResult: ...

    def get_supported_extensions(self) -> list[str]: ...

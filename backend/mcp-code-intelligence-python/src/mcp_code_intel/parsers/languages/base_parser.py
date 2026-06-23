"""
KSA-178: Base Language Parser — Shared extraction logic for all language parsers.
"""

from __future__ import annotations

from tree_sitter import Parser as TSParser

from ..types import (
    ExtractedRelationship, ExtractedSymbol, ParseError, ParseResult,
    ILanguageParser, SymbolKind,
)
from ..ast_utils import find_nodes, get_node_text, get_node_range, SyntaxNode


class BaseLanguageParser:
    """Base class with shared parsing utilities."""

    def __init__(self, parser: TSParser, language_id: str) -> None:
        self._parser = parser
        self._language_id = language_id

    @property
    def language_id(self) -> str:
        return self._language_id

    def _parse_tree(self, source: str) -> SyntaxNode:
        """Parse source and return root node."""
        tree = self._parser.parse(source.encode("utf-8"))
        return tree.root_node

    def _collect_errors(self, root: SyntaxNode) -> list[ParseError]:
        """Collect parse errors from the tree."""
        errors: list[ParseError] = []
        if root.has_error:
            error_nodes = find_nodes(root, "ERROR")
            for node in error_nodes[:10]:
                errors.append(ParseError(
                    message="Parse error",
                    line=node.start_point[0] + 1,
                    column=node.start_point[1],
                ))
        return errors

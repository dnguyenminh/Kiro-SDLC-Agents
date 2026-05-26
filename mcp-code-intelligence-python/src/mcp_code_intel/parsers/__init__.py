"""
Parsers module — Tree-sitter based code parsing.
KSA-178: Python port of KSA-144 Batch 1 (nodejs parsers).

Provides language-specific parsers that extract symbols and relationships
from source code ASTs using tree-sitter grammars.
"""

from .types import (
    SymbolKind, RelationshipKind, ExtractedSymbol, ExtractedRelationship,
    ParseResult, ParseError, IndexResult, ILanguageParser,
)
from .ast_utils import (
    walk_tree, find_nodes, find_first, get_node_text, get_node_range,
    get_ancestor_of_type, get_children_of_type, get_named_child,
    extract_doc_comment, calculate_complexity,
)
from .grammar_registry import GrammarRegistry, LanguageConfig
from .tree_sitter_indexer import TreeSitterIndexer

__all__ = [
    # Types
    "SymbolKind", "RelationshipKind", "ExtractedSymbol", "ExtractedRelationship",
    "ParseResult", "ParseError", "IndexResult", "ILanguageParser",
    # AST utils
    "walk_tree", "find_nodes", "find_first", "get_node_text", "get_node_range",
    "get_ancestor_of_type", "get_children_of_type", "get_named_child",
    "extract_doc_comment", "calculate_complexity",
    # Registry & Indexer
    "GrammarRegistry", "LanguageConfig", "TreeSitterIndexer",
]

"""
KSA-178: AST Utilities — Shared tree-sitter AST traversal helpers.
Provides efficient iterative tree walking, node search, and text extraction.
Port of mcp-code-intelligence-nodejs/src/parsers/ast-utils.ts.
"""

from __future__ import annotations

from typing import Callable

from tree_sitter import Node as SyntaxNode


def walk_tree(node: SyntaxNode, enter: Callable[[SyntaxNode], bool | None] | None = None,
              leave: Callable[[SyntaxNode], None] | None = None) -> None:
    """Iterative depth-first tree walk (avoids stack overflow on deep ASTs).
    enter() returning False skips children."""
    stack: list[SyntaxNode] = [node]
    while stack:
        current = stack.pop()
        should_descend = True
        if enter:
            result = enter(current)
            if result is False:
                should_descend = False
        if should_descend:
            for i in range(len(current.children) - 1, -1, -1):
                child = current.children[i]
                if child:
                    stack.append(child)
        if leave:
            leave(current)


def find_nodes(node: SyntaxNode, node_type: str) -> list[SyntaxNode]:
    """Find all nodes of a given type in the subtree."""
    results: list[SyntaxNode] = []

    def _enter(n: SyntaxNode) -> None:
        if n.type == node_type:
            results.append(n)

    walk_tree(node, enter=_enter)
    return results


def find_first(node: SyntaxNode, node_type: str) -> SyntaxNode | None:
    """Find first node of a given type (stops early)."""
    stack: list[SyntaxNode] = [node]
    while stack:
        current = stack.pop()
        if current.type == node_type:
            return current
        for i in range(len(current.children) - 1, -1, -1):
            child = current.children[i]
            if child:
                stack.append(child)
    return None


def get_node_text(node: SyntaxNode, source: str) -> str:
    """Get text content of a node from source."""
    return source[node.start_byte:node.end_byte]


def get_node_range(node: SyntaxNode) -> tuple[int, int]:
    """Get 1-based line range of a node. Returns (start_line, end_line)."""
    return (node.start_point[0] + 1, node.end_point[0] + 1)


def get_ancestor_of_type(node: SyntaxNode, node_type: str) -> SyntaxNode | None:
    """Walk up the tree to find an ancestor of a specific type."""
    current = node.parent
    while current:
        if current.type == node_type:
            return current
        current = current.parent
    return None


def get_children_of_type(node: SyntaxNode, node_type: str) -> list[SyntaxNode]:
    """Get direct children of a specific type."""
    return [child for child in node.children if child.type == node_type]


def get_named_child(node: SyntaxNode, node_type: str) -> SyntaxNode | None:
    """Get the first named child of a specific type."""
    for child in node.named_children:
        if child.type == node_type:
            return child
    return None


def extract_doc_comment(node: SyntaxNode, source: str) -> str | None:
    """Extract doc comment above a node (JSDoc, Python docstring, etc.)."""
    prev = node.prev_named_sibling
    if not prev:
        if node.parent:
            prev = node.parent.prev_named_sibling

    if prev and prev.type == "comment":
        text = get_node_text(prev, source).strip()
        import re
        text = re.sub(r"^/\*\*?|\*/$", "", text)
        text = re.sub(r"^\s*\*\s?", "", text, flags=re.MULTILINE)
        text = re.sub(r"^//\s?", "", text, flags=re.MULTILINE)
        text = re.sub(r"^#\s?", "", text, flags=re.MULTILINE)
        return text.strip()[:500] or None

    return None


def calculate_complexity(node: SyntaxNode) -> int:
    """Calculate cyclomatic complexity of a function body."""
    complexity = 1
    branch_types = {
        "if_statement", "elif_clause", "else_clause",
        "for_statement", "while_statement", "do_statement",
        "switch_case", "catch_clause", "ternary_expression",
        "conditional_expression", "logical_expression",
        "for_in_statement", "for_of_statement",
        "when_entry", "match_arm",
    }

    def _enter(n: SyntaxNode) -> None:
        nonlocal complexity
        if n.type in branch_types:
            complexity += 1
        if n.type in ("&&", "||"):
            complexity += 1

    walk_tree(node, enter=_enter)
    return complexity

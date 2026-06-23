"""
KSA-164: Basic Block — Fundamental unit of a control flow graph.
"""

from __future__ import annotations
from typing import Any
from ..types import Statement, VariableDef, VariableUse


class BasicBlock:
    __slots__ = ("id", "type", "statements", "start_line", "end_line")

    def __init__(self, block_id: int, block_type: str) -> None:
        self.id = block_id
        self.type = block_type
        self.statements: list[Statement] = []
        self.start_line: int = 0
        self.end_line: int = 0

    def add_statement(self, node: Any) -> None:
        text = node.text
        if isinstance(text, bytes):
            text = text.decode("utf-8", errors="replace")
        stmt = Statement(
            node=node,
            line=node.start_point[0] + 1,
            type=node.type,
            text=str(text)[:120],
        )
        self.statements.append(stmt)
        if len(self.statements) == 1:
            self.start_line = stmt.line
        self.end_line = stmt.line

    def get_definitions(self) -> list[VariableDef]:
        defs: list[VariableDef] = []
        for stmt in self.statements:
            defs.extend(_extract_definitions(stmt.node, self.id))
        return defs

    def get_uses(self) -> list[VariableUse]:
        uses: list[VariableUse] = []
        for stmt in self.statements:
            uses.extend(_extract_uses(stmt.node, self.id))
        return uses

    @property
    def is_empty(self) -> bool:
        return len(self.statements) == 0


def _node_text(node: Any) -> str:
    text = node.text
    if isinstance(text, bytes):
        return text.decode("utf-8", errors="replace")
    return str(text)


def _extract_definitions(node: Any, block_id: int) -> list[VariableDef]:
    """Extract variable definitions from an AST node."""
    defs: list[VariableDef] = []
    ntype = node.type

    if ntype in ("lexical_declaration", "variable_declaration"):
        for child in node.named_children:
            if child.type == "variable_declarator":
                name_node = child.child_by_field_name("name")
                if name_node:
                    defs.append(VariableDef(
                        name=_node_text(name_node),
                        line=name_node.start_point[0] + 1,
                        block_id=block_id,
                        node=name_node,
                    ))

    if ntype in ("assignment_expression", "augmented_assignment_expression"):
        left = node.child_by_field_name("left")
        if left and left.type == "identifier":
            defs.append(VariableDef(name=_node_text(left), line=left.start_point[0] + 1, block_id=block_id, node=left))

    if ntype == "expression_statement" and node.named_child_count > 0:
        expr = node.named_children[0]
        defs.extend(_extract_definitions(expr, block_id))

    if ntype == "assignment":
        left = node.child_by_field_name("left")
        if left and left.type == "identifier":
            defs.append(VariableDef(name=_node_text(left), line=left.start_point[0] + 1, block_id=block_id, node=left))

    if ntype in ("for_statement", "for_in_statement"):
        init = node.child_by_field_name("initializer") or node.child_by_field_name("left")
        if init and init.type == "identifier":
            defs.append(VariableDef(name=_node_text(init), line=init.start_point[0] + 1, block_id=block_id, node=init))

    return defs


def _extract_uses(node: Any, block_id: int) -> list[VariableUse]:
    """Extract variable uses from an AST node."""
    uses: list[VariableUse] = []
    seen: set[str] = set()
    _collect_identifiers(node, uses, block_id, seen)
    return uses


def _collect_identifiers(node: Any, uses: list[VariableUse], block_id: int, seen: set[str]) -> None:
    if node.type == "identifier":
        text = _node_text(node)
        key = f"{text}:{node.start_point[0]}"
        if key not in seen:
            seen.add(key)
            uses.append(VariableUse(name=text, line=node.start_point[0] + 1, block_id=block_id, node=node))
        return
    for child in node.children:
        _collect_identifiers(child, uses, block_id, seen)

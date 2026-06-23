"""
KSA-164: Taint Propagator — Propagates taint state through CFG blocks.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional
from ..cfg.basic_block import BasicBlock
from ..types import TaintStep
from .taint_registry import TaintRegistry


@dataclass
class TaintState:
    variable: str
    tainted: bool
    source_type: str
    source_line: int
    steps: list[TaintStep] = field(default_factory=list)


@dataclass
class EvalResult:
    tainted: bool
    source_type: str = ""
    source_line: int = 0
    steps: list[TaintStep] = field(default_factory=list)
    action: str = "assign"


def _node_text(node: Any) -> str:
    text = node.text
    if isinstance(text, bytes):
        return text.decode("utf-8", errors="replace")
    return str(text)


class TaintPropagator:
    def __init__(self, registry: TaintRegistry) -> None:
        self._registry = registry

    def propagate_block(self, block: BasicBlock, state: dict[str, TaintState]) -> dict[str, TaintState]:
        """Propagate taint through a single block, updating state map."""
        new_state = dict(state)
        for stmt in block.statements:
            self._propagate_statement(stmt.node, new_state)
        return new_state

    def _propagate_statement(self, node: Any, state: dict[str, TaintState]) -> None:
        ntype = node.type

        if ntype in ("lexical_declaration", "variable_declaration"):
            self._handle_declaration(node, state)
        elif ntype == "expression_statement":
            if node.named_child_count > 0:
                expr = node.named_children[0]
                self._propagate_expression(expr, state)
        elif ntype in ("assignment_expression", "augmented_assignment_expression"):
            self._handle_assignment(node, state)

    def _handle_declaration(self, node: Any, state: dict[str, TaintState]) -> None:
        for child in node.named_children:
            if child.type != "variable_declarator":
                continue
            name_node = child.child_by_field_name("name")
            value_node = child.child_by_field_name("value")
            if not name_node or not value_node:
                continue

            var_name = _node_text(name_node)
            taint_info = self.evaluate_expression(value_node, state)

            if taint_info.tainted:
                state[var_name] = TaintState(
                    variable=var_name,
                    tainted=True,
                    source_type=taint_info.source_type,
                    source_line=taint_info.source_line,
                    steps=[*taint_info.steps, TaintStep(
                        variable=var_name,
                        line=name_node.start_point[0] + 1,
                        action=taint_info.action,
                        expression=_node_text(value_node)[:80],
                    )],
                )
            else:
                state.pop(var_name, None)

    def _handle_assignment(self, node: Any, state: dict[str, TaintState]) -> None:
        left = node.child_by_field_name("left")
        right = node.child_by_field_name("right")
        if not left or not right:
            return
        if left.type != "identifier":
            return

        var_name = _node_text(left)
        taint_info = self.evaluate_expression(right, state)

        if taint_info.tainted:
            state[var_name] = TaintState(
                variable=var_name,
                tainted=True,
                source_type=taint_info.source_type,
                source_line=taint_info.source_line,
                steps=[*taint_info.steps, TaintStep(
                    variable=var_name,
                    line=left.start_point[0] + 1,
                    action=taint_info.action,
                    expression=_node_text(right)[:80],
                )],
            )
        else:
            state.pop(var_name, None)

    def _propagate_expression(self, node: Any, state: dict[str, TaintState]) -> None:
        if node.type in ("assignment_expression", "augmented_assignment_expression"):
            self._handle_assignment(node, state)

    def evaluate_expression(self, node: Any, state: dict[str, TaintState]) -> EvalResult:
        """Evaluate if an expression produces a tainted value."""
        not_tainted = EvalResult(tainted=False)

        # Direct identifier reference
        if node.type == "identifier":
            text = _node_text(node)
            existing = state.get(text)
            if existing and existing.tainted:
                return EvalResult(tainted=True, source_type=existing.source_type, source_line=existing.source_line, steps=existing.steps, action="pass_through")
            return not_tainted

        # Member expression (e.g., req.body.name)
        if node.type == "member_expression":
            text = _node_text(node)
            source_match = self._registry.match_source(text)
            if source_match:
                return EvalResult(tainted=True, source_type=source_match["type"], source_line=node.start_point[0] + 1, steps=[], action="assign")
            obj = node.child_by_field_name("object")
            if obj:
                obj_taint = self.evaluate_expression(obj, state)
                if obj_taint.tainted:
                    return EvalResult(tainted=True, source_type=obj_taint.source_type, source_line=obj_taint.source_line, steps=obj_taint.steps, action="pass_through")
            return not_tainted

        # Call expression
        if node.type == "call_expression":
            fn = node.child_by_field_name("function")
            if fn:
                if self._is_sanitizer_call(node):
                    return not_tainted
                source_match = self._registry.match_source(_node_text(fn))
                if source_match:
                    return EvalResult(tainted=True, source_type=source_match["type"], source_line=node.start_point[0] + 1, steps=[], action="function_call")
                args = node.child_by_field_name("arguments")
                if args:
                    for arg in args.named_children:
                        arg_taint = self.evaluate_expression(arg, state)
                        if arg_taint.tainted:
                            return EvalResult(tainted=True, source_type=arg_taint.source_type, source_line=arg_taint.source_line, steps=arg_taint.steps, action="function_call")
            return not_tainted

        # Template literal
        if node.type == "template_string":
            for child in node.named_children:
                if child.type == "template_substitution" and child.named_child_count > 0:
                    expr = child.named_children[0]
                    expr_taint = self.evaluate_expression(expr, state)
                    if expr_taint.tainted:
                        return EvalResult(tainted=True, source_type=expr_taint.source_type, source_line=expr_taint.source_line, steps=expr_taint.steps, action="template_literal")
            return not_tainted

        # Binary expression (string concatenation)
        if node.type == "binary_expression":
            left = node.child_by_field_name("left")
            right = node.child_by_field_name("right")
            if left:
                left_taint = self.evaluate_expression(left, state)
                if left_taint.tainted:
                    return EvalResult(tainted=True, source_type=left_taint.source_type, source_line=left_taint.source_line, steps=left_taint.steps, action="concat")
            if right:
                right_taint = self.evaluate_expression(right, state)
                if right_taint.tainted:
                    return EvalResult(tainted=True, source_type=right_taint.source_type, source_line=right_taint.source_line, steps=right_taint.steps, action="concat")
            return not_tainted

        # Subscript/element access
        if node.type == "subscript_expression":
            obj = node.child_by_field_name("object")
            if obj:
                obj_taint = self.evaluate_expression(obj, state)
                if obj_taint.tainted:
                    return EvalResult(tainted=True, source_type=obj_taint.source_type, source_line=obj_taint.source_line, steps=obj_taint.steps, action="pass_through")
            return not_tainted

        # Await expression
        if node.type == "await_expression" and node.named_child_count > 0:
            return self.evaluate_expression(node.named_children[0], state)

        return not_tainted

    def _is_sanitizer_call(self, node: Any) -> bool:
        fn = node.child_by_field_name("function") if node.type == "call_expression" else None
        if not fn:
            return False
        fn_text = _node_text(fn)
        sink_types = ["sql_query", "shell_exec", "html_output", "file_path", "url_fetch"]
        return any(self._registry.is_sanitizer(fn_text, st) for st in sink_types)

"""KSA-161: Abstract base for language-specific AST node counters."""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Callable
from .models import DecisionPointCounts


class BaseNodeCounter(ABC):
    @property
    @abstractmethod
    def language(self) -> str: ...

    @property
    @abstractmethod
    def branch_node_types(self) -> set[str]: ...

    @property
    @abstractmethod
    def loop_node_types(self) -> set[str]: ...

    @property
    @abstractmethod
    def logical_operators(self) -> set[str]: ...

    @property
    @abstractmethod
    def exception_node_types(self) -> set[str]: ...

    def count_decision_points(self, node: Any) -> DecisionPointCounts:
        counts = DecisionPointCounts()
        self._walk_tree(node, lambda child: self._count_visitor(child, counts))
        return counts

    def calculate_nesting_depth(self, node: Any) -> int:
        control_types = self.branch_node_types | self.loop_node_types
        max_depth = [0]

        def walk(n: Any, depth: int) -> None:
            d = depth + 1 if n.type in control_types else depth
            if d > max_depth[0]:
                max_depth[0] = d
            for i in range(n.child_count):
                child = n.child(i)
                if child:
                    walk(child, d)

        walk(node, 0)
        return max_depth[0]

    def count_early_returns(self, node: Any) -> int:
        count = [0]
        return_types = self._get_return_node_types()
        self._walk_tree(node, lambda child: self._inc_if(child, return_types, count))
        return max(0, count[0] - 1)

    def _is_logical_op(self, node: Any) -> bool:
        if node.type in ("binary_expression", "logical_expression"):
            op = node.child_by_field_name("operator") if hasattr(node, "child_by_field_name") else None
            if op and op.text in self.logical_operators:
                return True
        return False

    def _get_return_node_types(self) -> set[str]:
        return {"return_statement"}

    def _count_visitor(self, child: Any, counts: DecisionPointCounts) -> None:
        if child.type in self.branch_node_types:
            counts.branches += 1
        elif child.type in self.loop_node_types:
            counts.loops += 1
        elif child.type in self.exception_node_types:
            counts.exception_handlers += 1
        if self._is_logical_op(child):
            counts.logical_ops += 1

    @staticmethod
    def _inc_if(child: Any, types: set[str], count: list[int]) -> None:
        if child.type in types:
            count[0] += 1

    @staticmethod
    def _walk_tree(node: Any, visitor: Callable[[Any], None]) -> None:
        stack = [node]
        while stack:
            current = stack.pop()
            visitor(current)
            for i in range(current.child_count - 1, -1, -1):
                child = current.child(i)
                if child:
                    stack.append(child)

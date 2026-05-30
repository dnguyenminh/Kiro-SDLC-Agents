"""KSA-169: Body Extractor — Extract function bodies from tree-sitter AST."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any


@dataclass
class FunctionBody:
    symbol_id: str
    name: str
    body_text: str
    token_count: int
    start_line: int
    end_line: int


BODY_TYPES = {"statement_block", "block", "function_body", "class_body"}
FUNCTION_TYPES = {
    "function_declaration", "method_definition", "arrow_function",
    "function_expression", "generator_function_declaration",
    "function_definition", "method_declaration",
}
NAME_TYPES = {"identifier", "property_identifier", "type_identifier"}


class BodyExtractor:
    def __init__(self, min_body_lines: int = 3, max_body_tokens: int = 10_000) -> None:
        self._min_body_lines = min_body_lines
        self._max_body_tokens = max_body_tokens

    def extract_body(self, node: Any, source: str) -> str | None:
        body_node = self._find_body_node(node)
        if not body_node:
            return None
        body_text = source[body_node.start_byte:body_node.end_byte]
        if body_text.count("\n") + 1 < self._min_body_lines:
            return None
        token_count = self._estimate_tokens(body_text)
        if token_count > self._max_body_tokens:
            return self._truncate(body_text, self._max_body_tokens)
        return body_text

    def extract_all_bodies(self, root_node: Any, source: str, file_path: str) -> list[FunctionBody]:
        bodies: list[FunctionBody] = []
        stack = [root_node]
        while stack:
            node = stack.pop()
            if node.type in FUNCTION_TYPES:
                body = self.extract_body(node, source)
                if body:
                    name = self._extract_name(node, source)
                    start_line = node.start_point[0] + 1
                    end_line = node.end_point[0] + 1
                    bodies.append(FunctionBody(
                        symbol_id=f"{file_path}:{name}:{start_line}",
                        name=name, body_text=body,
                        token_count=self._estimate_tokens(body),
                        start_line=start_line, end_line=end_line,
                    ))
            for i in range(node.child_count - 1, -1, -1):
                child = node.child(i)
                if child:
                    stack.append(child)
        return bodies

    def _find_body_node(self, node: Any) -> Any | None:
        for i in range(node.named_child_count):
            child = node.named_child(i)
            if child and child.type in BODY_TYPES:
                return child
        return None

    def _extract_name(self, node: Any, source: str) -> str:
        for i in range(node.named_child_count):
            child = node.named_child(i)
            if child and child.type in NAME_TYPES:
                return source[child.start_byte:child.end_byte]
        parent = node.parent
        if parent and parent.type == "variable_declarator":
            for i in range(parent.named_child_count):
                child = parent.named_child(i)
                if child and child.type == "identifier":
                    return source[child.start_byte:child.end_byte]
        return "<anonymous>"

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        return len([w for w in text.split() if w])

    @staticmethod
    def _truncate(text: str, max_tokens: int) -> str:
        return " ".join(text.split()[:max_tokens])

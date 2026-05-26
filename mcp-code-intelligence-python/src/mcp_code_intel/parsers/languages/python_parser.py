"""
KSA-178: Python Language Parser.
Port of mcp-code-intelligence-nodejs/src/parsers/languages/python-parser.ts.
Extracts symbols and relationships from Python AST using tree-sitter.
"""

from __future__ import annotations

import re

from tree_sitter import Parser as TSParser

from ..types import (
    ExtractedRelationship, ExtractedSymbol, ParseResult, SymbolKind,
)
from ..ast_utils import (
    find_nodes, find_first, get_node_text, get_node_range, get_named_child,
    walk_tree, SyntaxNode,
)
from .base_parser import BaseLanguageParser

_PYTHON_BUILTINS = frozenset([
    "print", "len", "range", "str", "int", "float", "list", "dict",
    "set", "tuple", "type", "isinstance", "issubclass", "super",
    "hasattr", "getattr", "setattr", "repr", "bool", "enumerate",
    "zip", "map", "filter", "sorted", "reversed", "any", "all",
    "min", "max", "abs", "round", "open", "id", "hex", "oct",
    "bin", "ord", "chr", "format", "vars", "dir", "help",
    "input", "iter", "next", "slice", "object", "property",
    "staticmethod", "classmethod",
])


class PythonParser(BaseLanguageParser):
    """Extracts symbols and relationships from Python AST."""

    def get_supported_extensions(self) -> list[str]:
        return [".py", ".pyi"]

    def parse(self, source: str, file_path: str) -> ParseResult:
        root = self._parse_tree(source)
        symbols: list[ExtractedSymbol] = []
        relationships: list[ExtractedRelationship] = []
        errors = self._collect_errors(root)

        self._extract_imports(root, source, file_path, relationships)
        self._extract_declarations(root, source, file_path, None, symbols, relationships)

        return ParseResult(symbols=symbols, relationships=relationships, errors=errors)

    # ─── Import Extraction ──────────────────────────────────────────────

    def _extract_imports(
        self, root: SyntaxNode, source: str, file_path: str,
        relationships: list[ExtractedRelationship],
    ) -> None:
        # import_statement: import os, import os.path
        for stmt in find_nodes(root, "import_statement"):
            for name in find_nodes(stmt, "dotted_name"):
                target = get_node_text(name, source)
                relationships.append(ExtractedRelationship(
                    source_symbol="__file__",
                    target_symbol=target,
                    kind="imports",
                    file_path=file_path,
                    line=stmt.start_point[0] + 1,
                ))

        # import_from_statement: from x import y
        for stmt in find_nodes(root, "import_from_statement"):
            module_name = self._extract_module_name(stmt, source)
            is_relative = module_name.startswith(".")

            # Wildcard import
            if find_nodes(stmt, "wildcard_import"):
                relationships.append(ExtractedRelationship(
                    source_symbol="__file__",
                    target_symbol=f"{module_name}.*",
                    kind="imports",
                    file_path=file_path,
                    line=stmt.start_point[0] + 1,
                    metadata={"wildcard": True, **({"relative": True} if is_relative else {})},
                ))
                continue

            # Named imports
            imported_names = find_nodes(stmt, "aliased_import")
            if imported_names:
                for imported in imported_names:
                    children = imported.children
                    if not children:
                        continue
                    name = get_node_text(children[0], source)
                    alias = get_node_text(children[2], source) if len(children) > 2 else None

                    relationships.append(ExtractedRelationship(
                        source_symbol="__file__",
                        target_symbol=f"{module_name}.{name}" if module_name else name,
                        kind="imports",
                        file_path=file_path,
                        line=stmt.start_point[0] + 1,
                        metadata={
                            "from": module_name, "name": name,
                            **({"alias": alias} if alias else {}),
                            **({"relative": True} if is_relative else {}),
                        },
                    ))
            else:
                # Simple identifiers after 'import' keyword
                for name in self._get_imported_identifiers(stmt, source):
                    relationships.append(ExtractedRelationship(
                        source_symbol="__file__",
                        target_symbol=f"{module_name}.{name}" if module_name else name,
                        kind="imports",
                        file_path=file_path,
                        line=stmt.start_point[0] + 1,
                        metadata={"from": module_name, "name": name},
                    ))

    def _extract_module_name(self, stmt: SyntaxNode, source: str) -> str:
        for child in stmt.children:
            if child.type in ("dotted_name", "relative_import"):
                return get_node_text(child, source)
        return ""

    def _get_imported_identifiers(self, stmt: SyntaxNode, source: str) -> list[str]:
        names: list[str] = []
        after_import = False
        for child in stmt.children:
            if child.type == "import":
                after_import = True
                continue
            if after_import and child.type in ("dotted_name", "identifier"):
                names.append(get_node_text(child, source))
        return names

    # ─── Declaration Extraction ─────────────────────────────────────────

    def _extract_declarations(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, symbols: list[ExtractedSymbol],
        relationships: list[ExtractedRelationship],
    ) -> None:
        for child in node.named_children:
            if child.type == "function_definition":
                self._extract_function(child, source, file_path, parent_name, symbols, relationships)
            elif child.type == "class_definition":
                self._extract_class(child, source, file_path, parent_name, symbols, relationships)
            elif child.type == "decorated_definition":
                self._extract_decorated(child, source, file_path, parent_name, symbols, relationships)
            elif child.type == "expression_statement" and not parent_name:
                self._extract_module_variable(child, source, file_path, symbols)

    def _extract_decorated(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, symbols: list[ExtractedSymbol],
        relationships: list[ExtractedRelationship],
    ) -> None:
        for child in node.named_children:
            if child.type == "function_definition":
                self._extract_function(child, source, file_path, parent_name, symbols, relationships, node)
            elif child.type == "class_definition":
                self._extract_class(child, source, file_path, parent_name, symbols, relationships, node)

    # ─── Function Extraction ────────────────────────────────────────────

    def _extract_function(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, symbols: list[ExtractedSymbol],
        relationships: list[ExtractedRelationship],
        decorated_node: SyntaxNode | None = None,
    ) -> None:
        name_node = get_named_child(node, "identifier")
        if not name_node:
            return

        name = get_node_text(name_node, source)
        range_node = decorated_node or node
        start_line, end_line = get_node_range(range_node)

        # Detect async
        preceding_text = source[max(0, node.start_byte - 6):node.start_byte]
        is_async = "async" in preceding_text

        # Extract decorators
        decorators = self._get_decorators(decorated_node or node, source)

        # Determine kind
        kind: SymbolKind = "method" if parent_name else "function"
        if "property" in decorators:
            kind = "property"
        if name == "__init__":
            kind = "constructor"

        # Extract parameters
        params_node = get_named_child(node, "parameters")
        params = get_node_text(params_node, source) if params_node else "()"

        # Extract return type
        return_type = self._extract_return_type(node, source)

        # Modifiers
        modifiers: list[str] = []
        if is_async:
            modifiers.append("async")
        if "staticmethod" in decorators:
            modifiers.append("static")
        if "classmethod" in decorators:
            modifiers.append("classmethod")
        if "abstractmethod" in decorators:
            modifiers.append("abstract")

        is_exported = not name.startswith("_")
        body = get_named_child(node, "block")
        complexity = self._calculate_python_complexity(body) if body else 1
        doc_comment = self._extract_docstring(body, source) if body else None

        symbols.append(ExtractedSymbol(
            name=name,
            kind=kind,
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            signature=self._build_func_sig(is_async, name, params, return_type),
            parameters=params,
            return_type=return_type,
            modifiers=modifiers if modifiers else None,
            decorators=decorators if decorators else None,
            parent_name=parent_name,
            is_async=is_async,
            is_exported=is_exported,
            doc_comment=doc_comment,
            complexity=complexity,
        ))

        # Extract calls from body
        if body:
            caller = f"{parent_name}.{name}" if parent_name else name
            self._extract_calls(body, source, file_path, caller, relationships)

        # Extract nested definitions
        if body:
            self._extract_declarations(body, source, file_path, name, symbols, relationships)

        # Decorator relationships
        for dec in (decorators or []):
            relationships.append(ExtractedRelationship(
                source_symbol=f"{parent_name}.{name}" if parent_name else name,
                target_symbol=dec,
                kind="decorates",
                file_path=file_path,
                line=start_line,
            ))

    # ─── Class Extraction ───────────────────────────────────────────────

    def _extract_class(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, symbols: list[ExtractedSymbol],
        relationships: list[ExtractedRelationship],
        decorated_node: SyntaxNode | None = None,
    ) -> None:
        name_node = get_named_child(node, "identifier")
        if not name_node:
            return

        name = get_node_text(name_node, source)
        range_node = decorated_node or node
        start_line, end_line = get_node_range(range_node)
        decorators = self._get_decorators(decorated_node or node, source)

        # Extract base classes
        arg_list = get_named_child(node, "argument_list")
        bases: list[str] = []
        is_protocol = False
        is_abc = False

        if arg_list:
            for arg in arg_list.named_children:
                if arg.type in ("identifier", "attribute"):
                    base_name = get_node_text(arg, source)
                    bases.append(base_name)
                    if base_name == "Protocol":
                        is_protocol = True
                    if base_name in ("ABC", "ABCMeta"):
                        is_abc = True

                    rel_kind = "implements" if is_protocol else "inherits"
                    relationships.append(ExtractedRelationship(
                        source_symbol=name,
                        target_symbol=base_name,
                        kind=rel_kind,
                        file_path=file_path,
                        line=arg.start_point[0] + 1,
                    ))

        kind: SymbolKind = "interface" if is_protocol else "class"
        modifiers: list[str] = []
        if is_abc:
            modifiers.append("abstract")
        if "dataclass" in (decorators or []):
            modifiers.append("dataclass")

        is_exported = not name.startswith("_")
        body = get_named_child(node, "block")
        doc_comment = self._extract_docstring(body, source) if body else None

        symbols.append(ExtractedSymbol(
            name=name,
            kind=kind,
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            signature=f"class {name}({', '.join(bases)})" if bases else f"class {name}",
            modifiers=modifiers if modifiers else None,
            decorators=decorators if decorators else None,
            parent_name=parent_name,
            is_exported=is_exported,
            doc_comment=doc_comment,
        ))

        # Extract class body
        if body:
            self._extract_declarations(body, source, file_path, name, symbols, relationships)

        # Decorator relationships
        for dec in (decorators or []):
            relationships.append(ExtractedRelationship(
                source_symbol=name,
                target_symbol=dec,
                kind="decorates",
                file_path=file_path,
                line=start_line,
            ))

    # ─── Module Variable Extraction ─────────────────────────────────────

    def _extract_module_variable(
        self, node: SyntaxNode, source: str, file_path: str,
        symbols: list[ExtractedSymbol],
    ) -> None:
        assignment = get_named_child(node, "assignment")
        if not assignment:
            return

        children = assignment.children
        if not children or children[0].type != "identifier":
            return

        name = get_node_text(children[0], source)
        start_line, end_line = get_node_range(node)
        is_constant = bool(re.match(r"^[A-Z_][A-Z0-9_]*$", name))

        symbols.append(ExtractedSymbol(
            name=name,
            kind="constant" if is_constant else "variable",
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            signature=get_node_text(node, source).split("\n")[0].strip()[:200],
            is_exported=not name.startswith("_"),
        ))

    # ─── Call Extraction ────────────────────────────────────────────────

    def _extract_calls(
        self, body: SyntaxNode, source: str, file_path: str,
        caller_name: str, relationships: list[ExtractedRelationship],
    ) -> None:
        call_nodes = find_nodes(body, "call")
        seen: set[str] = set()

        for call in call_nodes:
            children = call.children
            if not children:
                continue
            func_node = children[0]
            func_name = get_node_text(func_node, source)

            if func_name in _PYTHON_BUILTINS:
                continue

            key = f"{caller_name}->{func_name}"
            if key in seen:
                continue
            seen.add(key)

            relationships.append(ExtractedRelationship(
                source_symbol=caller_name,
                target_symbol=func_name,
                kind="calls",
                file_path=file_path,
                line=call.start_point[0] + 1,
            ))

    # ─── Helpers ────────────────────────────────────────────────────────

    def _get_decorators(self, node: SyntaxNode, source: str) -> list[str]:
        decorators: list[str] = []
        for child in node.named_children:
            if child.type == "decorator":
                text = get_node_text(child, source).lstrip("@").split("(")[0].strip()
                decorators.append(text)
        return decorators

    def _extract_return_type(self, node: SyntaxNode, source: str) -> str | None:
        type_node = get_named_child(node, "type")
        if type_node:
            return get_node_text(type_node, source)
        return None

    def _extract_docstring(self, body: SyntaxNode, source: str) -> str | None:
        if not body.named_children:
            return None
        first_child = body.named_children[0]
        if first_child.type != "expression_statement":
            return None
        if not first_child.named_children:
            return None
        expr = first_child.named_children[0]
        if expr.type != "string":
            return None

        text = get_node_text(expr, source)
        text = re.sub(r'^("""|\'\'\')\s*', "", text)
        text = re.sub(r'\s*("""|\'\'\')\s*$', "", text)
        return text.strip()[:500] or None

    def _calculate_python_complexity(self, node: SyntaxNode) -> int:
        complexity = 1
        branch_types = {
            "if_statement", "elif_clause", "for_statement", "while_statement",
            "except_clause", "with_statement", "case_clause", "assert_statement",
        }

        def _enter(n: SyntaxNode) -> None:
            nonlocal complexity
            if n.type in branch_types:
                complexity += 1
            if n.type == "boolean_operator":
                complexity += 1
            if n.type == "conditional_expression":
                complexity += 1
            if n.type in ("list_comprehension", "set_comprehension",
                          "dictionary_comprehension", "generator_expression"):
                complexity += 1

        walk_tree(node, enter=_enter)
        return complexity

    def _build_func_sig(
        self, is_async: bool, name: str, params: str, return_type: str | None,
    ) -> str:
        prefix = "async " if is_async else ""
        ret = f" -> {return_type}" if return_type else ""
        return f"{prefix}def {name}{params}{ret}"[:500]


# Module-level alias for dynamic loading
Parser = PythonParser

"""
KSA-178: TypeScript/JavaScript Language Parser.
Port of mcp-code-intelligence-nodejs/src/parsers/languages/typescript-parser.ts.
Supports both TypeScript (.ts/.tsx) and JavaScript (.js/.jsx/.mjs/.cjs).
"""

from __future__ import annotations

import re

from tree_sitter import Parser as TSParser

from ..types import (
    ExtractedRelationship, ExtractedSymbol, ParseError, ParseResult, SymbolKind,
)
from ..ast_utils import (
    find_nodes, find_first, get_node_text, get_node_range, get_named_child,
    walk_tree, extract_doc_comment, calculate_complexity, SyntaxNode,
)
from .base_parser import BaseLanguageParser


class TypeScriptParser(BaseLanguageParser):
    """Extracts symbols and relationships from TypeScript/JavaScript AST."""

    def get_supported_extensions(self) -> list[str]:
        if self._language_id == "typescript":
            return [".ts", ".tsx"]
        return [".js", ".jsx", ".mjs", ".cjs"]

    def parse(self, source: str, file_path: str) -> ParseResult:
        root = self._parse_tree(source)
        errors = self._collect_errors(root)
        symbols: list[ExtractedSymbol] = []
        relationships: list[ExtractedRelationship] = []

        self._extract_from_node(root, source, file_path, None, symbols, relationships)
        return ParseResult(symbols=symbols, relationships=relationships, errors=errors)

    def _extract_from_node(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, symbols: list[ExtractedSymbol],
        relationships: list[ExtractedRelationship],
    ) -> None:
        for child in node.named_children:
            t = child.type
            if t in ("function_declaration", "generator_function_declaration"):
                self._extract_function(child, source, file_path, parent_name, symbols)
            elif t == "class_declaration":
                self._extract_class(child, source, file_path, parent_name, symbols, relationships)
            elif t == "interface_declaration":
                self._extract_interface(child, source, file_path, parent_name, symbols)
            elif t == "type_alias_declaration":
                self._extract_type_alias(child, source, file_path, parent_name, symbols)
            elif t == "enum_declaration":
                self._extract_enum(child, source, file_path, parent_name, symbols)
            elif t in ("lexical_declaration", "variable_declaration"):
                self._extract_variable_declaration(child, source, file_path, parent_name, symbols)
            elif t == "export_statement":
                self._extract_from_node(child, source, file_path, parent_name, symbols, relationships)
            elif t == "import_statement":
                self._extract_import(child, source, file_path, relationships)

    # ─── Function ───────────────────────────────────────────────────────

    def _extract_function(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, symbols: list[ExtractedSymbol],
    ) -> None:
        name_node = get_named_child(node, "identifier")
        if not name_node:
            return

        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        params = self._extract_parameters(node, source)
        return_type = self._extract_return_type(node, source)
        exported = self._is_exported(node)
        is_async = self._has_modifier(node, source, "async")
        doc_comment = extract_doc_comment(node, source)

        symbols.append(ExtractedSymbol(
            name=name,
            kind="method" if parent_name else "function",
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            signature=self._build_func_sig(name, params, return_type, is_async),
            parameters=params,
            return_type=return_type,
            is_async=is_async,
            is_exported=exported,
            parent_name=parent_name,
            doc_comment=doc_comment,
            complexity=calculate_complexity(node),
        ))

    # ─── Class ──────────────────────────────────────────────────────────

    def _extract_class(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, symbols: list[ExtractedSymbol],
        relationships: list[ExtractedRelationship],
    ) -> None:
        name_node = get_named_child(node, "type_identifier") or get_named_child(node, "identifier")
        if not name_node:
            return

        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        exported = self._is_exported(node)
        doc_comment = extract_doc_comment(node, source)
        modifiers = self._extract_modifiers(node, source)
        is_abstract = "abstract" in modifiers

        symbols.append(ExtractedSymbol(
            name=name,
            kind="class",
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            signature=f"{'abstract ' if is_abstract else ''}class {name}",
            is_exported=exported,
            parent_name=parent_name,
            doc_comment=doc_comment,
            modifiers=modifiers if modifiers else None,
        ))

        # Extract class body members
        body = get_named_child(node, "class_body")
        if body:
            self._extract_class_members(body, source, file_path, name, symbols)

        # Extract inheritance
        self._extract_class_heritage(node, source, file_path, name, relationships)

    def _extract_class_members(
        self, body: SyntaxNode, source: str, file_path: str,
        class_name: str, symbols: list[ExtractedSymbol],
    ) -> None:
        for member in body.named_children:
            if member.type == "method_definition":
                self._extract_method(member, source, file_path, class_name, symbols)
            elif member.type in ("public_field_definition", "property_definition"):
                self._extract_property(member, source, file_path, class_name, symbols)

    def _extract_method(
        self, node: SyntaxNode, source: str, file_path: str,
        class_name: str, symbols: list[ExtractedSymbol],
    ) -> None:
        name_node = get_named_child(node, "property_identifier") or get_named_child(node, "identifier")
        if not name_node:
            return

        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        params = self._extract_parameters(node, source)
        return_type = self._extract_return_type(node, source)
        is_async = self._has_modifier(node, source, "async")
        doc_comment = extract_doc_comment(node, source)
        kind: SymbolKind = "constructor" if name == "constructor" else "method"
        modifiers = self._extract_modifiers(node, source)

        symbols.append(ExtractedSymbol(
            name=name,
            kind=kind,
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            signature=self._build_func_sig(name, params, return_type, is_async),
            parameters=params,
            return_type=return_type,
            is_async=is_async,
            parent_name=class_name,
            doc_comment=doc_comment,
            complexity=calculate_complexity(node),
            modifiers=modifiers if modifiers else None,
        ))

    def _extract_property(
        self, node: SyntaxNode, source: str, file_path: str,
        class_name: str, symbols: list[ExtractedSymbol],
    ) -> None:
        name_node = get_named_child(node, "property_identifier") or get_named_child(node, "identifier")
        if not name_node:
            return

        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)

        symbols.append(ExtractedSymbol(
            name=name,
            kind="property",
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            signature=get_node_text(node, source).split("\n")[0].strip()[:200],
            parent_name=class_name,
        ))

    # ─── Interface ──────────────────────────────────────────────────────

    def _extract_interface(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, symbols: list[ExtractedSymbol],
    ) -> None:
        name_node = get_named_child(node, "type_identifier") or get_named_child(node, "identifier")
        if not name_node:
            return

        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        exported = self._is_exported(node)

        symbols.append(ExtractedSymbol(
            name=name,
            kind="interface",
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            signature=f"interface {name}",
            is_exported=exported,
            parent_name=parent_name,
        ))

    # ─── Type Alias ─────────────────────────────────────────────────────

    def _extract_type_alias(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, symbols: list[ExtractedSymbol],
    ) -> None:
        name_node = get_named_child(node, "type_identifier") or get_named_child(node, "identifier")
        if not name_node:
            return

        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        exported = self._is_exported(node)

        symbols.append(ExtractedSymbol(
            name=name,
            kind="type",
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            signature=get_node_text(node, source).split("\n")[0].strip()[:200],
            is_exported=exported,
            parent_name=parent_name,
        ))

    # ─── Enum ───────────────────────────────────────────────────────────

    def _extract_enum(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, symbols: list[ExtractedSymbol],
    ) -> None:
        name_node = get_named_child(node, "identifier")
        if not name_node:
            return

        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        exported = self._is_exported(node)

        symbols.append(ExtractedSymbol(
            name=name,
            kind="enum",
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            signature=f"enum {name}",
            is_exported=exported,
            parent_name=parent_name,
        ))

    # ─── Variable Declaration (arrow functions) ─────────────────────────

    def _extract_variable_declaration(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, symbols: list[ExtractedSymbol],
    ) -> None:
        for declarator in node.named_children:
            if declarator.type != "variable_declarator":
                continue
            name_node = get_named_child(declarator, "identifier")
            if not name_node:
                continue

            name = get_node_text(name_node, source)
            value = (
                get_named_child(declarator, "arrow_function")
                or get_named_child(declarator, "function_expression")
                or get_named_child(declarator, "function")
            )

            if value:
                start_line, end_line = get_node_range(node)
                params = self._extract_parameters(value, source)
                return_type = self._extract_return_type(value, source)
                exported = self._is_exported(node)
                is_async = self._has_modifier(value, source, "async")

                symbols.append(ExtractedSymbol(
                    name=name,
                    kind="function",
                    file_path=file_path,
                    start_line=start_line,
                    end_line=end_line,
                    signature=self._build_func_sig(name, params, return_type, is_async),
                    parameters=params,
                    return_type=return_type,
                    is_async=is_async,
                    is_exported=exported,
                    parent_name=parent_name,
                    complexity=calculate_complexity(value),
                ))

    # ─── Imports ────────────────────────────────────────────────────────

    def _extract_import(
        self, node: SyntaxNode, source: str, file_path: str,
        relationships: list[ExtractedRelationship],
    ) -> None:
        text = get_node_text(node, source)
        # Extract module path from import statement
        source_node = get_named_child(node, "string")
        if source_node:
            module_path = get_node_text(source_node, source).strip("'\"")
            relationships.append(ExtractedRelationship(
                source_symbol="__file__",
                target_symbol=module_path,
                kind="imports",
                file_path=file_path,
                line=node.start_point[0] + 1,
            ))

    # ─── Heritage (extends/implements) ──────────────────────────────────

    def _extract_class_heritage(
        self, node: SyntaxNode, source: str, file_path: str,
        class_name: str, relationships: list[ExtractedRelationship],
    ) -> None:
        heritage = get_named_child(node, "class_heritage")
        if not heritage:
            return
        for clause in heritage.named_children:
            if clause.type == "extends_clause":
                for type_node in clause.named_children:
                    if type_node.type in ("identifier", "type_identifier", "member_expression"):
                        base_name = get_node_text(type_node, source).split("<")[0].strip()
                        relationships.append(ExtractedRelationship(
                            source_symbol=class_name,
                            target_symbol=base_name,
                            kind="inherits",
                            file_path=file_path,
                            line=type_node.start_point[0] + 1,
                        ))
            elif clause.type == "implements_clause":
                for type_node in clause.named_children:
                    if type_node.type in ("identifier", "type_identifier", "generic_type"):
                        iface_name = get_node_text(type_node, source).split("<")[0].strip()
                        relationships.append(ExtractedRelationship(
                            source_symbol=class_name,
                            target_symbol=iface_name,
                            kind="implements",
                            file_path=file_path,
                            line=type_node.start_point[0] + 1,
                        ))

    # ─── Helpers ────────────────────────────────────────────────────────

    def _extract_parameters(self, node: SyntaxNode, source: str) -> str | None:
        params_node = get_named_child(node, "formal_parameters")
        if params_node:
            return get_node_text(params_node, source)
        return None

    def _extract_return_type(self, node: SyntaxNode, source: str) -> str | None:
        type_ann = get_named_child(node, "type_annotation")
        if type_ann:
            return get_node_text(type_ann, source).lstrip(": ").strip()
        return None

    def _is_exported(self, node: SyntaxNode) -> bool:
        if node.parent and node.parent.type == "export_statement":
            return True
        text = get_node_text(node, node.text.decode("utf-8") if hasattr(node, "text") else "")
        return False

    def _has_modifier(self, node: SyntaxNode, source: str, modifier: str) -> bool:
        text = get_node_text(node, source)
        header = text.split("{")[0] if "{" in text else text.split("\n")[0]
        return f" {modifier} " in f" {header} " or header.startswith(f"{modifier} ")

    def _extract_modifiers(self, node: SyntaxNode, source: str) -> list[str]:
        modifiers: list[str] = []
        text = get_node_text(node, source)
        header = text.split("{")[0] if "{" in text else text.split("\n")[0]
        for mod in ("abstract", "static", "readonly", "private", "protected", "public", "override"):
            if re.search(rf"\b{mod}\b", header):
                modifiers.append(mod)
        return modifiers

    def _build_func_sig(
        self, name: str, params: str | None, return_type: str | None, is_async: bool
    ) -> str:
        prefix = "async " if is_async else ""
        ret = f": {return_type}" if return_type else ""
        return f"{prefix}function {name}{params or '()'}{ret}"[:500]


# Module-level alias for dynamic loading
Parser = TypeScriptParser

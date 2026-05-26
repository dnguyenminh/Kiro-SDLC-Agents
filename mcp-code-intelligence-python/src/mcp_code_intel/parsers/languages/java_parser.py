"""
KSA-178: Java Language Parser.
Port of mcp-code-intelligence-nodejs/src/parsers/languages/java-parser.ts.
"""

from __future__ import annotations

from tree_sitter import Parser as TSParser

from ..types import (
    ExtractedRelationship, ExtractedSymbol, ParseResult, SymbolKind,
)
from ..ast_utils import (
    find_nodes, find_first, get_node_text, get_node_range, get_named_child,
    walk_tree, extract_doc_comment, calculate_complexity, SyntaxNode,
)
from .base_parser import BaseLanguageParser


class JavaParser(BaseLanguageParser):
    """Extracts symbols and relationships from Java AST."""

    def get_supported_extensions(self) -> list[str]:
        return [".java"]

    def parse(self, source: str, file_path: str) -> ParseResult:
        root = self._parse_tree(source)
        symbols: list[ExtractedSymbol] = []
        relationships: list[ExtractedRelationship] = []
        errors = self._collect_errors(root)

        self._extract_package(root, source, file_path, symbols)
        self._extract_imports(root, source, file_path, relationships)
        self._extract_declarations(root, source, file_path, None, symbols, relationships)

        return ParseResult(symbols=symbols, relationships=relationships, errors=errors)

    def _extract_package(self, root: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol]) -> None:
        pkg_nodes = find_nodes(root, "package_declaration")
        if not pkg_nodes:
            return
        pkg_node = pkg_nodes[0]
        scoped_id = find_first(pkg_node, "scoped_identifier") or find_first(pkg_node, "identifier")
        if not scoped_id:
            return
        name = get_node_text(scoped_id, source)
        start_line, end_line = get_node_range(pkg_node)
        symbols.append(ExtractedSymbol(
            name=name, kind="namespace", file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=f"package {name}", is_exported=True,
        ))

    def _extract_imports(self, root: SyntaxNode, source: str, file_path: str, relationships: list[ExtractedRelationship]) -> None:
        for import_node in find_nodes(root, "import_declaration"):
            text = get_node_text(import_node, source)
            is_static = "static" in text
            is_wildcard = "*" in text
            scoped_id = find_first(import_node, "scoped_identifier")
            identifier = find_nodes(import_node, "identifier")
            path = get_node_text(scoped_id, source) if scoped_id else (get_node_text(identifier[0], source) if identifier else "")
            target = f"{path}.*" if is_wildcard else path
            relationships.append(ExtractedRelationship(
                source_symbol="__file__", target_symbol=target, kind="imports",
                file_path=file_path, line=import_node.start_point[0] + 1,
                metadata={**({"static": True} if is_static else {}), **({"wildcard": True} if is_wildcard else {})},
            ))

    def _extract_declarations(self, node: SyntaxNode, source: str, file_path: str, parent_name: str | None, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship], depth: int = 0) -> None:
        if depth > 10:
            return
        for child in node.named_children:
            if child.type == "class_declaration":
                self._extract_type(child, source, file_path, parent_name, "class", symbols, relationships, depth)
            elif child.type == "interface_declaration":
                self._extract_type(child, source, file_path, parent_name, "interface", symbols, relationships, depth)
            elif child.type == "enum_declaration":
                self._extract_type(child, source, file_path, parent_name, "enum", symbols, relationships, depth)
            elif child.type == "record_declaration":
                self._extract_type(child, source, file_path, parent_name, "class", symbols, relationships, depth)
            elif child.type == "annotation_type_declaration":
                self._extract_type(child, source, file_path, parent_name, "interface", symbols, relationships, depth)

    def _extract_type(self, node: SyntaxNode, source: str, file_path: str, parent_name: str | None, default_kind: SymbolKind, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship], depth: int) -> None:
        name_node = get_named_child(node, "identifier")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        doc_comment = extract_doc_comment(node, source)
        modifiers = self._extract_modifiers(node, source)
        is_exported = "public" in modifiers
        annotations = self._extract_annotations(node, source)

        # Inheritance
        self._extract_inheritance(node, source, file_path, name, relationships)

        # Build signature
        type_keyword = default_kind
        if node.type == "record_declaration":
            modifiers.append("record")
            type_keyword = "record"
        mod_str = " ".join(m for m in modifiers if m not in ("record", "annotation"))
        signature = f"{mod_str} {type_keyword} {name}".strip()

        symbols.append(ExtractedSymbol(
            name=name, kind=default_kind, file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=signature[:500], modifiers=modifiers if modifiers else None,
            decorators=annotations if annotations else None,
            parent_name=parent_name, is_exported=is_exported, doc_comment=doc_comment,
        ))

        # Extract body members
        body = get_named_child(node, "class_body") or get_named_child(node, "interface_body") or get_named_child(node, "enum_body")
        if body:
            self._extract_members(body, source, file_path, name, symbols, relationships, depth)

    def _extract_members(self, body: SyntaxNode, source: str, file_path: str, class_name: str, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship], depth: int) -> None:
        for member in body.named_children:
            if member.type == "method_declaration":
                self._extract_method(member, source, file_path, class_name, symbols, relationships)
            elif member.type == "constructor_declaration":
                self._extract_constructor(member, source, file_path, class_name, symbols, relationships)
            elif member.type == "field_declaration":
                self._extract_fields(member, source, file_path, class_name, symbols)
            elif member.type in ("class_declaration", "interface_declaration", "enum_declaration", "record_declaration"):
                kind_map = {"class_declaration": "class", "interface_declaration": "interface", "enum_declaration": "enum", "record_declaration": "class"}
                self._extract_type(member, source, file_path, class_name, kind_map[member.type], symbols, relationships, depth + 1)

    def _extract_method(self, node: SyntaxNode, source: str, file_path: str, class_name: str, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship]) -> None:
        name_node = get_named_child(node, "identifier")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        modifiers = self._extract_modifiers(node, source)
        annotations = self._extract_annotations(node, source)
        doc_comment = extract_doc_comment(node, source)
        params_node = get_named_child(node, "formal_parameters")
        params = get_node_text(params_node, source) if params_node else "()"
        return_type = self._extract_method_return_type(node, source)
        body = get_named_child(node, "block")
        complexity = self._calc_java_complexity(body) if body else 1

        symbols.append(ExtractedSymbol(
            name=name, kind="method", file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=self._build_method_sig(modifiers, return_type, name, params),
            parameters=params, return_type=return_type,
            modifiers=modifiers if modifiers else None,
            decorators=annotations if annotations else None,
            parent_name=class_name, is_exported="public" in modifiers,
            doc_comment=doc_comment, complexity=complexity,
        ))

        if body:
            self._extract_calls(body, source, file_path, f"{class_name}.{name}", relationships)

    def _extract_constructor(self, node: SyntaxNode, source: str, file_path: str, class_name: str, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship]) -> None:
        name_node = get_named_child(node, "identifier")
        name = get_node_text(name_node, source) if name_node else class_name
        start_line, end_line = get_node_range(node)
        modifiers = self._extract_modifiers(node, source)
        params_node = get_named_child(node, "formal_parameters")
        params = get_node_text(params_node, source) if params_node else "()"
        body = get_named_child(node, "constructor_body") or get_named_child(node, "block")
        complexity = self._calc_java_complexity(body) if body else 1

        symbols.append(ExtractedSymbol(
            name="constructor", kind="constructor", file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=f"{' '.join(modifiers)} {name}{params}".strip(),
            parameters=params, modifiers=modifiers if modifiers else None,
            parent_name=class_name, is_exported="public" in modifiers, complexity=complexity,
        ))

        if body:
            self._extract_calls(body, source, file_path, f"{class_name}.constructor", relationships)

    def _extract_fields(self, node: SyntaxNode, source: str, file_path: str, class_name: str, symbols: list[ExtractedSymbol]) -> None:
        import re
        start_line, end_line = get_node_range(node)
        modifiers = self._extract_modifiers(node, source)
        type_text = self._get_field_type(node, source)
        for decl in find_nodes(node, "variable_declarator"):
            name_node = get_named_child(decl, "identifier")
            if not name_node:
                continue
            name = get_node_text(name_node, source)
            is_constant = "static" in modifiers and "final" in modifiers and bool(re.match(r"^[A-Z_][A-Z0-9_]*$", name))
            symbols.append(ExtractedSymbol(
                name=name, kind="constant" if is_constant else "property",
                file_path=file_path, start_line=start_line, end_line=end_line,
                signature=f"{' '.join(modifiers)} {type_text} {name}".strip()[:200],
                return_type=type_text, modifiers=modifiers if modifiers else None,
                parent_name=class_name, is_exported="public" in modifiers,
            ))

    def _extract_inheritance(self, node: SyntaxNode, source: str, file_path: str, class_name: str, relationships: list[ExtractedRelationship]) -> None:
        superclass = get_named_child(node, "superclass")
        if superclass:
            type_id = get_named_child(superclass, "type_identifier") or get_named_child(superclass, "scoped_type_identifier") or get_named_child(superclass, "generic_type")
            if type_id:
                base_name = get_node_text(type_id, source).split("<")[0].strip()
                relationships.append(ExtractedRelationship(
                    source_symbol=class_name, target_symbol=base_name, kind="inherits",
                    file_path=file_path, line=type_id.start_point[0] + 1,
                ))

        interfaces = get_named_child(node, "super_interfaces")
        if interfaces:
            type_list = get_named_child(interfaces, "type_list")
            if type_list:
                for type_node in type_list.named_children:
                    iface_name = get_node_text(type_node, source).split("<")[0].strip()
                    relationships.append(ExtractedRelationship(
                        source_symbol=class_name, target_symbol=iface_name, kind="implements",
                        file_path=file_path, line=type_node.start_point[0] + 1,
                    ))

        extends_interfaces = get_named_child(node, "extends_interfaces")
        if extends_interfaces:
            type_list = get_named_child(extends_interfaces, "type_list")
            if type_list:
                for type_node in type_list.named_children:
                    iface_name = get_node_text(type_node, source).split("<")[0].strip()
                    relationships.append(ExtractedRelationship(
                        source_symbol=class_name, target_symbol=iface_name, kind="inherits",
                        file_path=file_path, line=type_node.start_point[0] + 1,
                    ))

    def _extract_calls(self, body: SyntaxNode, source: str, file_path: str, caller_name: str, relationships: list[ExtractedRelationship]) -> None:
        seen: set[str] = set()
        for call in find_nodes(body, "method_invocation"):
            target = self._resolve_call_target(call, source)
            if not target:
                continue
            key = f"{caller_name}->{target}"
            if key in seen:
                continue
            seen.add(key)
            relationships.append(ExtractedRelationship(
                source_symbol=caller_name, target_symbol=target, kind="calls",
                file_path=file_path, line=call.start_point[0] + 1,
            ))

        for creation in find_nodes(body, "object_creation_expression"):
            type_node = get_named_child(creation, "type_identifier") or get_named_child(creation, "scoped_type_identifier") or get_named_child(creation, "generic_type")
            if not type_node:
                continue
            type_name = get_node_text(type_node, source).split("<")[0].strip()
            target = f"{type_name}.constructor"
            key = f"{caller_name}->{target}"
            if key in seen:
                continue
            seen.add(key)
            relationships.append(ExtractedRelationship(
                source_symbol=caller_name, target_symbol=target, kind="calls",
                file_path=file_path, line=creation.start_point[0] + 1,
                metadata={"constructor": True},
            ))

    def _resolve_call_target(self, call_node: SyntaxNode, source: str) -> str | None:
        name_node = get_named_child(call_node, "identifier")
        if not name_node:
            return None
        name = get_node_text(name_node, source)
        children = call_node.children
        if children and children[0] != name_node:
            obj = children[0]
            if obj.type != "identifier":
                obj_text = get_node_text(obj, source)
                simplified = ".".join(obj_text.split(".")[-2:]) if len(obj_text) > 50 else obj_text
                return f"{simplified}.{name}"
            else:
                return f"{get_node_text(obj, source)}.{name}"
        return name

    # ─── Helpers ────────────────────────────────────────────────────────

    def _extract_modifiers(self, node: SyntaxNode, source: str) -> list[str]:
        modifiers: list[str] = []
        modifier_node = get_named_child(node, "modifiers")
        if not modifier_node:
            return modifiers
        valid_mods = {"public", "private", "protected", "static", "final", "abstract", "synchronized", "native", "transient", "volatile", "default", "sealed", "non-sealed"}
        for child in modifier_node.children:
            if child.type not in ("marker_annotation", "annotation"):
                text = get_node_text(child, source)
                if text in valid_mods:
                    modifiers.append(text)
        return modifiers

    def _extract_annotations(self, node: SyntaxNode, source: str) -> list[str]:
        annotations: list[str] = []
        modifier_node = get_named_child(node, "modifiers")
        if not modifier_node:
            return annotations
        for child in modifier_node.children:
            if child.type in ("marker_annotation", "annotation"):
                text = get_node_text(child, source).lstrip("@").split("(")[0].strip()
                annotations.append(text)
        return annotations

    def _extract_method_return_type(self, node: SyntaxNode, source: str) -> str | None:
        type_types = {"type_identifier", "void_type", "integral_type", "floating_point_type", "boolean_type", "generic_type", "scoped_type_identifier", "array_type"}
        for child in node.children:
            if child.type in type_types:
                return get_node_text(child, source)
        return None

    def _get_field_type(self, node: SyntaxNode, source: str) -> str:
        type_types = {"type_identifier", "void_type", "integral_type", "floating_point_type", "boolean_type", "generic_type", "scoped_type_identifier", "array_type"}
        for child in node.children:
            if child.type in type_types:
                return get_node_text(child, source)
        return ""

    def _calc_java_complexity(self, node: SyntaxNode) -> int:
        complexity = 1
        branch_types = {"if_statement", "for_statement", "enhanced_for_statement", "while_statement", "do_statement", "switch_expression", "catch_clause", "ternary_expression", "switch_block_statement_group"}

        def _enter(n: SyntaxNode) -> None:
            nonlocal complexity
            if n.type in branch_types:
                complexity += 1
            if n.type in ("&&", "||"):
                complexity += 1
            if n.type == "lambda_expression":
                complexity += 1

        walk_tree(node, enter=_enter)
        return complexity

    def _build_method_sig(self, modifiers: list[str], return_type: str | None, name: str, params: str) -> str:
        mods = f"{' '.join(modifiers)} " if modifiers else ""
        ret = f"{return_type} " if return_type else ""
        return f"{mods}{ret}{name}{params}".strip()[:500]


# Module-level alias for dynamic loading
Parser = JavaParser

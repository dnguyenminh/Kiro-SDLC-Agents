"""
KSA-178: Kotlin Language Parser.
Port of mcp-code-intelligence-nodejs/src/parsers/languages/kotlin-parser.ts.
"""

from __future__ import annotations

import re

from tree_sitter import Parser as TSParser

from ..types import ExtractedRelationship, ExtractedSymbol, ParseResult, SymbolKind
from ..ast_utils import (
    find_nodes, find_first, get_node_text, get_node_range, get_named_child,
    walk_tree, SyntaxNode,
)
from .base_parser import BaseLanguageParser


class KotlinParser(BaseLanguageParser):
    """Extracts symbols and relationships from Kotlin AST."""

    def __init__(self, parser: TSParser, language_id: str = "kotlin") -> None:
        super().__init__(parser, language_id)

    def get_supported_extensions(self) -> list[str]:
        return [".kt", ".kts"]

    def parse(self, source: str, file_path: str) -> ParseResult:
        root = self._parse_tree(source)
        symbols: list[ExtractedSymbol] = []
        relationships: list[ExtractedRelationship] = []
        errors = self._collect_errors(root)

        self._extract_package(root, source, file_path, symbols)
        self._extract_imports(root, source, file_path, relationships)
        self._extract_declarations(root, source, file_path, symbols, relationships, None)

        return ParseResult(symbols=symbols, relationships=relationships, errors=errors)

    def _extract_package(self, root: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol]) -> None:
        pkg_node = find_first(root, "package_header")
        if not pkg_node:
            return
        identifier = find_first(pkg_node, "identifier")
        if not identifier:
            return
        start_line, end_line = get_node_range(pkg_node)
        symbols.append(ExtractedSymbol(
            name=get_node_text(identifier, source), kind="namespace",
            file_path=file_path, start_line=start_line, end_line=end_line,
            signature=get_node_text(pkg_node, source).strip(),
        ))

    def _extract_imports(self, root: SyntaxNode, source: str, file_path: str, relationships: list[ExtractedRelationship]) -> None:
        for imp in find_nodes(root, "import_header"):
            identifier = find_first(imp, "identifier")
            if not identifier:
                continue
            target = get_node_text(identifier, source)
            imp_text = get_node_text(imp, source)
            is_wildcard = ".*" in imp_text or imp_text.endswith("*")

            alias = None
            alias_node = find_first(imp, "import_alias")
            if alias_node:
                alias_id = find_first(alias_node, "simple_identifier")
                if alias_id:
                    alias = get_node_text(alias_id, source)

            relationships.append(ExtractedRelationship(
                source_symbol="__file__",
                target_symbol=f"{target}.*" if is_wildcard else target,
                kind="imports", file_path=file_path, line=imp.start_point[0] + 1,
                metadata={**({"wildcard": True} if is_wildcard else {}), **({"alias": alias} if alias else {})},
            ))

    def _extract_declarations(self, node: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship], parent_name: str | None) -> None:
        for child in node.named_children:
            if child.type == "class_declaration":
                self._extract_class(child, source, file_path, symbols, relationships, parent_name)
            elif child.type == "object_declaration":
                self._extract_object(child, source, file_path, symbols, relationships, parent_name)
            elif child.type == "function_declaration":
                self._extract_function(child, source, file_path, symbols, relationships, parent_name)
            elif child.type == "property_declaration":
                self._extract_property(child, source, file_path, symbols, relationships, parent_name)
            elif child.type == "type_alias":
                self._extract_type_alias(child, source, file_path, symbols, parent_name)

    def _extract_class(self, node: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship], parent_name: str | None) -> None:
        name_node = find_first(node, "type_identifier")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        modifiers = self._extract_modifiers(node, source)
        annotations = self._get_annotation_names(node, source)

        node_text = get_node_text(node, source).split("{")[0]
        is_interface = bool(re.search(r"\binterface\b", node_text))
        is_enum = "enum" in modifiers
        is_data = "data" in modifiers

        kind: SymbolKind = "interface" if is_interface else ("enum" if is_enum else "class")
        type_params = self._extract_type_parameters(node, source)
        params = self._extract_primary_constructor(node, source)

        # Supertypes
        delegation_specs = find_first(node, "delegation_specifiers")
        if delegation_specs:
            self._extract_supertypes(delegation_specs, source, name, file_path, relationships)

        mod_prefix = " ".join(m for m in modifiers if m not in ("public", "internal"))
        kind_str = "interface" if is_interface else "class"
        sig = f"{mod_prefix + ' ' if mod_prefix else ''}{kind_str} {name}{type_params}{f'({params})' if params else ''}"

        start_line, end_line = get_node_range(node)
        symbols.append(ExtractedSymbol(
            name=name, kind=kind, file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=sig.strip()[:500], parameters=params or None,
            modifiers=modifiers if modifiers else None, parent_name=parent_name,
            is_exported="private" not in modifiers,
            decorators=annotations if annotations else None,
        ))

        class_body = find_first(node, "class_body")
        if class_body:
            self._extract_declarations(class_body, source, file_path, symbols, relationships, name)
            self._extract_companion_objects(class_body, source, file_path, symbols, relationships, name)

        if is_data and params:
            self._generate_data_class_members(name, file_path, node, symbols)

    def _extract_object(self, node: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship], parent_name: str | None) -> None:
        name_node = find_first(node, "type_identifier") or find_first(node, "simple_identifier")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        modifiers = self._extract_modifiers(node, source)
        start_line, end_line = get_node_range(node)

        delegation_specs = find_first(node, "delegation_specifiers")
        if delegation_specs:
            self._extract_supertypes(delegation_specs, source, name, file_path, relationships)

        symbols.append(ExtractedSymbol(
            name=name, kind="class", file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=f"object {name}", modifiers=[*modifiers, "object"],
            parent_name=parent_name, is_exported="private" not in modifiers,
        ))

        class_body = find_first(node, "class_body")
        if class_body:
            self._extract_declarations(class_body, source, file_path, symbols, relationships, name)

    def _extract_companion_objects(self, class_body: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship], class_name: str) -> None:
        for comp in find_nodes(class_body, "companion_object"):
            companion_name = f"{class_name}.Companion"
            start_line, end_line = get_node_range(comp)
            symbols.append(ExtractedSymbol(
                name="Companion", kind="class", file_path=file_path,
                start_line=start_line, end_line=end_line,
                signature="companion object", modifiers=["companion", "object"],
                parent_name=class_name,
            ))
            body = find_first(comp, "class_body")
            if body:
                self._extract_declarations(body, source, file_path, symbols, relationships, companion_name)

    def _extract_function(self, node: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship], parent_name: str | None) -> None:
        name_node = find_first(node, "simple_identifier")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        modifiers = self._extract_modifiers(node, source)
        is_suspend = "suspend" in modifiers
        annotations = self._get_annotation_names(node, source)
        receiver_type = self._extract_receiver_type(node, source)
        params = self._extract_function_parameters(node, source)
        return_type = self._extract_return_type(node, source)
        body = find_first(node, "function_body")
        complexity = self._calc_kotlin_complexity(body) if body else 1
        kind: SymbolKind = "method" if parent_name else "function"
        sig = self._build_func_sig(modifiers, receiver_type, name, params, return_type)
        start_line, end_line = get_node_range(node)

        final_modifiers = [*modifiers, "extension"] if receiver_type else modifiers

        symbols.append(ExtractedSymbol(
            name=name, kind=kind, file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=sig, parameters=params or None, return_type=return_type,
            modifiers=final_modifiers if final_modifiers else None,
            parent_name=parent_name, is_async=is_suspend,
            is_exported="private" not in modifiers, complexity=complexity,
            decorators=annotations if annotations else None,
        ))

        if body:
            caller_name = f"{parent_name}.{name}" if parent_name else name
            self._extract_calls(body, source, caller_name, file_path, relationships)

    def _extract_property(self, node: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship], parent_name: str | None) -> None:
        var_decl = find_first(node, "variable_declaration")
        if not var_decl:
            return
        name_node = find_first(var_decl, "simple_identifier")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        modifiers = self._extract_modifiers(node, source)
        node_text = get_node_text(node, source)
        is_val = "val " in node_text or bool(re.search(r"\bval\b", node_text))
        is_const = "const" in modifiers
        type_node = find_first(var_decl, "user_type") or find_first(var_decl, "nullable_type")
        type_str = get_node_text(type_node, source) if type_node else None
        kind: SymbolKind = "constant" if is_const else "property"
        sig = f"{'val' if is_val else 'var'} {name}{f': {type_str}' if type_str else ''}"
        start_line, end_line = get_node_range(node)

        symbols.append(ExtractedSymbol(
            name=name, kind=kind, file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=sig[:200], return_type=type_str,
            modifiers=modifiers if modifiers else None, parent_name=parent_name,
            is_exported="private" not in modifiers,
        ))

    def _extract_type_alias(self, node: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol], parent_name: str | None) -> None:
        name_node = find_first(node, "type_identifier")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        symbols.append(ExtractedSymbol(
            name=name, kind="type", file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=get_node_text(node, source).split("\n")[0].strip()[:200],
            parent_name=parent_name, is_exported=True,
        ))

    def _extract_supertypes(self, node: SyntaxNode, source: str, class_name: str, file_path: str, relationships: list[ExtractedRelationship]) -> None:
        for child in node.named_children:
            if child.type in ("delegation_specifier", "annotated_delegation_specifier"):
                spec_node = find_first(child, "delegation_specifier") if child.type == "annotated_delegation_specifier" else child
                if not spec_node:
                    spec_node = child
                text = get_node_text(spec_node, source).strip()
                has_parens = "(" in text
                type_name = re.sub(r"\(.*\)$", "", text)
                type_name = re.sub(r"<.*>", "", type_name).strip()
                if type_name:
                    relationships.append(ExtractedRelationship(
                        source_symbol=class_name, target_symbol=type_name,
                        kind="inherits" if has_parens else "implements",
                        file_path=file_path, line=child.start_point[0] + 1,
                    ))

    def _extract_calls(self, node: SyntaxNode, source: str, source_name: str, file_path: str, relationships: list[ExtractedRelationship]) -> None:
        call_exprs = find_nodes(node, "call_expression")
        seen: set[str] = set()
        for call in call_exprs:
            target = self._resolve_call_target(call, source)
            if not target:
                continue
            if target["name"] in ("println", "print"):
                continue
            key = f"{source_name}->{target['name']}"
            if key in seen:
                continue
            seen.add(key)
            relationships.append(ExtractedRelationship(
                source_symbol=source_name, target_symbol=target["name"],
                kind="calls", file_path=file_path, line=call.start_point[0] + 1,
                metadata=target.get("metadata"),
            ))

    def _resolve_call_target(self, node: SyntaxNode, source: str) -> dict | None:
        children = node.children
        if not children:
            return None
        first_child = children[0]
        if first_child.type == "navigation_expression":
            text = get_node_text(first_child, source)
            parts = text.split(".")
            method = parts[-1]
            receiver = ".".join(parts[:-1])
            return {"name": method, "metadata": {"receiver": receiver}}
        if first_child.type == "simple_identifier":
            name = get_node_text(first_child, source)
            if name and name[0].isupper() and not name[0].isdigit():
                return {"name": name, "metadata": {"isConstructor": True}}
            return {"name": name}
        return None

    # ─── Helpers ────────────────────────────────────────────────────────

    def _extract_modifiers(self, node: SyntaxNode, source: str) -> list[str]:
        modifiers: list[str] = []
        modifier_list = find_first(node, "modifiers")
        if not modifier_list or modifier_list.parent != node:
            return modifiers
        for child in modifier_list.named_children:
            if child.type == "annotation":
                continue
            text = get_node_text(child, source).strip()
            if text and not text.startswith("@"):
                modifiers.append(text)
        return modifiers

    def _get_annotation_names(self, node: SyntaxNode, source: str) -> list[str]:
        annotations: list[str] = []
        modifier_list = find_first(node, "modifiers")
        if not modifier_list or modifier_list.parent != node:
            return annotations
        for child in modifier_list.named_children:
            if child.type == "annotation":
                text = get_node_text(child, source).lstrip("@").split("(")[0].strip()
                if text:
                    annotations.append(text)
        return annotations

    def _extract_type_parameters(self, node: SyntaxNode, source: str) -> str:
        tp = find_first(node, "type_parameters")
        return get_node_text(tp, source) if tp else ""

    def _extract_primary_constructor(self, node: SyntaxNode, source: str) -> str | None:
        constructor = find_first(node, "primary_constructor")
        if not constructor:
            return None
        param_list = find_first(constructor, "class_parameters")
        if not param_list:
            return None
        return get_node_text(param_list, source).strip("()")

    def _extract_function_parameters(self, node: SyntaxNode, source: str) -> str | None:
        params = find_first(node, "function_value_parameters")
        return get_node_text(params, source) if params else None

    def _extract_return_type(self, node: SyntaxNode, source: str) -> str | None:
        node_text = get_node_text(node, source)
        header_end = node_text.find("{")
        header = node_text[:header_end] if header_end > 0 else node_text.split("\n")[0]
        depth = 0
        last_colon = -1
        for i in range(len(header) - 1, -1, -1):
            if header[i] == ")":
                depth += 1
            if header[i] == "(":
                depth -= 1
            if header[i] == ":" and depth == 0:
                last_colon = i
                break
        if last_colon > 0:
            return_type = header[last_colon + 1:].strip()
            if return_type and "(" not in return_type:
                return return_type
        return None

    def _extract_receiver_type(self, node: SyntaxNode, source: str) -> str | None:
        node_text = get_node_text(node, source)
        match = re.search(r"\bfun\s+(?:<[^>]+>\s+)?(\w+(?:<[^>]+>)?)\.", node_text)
        return match.group(1) if match else None

    def _calc_kotlin_complexity(self, node: SyntaxNode) -> int:
        complexity = 1
        branch_types = {"if_expression", "when_entry", "for_statement", "while_statement", "do_while_statement", "catch_block"}
        logical_types = {"conjunction_expression", "disjunction_expression"}

        def _enter(n: SyntaxNode) -> None:
            nonlocal complexity
            if n.type in branch_types:
                complexity += 1
            if n.type in logical_types:
                complexity += 1

        walk_tree(node, enter=_enter)
        return complexity

    def _build_func_sig(self, modifiers: list[str], receiver_type: str | None, name: str, params: str | None, return_type: str | None) -> str:
        mod_str = " ".join(m for m in modifiers if m not in ("public", "internal"))
        receiver = f"{receiver_type}." if receiver_type else ""
        ret = f": {return_type}" if return_type else ""
        return f"{mod_str + ' ' if mod_str else ''}fun {receiver}{name}{params or '()'}{ret}".strip()[:500]

    def _generate_data_class_members(self, class_name: str, file_path: str, node: SyntaxNode, symbols: list[ExtractedSymbol]) -> None:
        start_line, _ = get_node_range(node)
        for method in ("copy", "toString", "hashCode", "equals", "componentN"):
            symbols.append(ExtractedSymbol(
                name=method, kind="method", file_path=file_path,
                start_line=start_line, end_line=start_line,
                signature=f"fun {method}(): /* generated */",
                parent_name=class_name, modifiers=["generated"],
            ))


# Module-level alias for dynamic loading
Parser = KotlinParser

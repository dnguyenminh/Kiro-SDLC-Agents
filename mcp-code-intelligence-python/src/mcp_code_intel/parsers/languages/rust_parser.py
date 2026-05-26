"""
KSA-178: Rust Language Parser.
Port of mcp-code-intelligence-nodejs/src/parsers/languages/rust-parser.ts.
"""

from __future__ import annotations

import re

from tree_sitter import Parser as TSParser

from ..types import ExtractedRelationship, ExtractedSymbol, ParseResult, SymbolKind
from ..ast_utils import (
    find_nodes, get_node_text, get_node_range, get_named_child,
    walk_tree, extract_doc_comment, calculate_complexity, SyntaxNode,
)
from .base_parser import BaseLanguageParser


class RustParser(BaseLanguageParser):
    """Extracts symbols and relationships from Rust AST."""

    def get_supported_extensions(self) -> list[str]:
        return [".rs"]

    def parse(self, source: str, file_path: str) -> ParseResult:
        root = self._parse_tree(source)
        symbols: list[ExtractedSymbol] = []
        relationships: list[ExtractedRelationship] = []
        errors = self._collect_errors(root)
        self._extract_from_node(root, source, file_path, None, symbols, relationships)
        self._extract_use_declarations(root, source, file_path, relationships)
        return ParseResult(symbols=symbols, relationships=relationships, errors=errors)

    def _extract_from_node(self, node: SyntaxNode, source: str, file_path: str,
                           parent_name: str | None, symbols: list[ExtractedSymbol],
                           relationships: list[ExtractedRelationship]) -> None:
        for child in node.named_children:
            t = child.type
            if t == "function_item":
                self._extract_function(child, source, file_path, parent_name, symbols, relationships)
            elif t == "struct_item":
                self._extract_struct(child, source, file_path, parent_name, symbols, relationships)
            elif t == "enum_item":
                self._extract_enum(child, source, file_path, parent_name, symbols, relationships)
            elif t == "trait_item":
                self._extract_trait(child, source, file_path, parent_name, symbols, relationships)
            elif t == "impl_item":
                self._extract_impl(child, source, file_path, symbols, relationships)
            elif t == "mod_item":
                self._extract_module(child, source, file_path, parent_name, symbols, relationships)
            elif t == "type_item":
                self._extract_type_alias(child, source, file_path, parent_name, symbols)
            elif t in ("const_item", "static_item"):
                self._extract_const_static(child, source, file_path, parent_name, symbols)

    def _extract_function(self, node: SyntaxNode, source: str, file_path: str,
                          parent_name: str | None, symbols: list[ExtractedSymbol],
                          relationships: list[ExtractedRelationship]) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        visibility = self._extract_visibility(node, source)
        modifiers = self._extract_func_modifiers(node, source)
        params = self._field_text(node, "parameters", source)
        return_type = self._extract_return_type(node, source)
        tp = node.child_by_field_name("type_parameters")
        generics = get_node_text(tp, source) if tp else ""
        doc_comment = extract_doc_comment(node, source)
        is_exported = visibility in ("pub", "pub_crate")
        prefix = f"{' '.join(modifiers)} " if modifiers else ""
        ret = f" -> {return_type}" if return_type else ""
        sig = f"{prefix}fn {name}{generics}{params}{ret}"
        symbols.append(ExtractedSymbol(
            name=name, kind="method" if parent_name else "function",
            file_path=file_path, start_line=start_line, end_line=end_line,
            signature=sig[:500], parameters=params or None, return_type=return_type or None,
            modifiers=modifiers if modifiers else None, is_async="async" in modifiers,
            is_exported=is_exported, parent_name=parent_name, doc_comment=doc_comment,
            complexity=calculate_complexity(node),
        ))
        body = node.child_by_field_name("body")
        if body:
            caller = f"{parent_name}.{name}" if parent_name else name
            self._extract_calls(body, source, file_path, caller, relationships)

    def _extract_struct(self, node: SyntaxNode, source: str, file_path: str,
                        parent_name: str | None, symbols: list[ExtractedSymbol],
                        relationships: list[ExtractedRelationship]) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        visibility = self._extract_visibility(node, source)
        tp = node.child_by_field_name("type_parameters")
        generics = get_node_text(tp, source) if tp else ""
        symbols.append(ExtractedSymbol(
            name=name, kind="struct", file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=f"struct {name}{generics}",
            is_exported=visibility in ("pub", "pub_crate"), parent_name=parent_name,
            doc_comment=extract_doc_comment(node, source),
        ))
        relationships.extend(self._extract_derives(node, source, name, file_path, start_line))

    def _extract_enum(self, node: SyntaxNode, source: str, file_path: str,
                      parent_name: str | None, symbols: list[ExtractedSymbol],
                      relationships: list[ExtractedRelationship]) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        visibility = self._extract_visibility(node, source)
        symbols.append(ExtractedSymbol(
            name=name, kind="enum", file_path=file_path,
            start_line=start_line, end_line=end_line, signature=f"enum {name}",
            is_exported=visibility in ("pub", "pub_crate"), parent_name=parent_name,
            doc_comment=extract_doc_comment(node, source),
        ))
        relationships.extend(self._extract_derives(node, source, name, file_path, start_line))

    def _extract_trait(self, node: SyntaxNode, source: str, file_path: str,
                       parent_name: str | None, symbols: list[ExtractedSymbol],
                       relationships: list[ExtractedRelationship]) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        visibility = self._extract_visibility(node, source)
        tp = node.child_by_field_name("type_parameters")
        generics = get_node_text(tp, source) if tp else ""
        symbols.append(ExtractedSymbol(
            name=name, kind="trait", file_path=file_path,
            start_line=start_line, end_line=end_line, signature=f"trait {name}{generics}",
            is_exported=visibility in ("pub", "pub_crate"), parent_name=parent_name,
            doc_comment=extract_doc_comment(node, source),
        ))
        body = node.child_by_field_name("body")
        if body:
            self._extract_from_node(body, source, file_path, name, symbols, relationships)

    def _extract_impl(self, node: SyntaxNode, source: str, file_path: str,
                      symbols: list[ExtractedSymbol],
                      relationships: list[ExtractedRelationship]) -> None:
        type_node = node.child_by_field_name("type")
        if not type_node:
            return
        target_type = get_node_text(type_node, source).split("<")[0].strip()
        trait_node = node.child_by_field_name("trait")
        trait_name = get_node_text(trait_node, source).split("<")[0].strip() if trait_node else None
        start_line, end_line = get_node_range(node)
        impl_name = f"impl {trait_name} for {target_type}" if trait_name else f"impl {target_type}"
        symbols.append(ExtractedSymbol(
            name=impl_name, kind="namespace", file_path=file_path,
            start_line=start_line, end_line=end_line, signature=impl_name,
        ))
        if trait_name:
            relationships.append(ExtractedRelationship(
                source_symbol=target_type, target_symbol=trait_name,
                kind="implements", file_path=file_path, line=start_line,
            ))
        body = node.child_by_field_name("body")
        if body:
            for item in body.named_children:
                if item.type == "function_item":
                    self._extract_function(item, source, file_path, target_type, symbols, relationships)

    def _extract_module(self, node: SyntaxNode, source: str, file_path: str,
                        parent_name: str | None, symbols: list[ExtractedSymbol],
                        relationships: list[ExtractedRelationship]) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        symbols.append(ExtractedSymbol(
            name=name, kind="module", file_path=file_path,
            start_line=start_line, end_line=end_line, signature=f"mod {name}",
            is_exported=self._extract_visibility(node, source) in ("pub", "pub_crate"),
            parent_name=parent_name,
        ))
        body = node.child_by_field_name("body")
        if body:
            self._extract_from_node(body, source, file_path, name, symbols, relationships)

    def _extract_type_alias(self, node: SyntaxNode, source: str, file_path: str,
                            parent_name: str | None, symbols: list[ExtractedSymbol]) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        symbols.append(ExtractedSymbol(
            name=name, kind="type", file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=get_node_text(node, source).split("\n")[0].strip()[:200],
            is_exported=self._extract_visibility(node, source) in ("pub", "pub_crate"),
            parent_name=parent_name,
        ))

    def _extract_const_static(self, node: SyntaxNode, source: str, file_path: str,
                              parent_name: str | None, symbols: list[ExtractedSymbol]) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        kind: SymbolKind = "variable" if node.type == "static_item" else "constant"
        symbols.append(ExtractedSymbol(
            name=name, kind=kind, file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=get_node_text(node, source).split("\n")[0].strip()[:200],
            is_exported=self._extract_visibility(node, source) in ("pub", "pub_crate"),
            parent_name=parent_name,
            modifiers=["static"] if node.type == "static_item" else ["const"],
        ))

    def _extract_use_declarations(self, root: SyntaxNode, source: str, file_path: str,
                                  relationships: list[ExtractedRelationship]) -> None:
        for decl in find_nodes(root, "use_declaration"):
            is_public = any(c.type == "visibility_modifier" for c in decl.children)
            argument = decl.child_by_field_name("argument")
            if not argument:
                continue
            for use_path in self._expand_use_path(argument, source, ""):
                relationships.append(ExtractedRelationship(
                    source_symbol=file_path, target_symbol=use_path["full_path"],
                    kind="imports", file_path=file_path, line=decl.start_point[0] + 1,
                    metadata={"alias": use_path["alias"], "pub_use": is_public,
                              "glob": use_path["glob"]},
                ))

    def _expand_use_path(self, node: SyntaxNode, source: str, prefix: str) -> list[dict]:
        text = get_node_text(node, source)
        if node.type in ("scoped_identifier", "identifier", "crate", "self", "super"):
            return [{"full_path": prefix + text, "alias": None, "glob": False}]
        if node.type == "use_as_clause":
            path_node = node.child_by_field_name("path")
            alias_node = node.child_by_field_name("alias")
            path = get_node_text(path_node, source) if path_node else text
            alias = get_node_text(alias_node, source) if alias_node else None
            return [{"full_path": prefix + path, "alias": alias, "glob": False}]
        if node.type == "use_wildcard":
            return [{"full_path": prefix + "*", "alias": None, "glob": True}]
        if node.type == "use_list":
            results = []
            for child in node.named_children:
                results.extend(self._expand_use_path(child, source, prefix))
            return results
        if node.type == "scoped_use_list":
            scope_path = node.child_by_field_name("path")
            list_node = node.child_by_field_name("list")
            new_prefix = f"{prefix}{get_node_text(scope_path, source)}::" if scope_path else prefix
            if list_node:
                return self._expand_use_path(list_node, source, new_prefix)
            return [{"full_path": new_prefix.rstrip("::"), "alias": None, "glob": False}]
        return [{"full_path": prefix + text, "alias": None, "glob": False}]

    def _extract_calls(self, body: SyntaxNode, source: str, file_path: str,
                       caller_name: str, relationships: list[ExtractedRelationship]) -> None:
        seen: set[str] = set()
        for call in find_nodes(body, "call_expression"):
            func_node = call.child_by_field_name("function")
            if not func_node:
                continue
            target = get_node_text(func_node, source).strip()
            key = f"{caller_name}->{target}"
            if key in seen:
                continue
            seen.add(key)
            relationships.append(ExtractedRelationship(
                source_symbol=caller_name, target_symbol=target, kind="calls",
                file_path=file_path, line=call.start_point[0] + 1,
            ))
        for macro_inv in find_nodes(body, "macro_invocation"):
            macro_node = macro_inv.child_by_field_name("macro")
            if not macro_node:
                continue
            macro_name = get_node_text(macro_node, source).rstrip("!")
            key = f"{caller_name}->{macro_name}!"
            if key in seen:
                continue
            seen.add(key)
            relationships.append(ExtractedRelationship(
                source_symbol=caller_name, target_symbol=macro_name, kind="calls",
                file_path=file_path, line=macro_inv.start_point[0] + 1,
                metadata={"macro": True},
            ))

    def _extract_derives(self, node: SyntaxNode, source: str, symbol_name: str,
                         file_path: str, line: int) -> list[ExtractedRelationship]:
        rels: list[ExtractedRelationship] = []
        prev = node.prev_named_sibling
        while prev and prev.type == "attribute_item":
            attr_text = get_node_text(prev, source)
            match = re.search(r"derive\(([^)]+)\)", attr_text)
            if match:
                for trait in match.group(1).split(","):
                    trait = trait.strip()
                    if trait:
                        rels.append(ExtractedRelationship(
                            source_symbol=symbol_name, target_symbol=trait,
                            kind="implements", file_path=file_path, line=line,
                            metadata={"derived": True},
                        ))
            prev = prev.prev_named_sibling
        return rels

    def _extract_visibility(self, node: SyntaxNode, source: str) -> str:
        for child in node.children:
            if child.type == "visibility_modifier":
                text = get_node_text(child, source)
                if text == "pub":
                    return "pub"
                if "crate" in text:
                    return "pub_crate"
                return "pub"
        return "private"

    def _extract_func_modifiers(self, node: SyntaxNode, source: str) -> list[str]:
        modifiers: list[str] = []
        header = get_node_text(node, source).split("{")[0]
        if "async " in header:
            modifiers.append("async")
        if "unsafe " in header:
            modifiers.append("unsafe")
        if "const " in header:
            modifiers.append("const")
        return modifiers

    def _extract_return_type(self, node: SyntaxNode, source: str) -> str:
        rt_node = node.child_by_field_name("return_type")
        if not rt_node:
            return ""
        return get_node_text(rt_node, source).lstrip("-> ").strip()

    def _field_text(self, node: SyntaxNode, field: str, source: str) -> str:
        child = node.child_by_field_name(field)
        return get_node_text(child, source) if child else ""


# Module-level alias for dynamic loading
Parser = RustParser

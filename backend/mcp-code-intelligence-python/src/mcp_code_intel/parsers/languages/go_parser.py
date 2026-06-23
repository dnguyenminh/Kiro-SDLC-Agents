"""
KSA-178: Go Language Parser.
Port of mcp-code-intelligence-nodejs/src/parsers/languages/go-parser.ts.
"""

from __future__ import annotations

from tree_sitter import Parser as TSParser

from ..types import ExtractedRelationship, ExtractedSymbol, ParseResult, SymbolKind
from ..ast_utils import (
    find_nodes, get_node_text, get_node_range, get_named_child,
    walk_tree, extract_doc_comment, calculate_complexity, SyntaxNode,
)
from .base_parser import BaseLanguageParser


class GoParser(BaseLanguageParser):
    """Extracts symbols and relationships from Go AST."""

    def get_supported_extensions(self) -> list[str]:
        return [".go"]

    def parse(self, source: str, file_path: str) -> ParseResult:
        if self._is_generated(source, file_path):
            return ParseResult()
        root = self._parse_tree(source)
        symbols: list[ExtractedSymbol] = []
        relationships: list[ExtractedRelationship] = []
        errors = self._collect_errors(root)

        self._extract_declarations(root, source, file_path, symbols, relationships)
        self._extract_imports(root, source, file_path, relationships)
        return ParseResult(symbols=symbols, relationships=relationships, errors=errors)

    def _is_generated(self, source: str, file_path: str) -> bool:
        if file_path.endswith("_generated.go"):
            return True
        return "// Code generated" in "\n".join(source.split("\n")[:3])

    def _extract_declarations(self, root: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship]) -> None:
        for child in root.named_children:
            if child.type == "function_declaration":
                self._extract_function(child, source, file_path, symbols, relationships)
            elif child.type == "method_declaration":
                self._extract_method(child, source, file_path, symbols, relationships)
            elif child.type == "type_declaration":
                for spec in find_nodes(child, "type_spec"):
                    self._extract_type_spec(spec, source, file_path, symbols)
            elif child.type in ("const_declaration", "var_declaration"):
                self._extract_var_const(child, source, file_path, symbols)

    def _extract_function(self, node: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship]) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        params = self._get_field_text(node, "parameters", source)
        return_type = self._get_field_text(node, "result", source)
        doc_comment = extract_doc_comment(node, source)

        symbols.append(ExtractedSymbol(
            name=name, kind="function", file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=f"func {name}{params}{' ' + return_type if return_type else ''}".strip()[:500],
            parameters=params or None, return_type=return_type or None,
            is_exported=self._is_exported(name), doc_comment=doc_comment,
            complexity=calculate_complexity(node),
        ))

        body = node.child_by_field_name("body")
        if body:
            self._extract_calls(body, source, file_path, name, relationships)

    def _extract_method(self, node: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship]) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        receiver_info = self._extract_receiver(node, source)
        params = self._get_field_text(node, "parameters", source)
        return_type = self._get_field_text(node, "result", source)
        doc_comment = extract_doc_comment(node, source)

        recv_text = f"({receiver_info['text']}) " if receiver_info["text"] else ""
        symbols.append(ExtractedSymbol(
            name=name, kind="method", file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=f"func {recv_text}{name}{params}{' ' + return_type if return_type else ''}".strip()[:500],
            parameters=params or None, return_type=return_type or None,
            parent_name=receiver_info["type_name"],
            is_exported=self._is_exported(name), doc_comment=doc_comment,
            modifiers=["pointer_receiver"] if receiver_info["is_pointer"] else ["value_receiver"],
            complexity=calculate_complexity(node),
        ))

        relationships.append(ExtractedRelationship(
            source_symbol=receiver_info["type_name"], target_symbol=name,
            kind="uses", file_path=file_path, line=start_line,
            metadata={"relationship": "has_method", "pointer_receiver": receiver_info["is_pointer"]},
        ))

        body = node.child_by_field_name("body")
        if body:
            self._extract_calls(body, source, file_path, f"{receiver_info['type_name']}.{name}", relationships)

    def _extract_type_spec(self, node: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol]) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        type_node = node.child_by_field_name("type")
        if not type_node:
            return
        start_line, end_line = get_node_range(node)
        doc_comment = extract_doc_comment(node, source)

        if type_node.type == "struct_type":
            kind: SymbolKind = "struct"
            sig = f"type {name} struct"
        elif type_node.type == "interface_type":
            kind = "interface"
            sig = f"type {name} interface"
        else:
            kind = "type"
            sig = f"type {name} {get_node_text(type_node, source).split(chr(10))[0][:100]}"

        symbols.append(ExtractedSymbol(
            name=name, kind=kind, file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=sig, is_exported=self._is_exported(name), doc_comment=doc_comment,
        ))

    def _extract_var_const(self, node: SyntaxNode, source: str, file_path: str, symbols: list[ExtractedSymbol]) -> None:
        spec_type = "const_spec" if node.type == "const_declaration" else "var_spec"
        for spec in find_nodes(node, spec_type):
            name_node = spec.child_by_field_name("name")
            if not name_node:
                continue
            name = get_node_text(name_node, source)
            start_line, end_line = get_node_range(spec)
            symbols.append(ExtractedSymbol(
                name=name,
                kind="constant" if node.type == "const_declaration" else "variable",
                file_path=file_path, start_line=start_line, end_line=end_line,
                signature=get_node_text(spec, source).split("\n")[0].strip()[:200],
                is_exported=self._is_exported(name),
            ))

    def _extract_imports(self, root: SyntaxNode, source: str, file_path: str, relationships: list[ExtractedRelationship]) -> None:
        for decl in find_nodes(root, "import_declaration"):
            for spec in find_nodes(decl, "import_spec"):
                path_node = spec.child_by_field_name("path")
                if not path_node:
                    continue
                import_path = get_node_text(path_node, source).strip('"')
                alias_node = spec.child_by_field_name("name")
                alias = get_node_text(alias_node, source) if alias_node else None
                relationships.append(ExtractedRelationship(
                    source_symbol=file_path, target_symbol=import_path,
                    kind="imports", file_path=file_path, line=spec.start_point[0] + 1,
                    metadata={"alias": alias, "module": import_path},
                ))

    def _extract_calls(self, body: SyntaxNode, source: str, file_path: str, caller_name: str, relationships: list[ExtractedRelationship]) -> None:
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

            metadata = {}
            if self._is_inside_node_type(call, "go_statement"):
                metadata["async"] = True
            if self._is_inside_node_type(call, "defer_statement"):
                metadata["deferred"] = True

            relationships.append(ExtractedRelationship(
                source_symbol=caller_name, target_symbol=target, kind="calls",
                file_path=file_path, line=call.start_point[0] + 1,
                metadata=metadata if metadata else None,
            ))

    def _is_inside_node_type(self, node: SyntaxNode, node_type: str) -> bool:
        current = node.parent
        while current:
            if current.type == node_type:
                return True
            if current.type in ("function_declaration", "method_declaration"):
                break
            current = current.parent
        return False

    def _extract_receiver(self, node: SyntaxNode, source: str) -> dict:
        receiver_node = node.child_by_field_name("receiver")
        if not receiver_node:
            return {"text": "", "type_name": "", "is_pointer": False}
        params = receiver_node.named_children
        if not params:
            return {"text": get_node_text(receiver_node, source), "type_name": "", "is_pointer": False}
        param_decl = params[0]
        type_node = param_decl.child_by_field_name("type")
        if not type_node:
            last_child = param_decl.named_children[-1] if param_decl.named_children else None
            if last_child:
                is_pointer = last_child.type == "pointer_type"
                type_name = get_node_text(last_child.named_children[0], source) if is_pointer and last_child.named_children else get_node_text(last_child, source)
                return {"text": get_node_text(param_decl, source), "type_name": type_name, "is_pointer": is_pointer}
            return {"text": get_node_text(param_decl, source), "type_name": "", "is_pointer": False}

        is_pointer = type_node.type == "pointer_type"
        type_name = get_node_text(type_node.named_children[0], source) if is_pointer and type_node.named_children else get_node_text(type_node, source)
        return {"text": get_node_text(param_decl, source), "type_name": type_name, "is_pointer": is_pointer}

    def _get_field_text(self, node: SyntaxNode, field: str, source: str) -> str:
        child = node.child_by_field_name(field)
        return get_node_text(child, source).strip() if child else ""

    def _is_exported(self, name: str) -> bool:
        return bool(name) and name[0].isupper()


# Module-level alias for dynamic loading
Parser = GoParser

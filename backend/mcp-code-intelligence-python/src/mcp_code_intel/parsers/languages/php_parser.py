"""KSA-178: PHP Language Parser."""
from __future__ import annotations
from ..types import ExtractedRelationship, ExtractedSymbol, ParseResult, SymbolKind
from ..ast_utils import find_nodes, get_node_text, get_node_range, get_named_child, calculate_complexity, SyntaxNode
from .base_parser import BaseLanguageParser

class PhpParser(BaseLanguageParser):
    def get_supported_extensions(self) -> list[str]:
        return [".php"]

    def parse(self, source: str, file_path: str) -> ParseResult:
        root = self._parse_tree(source)
        symbols: list[ExtractedSymbol] = []
        relationships: list[ExtractedRelationship] = []
        errors = self._collect_errors(root)
        self._extract(root, source, file_path, None, symbols, relationships)
        return ParseResult(symbols=symbols, relationships=relationships, errors=errors)

    def _extract(self, node, source, fp, parent, symbols, rels):
        for child in node.named_children:
            t = child.type
            if t == "function_definition":
                nm = get_named_child(child, "name")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    pn = get_named_child(child, "formal_parameters")
                    params = get_node_text(pn, source) if pn else "()"
                    symbols.append(ExtractedSymbol(name=name, kind="method" if parent else "function", file_path=fp, start_line=sl, end_line=el, signature=f"function {name}{params}", parameters=params, parent_name=parent, is_exported=True, complexity=calculate_complexity(child)))
            elif t == "method_declaration":
                nm = get_named_child(child, "name")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    pn = get_named_child(child, "formal_parameters")
                    params = get_node_text(pn, source) if pn else "()"
                    symbols.append(ExtractedSymbol(name=name, kind="constructor" if name == "__construct" else "method", file_path=fp, start_line=sl, end_line=el, signature=f"function {name}{params}", parameters=params, parent_name=parent, is_exported=True, complexity=calculate_complexity(child)))
            elif t == "class_declaration":
                nm = get_named_child(child, "name")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    symbols.append(ExtractedSymbol(name=name, kind="class", file_path=fp, start_line=sl, end_line=el, signature=f"class {name}", parent_name=parent, is_exported=True))
                    body = get_named_child(child, "declaration_list")
                    if body: self._extract(body, source, fp, name, symbols, rels)
            elif t == "interface_declaration":
                nm = get_named_child(child, "name")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    symbols.append(ExtractedSymbol(name=name, kind="interface", file_path=fp, start_line=sl, end_line=el, signature=f"interface {name}", parent_name=parent, is_exported=True))
                    body = get_named_child(child, "declaration_list")
                    if body: self._extract(body, source, fp, name, symbols, rels)
            elif t == "trait_declaration":
                nm = get_named_child(child, "name")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    symbols.append(ExtractedSymbol(name=name, kind="trait", file_path=fp, start_line=sl, end_line=el, signature=f"trait {name}", parent_name=parent, is_exported=True))
                    body = get_named_child(child, "declaration_list")
                    if body: self._extract(body, source, fp, name, symbols, rels)
            elif t == "namespace_definition":
                nm = get_named_child(child, "name")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    symbols.append(ExtractedSymbol(name=name, kind="namespace", file_path=fp, start_line=sl, end_line=el, signature=f"namespace {name}", is_exported=True))

Parser = PhpParser

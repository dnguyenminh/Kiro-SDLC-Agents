"""KSA-178: Ruby Language Parser."""
from __future__ import annotations
from ..types import ExtractedRelationship, ExtractedSymbol, ParseResult, SymbolKind
from ..ast_utils import find_nodes, get_node_text, get_node_range, get_named_child, calculate_complexity, SyntaxNode
from .base_parser import BaseLanguageParser

class RubyParser(BaseLanguageParser):
    def get_supported_extensions(self) -> list[str]:
        return [".rb", ".rake", ".gemspec"]

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
            if t == "method":
                nm = get_named_child(child, "identifier")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    pn = get_named_child(child, "method_parameters")
                    params = get_node_text(pn, source) if pn else ""
                    symbols.append(ExtractedSymbol(name=name, kind="method" if parent else "function", file_path=fp, start_line=sl, end_line=el, signature=f"def {name}{params}", parameters=params or None, parent_name=parent, is_exported=not name.startswith("_"), complexity=calculate_complexity(child)))
            elif t == "class":
                nm = get_named_child(child, "constant") or get_named_child(child, "scope_resolution")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    sc = get_named_child(child, "superclass")
                    if sc:
                        base = get_node_text(sc, source).lstrip("< ").strip()
                        rels.append(ExtractedRelationship(source_symbol=name, target_symbol=base, kind="inherits", file_path=fp, line=sc.start_point[0]+1))
                    symbols.append(ExtractedSymbol(name=name, kind="class", file_path=fp, start_line=sl, end_line=el, signature=f"class {name}", parent_name=parent, is_exported=True))
                    body = get_named_child(child, "body_statement")
                    if body: self._extract(body, source, fp, name, symbols, rels)
            elif t == "module":
                nm = get_named_child(child, "constant")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    symbols.append(ExtractedSymbol(name=name, kind="module", file_path=fp, start_line=sl, end_line=el, signature=f"module {name}", parent_name=parent, is_exported=True))
                    body = get_named_child(child, "body_statement")
                    if body: self._extract(body, source, fp, name, symbols, rels)

Parser = RubyParser

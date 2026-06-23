"""KSA-178: Scala Language Parser."""
from __future__ import annotations
from ..types import ExtractedRelationship, ExtractedSymbol, ParseResult
from ..ast_utils import find_nodes, get_node_text, get_node_range, get_named_child, calculate_complexity, SyntaxNode
from .base_parser import BaseLanguageParser

class ScalaParser(BaseLanguageParser):
    def get_supported_extensions(self) -> list[str]:
        return [".scala", ".sc"]

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
                nm = get_named_child(child, "name") or get_named_child(child, "identifier")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    symbols.append(ExtractedSymbol(name=name, kind="method" if parent else "function", file_path=fp, start_line=sl, end_line=el, signature=f"def {name}", parent_name=parent, is_exported=True, complexity=calculate_complexity(child)))
            elif t == "class_definition":
                nm = get_named_child(child, "name") or get_named_child(child, "identifier")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    symbols.append(ExtractedSymbol(name=name, kind="class", file_path=fp, start_line=sl, end_line=el, signature=f"class {name}", parent_name=parent, is_exported=True))
                    body = get_named_child(child, "template_body")
                    if body: self._extract(body, source, fp, name, symbols, rels)
            elif t == "object_definition":
                nm = get_named_child(child, "name") or get_named_child(child, "identifier")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    symbols.append(ExtractedSymbol(name=name, kind="class", file_path=fp, start_line=sl, end_line=el, signature=f"object {name}", modifiers=["object"], parent_name=parent, is_exported=True))
                    body = get_named_child(child, "template_body")
                    if body: self._extract(body, source, fp, name, symbols, rels)
            elif t == "trait_definition":
                nm = get_named_child(child, "name") or get_named_child(child, "identifier")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    symbols.append(ExtractedSymbol(name=name, kind="trait", file_path=fp, start_line=sl, end_line=el, signature=f"trait {name}", parent_name=parent, is_exported=True))
                    body = get_named_child(child, "template_body")
                    if body: self._extract(body, source, fp, name, symbols, rels)
            elif t in ("val_definition", "var_definition"):
                nm = get_named_child(child, "identifier")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    symbols.append(ExtractedSymbol(name=name, kind="property", file_path=fp, start_line=sl, end_line=el, signature=get_node_text(child, source).split(chr(10))[0][:200], parent_name=parent, is_exported=True))
            elif t == "import_declaration":
                text = get_node_text(child, source).replace("import", "").strip()
                rels.append(ExtractedRelationship(source_symbol="__file__", target_symbol=text, kind="imports", file_path=fp, line=child.start_point[0]+1))
            elif t == "package_clause":
                text = get_node_text(child, source).replace("package", "").strip()
                sl, el = get_node_range(child)
                symbols.append(ExtractedSymbol(name=text, kind="namespace", file_path=fp, start_line=sl, end_line=el, signature=f"package {text}", is_exported=True))

Parser = ScalaParser

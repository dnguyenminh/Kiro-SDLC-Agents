"""KSA-178: C# Language Parser."""
from __future__ import annotations
from tree_sitter import Parser as TSParser
from ..types import ExtractedRelationship, ExtractedSymbol, ParseResult, SymbolKind
from ..ast_utils import find_nodes, find_first, get_node_text, get_node_range, get_named_child, walk_tree, extract_doc_comment, calculate_complexity, SyntaxNode
from .base_parser import BaseLanguageParser

class CSharpParser(BaseLanguageParser):
    def get_supported_extensions(self) -> list[str]:
        return [".cs"]

    def parse(self, source: str, file_path: str) -> ParseResult:
        root = self._parse_tree(source)
        symbols: list[ExtractedSymbol] = []
        relationships: list[ExtractedRelationship] = []
        errors = self._collect_errors(root)
        self._extract_usings(root, source, file_path, relationships)
        self._extract_declarations(root, source, file_path, None, symbols, relationships)
        return ParseResult(symbols=symbols, relationships=relationships, errors=errors)

    def _extract_usings(self, root, source, file_path, relationships):
        for using in find_nodes(root, "using_directive"):
            text = get_node_text(using, source).replace("using", "").replace(";", "").strip()
            if text.startswith("static "):
                text = text[7:]
            relationships.append(ExtractedRelationship(source_symbol="__file__", target_symbol=text, kind="imports", file_path=file_path, line=using.start_point[0]+1))

    def _extract_declarations(self, node, source, file_path, parent_name, symbols, relationships, depth=0):
        if depth > 10: return
        for child in node.named_children:
            t = child.type
            if t == "namespace_declaration":
                nm = get_named_child(child, "identifier") or get_named_child(child, "qualified_name")
                if nm:
                    name = get_node_text(nm, source)
                    sl, el = get_node_range(child)
                    symbols.append(ExtractedSymbol(name=name, kind="namespace", file_path=file_path, start_line=sl, end_line=el, signature=f"namespace {name}", is_exported=True))
                    body = get_named_child(child, "declaration_list")
                    if body: self._extract_declarations(body, source, file_path, name, symbols, relationships, depth+1)
            elif t in ("class_declaration", "interface_declaration", "struct_declaration", "enum_declaration", "record_declaration"):
                kind_map = {"class_declaration":"class","interface_declaration":"interface","struct_declaration":"struct","enum_declaration":"enum","record_declaration":"class"}
                self._extract_type(child, source, file_path, parent_name, kind_map.get(t,"class"), symbols, relationships, depth)

    def _extract_type(self, node, source, file_path, parent_name, kind, symbols, relationships, depth):
        nm = get_named_child(node, "identifier")
        if not nm: return
        name = get_node_text(nm, source)
        sl, el = get_node_range(node)
        mods = self._mods(node, source)
        symbols.append(ExtractedSymbol(name=name, kind=kind, file_path=file_path, start_line=sl, end_line=el, signature=f"{' '.join(mods)} {kind} {name}".strip()[:500], modifiers=mods or None, parent_name=parent_name, is_exported="public" in mods, doc_comment=extract_doc_comment(node, source)))
        base_list = get_named_child(node, "base_list")
        if base_list:
            for bt in base_list.named_children:
                bn = get_node_text(bt, source).split("<")[0].strip()
                if bn: relationships.append(ExtractedRelationship(source_symbol=name, target_symbol=bn, kind="inherits" if kind=="class" else "implements", file_path=file_path, line=bt.start_point[0]+1))
        body = get_named_child(node, "declaration_list")
        if body:
            for member in body.named_children:
                if member.type == "method_declaration":
                    mnm = get_named_child(member, "identifier")
                    if mnm:
                        mname = get_node_text(mnm, source)
                        msl, mel = get_node_range(member)
                        mmods = self._mods(member, source)
                        pn = get_named_child(member, "parameter_list")
                        params = get_node_text(pn, source) if pn else "()"
                        symbols.append(ExtractedSymbol(name=mname, kind="method", file_path=file_path, start_line=msl, end_line=mel, signature=f"{' '.join(mmods)} {mname}{params}".strip()[:500], parameters=params, modifiers=mmods or None, parent_name=name, is_exported="public" in mmods, is_async="async" in mmods, complexity=calculate_complexity(member)))
                elif member.type == "constructor_declaration":
                    msl, mel = get_node_range(member)
                    pn = get_named_child(member, "parameter_list")
                    params = get_node_text(pn, source) if pn else "()"
                    symbols.append(ExtractedSymbol(name="constructor", kind="constructor", file_path=file_path, start_line=msl, end_line=mel, signature=f"{name}{params}", parameters=params, parent_name=name))
                elif member.type == "property_declaration":
                    pnm = get_named_child(member, "identifier")
                    if pnm:
                        pname = get_node_text(pnm, source)
                        psl, pel = get_node_range(member)
                        symbols.append(ExtractedSymbol(name=pname, kind="property", file_path=file_path, start_line=psl, end_line=pel, signature=get_node_text(member, source).split("\n")[0].strip()[:200], parent_name=name))
                elif member.type in ("class_declaration","interface_declaration","struct_declaration","enum_declaration"):
                    km = {"class_declaration":"class","interface_declaration":"interface","struct_declaration":"struct","enum_declaration":"enum"}
                    self._extract_type(member, source, file_path, name, km.get(member.type,"class"), symbols, relationships, depth+1)

    def _mods(self, node, source):
        mods = []
        valid = {"public","private","protected","internal","static","abstract","virtual","override","sealed","readonly","async","partial","const","new"}
        for c in node.children:
            if c.type == "modifier":
                t = get_node_text(c, source)
                if t in valid: mods.append(t)
        return mods

Parser = CSharpParser

"""
KSA-191: Apex Language Parser.
Extracts symbols and relationships from Salesforce Apex (.cls, .trigger) files.
Uses tree-sitter-apex grammar for AST parsing.
Mirrors java_parser.py structure — follows existing patterns exactly.
"""

from __future__ import annotations

import re
from tree_sitter import Parser as TSParser

from ..types import (
    ExtractedRelationship, ExtractedSymbol, ParseResult, SymbolKind,
)
from ..ast_utils import (
    find_nodes, find_first, get_node_text, get_node_range, get_named_child,
    walk_tree, extract_doc_comment, calculate_complexity, SyntaxNode,
)
from .base_parser import BaseLanguageParser


class ApexParser(BaseLanguageParser):
    """Extracts symbols and relationships from Apex AST (classes, triggers, DML, SOQL)."""

    def get_supported_extensions(self) -> list[str]:
        return [".cls", ".trigger"]

    def parse(self, source: str, file_path: str) -> ParseResult:
        root = self._parse_tree(source)
        symbols: list[ExtractedSymbol] = []
        relationships: list[ExtractedRelationship] = []
        errors = self._collect_errors(root)

        # Detect if trigger file
        if file_path.endswith(".trigger"):
            self._extract_trigger(root, source, file_path, symbols, relationships)
        else:
            self._extract_declarations(root, source, file_path, None, symbols, relationships)

        return ParseResult(symbols=symbols, relationships=relationships, errors=errors)

    # --- Top-level extraction ---

    def _extract_declarations(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, symbols: list[ExtractedSymbol],
        relationships: list[ExtractedRelationship], depth: int = 0,
    ) -> None:
        """Extract top-level class/interface/enum declarations."""
        if depth > 10:
            return
        for child in node.named_children:
            if child.type == "class_declaration":
                self._extract_type(child, source, file_path, parent_name, "class", symbols, relationships, depth)
            elif child.type == "interface_declaration":
                self._extract_type(child, source, file_path, parent_name, "interface", symbols, relationships, depth)
            elif child.type == "enum_declaration":
                self._extract_type(child, source, file_path, parent_name, "enum", symbols, relationships, depth)

    def _extract_type(
        self, node: SyntaxNode, source: str, file_path: str,
        parent_name: str | None, default_kind: SymbolKind,
        symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship],
        depth: int,
    ) -> None:
        """Extract a single type declaration (class/interface/enum)."""
        name_node = get_named_child(node, "identifier")
        if not name_node:
            return
        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(node)
        doc_comment = extract_doc_comment(node, source)
        modifiers = self._extract_modifiers(node, source)
        annotations = self._extract_annotations(node, source)
        is_exported = "public" in modifiers or "global" in modifiers

        # Inheritance
        self._extract_inheritance(node, source, file_path, name, relationships)

        # Build signature
        mod_str = " ".join(modifiers) if modifiers else ""
        signature = f"{mod_str} {default_kind} {name}".strip()

        symbols.append(ExtractedSymbol(
            name=name, kind=default_kind, file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=signature[:500], modifiers=modifiers if modifiers else None,
            decorators=annotations if annotations else None,
            parent_name=parent_name, is_exported=is_exported, doc_comment=doc_comment,
        ))

        # Extract body members
        body = (
            get_named_child(node, "class_body")
            or get_named_child(node, "interface_body")
            or get_named_child(node, "enum_body")
        )
        if body:
            self._extract_members(body, source, file_path, name, symbols, relationships, depth)

    def _extract_members(
        self, body: SyntaxNode, source: str, file_path: str,
        class_name: str, symbols: list[ExtractedSymbol],
        relationships: list[ExtractedRelationship], depth: int,
    ) -> None:
        """Extract class body members (methods, fields, constructors, inner types)."""
        for member in body.named_children:
            if member.type == "method_declaration":
                self._extract_method(member, source, file_path, class_name, symbols, relationships)
            elif member.type == "constructor_declaration":
                self._extract_constructor(member, source, file_path, class_name, symbols, relationships)
            elif member.type == "field_declaration":
                self._extract_fields(member, source, file_path, class_name, symbols)
            elif member.type in ("class_declaration", "interface_declaration", "enum_declaration"):
                kind_map = {
                    "class_declaration": "class",
                    "interface_declaration": "interface",
                    "enum_declaration": "enum",
                }
                self._extract_type(
                    member, source, file_path, class_name,
                    kind_map[member.type], symbols, relationships, depth + 1,
                )

    def _extract_method(
        self, node: SyntaxNode, source: str, file_path: str,
        class_name: str, symbols: list[ExtractedSymbol],
        relationships: list[ExtractedRelationship],
    ) -> None:
        """Extract a method declaration with calls, DML, and SOQL."""
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
        complexity = self._calc_apex_complexity(body) if body else 1

        symbols.append(ExtractedSymbol(
            name=name, kind="method", file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=self._build_method_sig(modifiers, return_type, name, params),
            parameters=params, return_type=return_type,
            modifiers=modifiers if modifiers else None,
            decorators=annotations if annotations else None,
            parent_name=class_name, is_exported="public" in modifiers or "global" in modifiers,
            doc_comment=doc_comment, complexity=complexity,
        ))

        caller = f"{class_name}.{name}"
        if body:
            self._extract_calls(body, source, file_path, caller, relationships)
            self._extract_dml(body, source, file_path, caller, relationships)
            self._extract_soql(body, source, file_path, caller, relationships)

    def _extract_constructor(
        self, node: SyntaxNode, source: str, file_path: str,
        class_name: str, symbols: list[ExtractedSymbol],
        relationships: list[ExtractedRelationship],
    ) -> None:
        """Extract constructor declaration."""
        name_node = get_named_child(node, "identifier")
        name = get_node_text(name_node, source) if name_node else class_name
        start_line, end_line = get_node_range(node)
        modifiers = self._extract_modifiers(node, source)
        params_node = get_named_child(node, "formal_parameters")
        params = get_node_text(params_node, source) if params_node else "()"
        body = get_named_child(node, "constructor_body") or get_named_child(node, "block")
        complexity = self._calc_apex_complexity(body) if body else 1

        symbols.append(ExtractedSymbol(
            name="constructor", kind="constructor", file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=f"{' '.join(modifiers)} {name}{params}".strip(),
            parameters=params, modifiers=modifiers if modifiers else None,
            parent_name=class_name, is_exported="public" in modifiers or "global" in modifiers,
            complexity=complexity,
        ))

        caller = f"{class_name}.constructor"
        if body:
            self._extract_calls(body, source, file_path, caller, relationships)
            self._extract_dml(body, source, file_path, caller, relationships)
            self._extract_soql(body, source, file_path, caller, relationships)

    def _extract_fields(
        self, node: SyntaxNode, source: str, file_path: str,
        class_name: str, symbols: list[ExtractedSymbol],
    ) -> None:
        """Extract field declarations."""
        start_line, end_line = get_node_range(node)
        modifiers = self._extract_modifiers(node, source)
        type_text = self._get_field_type(node, source)
        for decl in find_nodes(node, "variable_declarator"):
            name_node = get_named_child(decl, "identifier")
            if not name_node:
                continue
            name = get_node_text(name_node, source)
            is_constant = (
                "static" in modifiers and "final" in modifiers
                and bool(re.match(r"^[A-Z_][A-Z0-9_]*$", name))
            )
            symbols.append(ExtractedSymbol(
                name=name, kind="constant" if is_constant else "property",
                file_path=file_path, start_line=start_line, end_line=end_line,
                signature=f"{' '.join(modifiers)} {type_text} {name}".strip()[:200],
                return_type=type_text, modifiers=modifiers if modifiers else None,
                parent_name=class_name,
                is_exported="public" in modifiers or "global" in modifiers,
            ))

    # --- Trigger extraction ---

    def _extract_trigger(
        self, root: SyntaxNode, source: str, file_path: str,
        symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship],
    ) -> None:
        """Extract trigger declaration with trigger-on relationship."""
        trigger_nodes = find_nodes(root, "trigger_declaration")
        if not trigger_nodes:
            # Fallback: try regex-based extraction for triggers
            self._extract_trigger_regex(source, file_path, symbols, relationships)
            return

        trigger_node = trigger_nodes[0]
        name_node = get_named_child(trigger_node, "identifier")
        if not name_node:
            return

        name = get_node_text(name_node, source)
        start_line, end_line = get_node_range(trigger_node)

        # Extract SObject name (second identifier after "on")
        sobject = self._extract_trigger_sobject(trigger_node, source)
        events = self._extract_trigger_events(trigger_node, source)

        symbols.append(ExtractedSymbol(
            name=name, kind="class", file_path=file_path,
            start_line=start_line, end_line=end_line,
            signature=f"trigger {name} on {sobject} ({', '.join(events)})",
            modifiers=["trigger"], is_exported=True,
        ))

        # trigger-on relationship
        relationships.append(ExtractedRelationship(
            source_symbol=name, target_symbol=sobject,
            kind="trigger-on", file_path=file_path,
            line=start_line, metadata={"events": events},
        ))

        # Extract body for calls/DML/SOQL
        body = (
            get_named_child(trigger_node, "trigger_body")
            or get_named_child(trigger_node, "block")
        )
        if body:
            self._extract_calls(body, source, file_path, name, relationships)
            self._extract_dml(body, source, file_path, name, relationships)
            self._extract_soql(body, source, file_path, name, relationships)

    def _extract_trigger_regex(
        self, source: str, file_path: str,
        symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship],
    ) -> None:
        """Regex fallback for trigger extraction when tree-sitter doesn't parse trigger_declaration."""
        match = re.match(
            r"\s*trigger\s+(\w+)\s+on\s+(\w+)\s*\(([^)]*)\)",
            source, re.IGNORECASE,
        )
        if not match:
            return
        name = match.group(1)
        sobject = match.group(2)
        events_str = match.group(3)
        events = [e.strip() for e in events_str.split(",") if e.strip()]
        line_count = source.count("\n") + 1

        symbols.append(ExtractedSymbol(
            name=name, kind="class", file_path=file_path,
            start_line=1, end_line=line_count,
            signature=f"trigger {name} on {sobject} ({', '.join(events)})",
            modifiers=["trigger"], is_exported=True,
        ))

        relationships.append(ExtractedRelationship(
            source_symbol=name, target_symbol=sobject,
            kind="trigger-on", file_path=file_path,
            line=1, metadata={"events": events},
        ))

    def _extract_trigger_sobject(self, trigger_node: SyntaxNode, source: str) -> str:
        """Extract the SObject name from a trigger declaration."""
        # Look for identifiers after the trigger name
        identifiers = [c for c in trigger_node.named_children if c.type == "identifier"]
        if len(identifiers) >= 2:
            return get_node_text(identifiers[1], source)
        # Fallback: regex on the trigger text
        text = get_node_text(trigger_node, source)
        match = re.search(r"\bon\s+(\w+)", text, re.IGNORECASE)
        return match.group(1) if match else "Unknown"

    def _extract_trigger_events(self, trigger_node: SyntaxNode, source: str) -> list[str]:
        """Extract trigger events (before insert, after update, etc.)."""
        text = get_node_text(trigger_node, source)
        # Match the events between parentheses after "on SObject"
        match = re.search(r"\bon\s+\w+\s*\(([^)]*)\)", text, re.IGNORECASE)
        if not match:
            return []
        events_str = match.group(1)
        return [e.strip() for e in events_str.split(",") if e.strip()]

    # --- Relationship extraction ---

    def _extract_inheritance(
        self, node: SyntaxNode, source: str, file_path: str,
        class_name: str, relationships: list[ExtractedRelationship],
    ) -> None:
        """Extract extends/implements relationships."""
        superclass = get_named_child(node, "superclass")
        if superclass:
            type_id = (
                get_named_child(superclass, "type_identifier")
                or get_named_child(superclass, "scoped_type_identifier")
                or get_named_child(superclass, "generic_type")
            )
            if type_id:
                base_name = get_node_text(type_id, source).split("<")[0].strip()
                relationships.append(ExtractedRelationship(
                    source_symbol=class_name, target_symbol=base_name,
                    kind="inherits", file_path=file_path,
                    line=type_id.start_point[0] + 1,
                ))

        interfaces = get_named_child(node, "super_interfaces") or get_named_child(node, "interfaces")
        if interfaces:
            type_list = get_named_child(interfaces, "type_list")
            if type_list:
                for type_node in type_list.named_children:
                    iface_name = get_node_text(type_node, source).split("<")[0].strip()
                    relationships.append(ExtractedRelationship(
                        source_symbol=class_name, target_symbol=iface_name,
                        kind="implements", file_path=file_path,
                        line=type_node.start_point[0] + 1,
                    ))

    def _extract_calls(
        self, body: SyntaxNode, source: str, file_path: str,
        caller_name: str, relationships: list[ExtractedRelationship],
    ) -> None:
        """Extract method invocations as 'calls' relationships."""
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
                source_symbol=caller_name, target_symbol=target,
                kind="calls", file_path=file_path,
                line=call.start_point[0] + 1,
            ))

        # Object creation expressions
        for creation in find_nodes(body, "object_creation_expression"):
            type_node = (
                get_named_child(creation, "type_identifier")
                or get_named_child(creation, "scoped_type_identifier")
                or get_named_child(creation, "generic_type")
            )
            if not type_node:
                continue
            type_name = get_node_text(type_node, source).split("<")[0].strip()
            target = f"{type_name}.constructor"
            key = f"{caller_name}->{target}"
            if key in seen:
                continue
            seen.add(key)
            relationships.append(ExtractedRelationship(
                source_symbol=caller_name, target_symbol=target,
                kind="calls", file_path=file_path,
                line=creation.start_point[0] + 1,
                metadata={"constructor": True},
            ))

    def _extract_dml(
        self, body: SyntaxNode, source: str, file_path: str,
        caller_name: str, relationships: list[ExtractedRelationship],
    ) -> None:
        """Extract DML operations (insert, update, delete, upsert, merge, undelete)."""
        dml_nodes = find_nodes(body, "dml_expression")
        for dml in dml_nodes:
            # DML type: first child is the operation keyword
            dml_type = dml.children[0] if dml.children else None
            if not dml_type:
                continue
            operation = get_node_text(dml_type, source).upper()

            # Target SObject — infer from variable type or expression
            target_expr = dml.children[1] if len(dml.children) > 1 else None
            if not target_expr:
                continue
            target_text = get_node_text(target_expr, source)
            sobject = self._infer_sobject_from_dml(target_text, source, body)

            relationships.append(ExtractedRelationship(
                source_symbol=caller_name, target_symbol=sobject or target_text,
                kind="dml", file_path=file_path,
                line=dml.start_point[0] + 1,
                metadata={"operation": operation},
            ))

        # Fallback: regex-based DML detection for cases tree-sitter misses
        if not dml_nodes:
            self._extract_dml_regex(body, source, file_path, caller_name, relationships)

    def _extract_dml_regex(
        self, body: SyntaxNode, source: str, file_path: str,
        caller_name: str, relationships: list[ExtractedRelationship],
    ) -> None:
        """Regex fallback for DML extraction."""
        body_text = get_node_text(body, source)
        dml_pattern = re.compile(
            r"\b(insert|update|delete|upsert|merge|undelete)\s+(\w+)",
            re.IGNORECASE,
        )
        seen: set[str] = set()
        for match in dml_pattern.finditer(body_text):
            operation = match.group(1).upper()
            target = match.group(2)
            key = f"{caller_name}->dml:{operation}:{target}"
            if key in seen:
                continue
            seen.add(key)
            # Calculate approximate line
            line_offset = body_text[:match.start()].count("\n")
            relationships.append(ExtractedRelationship(
                source_symbol=caller_name, target_symbol=target,
                kind="dml", file_path=file_path,
                line=body.start_point[0] + 1 + line_offset,
                metadata={"operation": operation},
            ))

    def _extract_soql(
        self, body: SyntaxNode, source: str, file_path: str,
        caller_name: str, relationships: list[ExtractedRelationship],
    ) -> None:
        """Extract SOQL queries as 'soql' relationships."""
        soql_nodes = find_nodes(body, "soql_expression")
        seen: set[str] = set()

        for soql in soql_nodes:
            soql_text = get_node_text(soql, source)
            from_match = re.search(r"\bFROM\s+(\w+)", soql_text, re.IGNORECASE)
            if not from_match:
                continue
            sobject = from_match.group(1)

            # Extract field list
            fields_match = re.search(r"\bSELECT\s+(.+?)\s+FROM\b", soql_text, re.IGNORECASE | re.DOTALL)
            fields = (
                [f.strip() for f in fields_match.group(1).split(",")]
                if fields_match else []
            )

            key = f"{caller_name}->soql:{sobject}"
            if key in seen:
                continue
            seen.add(key)

            relationships.append(ExtractedRelationship(
                source_symbol=caller_name, target_symbol=sobject,
                kind="soql", file_path=file_path,
                line=soql.start_point[0] + 1,
                metadata={"fields": fields},
            ))

        # Fallback: regex-based SOQL detection for inline queries
        if not soql_nodes:
            self._extract_soql_regex(body, source, file_path, caller_name, relationships, seen)

    def _extract_soql_regex(
        self, body: SyntaxNode, source: str, file_path: str,
        caller_name: str, relationships: list[ExtractedRelationship],
        seen: set[str],
    ) -> None:
        """Regex fallback for SOQL extraction (bracket notation [SELECT ...])."""
        body_text = get_node_text(body, source)
        soql_pattern = re.compile(
            r"\[\s*SELECT\s+(.+?)\s+FROM\s+(\w+)",
            re.IGNORECASE | re.DOTALL,
        )
        for match in soql_pattern.finditer(body_text):
            sobject = match.group(2)
            fields = [f.strip() for f in match.group(1).split(",")]
            key = f"{caller_name}->soql:{sobject}"
            if key in seen:
                continue
            seen.add(key)
            line_offset = body_text[:match.start()].count("\n")
            relationships.append(ExtractedRelationship(
                source_symbol=caller_name, target_symbol=sobject,
                kind="soql", file_path=file_path,
                line=body.start_point[0] + 1 + line_offset,
                metadata={"fields": fields},
            ))

    # --- Helpers ---

    def _extract_modifiers(self, node: SyntaxNode, source: str) -> list[str]:
        """Extract Apex modifiers including global, with sharing, etc."""
        modifiers: list[str] = []
        modifier_node = get_named_child(node, "modifiers")
        if not modifier_node:
            return modifiers
        valid_mods = {
            "public", "private", "protected", "global", "virtual", "abstract",
            "static", "final", "transient", "webservice",
            "with sharing", "without sharing", "inherited sharing",
            "override", "testmethod",
        }
        for child in modifier_node.children:
            if child.type in ("marker_annotation", "annotation"):
                continue
            text = get_node_text(child, source).lower().strip()
            if text in valid_mods:
                modifiers.append(text)
        return modifiers

    def _extract_annotations(self, node: SyntaxNode, source: str) -> list[str]:
        """Extract Apex annotations (@IsTest, @AuraEnabled, etc.)."""
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
        """Extract method return type."""
        type_types = {
            "type_identifier", "void_type", "integral_type",
            "floating_point_type", "boolean_type", "generic_type",
            "scoped_type_identifier", "array_type",
        }
        for child in node.children:
            if child.type in type_types:
                return get_node_text(child, source)
        return None

    def _get_field_type(self, node: SyntaxNode, source: str) -> str:
        """Extract field type."""
        type_types = {
            "type_identifier", "void_type", "integral_type",
            "floating_point_type", "boolean_type", "generic_type",
            "scoped_type_identifier", "array_type",
        }
        for child in node.children:
            if child.type in type_types:
                return get_node_text(child, source)
        return ""

    def _resolve_call_target(self, call_node: SyntaxNode, source: str) -> str | None:
        """Resolve method invocation target name."""
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

    def _infer_sobject_from_dml(self, target_text: str, source: str, body: SyntaxNode) -> str | None:
        """Heuristic: infer SObject name from DML target variable."""
        # Common patterns: accounts -> Account, newContacts -> Contact
        cleaned = re.sub(r"^(new|updated|existing|old)", "", target_text, flags=re.IGNORECASE)
        cleaned = re.sub(r"(List|s)$", "", cleaned)
        if cleaned:
            return cleaned[0].upper() + cleaned[1:]
        return target_text

    def _calc_apex_complexity(self, node: SyntaxNode) -> int:
        """Calculate cyclomatic complexity for Apex method body."""
        complexity = 1
        branch_types = {
            "if_statement", "for_statement", "enhanced_for_statement",
            "while_statement", "do_statement", "catch_clause",
            "ternary_expression", "switch_statement",
        }

        def _enter(n: SyntaxNode) -> None:
            nonlocal complexity
            if n.type in branch_types:
                complexity += 1
            if n.type in ("&&", "||"):
                complexity += 1

        walk_tree(node, enter=_enter)
        return complexity

    def _build_method_sig(self, modifiers: list[str], return_type: str | None, name: str, params: str) -> str:
        """Build method signature string."""
        mods = f"{' '.join(modifiers)} " if modifiers else ""
        ret = f"{return_type} " if return_type else ""
        return f"{mods}{ret}{name}{params}".strip()[:500]


# Module-level alias for dynamic loading
Parser = ApexParser

"""
KSA-191: Salesforce Metadata Parser.
Extracts symbols and relationships from Salesforce metadata XML files:
  - .flow-meta.xml (Flows)
  - .object-meta.xml (Custom Objects)
  - .field-meta.xml (Custom Fields)
  - .js-meta.xml (LWC metadata)
  - .component-meta.xml (Aura metadata)

Uses regex-based XML extraction (no tree-sitter — XML files).
Constructor receives None as parser since no WASM grammar is needed.
"""

from __future__ import annotations

import re
from typing import Any

from ..types import (
    ExtractedRelationship, ExtractedSymbol, ParseError, ParseResult,
)


class SalesforceMetaParser:
    """Extracts symbols and relationships from Salesforce metadata XML files."""

    def __init__(self, parser: Any, language_id: str) -> None:
        # parser is None — this parser doesn't use tree-sitter
        self._language_id = language_id

    @property
    def language_id(self) -> str:
        return self._language_id

    def get_supported_extensions(self) -> list[str]:
        return [
            ".flow-meta.xml", ".object-meta.xml", ".field-meta.xml",
            ".js-meta.xml", ".component-meta.xml",
        ]

    def parse(self, source: str, file_path: str) -> ParseResult:
        symbols: list[ExtractedSymbol] = []
        relationships: list[ExtractedRelationship] = []
        errors: list[ParseError] = []

        try:
            meta_type = self._detect_meta_type(file_path)
            if meta_type == "flow":
                self._parse_flow(source, file_path, symbols, relationships)
            elif meta_type == "object":
                self._parse_object(source, file_path, symbols, relationships)
            elif meta_type == "field":
                self._parse_field(source, file_path, symbols, relationships)
            elif meta_type == "lwc-meta":
                self._parse_lwc_meta(source, file_path, symbols, relationships)
            elif meta_type == "aura-meta":
                self._parse_aura_meta(source, file_path, symbols)
        except Exception as err:
            errors.append(ParseError(
                message=f"XML parse error: {err}",
                line=1, column=0,
            ))

        return ParseResult(symbols=symbols, relationships=relationships, errors=errors)

    # --- Metadata type detection ---

    def _detect_meta_type(self, file_path: str) -> str | None:
        """Detect metadata type from file extension."""
        lower = file_path.lower()
        if lower.endswith(".flow-meta.xml"):
            return "flow"
        if lower.endswith(".object-meta.xml"):
            return "object"
        if lower.endswith(".field-meta.xml"):
            return "field"
        if lower.endswith(".js-meta.xml"):
            return "lwc-meta"
        if lower.endswith(".component-meta.xml"):
            return "aura-meta"
        return None

    # --- XML parsing helpers (regex-based) ---

    def _extract_xml_values(self, source: str, tag_name: str) -> list[str]:
        """Extract XML element text content by tag name."""
        pattern = re.compile(rf"<{re.escape(tag_name)}>([^<]*)</{re.escape(tag_name)}>")
        return pattern.findall(source)

    def _extract_xml_blocks(self, source: str, tag_name: str) -> list[str]:
        """Extract XML blocks (multi-line elements)."""
        pattern = re.compile(
            rf"<{re.escape(tag_name)}>([\s\S]*?)</{re.escape(tag_name)}>", re.DOTALL
        )
        return [m.group(0) for m in pattern.finditer(source)]

    # --- Flow parsing ---

    def _parse_flow(
        self, source: str, file_path: str,
        symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship],
    ) -> None:
        """Parse .flow-meta.xml — extract flow structure, variables, decisions, actions."""
        flow_name = self._name_from_path(file_path)
        process_type = self._extract_xml_values(source, "processType")
        process_type_str = process_type[0] if process_type else "Flow"
        line_count = source.count("\n") + 1

        symbols.append(ExtractedSymbol(
            name=flow_name, kind="class", file_path=file_path,
            start_line=1, end_line=line_count,
            signature=f"Flow: {flow_name} ({process_type_str})",
            modifiers=[process_type_str.lower()], is_exported=True,
        ))

        # Extract variables as properties
        variables = self._extract_xml_blocks(source, "variables")
        for var_block in variables:
            var_name_list = self._extract_xml_values(var_block, "name")
            data_type_list = self._extract_xml_values(var_block, "dataType")
            var_name = var_name_list[0] if var_name_list else None
            data_type = data_type_list[0] if data_type_list else "String"
            if var_name:
                symbols.append(ExtractedSymbol(
                    name=var_name, kind="property", file_path=file_path,
                    start_line=1, end_line=1,
                    signature=f"{var_name}: {data_type}",
                    parent_name=flow_name, return_type=data_type,
                    is_exported=False,
                ))

        # Extract decisions as methods
        decisions = self._extract_xml_blocks(source, "decisions")
        for block in decisions:
            name_list = self._extract_xml_values(block, "name")
            name = name_list[0] if name_list else None
            if name:
                symbols.append(ExtractedSymbol(
                    name=name, kind="method", file_path=file_path,
                    start_line=1, end_line=1,
                    signature=f"Decision: {name}",
                    parent_name=flow_name, is_exported=False,
                ))

        # Extract actionCalls — Apex invocations
        actions = self._extract_xml_blocks(source, "actionCalls")
        for block in actions:
            action_name_list = self._extract_xml_values(block, "name")
            action_type_list = self._extract_xml_values(block, "actionType")
            action_name = action_name_list[0] if action_name_list else None
            action_type = action_type_list[0] if action_type_list else None
            if action_name:
                symbols.append(ExtractedSymbol(
                    name=action_name, kind="method", file_path=file_path,
                    start_line=1, end_line=1,
                    signature=f"Action: {action_name} ({action_type})",
                    parent_name=flow_name, is_exported=False,
                ))
                # If Apex action, create 'calls' relationship
                if action_type == "apex":
                    class_name_list = self._extract_xml_values(block, "actionName")
                    class_name = class_name_list[0] if class_name_list else None
                    if class_name:
                        relationships.append(ExtractedRelationship(
                            source_symbol=flow_name, target_symbol=class_name,
                            kind="calls", file_path=file_path,
                            line=1, metadata={"actionType": "apex"},
                        ))

        # Extract referenced SObjects from record operations
        for tag in ("recordLookups", "recordCreates", "recordUpdates", "recordDeletes"):
            blocks = self._extract_xml_blocks(source, tag)
            for block in blocks:
                object_name_list = self._extract_xml_values(block, "object")
                object_name = object_name_list[0] if object_name_list else None
                if object_name:
                    relationships.append(ExtractedRelationship(
                        source_symbol=flow_name, target_symbol=object_name,
                        kind="uses", file_path=file_path,
                        line=1, metadata={"operation": tag.replace("record", "").lower()},
                    ))

    # --- Object parsing ---

    def _parse_object(
        self, source: str, file_path: str,
        symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship],
    ) -> None:
        """Parse .object-meta.xml — extract object definition, fields, validation rules."""
        object_name = self._name_from_path(file_path)
        line_count = source.count("\n") + 1

        symbols.append(ExtractedSymbol(
            name=object_name, kind="class", file_path=file_path,
            start_line=1, end_line=line_count,
            signature=f"CustomObject: {object_name}",
            modifiers=["custom-object"], is_exported=True,
        ))

        # Extract fields
        fields = self._extract_xml_blocks(source, "fields")
        for block in fields:
            field_name_list = self._extract_xml_values(block, "fullName")
            field_type_list = self._extract_xml_values(block, "type")
            field_name = field_name_list[0] if field_name_list else None
            field_type = field_type_list[0] if field_type_list else "Text"
            if field_name:
                symbols.append(ExtractedSymbol(
                    name=field_name, kind="property", file_path=file_path,
                    start_line=1, end_line=1,
                    signature=f"{field_name}: {field_type}",
                    parent_name=object_name, return_type=field_type,
                    is_exported=True,
                ))

                # Lookup/MasterDetail relationships
                if field_type in ("Lookup", "MasterDetail"):
                    reference_to_list = self._extract_xml_values(block, "referenceTo")
                    reference_to = reference_to_list[0] if reference_to_list else None
                    if reference_to:
                        relationships.append(ExtractedRelationship(
                            source_symbol=object_name, target_symbol=reference_to,
                            kind="uses", file_path=file_path,
                            line=1, metadata={"relationType": field_type},
                        ))

        # Extract validation rules
        validations = self._extract_xml_blocks(source, "validationRules")
        for block in validations:
            rule_name_list = self._extract_xml_values(block, "fullName")
            rule_name = rule_name_list[0] if rule_name_list else None
            if rule_name:
                symbols.append(ExtractedSymbol(
                    name=rule_name, kind="method", file_path=file_path,
                    start_line=1, end_line=1,
                    signature=f"ValidationRule: {rule_name}",
                    parent_name=object_name, is_exported=False,
                ))

    # --- Field parsing (standalone .field-meta.xml) ---

    def _parse_field(
        self, source: str, file_path: str,
        symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship],
    ) -> None:
        """Parse .field-meta.xml — standalone field definition."""
        field_name = self._name_from_path(file_path)
        field_type_list = self._extract_xml_values(source, "type")
        field_type = field_type_list[0] if field_type_list else "Text"
        parent_object = self._infer_object_from_field_path(file_path)
        line_count = source.count("\n") + 1

        symbols.append(ExtractedSymbol(
            name=field_name, kind="property", file_path=file_path,
            start_line=1, end_line=line_count,
            signature=f"{field_name}: {field_type}",
            parent_name=parent_object, return_type=field_type,
            is_exported=True,
        ))

        if field_type in ("Lookup", "MasterDetail"):
            reference_to_list = self._extract_xml_values(source, "referenceTo")
            reference_to = reference_to_list[0] if reference_to_list else None
            if reference_to and parent_object:
                relationships.append(ExtractedRelationship(
                    source_symbol=parent_object, target_symbol=reference_to,
                    kind="uses", file_path=file_path,
                    line=1, metadata={"relationType": field_type, "field": field_name},
                ))

    # --- LWC metadata parsing ---

    def _parse_lwc_meta(
        self, source: str, file_path: str,
        symbols: list[ExtractedSymbol], relationships: list[ExtractedRelationship],
    ) -> None:
        """Parse .js-meta.xml — LWC component metadata."""
        component_name = self._name_from_path(file_path)
        line_count = source.count("\n") + 1

        # Check if exposed
        is_exposed_list = self._extract_xml_values(source, "isExposed")
        is_exposed = is_exposed_list[0].lower() == "true" if is_exposed_list else False

        # Extract targets
        targets = self._extract_xml_values(source, "target")

        symbols.append(ExtractedSymbol(
            name=component_name, kind="class", file_path=file_path,
            start_line=1, end_line=line_count,
            signature=f"LWC: {component_name}",
            modifiers=["lwc"] + (["exposed"] if is_exposed else []),
            is_exported=is_exposed,
        ))

        # Extract @wire targets from targetConfigs
        wire_targets = self._extract_xml_values(source, "objects")
        for obj in wire_targets:
            relationships.append(ExtractedRelationship(
                source_symbol=component_name, target_symbol=obj,
                kind="wire", file_path=file_path,
                line=1, metadata={"targets": targets},
            ))

    # --- Aura metadata parsing ---

    def _parse_aura_meta(
        self, source: str, file_path: str,
        symbols: list[ExtractedSymbol],
    ) -> None:
        """Parse .component-meta.xml — Aura component metadata (minimal extraction)."""
        component_name = self._name_from_path(file_path)
        line_count = source.count("\n") + 1

        # Extract description
        desc_list = self._extract_xml_values(source, "description")
        description = desc_list[0] if desc_list else None

        symbols.append(ExtractedSymbol(
            name=component_name, kind="class", file_path=file_path,
            start_line=1, end_line=line_count,
            signature=f"AuraComponent: {component_name}",
            modifiers=["aura"], is_exported=True,
            doc_comment=description,
        ))

    # --- Helper methods ---

    def _name_from_path(self, file_path: str) -> str:
        """Extract component name from file path."""
        # Normalize path separators
        normalized = file_path.replace("\\", "/")
        basename = normalized.split("/")[-1] if "/" in normalized else normalized
        # Remove all meta extensions: .flow-meta.xml -> name
        basename = re.sub(
            r"\.(flow|object|field|js|component)-meta\.xml$", "", basename, flags=re.IGNORECASE
        )
        # Remove any remaining extension
        basename = re.sub(r"\.\w+$", "", basename)
        return basename

    def _infer_object_from_field_path(self, file_path: str) -> str | None:
        """Infer parent object from field path.
        Pattern: .../objects/{ObjectName}/fields/{FieldName}.field-meta.xml
        """
        normalized = file_path.replace("\\", "/")
        match = re.search(r"objects/([^/]+)/fields/", normalized)
        return match.group(1) if match else None


# Module-level alias for dynamic loading
Parser = SalesforceMetaParser

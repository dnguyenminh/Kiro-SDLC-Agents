"""
Unit tests for Salesforce language support:
- ApexParser (tree-sitter based, .cls/.trigger)
- SalesforceMetaParser (regex-based XML, .flow-meta.xml etc.)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from mcp_code_intel.parsers.languages.salesforce_meta_parser import SalesforceMetaParser


# ============================================================
# SalesforceMetaParser Tests (no tree-sitter dependency needed)
# ============================================================

class TestSalesforceMetaParser:
    """Tests for SalesforceMetaParser — regex-based XML extraction."""

    def setup_method(self):
        self.parser = SalesforceMetaParser(None, "salesforce-meta")

    def test_language_id(self):
        assert self.parser.language_id == "salesforce-meta"

    def test_supported_extensions(self):
        exts = self.parser.get_supported_extensions()
        assert ".flow-meta.xml" in exts
        assert ".object-meta.xml" in exts
        assert ".field-meta.xml" in exts
        assert ".js-meta.xml" in exts
        assert ".component-meta.xml" in exts

    # --- Flow parsing ---

    def test_parse_flow_basic(self):
        """Parse a basic flow-meta.xml with processType and variables."""
        source = """<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <processType>AutoLaunchedFlow</processType>
    <variables>
        <name>recordId</name>
        <dataType>String</dataType>
    </variables>
    <variables>
        <name>accountName</name>
        <dataType>String</dataType>
    </variables>
</Flow>"""
        result = self.parser.parse(source, "force-app/main/default/flows/MyFlow.flow-meta.xml")
        assert len(result.errors) == 0

        # Flow itself as class symbol
        flow_sym = next(s for s in result.symbols if s.kind == "class")
        assert flow_sym.name == "MyFlow"
        assert "autolaunchedflow" in (flow_sym.modifiers or [])
        assert flow_sym.is_exported is True

        # Variables as properties
        props = [s for s in result.symbols if s.kind == "property"]
        assert len(props) == 2
        names = {p.name for p in props}
        assert "recordId" in names
        assert "accountName" in names

    def test_parse_flow_decisions(self):
        """Parse flow decisions as method symbols."""
        source = """<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <processType>ScreenFlow</processType>
    <decisions>
        <name>Check_Status</name>
    </decisions>
    <decisions>
        <name>Validate_Input</name>
    </decisions>
</Flow>"""
        result = self.parser.parse(source, "flows/StatusCheck.flow-meta.xml")
        methods = [s for s in result.symbols if s.kind == "method"]
        assert len(methods) == 2
        method_names = {m.name for m in methods}
        assert "Check_Status" in method_names
        assert "Validate_Input" in method_names

    def test_parse_flow_apex_action(self):
        """Parse flow actionCalls with apex type creates 'calls' relationship."""
        source = """<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <processType>AutoLaunchedFlow</processType>
    <actionCalls>
        <name>InvokeApex</name>
        <actionType>apex</actionType>
        <actionName>AccountService</actionName>
    </actionCalls>
</Flow>"""
        result = self.parser.parse(source, "flows/InvokeFlow.flow-meta.xml")
        calls = [r for r in result.relationships if r.kind == "calls"]
        assert len(calls) == 1
        assert calls[0].source_symbol == "InvokeFlow"
        assert calls[0].target_symbol == "AccountService"

    def test_parse_flow_record_operations(self):
        """Parse flow record operations create 'uses' relationships."""
        source = """<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <processType>AutoLaunchedFlow</processType>
    <recordLookups>
        <name>Get_Account</name>
        <object>Account</object>
    </recordLookups>
    <recordCreates>
        <name>Create_Task</name>
        <object>Task</object>
    </recordCreates>
</Flow>"""
        result = self.parser.parse(source, "flows/RecordOps.flow-meta.xml")
        uses = [r for r in result.relationships if r.kind == "uses"]
        assert len(uses) == 2
        targets = {r.target_symbol for r in uses}
        assert "Account" in targets
        assert "Task" in targets

    # --- Object parsing ---

    def test_parse_object_basic(self):
        """Parse a custom object with fields."""
        source = """<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <fields>
        <fullName>Status__c</fullName>
        <type>Picklist</type>
    </fields>
    <fields>
        <fullName>Account__c</fullName>
        <type>Lookup</type>
        <referenceTo>Account</referenceTo>
    </fields>
</CustomObject>"""
        result = self.parser.parse(source, "objects/MyObject__c/MyObject__c.object-meta.xml")
        assert len(result.errors) == 0

        # Object as class
        obj_sym = next(s for s in result.symbols if s.kind == "class")
        assert obj_sym.name == "MyObject__c"
        assert "custom-object" in (obj_sym.modifiers or [])

        # Fields as properties
        props = [s for s in result.symbols if s.kind == "property"]
        assert len(props) == 2

        # Lookup creates 'uses' relationship
        uses = [r for r in result.relationships if r.kind == "uses"]
        assert len(uses) == 1
        assert uses[0].source_symbol == "MyObject__c"
        assert uses[0].target_symbol == "Account"

    def test_parse_object_validation_rules(self):
        """Parse validation rules as method symbols."""
        source = """<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <validationRules>
        <fullName>Require_Status</fullName>
    </validationRules>
</CustomObject>"""
        result = self.parser.parse(source, "objects/Case/Case.object-meta.xml")
        methods = [s for s in result.symbols if s.kind == "method"]
        assert len(methods) == 1
        assert methods[0].name == "Require_Status"
        assert methods[0].parent_name == "Case"

    # --- Field parsing ---

    def test_parse_field_standalone(self):
        """Parse standalone .field-meta.xml."""
        source = """<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Priority__c</fullName>
    <type>Picklist</type>
</CustomField>"""
        result = self.parser.parse(
            source, "force-app/main/default/objects/Case/fields/Priority__c.field-meta.xml"
        )
        assert len(result.symbols) == 1
        sym = result.symbols[0]
        assert sym.name == "Priority__c"
        assert sym.kind == "property"
        assert sym.parent_name == "Case"
        assert sym.return_type == "Picklist"

    def test_parse_field_lookup_relationship(self):
        """Parse field with Lookup type creates relationship."""
        source = """<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Account__c</fullName>
    <type>Lookup</type>
    <referenceTo>Account</referenceTo>
</CustomField>"""
        result = self.parser.parse(
            source, "objects/Contact/fields/Account__c.field-meta.xml"
        )
        uses = [r for r in result.relationships if r.kind == "uses"]
        assert len(uses) == 1
        assert uses[0].source_symbol == "Contact"
        assert uses[0].target_symbol == "Account"
        assert uses[0].metadata["relationType"] == "Lookup"

    # --- LWC metadata parsing ---

    def test_parse_lwc_meta(self):
        """Parse .js-meta.xml for LWC component."""
        source = """<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__RecordPage</target>
        <target>lightning__AppPage</target>
    </targets>
</LightningComponentBundle>"""
        result = self.parser.parse(source, "lwc/myComponent/myComponent.js-meta.xml")
        assert len(result.symbols) >= 1
        sym = result.symbols[0]
        assert sym.name == "myComponent"
        assert sym.kind == "class"
        assert sym.is_exported is True
        assert "exposed" in (sym.modifiers or [])

    # --- Aura metadata parsing ---

    def test_parse_aura_meta(self):
        """Parse .component-meta.xml for Aura component."""
        source = """<?xml version="1.0" encoding="UTF-8"?>
<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>My Aura Component</description>
</AuraDefinitionBundle>"""
        result = self.parser.parse(source, "aura/MyAuraComp/MyAuraComp.component-meta.xml")
        assert len(result.symbols) == 1
        sym = result.symbols[0]
        assert sym.name == "MyAuraComp"
        assert "aura" in (sym.modifiers or [])
        assert sym.doc_comment == "My Aura Component"

    # --- Error handling ---

    def test_parse_malformed_xml(self):
        """Malformed XML produces error but doesn't crash."""
        # This won't actually throw since regex-based parsing is lenient
        source = "<broken><unclosed"
        result = self.parser.parse(source, "flows/Bad.flow-meta.xml")
        # Should not crash — may produce empty results
        assert isinstance(result.symbols, list)
        assert isinstance(result.errors, list)

    # --- Helper method tests ---

    def test_name_from_path_flow(self):
        assert self.parser._name_from_path("flows/MyFlow.flow-meta.xml") == "MyFlow"

    def test_name_from_path_object(self):
        assert self.parser._name_from_path("objects/Account/Account.object-meta.xml") == "Account"

    def test_name_from_path_field(self):
        assert self.parser._name_from_path("fields/Status__c.field-meta.xml") == "Status__c"

    def test_name_from_path_lwc(self):
        assert self.parser._name_from_path("lwc/myComp/myComp.js-meta.xml") == "myComp"

    def test_infer_object_from_field_path(self):
        path = "force-app/main/default/objects/Account/fields/Name.field-meta.xml"
        assert self.parser._infer_object_from_field_path(path) == "Account"

    def test_infer_object_from_field_path_none(self):
        path = "fields/Name.field-meta.xml"
        assert self.parser._infer_object_from_field_path(path) is None


# ============================================================
# Scanner integration tests
# ============================================================

class TestScannerSalesforceSupport:
    """Tests for scanner.py Salesforce extension detection."""

    def test_detect_language_cls(self):
        from mcp_code_intel.scanner import detect_language
        assert detect_language("AccountService.cls") == "apex"

    def test_detect_language_trigger(self):
        from mcp_code_intel.scanner import detect_language
        assert detect_language("AccountTrigger.trigger") == "apex"

    def test_detect_language_flow_meta(self):
        from mcp_code_intel.scanner import detect_language
        assert detect_language("MyFlow.flow-meta.xml") == "salesforce-meta"

    def test_detect_language_object_meta(self):
        from mcp_code_intel.scanner import detect_language
        assert detect_language("Account.object-meta.xml") == "salesforce-meta"

    def test_detect_language_field_meta(self):
        from mcp_code_intel.scanner import detect_language
        assert detect_language("Status__c.field-meta.xml") == "salesforce-meta"

    def test_detect_language_js_meta(self):
        from mcp_code_intel.scanner import detect_language
        assert detect_language("myComponent.js-meta.xml") == "salesforce-meta"

    def test_detect_language_component_meta(self):
        from mcp_code_intel.scanner import detect_language
        assert detect_language("MyComp.component-meta.xml") == "salesforce-meta"

    def test_detect_language_regular_xml_not_sf(self):
        from mcp_code_intel.scanner import detect_language
        # Regular .xml should NOT be detected as salesforce-meta
        assert detect_language("pom.xml") != "salesforce-meta"


# ============================================================
# Config tests
# ============================================================

class TestConfigSalesforceExtensions:
    """Tests for config.py DEFAULT_EXTENSIONS."""

    def test_cls_in_default_extensions(self):
        from mcp_code_intel.config import DEFAULT_EXTENSIONS
        assert ".cls" in DEFAULT_EXTENSIONS

    def test_trigger_in_default_extensions(self):
        from mcp_code_intel.config import DEFAULT_EXTENSIONS
        assert ".trigger" in DEFAULT_EXTENSIONS


# ============================================================
# Indexer SFDX detection tests
# ============================================================

class TestIndexerSfdxDetection:
    """Tests for indexer.py SFDX module detection."""

    def test_detect_module_sfdx_classes(self):
        from mcp_code_intel.indexer import _detect_module
        assert _detect_module("force-app/main/default/classes/AccountService.cls") == "classes"

    def test_detect_module_sfdx_triggers(self):
        from mcp_code_intel.indexer import _detect_module
        assert _detect_module("force-app/main/default/triggers/AccountTrigger.trigger") == "triggers"

    def test_detect_module_sfdx_flows(self):
        from mcp_code_intel.indexer import _detect_module
        assert _detect_module("force-app/main/default/flows/MyFlow.flow-meta.xml") == "flows"

    def test_detect_module_sfdx_objects(self):
        from mcp_code_intel.indexer import _detect_module
        assert _detect_module("force-app/main/default/objects/Account/Account.object-meta.xml") == "objects"

    def test_detect_module_sfdx_lwc(self):
        from mcp_code_intel.indexer import _detect_module
        assert _detect_module("force-app/main/default/lwc/myComponent/myComponent.js") == "lwc"

    def test_detect_module_non_sfdx(self):
        from mcp_code_intel.indexer import _detect_module
        assert _detect_module("src/services/AccountService.cls") == "services"


# ============================================================
# GrammarRegistry compound extension tests
# ============================================================

class TestGrammarRegistryCompoundExtensions:
    """Tests for grammar_registry.py compound extension handling."""

    def test_compound_extension_detection(self):
        from mcp_code_intel.parsers.grammar_registry import GrammarRegistry, GrammarRegistryConfig, LanguageConfig
        config = GrammarRegistryConfig(
            languages=[
                LanguageConfig(
                    id="salesforce-meta",
                    extensions=[".flow-meta.xml", ".object-meta.xml"],
                    grammar_path=None,
                    parser_module="mcp_code_intel.parsers.languages.salesforce_meta_parser",
                ),
                LanguageConfig(
                    id="apex",
                    extensions=[".cls", ".trigger"],
                    grammar_path="grammars/tree-sitter-apex.so",
                    parser_module="mcp_code_intel.parsers.languages.apex_parser",
                ),
            ],
            grammar_dir="/tmp",
        )
        registry = GrammarRegistry(config)
        # Compound extension should resolve to salesforce-meta
        assert registry.get_language_id("MyFlow.flow-meta.xml") == "salesforce-meta"
        assert registry.get_language_id("Account.object-meta.xml") == "salesforce-meta"
        # Simple extensions should resolve to apex
        assert registry.get_language_id("AccountService.cls") == "apex"
        assert registry.get_language_id("AccountTrigger.trigger") == "apex"

    def test_null_grammar_path_accepted(self):
        """GrammarRegistry should accept None grammar_path for non-tree-sitter parsers."""
        from mcp_code_intel.parsers.grammar_registry import GrammarRegistry, GrammarRegistryConfig, LanguageConfig
        config = GrammarRegistryConfig(
            languages=[
                LanguageConfig(
                    id="salesforce-meta",
                    extensions=[".flow-meta.xml"],
                    grammar_path=None,
                    parser_module="mcp_code_intel.parsers.languages.salesforce_meta_parser",
                ),
            ],
            grammar_dir="/tmp",
        )
        registry = GrammarRegistry(config)
        registry.initialize()
        # Should load parser without tree-sitter
        parser = registry.get_parser("MyFlow.flow-meta.xml")
        assert parser is not None
        assert parser.language_id == "salesforce-meta"

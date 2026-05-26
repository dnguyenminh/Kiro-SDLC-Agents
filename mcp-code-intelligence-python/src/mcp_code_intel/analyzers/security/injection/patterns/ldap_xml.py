"""KSA-165: LDAP/XML Matcher."""
from ..pattern_matcher import PatternMatcher
from ...types import InjectionPattern


class LDAPXMLMatcher(PatternMatcher):
    @property
    def category(self) -> str:
        return "ldap_xml_injection"

    @property
    def patterns(self) -> list[InjectionPattern]:
        return [
            InjectionPattern(id=19, name="LDAP Injection via String Concatenation", category="ldap_xml_injection", cwe="CWE-90", severity="High",
                sink_patterns=["ldap.search(", "ldap.bind(", "ldapjs.search", "search_s("],
                dangerous_ops=["concat", "template_literal", "format_string"],
                safe_patterns=["ldap.filter.escape", "escape_filter_chars", "ldapEscape"],
                description="Escape LDAP special characters."),
            InjectionPattern(id=20, name="XPath Injection via User Input", category="ldap_xml_injection", cwe="CWE-643", severity="High",
                sink_patterns=["xpath(", "evaluate(", "selectNodes(", "xmlDoc.find("],
                dangerous_ops=["concat", "template_literal", "format_string"],
                safe_patterns=["parameterize", "compile(", "XPathExpression"],
                description="Use parameterized XPath queries."),
        ]

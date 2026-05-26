"""KSA-165: Deserialization Matcher."""
from ..pattern_matcher import PatternMatcher
from ...types import InjectionPattern


class DeserializationMatcher(PatternMatcher):
    @property
    def category(self) -> str:
        return "deserialization"

    @property
    def patterns(self) -> list[InjectionPattern]:
        return [
            InjectionPattern(id=16, name="Unsafe YAML Load with User Input", category="deserialization", cwe="CWE-502", severity="Critical",
                sink_patterns=["yaml.load(", "yaml.unsafe_load(", "YAML.load("],
                dangerous_ops=["pass_through", "assign", "function_call"],
                safe_patterns=["yaml.safe_load", "yaml.SafeLoader", "Loader=SafeLoader"],
                description="Use yaml.safe_load() or yaml.load(data, Loader=SafeLoader)."),
            InjectionPattern(id=17, name="Pickle/Marshal Deserialization of User Data", category="deserialization", cwe="CWE-502", severity="Critical",
                sink_patterns=["pickle.loads(", "pickle.load(", "marshal.loads(", "unserialize("],
                dangerous_ops=["pass_through", "assign", "function_call"],
                safe_patterns=["hmac", "signature", "verify"],
                description="Never deserialize untrusted data with pickle/marshal."),
            InjectionPattern(id=18, name="XML External Entity (XXE) Processing", category="deserialization", cwe="CWE-611", severity="High",
                sink_patterns=["parseXML(", "DOMParser", "xml2js.parse", "etree.fromstring", "etree.parse"],
                dangerous_ops=["pass_through", "assign", "function_call"],
                safe_patterns=["resolve_entities=False", "disallow_doctype", "defusedxml", "noent: false"],
                description="Disable external entity resolution."),
        ]

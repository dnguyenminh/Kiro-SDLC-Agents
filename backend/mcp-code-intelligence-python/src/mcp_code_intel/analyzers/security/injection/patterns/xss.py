"""KSA-165: XSS Matcher."""
from ..pattern_matcher import PatternMatcher
from ...types import InjectionPattern


class XSSMatcher(PatternMatcher):
    @property
    def category(self) -> str:
        return "xss"

    @property
    def patterns(self) -> list[InjectionPattern]:
        return [
            InjectionPattern(id=5, name="innerHTML Assignment with User Input", category="xss", cwe="CWE-79", severity="High",
                sink_patterns=["innerHTML", "outerHTML", "dangerouslySetInnerHTML"],
                dangerous_ops=["concat", "template_literal", "assign", "pass_through"],
                safe_patterns=["DOMPurify", "sanitize", "textContent", "innerText"],
                description="Use textContent/innerText or sanitize with DOMPurify."),
            InjectionPattern(id=6, name="document.write with User Input", category="xss", cwe="CWE-79", severity="Critical",
                sink_patterns=["document.write(", "document.writeln("],
                dangerous_ops=["concat", "template_literal", "pass_through"],
                safe_patterns=["encode", "escape", "sanitize"],
                description="Avoid document.write entirely."),
            InjectionPattern(id=7, name="Reflected XSS in Server Response", category="xss", cwe="CWE-79", severity="High",
                sink_patterns=["res.send(", "res.write(", "response.write(", "render("],
                dangerous_ops=["concat", "template_literal", "format_string"],
                safe_patterns=["escape", "encode", "sanitize", "helmet", "csp"],
                description="Use template engines with auto-escaping."),
            InjectionPattern(id=8, name="DOM-based XSS via URL Fragment", category="xss", cwe="CWE-79", severity="High",
                sink_patterns=["innerHTML", "eval(", "document.write(", "location.href"],
                dangerous_ops=["pass_through", "assign"],
                safe_patterns=["encodeURIComponent", "sanitize", "DOMPurify"],
                description="Sanitize URL fragments before DOM insertion."),
        ]

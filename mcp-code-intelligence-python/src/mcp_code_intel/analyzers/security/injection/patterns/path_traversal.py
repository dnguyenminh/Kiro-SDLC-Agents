"""KSA-165: Path Traversal Matcher."""
from ..pattern_matcher import PatternMatcher
from ...types import InjectionPattern


class PathTraversalMatcher(PatternMatcher):
    @property
    def category(self) -> str:
        return "path_traversal"

    @property
    def patterns(self) -> list[InjectionPattern]:
        return [
            InjectionPattern(id=13, name="File Read with User-Controlled Path", category="path_traversal", cwe="CWE-22", severity="High",
                sink_patterns=["readFile(", "readFileSync(", "createReadStream(", "open(", "fopen("],
                dangerous_ops=["concat", "template_literal", "pass_through"],
                safe_patterns=["path.basename", "path.normalize", "startsWith(", "resolve("],
                description="Validate path against base directory."),
            InjectionPattern(id=14, name="File Write with User-Controlled Path", category="path_traversal", cwe="CWE-22", severity="Critical",
                sink_patterns=["writeFile(", "writeFileSync(", "createWriteStream(", "fwrite("],
                dangerous_ops=["concat", "template_literal", "pass_through"],
                safe_patterns=["path.basename", "startsWith(", "whitelist"],
                description="Restrict write paths to a safe directory."),
            InjectionPattern(id=15, name="Directory Listing with User Input", category="path_traversal", cwe="CWE-22", severity="Medium",
                sink_patterns=["readdir(", "readdirSync(", "listdir(", "scandir("],
                dangerous_ops=["concat", "template_literal", "pass_through"],
                safe_patterns=["path.basename", "startsWith(", "resolve("],
                description="Validate directory path against allowed base directories."),
        ]

"""Recognize dynamic dispatch patterns that reduce dead code confidence."""

from __future__ import annotations

import re


# Patterns that indicate dynamic dispatch / reflection usage
DYNAMIC_PATTERNS = [
    # Python reflection
    re.compile(r"\bgetattr\s*\("),
    re.compile(r"\bsetattr\s*\("),
    re.compile(r"\b__getattr__\b"),
    re.compile(r"\b__call__\b"),
    # Decorator patterns (often used for registration)
    re.compile(r"@\w+\.register"),
    re.compile(r"@app\.route"),
    re.compile(r"@router\.\w+"),
    # Plugin/DI patterns
    re.compile(r"\bplugin\b.*\bregister\b", re.IGNORECASE),
    re.compile(r"\bfactory\b.*\bcreate\b", re.IGNORECASE),
    re.compile(r"\bregistry\b", re.IGNORECASE),
    # Java/Kotlin reflection
    re.compile(r"\.class\.getDeclaredMethod"),
    re.compile(r"Class\.forName"),
    re.compile(r"@Component|@Service|@Bean|@Inject"),
    # TypeScript/JS dynamic
    re.compile(r"\bReflect\.\w+"),
    re.compile(r"\[.*\]\s*\("),  # computed property call
]

# Config file patterns that reference functions by name
CONFIG_PATTERNS = [
    re.compile(r"handler\s*[:=]"),
    re.compile(r"callback\s*[:=]"),
    re.compile(r"plugin\s*[:=]"),
    re.compile(r"middleware\s*[:=]"),
    re.compile(r"command\s*[:=]"),
]


class DynamicDispatchRecognizer:
    """Detect if a function might be called via dynamic dispatch."""

    def is_dynamically_dispatched(self, source_code: str) -> bool:
        """Check if source code contains dynamic dispatch patterns."""
        for pattern in DYNAMIC_PATTERNS:
            if pattern.search(source_code):
                return True
        return False

    def is_config_referenced(self, function_name: str, config_content: str) -> bool:
        """Check if function name appears in config files."""
        # Simple name match in config content
        if function_name in config_content:
            return True
        # Check config patterns
        for pattern in CONFIG_PATTERNS:
            match = pattern.search(config_content)
            if match and function_name in config_content[match.start():match.start() + 200]:
                return True
        return False

    def has_deprecated_marker(self, source_code: str) -> bool:
        """Check if function has deprecation markers."""
        deprecated_patterns = [
            "@deprecated",
            "@Deprecated",
            "# deprecated",
            "# DEPRECATED",
            "warnings.warn",
            "DeprecationWarning",
        ]
        return any(p in source_code for p in deprecated_patterns)

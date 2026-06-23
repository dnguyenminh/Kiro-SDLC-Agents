"""Signature extractor — multi-language regex-based symbol extraction."""

import re
from typing import Any

SymbolKind = str  # function, class, interface, method, enum, type, etc.

# Pattern definition: (regex, kind, name_group)
PatternDef = tuple[re.Pattern[str], SymbolKind, int]


def extract_symbols(content: str, language: str) -> list[dict[str, Any]]:
    """Extract symbols from source content based on language."""
    patterns = _get_patterns(language)
    if not patterns:
        return []
    lines = content.split("\n")
    symbols: list[dict[str, Any]] = []
    for pattern in patterns:
        _extract_with_pattern(lines, content, pattern, symbols)
    return _deduplicate(symbols)


def _extract_with_pattern(
    lines: list[str], content: str,
    pattern: PatternDef, symbols: list[dict[str, Any]],
) -> None:
    regex, kind, name_group = pattern
    for match in regex.finditer(content):
        start_line = content[:match.start()].count("\n") + 1
        name = match.group(name_group)
        if not name or len(name) > 100:
            continue
        symbols.append({
            "name": name,
            "kind": kind,
            "signature": match.group(0).strip()[:500],
            "start_line": start_line,
            "end_line": _estimate_end_line(lines, start_line),
            "parent_symbol": None,
            "visibility": _extract_visibility(match.group(0)),
            "doc_comment": _extract_doc_comment(lines, start_line - 1),
        })


def _estimate_end_line(lines: list[str], start_line: int) -> int:
    """Estimate end line by tracking brace depth."""
    depth = 0
    found_open = False
    for i in range(start_line - 1, min(len(lines), start_line + 200)):
        for ch in lines[i]:
            if ch == "{":
                depth += 1
                found_open = True
            elif ch == "}":
                depth -= 1
        if found_open and depth <= 0:
            return i + 1
    return min(start_line + 1, len(lines))


def _extract_visibility(text: str) -> str | None:
    """Extract visibility modifier from match text."""
    if re.search(r"\bpublic\b", text):
        return "public"
    if re.search(r"\bpub\b", text):
        return "public"
    if re.search(r"\bprivate\b", text):
        return "private"
    if re.search(r"\bprotected\b", text):
        return "protected"
    if re.search(r"\binternal\b", text):
        return "internal"
    if re.search(r"\bexport\b", text):
        return "export"
    return None


def _extract_doc_comment(lines: list[str], line_idx: int) -> str | None:
    """Extract doc comment above a symbol."""
    comments: list[str] = []
    for i in range(line_idx - 1, max(-1, line_idx - 16), -1):
        line = lines[i].strip()
        if line.startswith(("*", "/**", "///", "#")):
            cleaned = re.sub(r"^/\*\*|\*/|\*|///|#\s?", "", line).strip()
            comments.insert(0, cleaned)
        elif line == "":
            continue
        else:
            break
    return " ".join(comments)[:500] if comments else None


def _deduplicate(symbols: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove duplicate symbols at same location."""
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for s in symbols:
        key = f"{s['name']}:{s['start_line']}"
        if key not in seen:
            seen.add(key)
            result.append(s)
    return result


def _get_patterns(language: str) -> list[PatternDef]:
    """Get extraction patterns for a language."""
    mapping = {
        "typescript": _TS_PATTERNS,
        "javascript": _TS_PATTERNS,
        "kotlin": _KOTLIN_PATTERNS,
        "python": _PYTHON_PATTERNS,
        "java": _JAVA_PATTERNS,
        "go": _GO_PATTERNS,
        "rust": _RUST_PATTERNS,
    }
    return mapping.get(language, _GENERIC_PATTERNS)


# --- Language-specific patterns ---

_TS_PATTERNS: list[PatternDef] = [
    (re.compile(r"^(?:export\s+)?(?:async\s+)?function\s+(\w+)", re.M), "function", 1),
    (re.compile(r"^(?:export\s+)?class\s+(\w+)", re.M), "class", 1),
    (re.compile(r"^(?:export\s+)?interface\s+(\w+)", re.M), "interface", 1),
    (re.compile(r"^(?:export\s+)?type\s+(\w+)", re.M), "type", 1),
    (re.compile(r"^(?:export\s+)?enum\s+(\w+)", re.M), "enum", 1),
    (re.compile(r"^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(", re.M), "function", 1),
]

_KOTLIN_PATTERNS: list[PatternDef] = [
    (re.compile(r"^\s*(?:(?:public|private|internal|protected)\s+)?(?:suspend\s+)?fun\s+(\w+)", re.M), "function", 1),
    (re.compile(r"^\s*(?:(?:public|private|internal|protected)\s+)?(?:data\s+|sealed\s+|abstract\s+|open\s+)?class\s+(\w+)", re.M), "class", 1),
    (re.compile(r"^\s*(?:(?:public|private|internal|protected)\s+)?interface\s+(\w+)", re.M), "interface", 1),
    (re.compile(r"^\s*(?:(?:public|private|internal|protected)\s+)?object\s+(\w+)", re.M), "module", 1),
    (re.compile(r"^\s*(?:(?:public|private|internal|protected)\s+)?enum\s+class\s+(\w+)", re.M), "enum", 1),
]

_PYTHON_PATTERNS: list[PatternDef] = [
    (re.compile(r"^\s*(?:async\s+)?def\s+(\w+)", re.M), "function", 1),
    (re.compile(r"^class\s+(\w+)", re.M), "class", 1),
]

_JAVA_PATTERNS: list[PatternDef] = [
    (re.compile(r"^\s*(?:(?:public|private|protected)\s+)?(?:static\s+)?(?:[\w<>\[\]]+\s+)(\w+)\s*\(", re.M), "function", 1),
    (re.compile(r"^\s*(?:(?:public|private|protected)\s+)?(?:abstract\s+)?class\s+(\w+)", re.M), "class", 1),
    (re.compile(r"^\s*(?:(?:public|private|protected)\s+)?interface\s+(\w+)", re.M), "interface", 1),
    (re.compile(r"^\s*(?:(?:public|private|protected)\s+)?enum\s+(\w+)", re.M), "enum", 1),
]

_GO_PATTERNS: list[PatternDef] = [
    (re.compile(r"^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)", re.M), "function", 1),
    (re.compile(r"^type\s+(\w+)\s+struct", re.M), "struct", 1),
    (re.compile(r"^type\s+(\w+)\s+interface", re.M), "interface", 1),
]

_RUST_PATTERNS: list[PatternDef] = [
    (re.compile(r"^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)", re.M), "function", 1),
    (re.compile(r"^\s*(?:pub\s+)?struct\s+(\w+)", re.M), "struct", 1),
    (re.compile(r"^\s*(?:pub\s+)?trait\s+(\w+)", re.M), "trait", 1),
    (re.compile(r"^\s*(?:pub\s+)?enum\s+(\w+)", re.M), "enum", 1),
    (re.compile(r"^\s*(?:pub\s+)?mod\s+(\w+)", re.M), "module", 1),
]

_GENERIC_PATTERNS: list[PatternDef] = [
    (re.compile(r"^(?:function|def|func|fn|sub)\s+(\w+)", re.M), "function", 1),
    (re.compile(r"^(?:class|struct|type)\s+(\w+)", re.M), "class", 1),
]

"""File scanner — traverses workspace, respects .gitignore, detects language."""

import hashlib
import sys
from pathlib import Path
from typing import Any

EXTENSION_LANGUAGE_MAP: dict[str, str] = {
    ".ts": "typescript", ".tsx": "typescript",
    ".js": "javascript", ".jsx": "javascript",
    ".kt": "kotlin", ".kts": "kotlin",
    ".java": "java",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".c": "c", ".h": "c",
    ".cpp": "cpp", ".hpp": "cpp",
    ".cs": "csharp",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".scala": "scala",
    ".sql": "sql",
    ".sh": "bash",
    ".ps1": "powershell",
    ".yaml": "yaml", ".yml": "yaml",
    ".json": "json",
    ".toml": "toml",
    ".cls": "apex", ".trigger": "apex",
}

# Compound extensions that require longest-match-first detection
COMPOUND_EXTENSION_MAP: dict[str, str] = {
    ".flow-meta.xml": "salesforce-meta",
    ".object-meta.xml": "salesforce-meta",
    ".field-meta.xml": "salesforce-meta",
    ".js-meta.xml": "salesforce-meta",
    ".component-meta.xml": "salesforce-meta",
}


def scan_workspace(config: dict[str, Any]) -> list[dict[str, Any]]:
    """Scan workspace and return list of indexable files."""
    workspace = Path(config["workspace"])
    gitignore = _load_gitignore(workspace)
    results: list[dict[str, Any]] = []
    _traverse(workspace, workspace, config, gitignore, results)
    return results


def scan_single_file(file_path: str, workspace: str) -> dict[str, Any] | None:
    """Scan a single file and return metadata."""
    try:
        p = Path(file_path)
        content = p.read_text(encoding="utf-8", errors="replace")
        rel = p.relative_to(workspace).as_posix()
        lang = detect_language(file_path)
        if not lang:
            return None
        return _build_file_info(str(p), rel, lang, content)
    except (OSError, ValueError):
        return None


def detect_language(file_path: str) -> str | None:
    """Detect language from file extension. Supports compound extensions (longest-match-first)."""
    # Check compound extensions first (longest match wins)
    lower_path = file_path.lower()
    for compound_ext, lang in COMPOUND_EXTENSION_MAP.items():
        if lower_path.endswith(compound_ext):
            return lang

    ext = _get_extension(file_path)
    return EXTENSION_LANGUAGE_MAP.get(ext)


def _build_file_info(abs_path: str, rel_path: str, lang: str, content: str) -> dict[str, Any]:
    return {
        "absolute_path": abs_path,
        "relative_path": rel_path,
        "language": lang,
        "content_hash": _hash_content(content),
        "size_bytes": len(content.encode("utf-8")),
        "line_count": content.count("\n") + 1,
    }


def _traverse(
    directory: Path, workspace: Path,
    config: dict[str, Any], gitignore: list[str],
    results: list[dict[str, Any]],
) -> None:
    try:
        entries = sorted(directory.iterdir())
    except OSError:
        return

    for entry in entries:
        rel = entry.relative_to(workspace).as_posix()
        if _should_exclude(rel, entry.name, config["exclude_patterns"], gitignore):
            continue
        if entry.is_dir():
            _traverse(entry, workspace, config, gitignore, results)
        elif entry.is_file():
            info = _process_file(entry, rel, config)
            if info:
                results.append(info)


def _process_file(entry: Path, rel_path: str, config: dict[str, Any]) -> dict[str, Any] | None:
    lang = detect_language(str(entry))
    if not lang:
        return None
    ext = _get_extension(str(entry))
    # Allow through if simple extension matches, or compound extension detected (SF metadata)
    if ext not in config["include_extensions"] and ext != ".kts" and lang not in ("salesforce-meta",):
        return None
    try:
        stat = entry.stat()
        if stat.st_size > config["max_file_size"]:
            return None
        content = entry.read_text(encoding="utf-8", errors="replace")
        if _is_binary(content):
            return None
        return _build_file_info(str(entry), rel_path, lang, content)
    except OSError:
        return None


def _should_exclude(rel_path: str, name: str, excludes: list[str], gitignore: list[str]) -> bool:
    if name.startswith(".") and name != ".":
        return True
    for pattern in excludes:
        if pattern in rel_path or name == pattern:
            return True
    for pattern in gitignore:
        if rel_path.startswith(pattern) or f"/{pattern}" in rel_path:
            return True
    return False


def _is_binary(content: str) -> bool:
    sample = content[:1024]
    return sample.count("\x00") > 2


def _hash_content(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


def _get_extension(file_path: str) -> str:
    if file_path.endswith(".gradle.kts"):
        return ".kts"
    return Path(file_path).suffix.lower()


def _load_gitignore(workspace: Path) -> list[str]:
    gitignore_path = workspace / ".gitignore"
    try:
        if not gitignore_path.exists():
            return []
        lines = gitignore_path.read_text(encoding="utf-8").splitlines()
        return [
            l.strip().rstrip("/")
            for l in lines
            if l.strip() and not l.strip().startswith("#")
        ]
    except OSError:
        return []

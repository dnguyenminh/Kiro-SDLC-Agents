"""Shared utility functions for the Code Intelligence indexer."""

import hashlib
import os
import re
from typing import List


def compute_hash(file_path: str) -> str:
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return f"sha256:{h.hexdigest()}"


def map_extension(file_path: str) -> str:
    """Map file extension to language string."""
    from config import COMPOUND_EXTENSIONS, EXTENSION_MAP
    basename = os.path.basename(file_path).lower()
    for suffix, lang in COMPOUND_EXTENSIONS:
        if basename.endswith(suffix):
            return lang
    ext = os.path.splitext(file_path)[1].lower()
    return EXTENSION_MAP.get(ext, "unknown")


def glob_match(text: str, pattern: str) -> bool:
    """Match a simple glob pattern against text."""
    regex = "^" + pattern.replace(".", r"\.").replace("*", "[^/]*") + "$"
    return bool(re.match(regex, text))


def derive_package(file_path: str) -> str:
    """Derive a package-like name from a file path."""
    normalized = file_path.replace("\\", "/")
    m = re.search(r'src/(?:main|test)/(?:kotlin|java)/(.+)', normalized)
    if m:
        pkg_path = os.path.dirname(m.group(1))
        return pkg_path.replace("/", ".") if pkg_path and pkg_path != "." else ""
    parts = os.path.dirname(normalized).split("/")
    parts = [p for p in parts if p and ":" not in p]
    return ".".join(parts) if parts else ""


def atomic_write(file_path: str, content: str) -> None:
    """Write content atomically via temp file + rename."""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    tmp = file_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(content)
    os.replace(tmp, file_path)


def infer_package_purpose(pkg_name: str) -> str:
    """Infer a package's purpose from its name."""
    lower = pkg_name.lower()
    mapping = [
        ("controller", "HTTP request handling"), ("api", "HTTP request handling"),
        ("service", "Business logic"), ("repository", "Data access"),
        ("dao", "Data access"), ("model", "Domain model"),
        ("domain", "Domain model"), ("entity", "Domain model"),
        ("dto", "Data transfer objects"), ("config", "Configuration"),
        ("util", "Utility functions"), ("helper", "Utility functions"),
        ("security", "Security/Authentication"), ("auth", "Security/Authentication"),
        ("test", "Testing"),
    ]
    for keyword, purpose in mapping:
        if keyword in lower:
            return purpose
    return "Application logic"


def infer_responsibility(class_name: str) -> str:
    """Infer a class's responsibility from its name."""
    mapping = [
        ("Controller", "HTTP request handling"), ("Handler", "HTTP request handling"),
        ("Service", "Business logic"), ("Repository", "Data access"),
        ("Dao", "Data access"), ("Config", "Configuration"),
        ("Dto", "Data transfer object"), ("DTO", "Data transfer object"),
        ("Entity", "Domain model"), ("Model", "Domain model"),
        ("Exception", "Error handling"), ("Error", "Error handling"),
        ("Test", "Test class"), ("Spec", "Test class"),
        ("Utils", "Utility functions"), ("Helper", "Utility functions"),
        ("Client", "External service client"), ("Factory", "Object creation"),
    ]
    for suffix, resp in mapping:
        if class_name.endswith(suffix):
            return resp
    return "Application component"

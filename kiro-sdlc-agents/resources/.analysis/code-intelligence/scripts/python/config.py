"""Configuration loading for the Code Intelligence indexer."""

import json
import os
from typing import Dict, List

DEFAULT_CONFIG: Dict[str, List[str]] = {
    "includedExtensions": [
        ".kt", ".java", ".ts", ".tsx", ".js", ".jsx", ".py", ".go",
        ".rs", ".cs", ".gradle.kts", ".gradle", ".yml", ".yaml",
        ".properties", ".xml", ".json", ".sql", ".toml", ".cfg", ".ini"
    ],
    "excludedDirectories": [
        "build", "dist", "out", "target", ".gradle", ".git", ".analysis",
        "node_modules", ".idea", ".kiro", ".vscode", "__pycache__",
        ".mypy_cache", "vendor", "bin", "obj"
    ],
    "excludedFilePatterns": [
        "*.generated.*", "*.min.*", "*.map", "*.lock", "*.sum"
    ]
}

EXTENSION_MAP = {
    ".kt": "kotlin", ".java": "java", ".ts": "typescript", ".tsx": "typescript",
    ".js": "javascript", ".jsx": "javascript", ".py": "python", ".go": "go",
    ".rs": "rust", ".cs": "csharp", ".gradle": "gradle", ".yml": "yaml",
    ".yaml": "yaml", ".xml": "xml", ".sql": "sql", ".json": "json",
    ".properties": "properties", ".toml": "config", ".cfg": "config", ".ini": "config"
}

COMPOUND_EXTENSIONS = [(".gradle.kts", "gradle")]

SOURCE_EXTENSIONS = {
    ".kt": "kotlin", ".java": "java", ".ts": "typescript", ".tsx": "typescript",
    ".js": "javascript", ".jsx": "javascript", ".py": "python", ".go": "go",
    ".rs": "rust", ".cs": "csharp"
}


def load_config(config_path: str) -> dict:
    """Load index-config.json or return defaults."""
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return DEFAULT_CONFIG

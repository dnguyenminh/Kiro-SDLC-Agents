"""File scanner — discovers and filters source files for indexing."""

import os
from typing import List

from config import DEFAULT_CONFIG
from utils import compute_hash, glob_match, map_extension


def scan_files(config: dict, source_dirs: List[str], root_dir: str) -> List[dict]:
    """Recursively scan source directories and return matching files."""
    results = []
    for src_dir in source_dirs:
        abs_dir = os.path.join(root_dir, src_dir)
        _walk_directory(abs_dir, root_dir, config, results)
    return results


def _walk_directory(directory: str, root_dir: str, config: dict, results: list):
    """Recursively walk a directory collecting matching files."""
    try:
        entries = os.scandir(directory)
    except OSError:
        return
    for entry in entries:
        if entry.is_dir(follow_symlinks=False):
            if entry.name in config.get("excludedDirectories", DEFAULT_CONFIG["excludedDirectories"]):
                continue
            _walk_directory(entry.path, root_dir, config, results)
        elif entry.is_file():
            rel_path = os.path.relpath(entry.path, root_dir).replace("\\", "/")
            if _should_include(rel_path, config):
                try:
                    content_hash = compute_hash(entry.path)
                    language = map_extension(rel_path)
                    results.append({"filePath": rel_path, "contentHash": content_hash, "language": language})
                except OSError:
                    pass


def _should_include(file_path: str, config: dict) -> bool:
    """Check if a file should be included based on config rules."""
    basename = os.path.basename(file_path)
    included_exts = config.get("includedExtensions", DEFAULT_CONFIG["includedExtensions"])
    excluded_dirs = config.get("excludedDirectories", DEFAULT_CONFIG["excludedDirectories"])
    excluded_patterns = config.get("excludedFilePatterns", DEFAULT_CONFIG["excludedFilePatterns"])

    if not any(basename.endswith(ext) for ext in included_exts):
        return False
    for seg in file_path.replace("\\", "/").split("/"):
        if seg in excluded_dirs:
            return False
    for pattern in excluded_patterns:
        if glob_match(basename, pattern):
            return False
    return True

"""File Resolver — resolves import paths to indexed file paths. KSA-179."""

from __future__ import annotations

import posixpath
import sqlite3


class FileResolver:
    """Resolves file paths and import targets against the indexed file set."""

    EXTENSIONS = [".ts", ".js", ".tsx", ".jsx", ".kt", ".py", "/index.ts", "/index.js"]

    STDLIB_MODULES = frozenset([
        # Node.js
        "fs", "path", "http", "https", "url", "crypto", "os", "util",
        "stream", "events", "child_process", "cluster", "net", "dns",
        "tls", "readline", "zlib", "buffer", "assert", "querystring",
        "string_decoder", "timers", "vm", "worker_threads",
        # Python
        "sys", "json", "re", "math", "datetime", "collections",
        "itertools", "functools", "typing", "pathlib", "abc",
        "dataclasses", "enum", "logging", "unittest", "io",
        "subprocess", "threading", "multiprocessing",
    ])

    def __init__(self, conn: sqlite3.Connection, workspace_root: str) -> None:
        self._workspace_root = workspace_root
        self._indexed_files = self._load_indexed_files(conn)

    def resolve_file(self, input_path: str) -> str | None:
        """Resolve an input file path to a canonical indexed path."""
        if input_path in self._indexed_files:
            return input_path

        normalized = input_path.replace("\\", "/")
        if normalized in self._indexed_files:
            return normalized

        # Strip workspace root prefix
        if input_path.startswith(self._workspace_root):
            relative = input_path[len(self._workspace_root):].lstrip("/\\").replace("\\", "/")
            if relative in self._indexed_files:
                return relative

        with_ext = self._find_with_extensions(normalized)
        if with_ext:
            return with_ext

        # Fuzzy: find by basename
        basename = posixpath.basename(input_path)
        matches = [f for f in self._indexed_files if f.endswith(basename) or f.endswith("/" + basename)]
        if len(matches) == 1:
            return matches[0]

        return None

    def resolve_import_target(self, source_file: str, target: str) -> str | None:
        """Resolve an import target relative to a source file."""
        if target.startswith("."):
            dir_path = posixpath.dirname(source_file.replace("\\", "/"))
            resolved = posixpath.normpath(posixpath.join(dir_path, target))
            return self._find_with_extensions(resolved)
        return self._find_with_extensions(target)

    def is_external(self, target: str) -> bool:
        """Check if a target is an external (non-project) dependency."""
        base = target.split("/")[0].split(".")[0]
        if base in self.STDLIB_MODULES:
            return True
        if not target.startswith(".") and not target.startswith("/"):
            return self.resolve_import_target("", target) is None
        return False

    def refresh(self, conn: sqlite3.Connection) -> None:
        """Refresh the indexed files set after re-indexing."""
        self._indexed_files = self._load_indexed_files(conn)

    def _find_with_extensions(self, base_path: str) -> str | None:
        if base_path in self._indexed_files:
            return base_path
        for ext in self.EXTENSIONS:
            candidate = base_path + ext
            if candidate in self._indexed_files:
                return candidate
        return None

    @staticmethod
    def _load_indexed_files(conn: sqlite3.Connection) -> set[str]:
        cur = conn.execute("SELECT relative_path FROM files")
        return {row[0] for row in cur.fetchall()}

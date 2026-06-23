"""Indexing engine — full scan and incremental indexing."""

import sys
from pathlib import Path
from typing import Any

from .db import DatabaseManager
from .extractor import extract_symbols
from .patterns import detect_patterns, infer_module_purpose
from .scanner import scan_workspace, scan_single_file


class IndexingEngine:
    """Coordinates file scanning, symbol extraction, and DB updates."""

    def __init__(self, db: DatabaseManager, config: dict[str, Any]) -> None:
        self._db = db
        self._config = config
        self._indexing = False

    @property
    def is_running(self) -> bool:
        """Check if indexer is currently running."""
        return self._indexing

    def run_full_index(self) -> None:
        """Run a full workspace index."""
        if self._indexing:
            return
        self._indexing = True
        _log("Starting full index...")
        try:
            # Detect SFDX project and log it
            if self._is_sfdx_project():
                _log("SFDX project detected -- Salesforce extensions enabled")
            files = scan_workspace(self._config)
            _log(f"Found {len(files)} files to index")
            self._index_files(files)
            self._update_modules()
            self._detect_and_store_patterns()
            _log("Full index complete")
        finally:
            self._indexing = False

    def _is_sfdx_project(self) -> bool:
        """Detect if workspace is a Salesforce DX project (sfdx-project.json exists)."""
        workspace = Path(self._config["workspace"])
        return (workspace / "sfdx-project.json").exists()

    def index_single_file(self, file_path: str) -> None:
        """Index a single file (incremental update)."""
        info = scan_single_file(file_path, self._config["workspace"])
        if not info:
            return
        if self._is_unchanged(info):
            return
        self._upsert_file(info)

    def remove_file(self, relative_path: str) -> None:
        """Remove a file from the index."""
        conn = self._db.conn
        conn.execute("DELETE FROM files WHERE relative_path = ?", (relative_path,))
        conn.commit()

    def _index_files(self, files: list[dict[str, Any]]) -> None:
        conn = self._db.conn
        for file_info in files:
            if self._is_unchanged(file_info):
                continue
            self._upsert_file(file_info)
        conn.commit()

    def _upsert_file(self, file_info: dict[str, Any]) -> None:
        conn = self._db.conn
        module = _detect_module(file_info["relative_path"])
        cur = conn.execute(
            """INSERT OR REPLACE INTO files
               (path, relative_path, language, module, content_hash, size_bytes, line_count, last_indexed)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
            (file_info["absolute_path"], file_info["relative_path"],
             file_info["language"], module, file_info["content_hash"],
             file_info["size_bytes"], file_info["line_count"]),
        )
        file_id = cur.lastrowid
        conn.execute("DELETE FROM symbols WHERE file_id = ?", (file_id,))
        self._index_symbols(file_info, file_id)

    def _index_symbols(self, file_info: dict[str, Any], file_id: int) -> None:
        try:
            content = Path(file_info["absolute_path"]).read_text(encoding="utf-8", errors="replace")
            symbols = extract_symbols(content, file_info["language"])
            conn = self._db.conn
            for sym in symbols:
                conn.execute(
                    """INSERT INTO symbols
                       (file_id, name, kind, signature, start_line, end_line, parent_symbol, visibility, doc_comment)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (file_id, sym["name"], sym["kind"], sym["signature"],
                     sym["start_line"], sym["end_line"], sym["parent_symbol"],
                     sym["visibility"], sym["doc_comment"]),
                )
        except OSError as e:
            _log(f"Error indexing {file_info['relative_path']}: {e}")

    def _is_unchanged(self, file_info: dict[str, Any]) -> bool:
        row = self._db.conn.execute(
            "SELECT content_hash FROM files WHERE relative_path = ?",
            (file_info["relative_path"],),
        ).fetchone()
        if row is None:
            return False
        return row["content_hash"] == file_info["content_hash"]

    def _update_modules(self) -> None:
        conn = self._db.conn
        conn.execute("DELETE FROM modules")
        rows = conn.execute("""
            SELECT module, language, COUNT(*) as file_count,
                   (SELECT COUNT(*) FROM symbols WHERE file_id IN
                    (SELECT id FROM files WHERE module = f.module)) as symbol_count
            FROM files f
            WHERE module IS NOT NULL
            GROUP BY module
        """).fetchall()
        for row in rows:
            conn.execute(
                "INSERT INTO modules (name, root_path, language, file_count, symbol_count) VALUES (?, ?, ?, ?, ?)",
                (row["module"], row["module"], row["language"], row["file_count"], row["symbol_count"]),
            )
        conn.commit()

    def _detect_and_store_patterns(self) -> None:
        """Detect patterns for all modules and store in DB."""
        import time
        start = time.time()
        conn = self._db.conn
        modules = conn.execute("SELECT name FROM modules").fetchall()
        for mod in modules:
            name = mod["name"]
            try:
                symbols = conn.execute(
                    "SELECT name, kind, signature, visibility FROM symbols "
                    "WHERE file_id IN (SELECT id FROM files WHERE module = ?)",
                    (name,),
                ).fetchall()
                classes = [dict(s) for s in symbols if s["kind"] in ("class", "interface")]
                functions = [dict(s) for s in symbols if s["kind"] in ("function", "method")]
                patterns = detect_patterns(classes, functions, [])
                purpose = infer_module_purpose(name, classes, [])
                conn.execute(
                    "UPDATE modules SET di_style=?, error_handling=?, naming_convention=?,"
                    " logging_framework=?, testing_framework=?, purpose=? WHERE name=?",
                    (patterns["di_style"], patterns["error_handling"], patterns["naming"],
                     patterns["logging"], patterns["testing"], purpose, name),
                )
            except Exception as e:
                _log(f"Pattern detection failed for {name}: {e}")
        conn.commit()
        elapsed = int((time.time() - start) * 1000)
        _log(f"Pattern detection: {elapsed}ms")


def _detect_module(relative_path: str) -> str:
    """Detect module from relative path. Supports SFDX project structure."""
    parts = relative_path.split("/")
    # SFDX structure: force-app/main/default/classes/MyClass.cls
    if len(parts) >= 4 and parts[0] == "force-app":
        # Return the metadata type folder (classes, triggers, flows, objects, lwc, aura)
        return parts[3] if len(parts) > 3 else parts[2]
    if len(parts) >= 2 and parts[0] == "src":
        return parts[1]
    if parts:
        return parts[0]
    return "root"


def _log(msg: str) -> None:
    print(f"[indexer] {msg}", file=sys.stderr, flush=True)

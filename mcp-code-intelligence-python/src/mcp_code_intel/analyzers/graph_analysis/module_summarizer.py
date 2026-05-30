"""KSA-163: Module Summarizer."""
from __future__ import annotations
import sqlite3
from . import ModuleSummary
from .utils import GraphLoader
from .circular_dep_detector import CircularDepDetector
from .hot_path_analyzer import HotPathAnalyzer
from .dead_import_detector import DeadImportDetector


class ModuleSummarizer:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._gl = GraphLoader(conn)

    def summarize(self, module_name: str | None = None) -> list[ModuleSummary]:
        modules = self._get_modules(module_name)
        results = []
        for name, fc, sc in modules:
            cd = CircularDepDetector(self._gl).detect(module=name)
            hp = HotPathAnalyzer(self._gl).analyze(module=name, limit=5)
            di = DeadImportDetector(self._conn).detect(module=name)
            avg = self._avg_complexity(name)
            results.append(ModuleSummary(name, fc, sc, len(cd), hp, len(di), avg))
        return results

    def _get_modules(self, name: str | None) -> list[tuple[str, int, int]]:
        sql = "SELECT name, file_count, symbol_count FROM modules"
        params: list = []
        if name: sql += " WHERE name = ?"; params.append(name)
        return self._conn.execute(sql, params).fetchall()

    def _avg_complexity(self, module: str) -> float | None:
        row = self._conn.execute(
            "SELECT AVG(c.cyclomatic_complexity) FROM complexity c "
            "JOIN symbols s ON s.id = c.symbol_id JOIN files f ON f.id = s.file_id "
            "WHERE f.module = ?", (module,),
        ).fetchone()
        return row[0] if row and row[0] is not None else None

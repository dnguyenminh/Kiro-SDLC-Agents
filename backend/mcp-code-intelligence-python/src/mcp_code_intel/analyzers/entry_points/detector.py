"""KSA-162: Entry Point Detector — Main orchestrator."""
from __future__ import annotations
import sqlite3
from . import EntryPoint, EntryPointFilters, EntryPointQueryResult, SymbolInput
from .pattern_registry import PatternRegistry
from .framework_detector import FrameworkDetector
from .detectors.http_handler import HTTPHandlerDetector
from .detectors.main_detector import MainDetector
from .detectors.cli_detector import CLIDetector
from .detectors.event_detector import EventDetector
from .store import EntryPointStore


class EntryPointDetector:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._registry = PatternRegistry()
        self._framework_detector = FrameworkDetector(self._registry)
        self._http_detector = HTTPHandlerDetector(self._registry)
        self._main_detector = MainDetector(self._registry)
        self._cli_detector = CLIDetector()
        self._event_detector = EventDetector()
        self._store = EntryPointStore(conn)

    def detect_file(self, file_path: str, source: str, language: str, symbols: list[SymbolInput]) -> list[EntryPoint]:
        all_eps: list[EntryPoint] = []
        framework = self._framework_detector.detect(source, language)
        if framework:
            all_eps.extend(self._http_detector.detect_from_symbols(symbols, framework.name, source))
        all_eps.extend(self._main_detector.detect(symbols, source, language))
        all_eps.extend(self._cli_detector.detect(symbols, source))
        all_eps.extend(self._event_detector.detect(symbols, source))
        if all_eps:
            self._store.upsert_batch(all_eps)
        return all_eps

    def query(self, filters: EntryPointFilters) -> EntryPointQueryResult:
        return self._store.query(filters)

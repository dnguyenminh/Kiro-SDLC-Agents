"""KSA-162: Main Function Detector."""
from __future__ import annotations
from .. import EntryPoint, EntryType, Confidence, SymbolInput
from ..pattern_registry import PatternRegistry


class MainDetector:
    def __init__(self, registry: PatternRegistry) -> None:
        self._registry = registry

    def detect(self, symbols: list[SymbolInput], source: str, language: str) -> list[EntryPoint]:
        main_pattern = self._registry.get_main_pattern(language)
        if not main_pattern:
            return []
        results = [self._create(sym) for sym in symbols if sym.name in ("main", "__main__")]
        if not results and main_pattern[0] in source:
            lines = source.split("\n")
            idx = next((i for i, l in enumerate(lines) if main_pattern[0] in l), -1)
            if idx >= 0 and symbols:
                closest = min(symbols, key=lambda s: abs(s.start_line - idx))
                results.append(self._create(closest))
        return results

    def _create(self, sym: SymbolInput) -> EntryPoint:
        return EntryPoint(
            symbol_id=sym.id, symbol_name=sym.name,
            file_path=sym.file_path, start_line=sym.start_line,
            entry_type=EntryType.MAIN, confidence=Confidence.High,
        )

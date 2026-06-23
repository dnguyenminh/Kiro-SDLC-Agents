"""KSA-162: Framework Detector."""
from __future__ import annotations
from . import FrameworkInfo, Confidence
from .pattern_registry import PatternRegistry


class FrameworkDetector:
    def __init__(self, registry: PatternRegistry) -> None:
        self._registry = registry

    def detect(self, source: str, language: str) -> FrameworkInfo | None:
        frameworks = self._registry.get_frameworks_for_language(language)
        if not frameworks:
            return None
        best: tuple[str, int] | None = None
        for name, patterns in frameworks:
            score = sum(1 for imp in patterns.imports if imp in source)
            if score > 0 and (best is None or score > best[1]):
                best = (name, score)
        if not best:
            return None
        confidence = Confidence.High if best[1] >= 2 else Confidence.Medium
        return FrameworkInfo(best[0], language, confidence)

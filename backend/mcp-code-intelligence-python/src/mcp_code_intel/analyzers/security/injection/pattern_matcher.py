"""
KSA-165: Pattern Matcher — Base class for injection pattern matching.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Optional
from ..types import TaintPath, InjectionPattern, Finding


class MatchContext:
    __slots__ = ("file_path", "function_name", "language")

    def __init__(self, file_path: str, function_name: str, language: str):
        self.file_path = file_path
        self.function_name = function_name
        self.language = language


class PatternMatcher(ABC):
    @property
    @abstractmethod
    def category(self) -> str: ...

    @property
    @abstractmethod
    def patterns(self) -> list[InjectionPattern]: ...

    def match(self, taint_path: TaintPath, context: MatchContext) -> Optional[Finding]:
        """Check if a taint path matches any pattern in this category."""
        for pattern in self.patterns:
            if (self._matches_sink(taint_path.sink.function, pattern) and
                self._has_dangerous_op(taint_path, pattern.dangerous_ops) and
                not self._has_safe_pattern(taint_path, pattern.safe_patterns)):
                return self._create_finding(taint_path, pattern, context)
        return None

    def _matches_sink(self, sink_function: str, pattern: InjectionPattern) -> bool:
        return any(sp in sink_function for sp in pattern.sink_patterns)

    def _has_dangerous_op(self, path: TaintPath, dangerous_ops: list[str]) -> bool:
        if not dangerous_ops:
            return True
        return any(step.action in dangerous_ops for step in path.chain)

    def _has_safe_pattern(self, path: TaintPath, safe_patterns: list[str]) -> bool:
        if not safe_patterns:
            return False
        sink_expr = path.sink.expression
        for safe in safe_patterns:
            if safe in sink_expr:
                return True
        return any(step.action == "sanitize" for step in path.chain)

    def _create_finding(self, path: TaintPath, pattern: InjectionPattern, context: MatchContext) -> Finding:
        confidence = self._compute_confidence(path, pattern)
        return Finding(
            id=f"{pattern.category.upper()}-{pattern.id}-{context.file_path}:{path.sink.line}",
            rule_id=f"INJ-{pattern.category.upper()}-{str(pattern.id).zfill(3)}",
            category=pattern.category,
            pattern=pattern,
            taint_path=path,
            severity=pattern.severity,
            confidence=confidence,
            cwe=pattern.cwe,
            message=f"{pattern.name}: Tainted data from {path.source.type} flows to {path.sink.function} without sanitization",
            remediation=pattern.description,
            location={"file": context.file_path, "start_line": path.source.line, "end_line": path.sink.line},
            suppressed=False,
        )

    def _compute_confidence(self, path: TaintPath, pattern: InjectionPattern) -> str:
        if path.length <= 3:
            return "High"
        if path.length <= 6:
            return "Medium"
        return "Low"

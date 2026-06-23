"""KSA-161: Core complexity calculation engine."""
from __future__ import annotations
from typing import Any, Optional
from .models import ComplexityBreakdown
from .base_counter import BaseNodeCounter
from .counters import TypeScriptCounter, PythonCounter, JavaCounter, KotlinCounter, GoCounter


class ComplexityCalculator:
    def __init__(self) -> None:
        self._counters: dict[str, BaseNodeCounter] = {}
        for counter in [TypeScriptCounter(), PythonCounter(), JavaCounter(), KotlinCounter(), GoCounter()]:
            self._counters[counter.language] = counter
        self._counters["javascript"] = TypeScriptCounter()

    def calculate(self, body_node: Any, language: str) -> Optional[ComplexityBreakdown]:
        counter = self._counters.get(language)
        if not counter:
            return None
        counts = counter.count_decision_points(body_node)
        nesting = counter.calculate_nesting_depth(body_node)
        early_returns = counter.count_early_returns(body_node)
        cc = 1 + counts.branches + counts.loops + counts.logical_ops + counts.exception_handlers
        return ComplexityBreakdown(
            cyclomatic_complexity=cc,
            branches=counts.branches, loops=counts.loops,
            logical_ops=counts.logical_ops, exception_handlers=counts.exception_handlers,
            nesting_depth=nesting, early_returns=early_returns,
        )

    def supports_language(self, language: str) -> bool:
        return language in self._counters

    def get_supported_languages(self) -> list[str]:
        return list(self._counters.keys())

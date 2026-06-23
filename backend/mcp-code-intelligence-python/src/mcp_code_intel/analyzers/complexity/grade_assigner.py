"""KSA-161: Grade assignment based on cyclomatic complexity thresholds."""
from __future__ import annotations
from .models import Grade, GradeThresholds


class GradeAssigner:
    def __init__(self, thresholds: GradeThresholds | None = None):
        self._thresholds = thresholds or GradeThresholds()

    def assign_grade(self, cc: int) -> Grade:
        if cc <= self._thresholds.a:
            return Grade.A
        if cc <= self._thresholds.b:
            return Grade.B
        if cc <= self._thresholds.c:
            return Grade.C
        if cc <= self._thresholds.d:
            return Grade.D
        return Grade.F

    def get_thresholds(self) -> GradeThresholds:
        return GradeThresholds(
            a=self._thresholds.a, b=self._thresholds.b,
            c=self._thresholds.c, d=self._thresholds.d,
        )

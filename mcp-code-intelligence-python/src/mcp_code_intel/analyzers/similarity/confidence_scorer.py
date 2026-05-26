"""Score dead code confidence based on multiple heuristic factors."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ScoredCandidate:
    """A dead code candidate with confidence score."""
    function_id: str
    name: str
    file_path: str
    start_line: int
    end_line: int
    confidence: int  # 0-100
    reasons: list[str]


class ConfidenceScorer:
    """Score dead code confidence based on multiple factors.

    Higher score = more likely to be truly dead code.
    Negative factors reduce confidence (e.g., dynamic dispatch patterns).
    """

    FACTORS: dict[str, int] = {
        "no_callers": 40,
        "not_exported": 20,
        "no_tests": 15,
        "has_deprecated": 15,
        "dynamic_dispatch": -30,
        "config_reference": -20,
        "recently_modified": -10,
    }

    def score(self, function_id: str, context: dict) -> tuple[int, list[str]]:
        """Compute confidence score (0-100) and list of contributing reasons.

        Args:
            function_id: Unique identifier for the function.
            context: Dict with keys matching FACTORS (bool values).

        Returns:
            Tuple of (score, reasons).
        """
        score = 0
        reasons: list[str] = []

        for factor, impact in self.FACTORS.items():
            if context.get(factor, False):
                score += impact
                reasons.append(f"{factor} ({'+' if impact > 0 else ''}{impact})")

        # Clamp to 0-100
        final_score = max(0, min(100, score))
        return final_score, reasons

"""CaptureFilter — determines what content is worth auto-capturing."""

from __future__ import annotations

_DECISION_KEYWORDS = [
    "decided", "chose", "selected", "approach", "architecture",
    "design decision", "trade-off", "alternative",
]

_ERROR_KEYWORDS = [
    "error", "failed", "exception", "bug", "fix", "root cause",
    "workaround", "solution", "resolved",
]


def is_decision_content(text: str) -> bool:
    """Check if text contains decision-related content."""
    lower = text.lower()
    return any(kw in lower for kw in _DECISION_KEYWORDS)


def is_error_content(text: str) -> bool:
    """Check if text contains error pattern content."""
    lower = text.lower()
    return any(kw in lower for kw in _ERROR_KEYWORDS)


def is_substantial(text: str, min_length: int = 50) -> bool:
    """Check if content is substantial enough to capture."""
    return len(text.strip()) >= min_length


def classify_content(text: str) -> str:
    """Determine the best knowledge type for content."""
    if is_decision_content(text):
        return "DECISION"
    if is_error_content(text):
        return "ERROR_PATTERN"
    if "```" in text:
        return "PROCEDURE"
    return "CONTEXT"

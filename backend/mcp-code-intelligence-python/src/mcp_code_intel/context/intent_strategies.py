"""Intent Strategies — maps intent to prioritized section list. KSA-171."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SectionDef:
    name: str
    priority: int
    format: str  # 'full' | 'summary' | 'signatures'


@dataclass
class IntentStrategy:
    intent: str
    sections: list[SectionDef]


_STRATEGIES: dict[str, IntentStrategy] = {
    "explain": IntentStrategy(
        intent="explain",
        sections=[
            SectionDef("source", 1, "full"),
            SectionDef("doc_comment", 2, "full"),
            SectionDef("siblings", 3, "signatures"),
            SectionDef("imports", 4, "full"),
            SectionDef("callers", 5, "summary"),
            SectionDef("callees", 6, "summary"),
            SectionDef("type_definitions", 7, "full"),
        ],
    ),
    "modify": IntentStrategy(
        intent="modify",
        sections=[
            SectionDef("source", 1, "full"),
            SectionDef("callers", 2, "full"),
            SectionDef("callees", 3, "full"),
            SectionDef("tests", 4, "full"),
            SectionDef("imports", 5, "full"),
            SectionDef("type_definitions", 6, "full"),
            SectionDef("siblings", 7, "signatures"),
        ],
    ),
    "debug": IntentStrategy(
        intent="debug",
        sections=[
            SectionDef("source", 1, "full"),
            SectionDef("callers", 2, "full"),
            SectionDef("error_patterns", 3, "full"),
            SectionDef("recent_changes", 4, "full"),
            SectionDef("imports", 5, "full"),
            SectionDef("siblings", 6, "signatures"),
            SectionDef("callees", 7, "summary"),
        ],
    ),
    "test": IntentStrategy(
        intent="test",
        sections=[
            SectionDef("source", 1, "full"),
            SectionDef("tests", 2, "full"),
            SectionDef("test_patterns", 3, "full"),
            SectionDef("callees", 4, "full"),
            SectionDef("type_definitions", 5, "full"),
            SectionDef("mocks_needed", 6, "full"),
            SectionDef("siblings", 7, "signatures"),
        ],
    ),
}


def get_strategy(intent: str) -> IntentStrategy:
    """Get the intent strategy for a given intent. Falls back to 'explain'."""
    return _STRATEGIES.get(intent, _STRATEGIES["explain"])


def get_supported_intents() -> list[str]:
    """Get all supported intent names."""
    return list(_STRATEGIES.keys())

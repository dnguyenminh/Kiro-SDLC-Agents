"""TierBoost — tier-based score multiplier in search results."""

from __future__ import annotations

_FACTORS: dict[str, float] = {
    "SEMANTIC": 1.5,
    "PROCEDURAL": 1.3,
    "EPISODIC": 1.1,
    "WORKING": 1.0,
}


def factor(tier: str | None) -> float:
    """Get boost factor for a tier. Higher = ranked higher in results."""
    return _FACTORS.get(tier or "", 1.0)

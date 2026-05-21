"""CacheEntry — dataclass for adaptive token cache entries."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class CacheEntry:
    """Single cache entry mapping tokens → tool with confidence score."""

    tokens: frozenset[str]
    tool_name: str
    score: float
    registry_hash: str
    timestamp: str = field(default_factory=lambda: _now_iso())
    hit_count: int = 0
    last_hit: str = field(default_factory=lambda: _now_iso())
    tool_version: str = ""

    def touch(self) -> None:
        """Record a cache hit."""
        self.hit_count += 1
        self.last_hit = _now_iso()

    def is_stale(self, current_hash: str) -> bool:
        """Check if entry is stale (registry changed)."""
        return self.registry_hash != current_hash

    def to_dict(self) -> dict:
        """Serialize to JSON-compatible dict."""
        return {
            "tokens": sorted(self.tokens),
            "tool_name": self.tool_name,
            "score": self.score,
            "timestamp": self.timestamp,
            "hit_count": self.hit_count,
            "last_hit": self.last_hit,
            "tool_version": self.registry_hash,
        }

    @classmethod
    def from_dict(cls, data: dict) -> CacheEntry:
        """Deserialize from JSON dict."""
        return cls(
            tokens=frozenset(data.get("tokens", [])),
            tool_name=data.get("tool_name", ""),
            score=data.get("score", 0.0),
            registry_hash=data.get("tool_version", ""),
            timestamp=data.get("timestamp", _now_iso()),
            hit_count=data.get("hit_count", 0),
            last_hit=data.get("last_hit", _now_iso()),
        )


def _now_iso() -> str:
    """Current UTC time as ISO string."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

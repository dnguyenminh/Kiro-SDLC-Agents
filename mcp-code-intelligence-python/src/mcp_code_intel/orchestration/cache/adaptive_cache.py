"""AdaptiveTokenCache — self-learning fuzzy token cache for find_tools."""

from __future__ import annotations

import sys
from pathlib import Path

from .cache_entry import CacheEntry
from .invalidation import compute_token_overlap, evict_lru, invalidate_stale
from .persistence import DebouncedPersistence

DEFAULT_THRESHOLD = 0.80
DEFAULT_CONFIDENCE = 0.75


class AdaptiveTokenCache:
    """In-memory cache with fuzzy token matching and debounced persistence."""

    def __init__(self, cache_path: Path, debounce_s: float = 5.0) -> None:
        self._persistence = DebouncedPersistence(cache_path, debounce_s)
        self._entries: list[CacheEntry] = []
        self._loaded = False
        self._hits = 0
        self._misses = 0

    def find_fuzzy(
        self, tokens: set[str], threshold: float = DEFAULT_THRESHOLD
    ) -> CacheEntry | None:
        """Find best cache entry with ≥threshold token overlap."""
        self._ensure_loaded()
        best: CacheEntry | None = None
        best_overlap = 0.0
        for entry in self._entries:
            overlap = compute_token_overlap(tokens, entry.tokens)
            if overlap >= threshold and overlap > best_overlap:
                best = entry
                best_overlap = overlap
        if best is not None:
            self._hits += 1
            best.touch()
        else:
            self._misses += 1
        return best

    def add(
        self, tokens: set[str], tool_name: str, score: float, registry_hash: str
    ) -> None:
        """Add or update cache entry from embedding result."""
        self._ensure_loaded()
        if score < DEFAULT_CONFIDENCE:
            return
        existing = self._find_exact(tool_name, tokens)
        if existing:
            self._merge_entry(existing, tokens, score)
        else:
            entry = CacheEntry(
                tokens=frozenset(tokens),
                tool_name=tool_name,
                score=score,
                registry_hash=registry_hash,
            )
            self._entries.append(entry)
        self._entries = evict_lru(self._entries)

    def invalidate_stale(self, current_hash: str) -> int:
        """Remove entries with mismatched registry hash."""
        self._ensure_loaded()
        self._entries, removed = invalidate_stale(self._entries, current_hash)
        if removed > 0:
            self.schedule_persist()
        return removed

    def schedule_persist(self) -> None:
        """Schedule debounced write to disk."""
        data = self._serialize()
        self._persistence.schedule_write(data)

    def load(self) -> None:
        """Force load from disk."""
        self._do_load()

    @property
    def size(self) -> int:
        """Current number of active entries."""
        self._ensure_loaded()
        return len(self._entries)

    @property
    def hit_rate(self) -> float:
        """Cache hit rate (0.0 to 1.0)."""
        total = self._hits + self._misses
        return self._hits / total if total > 0 else 0.0

    def _ensure_loaded(self) -> None:
        """Lazy load on first access."""
        if not self._loaded:
            self._do_load()

    def _do_load(self) -> None:
        """Load cache entries from disk."""
        self._loaded = True
        data = self._persistence.load()
        if data is None:
            return
        raw_entries = data.get("entries", [])
        self._entries = [CacheEntry.from_dict(e) for e in raw_entries]
        _log(f"Loaded {len(self._entries)} cache entries")

    def _find_exact(self, tool_name: str, tokens: set[str]) -> CacheEntry | None:
        """Find existing entry for same tool with high overlap."""
        for entry in self._entries:
            if entry.tool_name == tool_name:
                overlap = compute_token_overlap(tokens, entry.tokens)
                if overlap >= 0.6:
                    return entry
        return None

    def _merge_entry(self, entry: CacheEntry, new_tokens: set[str], score: float) -> None:
        """Merge new tokens into existing entry, keep highest score."""
        merged = entry.tokens | frozenset(new_tokens)
        entry.tokens = merged
        entry.score = max(entry.score, score)
        entry.touch()

    def _serialize(self) -> dict:
        """Serialize cache to JSON-compatible dict."""
        return {
            "version": 1,
            "entries": [e.to_dict() for e in self._entries],
        }


def _log(msg: str) -> None:
    print(f"[adaptive-cache] {msg}", file=sys.stderr, flush=True)

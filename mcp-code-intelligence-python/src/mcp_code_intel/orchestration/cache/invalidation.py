"""Cache invalidation — stale entry detection and eviction logic."""

from __future__ import annotations

import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .cache_entry import CacheEntry

MAX_CACHE_SIZE = 10_000


def invalidate_stale(entries: list["CacheEntry"], current_hash: str) -> tuple[list["CacheEntry"], int]:
    """Remove entries with mismatched registry hash. Returns (kept, removed_count)."""
    kept = [e for e in entries if not e.is_stale(current_hash)]
    removed = len(entries) - len(kept)
    if removed > 0:
        _log(f"Invalidated {removed} stale entries (hash mismatch)")
    return kept, removed


def evict_lru(entries: list["CacheEntry"], max_size: int = MAX_CACHE_SIZE) -> list["CacheEntry"]:
    """Evict least-recently-used entries if over max_size."""
    if len(entries) <= max_size:
        return entries
    sorted_entries = sorted(entries, key=lambda e: e.last_hit, reverse=True)
    evicted = len(entries) - max_size
    _log(f"LRU eviction: removed {evicted} entries (size was {len(entries)})")
    return sorted_entries[:max_size]


def compute_token_overlap(query_tokens: set[str], entry_tokens: frozenset[str]) -> float:
    """Compute Jaccard-like overlap between query and entry tokens."""
    if not query_tokens or not entry_tokens:
        return 0.0
    intersection = query_tokens & entry_tokens
    union = query_tokens | entry_tokens
    return len(intersection) / len(union)


def _log(msg: str) -> None:
    print(f"[cache-invalidation] {msg}", file=sys.stderr, flush=True)

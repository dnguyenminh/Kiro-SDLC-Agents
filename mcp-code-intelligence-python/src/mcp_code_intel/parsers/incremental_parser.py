"""
KSA-171/178: Incremental Parser — Change tracking for efficient re-parsing.
Only re-parses changed files, caches AST results by content hash.
Port of IncrementalParser.kt for Python platform.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .grammar_registry import GrammarRegistry
from .types import ParseResult


@dataclass
class CachedAST:
    """Cached parse result with content hash for invalidation."""

    parse_result: ParseResult
    content_hash: str
    timestamp: float


class IncrementalParser:
    """Incremental parser with LRU cache eviction.

    Caches parse results by file path + content hash. Re-parses only when
    file content changes. Evicts oldest 25% when cache exceeds max size.
    """

    MAX_FILE_SIZE = 1_048_576  # 1MB

    def __init__(
        self,
        registry: GrammarRegistry,
        max_cache_size: int = 1000,
    ) -> None:
        self._registry = registry
        self._max_cache_size = max_cache_size
        self._cache: dict[str, CachedAST] = {}

    def parse(self, file_path: str, source: str) -> ParseResult:
        """Parse source code, returning cached result if content unchanged."""
        content_hash = self._compute_hash(source)
        cached = self._cache.get(file_path)

        if cached is not None and cached.content_hash == content_hash:
            return cached.parse_result

        parser = self._registry.get_parser(file_path)
        if parser is None:
            return ParseResult()

        result = parser.parse(source, file_path)
        self._evict_if_needed()
        self._cache[file_path] = CachedAST(
            parse_result=result,
            content_hash=content_hash,
            timestamp=time.time(),
        )
        return result

    def parse_file(self, file: Path, relative_path: str) -> ParseResult:
        """Parse a file from disk, with size guard."""
        if not file.exists() or file.stat().st_size > self.MAX_FILE_SIZE:
            return ParseResult()
        try:
            source = file.read_text(encoding="utf-8", errors="replace")
        except (OSError, IOError):
            return ParseResult()
        return self.parse(relative_path, source)

    def invalidate(self, file_path: str) -> None:
        """Remove a specific file from cache."""
        self._cache.pop(file_path, None)

    def invalidate_all(self) -> None:
        """Clear entire cache."""
        self._cache.clear()

    def get_cached_result(self, file_path: str) -> Optional[ParseResult]:
        """Get cached result without re-parsing. Returns None if not cached."""
        cached = self._cache.get(file_path)
        return cached.parse_result if cached else None

    def is_cached(self, file_path: str) -> bool:
        """Check if a file has a cached parse result."""
        return file_path in self._cache

    @property
    def cache_size(self) -> int:
        """Number of entries in cache."""
        return len(self._cache)

    def _evict_if_needed(self) -> None:
        """Evict oldest 25% of cache when at max capacity."""
        if len(self._cache) >= self._max_cache_size:
            sorted_entries = sorted(
                self._cache.items(), key=lambda x: x[1].timestamp
            )
            evict_count = len(self._cache) // 4
            for key, _ in sorted_entries[:evict_count]:
                del self._cache[key]

    @staticmethod
    def _compute_hash(content: str) -> str:
        """Compute SHA-256 hash (first 16 hex chars) of content."""
        digest = hashlib.sha256(content.encode()).hexdigest()
        return digest[:16]

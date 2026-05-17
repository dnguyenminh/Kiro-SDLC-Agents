"""Service layer — coordinates embedding generation and storage."""

import math
import struct
import sys

from .provider import EmbeddingProvider


class EmbeddingService:
    """Wraps provider + vector repo for embed-and-store workflow."""

    def __init__(self, provider: EmbeddingProvider, vector_repo) -> None:
        self._provider = provider
        self._vector_repo = vector_repo

    def embed_and_store(self, entry_id: int, text: str) -> bool:
        """Generate and store embedding for a knowledge entry."""
        vector = self._provider.embed(text)
        if vector is None:
            return False
        blob = self._float_list_to_bytes(vector)
        self._vector_repo.upsert(
            entry_id, blob, self._provider.model_name, self._provider.dimensions
        )
        return True

    def embed_batch_and_store(self, entries: list[tuple[int, str]]) -> int:
        """Embed multiple entries. Returns count of successes."""
        count = 0
        for entry_id, text in entries:
            if self.embed_and_store(entry_id, text):
                count += 1
        return count

    def embed(self, text: str) -> list[float] | None:
        """Get raw embedding for text (without storing)."""
        return self._provider.embed(text)

    def is_available(self) -> bool:
        """Check if embedding provider is available."""
        return self._provider.is_available()

    def close(self) -> None:
        """Release resources."""
        self._provider.close()

    @staticmethod
    def _float_list_to_bytes(arr: list[float]) -> bytes:
        """Convert float list to little-endian bytes."""
        return struct.pack(f"<{len(arr)}f", *arr)

    @staticmethod
    def _bytes_to_float_list(data: bytes) -> list[float]:
        """Convert little-endian bytes back to float list."""
        count = len(data) // 4
        return list(struct.unpack(f"<{count}f", data))

    @staticmethod
    def cosine_similarity(a: list[float], b: list[float]) -> float:
        """Cosine similarity between two vectors."""
        if len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        denom = norm_a * norm_b
        return dot / denom if denom > 0 else 0.0


def _log(msg: str) -> None:
    print(f"[embed-svc] {msg}", file=sys.stderr, flush=True)

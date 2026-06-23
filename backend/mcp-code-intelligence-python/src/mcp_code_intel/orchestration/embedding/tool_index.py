"""ToolEmbeddingIndex — pre-computed embedding vectors for all registered tools."""

from __future__ import annotations

import sys
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..registry import UnifiedRegistry

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


class ToolEmbeddingIndex:
    """Pre-computed tool embeddings for fast cosine similarity search."""

    def __init__(self) -> None:
        self._tool_names: list[str] = []
        self._vectors: "np.ndarray | None" = None
        self._built = False

    @property
    def is_built(self) -> bool:
        return self._built and self._vectors is not None

    @property
    def tool_count(self) -> int:
        return len(self._tool_names)

    def build(self, registry: "UnifiedRegistry", embed_fn) -> None:
        """Build index by embedding all tool descriptions."""
        if not HAS_NUMPY:
            _log("numpy not available — index disabled")
            return
        start = time.perf_counter()
        tools = registry.all_child_tools()
        if not tools:
            _log("No tools to index")
            return
        names: list[str] = []
        vectors: list[list[float]] = []
        for tool in tools:
            desc = tool.definition.get("description", "")
            text = f"{tool.name} {desc}"
            vec = embed_fn(text)
            if vec is not None:
                names.append(tool.name)
                vectors.append(vec)
        if not vectors:
            _log("No embeddings generated")
            return
        self._tool_names = names
        self._vectors = np.array(vectors, dtype=np.float32)
        self._built = True
        elapsed = (time.perf_counter() - start) * 1000
        _log(f"Index built: {len(names)} tools in {elapsed:.0f}ms")

    def search(self, query_vector: list[float], top_k: int = 5) -> list[tuple[str, float]]:
        """Find top-k tools by cosine similarity to query vector."""
        if not self.is_built or not HAS_NUMPY:
            return []
        q = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q)
        if q_norm == 0:
            return []
        q = q / q_norm
        # Vectorized cosine similarity (vectors already normalized at build)
        norms = np.linalg.norm(self._vectors, axis=1, keepdims=True)
        norms = np.maximum(norms, 1e-10)
        normalized = self._vectors / norms
        similarities = normalized @ q
        top_indices = np.argsort(similarities)[::-1][:top_k]
        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            if score > 0.0:
                results.append((self._tool_names[idx], score))
        return results

    def clear(self) -> None:
        """Clear the index."""
        self._tool_names = []
        self._vectors = None
        self._built = False


def _log(msg: str) -> None:
    print(f"[tool-index] {msg}", file=sys.stderr, flush=True)

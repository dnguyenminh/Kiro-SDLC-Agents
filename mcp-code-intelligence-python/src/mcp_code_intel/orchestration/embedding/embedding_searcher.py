"""EmbeddingSearcher — adapter connecting find_tools to ONNX embedding search."""

from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import TYPE_CHECKING

from .tool_index import ToolEmbeddingIndex

if TYPE_CHECKING:
    from ..models.model_manager import ModelManager
    from ..registry import UnifiedRegistry

DEFAULT_TIMEOUT_MS = 100


class EmbeddingSearcher:
    """Adapter: find_tools → ONNX embedding search with hard timeout."""

    def __init__(self, model_manager: "ModelManager", registry: "UnifiedRegistry") -> None:
        self._model_manager = model_manager
        self._registry = registry
        self._provider = None
        self._index = ToolEmbeddingIndex()
        self._initialized = False

    @property
    def is_available(self) -> bool:
        """True if ONNX model is loaded and ready."""
        if not self._initialized:
            self._try_init()
        return self._provider is not None and self._index.is_built

    def search(self, query: str, timeout_ms: int = DEFAULT_TIMEOUT_MS) -> tuple[str, float] | None:
        """Search tools by embedding similarity. Returns (tool_name, score) or None."""
        if not self.is_available:
            return None
        start = time.perf_counter()
        try:
            query_vec = self._provider.embed(query)
            if query_vec is None:
                return None
            elapsed_ms = (time.perf_counter() - start) * 1000
            if elapsed_ms > timeout_ms:
                _log(f"Embedding timeout: {elapsed_ms:.0f}ms > {timeout_ms}ms")
                return None
            results = self._index.search(query_vec, top_k=1)
            if not results:
                return None
            return results[0]
        except Exception as e:
            _log(f"Embedding search error: {e}")
            return None

    def rebuild_index(self) -> None:
        """Rebuild tool embedding index (after model switch or new tools)."""
        if self._provider is None:
            self._try_init()
        if self._provider is None:
            return
        self._index.build(self._registry, self._provider.embed)

    def _try_init(self) -> None:
        """Try to initialize ONNX provider and build index."""
        self._initialized = True
        try:
            provider = self._create_provider()
            if provider is None or not provider.is_available():
                return
            self._provider = provider
            self._index.build(self._registry, provider.embed)
        except ImportError:
            _log("ONNX runtime not available — embedding disabled")
        except Exception as e:
            _log(f"Embedding init failed: {e}")

    def _create_provider(self):
        """Create OnnxEmbeddingProvider for active model."""
        from ...memory.embedding.onnx_provider import OnnxEmbeddingProvider
        model_path = self._model_manager.get_active_model_path()
        model_file = model_path / "model.onnx"
        vocab_file = model_path / "vocab.txt"
        if not model_file.exists():
            # Try global .code-intel/models path
            alt_path = Path.home() / ".code-intel" / "models"
            model_file = alt_path / "model.onnx"
            vocab_file = alt_path / "vocab.txt"
        if not model_file.exists():
            return None
        return OnnxEmbeddingProvider(model_file, vocab_file)


def _log(msg: str) -> None:
    print(f"[embedding-searcher] {msg}", file=sys.stderr, flush=True)

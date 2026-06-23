"""Factory for creating EmbeddingService — tries Ollama, then ONNX local."""

import sys
from pathlib import Path
from typing import Any

from .provider import EmbeddingProvider
from .onnx_provider import OnnxEmbeddingProvider
from .ollama_provider import OllamaEmbeddingProvider
from .service import EmbeddingService


class EmbeddingFactory:
    """Create EmbeddingService: Ollama (if configured) → ONNX local → None."""

    @staticmethod
    def create(config: dict[str, Any], vector_repo) -> EmbeddingService | None:
        """Try providers in priority order, return first available."""
        service = EmbeddingFactory._try_ollama(config, vector_repo)
        if service:
            return service
        service = EmbeddingFactory._try_onnx(config, vector_repo)
        if service:
            return service
        return None

    @staticmethod
    def _try_ollama(config: dict, vector_repo) -> EmbeddingService | None:
        """Attempt Ollama provider if URL is configured."""
        from ...ollama import create_client

        client = create_client(config)
        if not client:
            return None
        model = config.get("ollama_model", "nomic-embed-text")
        provider = OllamaEmbeddingProvider(client, model)
        _log(f"Embedding: Ollama ({model})")
        return EmbeddingService(provider, vector_repo)

    @staticmethod
    def _try_onnx(config: dict, vector_repo) -> EmbeddingService | None:
        """Attempt local ONNX provider if model files exist."""
        workspace = config.get("workspace", "")
        model_path = EmbeddingFactory._resolve_model(workspace)
        vocab_path = EmbeddingFactory._resolve_vocab(workspace)
        if not model_path or not vocab_path:
            _log("ONNX model not found. Place model.onnx + vocab.txt in .code-intel/models/")
            return None
        try:
            provider = OnnxEmbeddingProvider(model_path, vocab_path)
            if not provider.is_available():
                return None
            _log("Embedding: ONNX local (all-MiniLM-L6-v2, 384d)")
            return EmbeddingService(provider, vector_repo)
        except Exception as e:
            _log(f"ONNX init failed: {e}")
            return None

    @staticmethod
    def _resolve_model(workspace: str) -> Path | None:
        """Find model.onnx in workspace or home .code-intel/models/."""
        candidates = [
            Path(workspace) / ".code-intel" / "models" / "model.onnx",
            Path(workspace) / ".code-intel" / "models" / "all-MiniLM-L6-v2.onnx",
            Path.home() / ".code-intel" / "models" / "model.onnx",
        ]
        return next((p for p in candidates if p.exists()), None)

    @staticmethod
    def _resolve_vocab(workspace: str) -> Path | None:
        """Find vocab.txt in workspace or home .code-intel/models/."""
        candidates = [
            Path(workspace) / ".code-intel" / "models" / "vocab.txt",
            Path.home() / ".code-intel" / "models" / "vocab.txt",
        ]
        return next((p for p in candidates if p.exists()), None)


def _log(msg: str) -> None:
    print(f"[embed-factory] {msg}", file=sys.stderr, flush=True)

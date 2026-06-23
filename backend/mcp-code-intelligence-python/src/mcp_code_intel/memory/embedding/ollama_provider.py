"""Ollama-backed embedding provider — wraps existing OllamaClient."""

import sys

from .provider import EmbeddingProvider
from ...ollama import OllamaClient


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Delegates embedding to remote Ollama server."""

    def __init__(self, client: OllamaClient, model: str) -> None:
        self._client = client
        self._model = model

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def dimensions(self) -> int:
        # nomic-embed-text default dimension
        return 768

    def embed(self, text: str) -> list[float] | None:
        """Get embedding from Ollama API."""
        return self._client.get_embedding(text)

    def is_available(self) -> bool:
        """Check if Ollama server is reachable."""
        return self._client.is_available()

    def close(self) -> None:
        pass


def _log(msg: str) -> None:
    print(f"[ollama-embed] {msg}", file=sys.stderr, flush=True)

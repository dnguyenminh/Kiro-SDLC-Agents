"""Abstract embedding provider interface — abstracts ONNX vs Ollama."""

from abc import ABC, abstractmethod


class EmbeddingProvider(ABC):
    """Contract for text-to-vector embedding."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Model name identifier."""
        ...

    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Output vector dimensions."""
        ...

    @abstractmethod
    def embed(self, text: str) -> list[float] | None:
        """Generate embedding vector for text. Returns None on failure."""
        ...

    def embed_batch(self, texts: list[str]) -> list[list[float] | None]:
        """Generate embeddings for multiple texts (batch)."""
        return [self.embed(t) for t in texts]

    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider is ready."""
        ...

    def close(self) -> None:
        """Release resources."""
        pass

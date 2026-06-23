"""ONNX Runtime embedding provider for all-MiniLM-L6-v2."""

import sys
from pathlib import Path

import numpy as np

from .provider import EmbeddingProvider
from .tokenizer import Tokenizer


class OnnxEmbeddingProvider(EmbeddingProvider):
    """Local ONNX inference — lazy loads model on first embed call."""

    _MAX_SEQ_LENGTH = 128

    def __init__(self, model_path: Path, vocab_path: Path) -> None:
        self._model_path = model_path
        self._vocab_path = vocab_path
        self._session = None
        self._tokenizer: Tokenizer | None = None

    @property
    def model_name(self) -> str:
        return "all-MiniLM-L6-v2"

    @property
    def dimensions(self) -> int:
        return 384

    def embed(self, text: str) -> list[float] | None:
        """Generate embedding for text via ONNX inference."""
        try:
            self._ensure_loaded()
            return self._run_inference(text)
        except Exception as e:
            _log(f"ONNX embed error: {e}")
            return None

    def is_available(self) -> bool:
        """Check if model and vocab files exist."""
        return self._model_path.exists() and self._vocab_path.exists()

    def close(self) -> None:
        """Release ONNX session."""
        self._session = None
        self._tokenizer = None

    def _ensure_loaded(self) -> None:
        """Lazy-load ONNX model on first use."""
        if self._session is not None:
            return
        try:
            import onnxruntime as ort
        except ImportError as e:
            raise ImportError(
                "onnxruntime not installed. Install with: "
                "pip install mcp-code-intel[embedding]"
            ) from e
        self._session = ort.InferenceSession(str(self._model_path))
        self._tokenizer = Tokenizer(self._vocab_path)
        _log(f"ONNX model loaded: {self._model_path}")

    def _run_inference(self, text: str) -> list[float]:
        """Tokenize, run ONNX, mean-pool, normalize."""
        encoded = self._tokenizer.encode(text, self._MAX_SEQ_LENGTH)
        inputs = {
            "input_ids": encoded["input_ids"].reshape(1, -1),
            "attention_mask": encoded["attention_mask"].reshape(1, -1),
            "token_type_ids": encoded["token_type_ids"].reshape(1, -1),
        }
        outputs = self._session.run(None, inputs)
        # Output shape: [1, seq_len, 384] — mean pooling
        token_embeddings = outputs[0][0]  # [seq_len, 384]
        pooled = self._mean_pool(token_embeddings, encoded["attention_mask"])
        return self._normalize(pooled).tolist()

    @staticmethod
    def _mean_pool(embeddings: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """Mean pooling over non-padding tokens."""
        mask_expanded = mask.reshape(-1, 1).astype(np.float32)
        summed = (embeddings * mask_expanded).sum(axis=0)
        count = mask_expanded.sum()
        return summed / max(count, 1.0)

    @staticmethod
    def _normalize(vector: np.ndarray) -> np.ndarray:
        """L2 normalize vector."""
        norm = np.linalg.norm(vector)
        return vector / norm if norm > 0 else vector


def _log(msg: str) -> None:
    print(f"[onnx-embed] {msg}", file=sys.stderr, flush=True)

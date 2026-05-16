"""Optional Ollama client — uses urllib.request (no external deps)."""

import json
import sys
import urllib.request
import urllib.error
from typing import Any


class OllamaClient:
    """Client for Ollama embedding API using stdlib urllib."""

    def __init__(self, base_url: str, model: str = "nomic-embed-text") -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model

    def get_embedding(self, text: str) -> list[float] | None:
        """Get embedding vector for text. Returns None on failure."""
        try:
            payload = json.dumps({"model": self._model, "prompt": text}).encode()
            req = urllib.request.Request(
                f"{self._base_url}/api/embeddings",
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                return data.get("embedding")
        except (urllib.error.URLError, OSError, json.JSONDecodeError) as e:
            _log(f"Ollama request failed: {e}")
            return None

    def is_available(self) -> bool:
        """Check if Ollama server is reachable."""
        try:
            req = urllib.request.Request(f"{self._base_url}/api/tags")
            with urllib.request.urlopen(req, timeout=5):
                return True
        except (urllib.error.URLError, OSError):
            return False


def create_client(config: dict[str, Any]) -> OllamaClient | None:
    """Create Ollama client if URL is configured."""
    url = config.get("ollama_url")
    if not url:
        return None
    model = config.get("ollama_model", "nomic-embed-text")
    client = OllamaClient(url, model)
    if client.is_available():
        _log(f"Ollama connected: {url} (model: {model})")
        return client
    _log(f"Ollama not available at {url}")
    return None


def _log(msg: str) -> None:
    print(f"[ollama] {msg}", file=sys.stderr, flush=True)

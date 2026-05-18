"""ModelDownloader — auto-download HuggingFace ONNX models."""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

MODEL_FILE = "model.onnx"
VOCAB_FILE = "vocab.txt"
BASE_URL = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main"


class ModelDownloader:
    """Handles model file download and path resolution."""

    def __init__(self, models_dir: Path) -> None:
        self._dir = models_dir

    @property
    def model_path(self) -> Path:
        return self._dir / MODEL_FILE

    @property
    def vocab_path(self) -> Path:
        return self._dir / VOCAB_FILE

    def is_model_present(self) -> bool:
        """Check if model files exist locally."""
        return self.model_path.exists() and self.vocab_path.exists()

    def download_if_missing(self) -> bool:
        """Download model files from HuggingFace. Returns True on success."""
        if self.is_model_present():
            return True
        self._dir.mkdir(parents=True, exist_ok=True)
        model_ok = self._download_file(f"{BASE_URL}/onnx/model.onnx", self.model_path)
        vocab_ok = self._download_file(f"{BASE_URL}/vocab.txt", self.vocab_path)
        if model_ok and vocab_ok:
            _log(f"Model downloaded to {self._dir}")
        return model_ok and vocab_ok

    def _download_file(self, url: str, target: Path) -> bool:
        """Download a single file."""
        if target.exists():
            return True
        _log(f"Downloading: {url}")
        try:
            urllib.request.urlretrieve(url, str(target))
            return True
        except Exception as e:
            _log(f"Download failed: {e}")
            if target.exists():
                target.unlink()
            return False


def _log(msg: str) -> None:
    print(f"[model] {msg}", file=sys.stderr, flush=True)

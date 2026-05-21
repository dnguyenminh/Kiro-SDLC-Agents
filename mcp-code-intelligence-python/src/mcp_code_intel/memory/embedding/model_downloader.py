"""ModelDownloader — auto-download HuggingFace ONNX models."""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

MODEL_FILE = "model.onnx"
VOCAB_FILE = "vocab.txt"
BASE_URL = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main"

# KSA-102: Known model URLs for multi-model support
MODEL_URLS: dict[str, dict[str, str]] = {
    "all-MiniLM-L6-v2": {
        "model": f"{BASE_URL}/onnx/model.onnx",
        "vocab": f"{BASE_URL}/vocab.txt",
    },
    "paraphrase-multilingual-MiniLM-L12-v2": {
        "model": "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/onnx/model.onnx",
        "vocab": "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/sentencepiece.bpe.model",
    },
}


class ModelDownloader:
    """Handles model file download and path resolution."""

    def __init__(self, models_dir: Path, model_name: str = "all-MiniLM-L6-v2") -> None:
        self._dir = models_dir
        self._model_name = model_name

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
        urls = MODEL_URLS.get(self._model_name, MODEL_URLS["all-MiniLM-L6-v2"])
        model_ok = self._download_file(urls["model"], self.model_path)
        vocab_ok = self._download_file(urls["vocab"], self.vocab_path)
        if model_ok and vocab_ok:
            _log(f"Model '{self._model_name}' downloaded to {self._dir}")
        return model_ok and vocab_ok

    def download_model(self, model_name: str, target_dir: Path) -> bool:
        """Download a specific model to a target directory."""
        urls = MODEL_URLS.get(model_name)
        if not urls:
            _log(f"Unknown model: {model_name}")
            return False
        target_dir.mkdir(parents=True, exist_ok=True)
        model_ok = self._download_file(urls["model"], target_dir / MODEL_FILE)
        vocab_ok = self._download_file(urls["vocab"], target_dir / VOCAB_FILE)
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

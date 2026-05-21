"""Model catalog — known embedding models with metadata."""

from __future__ import annotations

MODELS: dict[str, dict] = {
    "all-MiniLM-L6-v2": {
        "display_name": "English (Small, Fast)",
        "size_mb": 90,
        "languages": ["en"],
        "vocab_size": 30522,
        "dimensions": 384,
        "base_url": "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main",
        "files": {"model": "onnx/model.onnx", "vocab": "vocab.txt"},
    },
    "paraphrase-multilingual-MiniLM-L12-v2": {
        "display_name": "Multilingual (50+ languages)",
        "size_mb": 470,
        "languages": ["en", "vi", "zh", "ja", "ko", "fr", "de", "es", "ar", "ru"],
        "vocab_size": 250002,
        "dimensions": 384,
        "base_url": "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main",
        "files": {"model": "onnx/model.onnx", "vocab": "sentencepiece.bpe.model"},
    },
}

DEFAULT_MODEL = "all-MiniLM-L6-v2"


def get_model_info(name: str) -> dict | None:
    """Get model metadata by name."""
    return MODELS.get(name)


def list_models() -> list[dict]:
    """List all known models with metadata."""
    return [{"name": k, **v} for k, v in MODELS.items()]

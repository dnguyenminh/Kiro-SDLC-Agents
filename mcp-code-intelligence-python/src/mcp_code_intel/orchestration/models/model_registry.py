"""Model registry — tracks downloaded models and active selection."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from .model_catalog import DEFAULT_MODEL

REGISTRY_FILE = "registry.json"


class ModelRegistry:
    """Manages registry.json — tracks which models are downloaded and active."""

    def __init__(self, models_dir: Path) -> None:
        self._dir = models_dir
        self._path = models_dir / REGISTRY_FILE
        self._data: dict | None = None

    @property
    def active_model(self) -> str:
        """Get currently active model name."""
        data = self._load()
        return data.get("active_model", DEFAULT_MODEL)

    @property
    def models_dir(self) -> Path:
        return self._dir

    def is_downloaded(self, model_name: str) -> bool:
        """Check if a model is marked as downloaded."""
        data = self._load()
        return model_name in data.get("models", {})

    def model_path(self, model_name: str) -> Path:
        """Get path for a specific model."""
        return self._dir / model_name

    def mark_downloaded(self, model_name: str, size_bytes: int) -> None:
        """Mark a model as downloaded in registry."""
        data = self._load()
        models = data.setdefault("models", {})
        models[model_name] = {
            "path": str(self.model_path(model_name)),
            "downloaded_at": _now_iso(),
            "size_bytes": size_bytes,
        }
        data["last_updated"] = _now_iso()
        self._save(data)

    def set_active(self, model_name: str) -> None:
        """Set the active model."""
        data = self._load()
        data["active_model"] = model_name
        data["last_updated"] = _now_iso()
        self._save(data)
        _log(f"Active model set to: {model_name}")

    def get_downloaded_models(self) -> dict:
        """Get all downloaded model entries."""
        data = self._load()
        return data.get("models", {})

    def _load(self) -> dict:
        """Load registry from disk (cached)."""
        if self._data is not None:
            return self._data
        if not self._path.exists():
            self._data = {"active_model": DEFAULT_MODEL, "models": {}}
            return self._data
        try:
            text = self._path.read_text(encoding="utf-8")
            self._data = json.loads(text)
        except (json.JSONDecodeError, OSError) as e:
            _log(f"Registry load failed: {e}")
            self._data = {"active_model": DEFAULT_MODEL, "models": {}}
        return self._data

    def _save(self, data: dict) -> None:
        """Write registry to disk."""
        self._data = data
        try:
            self._dir.mkdir(parents=True, exist_ok=True)
            text = json.dumps(data, indent=2, ensure_ascii=False)
            self._path.write_text(text, encoding="utf-8")
        except OSError as e:
            _log(f"Registry save failed: {e}")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _log(msg: str) -> None:
    print(f"[model-registry] {msg}", file=sys.stderr, flush=True)

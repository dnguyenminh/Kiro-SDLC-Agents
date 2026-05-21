"""ModelManager — MCP tool for model lifecycle (list, download, status, switch)."""

from __future__ import annotations

import json
import sys
import threading
from pathlib import Path

from .model_catalog import DEFAULT_MODEL, get_model_info, list_models
from .model_registry import ModelRegistry

GLOBAL_MODELS_DIR = Path.home() / ".code-intel" / "models"


class ModelManager:
    """MCP tool: mem_model_manager — manages embedding model lifecycle."""

    def __init__(self, models_dir: Path | None = None) -> None:
        self._dir = models_dir or GLOBAL_MODELS_DIR
        self._registry = ModelRegistry(self._dir)
        self._download_lock = threading.Lock()
        self._downloading: set[str] = set()

    def execute(self, args: dict) -> str:
        """Handle action: list, download, status, switch."""
        action = args.get("action", "").lower()
        handlers = {
            "list": self._handle_list,
            "download": self._handle_download,
            "status": self._handle_status,
            "switch": self._handle_switch,
        }
        handler = handlers.get(action)
        if not handler:
            return json.dumps({"error": "INVALID_ACTION", "message": "Use: list, download, status, switch"})
        return handler(args)

    def get_active_model(self) -> str:
        """Return current active model name."""
        return self._registry.active_model

    def get_active_model_path(self) -> Path:
        """Return path to active model directory."""
        return self._registry.model_path(self._registry.active_model)

    def auto_download_if_needed(self) -> None:
        """Background download of default model on first need."""
        model_name = DEFAULT_MODEL
        model_path = self._registry.model_path(model_name)
        if (model_path / "model.onnx").exists():
            return
        if model_name in self._downloading:
            return
        thread = threading.Thread(
            target=self._background_download,
            args=(model_name,),
            daemon=True,
        )
        thread.start()

    def _handle_list(self, args: dict) -> str:
        """List all known models with download/active status."""
        models = list_models()
        result = []
        for m in models:
            name = m["name"]
            result.append({
                "name": name,
                "display_name": m["display_name"],
                "size_mb": m["size_mb"],
                "languages": m["languages"],
                "vocab_size": m["vocab_size"],
                "dimensions": m["dimensions"],
                "downloaded": self._registry.is_downloaded(name),
                "active": name == self._registry.active_model,
            })
        return json.dumps({"models": result})

    def _handle_download(self, args: dict) -> str:
        """Download a model by name."""
        model_name = args.get("model_name", "")
        info = get_model_info(model_name)
        if not info:
            return json.dumps({"error": "MODEL_NOT_FOUND", "message": f"Unknown model: {model_name}. Use action='list'"})
        return self._do_download(model_name, info)

    def _handle_status(self, args: dict) -> str:
        """Return current model status."""
        active = self._registry.active_model
        info = get_model_info(active) or {}
        return json.dumps({
            "active_model": active,
            "model_path": str(self._registry.model_path(active)),
            "dimensions": info.get("dimensions", 384),
            "languages": info.get("languages", []),
        })

    def _handle_switch(self, args: dict) -> str:
        """Switch active model."""
        model_name = args.get("model_name", "")
        if not get_model_info(model_name):
            return json.dumps({"error": "MODEL_NOT_FOUND", "message": f"Unknown model: {model_name}"})
        if not self._registry.is_downloaded(model_name):
            return json.dumps({"error": "MODEL_NOT_DOWNLOADED", "message": "Download first"})
        self._registry.set_active(model_name)
        return json.dumps({"success": True, "active_model": model_name})

    def _do_download(self, model_name: str, info: dict) -> str:
        """Synchronous download of model files."""
        import urllib.request
        model_dir = self._registry.model_path(model_name)
        model_dir.mkdir(parents=True, exist_ok=True)
        base_url = info["base_url"]
        files = info["files"]
        try:
            for key, rel_path in files.items():
                url = f"{base_url}/{rel_path}"
                target = model_dir / Path(rel_path).name
                if not target.exists():
                    _log(f"Downloading {url}")
                    urllib.request.urlretrieve(url, str(target))
            size = sum(f.stat().st_size for f in model_dir.iterdir() if f.is_file())
            self._registry.mark_downloaded(model_name, int(size))
            return json.dumps({"success": True, "model": model_name, "path": str(model_dir)})
        except Exception as e:
            return json.dumps({"error": "DOWNLOAD_FAILED", "message": str(e)})

    def _background_download(self, model_name: str) -> None:
        """Download model in background thread."""
        with self._download_lock:
            if model_name in self._downloading:
                return
            self._downloading.add(model_name)
        try:
            info = get_model_info(model_name)
            if info:
                _log(f"Auto-downloading model: {model_name}")
                self._do_download(model_name, info)
                _log(f"Auto-download complete: {model_name}")
        finally:
            with self._download_lock:
                self._downloading.discard(model_name)


def _log(msg: str) -> None:
    print(f"[model-manager] {msg}", file=sys.stderr, flush=True)

"""Config hot-reload watcher — polls file mtime for changes.

Behavioral parity with Kotlin ConfigWatcher.kt.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Callable

from ..config import OrchestrationConfig, load_orchestration_config


class ConfigWatcher:
    """Watches orchestration.json for changes via mtime polling."""

    def __init__(self, config_path: str, on_reload: Callable[[OrchestrationConfig], None]) -> None:
        self._config_path = config_path
        self._on_reload = on_reload
        self._task: asyncio.Task | None = None
        self._last_mtime: float = 0.0

    def start(self) -> None:
        """Start watching config file."""
        path = Path(self._config_path)
        if path.exists():
            self._last_mtime = path.stat().st_mtime
        self._task = asyncio.create_task(self._poll_loop())
        _log(f"ConfigWatcher started for: {self._config_path}")

    def stop(self) -> None:
        """Stop watching."""
        if self._task:
            self._task.cancel()
            self._task = None
        _log("ConfigWatcher stopped")

    async def _poll_loop(self) -> None:
        """Poll file mtime every 2 seconds."""
        try:
            while True:
                await asyncio.sleep(2.0)
                self._check_change()
        except asyncio.CancelledError:
            pass

    def _check_change(self) -> None:
        """Check if file mtime changed, trigger reload if so."""
        path = Path(self._config_path)
        if not path.exists():
            return
        current_mtime = path.stat().st_mtime
        if current_mtime > self._last_mtime:
            self._last_mtime = current_mtime
            self._handle_change()

    def _handle_change(self) -> None:
        """Re-parse config and call on_reload callback."""
        _log("Config file changed, reloading...")
        workspace = str(Path(self._config_path).parent.parent)
        config = load_orchestration_config(workspace)
        if config:
            self._on_reload(config)
            _log(f"Config reloaded: {len(config.enabled_servers())} servers")
        else:
            _log("Config reload failed — keeping current config")


def _log(msg: str) -> None:
    print(f"[orchestration] {msg}", file=sys.stderr, flush=True)

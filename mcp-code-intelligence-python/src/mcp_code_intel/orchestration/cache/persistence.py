"""DebouncedPersistence — async file I/O with debounce for cache writes."""

from __future__ import annotations

import json
import sys
import threading
from pathlib import Path
from typing import Any


class DebouncedPersistence:
    """Debounced JSON file writer — coalesces rapid writes into one I/O op."""

    def __init__(self, path: Path, debounce_seconds: float = 5.0) -> None:
        self._path = path
        self._debounce = debounce_seconds
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()
        self._pending_data: Any = None

    def schedule_write(self, data: Any) -> None:
        """Schedule a debounced write. Resets timer on each call."""
        with self._lock:
            self._pending_data = data
            if self._timer is not None:
                self._timer.cancel()
            self._timer = threading.Timer(self._debounce, self._do_write)
            self._timer.daemon = True
            self._timer.start()

    def flush(self) -> None:
        """Force immediate write if pending."""
        with self._lock:
            if self._timer is not None:
                self._timer.cancel()
                self._timer = None
        self._do_write()

    def load(self) -> dict | None:
        """Load JSON from file. Returns None if missing or corrupt."""
        if not self._path.exists():
            return None
        try:
            text = self._path.read_text(encoding="utf-8")
            return json.loads(text)
        except (json.JSONDecodeError, OSError) as e:
            _log(f"Cache load failed ({self._path}): {e}")
            return None

    def _do_write(self) -> None:
        """Perform the actual file write."""
        with self._lock:
            data = self._pending_data
            self._pending_data = None
            self._timer = None
        if data is None:
            return
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            text = json.dumps(data, indent=2, ensure_ascii=False)
            self._path.write_text(text, encoding="utf-8")
        except OSError as e:
            _log(f"Cache write failed ({self._path}): {e}")


def _log(msg: str) -> None:
    print(f"[cache-persist] {msg}", file=sys.stderr, flush=True)

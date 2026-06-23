"""File watcher — watchdog-based filesystem watcher with debounce."""

import sys
import threading
from pathlib import Path
from typing import Any, Callable

from .scanner import detect_language

WatchEvent = str  # "add" | "change" | "unlink"
WatchCallback = Callable[[str, WatchEvent], None]


class FileWatcher:
    """Watches workspace for file changes, triggers callback with debounce."""

    def __init__(self, config: dict[str, Any], callback: WatchCallback) -> None:
        self._config = config
        self._callback = callback
        self._observer: Any = None
        self._timers: dict[str, threading.Timer] = {}
        self._lock = threading.Lock()

    def start(self) -> None:
        """Start watching workspace. Degrades gracefully if watchdog unavailable."""
        try:
            self._init_watchdog()
        except ImportError:
            _log("watchdog not installed, file watching disabled")

    def stop(self) -> None:
        """Stop the file watcher and cancel pending debounce timers."""
        if self._observer:
            self._observer.stop()
            self._observer.join(timeout=2)
            self._observer = None
        self._cancel_timers()
        _log("Stopped")

    def _init_watchdog(self) -> None:
        """Initialize watchdog observer."""
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler, FileSystemEvent

        watcher = self
        workspace = self._config["workspace"]

        class Handler(FileSystemEventHandler):
            def on_created(self, event: FileSystemEvent) -> None:
                if not event.is_directory:
                    watcher._handle_event(event.src_path, "add")

            def on_modified(self, event: FileSystemEvent) -> None:
                if not event.is_directory:
                    watcher._handle_event(event.src_path, "change")

            def on_deleted(self, event: FileSystemEvent) -> None:
                if not event.is_directory:
                    watcher._handle_event(event.src_path, "unlink")

        self._observer = Observer()
        self._observer.schedule(Handler(), workspace, recursive=True)
        self._observer.start()
        _log("Watching for file changes")

    def _handle_event(self, file_path: str, event: WatchEvent) -> None:
        """Filter and debounce file events."""
        if self._should_ignore(file_path):
            return
        if event != "unlink" and not detect_language(file_path):
            return
        self._debounce(file_path, lambda: self._callback(file_path, event))

    def _should_ignore(self, file_path: str) -> bool:
        """Check if path matches exclude patterns."""
        for pattern in self._config["exclude_patterns"]:
            if pattern in file_path:
                return True
        return False

    def _debounce(self, key: str, fn: Callable[[], None]) -> None:
        """Debounce callback by key using configurable delay."""
        delay_s = self._config.get("watch_debounce_ms", 500) / 1000.0
        with self._lock:
            existing = self._timers.get(key)
            if existing:
                existing.cancel()
            timer = threading.Timer(delay_s, self._fire, args=(key, fn))
            self._timers[key] = timer
            timer.start()

    def _fire(self, key: str, fn: Callable[[], None]) -> None:
        """Execute debounced callback and clean up timer."""
        with self._lock:
            self._timers.pop(key, None)
        fn()

    def _cancel_timers(self) -> None:
        """Cancel all pending debounce timers."""
        with self._lock:
            for timer in self._timers.values():
                timer.cancel()
            self._timers.clear()


def _log(msg: str) -> None:
    print(f"[watcher] {msg}", file=sys.stderr, flush=True)

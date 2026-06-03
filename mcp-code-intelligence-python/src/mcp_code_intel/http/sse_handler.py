"""SSE (Server-Sent Events) handler for real-time KB change notifications.

Endpoint: GET /api/events
Protocol: text/event-stream
- Sends keepalive every 30s
- Pushes KB events as they occur
- Clients reconnect automatically (EventSource API)
"""

import json
import threading
import time
from http.server import BaseHTTPRequestHandler
from typing import Callable


class KbEventEmitter:
    """Singleton event emitter for KB changes. Thread-safe."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._subscribers = []
                cls._instance._sub_lock = threading.Lock()
            return cls._instance

    def subscribe(self, handler: Callable) -> Callable:
        """Subscribe to KB events. Returns unsubscribe function."""
        with self._sub_lock:
            self._subscribers.append(handler)

        def unsubscribe():
            with self._sub_lock:
                try:
                    self._subscribers.remove(handler)
                except ValueError:
                    pass

        return unsubscribe

    def emit(self, event_type: str, data: dict | None = None) -> None:
        """Emit event to all subscribers."""
        event = {"type": event_type, "timestamp": int(time.time() * 1000), "data": data or {}}
        with self._sub_lock:
            for handler in list(self._subscribers):
                try:
                    handler(event)
                except Exception:
                    pass


# Module-level singleton
_emitter = KbEventEmitter()


def get_emitter() -> KbEventEmitter:
    """Get the singleton KbEventEmitter."""
    return _emitter


# Active SSE connections for tracking
_active_connections: set = set()
_conn_lock = threading.Lock()


def handle_sse_events(handler: BaseHTTPRequestHandler) -> None:
    """Handle SSE connection for /api/events. Keeps connection open."""
    handler.send_response(200)
    handler.send_header("Content-Type", "text/event-stream")
    handler.send_header("Cache-Control", "no-cache")
    handler.send_header("Connection", "keep-alive")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("X-Accel-Buffering", "no")
    handler.end_headers()

    # Send initial connected event
    _write_sse(handler, "connected", {"timestamp": int(time.time() * 1000)})

    # Track connection
    conn_id = id(handler)
    with _conn_lock:
        _active_connections.add(conn_id)

    # Subscribe to events
    stop_event = threading.Event()

    def on_kb_event(event: dict) -> None:
        if stop_event.is_set():
            return
        try:
            _write_sse(handler, event["type"], event)
        except (BrokenPipeError, ConnectionResetError, OSError):
            stop_event.set()

    unsubscribe = _emitter.subscribe(on_kb_event)

    try:
        # Keep alive loop — send comment every 30s
        while not stop_event.is_set():
            try:
                handler.wfile.write(b": keepalive\n\n")
                handler.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                break
            stop_event.wait(30)
    finally:
        stop_event.set()
        unsubscribe()
        with _conn_lock:
            _active_connections.discard(conn_id)


def _write_sse(handler: BaseHTTPRequestHandler, event_type: str, data: dict) -> None:
    """Write a single SSE message."""
    msg = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    handler.wfile.write(msg.encode("utf-8"))
    handler.wfile.flush()


def infer_kb_event(tool_name: str, args: dict | None = None) -> str | None:
    """Map tool name + action to event type. Returns None for reads."""
    args = args or {}
    action = args.get("action", "")

    if tool_name in ("mem_ingest", "mem_ingest_file"):
        return "kb_entry_added"
    elif tool_name == "mem_crud":
        if action == "delete":
            return "kb_entry_deleted"
        elif action == "update":
            return "kb_entry_updated"
    elif tool_name == "mem_tags":
        if action == "create":
            return "tag_created"
        elif action == "delete":
            return "tag_deleted"
        elif action in ("tag", "untag"):
            return "tag_updated"
    elif tool_name == "mem_scoring":
        if action in ("quality_score", "feedback_submit"):
            return "quality_scored"
    elif tool_name == "mem_lifecycle":
        if action in ("archive", "unarchive", "mark_reviewed"):
            return "kb_entry_updated"
    elif tool_name == "mem_consolidate":
        return "consolidation_complete"
    return None


def get_sse_connection_count() -> int:
    """Get count of active SSE connections."""
    with _conn_lock:
        return len(_active_connections)

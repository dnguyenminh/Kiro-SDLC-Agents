"""HTTP server for Knowledge Graph viewer — uses Python stdlib."""

import os
import sys
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from .viewer_html import VIEWER_HTML
from .api_routes import handle_api_route, handle_health


class ViewerServer:
    """Serves REST API + Knowledge Graph Web Viewer."""

    def __init__(self, port: int, workspace: str = "") -> None:
        self.port = port
        self.workspace = workspace
        self.memory_engine = None  # Set after MCP initialize
        self.knowledge_graph = None
        self._server: HTTPServer | None = None
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        """Start HTTP server in daemon thread."""
        server_ref = self

        class Handler(BaseHTTPRequestHandler):
            """Request handler with access to server_ref."""

            def do_GET(self) -> None:
                _route_get(self, server_ref)

            def do_OPTIONS(self) -> None:
                _handle_cors_preflight(self)

            def log_message(self, format: str, *args: object) -> None:
                pass  # Suppress default access logs

        self._server = HTTPServer(("0.0.0.0", self.port), Handler)
        self._server.viewer_workspace = self.workspace
        self._thread = threading.Thread(
            target=self._server.serve_forever, daemon=True
        )
        self._thread.start()
        _log(f"Viewer server started on http://localhost:{self.port}")

    def stop(self) -> None:
        """Stop the server."""
        if self._server:
            self._server.shutdown()
            self._server = None
            self._thread = None
            _log("Viewer server stopped")


def _route_get(handler: BaseHTTPRequestHandler, server: ViewerServer) -> None:
    """Route GET requests to API handlers or serve HTML viewer."""
    parsed = urlparse(handler.path)
    path = parsed.path
    query = parse_qs(parsed.query)

    if path == "/" or path == "":
        _serve_html(handler)
    elif path == "/api/health":
        handle_health(handler, server.memory_engine)
    elif path.startswith("/api/memory"):
        handle_api_route(
            path, query, handler,
            server.memory_engine, server.knowledge_graph,
        )
    else:
        _send_404(handler)


def _serve_html(handler: BaseHTTPRequestHandler) -> None:
    """Serve the 3D Knowledge Graph viewer HTML from shared file or fallback."""
    html = _load_shared_viewer_html(handler.server.viewer_workspace)
    body = html.encode("utf-8")
    handler.send_response(200)
    handler.send_header("Content-Type", "text/html; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _load_shared_viewer_html(workspace: str) -> str:
    """Load shared viewer HTML from disk. Falls back to inline constant."""
    shared_path = os.path.join(workspace, "shared", "viewer", "index.html")
    try:
        if os.path.isfile(shared_path):
            with open(shared_path, "r", encoding="utf-8") as f:
                return f.read()
    except OSError:
        pass
    return VIEWER_HTML


def _handle_cors_preflight(handler: BaseHTTPRequestHandler) -> None:
    """Handle CORS preflight OPTIONS request."""
    handler.send_response(204)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()


def _send_404(handler: BaseHTTPRequestHandler) -> None:
    """Send 404 response."""
    body = b'{"error":"Not found"}'
    handler.send_response(404)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _log(msg: str) -> None:
    print(f"[http] {msg}", file=sys.stderr, flush=True)

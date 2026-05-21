"""HTTP server for Knowledge Graph viewer — uses Python stdlib.
All HTML/CSS/JS served from shared/viewer/ (single source of truth).
"""

import os
import sys
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from .api_routes import handle_api_route, handle_health
from .ingest_routes import handle_ingest_file_route
from .kb_viewer_routes import handle_kb_viewer_route
from .model_routes import handle_model_route
from .ux_routes import handle_ux_route


class ViewerServer:
    """Serves REST API + Knowledge Graph Web Viewer."""

    def __init__(self, port: int, workspace: str = "") -> None:
        self.port = port
        self.workspace = workspace
        self.memory_engine = None
        self.knowledge_graph = None
        self.model_manager = None
        self._server: HTTPServer | None = None
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        """Start HTTP server in daemon thread."""
        server_ref = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                _route_get(self, server_ref)

            def do_POST(self) -> None:
                _route_post(self, server_ref)

            def do_OPTIONS(self) -> None:
                _handle_cors_preflight(self)

            def log_message(self, format: str, *args: object) -> None:
                pass

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


_PAGE_MAP = {
    "/": "index.html",
    "/dashboard": "dashboard.html",
    "/tags": "tags.html",
    "/quality": "quality.html",
    "/analytics": "analytics.html",
}


def _route_get(handler: BaseHTTPRequestHandler, server: ViewerServer) -> None:
    """Route GET requests to API handlers or serve HTML viewer."""
    parsed = urlparse(handler.path)
    path = parsed.path
    query = parse_qs(parsed.query)

    if path in _PAGE_MAP:
        _serve_shared_file(handler, _PAGE_MAP[path], server.workspace)
    elif path.startswith("/modules/") or path.startswith("/config/"):
        _serve_subdir_static(handler, path, server.workspace)
    elif path.endswith((".css", ".js")) and not path.startswith("/api"):
        _serve_static(handler, path, server.workspace)
    elif path == "/api/health":
        handle_health(handler, server.memory_engine, server.workspace)
    elif path.startswith("/api/models"):
        handle_model_route(path, query, handler, server.model_manager, method="GET")
    elif path.startswith("/api/kb"):
        if not handle_ux_route(path, query, handler, server.memory_engine):
            handle_kb_viewer_route(path, query, handler, server.memory_engine)
    elif path.startswith("/api/memory"):
        handle_api_route(
            path, query, handler,
            server.memory_engine, server.knowledge_graph,
        )
    else:
        _send_404(handler)


def _route_post(handler: BaseHTTPRequestHandler, server: ViewerServer) -> None:
    """Route POST requests."""
    parsed = urlparse(handler.path)
    path = parsed.path

    if path == "/api/memory/ingest-file":
        handle_ingest_file_route(handler, server.memory_engine, server.workspace)
    elif path.startswith("/api/models"):
        handle_model_route(path, {}, handler, server.model_manager, method="POST")
    elif path.startswith("/api/kb"):
        handle_ux_route(path, {}, handler, server.memory_engine, method="POST")
    else:
        _send_404(handler)


def _serve_shared_file(
    handler: BaseHTTPRequestHandler, filename: str, workspace: str
) -> None:
    """Serve file from shared/viewer/. Returns error page if missing."""
    file_path = _resolve_shared_path(workspace, filename)
    if not file_path:
        _serve_viewer_error(handler, filename, workspace)
        return
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            body = f.read().encode("utf-8")
        ct = "text/html" if filename.endswith(".html") else "text/plain"
        handler.send_response(200)
        handler.send_header("Content-Type", f"{ct}; charset=utf-8")
        handler.send_header("Access-Control-Allow-Origin", "*")
        handler.send_header("Content-Length", str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)
    except OSError:
        _serve_viewer_error(handler, filename, workspace)


def _serve_subdir_static(
    handler: BaseHTTPRequestHandler, path: str, workspace: str
) -> None:
    """Serve static files from shared/viewer subdirectories."""
    if ".." in path:
        _send_404(handler)
        return
    rel_path = path.lstrip("/")
    file_path = _resolve_shared_path(workspace, rel_path)
    if not file_path:
        _send_404(handler)
        return
    ext = os.path.splitext(file_path)[1]
    content_types = {".js": "application/javascript", ".css": "text/css", ".json": "application/json"}
    content_type = content_types.get(ext, "text/plain")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            body = f.read().encode("utf-8")
        handler.send_response(200)
        handler.send_header("Content-Type", f"{content_type}; charset=utf-8")
        handler.send_header("Access-Control-Allow-Origin", "*")
        handler.send_header("Content-Length", str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)
    except OSError:
        _send_404(handler)


def _serve_static(
    handler: BaseHTTPRequestHandler, path: str, workspace: str
) -> None:
    """Serve static CSS/JS files from shared/viewer directory."""
    filename = os.path.basename(path)
    if ".." in filename or "/" in filename:
        _send_404(handler)
        return
    file_path = _resolve_shared_path(workspace, filename)
    if not file_path:
        _send_404(handler)
        return
    content_type = "text/css" if filename.endswith(".css") else "application/javascript"
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            body = f.read().encode("utf-8")
        handler.send_response(200)
        handler.send_header("Content-Type", f"{content_type}; charset=utf-8")
        handler.send_header("Access-Control-Allow-Origin", "*")
        handler.send_header("Content-Length", str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)
    except OSError:
        _send_404(handler)


def _resolve_shared_path(workspace: str, rel_path: str) -> str | None:
    """Resolve path within shared/viewer/. Returns None if not found."""
    if not workspace:
        return None
    full_path = os.path.join(workspace, "shared", "viewer", rel_path)
    return full_path if os.path.isfile(full_path) else None


def _serve_viewer_error(
    handler: BaseHTTPRequestHandler, filename: str, workspace: str
) -> None:
    """Error page when shared/viewer/ files are missing."""
    html = (
        "<!DOCTYPE html><html><head><title>Viewer Unavailable</title></head>"
        "<body style='background:#0f172a;color:#e2e8f0;font-family:system-ui;padding:2rem'>"
        "<h1>Viewer Unavailable</h1>"
        f"<p>shared/viewer/{filename} not found. Please ensure workspace is correct.</p>"
        f"<p style='opacity:.6;font-size:.8rem'>Workspace: {workspace or '(not set)'}</p>"
        "</body></html>"
    )
    body = html.encode("utf-8")
    handler.send_response(503)
    handler.send_header("Content-Type", "text/html; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _handle_cors_preflight(handler: BaseHTTPRequestHandler) -> None:
    """Handle CORS preflight OPTIONS request."""
    handler.send_response(204)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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

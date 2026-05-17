"""MCP server — stdio JSON-RPC 2.0 transport for code intelligence tools.

Workspace is resolved from MCP initialize request roots[0].uri.
Indexing is deferred until after initialize completes.
"""

import json
import sys
from typing import Any

from .config import set_workspace
from .db import DatabaseManager
from .indexer import IndexingEngine
from .query import QueryLayer
from .tools import (
    handle_code_search,
    handle_code_symbols,
    handle_code_context,
    handle_code_modules,
    handle_code_index_status,
    handle_code_kb_export,
)
from .stream_write import handle_stream_write_file
from .memory import MemoryEngine, MemoryToolDispatcher, MEMORY_TOOL_DEFINITIONS
from .http import ViewerServer

SERVER_NAME = "mcp-code-intelligence-python"
SERVER_VERSION = "0.1.0"

TOOL_DEFINITIONS = [
    {
        "name": "code_search",
        "description": "Full-text search across indexed code symbols (functions, classes, interfaces). Uses SQLite FTS5 with porter stemming.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (supports FTS5 syntax: AND, OR, NOT, prefix*)"},
                "limit": {"type": "number", "description": "Max results (default 20)"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "code_symbols",
        "description": "Find code symbols by name prefix or list symbols in a file. Filter by kind (function, class, interface, etc).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Symbol name or prefix to search"},
                "file": {"type": "string", "description": "File path to list symbols from"},
                "kind": {"type": "string", "description": "Filter by kind: function, class, interface, enum, type, method"},
                "limit": {"type": "number", "description": "Max results"},
            },
        },
    },
    {
        "name": "code_context",
        "description": "Get source code context around a symbol or line range. Returns actual code lines from the file.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "file": {"type": "string", "description": "Relative file path"},
                "symbol": {"type": "string", "description": "Symbol name to find in file"},
                "startLine": {"type": "number", "description": "Start line (1-based)"},
                "endLine": {"type": "number", "description": "End line (1-based)"},
                "contextLines": {"type": "number", "description": "Extra lines above/below (default 5)"},
            },
            "required": ["file"],
        },
    },
    {
        "name": "code_modules",
        "description": "List all discovered code modules in the workspace with file counts, languages, and descriptions.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Filter by module name (prefix match)"},
            },
        },
    },
    {
        "name": "code_index_status",
        "description": "Get current indexing status: file count, symbol count, languages, last indexed time, and indexer state.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "reindex": {"type": "boolean", "description": "Trigger a full re-index (default false)"},
            },
        },
    },
    {
        "name": "stream_write_file",
        "description": "Write content directly to a file on disk. Modes: write (overwrite), append, create (fail if exists).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Path to file (absolute or relative to workspace)"},
                "content": {"type": "string", "description": "Text content to write"},
                "mode": {"type": "string", "description": "write, append, or create (default: write)"},
                "encoding": {"type": "string", "description": "Encoding (default: utf-8)"},
            },
            "required": ["file_path"],
        },
    },
    {
        "name": "code_kb_export",
        "description": "Export code intelligence data as Knowledge Base payloads for ingestion. Returns structured data ready for kb_ingest.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "module": {"type": "string", "description": "Filter by module name (optional, exports all if omitted)"},
                "format": {"type": "string", "description": "Output format: json (default) or text"},
            },
        },
    },
]


class McpServer:
    """MCP server using stdio JSON-RPC 2.0 transport.

    Workspace is resolved from initialize request roots[0].uri.
    Indexing starts only after initialize completes.
    """

    def __init__(self, config: dict[str, Any]) -> None:
        self._config = config
        self._db: DatabaseManager | None = None
        self._indexer: IndexingEngine | None = None
        self._query_layer: QueryLayer | None = None
        self._memory_dispatcher: MemoryToolDispatcher | None = None
        self._viewer: ViewerServer | None = None
        self._workspace: str = config["workspace"]
        self._initialized = False

    def run(self) -> None:
        """Main loop — read JSON-RPC from stdin, write to stdout."""
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                request = json.loads(line)
                response = self._handle_request(request)
                if response is not None:
                    self._send(response)
            except json.JSONDecodeError:
                self._send_error(None, -32700, "Parse error")

    def _handle_request(self, request: dict[str, Any]) -> dict[str, Any] | None:
        method = request.get("method", "")
        req_id = request.get("id")
        params = request.get("params", {})

        # Notifications (no id) — no response needed
        if req_id is None and method.startswith("notifications/"):
            return None

        handler = self._get_handler(method)
        if handler is None:
            return self._error_response(req_id, -32601, f"Method not found: {method}")

        try:
            result = handler(params)
            return {"jsonrpc": "2.0", "id": req_id, "result": result}
        except Exception as e:
            return self._error_response(req_id, -32603, str(e))

    def _get_handler(self, method: str):
        """Route method to handler function."""
        handlers = {
            "initialize": self._handle_initialize,
            "tools/list": self._handle_tools_list,
            "tools/call": self._handle_tools_call,
            "ping": self._handle_ping,
        }
        return handlers.get(method)

    def _handle_initialize(self, params: dict[str, Any]) -> dict[str, Any]:
        """Extract workspace from roots, initialize DB and indexer."""
        root_uri = _extract_root_uri(params)
        self._config = set_workspace(self._config, root_uri)
        self._workspace = self._config["workspace"]

        _log(f"Workspace: {self._workspace}")
        _log(f"DB path: {self._config['db_path']}")

        # Initialize DB and indexer now that we have workspace
        self._db = DatabaseManager(self._config["db_path"])
        self._db.initialize()
        self._indexer = IndexingEngine(self._db, self._config)
        self._query_layer = QueryLayer(self._db)
        self._initialized = True

        # Initialize memory engine on same DB connection
        mem_engine = MemoryEngine(self._db.conn)
        mem_engine.start_session("mcp-client")
        self._memory_dispatcher = MemoryToolDispatcher(mem_engine, self._workspace)

        # Start HTTP viewer server
        viewer_port = self._config.get("viewer_port", 3201)
        self._viewer = ViewerServer(viewer_port)
        self._viewer.memory_engine = mem_engine
        self._viewer.knowledge_graph = mem_engine.graph
        self._viewer.start()

        # Run indexing after responding
        self._indexer.run_full_index()
        _log("MCP server ready")

        return {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        }

    def _handle_tools_list(self, params: dict[str, Any]) -> dict[str, Any]:
        return {"tools": TOOL_DEFINITIONS + MEMORY_TOOL_DEFINITIONS}

    def _handle_tools_call(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self._initialized:
            raise RuntimeError("Server not initialized")
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})
        text = self._dispatch_tool(tool_name, arguments)
        return {"content": [{"type": "text", "text": text}]}

    def _handle_ping(self, params: dict[str, Any]) -> dict[str, Any]:
        return {}

    def _dispatch_tool(self, name: str, args: dict[str, Any]) -> str:
        # Try memory tools first
        if self._memory_dispatcher:
            mem_result = self._memory_dispatcher.dispatch(name, args)
            if mem_result is not None:
                return mem_result
        if name == "code_search":
            return handle_code_search(args, self._query_layer)
        if name == "code_symbols":
            return handle_code_symbols(args, self._query_layer)
        if name == "code_context":
            return handle_code_context(args, self._query_layer, self._workspace)
        if name == "code_modules":
            return handle_code_modules(args, self._query_layer)
        if name == "code_index_status":
            return handle_code_index_status(args, self._query_layer, self._indexer)
        if name == "stream_write_file":
            return handle_stream_write_file(args, self._workspace)
        if name == "code_kb_export":
            return handle_code_kb_export(args, self._query_layer, self._workspace)
        return f"Unknown tool: {name}"

    def _send(self, response: dict[str, Any]) -> None:
        data = json.dumps(response)
        sys.stdout.write(data + "\n")
        sys.stdout.flush()

    def _send_error(self, req_id: Any, code: int, message: str) -> None:
        self._send(self._error_response(req_id, code, message))

    def _error_response(self, req_id: Any, code: int, message: str) -> dict[str, Any]:
        return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def _extract_root_uri(params: dict[str, Any]) -> str | None:
    """Extract first root URI from initialize params."""
    roots = params.get("roots")
    if isinstance(roots, list) and len(roots) > 0:
        first = roots[0]
        if isinstance(first, dict) and "uri" in first:
            return first["uri"]
    return None


def _log(msg: str) -> None:
    """Log to stderr."""
    print(f"[code-intel] {msg}", file=sys.stderr, flush=True)

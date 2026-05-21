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
from .memory import MemoryEngineV2, MemoryToolDispatcher, MEMORY_TOOL_DEFINITIONS
from .http import ViewerServer
from .orchestration.engine import OrchestrationEngine
from .orchestration.config import OrchestrationConfig, load_orchestration_config
from .orchestration.meta.dispatcher import MetaToolDispatcher, META_TOOL_DEFINITIONS
from .orchestration.meta.recursion_guard import parse_recursion_args, is_depth_exceeded
from .orchestration.registry.registry import META_TOOL_NAMES

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
        self._orchestration: OrchestrationEngine | None = None
        self._meta_dispatcher: MetaToolDispatcher | None = None
        self._viewer: ViewerServer | None = None
        self._workspace: str = config["workspace"]
        self._initialized = False

    def run(self) -> None:
        """Main loop — read JSON-RPC from stdin, write to stdout."""
        import signal
        signal.signal(signal.SIGTERM, lambda *_: self._shutdown())
        signal.signal(signal.SIGINT, lambda *_: self._shutdown())

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

        # stdin closed (reconnect) — cleanup
        self._shutdown()

    def _shutdown(self) -> None:
        """Graceful shutdown — stop orchestration, viewer, release resources."""
        if self._orchestration:
            self._orchestration.stop()
            # Stop the dedicated orchestration event loop
            if hasattr(self, '_orch_loop') and self._orch_loop and self._orch_loop.is_running():
                self._orch_loop.call_soon_threadsafe(self._orch_loop.stop)
            self._orchestration = None
        if self._viewer:
            self._viewer.stop()
            self._viewer = None
        _log("Server shutdown complete")

    def _init_orchestration(self, mem_engine: Any) -> None:
        """Initialize orchestration engine from config file.
        
        Runs event loop in a background thread so _read_loop tasks stay active.
        """
        import threading
        from pathlib import Path

        # Recursion guard
        recursion = parse_recursion_args()
        if is_depth_exceeded(recursion):
            _log(f"Max recursion depth ({recursion.max_depth}) — orchestration disabled")
            return

        config_path = Path(self._workspace) / ".code-intel" / "orchestration.json"
        if not config_path.exists():
            _log("No orchestration.json — orchestration disabled")
            return
        try:
            orch_config = load_orchestration_config(self._workspace)
            if not orch_config or not orch_config.enabled_servers():
                _log("Orchestration config empty — disabled")
                return

            import asyncio
            # Create a dedicated event loop running in background thread
            self._orch_loop = asyncio.new_event_loop()
            self._orchestration = OrchestrationEngine(orch_config, mem_engine, self._config)

            # Start orchestration on the dedicated loop
            started = [False]
            def _run_loop():
                asyncio.set_event_loop(self._orch_loop)
                self._orch_loop.run_until_complete(self._orchestration.start())
                started[0] = True
                # Keep loop running for _read_loop tasks
                self._orch_loop.run_forever()

            self._orch_thread = threading.Thread(target=_run_loop, daemon=True, name="orch-loop")
            self._orch_thread.start()

            # Wait for startup to complete
            import time
            for _ in range(100):  # max 10s
                if started[0]:
                    break
                time.sleep(0.1)

            self._meta_dispatcher = MetaToolDispatcher(self._orchestration)
            _log(f"Orchestration enabled: {len(orch_config.enabled_servers())} servers")
        except Exception as e:
            _log(f"Orchestration init failed: {e}")
            self._orchestration = None

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
        mem_engine = MemoryEngineV2(self._db.conn, self._workspace)
        mem_engine.start_session("mcp-client")

        # Initialize embedding service (Ollama → ONNX → None)
        from .memory.embedding import EmbeddingFactory
        embedding_service = EmbeddingFactory.create(self._config, mem_engine.vectors)
        if embedding_service:
            _log("EmbeddingService initialized — vectors enabled")
        else:
            _log("EmbeddingService not available — using BM25 only")

        self._memory_dispatcher = MemoryToolDispatcher(
            mem_engine, self._workspace, embedding_service
        )

        # Start HTTP viewer server
        viewer_port = self._config.get("viewer_port", 3201)
        self._viewer = ViewerServer(viewer_port, self._workspace)
        self._viewer.memory_engine = mem_engine
        self._viewer.knowledge_graph = mem_engine.graph
        self._viewer.start()

        # Run indexing after responding
        self._indexer.run_full_index()

        # Initialize orchestration engine (child MCP servers)
        self._init_orchestration(mem_engine)

        # Wire model manager to viewer for HTTP API
        if self._orchestration:
            self._viewer.model_manager = self._orchestration.get_model_manager()

        _log("MCP server ready")

        return {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        }

    def _handle_tools_list(self, params: dict[str, Any]) -> dict[str, Any]:
        tools = TOOL_DEFINITIONS + MEMORY_TOOL_DEFINITIONS
        if self._orchestration and self._orchestration.is_enabled():
            tools = tools + META_TOOL_DEFINITIONS
        return {"tools": tools}

    # Tools excluded from KB ingest to prevent infinite loops
    _KB_INGEST_EXCLUDE = frozenset({
        "mem_ingest", "mem_search", "mem_ingest_file", "mem_crud",
        "mem_graph", "mem_consolidate", "mem_lifecycle", "mem_templates",
        "mem_attachments", "mem_discover", "mem_tags", "mem_citations",
        "mem_scoring", "mem_admin",
    })

    def _handle_tools_call(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self._initialized:
            raise RuntimeError("Server not initialized")
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})
        # Log ALL tool calls to audit (for stream tab)
        if self._memory_dispatcher:
            engine = self._memory_dispatcher._engine
            details = f"{tool_name}({str(arguments)[:150]})"
            engine.audit.log("TOOL_CALL", session_id=engine.session_id, details=details)
        text = self._dispatch_tool(tool_name, arguments)
        # Ingest tool call input/output into KB (skip memory tools to avoid loops)
        self._maybe_ingest_tool_call(tool_name, arguments, text)
        return {"content": [{"type": "text", "text": text}]}

    def _maybe_ingest_tool_call(self, tool_name: str, arguments: dict[str, Any], output: str) -> None:
        """Ingest tool call I/O into KB for context retention. Fire-and-forget."""
        if tool_name in self._KB_INGEST_EXCLUDE:
            return
        if not self._memory_dispatcher:
            return
        try:
            content = f"{tool_name}: {json.dumps(arguments, ensure_ascii=False)}\n---\n{output}"
            self._memory_dispatcher.dispatch("mem_ingest", {
                "content": content,
                "type": "CONTEXT",
                "source": "tool-call-stream",
                "tags": f"tool-call,{tool_name}",
            })
        except Exception:
            pass  # Fire-and-forget — never block tool response

    def _handle_ping(self, params: dict[str, Any]) -> dict[str, Any]:
        return {}

    def _dispatch_tool(self, name: str, args: dict[str, Any]) -> str:
        # Try memory tools first
        if self._memory_dispatcher:
            mem_result = self._memory_dispatcher.dispatch(name, args)
            if mem_result is not None:
                return mem_result
        # Native tools
        if name == "code_search":
            result = handle_code_search(args, self._query_layer)
            self._log_search_analytics(args.get("query", ""), result)
            return result
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
        # Meta-tools (orchestration)
        if self._meta_dispatcher:
            if name in META_TOOL_NAMES:
                _log(f"Dispatching meta-tool: {name}")
                return self._dispatch_meta(name, args)
        # Route to child servers via orchestration (with chain + fallback)
        orch = self._orchestration
        if orch and orch.is_enabled():
            return self._route_orchestration(name, args)
        _log(f"Tool '{name}' not routed: orchestration={orch is not None}, enabled={orch.is_enabled() if orch else 'N/A'}")
        return f"Unknown tool: {name}"

    def _log_search_analytics(self, query: str, result: str) -> None:
        """Log search to search_log for analytics page."""
        try:
            if not query or not self._memory_dispatcher:
                return
            import re
            match = re.search(r"(\d+) results", result)
            count = int(match.group(1)) if match else 0
            self._memory_dispatcher._log_search_analytics(query, count)
        except Exception:
            pass  # analytics must not break search

    def _dispatch_meta(self, name: str, args: dict[str, Any]) -> str:
        """Dispatch meta-tools — all sync (parity with Kotlin MetaToolDispatcher)."""
        try:
            result = self._meta_dispatcher.dispatch(name, args)
            if result is not None:
                return result
            _log(f"Meta-dispatcher returned None for {name}")
            return json.dumps({"error": f"Meta-tool '{name}' returned None"})
        except Exception as e:
            _log(f"Meta-dispatcher exception for {name}: {type(e).__name__}: {e}")
            return json.dumps({"error": f"Meta-tool '{name}' failed: {e}"})

    def _route_orchestration(self, name: str, args: dict[str, Any]) -> str:
        """Route to orchestration with mapping check + chain + children fallback."""
        import asyncio
        import concurrent.futures
        engine = self._orchestration
        loop = getattr(engine, '_orch_loop', None)

        if not loop or loop.is_closed():
            return json.dumps({"error": "Orchestration event loop not available"})

        # Check mapping first (from find_tools discovery)
        mapping = engine.get_tool_mapping(name)
        if mapping:
            server_name, original_name = mapping
            _log(f"Routing '{name}' via mapping → {server_name}::execute_dynamic_tool({original_name})")
            try:
                # Route via nested server's execute_dynamic_tool
                future = asyncio.run_coroutine_threadsafe(
                    engine.call_child(server_name, "execute_dynamic_tool",
                        {"tool_name": original_name, "arguments": args}, timeout_ms=60_000), loop
                )
                return future.result(timeout=60)
            except Exception as e:
                _log(f"Mapping route failed: {e}")

        # Check chain
        registry = engine.get_registry()
        chain = registry.get_chain(name) if hasattr(registry, 'get_chain') else None
        if chain:
            return self._execute_chain_on_loop(chain, name, args, loop)

        # Try normal route
        try:
            future = asyncio.run_coroutine_threadsafe(engine.route(name, args), loop)
            return future.result(timeout=60)
        except Exception as e:
            return self._try_children_fallback_on_loop(name, args, e, loop)

    def _execute_chain_on_loop(self, chain: Any, name: str, args: dict[str, Any], loop) -> str:
        """Execute through fallback chain on orchestration loop."""
        import asyncio
        for entry in chain.entries:
            actual_name = entry.tool_name or name
            try:
                future = asyncio.run_coroutine_threadsafe(
                    self._orchestration.call_child(entry.server_name, actual_name, args, timeout_ms=60_000), loop
                )
                return future.result(timeout=60)
            except Exception:
                continue
        return json.dumps({"error": f"Tool '{name}' failed on all servers in chain"})

    def _try_children_fallback_on_loop(self, name: str, args: dict[str, Any], original: Exception, loop) -> str:
        """Try all child servers as fallback on orchestration loop."""
        import asyncio
        server_manager = self._orchestration._server_manager
        statuses = server_manager.get_status()
        for server_name, state in statuses.items():
            if state.value != "ACTIVE":
                continue
            try:
                future = asyncio.run_coroutine_threadsafe(
                    self._orchestration.call_child(server_name, name, args, timeout_ms=60_000), loop
                )
                return future.result(timeout=60)
            except Exception:
                continue
        msg = str(original).replace('"', "'")
        return json.dumps({"error": msg})

    def _send(self, response: dict[str, Any]) -> None:
        data = json.dumps(response)
        sys.stdout.write(data + "\n")
        sys.stdout.flush()

    def _send_error(self, req_id: Any, code: int, message: str) -> None:
        self._send(self._error_response(req_id, code, message))

    def _error_response(self, req_id: Any, code: int, message: str) -> dict[str, Any]:
        return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def _run_async_in_thread(coro) -> str:
    """Run a coroutine in a new thread with its own event loop (like Kotlin runBlocking).

    This avoids 'event loop already running' errors when the main loop is active.
    """
    import asyncio
    import concurrent.futures

    def _run():
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(_run)
        return future.result(timeout=60)


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

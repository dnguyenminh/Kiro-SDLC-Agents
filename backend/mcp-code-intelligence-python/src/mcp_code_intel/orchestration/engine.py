"""Orchestration engine — coordinator that wires all components together.

Entry point for orchestration. Child tools are hidden from tools/list.
Behavioral parity with Kotlin OrchestrationEngine.kt.
"""

from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path
from typing import Any

from .config import OrchestrationConfig
from .local import ConfigWatcher, LocalServerManager
from .registry import UnifiedRegistry
from .routing import RoutingTable, SmartRouter, ToolMetrics
from .logging.auto_logger import AutoLogger


class OrchestrationEngine:
    """Coordinator — wires LocalServerManager, SmartRouter, UnifiedRegistry, AutoLogger."""

    def __init__(self, config: OrchestrationConfig, memory_engine: Any, app_config: dict) -> None:
        self._config = config
        self._memory_engine = memory_engine
        self._app_config = app_config
        self._server_manager = LocalServerManager(config)
        self._routing_table = RoutingTable()
        self._registry = UnifiedRegistry(config.settings.similarity_threshold)
        self._router = SmartRouter(self._server_manager, self._routing_table)
        self._auto_logger = AutoLogger(memory_engine, config.settings.auto_log)
        self._config_watcher: ConfigWatcher | None = None
        self._started = False
        self._find_tools_delegates: list[str] = []
        self._exec_delegates: list[str] = []
        self._tool_mapping: dict[str, tuple[str, str]] = {}
        # KSA-102: Cache + Embedding + Model Manager (lazy init)
        self._token_cache = None
        self._embedding_searcher = None
        self._model_manager = None

    async def start(self) -> None:
        """Start orchestration — spawn servers, build routing, ingest KB."""
        self._orch_loop = asyncio.get_event_loop()  # Store reference to running loop
        self._registry.set_server_order(list(self._config.enabled_servers().keys()))
        count = await self._server_manager.start_all()
        self._build_routing_table()
        self._build_delegation_list()
        self._ingest_tools_to_kb()
        self._started = True
        self._start_config_watcher()
        _log(f"Orchestration started: {count}/{len(self._config.enabled_servers())} servers active")

    def stop(self) -> None:
        """Stop orchestration — kill all child processes."""
        if not self._started:
            return
        if self._config_watcher:
            self._config_watcher.stop()
        self._server_manager.stop_all()
        self._started = False
        _log("Orchestration stopped")

    async def route(self, tool_name: str, args: dict) -> str:
        """Route a tool call to the appropriate child server."""
        if not self._started:
            raise RuntimeError("Orchestration not started")
        start = time.time()
        self._router.request_start_time = start
        try:
            timeout = self._get_timeout(tool_name)
            result = await self._router.route(tool_name, args, timeout)
            latency = int((time.time() - start) * 1000)
            source = self._server_manager.find_server_for_tool(tool_name) or "unknown"
            self._auto_logger.log_call(tool_name, str(args), result, latency, source)
            return result
        except Exception as e:
            latency = int((time.time() - start) * 1000)
            self._auto_logger.log_call(tool_name, str(args), str(e), latency, "unknown", True)
            raise

    def get_registry(self) -> UnifiedRegistry:
        """Get the unified registry."""
        return self._registry

    def get_memory_engine(self) -> Any:
        """Get memory engine for KB search."""
        return self._memory_engine

    def is_enabled(self) -> bool:
        return self._started

    def get_status(self) -> dict:
        """Get orchestration status summary."""
        return {
            "enabled": self._started,
            "servers": len(self._server_manager.get_status()),
            "hiddenTools": len(self._registry.all_child_tools()),
        }

    def get_server_status(self) -> list[dict]:
        return self._server_manager.get_server_status_info()

    def get_metrics(self) -> dict[str, ToolMetrics]:
        return self._router.get_metrics()

    async def retry_failed_servers(self) -> list[str]:
        """Retry FAILED servers and rebuild routing if any recover."""
        recovered = await self._server_manager.retry_failed_servers()
        if recovered:
            self._build_routing_table()
            self._build_delegation_list()
            _log(f"Recovered servers: {recovered} — routing rebuilt")
        return recovered

    async def call_child(self, server_name: str, tool_name: str, args: dict, timeout_ms: int = 60_000) -> str:
        """Call a tool directly on a specific child server."""
        result = await self._server_manager.call_tool(server_name, tool_name, args, timeout_ms)
        return self._extract_text(result)

    def get_workspace(self) -> str:
        return self._app_config.get("workspace", "")

    # --- Delegation list (KSA-65 Option E) ---

    def get_find_tools_delegates(self) -> list[str]:
        """Get server names that have nested find_tools capability."""
        return self._find_tools_delegates

    def get_tool_mapping(self, tool_name: str) -> tuple[str, str] | None:
        """Get (server_name, original_name) for a previously discovered nested tool."""
        return self._tool_mapping.get(tool_name)

    def register_nested_tool(
        self, unique_name: str, server_name: str, original_name: str, definition: dict
    ) -> None:
        """Register a tool discovered via nested find_tools delegation."""
        self._tool_mapping[unique_name] = (server_name, original_name)
        self._tool_mapping[original_name] = (server_name, original_name)
        self._registry.register_nested(unique_name, server_name, definition)
        # Update routing table so SmartRouter can find it
        self._routing_table.add_route(original_name, server_name)

    # --- KSA-102: Cache + Embedding + Model Manager ---

    def get_token_cache(self):
        """Lazy-init adaptive token cache."""
        if self._token_cache is None:
            from .cache import AdaptiveTokenCache
            cache_path = Path(self.get_workspace()) / ".code-intel" / "token-cache.json"
            self._token_cache = AdaptiveTokenCache(cache_path)
        return self._token_cache

    def get_embedding_searcher(self):
        """Get embedding searcher (None if ONNX unavailable)."""
        if self._embedding_searcher is None:
            try:
                from .embedding import EmbeddingSearcher
                self._embedding_searcher = EmbeddingSearcher(
                    model_manager=self.get_model_manager(),
                    registry=self.get_registry(),
                )
            except ImportError:
                return None
        return self._embedding_searcher

    def get_model_manager(self):
        """Get model manager instance."""
        if self._model_manager is None:
            from .models import ModelManager
            self._model_manager = ModelManager()
        return self._model_manager

    def _build_routing_table(self) -> None:
        """Build routing table from all active child servers."""
        all_tools = self._server_manager.get_all_tools()
        by_server: dict[str, list[dict]] = {}
        for server_name, tool_def in all_tools:
            by_server.setdefault(server_name, []).append(tool_def)
        for server_name, tools in by_server.items():
            self._registry.set_child_tools(server_name, tools)
        self._routing_table.rebuild(set(), self._registry.child_tools_by_server())

    def _build_delegation_list(self) -> None:
        """Identify child servers that have nested find_tools/execute_dynamic_tool."""
        self._find_tools_delegates = []
        self._exec_delegates = []
        all_tools = self._server_manager.get_all_tools()
        _log(f"Building delegation list from {len(all_tools)} total tools")
        servers_with_find: set[str] = set()
        servers_with_exec: set[str] = set()
        for server_name, tool_def in all_tools:
            name = tool_def.get("name", "")
            if name == "find_tools":
                servers_with_find.add(server_name)
            elif name == "execute_dynamic_tool":
                servers_with_exec.add(server_name)
        self._find_tools_delegates = list(servers_with_find)
        self._exec_delegates = list(servers_with_exec)
        _log(f"Delegation list: find_tools → {self._find_tools_delegates}, exec → {self._exec_delegates}")

    def _ingest_tools_to_kb(self) -> None:
        """Ingest child tool definitions into KB."""
        mem = self._memory_engine
        if not mem:
            return
        tools = self._registry.all_child_tools()
        if not tools:
            return
        content = "\n".join(
            f"{t.name} [{t.source}]: {t.definition.get('description', '')}" for t in tools
        )
        try:
            mem.knowledge.insert(
                content=content,
                summary=f"Orchestration child tools registry ({len(tools)} tools)",
                type_="CONTEXT", tier="WORKING",
                source="orchestration-startup", tags="tools,registry,orchestration",
            )
            _log(f"Ingested {len(tools)} child tool definitions into KB")
        except Exception as e:
            _log(f"Failed to ingest tools to KB: {e}")

    def _start_config_watcher(self) -> None:
        """Start config file watcher for hot-reload."""
        workspace = self.get_workspace()
        config_path = str(Path(workspace) / ".code-intel" / "orchestration.json")
        self._config_watcher = ConfigWatcher(config_path, self._on_config_reload)
        self._config_watcher.start()

    def _on_config_reload(self, new_config: OrchestrationConfig) -> None:
        """Handle config hot-reload."""
        self._config = new_config
        _log("Config hot-reloaded, rebuilding...")
        asyncio.create_task(self._rebuild_after_reload(new_config))

    async def _rebuild_after_reload(self, new_config: OrchestrationConfig) -> None:
        """Stop all, restart with new config."""
        self._server_manager.stop_all()
        self._server_manager.update_config(new_config)
        self._registry.set_server_order(list(new_config.enabled_servers().keys()))
        await self._server_manager.start_all()
        self._build_routing_table()
        self._build_delegation_list()
        self._ingest_tools_to_kb()

    def _get_timeout(self, tool_name: str) -> int:
        """Get timeout for a tool based on its server config."""
        server_name = self._server_manager.find_server_for_tool(tool_name)
        if server_name and server_name in self._config.mcp_servers:
            return self._config.mcp_servers[server_name].timeout
        return 30_000

    def _extract_text(self, result: Any) -> str:
        if result is None:
            return "{}"
        if isinstance(result, dict):
            content = result.get("content")
            if isinstance(content, list) and content:
                return content[0].get("text", "{}") if isinstance(content[0], dict) else "{}"
        return str(result)


def _log(msg: str) -> None:
    print(f"[orchestration] {msg}", file=sys.stderr, flush=True)

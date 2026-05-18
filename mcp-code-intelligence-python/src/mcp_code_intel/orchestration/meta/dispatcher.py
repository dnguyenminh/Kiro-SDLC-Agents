"""Meta-tool dispatcher — routes meta-tool calls to handlers.

Behavioral parity with Kotlin MetaToolDispatcher.kt.
"""

from __future__ import annotations

import json
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from ..engine import OrchestrationEngine

from .find_tools import execute as find_tools_execute
from .execute_dynamic import execute as execute_dynamic_execute
from .agent_log import execute as agent_log_execute
from .manage_auto_approve import execute as manage_auto_approve_execute

META_TOOL_DEFINITIONS = [
    {
        "name": "find_tools",
        "description": "Search for available tools by describing what you want to accomplish. Returns tool definitions with input schemas.",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Natural language description or keyword to search for"}},
            "required": ["query"],
        },
    },
    {
        "name": "execute_dynamic_tool",
        "description": "Execute a tool on an upstream MCP server by exact tool name.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tool_name": {"type": "string", "description": "Exact tool name to execute"},
                "arguments": {"type": "object", "description": "Arguments for the tool"},
            },
            "required": ["tool_name"],
        },
    },
    {
        "name": "toggle_tool",
        "description": "Enable or disable a specific tool or an entire server for the current session.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tool_name": {"type": "string"},
                "server_name": {"type": "string"},
                "enabled": {"type": "boolean", "description": "Whether to enable or disable"},
            },
            "required": ["enabled"],
        },
    },
    {
        "name": "reset_tools",
        "description": "Reset all tool/server toggle states to their default enabled state.",
        "inputSchema": {"type": "object", "properties": {"server_name": {"type": "string"}}},
    },
    {
        "name": "manage_auto_approve",
        "description": "Add or remove tools from the auto-approve list.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tool_name": {"type": "string"},
                "server_name": {"type": "string"},
                "auto_approve": {"type": "boolean"},
            },
            "required": ["auto_approve"],
        },
    },
    {
        "name": "orchestration_status",
        "description": "Show orchestration status: servers, tools, metrics.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "agent_log",
        "description": "Write an execution log entry for agent activity tracking.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticket_key": {"type": "string"},
                "agent_name": {"type": "string"},
                "step": {"type": "string"},
                "status": {"type": "string"},
                "message": {"type": "string"},
            },
            "required": ["ticket_key", "agent_name", "step", "status", "message"],
        },
    },
]

META_TOOL_NAMES = frozenset(d["name"] for d in META_TOOL_DEFINITIONS)


class MetaToolDispatcher:
    """Dispatches meta-tool calls to their handlers."""

    def __init__(self, engine: OrchestrationEngine) -> None:
        self._engine = engine

    async def dispatch(self, tool_name: str, args: dict) -> str | None:
        """Dispatch a meta-tool call. Returns None if not a meta-tool."""
        if tool_name not in META_TOOL_NAMES:
            return None
        if tool_name == "find_tools":
            return find_tools_execute(self._engine, args)
        if tool_name == "execute_dynamic_tool":
            return await execute_dynamic_execute(self._engine, args)
        if tool_name == "toggle_tool":
            return self._handle_toggle(args)
        if tool_name == "reset_tools":
            return self._handle_reset(args)
        if tool_name == "manage_auto_approve":
            return manage_auto_approve_execute(args, self._engine.get_workspace())
        if tool_name == "orchestration_status":
            return self._handle_status()
        if tool_name == "agent_log":
            return agent_log_execute(args, self._engine.get_workspace())
        return json.dumps({"error": f"Meta-tool '{tool_name}' not implemented yet"})

    def get_definitions(self) -> list[dict]:
        """Get all meta-tool definitions for tools/list."""
        return META_TOOL_DEFINITIONS

    def _handle_toggle(self, args: dict) -> str:
        enabled = args.get("enabled", True)
        tool_name = args.get("tool_name")
        if tool_name:
            self._engine.get_registry().toggle(tool_name, enabled)
            return json.dumps({"toggled": tool_name, "enabled": enabled})
        return json.dumps({"error": "tool_name or server_name required"})

    def _handle_reset(self, args: dict) -> str:
        self._engine.get_registry().reset_toggles()
        return json.dumps({"reset": True})

    def _handle_status(self) -> str:
        status = self._engine.get_status()
        servers = self._engine.get_server_status()
        return json.dumps({"orchestration": status, "servers": servers})

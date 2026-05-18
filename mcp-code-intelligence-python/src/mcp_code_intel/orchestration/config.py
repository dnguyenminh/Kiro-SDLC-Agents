"""Orchestration configuration — data classes and loader.

Reads orchestration.json from .code-intel/ directory.
Same format as Kotlin OrchestrationConfig.kt.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class AutoLogSettings:
    """Auto-logging configuration."""

    enabled: bool = True
    exclude_tools: list[str] = field(default_factory=lambda: ["mem_audit"])
    max_arg_length: int = 200


@dataclass
class OrchestrationSettings:
    """Orchestration behavior settings."""

    auto_log: AutoLogSettings = field(default_factory=AutoLogSettings)
    health_check_interval_ms: int = 30_000
    max_restart_retries: int = 3
    similarity_threshold: float = 0.7
    max_recursion_depth: int = 3
    discovery_timeout_ms: int = 10_000
    kb_search_timeout_ms: int = 2_000


@dataclass
class ServerEntry:
    """Single child MCP server configuration."""

    command: str
    args: list[str] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)
    disabled: bool = False
    timeout: int = 30_000
    auto_approve: list[str] = field(default_factory=list)


@dataclass
class OrchestrationConfig:
    """Top-level orchestration configuration."""

    mcp_servers: dict[str, ServerEntry]
    settings: OrchestrationSettings = field(default_factory=OrchestrationSettings)

    def enabled_servers(self) -> dict[str, ServerEntry]:
        """Return only non-disabled servers."""
        return {k: v for k, v in self.mcp_servers.items() if not v.disabled}


def load_orchestration_config(workspace: str) -> OrchestrationConfig | None:
    """Load orchestration.json from workspace .code-intel/ directory."""
    config_path = Path(workspace) / ".code-intel" / "orchestration.json"
    if not config_path.exists():
        return None
    try:
        data = json.loads(config_path.read_text(encoding="utf-8"))
        return _parse_config(data)
    except (json.JSONDecodeError, OSError, KeyError) as e:
        print(f"[orchestration] Config load failed: {e}", file=sys.stderr)
        return None


def _parse_config(data: dict[str, Any]) -> OrchestrationConfig:
    """Parse raw JSON dict into OrchestrationConfig."""
    servers = {}
    for name, entry in data.get("mcpServers", {}).items():
        servers[name] = ServerEntry(
            command=entry["command"],
            args=entry.get("args", []),
            env=entry.get("env", {}),
            disabled=entry.get("disabled", False),
            timeout=entry.get("timeout", 30_000),
            auto_approve=entry.get("autoApprove", []),
        )
    settings = _parse_settings(data.get("settings", {}))
    return OrchestrationConfig(mcp_servers=servers, settings=settings)


def _parse_settings(data: dict[str, Any]) -> OrchestrationSettings:
    """Parse settings section with defaults."""
    auto_log_data = data.get("autoLog", {})
    auto_log = AutoLogSettings(
        enabled=auto_log_data.get("enabled", True),
        exclude_tools=auto_log_data.get("excludeTools", ["mem_audit"]),
        max_arg_length=auto_log_data.get("maxArgLength", 200),
    )
    return OrchestrationSettings(
        auto_log=auto_log,
        health_check_interval_ms=data.get("healthCheckIntervalMs", 30_000),
        max_restart_retries=data.get("maxRestartRetries", 3),
        similarity_threshold=data.get("similarityThreshold", 0.7),
        max_recursion_depth=data.get("maxRecursionDepth", 3),
        discovery_timeout_ms=data.get("discoveryTimeoutMs", 10_000),
        kb_search_timeout_ms=data.get("kbSearchTimeoutMs", 2_000),
    )

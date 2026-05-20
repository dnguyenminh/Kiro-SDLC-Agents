"""Routing table — O(1) tool-to-server mapping.

Behavioral parity with Kotlin RoutingTable.kt.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RouteEntry:
    """Routing entry for a single tool."""

    server_name: str
    is_native: bool = False


class RoutingTable:
    """O(1) lookup from tool name to server name."""

    def __init__(self) -> None:
        self._routes: dict[str, RouteEntry] = {}

    def rebuild(self, native_names: set[str], child_by_server: dict[str, list[str]]) -> None:
        """Rebuild routing table from native tools and child server tools."""
        self._routes.clear()
        for name in native_names:
            self._routes[name] = RouteEntry(server_name="native", is_native=True)
        for source, tools in child_by_server.items():
            server_name = source.removeprefix("child:")
            for tool_name in tools:
                if tool_name not in self._routes:
                    self._routes[tool_name] = RouteEntry(server_name=server_name)

    def resolve(self, tool_name: str) -> RouteEntry | None:
        """Resolve tool name to route entry. Returns None if not found."""
        return self._routes.get(tool_name)

    def add_route(self, tool_name: str, server_name: str) -> None:
        """Add a single route entry (for dynamically discovered tools)."""
        if tool_name not in self._routes:
            self._routes[tool_name] = RouteEntry(server_name=server_name)

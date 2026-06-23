"""Transport detection and server process protocol.

Determines whether a server entry should use stdio or httpStream transport.
Behavioral parity with Kotlin Transport.kt and NodeJS transport.ts.
"""

from __future__ import annotations

from typing import Any, Protocol

from ..config import ServerEntry, TransportType
from .process import ServerState


class IServerProcess(Protocol):
    """Common interface for both stdio and httpStream server processes."""

    name: str
    state: ServerState
    tools: list[dict]
    retry_count: int

    async def start(self) -> bool: ...
    def stop(self) -> None: ...
    async def restart(self, max_retries: int) -> bool: ...
    async def call_tool(self, tool_name: str, args: dict, timeout_ms: int) -> Any: ...
    async def health_check(self) -> bool: ...
    def is_alive(self) -> bool: ...


def detect_transport(entry: ServerEntry) -> TransportType:
    """Detect transport type from server entry config.

    - url present, no command → httpStream
    - command present, no url → stdio
    - both present → use transport_type field (default httpStream)
    - neither → stdio (will fail at spawn, preserves existing error behavior)
    """
    has_url = bool(entry.url)
    has_command = bool(entry.command)
    if has_url and not has_command:
        return TransportType.HTTP_STREAM
    if has_command and not has_url:
        return TransportType.STDIO
    if has_url and has_command:
        return TransportType.STDIO if entry.transport_type == TransportType.STDIO else TransportType.HTTP_STREAM
    return TransportType.STDIO

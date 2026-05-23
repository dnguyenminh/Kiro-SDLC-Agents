"""Consolidated dispatcher — routes 17 tools + backward-compatible aliases."""

from typing import Any

from .definitions_consolidated import TOOL_ALIASES
from .dispatcher_consolidated_handlers import (
    handle_crud,
    handle_consolidate,
    handle_lifecycle,
    handle_discover,
    handle_citations,
    handle_scoring,
    handle_admin,
    handle_pin,
    handle_conversation,
    handle_map,
)


class MemoryToolDispatcherConsolidated:
    """Single dispatcher routing all 14 consolidated tools."""

    def __init__(self, v1_dispatcher: Any, v2_dispatcher: Any) -> None:
        """Reuse existing V1 and V2 dispatchers for actual handler logic."""
        self._v1 = v1_dispatcher
        self._v2 = v2_dispatcher

    def dispatch(self, name: str, args: dict[str, Any]) -> str | None:
        """Dispatch tool call. Handles new names + aliases."""
        # Resolve aliases: old name → new name + inject defaults
        resolved_name, resolved_args = self._resolve_alias(name, args)

        handler = self._get_handler(resolved_name)
        if handler is None:
            return None
        return handler(self, resolved_args)

    def _resolve_alias(
        self, name: str, args: dict[str, Any]
    ) -> tuple[str, dict[str, Any]]:
        """Map old tool names to consolidated names with default args."""
        alias = TOOL_ALIASES.get(name)
        if alias is None:
            return name, args
        new_name, defaults = alias
        merged = {**defaults, **args}
        return new_name, merged

    def _get_handler(self, name: str):
        """Get handler function for consolidated tool name."""
        return _HANDLERS.get(name)


def _handle_search(disp: MemoryToolDispatcherConsolidated, args: dict) -> str:
    """Delegate to V1 search handler."""
    return disp._v1._handle_search(args)


def _handle_ingest(disp: MemoryToolDispatcherConsolidated, args: dict) -> str:
    """Delegate to V1 ingest handler."""
    return disp._v1._handle_ingest(args)


def _handle_ingest_file(disp: MemoryToolDispatcherConsolidated, args: dict) -> str:
    """Delegate to V1 ingest_file handler."""
    return disp._v1._handle_ingest_file(args)


def _handle_graph(disp: MemoryToolDispatcherConsolidated, args: dict) -> str:
    """Delegate to V1 graph handler."""
    return disp._v1._handle_graph(args)


def _handle_templates(disp: MemoryToolDispatcherConsolidated, args: dict) -> str:
    """Delegate to V2 templates handler."""
    return disp._v2._handle_templates(args)


def _handle_attachments(disp: MemoryToolDispatcherConsolidated, args: dict) -> str:
    """Delegate to V2 attachments handler."""
    return disp._v2._handle_attachments(args)


def _handle_tags(disp: MemoryToolDispatcherConsolidated, args: dict) -> str:
    """Delegate to V2 tags handler."""
    return disp._v2._handle_tags(args)


# Handler registry — maps consolidated tool names to functions
_HANDLERS = {
    "mem_search": _handle_search,
    "mem_ingest": _handle_ingest,
    "mem_ingest_file": _handle_ingest_file,
    "mem_crud": handle_crud,
    "mem_graph": _handle_graph,
    "mem_consolidate": handle_consolidate,
    "mem_lifecycle": handle_lifecycle,
    "mem_templates": _handle_templates,
    "mem_attachments": _handle_attachments,
    "mem_discover": handle_discover,
    "mem_tags": _handle_tags,
    "mem_citations": handle_citations,
    "mem_scoring": handle_scoring,
    "mem_admin": handle_admin,
    "mem_pin": handle_pin,
    "mem_conversation": handle_conversation,
    "mem_map": handle_map,
}

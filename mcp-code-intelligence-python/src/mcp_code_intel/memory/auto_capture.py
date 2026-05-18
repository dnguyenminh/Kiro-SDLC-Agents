"""AutoCaptureHook — automatically captures knowledge from agent interactions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .decision import Decision, DecisionMemory
from .error_pattern import ErrorPattern, ErrorPatternMemory


@dataclass
class CaptureConfig:
    """Configuration for auto-capture behavior."""

    enabled: bool = True
    capture_tool_calls: bool = True
    capture_decisions: bool = True
    capture_errors: bool = True
    capture_documents: bool = True
    min_content_length: int = 50


class AutoCaptureHook:
    """Automatically captures knowledge from agent interactions."""

    def __init__(
        self,
        pipeline: Any,
        decision_memory: DecisionMemory,
        error_memory: ErrorPatternMemory,
        config: CaptureConfig | None = None,
    ) -> None:
        self._pipeline = pipeline
        self._decisions = decision_memory
        self._errors = error_memory
        self._config = config or CaptureConfig()

    def capture_tool_result(self, tool_name: str, result: str, source: str | None = None) -> None:
        """Capture a tool call result as knowledge."""
        if not self._config.capture_tool_calls:
            return
        if len(result) < self._config.min_content_length:
            return
        self._pipeline.ingest_entry(
            content=result,
            summary=f"Tool result: {tool_name}",
            entry_type="CONTEXT",
            source=source,
            tags=f"auto-capture,tool,{tool_name}",
        )

    def capture_decision(
        self, title: str, context: str, decision: str, rationale: str, source: str | None = None
    ) -> None:
        """Capture a decision."""
        if not self._config.capture_decisions:
            return
        self._decisions.record_decision(Decision(
            title=title, context=context,
            decision=decision, rationale=rationale,
            source=source, tags="auto-capture",
        ))

    def capture_error(self, error: str, context: str, solution: str, source: str | None = None) -> None:
        """Capture an error pattern."""
        if not self._config.capture_errors:
            return
        self._errors.record_error(ErrorPattern(
            error_message=error, context=context,
            root_cause="Auto-detected", solution=solution,
            source=source, tags="auto-capture",
        ))

    def capture_document(self, content: str, source: str, fmt: str = "markdown") -> None:
        """Capture a document."""
        if not self._config.capture_documents:
            return
        if len(content) < self._config.min_content_length:
            return
        if fmt == "markdown":
            self._pipeline.ingest_markdown(content, source)
        else:
            self._pipeline.ingest_text(content, source)

"""Memory engine package — local workspace knowledge management."""

from .engine import MemoryEngine
from .dispatcher import MemoryToolDispatcher
from .definitions import MEMORY_TOOL_DEFINITIONS
from .role_filter import types_for_role
from .tier_boost import factor as tier_boost_factor
from .decision import DecisionMemory, Decision
from .error_pattern import ErrorPatternMemory, ErrorPattern
from .handoff import AgentHandoffMemory, HandoffContext
from .sync_code import MemSyncCode
from .capture_filter import classify_content, is_decision_content, is_error_content
from .auto_capture import AutoCaptureHook, CaptureConfig
from .ingest_graph_linker import IngestGraphLinker, RELATION_SIBLING, RELATION_DERIVED_FROM
from .chunking_strategy import ChunkingStrategy, FixedSizeChunker, SemanticChunker, TextChunk
from .document_parser import parse_markdown, parse_plain_text, ParsedDocument, DocumentSection

__all__ = [
    "MemoryEngine",
    "MemoryToolDispatcher",
    "MEMORY_TOOL_DEFINITIONS",
    "types_for_role",
    "tier_boost_factor",
    "DecisionMemory",
    "Decision",
    "ErrorPatternMemory",
    "ErrorPattern",
    "AgentHandoffMemory",
    "HandoffContext",
    "MemSyncCode",
    "classify_content",
    "is_decision_content",
    "is_error_content",
    "AutoCaptureHook",
    "CaptureConfig",
    "IngestGraphLinker",
    "RELATION_SIBLING",
    "RELATION_DERIVED_FROM",
    "ChunkingStrategy",
    "FixedSizeChunker",
    "SemanticChunker",
    "TextChunk",
    "parse_markdown",
    "parse_plain_text",
    "ParsedDocument",
    "DocumentSection",
]

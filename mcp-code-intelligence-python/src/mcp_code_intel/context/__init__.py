"""Context module — AI context tools with token budgeting and relevance scoring.

KSA-171: Port of mcp-code-intelligence-nodejs/src/context/ to Python.
Tools: get_ai_context, get_edit_context, get_curated_context.
"""

from .ai_context_service import AIContextService
from .budget_allocator import BudgetAllocator
from .curated_context_service import CuratedContextService
from .edit_context_service import EditContextService
from .git_service import GitService
from .intent_strategies import get_strategy, get_supported_intents
from .query_analyzer import QueryAnalyzer
from .rrf_merger import RRFMerger
from .token_budget_manager import TokenBudgetManager
from .types import (
    AIContextParams, AIContextResponse,
    CallerContext, ContextItem, ContextSection,
    CuratedContextParams, CuratedContextResponse,
    EditContextParams, EditContextResult,
    GitCommit, MemoryContext, MergedResult,
    QueryAnalysis, SiblingContext, SourceWeights, TestContext,
)

__all__ = [
    "AIContextService", "BudgetAllocator", "CuratedContextService",
    "EditContextService", "GitService", "QueryAnalyzer", "RRFMerger",
    "TokenBudgetManager", "get_strategy", "get_supported_intents",
    "AIContextParams", "AIContextResponse", "CallerContext",
    "ContextItem", "ContextSection", "CuratedContextParams",
    "CuratedContextResponse", "EditContextParams", "EditContextResult",
    "GitCommit", "MemoryContext", "MergedResult", "QueryAnalysis",
    "SiblingContext", "SourceWeights", "TestContext",
]

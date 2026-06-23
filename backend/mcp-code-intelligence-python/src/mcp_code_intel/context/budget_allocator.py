"""Budget Allocator — allocates token budget across ranked results. KSA-171.

Top results get full source, middle get signatures, bottom get references.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from .token_budget_manager import TokenBudgetManager
from .types import MergedResult


@dataclass
class AllocatedResult:
    """A merged result with budget allocation metadata."""

    name: str
    id: int | None = None
    kind: str | None = None
    file: str | None = None
    line: int | None = None
    signature: str | None = None
    source_code: str | None = None
    content: str = ""
    relevance_score: float = 0.0
    sources: list[str] = field(default_factory=list)
    relationship: str | None = None
    detail: str = "reference"  # 'full' | 'signature' | 'reference'
    tokens: int = 0


class BudgetAllocator:
    """Allocates token budget across ranked results with progressive detail."""

    def __init__(self) -> None:
        self._budget_mgr = TokenBudgetManager(4000)

    def allocate(self, results: list[MergedResult], max_tokens: int) -> list[AllocatedResult]:
        """Allocate token budget across merged results."""
        allocated: list[AllocatedResult] = []
        tokens_used = 100  # Response overhead

        high_threshold = max(1, math.ceil(len(results) * 0.2))
        med_threshold = math.ceil(len(results) * 0.6)

        for i, result in enumerate(results):
            if tokens_used >= max_tokens:
                break

            if i < high_threshold:
                detail = "full"
                content = result.source_code or result.content or result.signature or result.name
                tokens = self._budget_mgr.count_tokens(content)
            elif i < med_threshold:
                detail = "signature"
                content = result.signature or result.name
                tokens = self._budget_mgr.count_tokens(content)
            else:
                detail = "reference"
                content = f"{result.name} ({result.file or 'unknown'}:{result.line or 0})"
                tokens = 15

            # Downgrade if exceeds budget
            if tokens_used + tokens > max_tokens and detail == "full":
                detail = "signature"
                content = result.signature or result.name
                tokens = self._budget_mgr.count_tokens(content)

            if tokens_used + tokens <= max_tokens:
                allocated.append(AllocatedResult(
                    name=result.name,
                    id=result.id,
                    kind=result.kind,
                    file=result.file,
                    line=result.line,
                    signature=result.signature,
                    source_code=result.source_code,
                    content=content or "",
                    relevance_score=result.relevance_score,
                    sources=result.sources,
                    relationship=result.relationship,
                    detail=detail,
                    tokens=tokens,
                ))
                tokens_used += tokens

        return allocated

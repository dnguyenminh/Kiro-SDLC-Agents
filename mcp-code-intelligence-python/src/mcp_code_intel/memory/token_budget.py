"""TokenBudget — caps search results to a configurable token limit.

Prioritizes higher-ranked results. Truncates individual entries
if a single result exceeds remaining budget.
Token counting uses chars/4 approximation (no tiktoken dependency).
"""

from dataclasses import dataclass
from typing import Any


@dataclass
class BudgetResult:
    """Result of applying token budget to search results."""

    results: list[dict[str, Any]]
    tokens_used: int
    truncated: bool
    total_matches: int


class TokenBudget:
    """Caps search results to a configurable token limit."""

    def apply(self, results: list[dict[str, Any]], max_tokens: int) -> BudgetResult:
        """Apply token budget to search results (must be pre-sorted by score)."""
        total_matches = len(results)
        limited: list[dict[str, Any]] = []
        tokens_used = 0
        truncated = False

        for result in results:
            content = result.get("entry", {}).get("content", "")
            entry_tokens = count_tokens(content)

            if tokens_used + entry_tokens <= max_tokens:
                limited.append(result)
                tokens_used += entry_tokens
            else:
                remaining = max_tokens - tokens_used
                if remaining >= 50:
                    truncated_content = truncate_to_fit(content, remaining)
                    truncated_result = {**result}
                    truncated_result["entry"] = {**result["entry"], "content": truncated_content}
                    limited.append(truncated_result)
                    tokens_used += count_tokens(truncated_content)
                truncated = True
                break

        return BudgetResult(limited, tokens_used, truncated, total_matches)


def count_tokens(text: str) -> int:
    """Approximate token count (chars / 4)."""
    return (len(text) + 3) // 4


def truncate_to_fit(text: str, max_tokens: int) -> str:
    """Truncate text to fit within token budget."""
    max_chars = max_tokens * 4
    if len(text) <= max_chars:
        return text
    return text[:max_chars - 3] + "..."

"""Token Budget Manager — estimates tokens and assembles context within budget. KSA-171.

Uses tiktoken for accurate GPT-family token counting.
"""

from __future__ import annotations

import json
from typing import Any

try:
    import tiktoken
    _ENCODER = tiktoken.get_encoding("cl100k_base")
    _USE_TIKTOKEN = True
except ImportError:
    _ENCODER = None
    _USE_TIKTOKEN = False


class TokenBudgetManager:
    """Manages token budget for context assembly with accurate counting."""

    def __init__(self, budget: int) -> None:
        self._budget = max(budget, 500)
        self._consumed = 0

    def count_tokens(self, content: Any) -> int:
        """Count tokens using tiktoken (accurate) or fallback (~4 chars/token)."""
        text = content if isinstance(content, str) else json.dumps(content, default=str)
        if _USE_TIKTOKEN and _ENCODER is not None:
            return len(_ENCODER.encode(text))
        return len(text) // 4 + 1

    def can_fit(self, tokens: int) -> bool:
        """Check if tokens can fit within remaining budget."""
        return self._consumed + tokens <= self._budget

    def consume(self, tokens: int) -> None:
        """Consume tokens from budget."""
        self._consumed += tokens

    def consume_all(self) -> None:
        """Mark budget as fully consumed."""
        self._consumed = self._budget

    def remaining(self) -> int:
        """Get remaining token budget."""
        return max(0, self._budget - self._consumed)

    def used(self) -> int:
        """Get total tokens consumed."""
        return self._consumed

    def is_exhausted(self) -> bool:
        """Check if budget is effectively exhausted (<50 tokens remaining)."""
        return self.remaining() < 50

    def truncate_to_fit(self, content: Any) -> Any:
        """Truncate content to fit remaining budget."""
        max_chars = self.remaining() * 4  # Approximate

        if isinstance(content, str):
            if len(content) <= max_chars:
                return content
            return content[:max_chars] + "\n... (truncated)"

        if isinstance(content, list):
            result: list[Any] = []
            chars = 0
            for item in content:
                item_str = json.dumps(item, default=str)
                if chars + len(item_str) > max_chars:
                    break
                result.append(item)
                chars += len(item_str)
            return result

        text = json.dumps(content, default=str)
        if len(text) <= max_chars:
            return content
        return text[:max_chars]

    def assemble(
        self,
        sections: dict[str, dict[str, Any]],
        budget: int,
    ) -> dict[str, Any]:
        """Assemble sections within token budget.

        Args:
            sections: Dict of {name: {"content": ..., "priority": int}}
            budget: Token budget for assembly

        Returns:
            {"result": {...}, "token_count": int, "included": [...], "excluded": [...]}
        """
        sorted_sections = sorted(
            ((k, v) for k, v in sections.items() if v.get("content") is not None),
            key=lambda x: x[1]["priority"],
        )

        result: dict[str, Any] = {}
        used_tokens = 0
        included: list[str] = []
        excluded: list[str] = []

        for key, section in sorted_sections:
            content = section["content"]
            tokens = self.count_tokens(content)

            if used_tokens + tokens <= budget:
                result[key] = content
                used_tokens += tokens
                included.append(key)
            elif isinstance(content, list) and content:
                remaining = budget - used_tokens
                truncated = self._truncate_array(content, remaining)
                if truncated:
                    result[key] = truncated
                    used_tokens += self.count_tokens(truncated)
                    included.append(f"{key} (truncated: {len(truncated)}/{len(content)})")
                else:
                    excluded.append(key)
            else:
                excluded.append(key)

        return {
            "result": result,
            "token_count": used_tokens,
            "included": included,
            "excluded": excluded,
        }

    def _truncate_array(self, arr: list[Any], token_budget: int) -> list[Any]:
        result: list[Any] = []
        used = 0
        for item in arr:
            tokens = self.count_tokens(item)
            if used + tokens > token_budget:
                break
            result.append(item)
            used += tokens
        return result

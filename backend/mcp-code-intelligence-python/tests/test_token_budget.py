"""Tests for TokenBudget — search result token limiting."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from mcp_code_intel.memory.token_budget import TokenBudget, count_tokens, truncate_to_fit


def _make_result(content: str, entry_id: int = 1) -> dict:
    return {"entry": {"id": entry_id, "content": content}, "score": 1.0}


def test_returns_all_within_budget():
    budget = TokenBudget()
    results = [_make_result("short content", 1), _make_result("another short", 2)]
    br = budget.apply(results, 2000)
    assert len(br.results) == 2
    assert br.truncated is False
    assert br.total_matches == 2


def test_truncates_when_exceeded():
    budget = TokenBudget()
    long_content = "x" * 4000  # ~1000 tokens
    results = [_make_result(long_content, i) for i in range(3)]
    br = budget.apply(results, 1500)
    assert len(br.results) < 3
    assert br.truncated is True
    assert br.total_matches == 3
    assert br.tokens_used <= 1500


def test_truncates_individual_entry():
    budget = TokenBudget()
    results = [
        _make_result("a" * 400, 1),   # 100 tokens
        _make_result("b" * 4000, 2),  # 1000 tokens — won't fit
    ]
    br = budget.apply(results, 300)
    assert len(br.results) == 2
    assert br.truncated is True
    assert br.results[1]["entry"]["content"].endswith("...")
    assert len(br.results[1]["entry"]["content"]) < 4000


def test_skips_if_remaining_too_small():
    budget = TokenBudget()
    results = [
        _make_result("a" * 1000, 1),  # 250 tokens
        _make_result("b" * 4000, 2),  # 1000 tokens
    ]
    br = budget.apply(results, 260)
    assert len(br.results) == 1
    assert br.truncated is True


def test_empty_results():
    budget = TokenBudget()
    br = budget.apply([], 2000)
    assert len(br.results) == 0
    assert br.truncated is False
    assert br.tokens_used == 0


def test_count_tokens():
    assert count_tokens("abcd") == 1
    assert count_tokens("abcde") == 2
    assert count_tokens("x" * 100) == 25


def test_truncate_to_fit():
    text = "x" * 1000
    truncated = truncate_to_fit(text, 50)  # 50 tokens = 200 chars
    assert len(truncated) <= 200
    assert truncated.endswith("...")


def test_truncate_returns_original_if_within():
    text = "short text"
    assert truncate_to_fit(text, 100) == text

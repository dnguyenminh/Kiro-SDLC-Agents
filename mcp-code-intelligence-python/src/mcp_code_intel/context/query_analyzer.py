"""Query Analyzer — extracts keywords, symbol candidates, and phrases from NL queries. KSA-171."""

from __future__ import annotations

import re

from .types import QueryAnalysis

_STOP_WORDS = frozenset([
    "how", "does", "the", "is", "what", "where", "when", "a", "an", "in",
    "for", "to", "of", "and", "or", "not", "this", "that", "with", "from",
    "are", "was", "were", "been", "being", "have", "has", "had", "do", "did",
    "will", "would", "could", "should", "may", "might", "can", "shall",
    "its", "it", "they", "them", "their", "we", "our", "you", "your",
    "all", "each", "every", "both", "few", "more", "most", "other", "some",
    "such", "than", "too", "very", "just", "but", "about", "above", "after",
    "before", "between", "into", "through", "during", "until", "while",
])

_SYMBOL_PATTERN = re.compile(
    r"[A-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)?|[a-z]+(?:_[a-z_]+)+|[a-z]+[A-Z][a-zA-Z0-9]*"
)


class QueryAnalyzer:
    """Analyzes natural language queries into search components."""

    def analyze(self, query: str) -> QueryAnalysis:
        """Analyze a natural language query into search components."""
        # Tokenize: lowercase, remove special chars, split
        cleaned = re.sub(r"[^\w\s.\-_]", " ", query.lower())
        tokens = [t for t in cleaned.split() if len(t) > 2 and t not in _STOP_WORDS]

        # Identify symbol candidates (camelCase, PascalCase, snake_case, dot.notation)
        symbol_candidates = _SYMBOL_PATTERN.findall(query)

        # Extract bigrams for phrase search
        phrases = [f"{tokens[i]} {tokens[i + 1]}" for i in range(len(tokens) - 1)]

        # Build FTS query (OR-joined keywords)
        fts_query = " OR ".join(tokens) if tokens else query

        return QueryAnalysis(
            original_query=query,
            keywords=tokens,
            symbol_candidates=symbol_candidates,
            phrases=phrases,
            fts_query=fts_query,
        )

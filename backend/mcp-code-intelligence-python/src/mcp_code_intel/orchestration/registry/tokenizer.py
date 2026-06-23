"""Text tokenizer for tool search — splits text into normalized tokens.

Handles: underscore_case, camelCase, hyphen-case, spaces.
Behavioral parity with Kotlin Tokenizer.kt.
"""

import re

STOPWORDS = frozenset({
    "a", "an", "the", "is", "are", "was", "were", "be", "been",
    "to", "for", "and", "or", "in", "on", "with", "from", "by",
    "of", "at", "as", "it", "its", "this", "that", "not", "no",
})

_SPLIT_RE = re.compile(r"[^a-zA-Z0-9]+")
_CAMEL_RE = re.compile(r"(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")


def tokenize(text: str) -> set[str]:
    """Tokenize text into normalized, deduplicated, stopword-free tokens."""
    raw = _SPLIT_RE.split(text)
    camel_parts = _CAMEL_RE.split(text)
    all_parts = raw + camel_parts
    return {
        t
        for part in all_parts
        if (t := part.lower().strip()) and len(t) > 1 and t not in STOPWORDS
    }


def remove_stopwords(terms: list[str]) -> list[str]:
    """Remove stopwords from a list of query terms."""
    return [t for t in terms if t.lower() not in STOPWORDS]

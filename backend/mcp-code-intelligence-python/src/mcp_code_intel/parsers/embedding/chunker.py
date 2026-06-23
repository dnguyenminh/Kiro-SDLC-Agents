"""KSA-169: Chunker — Split text into overlapping chunks for embedding."""
from __future__ import annotations
from dataclasses import dataclass


@dataclass
class Chunk:
    text: str
    index: int
    token_count: int
    start_offset: int
    end_offset: int


class Chunker:
    def __init__(self, max_tokens: int = 512, overlap: int = 128) -> None:
        self._max_tokens = max_tokens
        self._overlap = overlap

    def chunk(self, text: str) -> list[Chunk]:
        words = [w for w in text.split() if w]
        if len(words) <= self._max_tokens:
            return [Chunk(text=text, index=0, token_count=len(words), start_offset=0, end_offset=len(text))]
        chunks: list[Chunk] = []
        start = 0
        chunk_index = 0
        while start < len(words):
            end = min(start + self._max_tokens, len(words))
            chunk_words = words[start:end]
            chunks.append(Chunk(
                text=" ".join(chunk_words), index=chunk_index,
                token_count=len(chunk_words), start_offset=start, end_offset=end,
            ))
            chunk_index += 1
            start += self._max_tokens - self._overlap
            if start >= len(words):
                break
        return chunks

    @property
    def max_tokens(self) -> int:
        return self._max_tokens

    @property
    def overlap(self) -> int:
        return self._overlap

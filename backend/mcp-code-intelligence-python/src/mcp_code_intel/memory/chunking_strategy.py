"""Zero-context chunking strategies for document ingestion."""

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class TextChunk:
    """A chunk of text with position metadata."""
    content: str
    index: int
    start_offset: int
    end_offset: int
    metadata: dict[str, str] = field(default_factory=dict)


class ChunkingStrategy(ABC):
    """Interface for chunking strategies."""

    @abstractmethod
    def chunk(self, text: str, metadata: dict[str, str] | None = None) -> list[TextChunk]:
        """Split text into chunks."""


class FixedSizeChunker(ChunkingStrategy):
    """Fixed-size chunking with overlap."""

    def __init__(self, chunk_size: int = 512, overlap: int = 64) -> None:
        self._chunk_size = chunk_size
        self._overlap = overlap

    def chunk(self, text: str, metadata: dict[str, str] | None = None) -> list[TextChunk]:
        """Split text into fixed-size chunks with overlap."""
        meta = metadata or {}
        if len(text) <= self._chunk_size:
            return [TextChunk(text, 0, 0, len(text), meta)]
        return self._split_fixed(text, meta)

    def _split_fixed(self, text: str, meta: dict[str, str]) -> list[TextChunk]:
        """Produce overlapping fixed-size chunks."""
        chunks: list[TextChunk] = []
        start = 0
        index = 0
        while start < len(text):
            end = min(start + self._chunk_size, len(text))
            chunks.append(TextChunk(text[start:end], index, start, end, meta))
            start += self._chunk_size - self._overlap
            index += 1
        return chunks


class SemanticChunker(ChunkingStrategy):
    """Semantic chunking — splits on paragraph/section boundaries."""

    def __init__(self, max_chunk_size: int = 1024, min_chunk_size: int = 100) -> None:
        self._max_size = max_chunk_size
        self._min_size = min_chunk_size

    def chunk(self, text: str, metadata: dict[str, str] | None = None) -> list[TextChunk]:
        """Split text by paragraph boundaries, merging small paragraphs."""
        meta = metadata or {}
        paragraphs = _split_paragraphs(text)
        return _merge_paragraphs(paragraphs, self._max_size, meta)


def _split_paragraphs(text: str) -> list[str]:
    """Split text on double newlines."""
    return [p for p in re.split(r"\n{2,}", text) if p.strip()]


def _merge_paragraphs(
    paragraphs: list[str], max_size: int, meta: dict[str, str]
) -> list[TextChunk]:
    """Merge paragraphs into chunks respecting max size."""
    chunks: list[TextChunk] = []
    current = ""
    offset = 0
    index = 0

    for para in paragraphs:
        if len(current) + len(para) > max_size and current:
            chunks.append(TextChunk(current.strip(), index, offset, offset + len(current), meta))
            offset += len(current)
            current = ""
            index += 1
        current += para + "\n"

    if current.strip():
        chunks.append(TextChunk(current.strip(), index, offset, offset + len(current), meta))
    return chunks

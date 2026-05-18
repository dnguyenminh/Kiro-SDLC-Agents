"""IngestPipeline — parse, chunk, and store knowledge entries."""

import sys
from typing import Any, TYPE_CHECKING

from .knowledge_repo import KnowledgeRepository
from .document_parser import parse_markdown, parse_plain_text
from .chunking_strategy import SemanticChunker, TextChunk

if TYPE_CHECKING:
    from .embedding import EmbeddingService


class IngestPipeline:
    """Document ingestion — parse, chunk, store, embed."""

    def __init__(self, repo: KnowledgeRepository,
                 embedding_service: "EmbeddingService | None" = None) -> None:
        self._repo = repo
        self._embedding = embedding_service
        self._chunker = SemanticChunker(max_chunk_size=1024)

    def ingest_entry(self, content: str, summary: str, type_: str,
                     source: str | None = None, tags: str = "") -> int:
        """Ingest a single knowledge entry. Returns entry ID."""
        entry_id = self._repo.insert(content, summary, type_, "WORKING", source, tags)
        self._embed(entry_id, summary)
        return entry_id

    def ingest_markdown(self, text: str, source: str,
                        type_: str = "CONTEXT") -> dict[str, Any]:
        """Ingest markdown document — splits by sections."""
        doc = parse_markdown(text, source)
        entries_created = 0
        tier = _tier_for_type(type_)
        for section in doc.sections:
            if not section.content.strip():
                continue
            chunks = self._chunker.chunk(section.content)
            for chunk in chunks:
                summary = _build_summary(chunk.content, section.heading)
                entry_id = self._repo.insert(
                    chunk.content, summary, type_, tier, source, section.heading
                )
                self._embed(entry_id, summary)
                entries_created += 1
        return {"entries_created": entries_created, "source": source}

    def ingest_text(self, text: str, source: str,
                    type_: str = "CONTEXT") -> dict[str, Any]:
        """Ingest plain text."""
        entries_created = 0
        tier = _tier_for_type(type_)
        chunks = self._chunker.chunk(text)
        for chunk in chunks:
            summary = chunk.content.split("\n")[0][:120] if chunk.content else source
            entry_id = self._repo.insert(chunk.content, summary, type_, tier, source, "")
            self._embed(entry_id, summary)
            entries_created += 1
        return {"entries_created": entries_created, "source": source}

    def _embed(self, entry_id: int, text: str) -> None:
        """Generate and store embedding if service is available."""
        if self._embedding is None:
            return
        try:
            self._embedding.embed_and_store(entry_id, text)
        except Exception as e:
            _log(f"Embedding failed for entry {entry_id}: {e}")


def _tier_for_type(type_: str) -> str:
    """Assign tier based on knowledge type."""
    if type_ in ("REQUIREMENT", "ARCHITECTURE", "PROCEDURE", "API_DESIGN"):
        return "SEMANTIC"
    if type_ in ("DECISION", "LESSON_LEARNED", "ERROR_PATTERN"):
        return "EPISODIC"
    return "WORKING"


def _build_summary(content: str, heading: str) -> str:
    """Build summary from first line + heading."""
    first_line = next((l for l in content.split("\n") if l.strip()), "")
    preview = first_line[:120]
    return f"{heading}: {preview}" if heading else preview


def _log(msg: str) -> None:
    print(f"[ingest] {msg}", file=sys.stderr, flush=True)

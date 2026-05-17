"""IngestPipeline — parse, chunk, and store knowledge entries."""

import re
import sys
from typing import Any, TYPE_CHECKING

from .knowledge_repo import KnowledgeRepository

if TYPE_CHECKING:
    from .embedding import EmbeddingService


class IngestPipeline:
    """Document ingestion — parse, chunk, store, embed."""

    def __init__(self, repo: KnowledgeRepository,
                 embedding_service: "EmbeddingService | None" = None) -> None:
        self._repo = repo
        self._embedding = embedding_service

    def ingest_entry(self, content: str, summary: str, type_: str,
                     source: str | None = None, tags: str = "") -> int:
        """Ingest a single knowledge entry. Returns entry ID."""
        entry_id = self._repo.insert(content, summary, type_, "WORKING", source, tags)
        self._embed(entry_id, summary)
        return entry_id

    def ingest_markdown(self, text: str, source: str,
                        type_: str = "CONTEXT") -> dict[str, Any]:
        """Ingest markdown document — splits by sections."""
        sections = self._parse_sections(text)
        entries_created = 0
        tier = self._tier_for_type(type_)
        for heading, content in sections:
            if not content.strip():
                continue
            for chunk in self._chunk_text(content):
                summary = self._build_summary(chunk, heading)
                entry_id = self._repo.insert(chunk, summary, type_, tier, source, heading)
                self._embed(entry_id, summary)
                entries_created += 1
        return {"entries_created": entries_created, "source": source}

    def ingest_text(self, text: str, source: str,
                    type_: str = "CONTEXT") -> dict[str, Any]:
        """Ingest plain text."""
        entries_created = 0
        tier = self._tier_for_type(type_)
        for chunk in self._chunk_text(text):
            summary = chunk.split("\n")[0][:120] if chunk else source
            entry_id = self._repo.insert(chunk, summary, type_, tier, source, "")
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

    @staticmethod
    def _tier_for_type(type_: str) -> str:
        """Assign tier based on knowledge type."""
        if type_ in ("REQUIREMENT", "ARCHITECTURE", "PROCEDURE", "API_DESIGN"):
            return "SEMANTIC"
        if type_ in ("DECISION", "LESSON_LEARNED", "ERROR_PATTERN"):
            return "EPISODIC"
        return "WORKING"

    def _parse_sections(self, text: str) -> list[tuple[str, str]]:
        """Parse markdown into (heading, content) pairs."""
        lines = text.split("\n")
        sections: list[tuple[str, str]] = []
        current_heading = ""
        content_lines: list[str] = []

        for line in lines:
            match = re.match(r"^(#{1,6})\s+(.+)", line)
            if match:
                if content_lines or current_heading:
                    sections.append((current_heading, "\n".join(content_lines).strip()))
                    content_lines = []
                current_heading = match.group(2)
            else:
                content_lines.append(line)

        if content_lines or current_heading:
            sections.append((current_heading, "\n".join(content_lines).strip()))
        return sections

    def _chunk_text(self, text: str, max_size: int = 1024) -> list[str]:
        """Split text into chunks by paragraph boundaries."""
        if len(text) <= max_size:
            return [text]
        paragraphs = [p for p in re.split(r"\n{2,}", text) if p.strip()]
        chunks: list[str] = []
        current = ""
        for para in paragraphs:
            if len(current) + len(para) > max_size and current:
                chunks.append(current.strip())
                current = ""
            current += para + "\n\n"
        if current.strip():
            chunks.append(current.strip())
        return chunks

    def _build_summary(self, content: str, heading: str) -> str:
        """Build summary from first line + heading."""
        first_line = next((l for l in content.split("\n") if l.strip()), "")
        preview = first_line[:120]
        return f"{heading}: {preview}" if heading else preview


def _log(msg: str) -> None:
    print(f"[ingest] {msg}", file=sys.stderr, flush=True)

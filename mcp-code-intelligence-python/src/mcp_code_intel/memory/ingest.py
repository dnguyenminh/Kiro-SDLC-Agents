"""IngestPipeline — parse, chunk, and store knowledge entries. Enhanced with quality gate (KSA-110 F4)."""

import sys
from typing import Any, TYPE_CHECKING

from .knowledge_repo import KnowledgeRepository
from .document_parser import parse_markdown, parse_plain_text
from .chunking_strategy import SemanticChunker, TextChunk
from .ingest_graph_linker import IngestGraphLinker

if TYPE_CHECKING:
    from .embedding import EmbeddingService
    from .knowledge_graph import KnowledgeGraph
    from .quality_gate import QualityGate, QualityResult, IngestMeta


class QualityRejectionError(Exception):
    """Error thrown when quality gate rejects content."""

    def __init__(self, quality: "QualityResult") -> None:
        super().__init__(quality.message or "Quality gate rejected content")
        self.quality = quality


class IngestPipeline:
    """Document ingestion — parse, chunk, store, embed. Quality gate applied if set."""

    def __init__(self, repo: KnowledgeRepository,
                 embedding_service: "EmbeddingService | None" = None) -> None:
        self._repo = repo
        self._embedding = embedding_service
        self._chunker = SemanticChunker(max_chunk_size=1024)
        self._quality_gate: "QualityGate | None" = None
        self._graph_linker: IngestGraphLinker | None = None

    def set_quality_gate(self, gate: "QualityGate") -> None:
        """Inject QualityGate for ingest validation."""
        self._quality_gate = gate

    def set_graph_linker(self, linker: IngestGraphLinker) -> None:
        """Inject graph linker for automatic edge creation on ingest."""
        self._graph_linker = linker

    def ingest_entry(self, content: str, summary: str, type_: str,
                     source: str | None = None, tags: str = "") -> int:
        """Ingest a single knowledge entry. Quality gate applied if set. Returns entry ID."""
        if self._quality_gate:
            from .quality_gate import IngestMeta
            quality = self._quality_gate.validate(content, IngestMeta(tags=tags, type=type_, source=source))
            if quality.decision == "reject":
                raise QualityRejectionError(quality)

        entry_id = self._repo.insert(content, summary, type_, "WORKING", source, tags)
        self._embed(entry_id, summary)
        self._try_set_quality_score(entry_id, content, tags, type_, source)
        self._extract_structured_map(entry_id, content)
        self._link_graph(entry_id, source, tags, content)
        return entry_id

    def _try_set_quality_score(self, entry_id: int, content: str,
                              tags: str, type_: str, source: str | None) -> None:
        """Set quality score on entry after ingest."""
        if not self._quality_gate:
            return
        try:
            from .quality_gate import IngestMeta
            result = self._quality_gate.validate(content, IngestMeta(tags=tags, type=type_, source=source))
            self._repo.update_quality_score(entry_id, result.score)
        except Exception:
            pass  # quality scoring must not break ingest

    def ingest_markdown(self, text: str, source: str,
                        type_: str = "CONTEXT") -> dict[str, Any]:
        """Ingest markdown document — splits by sections."""
        doc = parse_markdown(text, source)
        entries_created = 0
        chunk_ids: list[int] = []
        tier = _tier_for_type(type_)
        tags = ""  # Will be set from source for linking
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
                chunk_ids.append(entry_id)
                entries_created += 1

        # Create graph edges for all chunks from this document
        edges_created = 0
        if self._graph_linker and chunk_ids:
            edges_created += self._graph_linker.link_chunks(chunk_ids, source)
            # Also link each chunk by ticket/tags/doc-dependency
            for cid in chunk_ids:
                edges_created += self._graph_linker.link_entry(cid, source, tags, "")

        return {"entries_created": entries_created, "edges_created": edges_created, "source": source}

    def ingest_text(self, text: str, source: str,
                    type_: str = "CONTEXT") -> dict[str, Any]:
        """Ingest plain text."""
        entries_created = 0
        chunk_ids: list[int] = []
        tier = _tier_for_type(type_)
        chunks = self._chunker.chunk(text)
        for chunk in chunks:
            summary = chunk.content.split("\n")[0][:120] if chunk.content else source
            entry_id = self._repo.insert(chunk.content, summary, type_, tier, source, "")
            self._embed(entry_id, summary)
            chunk_ids.append(entry_id)
            entries_created += 1

        # Create graph edges
        edges_created = 0
        if self._graph_linker and chunk_ids:
            edges_created += self._graph_linker.link_chunks(chunk_ids, source)
            for cid in chunk_ids:
                edges_created += self._graph_linker.link_entry(cid, source, "", "")

        return {"entries_created": entries_created, "edges_created": edges_created, "source": source}

    def _embed(self, entry_id: int, text: str) -> None:
        """Generate and store embedding if service is available."""
        if self._embedding is None:
            return
        try:
            self._embedding.embed_and_store(entry_id, text)
        except Exception as e:
            _log(f"Embedding failed for entry {entry_id}: {e}")

    def _link_graph(self, entry_id: int, source: str | None, tags: str, content: str) -> None:
        """Create graph edges for a newly ingested entry."""
        if self._graph_linker is None:
            return
        try:
            edges = self._graph_linker.link_entry(entry_id, source, tags, content)
            if edges:
                _log(f"Graph linked entry {entry_id}: {edges} edges created")
        except Exception as e:
            _log(f"Graph linking failed for entry {entry_id}: {e}")

    def _extract_structured_map(self, entry_id: int, content: str) -> None:
        """Extract structured map and index entities (KSA-142 F3)."""
        try:
            from .structured_map_extractor import extract_structured_map, EntityRepository
            smap = extract_structured_map(content)
            conn = self._repo._conn
            conn.execute(
                "UPDATE knowledge_entries SET structured_map = ? WHERE id = ?",
                (smap.to_json(), entry_id),
            )
            conn.commit()
            if smap.entities_mentioned:
                entity_repo = EntityRepository(conn)
                entity_repo.index_entities(entry_id, smap.entities_mentioned)
        except Exception as e:
            _log(f"Structured map extraction failed for entry {entry_id}: {e}")


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

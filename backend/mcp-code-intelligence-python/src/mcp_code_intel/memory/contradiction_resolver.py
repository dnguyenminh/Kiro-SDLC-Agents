"""ContradictionResolver — Detects and resolves conflicting information in KB.

Implements 3 strategies from Invalid-Info_in-KB.md:
1. Metadata/Status — marks entries as SUPERSEDED when newer info contradicts
2. LLM Consolidation — optional LLM validation (off if no LLM configured)
3. Graph SUPERSEDES — creates SUPERSEDES edges in knowledge graph

Usage:
- On ingest: detect_and_resolve(new_entry_id) -> checks for contradictions
- On search: filter_superseded(results) -> removes invalid entries from results
"""

import json
import re
import sqlite3
from dataclasses import dataclass, field
from typing import Any


# --- Configuration ---

@dataclass
class ContradictionConfig:
    """Configuration for contradiction resolution strategies."""
    enable_status_marking: bool = True
    enable_llm_consolidation: bool = False  # Off by default
    enable_graph_supersedes: bool = True
    entity_overlap_threshold: float = 0.5
    llm_endpoint: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None


# --- Contradiction signals ---

SUPERSESSION_SIGNALS = [
    # Vietnamese
    'hủy bỏ', 'hủy', 'bãi bỏ', 'thay thế', 'không còn', 'đã xóa',
    'cập nhật lại', 'sửa lại', 'thay đổi', 'chuyển sang', 'dừng',
    'ngừng', 'loại bỏ', 'deprecated', 'đã cũ', 'không dùng nữa',
    # English
    'cancel', 'cancelled', 'revoke', 'revoked', 'supersede', 'superseded',
    'replace', 'replaced', 'override', 'overridden', 'deprecate',
    'no longer', 'removed', 'deleted', 'instead of', 'changed to',
    'updated to', 'migrated to', 'switched to', 'stop using',
    'do not use', 'obsolete', 'invalid', 'was wrong', 'correction',
]

STRONG_SIGNALS = ['hủy bỏ', 'cancel', 'replace', 'supersede', 'deprecated', 'obsolete', 'revoke']


# --- Types ---

@dataclass
class ContradictionDetection:
    new_entry_id: int
    conflicting_entry_ids: list[int] = field(default_factory=list)
    signal: str = ""
    confidence: float = 0.0


@dataclass
class ResolutionResult:
    detected: list[ContradictionDetection] = field(default_factory=list)
    resolved: int = 0
    superseded_entries: list[int] = field(default_factory=list)
    edges_created: int = 0


@dataclass
class SearchResultEntry:
    """Minimal search result representation for filtering."""
    id: int
    content: str
    summary: str
    type: str
    created_at: str
    score: float = 0.0


# --- Main Class ---

class ContradictionResolver:
    """Detects and resolves conflicting/contradictory information in KB."""

    def __init__(self, conn: sqlite3.Connection, config: ContradictionConfig | None = None) -> None:
        self._conn = conn
        self._config = config or ContradictionConfig()

        # Auto-disable LLM if no endpoint
        if not self._config.llm_endpoint:
            self._config.enable_llm_consolidation = False

        self._ensure_schema()

    def update_config(self, **kwargs: Any) -> None:
        """Update configuration at runtime."""
        for k, v in kwargs.items():
            if hasattr(self._config, k):
                setattr(self._config, k, v)
        if not self._config.llm_endpoint:
            self._config.enable_llm_consolidation = False

    def get_config(self) -> ContradictionConfig:
        """Get current config."""
        return self._config

    # =========================================================================
    # STRATEGY 1: Metadata/Status Marking (on ingest)
    # =========================================================================

    def detect_and_resolve(self, new_entry_id: int) -> ResolutionResult:
        """On ingest: detect contradictions and mark old entries as SUPERSEDED."""
        result = ResolutionResult()

        new_entry = self._get_entry(new_entry_id)
        if not new_entry:
            return result

        # Check for supersession signal
        signal = self._detect_signal(new_entry["content"])
        if not signal:
            return result

        # Find conflicting entries
        conflicting = self._find_conflicting(new_entry, new_entry_id)
        if not conflicting:
            return result

        detection = ContradictionDetection(
            new_entry_id=new_entry_id,
            conflicting_entry_ids=[e["id"] for e in conflicting],
            signal=signal,
            confidence=self._compute_confidence(new_entry, conflicting, signal),
        )
        result.detected.append(detection)

        # Only resolve if confidence >= 0.6
        if detection.confidence >= 0.6:
            for old in conflicting:
                # Strategy 1: Mark as superseded
                if self._config.enable_status_marking:
                    self._mark_superseded(old["id"], new_entry_id)
                    result.superseded_entries.append(old["id"])

                # Strategy 3: Create SUPERSEDES edge
                if self._config.enable_graph_supersedes:
                    if not self._edge_exists(new_entry_id, old["id"], "SUPERSEDES"):
                        self._add_edge(new_entry_id, old["id"], "SUPERSEDES", detection.confidence, signal)
                        result.edges_created += 1

            result.resolved = len(conflicting)

        self._log_resolution(result)
        return result

    # =========================================================================
    # STRATEGY 2: LLM Consolidation (on search)
    # =========================================================================

    def consolidate_with_llm(self, results: list[SearchResultEntry], query: str) -> list[SearchResultEntry]:
        """Post-search LLM consolidation. Returns filtered results.

        If LLM not configured, returns original results unchanged.
        """
        if not self._config.enable_llm_consolidation or not self._config.llm_endpoint:
            return results

        try:
            import urllib.request

            prompt = self._build_consolidation_prompt(results, query)
            payload = json.dumps({
                "model": self._config.llm_model or "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
                "max_tokens": 200,
            }).encode()

            headers = {"Content-Type": "application/json"}
            if self._config.llm_api_key:
                headers["Authorization"] = f"Bearer {self._config.llm_api_key}"

            req = urllib.request.Request(self._config.llm_endpoint, data=payload, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())

            response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "[]")
            invalid_ids = self._parse_llm_response(response_text, results)
            return [r for r in results if r.id not in invalid_ids]

        except Exception:
            # Graceful degradation
            return results

    # =========================================================================
    # STRATEGY 3: Graph-based SUPERSEDES filtering (on search)
    # =========================================================================

    def filter_superseded(self, results: list[SearchResultEntry]) -> list[SearchResultEntry]:
        """Post-search: filter out entries marked SUPERSEDED or with SUPERSEDES edges."""
        if not self._config.enable_graph_supersedes and not self._config.enable_status_marking:
            return results

        superseded_ids: set[int] = set()

        # Strategy 1: Check validity_status
        if self._config.enable_status_marking:
            for r in results:
                status = self._get_validity_status(r.id)
                if status == "SUPERSEDED":
                    superseded_ids.add(r.id)

        # Strategy 3: Check SUPERSEDES edges
        if self._config.enable_graph_supersedes:
            for r in results:
                edges = self._get_superseding_edges(r.id)
                for edge in edges:
                    source_status = self._get_validity_status(edge["source_id"])
                    if source_status != "SUPERSEDED":
                        superseded_ids.add(r.id)
                        break

        return [r for r in results if r.id not in superseded_ids]

    # =========================================================================
    # Public utility methods
    # =========================================================================

    def manual_supersede(self, old_entry_id: int, new_entry_id: int, reason: str = "manual") -> None:
        """Manually mark an entry as superseded."""
        self._mark_superseded(old_entry_id, new_entry_id)
        if self._config.enable_graph_supersedes:
            if not self._edge_exists(new_entry_id, old_entry_id, "SUPERSEDES"):
                self._add_edge(new_entry_id, old_entry_id, "SUPERSEDES", 1.0, reason)

    def revalidate(self, entry_id: int) -> None:
        """Undo supersession."""
        cur = self._conn.cursor()
        cur.execute(
            "UPDATE knowledge_entries SET validity_status = 'ACTIVE', superseded_by = NULL, "
            "superseded_at = NULL, updated_at = datetime('now') WHERE id = ?",
            (entry_id,),
        )
        self._conn.commit()

    def get_stats(self) -> dict[str, int]:
        """Get contradiction resolution statistics."""
        cur = self._conn.cursor()
        superseded = cur.execute(
            "SELECT COUNT(*) FROM knowledge_entries WHERE validity_status = 'SUPERSEDED'"
        ).fetchone()[0]
        active = cur.execute(
            "SELECT COUNT(*) FROM knowledge_entries WHERE validity_status = 'ACTIVE' OR validity_status IS NULL"
        ).fetchone()[0]
        edges = cur.execute(
            "SELECT COUNT(*) FROM knowledge_graph_edges WHERE relation = 'SUPERSEDES'"
        ).fetchone()[0]
        return {"total_superseded": superseded, "total_active": active, "supersedes_edges": edges}

    # =========================================================================
    # Private helpers
    # =========================================================================

    def _ensure_schema(self) -> None:
        cur = self._conn.cursor()
        for stmt in [
            "ALTER TABLE knowledge_entries ADD COLUMN validity_status TEXT DEFAULT 'ACTIVE'",
            "ALTER TABLE knowledge_entries ADD COLUMN superseded_by INTEGER DEFAULT NULL",
            "ALTER TABLE knowledge_entries ADD COLUMN superseded_at TEXT DEFAULT NULL",
        ]:
            try:
                cur.execute(stmt)
            except sqlite3.OperationalError:
                pass
        try:
            cur.execute("CREATE INDEX IF NOT EXISTS idx_ke_validity ON knowledge_entries(validity_status)")
        except sqlite3.OperationalError:
            pass
        self._conn.commit()

    def _get_entry(self, entry_id: int) -> dict[str, Any] | None:
        cur = self._conn.cursor()
        cur.row_factory = sqlite3.Row
        cur.execute("SELECT * FROM knowledge_entries WHERE id = ?", (entry_id,))
        row = cur.fetchone()
        cur.row_factory = None
        return dict(row) if row else None

    def _detect_signal(self, content: str) -> str | None:
        lower = content.lower()
        for signal in SUPERSESSION_SIGNALS:
            if signal in lower:
                return signal
        return None

    def _find_conflicting(self, new_entry: dict, new_entry_id: int) -> list[dict]:
        entities = self._extract_entities(new_entry_id)
        if entities:
            return self._find_by_entities(entities, new_entry_id)
        return self._find_by_similar_content(new_entry, new_entry_id)

    def _find_by_entities(self, entities: list[str], new_entry_id: int) -> list[dict]:
        cur = self._conn.cursor()
        candidates: list[dict] = []
        seen: set[int] = set()
        for entity in entities:
            cur.execute(
                "SELECT DISTINCT ke.* FROM knowledge_entries ke "
                "JOIN entity_index ei ON ke.id = ei.entry_id "
                "WHERE ei.entity_name = ? AND ke.id != ? "
                "AND (ke.validity_status = 'ACTIVE' OR ke.validity_status IS NULL) "
                "AND ke.archived_at IS NULL "
                "ORDER BY ke.created_at DESC LIMIT 20",
                (entity, new_entry_id),
            )
            cols = [d[0] for d in cur.description]
            for row in cur.fetchall():
                entry = dict(zip(cols, row))
                if entry["id"] not in seen:
                    seen.add(entry["id"])
                    candidates.append(entry)
        return candidates

    def _find_by_similar_content(self, new_entry: dict, new_entry_id: int) -> list[dict]:
        sanitized = re.sub(r"[^\w\s]", " ", new_entry.get("summary", "")).strip()[:60]
        if not sanitized:
            return []
        try:
            cur = self._conn.cursor()
            cur.execute(
                "SELECT ke.* FROM knowledge_fts "
                "JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id "
                "WHERE knowledge_fts MATCH ? AND ke.id != ? "
                "AND (ke.validity_status = 'ACTIVE' OR ke.validity_status IS NULL) "
                "ORDER BY rank LIMIT 10",
                (sanitized, new_entry_id),
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
        except Exception:
            return []

    def _extract_entities(self, entry_id: int) -> list[str]:
        try:
            cur = self._conn.cursor()
            cur.execute("SELECT entity_name FROM entity_index WHERE entry_id = ?", (entry_id,))
            return [r[0] for r in cur.fetchall()]
        except Exception:
            return []

    def _compute_confidence(self, new_entry: dict, conflicting: list[dict], signal: str) -> float:
        confidence = 0.5
        if any(s in signal for s in STRONG_SIGNALS):
            confidence += 0.2
        new_ts = new_entry.get("created_at", "")
        if all(e.get("created_at", "") < new_ts for e in conflicting):
            confidence += 0.15
        if any(e.get("source") and e["source"] == new_entry.get("source") for e in conflicting):
            confidence += 0.1
        if any(e.get("type") == new_entry.get("type") for e in conflicting):
            confidence += 0.05
        return min(confidence, 1.0)

    def _mark_superseded(self, old_id: int, new_id: int) -> None:
        cur = self._conn.cursor()
        cur.execute(
            "UPDATE knowledge_entries SET validity_status = 'SUPERSEDED', "
            "superseded_by = ?, superseded_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
            (new_id, old_id),
        )
        self._conn.commit()

    def _get_validity_status(self, entry_id: int) -> str:
        cur = self._conn.cursor()
        cur.execute("SELECT validity_status FROM knowledge_entries WHERE id = ?", (entry_id,))
        row = cur.fetchone()
        return (row[0] or "ACTIVE") if row else "ACTIVE"

    def _get_superseding_edges(self, target_id: int) -> list[dict]:
        cur = self._conn.cursor()
        cur.execute(
            "SELECT source_id FROM knowledge_graph_edges WHERE target_id = ? AND relation = 'SUPERSEDES'",
            (target_id,),
        )
        return [{"source_id": r[0]} for r in cur.fetchall()]

    def _edge_exists(self, source_id: int, target_id: int, relation: str) -> bool:
        cur = self._conn.cursor()
        cur.execute(
            "SELECT 1 FROM knowledge_graph_edges WHERE "
            "((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)) "
            "AND relation = ? LIMIT 1",
            (source_id, target_id, target_id, source_id, relation),
        )
        return cur.fetchone() is not None

    def _add_edge(self, source_id: int, target_id: int, relation: str, weight: float, signal: str) -> None:
        cur = self._conn.cursor()
        cur.execute(
            "INSERT INTO knowledge_graph_edges (source_id, target_id, relation, weight, metadata) "
            "VALUES (?, ?, ?, ?, ?)",
            (source_id, target_id, relation, weight,
             json.dumps({"signal": signal, "detected_at": "now"})),
        )
        self._conn.commit()

    def _log_resolution(self, result: ResolutionResult) -> None:
        if not result.detected:
            return
        try:
            operation = "CONTRADICTION_RESOLVED" if result.resolved > 0 else "CONTRADICTION_DETECTED"
            cur = self._conn.cursor()
            cur.execute(
                "INSERT INTO memory_audit (operation, details, created_at) "
                "VALUES (?, ?, datetime('now'))",
                (operation, json.dumps({
                    "superseded": result.superseded_entries,
                    "edges_created": result.edges_created,
                    "detections": [{"new_entry": d.new_entry_id, "signal": d.signal,
                                    "confidence": d.confidence, "conflicting": d.conflicting_entry_ids}
                                   for d in result.detected],
                }),),
            )
            self._conn.commit()
        except Exception:
            pass

    def _build_consolidation_prompt(self, results: list[SearchResultEntry], query: str) -> str:
        entries = "\n---\n".join(
            f"[Entry #{r.id}] (created: {r.created_at})\n{r.content[:300]}"
            for r in results
        )
        return (
            "You are a knowledge base validator. Given the user query and multiple KB entries, "
            "identify entries with OUTDATED or CONTRADICTED information.\n\n"
            f'User Query: "{query}"\n\nRetrieved Entries:\n{entries}\n\n'
            "Return a JSON array of entry IDs to REMOVE (outdated ones). "
            "If no contradictions, return [].\n\nResponse:"
        )

    def _parse_llm_response(self, response: str, results: list[SearchResultEntry]) -> set[int]:
        try:
            match = re.search(r"\[[\d,\s]*\]", response)
            if not match:
                return set()
            ids = json.loads(match.group(0))
            valid_ids = {r.id for r in results}
            return {i for i in ids if i in valid_ids}
        except Exception:
            return set()

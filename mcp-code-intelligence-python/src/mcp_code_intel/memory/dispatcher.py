"""MemoryToolDispatcher — routes mem_* tool calls to handlers."""

import os
from typing import Any, TYPE_CHECKING

from .engine import MemoryEngine
from .ingest import IngestPipeline
from .hybrid_search import HybridSearch
from .consolidation import TierConsolidator
from .sync_code import MemSyncCode
from .dispatcher_v2 import MemoryToolDispatcherV2
from .dispatcher_consolidated import MemoryToolDispatcherConsolidated
from .engine_v2 import MemoryEngineV2

if TYPE_CHECKING:
    from .embedding import EmbeddingService


class MemoryToolDispatcher:
    """Routes mem_* tool calls to appropriate handlers."""

    def __init__(self, engine: MemoryEngine, workspace: str,
                 embedding_service: "EmbeddingService | None" = None,
                 query_layer: Any = None) -> None:
        self._engine = engine
        self._workspace = workspace
        self._pipeline = IngestPipeline(engine.knowledge, embedding_service)
        self._search = HybridSearch(engine.search, engine.graph)
        self._consolidator = TierConsolidator(engine.knowledge, engine.consolidation)
        self._sync_code = MemSyncCode(engine, query_layer, engine.graph) if query_layer else None

        # V2 dispatcher for KB Enhancement tools
        if isinstance(engine, MemoryEngineV2):
            self._v2 = MemoryToolDispatcherV2(engine)
        else:
            self._v2 = None

        # Consolidated dispatcher (routes 14 tools + aliases)
        if self._v2:
            self._consolidated = MemoryToolDispatcherConsolidated(self, self._v2)
        else:
            self._consolidated = None

    def dispatch(self, name: str, args: dict[str, Any]) -> str | None:
        """Dispatch a memory tool call. Returns None if not a memory tool."""
        # Try consolidated dispatcher first (handles 14 tools + 20 aliases)
        if self._consolidated:
            result = self._consolidated.dispatch(name, args)
            if result is not None:
                return result

        # Fallback: direct V1 handlers for non-consolidated calls
        handlers = {
            "mem_search": self._handle_search,
            "mem_ingest": self._handle_ingest,
            "mem_ingest_file": self._handle_ingest_file,
            "mem_get": self._handle_get,
            "mem_delete": self._handle_delete,
            "mem_list": self._handle_list,
            "mem_graph": self._handle_graph,
            "mem_status": self._handle_status,
            "mem_consolidate": self._handle_consolidate,
            "mem_audit": self._handle_audit,
            "mem_sessions": self._handle_sessions,
            "mem_sync_code": self._handle_sync_code,
        }
        handler = handlers.get(name)
        if handler is None:
            return None
        return handler(args)

    def _handle_search(self, args: dict[str, Any]) -> str:
        query = args.get("query", "")
        if not query:
            return "Error: query required"
        limit = args.get("limit", 10)
        tier = args.get("tier")
        detail = args.get("detail", False)

        results = self._search.search(query, limit, tier)
        self._engine.audit.log("SEARCH", session_id=self._engine.session_id)
        self._log_search_analytics(query, len(results))
        self._record_access_and_citations(results)

        if not results:
            return f'No knowledge found for "{query}"'

        lines = [f"Found {len(results)} results:\n"]
        for r in results:
            e = r["entry"]
            lines.append(f"[{e['type']}] {e['summary']}")
            lines.append(f"  ID: {e['id']} | Tier: {e['tier']} | Score: {r['score']:.3f} | Source: {e.get('source') or 'n/a'}")
            if detail:
                lines.append(f"  Content: {e['content'][:500]}")
            lines.append("")
        if not detail:
            lines.append("Tip: use detail=true for content, or mem_get(id) for full entry.")
        return "\n".join(lines)

    def _log_search_analytics(self, query: str, result_count: int) -> None:
        """Log search to search_log + popular_queries for analytics."""
        try:
            conn = self._engine._conn
            conn.execute(
                "INSERT INTO search_log (query, result_count) VALUES (?, ?)",
                (query, result_count),
            )
            conn.execute(
                "INSERT INTO popular_queries (query, hit_count, avg_results) "
                "VALUES (?, 1, ?) "
                "ON CONFLICT(query) DO UPDATE SET "
                "hit_count = hit_count + 1, "
                "avg_results = (avg_results * (hit_count - 1) + ?) / hit_count, "
                "last_searched = datetime('now')",
                (query, result_count, result_count),
            )
            conn.commit()
        except Exception:
            pass  # analytics must not break search

    def _record_access_and_citations(self, results: list) -> None:
        """Increment access_count and auto-cite entries from search results."""
        try:
            if not results:
                return
            conn = self._engine._conn
            for r in results:
                entry_id = r["entry"]["id"]
                conn.execute(
                    "UPDATE knowledge_entries SET access_count = access_count + 1, "
                    "last_accessed_at = datetime('now') WHERE id = ?",
                    (entry_id,),
                )
                conn.execute(
                    "INSERT OR IGNORE INTO citations (entry_id, cited_by, context) "
                    "VALUES (?, 'mem_search', 'auto-cited from search results')",
                    (entry_id,),
                )
            conn.commit()
        except Exception:
            pass  # must not break search

    def _handle_ingest(self, args: dict[str, Any]) -> str:
        content = args.get("content", "")
        if not content:
            return "Error: content required"
        type_ = args.get("type", "CONTEXT")
        source = args.get("source")
        tags = args.get("tags", "")
        summary = args.get("summary") or content[:120]

        entry_id = self._pipeline.ingest_entry(content, summary, type_, source, tags)
        self._engine.audit.log("INGEST", entry_id=entry_id, session_id=self._engine.session_id)
        self._auto_own_entry(entry_id, source)
        self._auto_score_entry(entry_id, content, tags)
        return f"Knowledge entry created: id={entry_id}, type={type_}, tier=WORKING"

    def _auto_own_entry(self, entry_id: int, source: str | None) -> None:
        """Auto-set owner based on source field."""
        try:
            owner = self._infer_owner(source)
            if owner:
                self._engine._conn.execute(
                    "UPDATE knowledge_entries SET owner = ? WHERE id = ? AND (owner IS NULL OR owner = '')",
                    (owner, entry_id),
                )
                self._engine._conn.commit()
        except Exception:
            pass

    def _infer_owner(self, source: str | None) -> str:
        """Infer owner from source field."""
        if not source:
            return "system"
        s = source.lower()
        if any(k in s for k in ("ba", "brd", "fsd")):
            return "ba-agent"
        if any(k in s for k in ("sa", "tdd", "architect")):
            return "sa-agent"
        if any(k in s for k in ("qa", "stp", "stc", "test")):
            return "qa-agent"
        if any(k in s for k in ("dev", "implement", "code")):
            return "dev-agent"
        if any(k in s for k in ("devops", "deploy", "release")):
            return "devops-agent"
        if any(k in s for k in ("security", "audit")):
            return "security-agent"
        if any(k in s for k in ("ui", "design", "wireframe")):
            return "ui-agent"
        if any(k in s for k in ("sm", "scrum")):
            return "sm-agent"
        if any(k in s for k in ("ta", "technical")):
            return "ta-agent"
        if any(k in s for k in ("chat", "user")):
            return "user"
        if any(k in s for k in ("hook", "tool-call")):
            return "system"
        return "system"

    def _auto_score_entry(self, entry_id: int, content: str, tags: str) -> None:
        """Auto-compute quality score for newly ingested entry."""
        try:
            conn = self._engine._conn
            len_score = 30 if len(content) > 500 else (20 if len(content) > 200 else (10 if len(content) > 50 else 5))
            tag_score = 20 if tags else 0
            struct_score = 20 if ("\n" in content and ("#" in content or "-" in content)) else 10
            total = min(len_score + tag_score + struct_score + 10, 100)
            conn.execute(
                "INSERT OR REPLACE INTO quality_scores (entry_id, total_score, dimensions, scored_at) VALUES (?, ?, '{}', datetime('now'))",
                (entry_id, total),
            )
            conn.commit()
        except Exception:
            pass  # must not break ingest

    def _handle_ingest_file(self, args: dict[str, Any]) -> str:
        file_path = args.get("file_path", "")
        if not file_path:
            return "Error: file_path is required"
        type_ = args.get("type", "CONTEXT")
        fmt = args.get("format", "markdown")

        resolved = self._resolve_path(file_path)
        if not os.path.exists(resolved):
            return f"Error: file not found — {resolved}"

        with open(resolved, "r", encoding="utf-8") as f:
            text = f.read()

        if fmt == "markdown":
            result = self._pipeline.ingest_markdown(text, file_path, type_)
        else:
            result = self._pipeline.ingest_text(text, file_path, type_)

        self._engine.audit.log("INGEST_FILE", session_id=self._engine.session_id)
        return f"Ingested: {result['entries_created']} entries from {file_path}"

    def _handle_get(self, args: dict[str, Any]) -> str:
        entry_id = args.get("id")
        if not entry_id:
            return "Error: id required"
        entry = self._engine.knowledge.find_by_id(int(entry_id))
        if not entry:
            return f"Entry not found: {entry_id}"
        self._engine.knowledge.record_access(int(entry_id))
        self._engine.audit.log("ACCESS", entry_id=int(entry_id), session_id=self._engine.session_id)
        lines = [
            f"Knowledge Entry #{entry['id']}:",
            f"  Summary: {entry['summary']}",
            f"  Type: {entry['type']}",
            f"  Tier: {entry['tier']}",
            f"  Confidence: {entry['confidence']}",
            f"  Access count: {entry['access_count'] + 1}",
            f"  Source: {entry.get('source') or 'n/a'}",
            f"  Tags: {entry['tags']}",
            f"  Created: {entry['created_at']}",
            "  Content:",
            entry["content"],
        ]
        return "\n".join(lines)

    def _handle_delete(self, args: dict[str, Any]) -> str:
        entry_id = args.get("id")
        if not entry_id:
            return "Error: id required"
        existing = self._engine.knowledge.find_by_id(int(entry_id))
        if not existing:
            return f"Entry not found: {entry_id}"
        self._engine.knowledge.delete(int(entry_id))
        self._engine.audit.log("DELETE", entry_id=int(entry_id), session_id=self._engine.session_id)
        return f"Deleted entry #{entry_id}: {existing['summary'][:80]}"

    def _handle_list(self, args: dict[str, Any]) -> str:
        tier = args.get("tier")
        type_ = args.get("type")
        limit = args.get("limit", 20)

        if tier:
            entries = self._engine.knowledge.find_by_tier(tier, limit)
        elif type_:
            entries = self._engine.knowledge.find_by_type(type_, limit)
        else:
            entries = self._engine.knowledge.find_by_tier("WORKING", limit)

        if not entries:
            return "No entries found"
        lines = [f"{len(entries)} entries:\n"]
        for e in entries:
            lines.append(f"#{e['id']} [{e['type']}] {e['summary'][:80]}")
            lines.append(f"   Tier: {e['tier']} | Confidence: {e['confidence']} | Access: {e['access_count']}")
        return "\n".join(lines)

    def _handle_graph(self, args: dict[str, Any]) -> str:
        action = args.get("action", "neighbors")
        if action == "neighbors":
            return self._graph_neighbors(args)
        if action == "add_edge":
            return self._graph_add_edge(args)
        if action == "path":
            return self._graph_path(args)
        if action == "ego":
            return self._graph_ego(args)
        return f"Unknown action: {action}"

    def _graph_neighbors(self, args: dict[str, Any]) -> str:
        node_id = args.get("node_id")
        if not node_id:
            return "Error: node_id required"
        neighbors = self._engine.graph.get_connected(int(node_id))
        if not neighbors:
            return f"Node {node_id} has no connections"
        lines = [f"Node {node_id} connections ({len(neighbors)}):\n"]
        for nid in list(neighbors)[:20]:
            entry = self._engine.knowledge.find_by_id(nid)
            lines.append(f"  → [{nid}] {entry['summary'] if entry else 'unknown'}")
        return "\n".join(lines)

    def _graph_add_edge(self, args: dict[str, Any]) -> str:
        source_id = args.get("source_id")
        target_id = args.get("target_id")
        if not source_id or not target_id:
            return "Error: source_id and target_id required"
        relation = args.get("relation", "RELATES_TO")
        eid = self._engine.graph.add_edge(int(source_id), int(target_id), relation)
        return f"Edge created: {source_id} --[{relation}]--> {target_id} (id={eid})"

    def _graph_path(self, args: dict[str, Any]) -> str:
        from_id = args.get("from_id")
        to_id = args.get("to_id")
        if not from_id or not to_id:
            return "Error: from_id and to_id required"
        path = self._engine.graph.shortest_path(int(from_id), int(to_id))
        if not path:
            return f"No path found between {from_id} and {to_id}"
        return f"Path: {' → '.join(str(n) for n in path)}"

    def _graph_ego(self, args: dict[str, Any]) -> str:
        node_id = args.get("node_id")
        if not node_id:
            return "Error: node_id required"
        radius = args.get("radius", 2)
        nodes = self._engine.graph.ego_graph(int(node_id), radius)
        return f"Ego graph for {node_id} (radius={radius}): {len(nodes)} nodes\n{', '.join(str(n) for n in nodes)}"

    def _handle_status(self, args: dict[str, Any]) -> str:
        stats = self._engine.get_stats()
        lines = [
            "Memory Engine Status:",
            f"  Total entries: {stats['total_entries']}",
            f"  Total edges: {stats['total_edges']}",
            f"  Total vectors: {stats['total_vectors']}",
            "",
            "Tier Breakdown:",
        ]
        for ts in stats["tier_breakdown"]:
            lines.append(
                f"  {ts['tier']}: {ts['entry_count']} entries "
                f"(avg confidence: {ts['avg_confidence']:.2f}, "
                f"avg access: {ts['avg_access_count']:.1f})"
            )
        if not stats["tier_breakdown"]:
            lines.append("  (empty)")
        return "\n".join(lines)

    def _handle_consolidate(self, args: dict[str, Any]) -> str:
        result = self._consolidator.consolidate()
        self._engine.audit.log("CONSOLIDATE", session_id=self._engine.session_id)
        return "\n".join([
            "Consolidation complete:",
            f"  Promoted: {result['promoted']}",
            f"  Demoted: {result['demoted']}",
            f"  Expired: {result['expired']}",
        ])

    def _handle_audit(self, args: dict[str, Any]) -> str:
        limit = args.get("limit", 20)
        operation = args.get("operation")
        entries = self._engine.audit.list_recent(limit, operation)
        if not entries:
            return "No audit entries found."
        lines = [f"Recent audit entries ({len(entries)}):\n"]
        for e in entries:
            lines.append(f"[{e['operation']}] {e['created_at']}")
            lines.append(f"  Entry: {e.get('entry_id') or 'n/a'} | Session: {e.get('session_id') or 'n/a'}")
            if e.get("details"):
                lines.append(f"  Details: {e['details'][:120]}")
            lines.append("")
        return "\n".join(lines)

    def _handle_sessions(self, args: dict[str, Any]) -> str:
        limit = args.get("limit", 20)
        sessions = self._engine.sessions.list_recent(limit)
        if not sessions:
            return "No sessions found."
        active = self._engine.sessions.active_count()
        lines = [f"Sessions (active: {active}, showing {len(sessions)}):\n"]
        for s in sessions:
            duration = f"ended {s['ended_at']}" if s.get("ended_at") else "active"
            lines.append(f"[{s['session_id']}] {s['status']} | Agent: {s.get('agent_name') or 'unknown'}")
            lines.append(f"  Started: {s['started_at']} | {duration} | Observations: {s['observation_count']}")
            lines.append("")
        return "\n".join(lines)

    def _handle_sync_code(self, args: dict[str, Any]) -> str:
        if not self._sync_code:
            return '{"error": "mem_sync_code requires query_layer (code indexer not available)"}'
        return self._sync_code.execute(args)

    def _resolve_path(self, file_path: str) -> str:
        """Resolve file path relative to workspace."""
        if os.path.isabs(file_path) and os.path.exists(file_path):
            return file_path
        if self._workspace:
            ws_path = os.path.join(self._workspace, file_path)
            if os.path.exists(ws_path):
                return ws_path
        return os.path.abspath(file_path)

"""KSA-93: UX enhancement API routes — recommendations, graph analysis, help."""

import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs

from ..memory.engine_v2 import MemoryEngineV2
from .response_helpers import send_json, send_error, first_param


# Help content sections (static, extracted from user guide)
HELP_SECTIONS = {
    "graph": {
        "title": "Knowledge Graph 3D",
        "content": "## Đây là gì?\n\nTrang chủ hiển thị **Knowledge Graph 3D** — "
        "trực quan hóa tất cả entries và relationships trong KB.\n\n"
        "## Cách sử dụng\n\n"
        "- **Xoay**: Kéo chuột trái\n"
        "- **Zoom**: Scroll wheel\n"
        "- **Click node**: Xem chi tiết entry\n"
        "- **Search**: Gõ từ khóa + Enter\n"
        "- **Jump to cluster**: Chọn từ dropdown",
    },
    "sessions": {
        "title": "Sessions",
        "content": "## Sessions là gì?\n\n"
        "Mỗi session = 1 phiên làm việc của agent. "
        "Ghi lại tất cả thao tác: ingest, search, delete.\n\n"
        "## Replay\n\n"
        "Click session → xem timeline → Play để replay từng event.",
    },
    "browser": {
        "title": "Entry Browser",
        "content": "## Duyệt Entries\n\n"
        "Xem tất cả entries trong KB. Lọc theo:\n"
        "- **Tier**: WORKING, EPISODIC, SEMANTIC, PROCEDURAL\n"
        "- **Type**: DECISION, ARCHITECTURE, REQUIREMENT...\n"
        "- **Sort**: Newest, Most accessed, Confidence",
    },
    "stream": {
        "title": "Live Stream",
        "content": "## Real-time Events\n\n"
        "Hiển thị events khi chúng xảy ra. "
        "Indicator xanh = đang kết nối.\n\n"
        "## Controls\n\n"
        "- **Pause**: Tạm dừng stream\n"
        "- **Sort**: Đổi thứ tự (newest/oldest first)\n"
        "- **Clear**: Xóa events hiện tại",
    },
    "dashboard": {
        "title": "Health Dashboard",
        "content": "## Tổng quan KB\n\n"
        "Dashboard hiển thị metrics sức khỏe:\n"
        "- Tổng entries, edges, vectors\n"
        "- Quality score distribution\n"
        "- Stale entries cần review\n"
        "- Recommendations",
    },
    "tags": {
        "title": "Tag Management",
        "content": "## Tags\n\n"
        "Quản lý taxonomy tags cho entries.\n"
        "- Popular tags (sử dụng nhiều nhất)\n"
        "- Tag categories\n"
        "- Click tag để xem entries liên quan",
    },
    "quality": {
        "title": "Quality Scores",
        "content": "## Quality Scoring\n\n"
        "Mỗi entry có quality score 0-100:\n"
        "- Content length & structure\n"
        "- Tags assigned\n"
        "- Relationships count\n"
        "- Confidence level\n\n"
        "Score < 40 = cần cải thiện.",
    },
    "analytics": {
        "title": "Search Analytics",
        "content": "## Analytics\n\n"
        "Phân tích search patterns:\n"
        "- Popular queries\n"
        "- Zero-result searches (content gaps)\n"
        "- Usage trends over time",
    },
}


def handle_ux_route(
    path: str, query: dict[str, list[str]],
    handler: BaseHTTPRequestHandler,
    engine: MemoryEngineV2 | None,
    method: str = "GET",
) -> bool:
    """Handle UX enhancement routes. Returns True if handled."""
    api_path = path.replace("/api/kb", "")

    if method == "GET":
        if api_path == "/dashboard":
            _handle_dashboard(handler, engine)
            return True
        if api_path == "/reminders":
            _handle_reminders(query, handler, engine)
            return True
        if api_path == "/recommendations":
            _handle_recommendations(query, handler, engine)
            return True
        if api_path == "/graph/analysis":
            _handle_graph_analysis(handler, engine)
            return True
        if api_path == "/tags/popular":
            _handle_tags_popular(query, handler, engine)
            return True
        if api_path == "/tags":
            _handle_tags_taxonomy(handler, engine)
            return True
        if api_path == "/analytics":
            _handle_analytics(handler, engine)
            return True
        if api_path == "/quality":
            _handle_quality(handler, engine)
            return True
        if api_path == "/quality/low":
            _handle_quality_low(query, handler, engine)
            return True
        if api_path == "/citations/most":
            _handle_citations_most(query, handler, engine)
            return True
        if api_path == "/suggestions":
            _handle_suggestions(query, handler, engine)
            return True
        match = re.match(r"^/help/(\w+)$", api_path)
        if match:
            _handle_help(match.group(1), handler)
            return True

    if method == "POST":
        match = re.match(r"^/entries/(\d+)/auto-tag$", api_path)
        if match:
            _handle_auto_tag(int(match.group(1)), handler, engine)
            return True
        match = re.match(r"^/entries/(\d+)/find-related$", api_path)
        if match:
            _handle_find_related(int(match.group(1)), handler, engine)
            return True
        match = re.match(r"^/entries/(\d+)/review$", api_path)
        if match:
            _handle_mark_reviewed(int(match.group(1)), handler, engine)
            return True

    return False


def _handle_recommendations(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """GET /api/kb/recommendations."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    from .recommendation_engine import RecommendationEngine
    limit = int(first_param(query, "limit", "10"))
    rec_engine = RecommendationEngine(engine._conn)
    send_json(handler, rec_engine.get_recommendations(limit))


def _handle_graph_analysis(
    handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """GET /api/kb/graph/analysis."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    from .graph_analyzer import GraphAnalyzer
    analyzer = GraphAnalyzer(engine._conn)
    send_json(handler, analyzer.analyze())


def _handle_help(section: str, handler: BaseHTTPRequestHandler) -> None:
    """GET /api/kb/help/{section}."""
    content = HELP_SECTIONS.get(section)
    if not content:
        send_error(handler, 404, f"Section '{section}' not found")
        return
    send_json(handler, content)


def _handle_auto_tag(
    entry_id: int, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """POST /api/kb/entries/{id}/auto-tag — placeholder."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    send_json(handler, {"status": "ok", "entry_id": entry_id, "tags_added": []})


def _handle_find_related(
    entry_id: int, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """POST /api/kb/entries/{id}/find-related — placeholder."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    send_json(handler, {"status": "ok", "entry_id": entry_id, "related": []})


def _handle_mark_reviewed(
    entry_id: int, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """POST /api/kb/entries/{id}/review — mark entry as reviewed."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    try:
        engine._conn.execute(
            "UPDATE knowledge_entries SET updated_at = datetime('now') WHERE id = ?",
            (entry_id,)
        )
        engine._conn.commit()
        send_json(handler, {"status": "ok", "entry_id": entry_id})
    except Exception as e:
        send_error(handler, 500, str(e))


def _handle_dashboard(
    handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """GET /api/kb/dashboard — health metrics."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    try:
        conn = engine._conn
        total_entries = conn.execute("SELECT COUNT(*) FROM knowledge_entries").fetchone()[0]
        quality_avg = conn.execute("SELECT AVG(confidence) FROM knowledge_entries").fetchone()[0] or 0
        stale_count = conn.execute(
            "SELECT COUNT(*) FROM knowledge_entries WHERE updated_at < datetime('now', '-90 days')"
        ).fetchone()[0]
        unowned_count = conn.execute(
            "SELECT COUNT(*) FROM knowledge_entries WHERE source IS NULL OR source = ''"
        ).fetchone()[0]

        quality_score = min(quality_avg, 100)
        stale_ratio = (1 - stale_count / total_entries) * 100 if total_entries > 0 else 0
        owned_ratio = (1 - unowned_count / total_entries) * 100 if total_entries > 0 else 0
        health_score = 0 if total_entries == 0 else round(
            quality_score * 0.4 + stale_ratio * 0.3 + owned_ratio * 0.3
        )

        from .recommendation_engine import RecommendationEngine
        rec_engine = RecommendationEngine(conn)
        recommendations = rec_engine.get_recommendations(5)

        search_volume = []
        ingest_volume = []
        try:
            rows = conn.execute(
                "SELECT DATE(searched_at) as date, COUNT(*) as count FROM search_log "
                "WHERE searched_at >= datetime('now', '-7 days') GROUP BY DATE(searched_at) ORDER BY date"
            ).fetchall()
            search_volume = [{"date": r[0], "count": r[1]} for r in rows]

            rows = conn.execute(
                "SELECT DATE(created_at) as date, COUNT(*) as count FROM memory_audit "
                "WHERE operation = 'INGEST' AND created_at >= datetime('now', '-7 days') "
                "GROUP BY DATE(created_at) ORDER BY date"
            ).fetchall()
            ingest_volume = [{"date": r[0], "count": r[1]} for r in rows]
        except Exception:
            pass

        send_json(handler, {
            "health_score": health_score,
            "total_entries": total_entries,
            "quality_avg": quality_score,
            "stale_count": stale_count,
            "unowned_count": unowned_count,
            "recommendations": recommendations,
            "trends": {"search_volume": search_volume, "ingest_volume": ingest_volume},
        })
    except Exception as e:
        send_error(handler, 500, str(e))


def _handle_reminders(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """GET /api/kb/reminders — entries needing review."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    try:
        limit = int(first_param(query, "limit", "10"))
        rows = engine._conn.execute(
            """SELECT id, summary, updated_at,
                CAST(julianday('now') - julianday(updated_at) AS INTEGER) as days_overdue
               FROM knowledge_entries
               WHERE updated_at < datetime('now', '-90 days')
               ORDER BY updated_at ASC LIMIT ?""",
            (limit,)
        ).fetchall()
        entries = [{"id": r[0], "summary": r[1], "last_reviewed": r[2], "days_overdue": r[3]} for r in rows]
        send_json(handler, entries)
    except Exception as e:
        send_error(handler, 500, str(e))


def _handle_tags_popular(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """GET /api/kb/tags/popular — popular tags by usage count."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    try:
        limit = int(first_param(query, "limit", "30"))
        rows = engine._conn.execute(
            "SELECT tags FROM knowledge_entries WHERE tags IS NOT NULL AND tags != ''"
        ).fetchall()

        tag_counts: dict[str, int] = {}
        for row in rows:
            tags = [t.strip() for t in row[0].split(",") if t.strip()]
            for tag in tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

        sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
        send_json(handler, [{"tag": t, "usage_count": c} for t, c in sorted_tags])
    except Exception as e:
        send_error(handler, 500, str(e))


def _handle_tags_taxonomy(
    handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """GET /api/kb/tags — tag taxonomy."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    try:
        conn = engine._conn
        table_exists = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='tag_taxonomy'"
        ).fetchone()

        if table_exists:
            rows = conn.execute(
                "SELECT id, tag, category, parent_tag FROM tag_taxonomy ORDER BY category, tag"
            ).fetchall()
            categories: dict[str, list[str]] = {}
            for row in rows:
                cat = row[2] or "uncategorized"
                categories.setdefault(cat, []).append(row[1])
            send_json(handler, {"categories": categories})
        else:
            rows = conn.execute(
                "SELECT tags FROM knowledge_entries WHERE tags IS NOT NULL AND tags != ''"
            ).fetchall()
            tag_counts: dict[str, int] = {}
            for row in rows:
                tags = [t.strip() for t in row[0].split(",") if t.strip()]
                for tag in tags:
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1
            categories = {}
            for tag in sorted(tag_counts.keys()):
                cat = tag.split(":")[0] if ":" in tag else "general"
                categories.setdefault(cat, []).append(tag)
            send_json(handler, {"categories": categories})
    except Exception as e:
        send_error(handler, 500, str(e))


def _handle_analytics(
    handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """GET /api/kb/analytics — search analytics."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    try:
        conn = engine._conn
        popular_queries = []
        zero_results = []
        search_trend = []

        search_log_exists = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='search_log'"
        ).fetchone()

        if search_log_exists:
            rows = conn.execute(
                "SELECT query, COUNT(*) as count, AVG(result_count) as avg_results "
                "FROM search_log GROUP BY query ORDER BY count DESC LIMIT 15"
            ).fetchall()
            popular_queries = [{"query": r[0], "count": r[1], "avg_results": round(r[2] or 0)} for r in rows]

            rows = conn.execute(
                "SELECT query, COUNT(*) as count FROM search_log "
                "WHERE result_count = 0 GROUP BY query ORDER BY count DESC LIMIT 15"
            ).fetchall()
            zero_results = [{"query": r[0], "count": r[1]} for r in rows]

            rows = conn.execute(
                "SELECT DATE(searched_at) as date, COUNT(*) as count FROM search_log "
                "WHERE searched_at >= datetime('now', '-30 days') "
                "GROUP BY DATE(searched_at) ORDER BY date"
            ).fetchall()
            search_trend = [{"date": r[0], "count": r[1]} for r in rows]

        send_json(handler, {"popular_queries": popular_queries, "zero_results": zero_results, "search_trend": search_trend})
    except Exception as e:
        send_error(handler, 500, str(e))


def _handle_quality(
    handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """GET /api/kb/quality — quality overview."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    try:
        conn = engine._conn
        total_entries = conn.execute("SELECT COUNT(*) FROM knowledge_entries").fetchone()[0]

        qs_table = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='quality_scores'"
        ).fetchone()

        avg_score = 0.0
        scored_count = 0
        high_count = 0
        low_count = 0
        distribution: dict[str, int] = {}

        if qs_table:
            avg_score = conn.execute("SELECT AVG(total_score) FROM quality_scores").fetchone()[0] or 0
            scored_count = conn.execute("SELECT COUNT(*) FROM quality_scores").fetchone()[0]
            high_count = conn.execute("SELECT COUNT(*) FROM quality_scores WHERE total_score >= 70").fetchone()[0]
            low_count = conn.execute("SELECT COUNT(*) FROM quality_scores WHERE total_score < 40").fetchone()[0]
            rows = conn.execute(
                "SELECT CAST(total_score / 10 AS INTEGER) * 10 as bucket, COUNT(*) as cnt "
                "FROM quality_scores GROUP BY bucket ORDER BY bucket"
            ).fetchall()
            distribution = {str(r[0]): r[1] for r in rows}
        else:
            rows = conn.execute(
                "SELECT id, tags, source, content, confidence FROM knowledge_entries"
            ).fetchall()
            scores = []
            for row in rows:
                score = 0
                if row[1] and row[1].strip():
                    score += 20
                if row[2] and row[2].strip():
                    score += 20
                content_len = len(row[3] or "")
                score += min(30, (content_len // 50) * 5)
                score += min(30, int((row[4] or 0) * 30))
                scores.append(score)
            scored_count = len(scores)
            avg_score = sum(scores) / len(scores) if scores else 0
            high_count = sum(1 for s in scores if s >= 70)
            low_count = sum(1 for s in scores if s < 40)
            for s in scores:
                bucket = str((s // 10) * 10)
                distribution[bucket] = distribution.get(bucket, 0) + 1

        send_json(handler, {
            "average_score": avg_score,
            "scored_count": scored_count,
            "high_count": high_count,
            "low_count": low_count,
            "total_entries": total_entries,
            "distribution": distribution,
        })
    except Exception as e:
        send_error(handler, 500, str(e))


def _handle_quality_low(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """GET /api/kb/quality/low — low quality entries."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    try:
        conn = engine._conn
        threshold = int(first_param(query, "threshold", "40"))
        limit = int(first_param(query, "limit", "20"))

        qs_table = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='quality_scores'"
        ).fetchone()

        if qs_table:
            rows = conn.execute(
                "SELECT q.entry_id, q.total_score, e.summary, e.type "
                "FROM quality_scores q JOIN knowledge_entries e ON q.entry_id = e.id "
                "WHERE q.total_score < ? ORDER BY q.total_score ASC LIMIT ?",
                (threshold, limit)
            ).fetchall()
            send_json(handler, [{"id": r[0], "summary": r[2], "type": r[3], "quality_score": r[1]} for r in rows])
        else:
            rows = conn.execute(
                "SELECT id, summary, type, tags, source, content, confidence FROM knowledge_entries LIMIT 500"
            ).fetchall()
            scored = []
            for row in rows:
                score = 0
                if row[3] and row[3].strip():
                    score += 20
                if row[4] and row[4].strip():
                    score += 20
                score += min(30, (len(row[5] or "") // 50) * 5)
                score += min(30, int((row[6] or 0) * 30))
                if score < threshold:
                    scored.append({"id": row[0], "summary": row[1], "type": row[2], "quality_score": score})
            scored.sort(key=lambda x: x["quality_score"])
            send_json(handler, scored[:limit])
    except Exception as e:
        send_error(handler, 500, str(e))


def _handle_citations_most(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """GET /api/kb/citations/most — most cited entries."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    try:
        conn = engine._conn
        limit = int(first_param(query, "limit", "10"))

        cit_table = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='citations'"
        ).fetchone()

        if cit_table:
            rows = conn.execute(
                "SELECT c.entry_id, COUNT(*) as citation_count, e.summary "
                "FROM citations c JOIN knowledge_entries e ON c.entry_id = e.id "
                "GROUP BY c.entry_id ORDER BY citation_count DESC LIMIT ?",
                (limit,)
            ).fetchall()
            send_json(handler, [{"id": r[0], "summary": r[2], "citation_count": r[1]} for r in rows])
        else:
            rows = conn.execute(
                "SELECT id, summary, access_count FROM knowledge_entries "
                "WHERE access_count > 0 ORDER BY access_count DESC LIMIT ?",
                (limit,)
            ).fetchall()
            send_json(handler, [{"id": r[0], "summary": r[1], "citation_count": r[2]} for r in rows])
    except Exception as e:
        send_error(handler, 500, str(e))


def _handle_suggestions(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2 | None
) -> None:
    """GET /api/kb/suggestions — autocomplete suggestions."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return
    try:
        q = first_param(query, "q", "")
        limit = int(first_param(query, "limit", "8"))
        if not q:
            send_json(handler, [])
            return
        rows = engine._conn.execute(
            "SELECT id, summary, type FROM knowledge_entries WHERE summary LIKE ? LIMIT ?",
            (f"%{q}%", limit)
        ).fetchall()
        send_json(handler, [{"id": r[0], "summary": r[1], "type": r[2]} for r in rows])
    except Exception as e:
        send_error(handler, 500, str(e))

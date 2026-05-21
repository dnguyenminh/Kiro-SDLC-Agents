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
        if api_path == "/recommendations":
            _handle_recommendations(query, handler, engine)
            return True
        if api_path == "/graph/analysis":
            _handle_graph_analysis(handler, engine)
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
            "UPDATE entries SET updated_at = datetime('now') WHERE id = ?",
            (entry_id,)
        )
        engine._conn.commit()
        send_json(handler, {"status": "ok", "entry_id": entry_id})
    except Exception as e:
        send_error(handler, 500, str(e))

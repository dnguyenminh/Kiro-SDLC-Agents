"""KSA-82: Enhanced KB Viewer API routes — tags, quality, dashboard, feedback."""

import re
from http.server import BaseHTTPRequestHandler

from ..memory.engine_v2 import MemoryEngineV2
from .response_helpers import send_json, send_error, first_param


def handle_kb_viewer_route(
    path: str, query: dict[str, list[str]],
    handler: BaseHTTPRequestHandler,
    engine: MemoryEngineV2 | None,
) -> bool:
    """Handle KB viewer routes. Returns True if handled."""
    if not engine:
        send_error(handler, 503, "Engine not initialized")
        return True

    api_path = path.replace("/api/kb", "")
    routes = {
        "/dashboard": _handle_dashboard,
        "/tags": _handle_tags,
        "/tags/popular": _handle_popular_tags,
        "/quality": _handle_quality,
        "/quality/low": _handle_low_quality,
        "/confidence": _handle_confidence,
        "/feedback": _handle_feedback,
        "/suggestions": _handle_suggestions,
        "/analytics": _handle_analytics,
        "/reminders": _handle_reminders,
        "/citations/most": _handle_most_cited,
        "/health": _handle_health,
    }

    route_handler = routes.get(api_path)
    if route_handler:
        route_handler(query, handler, engine)
        return True

    if re.match(r"^/entries/\d+/related$", api_path):
        _handle_related(api_path, query, handler, engine)
        return True
    if re.match(r"^/entries/\d+/tags$", api_path):
        _handle_entry_tags(api_path, handler, engine)
        return True
    if re.match(r"^/entries/\d+/citations$", api_path):
        _handle_entry_citations(api_path, handler, engine)
        return True
    if re.match(r"^/entries/\d+/feedback$", api_path):
        _handle_entry_feedback(api_path, handler, engine)
        return True

    return False


def _handle_dashboard(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/dashboard — full health dashboard."""
    try:
        from ..memory.health_dashboard import HealthDashboard
        dashboard = HealthDashboard(engine._conn)
        send_json(handler, dashboard.get_dashboard())
    except Exception as e:
        import sys
        print(f"[kb_viewer] Dashboard error: {e}", file=sys.stderr, flush=True)
        send_error(handler, 500, f"Dashboard error: {e}")


def _handle_tags(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/tags?category=X — tag taxonomy."""
    category = first_param(query, "category", "")
    result = engine.tag_taxonomy.get_taxonomy(category or None)
    send_json(handler, result)


def _handle_popular_tags(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/tags/popular?limit=20."""
    limit = int(first_param(query, "limit", "20"))
    result = engine.tag_taxonomy.get_popular_tags(limit)
    send_json(handler, result)


def _handle_quality(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/quality — quality stats."""
    from ..memory.quality_scoring import QualityScorer
    scorer = QualityScorer(engine._conn)
    send_json(handler, scorer.get_quality_stats())


def _handle_low_quality(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/quality/low?threshold=40."""
    from ..memory.quality_scoring import QualityScorer
    scorer = QualityScorer(engine._conn)
    threshold = int(first_param(query, "threshold", "40"))
    limit = int(first_param(query, "limit", "20"))
    send_json(handler, scorer.get_low_quality(threshold, limit))


def _handle_confidence(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/confidence — confidence stats."""
    from ..memory.confidence_scoring import ConfidenceScorer
    scorer = ConfidenceScorer(engine._conn)
    send_json(handler, scorer.get_confidence_stats())


def _handle_feedback(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/feedback — top/low rated entries."""
    action = first_param(query, "action", "top_rated")
    limit = int(first_param(query, "limit", "10"))
    if action == "low_rated":
        send_json(handler, engine.feedback.get_low_rated(limit))
    else:
        send_json(handler, engine.feedback.get_top_rated(limit))


def _handle_suggestions(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/suggestions?q=X."""
    q = first_param(query, "q", "")
    limit = int(first_param(query, "limit", "5"))
    send_json(handler, engine.suggestions.suggest(q, limit))


def _handle_analytics(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/analytics — search analytics."""
    send_json(handler, engine.search_analytics.get_analytics())


def _handle_reminders(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/reminders — due review reminders."""
    from ..memory.review_reminders import ReviewReminderEngine
    reminders = ReviewReminderEngine(engine._conn)
    send_json(handler, reminders.get_due_reminders())


def _handle_health(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/health — health metrics only."""
    from ..memory.health_dashboard import HealthDashboard
    dashboard = HealthDashboard(engine._conn)
    send_json(handler, dashboard.get_metrics())


def _handle_most_cited(
    query: dict, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/citations/most?limit=10."""
    limit = int(first_param(query, "limit", "10"))
    result = engine.citation_tracker.get_most_cited(limit)
    send_json(handler, result)


def _handle_related(
    api_path: str, query: dict, handler: BaseHTTPRequestHandler,
    engine: MemoryEngineV2
) -> None:
    """GET /api/kb/entries/<id>/related."""
    entry_id = int(api_path.split("/")[2])
    limit = int(first_param(query, "limit", "5"))
    send_json(handler, engine.suggestions.get_related(entry_id, limit))


def _handle_entry_tags(
    api_path: str, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/entries/<id>/tags."""
    entry_id = int(api_path.split("/")[2])
    send_json(handler, engine.tag_taxonomy.get_entry_tags(entry_id))


def _handle_entry_citations(
    api_path: str, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/entries/<id>/citations."""
    entry_id = int(api_path.split("/")[2])
    send_json(handler, engine.citation_tracker.get_citations(entry_id))


def _handle_entry_feedback(
    api_path: str, handler: BaseHTTPRequestHandler, engine: MemoryEngineV2
) -> None:
    """GET /api/kb/entries/<id>/feedback."""
    entry_id = int(api_path.split("/")[2])
    send_json(handler, engine.feedback.get_feedback_summary(entry_id))

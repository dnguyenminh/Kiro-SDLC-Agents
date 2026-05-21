"""Consolidated dispatcher handlers — merged tool logic for KSA-85."""

from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from .dispatcher_consolidated import MemoryToolDispatcherConsolidated


def handle_crud(disp: "MemoryToolDispatcherConsolidated", args: dict[str, Any]) -> str:
    """Route mem_crud actions to V1 get/delete/list handlers."""
    action = args.get("action", "list")
    if action == "get":
        return disp._v1._handle_get(args)
    if action == "delete":
        return disp._v1._handle_delete(args)
    return disp._v1._handle_list(args)


def handle_consolidate(
    disp: "MemoryToolDispatcherConsolidated", args: dict[str, Any]
) -> str:
    """Route to V2 consolidation engine (replaces both V1 and V2)."""
    return disp._v2._handle_consolidate_v2(args)


def handle_lifecycle(
    disp: "MemoryToolDispatcherConsolidated", args: dict[str, Any]
) -> str:
    """Route lifecycle actions to V2 stale/review/reminders handlers."""
    action = args.get("action", "detect_stale")
    return _LIFECYCLE_ROUTES[action](disp, args)


def _lifecycle_stale(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    """Detect stale entries."""
    args.setdefault("action", "detect")
    return disp._v2._handle_stale(args)


def _lifecycle_archive(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    """Archive stale entries."""
    args["action"] = "archive"
    return disp._v2._handle_stale(args)


def _lifecycle_unarchive(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    """Unarchive an entry."""
    args["action"] = "unarchive"
    return disp._v2._handle_stale(args)


def _lifecycle_due(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    """List entries due for review."""
    return disp._v2._handle_due_reviews(args)


def _lifecycle_reviewed(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    """Mark entry as reviewed."""
    args.setdefault("action", "mark_reviewed")
    return disp._v2._handle_review(args)


def _lifecycle_schedule(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    """Schedule a review reminder."""
    args["action"] = "schedule"
    return disp._v2._handle_reminders(args)


def _lifecycle_snooze(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    """Snooze a reminder."""
    args["action"] = "snooze"
    return disp._v2._handle_reminders(args)


def _lifecycle_complete(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    """Complete a review."""
    args["action"] = "complete"
    return disp._v2._handle_reminders(args)


_LIFECYCLE_ROUTES = {
    "detect_stale": _lifecycle_stale,
    "archive": _lifecycle_archive,
    "unarchive": _lifecycle_unarchive,
    "due_reviews": _lifecycle_due,
    "mark_reviewed": _lifecycle_reviewed,
    "schedule": _lifecycle_schedule,
    "snooze": _lifecycle_snooze,
    "complete": _lifecycle_complete,
}


def handle_discover(
    disp: "MemoryToolDispatcherConsolidated", args: dict[str, Any]
) -> str:
    """Route discover actions to V2 suggest/related handlers."""
    action = args.get("action", "suggest")
    if action == "related":
        return disp._v2._handle_related(args)
    return disp._v2._handle_suggest(args)


def handle_citations(
    disp: "MemoryToolDispatcherConsolidated", args: dict[str, Any]
) -> str:
    """Route citation actions — record delegates to cite, rest to citations."""
    action = args.get("action", "most_cited")
    if action == "record":
        return disp._v2._handle_cite(args)
    return disp._v2._handle_citations(args)


def handle_scoring(
    disp: "MemoryToolDispatcherConsolidated", args: dict[str, Any]
) -> str:
    """Route scoring actions to quality/confidence/feedback handlers."""
    action = args.get("action", "quality_stats")
    return _SCORING_ROUTES.get(action, _scoring_quality_stats)(disp, args)


def _scoring_quality(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "score"
    return disp._v2._handle_quality(args)


def _scoring_quality_stats(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "stats"
    return disp._v2._handle_quality(args)


def _scoring_low_quality(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "low_quality"
    return disp._v2._handle_quality(args)


def _scoring_validate(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "validate"
    return disp._v2._handle_quality(args)


def _scoring_confidence(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "compute"
    return disp._v2._handle_confidence(args)


def _scoring_confidence_stats(
    disp: "MemoryToolDispatcherConsolidated", args: dict
) -> str:
    args["action"] = "stats"
    return disp._v2._handle_confidence(args)


def _scoring_unreliable(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "unreliable"
    return disp._v2._handle_confidence(args)


def _scoring_feedback_submit(
    disp: "MemoryToolDispatcherConsolidated", args: dict
) -> str:
    args["action"] = "submit"
    return disp._v2._handle_feedback(args)


def _scoring_feedback_view(
    disp: "MemoryToolDispatcherConsolidated", args: dict
) -> str:
    args["action"] = "summary"
    return disp._v2._handle_feedback(args)


def _scoring_top_rated(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "top_rated"
    return disp._v2._handle_feedback(args)


def _scoring_low_rated(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "low_rated"
    return disp._v2._handle_feedback(args)


_SCORING_ROUTES = {
    "quality_score": _scoring_quality,
    "quality_stats": _scoring_quality_stats,
    "low_quality": _scoring_low_quality,
    "validate": _scoring_validate,
    "confidence": _scoring_confidence,
    "confidence_stats": _scoring_confidence_stats,
    "unreliable": _scoring_unreliable,
    "feedback_submit": _scoring_feedback_submit,
    "feedback_view": _scoring_feedback_view,
    "top_rated": _scoring_top_rated,
    "low_rated": _scoring_low_rated,
}


def handle_admin(
    disp: "MemoryToolDispatcherConsolidated", args: dict[str, Any]
) -> str:
    """Route admin actions to V1/V2 status/audit/sessions/analytics/dashboard."""
    action = args.get("action", "status")
    return _ADMIN_ROUTES.get(action, _admin_status)(disp, args)


def _admin_status(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    return disp._v1._handle_status(args)


def _admin_audit(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    return disp._v1._handle_audit(args)


def _admin_sessions(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    return disp._v1._handle_sessions(args)


def _admin_sync_code(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    return disp._v1._handle_sync_code(args)


def _admin_analytics(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args.setdefault("action", "summary")
    return disp._v2._handle_analytics(args)


def _admin_dashboard(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args.setdefault("action", "full")
    return disp._v2._handle_dashboard(args)


def _admin_popular(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "popular"
    return disp._v2._handle_analytics(args)


def _admin_gaps(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "gaps"
    return disp._v2._handle_analytics(args)


def _admin_zero_results(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "zero_results"
    return disp._v2._handle_analytics(args)


def _admin_metrics(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "metrics"
    return disp._v2._handle_dashboard(args)


def _admin_recommendations(
    disp: "MemoryToolDispatcherConsolidated", args: dict
) -> str:
    args["action"] = "recommendations"
    return disp._v2._handle_dashboard(args)


def _admin_trends(disp: "MemoryToolDispatcherConsolidated", args: dict) -> str:
    args["action"] = "trends"
    return disp._v2._handle_dashboard(args)


_ADMIN_ROUTES = {
    "status": _admin_status,
    "audit": _admin_audit,
    "sessions": _admin_sessions,
    "sync_code": _admin_sync_code,
    "analytics": _admin_analytics,
    "dashboard": _admin_dashboard,
    "popular": _admin_popular,
    "gaps": _admin_gaps,
    "zero_results": _admin_zero_results,
    "metrics": _admin_metrics,
    "recommendations": _admin_recommendations,
    "trends": _admin_trends,
}

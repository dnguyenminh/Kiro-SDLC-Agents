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


# --- KSA-142: F1/F2/F3 handlers ---


def handle_pin(disp: "MemoryToolDispatcherConsolidated", args: dict[str, Any]) -> str:
    """Route mem_pin actions to CoreMemoryManager."""
    from .core_memory import CoreMemoryManager

    db = disp._v1._db
    mgr = CoreMemoryManager(db)
    action = args.get("action", "list")
    entry_id = int(args.get("entry_id", 0))
    if action == "pin":
        return mgr.pin(entry_id)
    if action == "unpin":
        return mgr.unpin(entry_id)
    if action == "list":
        pinned = mgr.list_pinned()
        if not pinned:
            return "No pinned entries"
        lines = [f"Pinned entries ({len(pinned)}):"]
        for p in pinned:
            lines.append(f"  #{p.id} (order={p.pin_order}, ~{p.tokens} tokens): {p.summary[:80]}")
        return "\n".join(lines)
    if action == "reorder":
        order = int(args.get("order", 1))
        return mgr.reorder(entry_id, order)
    if action == "get_context":
        ctx = mgr.get_context()
        return ctx if ctx else "No pinned context"
    if action == "budget":
        status = mgr.get_budget_status()
        return (
            f"Budget: {status.used}/{status.max} tokens used, "
            f"{status.remaining} remaining"
            + (" ⚠️ WARNING" if status.warning else "")
        )
    return f"Unknown action: {action}"


def handle_conversation(
    disp: "MemoryToolDispatcherConsolidated", args: dict[str, Any]
) -> str:
    """Route mem_conversation actions to ConversationRepository."""
    import json as json_mod

    from .conversation_repo import ConversationRepository
    from .conversation_summarizer import ConversationSummarizer

    db = disp._v1._db
    repo = ConversationRepository(db)
    action = args.get("action", "list_sessions")

    if action == "save_turn":
        session_id = args.get("session_id", "")
        role = args.get("role", "user")
        content = args.get("content", "")
        tool_calls_str = args.get("tool_calls")
        tool_calls = json_mod.loads(tool_calls_str) if tool_calls_str else None
        turn_id = repo.save_turn(session_id, role, content, tool_calls)
        return f"Saved turn {turn_id} (session={session_id or 'auto'}, role={role})"

    if action == "get_session":
        session_id = args.get("session_id", "")
        limit = int(args.get("limit", 100))
        turns = repo.get_session(session_id, limit)
        if not turns:
            return f"No turns found for session: {session_id}"
        lines = [f"Session {session_id} ({len(turns)} turns):"]
        for t in turns:
            lines.append(f"  [{t.role}] {t.content[:120]}")
        return "\n".join(lines)

    if action == "list_sessions":
        limit = int(args.get("limit", 20))
        sessions = repo.list_sessions(limit)
        if not sessions:
            return "No conversation sessions found"
        lines = [f"Sessions ({len(sessions)}):"]
        for s in sessions:
            lines.append(
                f"  {s.session_id}: {s.turn_count} turns, "
                f"roles={','.join(s.roles)}, last={s.last_turn_at}"
            )
        return "\n".join(lines)

    if action == "search":
        query = args.get("query", "")
        limit = int(args.get("limit", 20))
        turns = repo.search_turns(query, limit)
        if not turns:
            return f"No turns matching: {query}"
        lines = [f"Found {len(turns)} turns matching '{query}':"]
        for t in turns:
            lines.append(f"  [{t.session_id}/{t.role}] {t.content[:120]}")
        return "\n".join(lines)

    if action == "summarize":
        session_id = args.get("session_id", "")
        knowledge = disp._v1._knowledge_repo
        summarizer = ConversationSummarizer(repo, knowledge)
        result = summarizer.summarize_session(session_id)
        if result is None:
            return f"No turns to summarize for session: {session_id}"
        return (
            f"Summarized {result.turns_processed} turns → "
            f"entry #{result.summary_entry_id}"
        )

    return f"Unknown action: {action}"


def handle_map(disp: "MemoryToolDispatcherConsolidated", args: dict[str, Any]) -> str:
    """Route mem_map actions to StructuredMapExtractor + EntityRepository."""
    import json as json_mod

    from .structured_map_extractor import (
        EntityRepository,
        StructuredMap,
        extract_structured_map,
    )

    db = disp._v1._db
    entity_repo = EntityRepository(db)
    action = args.get("action", "get")
    entry_id = int(args.get("entry_id", 0))

    if action == "get":
        cur = db.execute(
            "SELECT structured_map FROM knowledge_entries WHERE id = ?", (entry_id,)
        )
        row = cur.fetchone()
        if row is None:
            return f"Error: entry {entry_id} not found"
        return row[0] or "{}"

    if action == "update":
        partial_map = args.get("map", {})
        cur = db.execute(
            "SELECT structured_map FROM knowledge_entries WHERE id = ?", (entry_id,)
        )
        row = cur.fetchone()
        if row is None:
            return f"Error: entry {entry_id} not found"
        existing = json_mod.loads(row[0] or "{}")
        existing.update(partial_map)
        db.execute(
            "UPDATE knowledge_entries SET structured_map = ? WHERE id = ?",
            (json_mod.dumps(existing), entry_id),
        )
        db.commit()
        return f"Updated structured map for entry {entry_id}"

    if action == "search_entity":
        entity = args.get("entity", "")
        limit = int(args.get("limit", 10))
        entry_ids = entity_repo.find_by_entity(entity, limit)
        if not entry_ids:
            return f"No entries found for entity: {entity}"
        return f"Entries mentioning '{entity}': {entry_ids}"

    if action == "search_topic":
        topic = args.get("topic", "")
        limit = int(args.get("limit", 10))
        cur = db.execute(
            "SELECT id, structured_map FROM knowledge_entries "
            "WHERE structured_map LIKE ? LIMIT ?",
            (f"%{topic}%", limit),
        )
        ids = [row[0] for row in cur.fetchall()]
        if not ids:
            return f"No entries found for topic: {topic}"
        return f"Entries with topic '{topic}': {ids}"

    if action == "reextract":
        cur = db.execute(
            "SELECT content FROM knowledge_entries WHERE id = ?", (entry_id,)
        )
        row = cur.fetchone()
        if row is None:
            return f"Error: entry {entry_id} not found"
        smap = extract_structured_map(row[0] or "")
        db.execute(
            "UPDATE knowledge_entries SET structured_map = ? WHERE id = ?",
            (smap.to_json(), entry_id),
        )
        db.commit()
        # Re-index entities
        entity_repo.index_entities(entry_id, smap.entities_mentioned)
        return f"Re-extracted map for entry {entry_id}: topic='{smap.topic}', entities={len(smap.entities_mentioned)}"

    return f"Unknown action: {action}"

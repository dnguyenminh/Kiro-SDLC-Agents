"""DispatcherV2 — routes new mem_* tool calls to V2 handlers."""

import json
from typing import Any

from .engine_v2 import MemoryEngineV2


class MemoryToolDispatcherV2:
    """Routes V2 mem_* tool calls to KB Enhancement handlers."""

    def __init__(self, engine: MemoryEngineV2) -> None:
        self._engine = engine

    def dispatch(self, name: str, args: dict[str, Any]) -> str | None:
        """Dispatch a V2 memory tool call. Returns None if not handled."""
        handlers = {
            "mem_consolidate_v2": self._handle_consolidate_v2,
            "mem_stale": self._handle_stale,
            "mem_due_reviews": self._handle_due_reviews,
            "mem_review": self._handle_review,
            "mem_templates": self._handle_templates,
            "mem_attachments": self._handle_attachments,
            "mem_suggest": self._handle_suggest,
            "mem_related": self._handle_related,
            "mem_tags": self._handle_tags,
            "mem_analytics": self._handle_analytics,
            "mem_cite": self._handle_cite,
            "mem_citations": self._handle_citations,
            "mem_feedback": self._handle_feedback,
            "mem_reminders": self._handle_reminders,
            "mem_quality": self._handle_quality,
            "mem_confidence": self._handle_confidence,
            "mem_dashboard": self._handle_dashboard,
        }
        handler = handlers.get(name)
        if handler is None:
            return None
        return handler(args)

    def _handle_consolidate_v2(self, args: dict[str, Any]) -> str:
        action = args.get("action", "consolidate")
        dry_run = args.get("dry_run", False)

        if action == "merge":
            survivor_id = args.get("survivor_id")
            merge_ids_str = args.get("merge_ids", "")
            if not survivor_id or not merge_ids_str:
                return "Error: survivor_id and merge_ids required for merge"
            merge_ids = [int(x.strip()) for x in merge_ids_str.split(",")]
            strategy = args.get("strategy", "append")
            result = self._engine.consolidation_engine.merge_entries(
                int(survivor_id), merge_ids, strategy, dry_run=dry_run
            )
        else:
            result = self._engine.consolidation_engine.consolidate(dry_run)

        return json.dumps(result, indent=2)

    def _handle_stale(self, args: dict[str, Any]) -> str:
        action = args.get("action", "detect")
        threshold = args.get("threshold", 0.8)

        if action == "unarchive":
            entry_id = args.get("entry_id")
            if not entry_id:
                return "Error: entry_id required for unarchive"
            result = self._engine.staleness.unarchive(int(entry_id))
        elif action == "archive":
            dry_run = args.get("dry_run", False)
            result = self._engine.staleness.auto_archive(threshold, dry_run)
        else:
            entries = self._engine.staleness.detect_stale(threshold)
            result = {"stale_count": len(entries), "entries": entries}

        return json.dumps(result, indent=2, default=str)

    def _handle_due_reviews(self, args: dict[str, Any]) -> str:
        days = args.get("days", 90)
        limit = args.get("limit", 20)
        entries = self._engine.staleness.get_due_reviews(int(days), int(limit))
        if not entries:
            return "No entries due for review."
        lines = [f"Entries due for review ({len(entries)}):\n"]
        for e in entries:
            lines.append(f"#{e['id']} [{e['type']}] {e['summary'][:60]}")
            lines.append(f"  Owner: {e.get('owner') or 'unassigned'} | Last reviewed: {e.get('last_reviewed_at') or 'never'}")
        return "\n".join(lines)

    def _handle_review(self, args: dict[str, Any]) -> str:
        action = args.get("action", "mark_reviewed")
        entry_id = args.get("entry_id")
        if not entry_id:
            return "Error: entry_id required"

        if action == "mark_reviewed":
            reviewer = args.get("reviewer")
            result = self._engine.staleness.mark_reviewed(int(entry_id), reviewer)
        elif action == "assign_owner":
            owner = args.get("owner", "")
            result = self._engine.rbac.assign_owner(int(entry_id), owner)
        elif action == "assign_reviewer":
            reviewer = args.get("reviewer", "")
            result = self._engine.rbac.assign_reviewer(int(entry_id), reviewer)
        elif action == "set_status":
            status = args.get("status", "pending")
            reviewer = args.get("reviewer")
            result = self._engine.rbac.set_review_status(int(entry_id), status, reviewer)
        else:
            return f"Unknown action: {action}"

        return json.dumps(result, default=str)

    def _handle_templates(self, args: dict[str, Any]) -> str:
        action = args.get("action", "list")

        if action == "create":
            name = args.get("name", "")
            type_ = args.get("type", "")
            sections_str = args.get("required_sections", "")
            sections = [s.strip() for s in sections_str.split(",") if s.strip()]
            result = self._engine.templates.create_template(name, type_, sections)
        elif action == "validate":
            entry_id = args.get("entry_id")
            if not entry_id:
                return "Error: entry_id required for validate"
            result = self._engine.templates.validate_entry(int(entry_id))
        else:
            result = self._engine.templates.list_templates()

        return json.dumps(result, indent=2, default=str)

    def _handle_attachments(self, args: dict[str, Any]) -> str:
        action = args.get("action", "list")

        if action == "attach":
            entry_id = args.get("entry_id")
            file_path = args.get("file_path", "")
            if not entry_id or not file_path:
                return "Error: entry_id and file_path required"
            desc = args.get("description")
            result = self._engine.attachments.attach(int(entry_id), file_path, desc)
        elif action == "remove":
            att_id = args.get("attachment_id")
            if not att_id:
                return "Error: attachment_id required"
            result = self._engine.attachments.remove_attachment(int(att_id))
        elif action == "search":
            mime = args.get("mime_prefix", "image/")
            result = self._engine.attachments.search_by_type(mime)
        else:
            entry_id = args.get("entry_id")
            if not entry_id:
                return "Error: entry_id required for list"
            result = self._engine.attachments.list_attachments(int(entry_id))

        return json.dumps(result, indent=2, default=str)

    def _handle_suggest(self, args: dict[str, Any]) -> str:
        query = args.get("query", "")
        limit = args.get("limit", 5)
        results = self._engine.suggestions.suggest(query, int(limit))
        if not results:
            return f'No suggestions for "{query}"'
        lines = [f"Suggestions ({len(results)}):\n"]
        for r in results:
            lines.append(f"  #{r['id']} [{r['type']}] {r['summary'][:60]}")
        return "\n".join(lines)

    def _handle_related(self, args: dict[str, Any]) -> str:
        entry_id = args.get("entry_id")
        if not entry_id:
            return "Error: entry_id required"
        limit = args.get("limit", 5)
        refresh = args.get("refresh", False)

        if refresh:
            results = self._engine.suggestions.refresh_related(int(entry_id), int(limit))
        else:
            results = self._engine.suggestions.get_related(int(entry_id), int(limit))

        if not results:
            return f"No related entries found for #{entry_id}"
        lines = [f"Related to #{entry_id} ({len(results)}):\n"]
        for r in results:
            lines.append(f"  #{r['id']} [{r['type']}] {r['summary'][:60]} (score: {r['score']})")
        return "\n".join(lines)

    def _handle_tags(self, args: dict[str, Any]) -> str:
        action = args.get("action", "taxonomy")

        if action == "create":
            tag = args.get("tag", "")
            category = args.get("category", "general")
            parent = args.get("parent_tag")
            result = self._engine.tag_taxonomy.create_tag(tag, category, parent)
            return json.dumps(result)
        elif action == "tag":
            entry_id = args.get("entry_id")
            tags_str = args.get("tags", "")
            if not entry_id or not tags_str:
                return "Error: entry_id and tags required"
            tags = [t.strip() for t in tags_str.split(",")]
            result = self._engine.tag_taxonomy.tag_entry(int(entry_id), tags)
            return json.dumps(result)
        elif action == "untag":
            entry_id = args.get("entry_id")
            tags_str = args.get("tags", "")
            tags = [t.strip() for t in tags_str.split(",")]
            result = self._engine.tag_taxonomy.untag_entry(int(entry_id), tags)
            return json.dumps(result)
        elif action == "search":
            tags_str = args.get("tags", "")
            tags = [t.strip() for t in tags_str.split(",")]
            operator = args.get("operator", "AND")
            limit = args.get("limit", 20)
            result = self._engine.tag_taxonomy.search_by_tags(tags, operator, int(limit))
            return json.dumps(result, indent=2, default=str)
        elif action == "popular":
            limit = args.get("limit", 20)
            result = self._engine.tag_taxonomy.get_popular_tags(int(limit))
            return json.dumps(result, indent=2, default=str)
        elif action == "entry_tags":
            entry_id = args.get("entry_id")
            if not entry_id:
                return "Error: entry_id required"
            result = self._engine.tag_taxonomy.get_entry_tags(int(entry_id))
            return json.dumps(result, indent=2, default=str)
        else:
            category = args.get("category")
            result = self._engine.tag_taxonomy.get_taxonomy(category)
            return json.dumps(result, indent=2, default=str)

    def _handle_analytics(self, args: dict[str, Any]) -> str:
        action = args.get("action", "summary")
        limit = args.get("limit", 10)

        if action == "popular":
            result = self._engine.search_analytics.get_popular_queries(int(limit))
        elif action == "gaps":
            result = self._engine.search_analytics.get_content_gaps()
        elif action == "zero_results":
            result = self._engine.search_analytics.get_zero_result_queries(int(limit))
        else:
            result = self._engine.search_analytics.get_analytics()

        return json.dumps(result, indent=2, default=str)

    def _handle_cite(self, args: dict[str, Any]) -> str:
        entry_id = args.get("entry_id")
        cited_by = args.get("cited_by", "")
        if not entry_id or not cited_by:
            return "Error: entry_id and cited_by required"
        context = args.get("context")
        session_id = self._engine.session_id
        result = self._engine.citation_tracker.cite(
            int(entry_id), cited_by, context, session_id
        )
        return json.dumps(result)

    def _handle_citations(self, args: dict[str, Any]) -> str:
        action = args.get("action", "most_cited")
        limit = args.get("limit", 10)

        if action == "entry":
            entry_id = args.get("entry_id")
            if not entry_id:
                return "Error: entry_id required"
            result = self._engine.citation_tracker.get_citations(int(entry_id), int(limit))
        elif action == "uncited":
            result = self._engine.citation_tracker.get_uncited_entries(int(limit))
        elif action == "by_agent":
            agent = args.get("agent", "")
            result = self._engine.citation_tracker.get_citations_by_agent(agent, int(limit))
        else:
            result = self._engine.citation_tracker.get_most_cited(int(limit))

        return json.dumps(result, indent=2, default=str)

    def _handle_feedback(self, args: dict[str, Any]) -> str:
        action = args.get("action", "summary")

        if action == "submit":
            entry_id = args.get("entry_id")
            rating = args.get("rating")
            if not entry_id or rating is None:
                return "Error: entry_id and rating required"
            comment = args.get("comment")
            session_id = self._engine.session_id
            result = self._engine.feedback.submit_feedback(
                int(entry_id), int(rating), comment, session_id=session_id
            )
            return json.dumps(result)
        elif action == "low_rated":
            limit = args.get("limit", 10)
            result = self._engine.feedback.get_low_rated(int(limit))
        elif action == "top_rated":
            limit = args.get("limit", 10)
            result = self._engine.feedback.get_top_rated(int(limit))
        else:
            entry_id = args.get("entry_id")
            if not entry_id:
                return "Error: entry_id required for summary"
            result = self._engine.feedback.get_feedback_summary(int(entry_id))

        return json.dumps(result, indent=2, default=str)

    def _handle_reminders(self, args: dict[str, Any]) -> str:
        action = args.get("action", "due")
        limit = args.get("limit", 20)

        if action == "schedule":
            entry_id = args.get("entry_id")
            if not entry_id:
                return "Error: entry_id required"
            interval = args.get("interval_days")
            assignee = args.get("assignee")
            result = self._engine.review_reminders.schedule_reminder(
                int(entry_id), interval, assignee
            )
            return json.dumps(result, default=str)
        elif action == "snooze":
            entry_id = args.get("entry_id")
            if not entry_id:
                return "Error: entry_id required"
            days = args.get("snooze_days", 7)
            result = self._engine.review_reminders.snooze_reminder(int(entry_id), int(days))
            return json.dumps(result, default=str)
        elif action == "dismiss":
            entry_id = args.get("entry_id")
            if not entry_id:
                return "Error: entry_id required"
            result = self._engine.review_reminders.dismiss_reminder(int(entry_id))
            return json.dumps(result)
        elif action == "complete":
            entry_id = args.get("entry_id")
            if not entry_id:
                return "Error: entry_id required"
            reviewer = args.get("reviewer")
            result = self._engine.review_reminders.complete_review(int(entry_id), reviewer)
            return json.dumps(result, default=str)
        elif action == "auto_schedule":
            result = self._engine.review_reminders.auto_schedule_all()
            return json.dumps(result)
        elif action == "stats":
            result = self._engine.review_reminders.get_reminder_stats()
            return json.dumps(result)
        else:
            entries = self._engine.review_reminders.get_due_reminders(int(limit))
            if not entries:
                return "No reminders due."
            lines = [f"Due reminders ({len(entries)}):\n"]
            for e in entries:
                lines.append(f"#{e['entry_id']} [{e.get('type', '')}] {e.get('summary', '')[:60]}")
                lines.append(f"  Due: {e['next_reminder_at']} | Assignee: {e.get('assignee') or 'unassigned'}")
            return "\n".join(lines)

    def _handle_quality(self, args: dict[str, Any]) -> str:
        action = args.get("action", "stats")

        if action == "score":
            entry_id = args.get("entry_id")
            if not entry_id:
                return "Error: entry_id required"
            result = self._engine.quality_scorer.score_entry(int(entry_id))
            return json.dumps(result, indent=2, default=str)
        elif action == "score_all":
            limit = args.get("limit", 100)
            result = self._engine.quality_scorer.score_all(int(limit))
            return json.dumps(result)
        elif action == "low_quality":
            threshold = args.get("threshold", 40)
            limit = args.get("limit", 20)
            result = self._engine.quality_scorer.get_low_quality(int(threshold), int(limit))
            return json.dumps(result, indent=2, default=str)
        elif action == "validate":
            content = args.get("content", "")
            type_ = args.get("type", "CONTEXT")
            if not content:
                return "Error: content required for validate"
            result = self._engine.quality_scorer.validate_content(content, type_)
            return json.dumps(result)
        else:
            result = self._engine.quality_scorer.get_quality_stats()
            return json.dumps(result, indent=2, default=str)

    def _handle_confidence(self, args: dict[str, Any]) -> str:
        action = args.get("action", "stats")

        if action == "compute":
            entry_id = args.get("entry_id")
            if not entry_id:
                return "Error: entry_id required"
            result = self._engine.confidence_scorer.compute_confidence(int(entry_id))
            return json.dumps(result, indent=2, default=str)
        elif action == "batch":
            limit = args.get("limit", 200)
            result = self._engine.confidence_scorer.batch_compute(int(limit))
            return json.dumps(result)
        elif action == "unreliable":
            limit = args.get("limit", 20)
            result = self._engine.confidence_scorer.get_unreliable(int(limit))
            return json.dumps(result, indent=2, default=str)
        else:
            result = self._engine.confidence_scorer.get_confidence_stats()
            return json.dumps(result, indent=2, default=str)

    def _handle_dashboard(self, args: dict[str, Any]) -> str:
        action = args.get("action", "full")

        if action == "metrics":
            result = self._engine.health_dashboard.get_metrics()
        elif action == "recommendations":
            result = self._engine.health_dashboard.get_recommendations()
        elif action == "trends":
            days = args.get("days", 30)
            result = self._engine.health_dashboard.get_trends(int(days))
        else:
            result = self._engine.health_dashboard.get_dashboard()

        return json.dumps(result, indent=2, default=str)

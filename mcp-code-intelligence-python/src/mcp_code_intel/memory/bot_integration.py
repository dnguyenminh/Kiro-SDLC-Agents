"""KSA-83: Slack/Teams Bot Integration — message handler for KB queries."""

import re
from typing import Any


# Command patterns for bot messages
BOT_COMMANDS = {
    "search": r"^(?:search|find|tìm)\s+(.+)",
    "suggest": r"^(?:suggest|gợi ý)\s+(.+)",
    "status": r"^(?:status|trạng thái|health)$",
    "help": r"^(?:help|trợ giúp|commands)$",
    "recent": r"^(?:recent|mới nhất)(?:\s+(\d+))?$",
    "tags": r"^(?:tags|nhãn)(?:\s+(.+))?$",
    "quality": r"^(?:quality|chất lượng)$",
}


class BotMessageHandler:
    """Handle bot messages from Slack/Teams and return KB responses."""

    def __init__(self, engine: Any) -> None:
        self._engine = engine

    def handle_message(self, text: str, user_id: str = "",
                       channel: str = "") -> dict[str, Any]:
        """Parse and handle a bot message. Returns response dict."""
        text = text.strip()
        if not text:
            return self._help_response()

        for cmd, pattern in BOT_COMMANDS.items():
            match = re.match(pattern, text, re.IGNORECASE)
            if match:
                handler = getattr(self, f"_cmd_{cmd}")
                return handler(match, user_id, channel)

        # Default: treat as search query
        return self._cmd_search(re.match(r"^(.+)$", text), user_id, channel)

    def _cmd_search(self, match: re.Match, user_id: str,
                    channel: str) -> dict[str, Any]:
        """Handle search command."""
        query = match.group(1)
        results = self._engine.suggestions.suggest(query, 5)
        if not results:
            return {
                "text": f'🔍 Không tìm thấy kết quả cho "{query}"',
                "blocks": [],
            }
        lines = [f'🔍 Kết quả cho "{query}":']
        for r in results:
            lines.append(f"• [{r['type']}] {r['summary'][:80]} (#{r['id']})")
        return {"text": "\n".join(lines), "result_count": len(results)}

    def _cmd_suggest(self, match: re.Match, user_id: str,
                     channel: str) -> dict[str, Any]:
        """Handle suggest command."""
        query = match.group(1)
        results = self._engine.suggestions.suggest(query, 5)
        if not results:
            return {"text": f'💡 Không có gợi ý cho "{query}"'}
        lines = ["💡 Gợi ý:"]
        for r in results:
            lines.append(f"• {r['summary'][:80]}")
        return {"text": "\n".join(lines)}

    def _cmd_status(self, match: re.Match, user_id: str,
                    channel: str) -> dict[str, Any]:
        """Handle status command."""
        stats = self._engine.get_stats()
        lines = [
            "📊 KB Status:",
            f"• Entries: {stats['total_entries']}",
            f"• Edges: {stats['total_edges']}",
            f"• Vectors: {stats['total_vectors']}",
        ]
        for t in stats.get("tier_breakdown", []):
            lines.append(f"  - {t['tier']}: {t['entry_count']}")
        return {"text": "\n".join(lines)}

    def _cmd_help(self, match: re.Match, user_id: str,
                  channel: str) -> dict[str, Any]:
        """Handle help command."""
        return self._help_response()

    def _cmd_recent(self, match: re.Match, user_id: str,
                    channel: str) -> dict[str, Any]:
        """Handle recent entries command."""
        limit = int(match.group(1) or "5")
        entries = self._engine.knowledge.find_by_tier("WORKING", min(limit, 10))
        if not entries:
            return {"text": "📋 Không có entries gần đây."}
        lines = ["📋 Entries gần đây:"]
        for e in entries:
            lines.append(f"• [{e['type']}] {e['summary'][:60]} (#{e['id']})")
        return {"text": "\n".join(lines)}

    def _cmd_tags(self, match: re.Match, user_id: str,
                  channel: str) -> dict[str, Any]:
        """Handle tags command."""
        category = match.group(1) if match.lastindex else None
        tags = self._engine.tag_taxonomy.get_popular_tags(10)
        if not tags:
            return {"text": "🏷️ Chưa có tags nào."}
        lines = ["🏷️ Tags phổ biến:"]
        for t in tags:
            lines.append(f"• {t['tag']} ({t['usage_count']} uses)")
        return {"text": "\n".join(lines)}

    def _cmd_quality(self, match: re.Match, user_id: str,
                     channel: str) -> dict[str, Any]:
        """Handle quality command."""
        from .quality_scoring import QualityScorer
        scorer = QualityScorer(self._engine._conn)
        stats = scorer.get_quality_stats()
        lines = [
            "📈 Quality Stats:",
            f"• Average: {stats['average_score']}/100",
            f"• Scored: {stats['total_scored']} entries",
            f"• Range: {stats['min_score']} - {stats['max_score']}",
        ]
        return {"text": "\n".join(lines)}

    @staticmethod
    def _help_response() -> dict[str, Any]:
        """Return help text."""
        return {
            "text": (
                "🤖 KB Bot Commands:\n"
                "• `search <query>` — Search knowledge base\n"
                "• `suggest <text>` — Get suggestions\n"
                "• `recent [N]` — Show recent entries\n"
                "• `tags [category]` — Show popular tags\n"
                "• `quality` — Quality statistics\n"
                "• `status` — KB health status\n"
                "• `help` — Show this help"
            )
        }


class SlackWebhookHandler:
    """Handle Slack webhook events."""

    def __init__(self, bot_handler: BotMessageHandler,
                 bot_token: str = "") -> None:
        self._handler = bot_handler
        self._token = bot_token

    def handle_event(self, event: dict[str, Any]) -> dict[str, Any] | None:
        """Handle a Slack event payload."""
        event_type = event.get("type", "")
        if event_type == "url_verification":
            return {"challenge": event.get("challenge", "")}

        inner = event.get("event", {})
        if inner.get("type") != "message":
            return None
        if inner.get("bot_id"):
            return None  # Ignore bot messages

        text = inner.get("text", "")
        user = inner.get("user", "")
        channel = inner.get("channel", "")
        return self._handler.handle_message(text, user, channel)


class TeamsWebhookHandler:
    """Handle Microsoft Teams webhook events."""

    def __init__(self, bot_handler: BotMessageHandler) -> None:
        self._handler = bot_handler

    def handle_activity(self, activity: dict[str, Any]) -> dict[str, Any] | None:
        """Handle a Teams activity payload."""
        if activity.get("type") != "message":
            return None

        text = activity.get("text", "")
        # Strip bot mention
        text = re.sub(r"<at>.*?</at>\s*", "", text).strip()
        user = activity.get("from", {}).get("id", "")
        channel = activity.get("channelId", "")

        result = self._handler.handle_message(text, user, channel)
        return {"type": "message", "text": result["text"]}

"""ConversationSummarizer — compresses old turns into summary entries.

Runs on session end or when turn count exceeds threshold.
Port of Node.js conversation-summarizer.ts (KSA-142 F2).
"""

from dataclasses import dataclass

from .conversation_repo import ConversationRepository, ConversationTurn
from .knowledge_repo import KnowledgeRepository


@dataclass
class SummarizeResult:
    """Result of summarizing a session."""

    session_id: str
    turns_processed: int
    summary_entry_id: int


class ConversationSummarizer:
    """Summarizes conversation sessions into knowledge entries."""

    def __init__(
        self,
        conversations: ConversationRepository,
        knowledge: KnowledgeRepository,
        max_turns: int = 50,
    ) -> None:
        self._conversations = conversations
        self._knowledge = knowledge
        self._max_turns = max_turns

    def summarize_session(self, session_id: str) -> SummarizeResult | None:
        """Summarize a session's conversation into a knowledge entry."""
        turns = self._conversations.get_session(session_id, limit=200)
        if not turns:
            return None
        summary = self._build_summary(turns)
        content = self._build_content(turns)
        entry_id = self._knowledge.insert(
            content=content,
            summary=summary,
            entry_type="CONVERSATION",
            tier="EPISODIC",
            source=f"session:{session_id}",
            tags=f"conversation,{session_id}",
        )
        return SummarizeResult(
            session_id=session_id,
            turns_processed=len(turns),
            summary_entry_id=entry_id,
        )

    def needs_summarization(self, session_id: str) -> bool:
        """Check if session needs summarization."""
        count = self._conversations.get_session_turn_count(session_id)
        return count >= self._max_turns

    def _build_summary(self, turns: list[ConversationTurn]) -> str:
        roles = list({t.role for t in turns})
        first_topic = turns[0].content[:80] if turns else "conversation"
        return (
            f"Conversation ({len(turns)} turns, roles: {','.join(roles)}): "
            f"{first_topic}"
        )

    def _build_content(self, turns: list[ConversationTurn]) -> str:
        lines = [f"# Conversation Summary ({len(turns)} turns)\n"]
        for turn in turns[:100]:
            prefix = f"[{turn.role}] "
            text = turn.content[:300]
            lines.append(f"{prefix}{text}")
        if len(turns) > 100:
            lines.append(f"\n... ({len(turns) - 100} more turns truncated)")
        return "\n".join(lines)

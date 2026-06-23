"""AgentScopeFilter — tag-based KB isolation per agent role.

Each agent role has a configurable tag set. Search results are
filtered to only include entries matching the agent's tags.
Untagged entries remain visible to all agents (backward compatible).
"""

import json
import logging
import sqlite3
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class AgentScope:
    """Scope configuration for an agent role."""

    role: str
    tags: list[str]


class AgentScopeFilter:
    """Tag-based KB isolation per agent role."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._cache: dict[str, list[str]] = {}
        self._load_cache()

    def get_scope(self, agent_role: str) -> AgentScope | None:
        """Get scope configuration for an agent role."""
        tags = self._cache.get(agent_role.upper())
        if tags is None:
            return None
        return AgentScope(role=agent_role.upper(), tags=tags)

    def filter(self, results: list[dict[str, Any]], agent_role: str) -> list[dict[str, Any]]:
        """Filter search results by agent's tag set."""
        scope = self.get_scope(agent_role)
        if scope is None:
            return results

        filtered = []
        for r in results:
            entry_tags = _parse_tags(r.get("entry", {}).get("tags"))
            if not entry_tags or any(t in scope.tags for t in entry_tags):
                filtered.append(r)
        return filtered

    def update_scope(self, agent_role: str, tags: list[str]) -> None:
        """Update scope configuration for a role."""
        role = agent_role.upper()
        tag_json = json.dumps(tags)
        cursor = self._conn.cursor()
        cursor.execute(
            """INSERT INTO agent_scope_config (agent_role, tag_set, updated_at)
               VALUES (?, ?, datetime('now'))
               ON CONFLICT(agent_role) DO UPDATE SET
                 tag_set = excluded.tag_set, updated_at = datetime('now')""",
            (role, tag_json),
        )
        self._conn.commit()
        self._cache[role] = tags

    def _load_cache(self) -> None:
        self._cache.clear()
        try:
            cursor = self._conn.cursor()
            cursor.execute("SELECT agent_role, tag_set FROM agent_scope_config")
            for row in cursor.fetchall():
                self._cache[row[0]] = json.loads(row[1])
        except sqlite3.OperationalError:
            # Table may not exist yet (pre-migration)
            logger.debug("agent_scope_config table not found, skipping cache load")


def _parse_tags(tags: str | None) -> list[str]:
    """Parse comma-separated tags string into list."""
    if not tags:
        return []
    return [t.strip().lower() for t in tags.split(",") if t.strip()]

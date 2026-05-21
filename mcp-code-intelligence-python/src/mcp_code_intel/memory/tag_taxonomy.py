"""KSA-77: Faceted Search with Tag Taxonomy."""

import sqlite3
from typing import Any


class TagTaxonomyManager:
    """Hierarchical tag taxonomy with faceted search."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def create_tag(self, tag: str, category: str = "general",
                   parent_tag: str | None = None,
                   description: str | None = None) -> dict[str, Any]:
        """Create a new tag in the taxonomy."""
        self._conn.execute(
            """INSERT OR IGNORE INTO tag_taxonomy (tag, category, parent_tag, description)
               VALUES (?, ?, ?, ?)""",
            (tag, category, parent_tag, description),
        )
        self._conn.commit()
        return {"tag": tag, "category": category, "parent": parent_tag}

    def tag_entry(self, entry_id: int, tags: list[str]) -> dict[str, Any]:
        """Assign tags to an entry (creates tags if not exist)."""
        added = []
        for tag_name in tags:
            tag_id = self._ensure_tag(tag_name)
            self._conn.execute(
                "INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)",
                (entry_id, tag_id),
            )
            self._increment_usage(tag_id)
            added.append(tag_name)
        self._conn.commit()
        return {"entry_id": entry_id, "tags_added": added}

    def untag_entry(self, entry_id: int, tags: list[str]) -> dict[str, Any]:
        """Remove tags from an entry."""
        removed = []
        for tag_name in tags:
            tag_id = self._get_tag_id(tag_name)
            if tag_id:
                self._conn.execute(
                    "DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?",
                    (entry_id, tag_id),
                )
                removed.append(tag_name)
        self._conn.commit()
        return {"entry_id": entry_id, "tags_removed": removed}

    def search_by_tags(self, tags: list[str], operator: str = "AND",
                       limit: int = 20) -> list[dict[str, Any]]:
        """Search entries by tags with AND/OR logic."""
        tag_ids = [self._get_tag_id(t) for t in tags]
        tag_ids = [tid for tid in tag_ids if tid is not None]
        if not tag_ids:
            return []

        placeholders = ",".join("?" * len(tag_ids))
        if operator == "AND":
            cur = self._conn.execute(
                f"""SELECT ke.id, ke.summary, ke.type, ke.tier, ke.tags
                    FROM entry_tags et
                    JOIN knowledge_entries ke ON et.entry_id = ke.id
                    WHERE et.tag_id IN ({placeholders})
                      AND ke.archived_at IS NULL
                    GROUP BY ke.id
                    HAVING COUNT(DISTINCT et.tag_id) = ?
                    LIMIT ?""",
                tag_ids + [len(tag_ids), limit],
            )
        else:
            cur = self._conn.execute(
                f"""SELECT DISTINCT ke.id, ke.summary, ke.type, ke.tier, ke.tags
                    FROM entry_tags et
                    JOIN knowledge_entries ke ON et.entry_id = ke.id
                    WHERE et.tag_id IN ({placeholders})
                      AND ke.archived_at IS NULL
                    LIMIT ?""",
                tag_ids + [limit],
            )
        return [dict(row) for row in cur.fetchall()]

    def get_taxonomy(self, category: str | None = None) -> list[dict[str, Any]]:
        """Get tag taxonomy tree."""
        if category:
            cur = self._conn.execute(
                """SELECT * FROM tag_taxonomy WHERE category = ?
                   ORDER BY parent_tag NULLS FIRST, tag""",
                (category,),
            )
        else:
            cur = self._conn.execute(
                "SELECT * FROM tag_taxonomy ORDER BY category, parent_tag NULLS FIRST, tag"
            )
        return [dict(row) for row in cur.fetchall()]

    def get_popular_tags(self, limit: int = 20) -> list[dict[str, Any]]:
        """Get most used tags."""
        cur = self._conn.execute(
            "SELECT * FROM tag_taxonomy ORDER BY usage_count DESC LIMIT ?",
            (limit,),
        )
        return [dict(row) for row in cur.fetchall()]

    def get_entry_tags(self, entry_id: int) -> list[dict[str, Any]]:
        """Get all tags for an entry."""
        cur = self._conn.execute(
            """SELECT tt.* FROM entry_tags et
               JOIN tag_taxonomy tt ON et.tag_id = tt.id
               WHERE et.entry_id = ?
               ORDER BY tt.tag""",
            (entry_id,),
        )
        return [dict(row) for row in cur.fetchall()]

    def _ensure_tag(self, tag_name: str) -> int:
        """Get or create tag, return ID."""
        cur = self._conn.execute(
            "SELECT id FROM tag_taxonomy WHERE tag = ?", (tag_name,)
        )
        row = cur.fetchone()
        if row:
            return row["id"]
        cur = self._conn.execute(
            "INSERT INTO tag_taxonomy (tag) VALUES (?)", (tag_name,)
        )
        self._conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def _get_tag_id(self, tag_name: str) -> int | None:
        """Get tag ID by name."""
        cur = self._conn.execute(
            "SELECT id FROM tag_taxonomy WHERE tag = ?", (tag_name,)
        )
        row = cur.fetchone()
        return row["id"] if row else None

    def _increment_usage(self, tag_id: int) -> None:
        """Increment tag usage count."""
        self._conn.execute(
            "UPDATE tag_taxonomy SET usage_count = usage_count + 1 WHERE id = ?",
            (tag_id,),
        )

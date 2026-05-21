"""KSA-71: Owner/Reviewer Assignment & RBAC."""

import sqlite3
from typing import Any


VALID_ROLES = ("admin", "editor", "reviewer", "viewer")
VALID_REVIEW_STATUSES = ("pending", "approved", "rejected", "needs_revision")


class RBACManager:
    """Role-Based Access Control for knowledge entries."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def assign_owner(self, entry_id: int, owner: str) -> dict[str, Any]:
        """Assign owner to an entry."""
        self._conn.execute(
            "UPDATE knowledge_entries SET owner = ?, updated_at = datetime('now') WHERE id = ?",
            (owner, entry_id),
        )
        self._conn.commit()
        return {"entry_id": entry_id, "owner": owner}

    def assign_reviewer(self, entry_id: int, reviewer: str) -> dict[str, Any]:
        """Assign reviewer to an entry."""
        self._conn.execute(
            "UPDATE knowledge_entries SET reviewer = ?, updated_at = datetime('now') WHERE id = ?",
            (reviewer, entry_id),
        )
        self._conn.commit()
        return {"entry_id": entry_id, "reviewer": reviewer}

    def set_review_status(self, entry_id: int, status: str,
                          reviewer: str | None = None) -> dict[str, Any]:
        """Set review status for an entry."""
        if status not in VALID_REVIEW_STATUSES:
            return {"error": f"Invalid status. Valid: {VALID_REVIEW_STATUSES}"}
        self._conn.execute(
            """UPDATE knowledge_entries
               SET review_status = ?, updated_at = datetime('now')
               WHERE id = ?""",
            (status, entry_id),
        )
        if reviewer:
            self._conn.execute(
                "UPDATE knowledge_entries SET reviewer = ? WHERE id = ?",
                (reviewer, entry_id),
            )
        self._conn.commit()
        return {"entry_id": entry_id, "review_status": status}

    def grant_role(self, user_id: str, role: str,
                   scope: str = "global") -> dict[str, Any]:
        """Grant a role to a user."""
        if role not in VALID_ROLES:
            return {"error": f"Invalid role. Valid: {VALID_ROLES}"}
        self._conn.execute(
            """INSERT OR IGNORE INTO rbac_roles (user_id, role, scope)
               VALUES (?, ?, ?)""",
            (user_id, role, scope),
        )
        self._conn.commit()
        return {"user_id": user_id, "role": role, "scope": scope}

    def revoke_role(self, user_id: str, role: str,
                    scope: str = "global") -> dict[str, Any]:
        """Revoke a role from a user."""
        self._conn.execute(
            "DELETE FROM rbac_roles WHERE user_id = ? AND role = ? AND scope = ?",
            (user_id, role, scope),
        )
        self._conn.commit()
        return {"user_id": user_id, "role": role, "revoked": True}

    def get_user_roles(self, user_id: str) -> list[dict[str, Any]]:
        """Get all roles for a user."""
        cur = self._conn.execute(
            "SELECT * FROM rbac_roles WHERE user_id = ?", (user_id,)
        )
        return [dict(row) for row in cur.fetchall()]

    def check_permission(self, user_id: str, action: str,
                         entry_id: int | None = None) -> bool:
        """Check if user has permission for an action."""
        roles = self.get_user_roles(user_id)
        role_names = {r["role"] for r in roles}

        if "admin" in role_names:
            return True
        if action in ("read", "search"):
            return True  # All roles can read
        if action in ("edit", "ingest") and "editor" in role_names:
            return True
        if action == "review" and "reviewer" in role_names:
            return True
        if action == "edit" and entry_id:
            entry = self._get_entry_owner(entry_id)
            if entry and entry == user_id:
                return True
        return False

    def get_entries_by_owner(self, owner: str, limit: int = 50) -> list[dict[str, Any]]:
        """Get entries owned by a specific user."""
        cur = self._conn.execute(
            """SELECT id, summary, type, tier, review_status, updated_at
               FROM knowledge_entries WHERE owner = ?
               ORDER BY updated_at DESC LIMIT ?""",
            (owner, limit),
        )
        return [dict(row) for row in cur.fetchall()]

    def _get_entry_owner(self, entry_id: int) -> str | None:
        """Get owner of an entry."""
        cur = self._conn.execute(
            "SELECT owner FROM knowledge_entries WHERE id = ?", (entry_id,)
        )
        row = cur.fetchone()
        return row["owner"] if row else None

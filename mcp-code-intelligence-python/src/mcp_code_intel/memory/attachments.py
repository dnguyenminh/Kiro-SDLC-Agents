"""KSA-75: Rich Media Support (Attachments)."""

import mimetypes
import os
import sqlite3
from typing import Any


class AttachmentManager:
    """Manage file attachments for knowledge entries."""

    def __init__(self, conn: sqlite3.Connection, workspace: str = "") -> None:
        self._conn = conn
        self._workspace = workspace

    def attach(self, entry_id: int, file_path: str,
               description: str | None = None) -> dict[str, Any]:
        """Attach a file to a knowledge entry."""
        resolved = self._resolve_path(file_path)
        if not os.path.exists(resolved):
            return {"error": f"File not found: {resolved}"}

        file_name = os.path.basename(resolved)
        mime_type = mimetypes.guess_type(resolved)[0] or "application/octet-stream"
        file_size = os.path.getsize(resolved)

        cur = self._conn.execute(
            """INSERT INTO entry_attachments
               (entry_id, file_path, file_name, mime_type, file_size, description)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (entry_id, file_path, file_name, mime_type, file_size, description),
        )
        self._conn.commit()
        return {
            "id": cur.lastrowid,
            "entry_id": entry_id,
            "file_name": file_name,
            "mime_type": mime_type,
            "file_size": file_size,
        }

    def list_attachments(self, entry_id: int) -> list[dict[str, Any]]:
        """List all attachments for an entry."""
        cur = self._conn.execute(
            "SELECT * FROM entry_attachments WHERE entry_id = ? ORDER BY attached_at",
            (entry_id,),
        )
        return [dict(row) for row in cur.fetchall()]

    def remove_attachment(self, attachment_id: int) -> dict[str, Any]:
        """Remove an attachment by ID."""
        cur = self._conn.execute(
            "SELECT file_name FROM entry_attachments WHERE id = ?",
            (attachment_id,),
        )
        row = cur.fetchone()
        if not row:
            return {"error": f"Attachment {attachment_id} not found"}

        self._conn.execute(
            "DELETE FROM entry_attachments WHERE id = ?", (attachment_id,)
        )
        self._conn.commit()
        return {"deleted": attachment_id, "file_name": row["file_name"]}

    def get_attachment(self, attachment_id: int) -> dict[str, Any] | None:
        """Get attachment metadata by ID."""
        cur = self._conn.execute(
            "SELECT * FROM entry_attachments WHERE id = ?", (attachment_id,)
        )
        row = cur.fetchone()
        return dict(row) if row else None

    def search_by_type(self, mime_prefix: str,
                       limit: int = 20) -> list[dict[str, Any]]:
        """Search attachments by MIME type prefix (e.g., 'image/')."""
        cur = self._conn.execute(
            """SELECT ea.*, ke.summary as entry_summary
               FROM entry_attachments ea
               JOIN knowledge_entries ke ON ea.entry_id = ke.id
               WHERE ea.mime_type LIKE ?
               ORDER BY ea.attached_at DESC LIMIT ?""",
            (f"{mime_prefix}%", limit),
        )
        return [dict(row) for row in cur.fetchall()]

    def _resolve_path(self, file_path: str) -> str:
        """Resolve file path relative to workspace."""
        if os.path.isabs(file_path):
            return file_path
        if self._workspace:
            return os.path.join(self._workspace, file_path)
        return os.path.abspath(file_path)

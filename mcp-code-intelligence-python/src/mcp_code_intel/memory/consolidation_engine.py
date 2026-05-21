"""KSA-69: Real Consolidation Engine — Promote/Demote/Merge with dry-run."""

import json
import sqlite3
from datetime import datetime, timedelta
from typing import Any


# Demotion thresholds (new — previously only promotion existed)
DEMOTION_THRESHOLDS = {
    "PROCEDURAL_TO_SEMANTIC": {"days_inactive": 90, "min_access": 25},
    "SEMANTIC_TO_EPISODIC": {"days_inactive": 60, "min_access": 10},
    "EPISODIC_TO_WORKING": {"days_inactive": 30, "min_access": 3},
}

PROMOTION_THRESHOLDS = {
    "WORKING_TO_EPISODIC": {"access": 3, "confidence": 0.7},
    "EPISODIC_TO_SEMANTIC": {"access": 10, "confidence": 0.85},
    "SEMANTIC_TO_PROCEDURAL": {"access": 25, "confidence": 0.95},
}


class RealConsolidationEngine:
    """Full consolidation: promote, demote, merge with dry-run support."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def consolidate(self, dry_run: bool = False) -> dict[str, Any]:
        """Run full consolidation cycle with promote + demote + merge."""
        promoted = self._promote_eligible(dry_run)
        demoted = self._demote_inactive(dry_run)
        merged = self._merge_duplicates(dry_run)
        return {
            "promoted": promoted,
            "demoted": demoted,
            "merged": merged,
            "dry_run": dry_run,
        }

    def merge_entries(self, survivor_id: int, merge_ids: list[int],
                      strategy: str = "append", merged_by: str | None = None,
                      dry_run: bool = False) -> dict[str, Any]:
        """Merge multiple entries into one survivor."""
        survivor = self._get_entry(survivor_id)
        if not survivor:
            return {"error": f"Survivor {survivor_id} not found"}

        entries_to_merge = []
        for mid in merge_ids:
            entry = self._get_entry(mid)
            if entry:
                entries_to_merge.append(entry)

        if not entries_to_merge:
            return {"error": "No valid entries to merge"}

        if dry_run:
            return {
                "action": "merge",
                "survivor_id": survivor_id,
                "merge_count": len(entries_to_merge),
                "strategy": strategy,
                "dry_run": True,
            }

        merged_content = self._apply_merge_strategy(
            survivor, entries_to_merge, strategy
        )
        total_access = survivor["access_count"] + sum(
            e["access_count"] for e in entries_to_merge
        )

        self._conn.execute(
            """UPDATE knowledge_entries
               SET content = ?, access_count = ?, updated_at = datetime('now')
               WHERE id = ?""",
            (merged_content, total_access, survivor_id),
        )

        merged_id_list = json.dumps(merge_ids)
        self._conn.execute(
            """INSERT INTO merge_history (survivor_id, merged_ids, strategy, merged_by)
               VALUES (?, ?, ?, ?)""",
            (survivor_id, merged_id_list, strategy, merged_by),
        )

        for mid in merge_ids:
            self._conn.execute(
                "DELETE FROM knowledge_entries WHERE id = ?", (mid,)
            )

        self._conn.commit()
        return {
            "survivor_id": survivor_id,
            "merged_count": len(entries_to_merge),
            "strategy": strategy,
            "new_access_count": total_access,
        }

    def _promote_eligible(self, dry_run: bool) -> list[dict[str, Any]]:
        """Promote entries that meet threshold criteria."""
        results = []
        for key, thresh in PROMOTION_THRESHOLDS.items():
            from_tier, to_tier = key.split("_TO_")
            candidates = self._find_candidates(
                from_tier, thresh["access"], thresh["confidence"]
            )
            for entry_id in candidates:
                if not dry_run:
                    self._transition(entry_id, from_tier, to_tier, "auto:promote")
                results.append({
                    "entry_id": entry_id,
                    "from": from_tier,
                    "to": to_tier,
                    "reason": "threshold_met",
                })
        return results

    def _demote_inactive(self, dry_run: bool) -> list[dict[str, Any]]:
        """Demote entries that haven't been accessed recently."""
        results = []
        now = datetime.utcnow()
        for key, thresh in DEMOTION_THRESHOLDS.items():
            from_tier, to_tier = key.split("_TO_")
            cutoff = (now - timedelta(days=thresh["days_inactive"])).isoformat()
            cur = self._conn.execute(
                """SELECT id FROM knowledge_entries
                   WHERE tier = ? AND (last_accessed_at IS NULL OR last_accessed_at < ?)
                   AND access_count < ?""",
                (from_tier, cutoff, thresh["min_access"]),
            )
            for (entry_id,) in cur.fetchall():
                if not dry_run:
                    self._transition(entry_id, from_tier, to_tier, "auto:demote_inactive")
                results.append({
                    "entry_id": entry_id,
                    "from": from_tier,
                    "to": to_tier,
                    "reason": "inactive",
                })
        return results

    def _merge_duplicates(self, dry_run: bool) -> list[dict[str, Any]]:
        """Find and merge near-duplicate entries (same summary, same type)."""
        cur = self._conn.execute(
            """SELECT summary, type, GROUP_CONCAT(id) as ids, COUNT(*) as cnt
               FROM knowledge_entries
               WHERE archived_at IS NULL
               GROUP BY summary, type
               HAVING cnt > 1
               LIMIT 20"""
        )
        results = []
        for row in cur.fetchall():
            ids = [int(x) for x in row["ids"].split(",")]
            survivor_id = ids[0]
            merge_ids = ids[1:]
            if not dry_run:
                self.merge_entries(survivor_id, merge_ids, "append")
            results.append({
                "survivor_id": survivor_id,
                "merged_ids": merge_ids,
                "summary": row["summary"][:60],
            })
        return results

    def _find_candidates(self, tier: str, min_access: int,
                         min_confidence: float) -> list[int]:
        """Find entries eligible for promotion."""
        cur = self._conn.execute(
            """SELECT id FROM knowledge_entries
               WHERE tier = ? AND access_count >= ? AND confidence >= ?
               AND archived_at IS NULL""",
            (tier, min_access, min_confidence),
        )
        return [row[0] for row in cur.fetchall()]

    def _transition(self, entry_id: int, from_tier: str,
                    to_tier: str, reason: str) -> None:
        """Execute tier transition."""
        self._conn.execute(
            "UPDATE knowledge_entries SET tier = ?, updated_at = datetime('now') WHERE id = ?",
            (to_tier, entry_id),
        )
        self._conn.execute(
            """INSERT INTO consolidation_log (entry_id, from_tier, to_tier, reason)
               VALUES (?, ?, ?, ?)""",
            (entry_id, from_tier, to_tier, reason),
        )
        self._conn.commit()

    def _get_entry(self, entry_id: int) -> dict[str, Any] | None:
        """Get entry by ID."""
        cur = self._conn.execute(
            "SELECT * FROM knowledge_entries WHERE id = ?", (entry_id,)
        )
        row = cur.fetchone()
        return dict(row) if row else None

    @staticmethod
    def _apply_merge_strategy(survivor: dict, entries: list[dict],
                              strategy: str) -> str:
        """Apply merge strategy to combine content."""
        if strategy == "append":
            parts = [survivor["content"]]
            for e in entries:
                parts.append(f"\n---\n[Merged from #{e['id']}]\n{e['content']}")
            return "\n".join(parts)
        if strategy == "newest":
            all_entries = [survivor] + entries
            newest = max(all_entries, key=lambda x: x["updated_at"])
            return newest["content"]
        return survivor["content"]

"""MemoryEngine V2 — extends base engine with KB Enhancement modules."""

import sqlite3
import sys
from typing import Any

from .engine import MemoryEngine
from .schema_v2 import SCHEMA_V2_TABLES, SCHEMA_V2_ALTER_COLUMNS, SCHEMA_V2_INDEXES
from .consolidation_engine import RealConsolidationEngine
from .staleness import StalenessDetector
from .rbac import RBACManager
from .templates import TemplateEngine
from .attachments import AttachmentManager
from .suggestions import SuggestionEngine
from .tag_taxonomy import TagTaxonomyManager
from .search_analytics import SearchAnalytics
from .citations import CitationTracker
from .feedback import FeedbackManager
from .review_reminders import ReviewReminderEngine
from .quality_scoring import QualityScorer
from .confidence_scoring import ConfidenceScorer
from .health_dashboard import HealthDashboard


class MemoryEngineV2(MemoryEngine):
    """Extended engine with all KB Enhancement features."""

    def __init__(self, conn: sqlite3.Connection, workspace: str = "") -> None:
        super().__init__(conn)
        self._apply_v2_schema()

        # KSA-69: Real Consolidation
        self.consolidation_engine = RealConsolidationEngine(conn)
        # KSA-70: Staleness Detection
        self.staleness = StalenessDetector(conn)
        # KSA-71: RBAC
        self.rbac = RBACManager(conn)
        # KSA-72: Review Reminders
        self.review_reminders = ReviewReminderEngine(conn)
        # KSA-73: Templates
        self.templates = TemplateEngine(conn)
        # KSA-74: Quality Scoring
        self.quality_scorer = QualityScorer(conn)
        # KSA-75: Attachments
        self.attachments = AttachmentManager(conn, workspace)
        # KSA-76: Suggestions
        self.suggestions = SuggestionEngine(conn)
        # KSA-77: Tag Taxonomy
        self.tag_taxonomy = TagTaxonomyManager(conn)
        # KSA-78: Search Analytics
        self.search_analytics = SearchAnalytics(conn)
        # KSA-79: Citations
        self.citation_tracker = CitationTracker(conn)
        # KSA-80: Confidence Scoring
        self.confidence_scorer = ConfidenceScorer(conn)
        # KSA-81: Feedback
        self.feedback = FeedbackManager(conn)
        # KSA-84: Health Dashboard
        self.health_dashboard = HealthDashboard(conn)

    def get_stats(self) -> dict[str, Any]:
        """Extended stats with V2 metrics."""
        base = super().get_stats()
        base["citations_total"] = self._count("citations")
        base["feedback_total"] = self._count("entry_feedback")
        base["tags_total"] = self._count("tag_taxonomy")
        base["attachments_total"] = self._count("entry_attachments")
        base["templates_total"] = self._count("content_templates")
        base["quality_scored"] = self._count("quality_scores")
        base["reminders_active"] = self._count_where(
            "review_reminders", "is_active = 1"
        )
        base["archived_entries"] = self._count_where(
            "knowledge_entries", "archived_at IS NOT NULL"
        )
        return base

    def _apply_v2_schema(self) -> None:
        """Apply V2 schema migration (idempotent)."""
        # Step 1: Create new tables (IF NOT EXISTS = safe to re-run)
        self._conn.executescript(SCHEMA_V2_TABLES)

        # Step 2: Add columns to knowledge_entries (may fail if exists)
        for alter_stmt in SCHEMA_V2_ALTER_COLUMNS:
            try:
                self._conn.execute(alter_stmt)
            except sqlite3.OperationalError:
                pass  # Column already exists

        # Step 3: Create indexes (IF NOT EXISTS = safe)
        self._conn.executescript(SCHEMA_V2_INDEXES)

        self._conn.commit()
        _log("V2 schema applied")

    def _count(self, table: str) -> int:
        """Count rows in a table."""
        try:
            cur = self._conn.execute(f"SELECT COUNT(*) FROM {table}")
            return cur.fetchone()[0]
        except sqlite3.OperationalError:
            return 0

    def _count_where(self, table: str, where: str) -> int:
        """Count rows with condition."""
        try:
            cur = self._conn.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}")
            return cur.fetchone()[0]
        except sqlite3.OperationalError:
            return 0


def _log(msg: str) -> None:
    print(f"[memory-v2] {msg}", file=sys.stderr, flush=True)

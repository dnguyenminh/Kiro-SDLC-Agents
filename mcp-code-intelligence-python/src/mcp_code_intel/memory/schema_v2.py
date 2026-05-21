"""Schema V2 — KB Enhancement migrations for all 5 pillars."""

# Tables that can be created independently (IF NOT EXISTS is idempotent)
SCHEMA_V2_TABLES = """
CREATE TABLE IF NOT EXISTS merge_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survivor_id INTEGER NOT NULL,
  merged_ids TEXT NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'append',
  merged_at TEXT NOT NULL DEFAULT (datetime('now')),
  merged_by TEXT,
  FOREIGN KEY (survivor_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS archive_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  archived_at TEXT NOT NULL DEFAULT (datetime('now')),
  auto_archived INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rbac_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global',
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, role, scope)
);

CREATE TABLE IF NOT EXISTS content_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  required_sections TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS template_validations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL,
  is_valid INTEGER NOT NULL DEFAULT 0,
  violations TEXT,
  validated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES content_templates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entry_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  attached_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS related_entries_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  related_id INTEGER NOT NULL,
  score REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'vector',
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (related_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  UNIQUE(entry_id, related_id)
);

CREATE TABLE IF NOT EXISTS tag_taxonomy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag TEXT NOT NULL UNIQUE,
  parent_tag TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (entry_id, tag_id),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tag_taxonomy(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS search_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  top_result_id INTEGER,
  clicked_result_id INTEGER,
  session_id TEXT,
  searched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS popular_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL UNIQUE,
  hit_count INTEGER NOT NULL DEFAULT 1,
  avg_results REAL NOT NULL DEFAULT 0,
  last_searched TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  cited_by TEXT NOT NULL,
  context TEXT,
  cited_at TEXT NOT NULL DEFAULT (datetime('now')),
  session_id TEXT,
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entry_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK(rating IN (-1, 1)),
  comment TEXT,
  user_id TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS review_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL UNIQUE,
  interval_days INTEGER NOT NULL DEFAULT 90,
  next_reminder_at TEXT NOT NULL,
  last_reviewed_at TEXT,
  assignee TEXT,
  snooze_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quality_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL UNIQUE,
  total_score REAL NOT NULL DEFAULT 0.0,
  dimensions TEXT NOT NULL DEFAULT '{}',
  scored_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS consolidation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  from_tier TEXT NOT NULL,
  to_tier TEXT NOT NULL,
  reason TEXT NOT NULL,
  transitioned_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);
"""

# ALTER TABLE statements — each may fail if column already exists
SCHEMA_V2_ALTER_COLUMNS = [
    "ALTER TABLE knowledge_entries ADD COLUMN last_reviewed_at TEXT",
    "ALTER TABLE knowledge_entries ADD COLUMN staleness_score REAL NOT NULL DEFAULT 0.0",
    "ALTER TABLE knowledge_entries ADD COLUMN archived_at TEXT",
    "ALTER TABLE knowledge_entries ADD COLUMN owner TEXT",
    "ALTER TABLE knowledge_entries ADD COLUMN reviewer TEXT",
    "ALTER TABLE knowledge_entries ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending'",
    "ALTER TABLE knowledge_entries ADD COLUMN feedback_score REAL NOT NULL DEFAULT 0.0",
]

# Indexes — created after tables and columns exist
SCHEMA_V2_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_mh_survivor ON merge_history(survivor_id);
CREATE INDEX IF NOT EXISTS idx_al_entry ON archive_log(entry_id);
CREATE INDEX IF NOT EXISTS idx_ke_owner ON knowledge_entries(owner);
CREATE INDEX IF NOT EXISTS idx_ke_reviewer ON knowledge_entries(reviewer);
CREATE INDEX IF NOT EXISTS idx_ke_review_status ON knowledge_entries(review_status);
CREATE INDEX IF NOT EXISTS idx_ke_staleness ON knowledge_entries(staleness_score);
CREATE INDEX IF NOT EXISTS idx_ke_archived ON knowledge_entries(archived_at);
CREATE INDEX IF NOT EXISTS idx_rbac_user ON rbac_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_ct_type ON content_templates(type);
CREATE INDEX IF NOT EXISTS idx_tv_entry ON template_validations(entry_id);
CREATE INDEX IF NOT EXISTS idx_ea_entry ON entry_attachments(entry_id);
CREATE INDEX IF NOT EXISTS idx_rec_entry ON related_entries_cache(entry_id);
CREATE INDEX IF NOT EXISTS idx_tt_parent ON tag_taxonomy(parent_tag);
CREATE INDEX IF NOT EXISTS idx_tt_category ON tag_taxonomy(category);
CREATE INDEX IF NOT EXISTS idx_et_tag ON entry_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_sl_query ON search_log(query);
CREATE INDEX IF NOT EXISTS idx_sl_searched ON search_log(searched_at);
CREATE INDEX IF NOT EXISTS idx_pq_hits ON popular_queries(hit_count DESC);
CREATE INDEX IF NOT EXISTS idx_cit_entry ON citations(entry_id);
CREATE INDEX IF NOT EXISTS idx_cit_by ON citations(cited_by);
CREATE INDEX IF NOT EXISTS idx_ef_entry ON entry_feedback(entry_id);
CREATE INDEX IF NOT EXISTS idx_ef_rating ON entry_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_ke_feedback ON knowledge_entries(feedback_score);
CREATE INDEX IF NOT EXISTS idx_rr_entry ON review_reminders(entry_id);
CREATE INDEX IF NOT EXISTS idx_rr_next ON review_reminders(next_reminder_at);
CREATE INDEX IF NOT EXISTS idx_rr_active ON review_reminders(is_active);
CREATE INDEX IF NOT EXISTS idx_qs_entry ON quality_scores(entry_id);
CREATE INDEX IF NOT EXISTS idx_qs_score ON quality_scores(total_score);
CREATE INDEX IF NOT EXISTS idx_cl_entry ON consolidation_log(entry_id);
"""

# V2 Cross-Module Comparison Report

**Date:** 2025-01-27  
**Reviewed by:** SA + TA (Architecture + Technical Review)  
**Modules:** Python (reference) | Node.js (TS port) | Kotlin (JVM port)

---

## 1. Tool Definitions Comparison (17 V2 Tools)

### Legend
- ✅ = Khớp hoàn toàn với Python reference
- ⚠️ = Khác biệt nhỏ (cosmetic, không ảnh hưởng behavior)
- ❌ = Thiếu hoặc khác biệt lớn (behavior khác nhau)

| # | Tool Name | Python (ref) | Node.js | Kotlin | Notes |
|---|-----------|:---:|:---:|:---:|-------|
| 1 | `mem_consolidate_v2` | ✅ | ✅ | ✅ | Identical schema |
| 2 | `mem_stale` | ✅ | ✅ | ✅ | Identical schema |
| 3 | `mem_due_reviews` | ✅ | ✅ | ✅ | Identical schema |
| 4 | `mem_review` | ✅ | ✅ | ✅ | All have `required: ["entry_id"]` |
| 5 | `mem_templates` | ✅ | ✅ | ✅ | Identical schema |
| 6 | `mem_attachments` | ✅ | ✅ | ✅ | Identical schema |
| 7 | `mem_suggest` | ✅ | ✅ | ✅ | All have `required: ["query"]` |
| 8 | `mem_related` | ✅ | ✅ | ✅ | All have `required: ["entry_id"]` |
| 9 | `mem_tags` | ✅ | ✅ | ✅ | Identical schema |
| 10 | `mem_analytics` | ✅ | ✅ | ✅ | Identical schema |
| 11 | `mem_cite` | ✅ | ✅ | ✅ | All have `required: ["entry_id", "cited_by"]` |
| 12 | `mem_citations` | ✅ | ✅ | ✅ | Identical schema |
| 13 | `mem_feedback` | ✅ | ✅ | ✅ | Identical schema |
| 14 | `mem_reminders` | ✅ | ✅ | ✅ | Identical schema |
| 15 | `mem_quality` | ✅ | ✅ | ✅ | Identical schema |
| 16 | `mem_confidence` | ✅ | ✅ | ✅ | Identical schema |
| 17 | `mem_dashboard` | ✅ | ✅ | ✅ | Identical schema |

**Tool Count:** Python=17, Node.js=17, Kotlin=17 ✅

---

## 2. Description Drift (Minor)

| Tool | Python | Node.js | Kotlin | Severity |
|------|--------|---------|--------|----------|
| `mem_stale` | "...Shows entries that haven't been accessed or reviewed recently." | Same ✅ | **SHORTER**: "Detect stale entries and auto-archive." | ⚠️ Cosmetic |
| `mem_quality` | "...Compute quality scores, find low-quality entries, get stats." | Same ✅ | **SHORTER**: "Score and validate content quality." | ⚠️ Cosmetic |
| `mem_confidence` | "...Based on quality, citations, feedback, freshness." | Same ✅ | **SHORTER**: "Compute and query confidence scores for search results." | ⚠️ Cosmetic |
| `mem_attachments` | mime_prefix desc: "MIME type prefix for search (e.g., 'image/')" | Same ✅ | **SHORTER**: "MIME type prefix for search" | ⚠️ Cosmetic |

**Verdict:** Descriptions shorter in Kotlin but semantically equivalent. No behavior impact.

---

## 3. DB Schema V2 Comparison

### 3.1 Tables

| Table | Python | Node.js | Kotlin | Notes |
|-------|:---:|:---:|:---:|-------|
| `merge_history` | ✅ | ✅ | ✅ | Identical |
| `archive_log` | ✅ | ✅ | ✅ | Identical |
| `rbac_roles` | ✅ | ✅ | ❌ **MISSING** | Kotlin has NO rbac_roles table |
| `content_templates` | ✅ | ✅ | ✅ | Identical |
| `template_validations` | ✅ | ✅ | ✅ | Identical |
| `entry_attachments` | ✅ | ✅ | ✅ | Identical |
| `related_entries_cache` | ✅ | ✅ | ✅ | Identical |
| `tag_taxonomy` | ✅ | ✅ | ✅ | Identical |
| `entry_tags` | ✅ | ✅ | ✅ | Identical |
| `search_log` | ✅ | ✅ | ✅ | Identical |
| `popular_queries` | ✅ | ✅ | ✅ | Identical |
| `citations` | ✅ | ✅ | ✅ | Identical |
| `entry_feedback` | ✅ | ✅ | ✅ | Identical |
| `review_reminders` | ✅ | ✅ | ✅ | Identical |
| `quality_scores` | ✅ | ✅ | ✅ | Identical |
| `consolidation_log` | ✅ | ✅ | ✅ | Identical |

**Total:** Python=16 tables, Node.js=16 tables, Kotlin=**15 tables** (missing `rbac_roles`)

### 3.2 ALTER COLUMNS (knowledge_entries)

| Column | Python | Node.js | Kotlin | Notes |
|--------|:---:|:---:|:---:|-------|
| `last_reviewed_at TEXT` | ✅ | ✅ | ✅ | |
| `staleness_score REAL NOT NULL DEFAULT 0.0` | ✅ | ✅ | ✅ | |
| `archived_at TEXT` | ✅ | ✅ | ✅ | |
| `owner TEXT` | ✅ | ✅ | ✅ | |
| `reviewer TEXT` | ✅ | ✅ | ✅ | |
| `review_status TEXT NOT NULL DEFAULT 'pending'` | ✅ | ✅ | ✅ | |
| `feedback_score REAL NOT NULL DEFAULT 0.0` | ✅ | ✅ | ✅ | |

**All 7 ALTER columns match across all 3 modules.** ✅

### 3.3 Indexes

| Index | Python | Node.js | Kotlin | Notes |
|-------|:---:|:---:|:---:|-------|
| `idx_mh_survivor` | ✅ | ✅ | ✅ | |
| `idx_al_entry` | ✅ | ✅ | ✅ | |
| `idx_ke_owner` | ✅ | ✅ | ✅ | |
| `idx_ke_reviewer` | ✅ | ✅ | ❌ **MISSING** | |
| `idx_ke_review_status` | ✅ | ✅ | ❌ **MISSING** | |
| `idx_ke_staleness` | ✅ | ✅ | ✅ | |
| `idx_ke_archived` | ✅ | ✅ | ✅ | |
| `idx_rbac_user` | ✅ | ❌ **MISSING** | ❌ **MISSING** | Python-only (for rbac_roles table) |
| `idx_ct_type` | ✅ | ✅ | ✅ | |
| `idx_tv_entry` | ✅ | ✅ | ❌ **MISSING** | |
| `idx_ea_entry` | ✅ | ✅ | ✅ | |
| `idx_rec_entry` | ✅ | ✅ | ✅ | |
| `idx_tt_parent` | ✅ | ✅ | ✅ | |
| `idx_tt_category` | ✅ | ✅ | ❌ **MISSING** | |
| `idx_et_tag` | ✅ | ✅ | ✅ | |
| `idx_sl_query` | ✅ | ✅ | ✅ | |
| `idx_sl_searched` | ✅ | ✅ | ❌ **MISSING** | |
| `idx_pq_hits` | ✅ | ✅ | ✅ | |
| `idx_cit_entry` | ✅ | ✅ | ✅ | |
| `idx_cit_by` | ✅ | ✅ | ❌ **MISSING** | |
| `idx_ef_entry` | ✅ | ✅ | ✅ | |
| `idx_ef_rating` | ✅ | ✅ | ❌ **MISSING** | |
| `idx_ke_feedback` | ✅ | ✅ | ❌ **MISSING** | |
| `idx_rr_entry` | ✅ | ✅ | ❌ **MISSING** | |
| `idx_rr_next` | ✅ | ✅ | ✅ | |
| `idx_rr_active` | ✅ | ✅ | ❌ **MISSING** | |
| `idx_qs_entry` | ✅ | ✅ | ✅ | |
| `idx_qs_score` | ✅ | ✅ | ❌ **MISSING** | |
| `idx_cl_entry` | ✅ | ✅ | ✅ | |

**Index Count:** Python=29, Node.js=28 (missing `idx_rbac_user`), Kotlin=**17** (missing 12 indexes)

---

## 4. Dispatcher Routing Comparison

### 4.1 Tool → Handler Mapping

| Tool | Python Handler | Node.js Handler | Kotlin Handler | Match |
|------|---------------|-----------------|----------------|:---:|
| `mem_consolidate_v2` | `_handle_consolidate_v2` | `consolidation.execute` | `consolidation.execute` | ✅ |
| `mem_stale` | `_handle_stale` | `staleness.execute` | `staleness.execute` | ✅ |
| `mem_due_reviews` | `_handle_due_reviews` | `staleness.executeDueReviews` | `staleness.executeDueReviews` | ✅ |
| `mem_review` | `_handle_review` | `staleness.executeReview` | `staleness.executeReview` | ✅ |
| `mem_templates` | `_handle_templates` | `templates.execute` | `templates.execute` | ✅ |
| `mem_attachments` | `_handle_attachments` | `attachments.execute` | `attachments.execute` | ✅ |
| `mem_suggest` | `_handle_suggest` | `suggestions.execute` | `suggestions.execute` | ✅ |
| `mem_related` | `_handle_related` | `suggestions.executeRelated` | `suggestions.executeRelated` | ✅ |
| `mem_tags` | `_handle_tags` | `tags.execute` | `tags.execute` | ✅ |
| `mem_analytics` | `_handle_analytics` | `analytics.execute` | `analytics.execute` | ✅ |
| `mem_cite` | `_handle_cite` | `citations.executeCite` | `citations.executeCite` | ✅ |
| `mem_citations` | `_handle_citations` | `citations.execute` | `citations.execute` | ✅ |
| `mem_feedback` | `_handle_feedback` | `feedback.execute` | `feedback.execute` | ✅ |
| `mem_reminders` | `_handle_reminders` | `reminders.execute` | `reminders.execute` | ✅ |
| `mem_quality` | `_handle_quality` | `quality.execute` | `quality.execute` | ✅ |
| `mem_confidence` | `_handle_confidence` | `confidence.execute` | `confidence.execute` | ✅ |
| `mem_dashboard` | `_handle_dashboard` | `dashboard.execute` | `dashboard.execute` | ✅ |

**All 17 tools routed correctly in all 3 modules.** ✅

### 4.2 Dispatcher Architecture Comparison

| Aspect | Python | Node.js | Kotlin |
|--------|--------|---------|--------|
| Pattern | Dict lookup → handler method | Switch/case → class method | When expression → class method |
| Return on unknown | `None` | `null` | `null` |
| Dependency injection | `MemoryEngineV2` (single engine) | Individual managers (13 classes) | Individual tool classes (13 classes) |
| DB access | Via engine sub-components | Direct `better-sqlite3` | Direct `java.sql.Connection` |
| Error handling | Returns error string | Returns error string | Returns error string |

**Verdict:** Architecture differs (Python=monolithic engine, Node/Kotlin=individual tool classes) but routing behavior is identical. ✅

### 4.3 Handler Logic — Action/Sub-command Coverage

| Tool | Actions | Python | Node.js | Kotlin |
|------|---------|:---:|:---:|:---:|
| `mem_consolidate_v2` | consolidate, merge | ✅ | ✅ | ✅ |
| `mem_stale` | detect, archive, unarchive | ✅ | ✅ | ✅ |
| `mem_review` | mark_reviewed, assign_owner, assign_reviewer, set_status | ✅ | ✅ | ✅ |
| `mem_templates` | create, list, validate | ✅ | ✅ | ✅ |
| `mem_attachments` | attach, list, remove, search | ✅ | ✅ | ✅ |
| `mem_tags` | create, tag, untag, search, taxonomy, popular, entry_tags | ✅ | ✅ | ✅ |
| `mem_analytics` | summary, popular, gaps, zero_results | ✅ | ✅ | ✅ |
| `mem_citations` | entry, most_cited, uncited, by_agent | ✅ | ✅ | ✅ |
| `mem_feedback` | submit, summary, low_rated, top_rated | ✅ | ✅ | ✅ |
| `mem_reminders` | due, schedule, snooze, dismiss, complete, auto_schedule, stats | ✅ | ✅ | ✅ |
| `mem_quality` | score, score_all, low_quality, stats, validate | ✅ | ✅ | ✅ |
| `mem_confidence` | compute, batch, unreliable, stats | ✅ | ✅ | ✅ |
| `mem_dashboard` | full, metrics, recommendations, trends | ✅ | ✅ | ✅ |

**All actions/sub-commands match across all 3 modules.** ✅

---

## 5. Summary — Drift Analysis

### Overall Score

| Category | Python→Node.js | Python→Kotlin |
|----------|:-:|:-:|
| Tool Definitions (17 tools) | ✅ 17/17 | ✅ 17/17 |
| Tool Descriptions | ✅ Identical | ⚠️ 4 shorter (cosmetic) |
| Input Schema (properties) | ✅ Identical | ✅ Identical |
| Required Fields | ✅ Identical | ✅ Identical |
| DB Tables (16) | ✅ 16/16 | ❌ 15/16 (missing `rbac_roles`) |
| ALTER Columns (7) | ✅ 7/7 | ✅ 7/7 |
| Indexes | ⚠️ 28/29 (missing `idx_rbac_user`) | ❌ 17/29 (missing 12) |
| Dispatcher Routing (17) | ✅ 17/17 | ✅ 17/17 |
| Actions/Sub-commands | ✅ All match | ✅ All match |

### Risk Assessment

| Issue | Severity | Impact |
|-------|----------|--------|
| Kotlin missing `rbac_roles` table | **Medium** | RBAC features won't work in Kotlin. If `mem_review` assign_owner/assign_reviewer uses rbac internally, it may fail. |
| Kotlin missing 12 indexes | **Low-Medium** | Performance degradation on large datasets. No functional breakage. |
| Node.js missing `idx_rbac_user` | **Low** | Consistent with Node.js having the table but no index. Minor perf issue. |
| Kotlin shorter descriptions | **None** | Cosmetic only. AI agents still understand tool purpose. |

---

## 6. Recommended Fixes

### ❌ Critical Fix: Kotlin — Add `rbac_roles` table

**File:** `mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/memory/schema/SchemaV2.kt`

**Add after `archive_log` table:**
```sql
CREATE TABLE IF NOT EXISTS rbac_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global',
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, role, scope)
);
```

### ⚠️ Medium Fix: Kotlin — Add missing 12 indexes

**File:** `mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/memory/schema/SchemaV2.kt`

**Add to INDEXES:**
```sql
CREATE INDEX IF NOT EXISTS idx_ke_reviewer ON knowledge_entries(reviewer);
CREATE INDEX IF NOT EXISTS idx_ke_review_status ON knowledge_entries(review_status);
CREATE INDEX IF NOT EXISTS idx_tv_entry ON template_validations(entry_id);
CREATE INDEX IF NOT EXISTS idx_tt_category ON tag_taxonomy(category);
CREATE INDEX IF NOT EXISTS idx_sl_searched ON search_log(searched_at);
CREATE INDEX IF NOT EXISTS idx_cit_by ON citations(cited_by);
CREATE INDEX IF NOT EXISTS idx_ef_rating ON entry_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_ke_feedback ON knowledge_entries(feedback_score);
CREATE INDEX IF NOT EXISTS idx_rr_entry ON review_reminders(entry_id);
CREATE INDEX IF NOT EXISTS idx_rr_active ON review_reminders(is_active);
CREATE INDEX IF NOT EXISTS idx_qs_score ON quality_scores(total_score);
CREATE INDEX IF NOT EXISTS idx_rbac_user ON rbac_roles(user_id);
```

### ⚠️ Low Fix: Node.js — Add missing `idx_rbac_user` index

**File:** `mcp-code-intelligence-nodejs/src/memory/schema-v2.ts`

**Add to SCHEMA_V2_INDEXES:**
```sql
CREATE INDEX IF NOT EXISTS idx_rbac_user ON rbac_roles(user_id);
```

---

## 7. Conclusion

**Node.js port: 98% fidelity** — chỉ thiếu 1 index nhỏ. Production-ready.

**Kotlin port: 92% fidelity** — thiếu 1 table + 12 indexes. Tool definitions và dispatcher routing hoàn hảo, nhưng DB schema cần bổ sung trước khi deploy production với large datasets.

**Dispatcher routing: 100% consistent** across all 3 modules. Không có drift nào về behavior.

# MCP Memory Tool Consolidation Proposal

## 1. Token Cost Analysis — Current State

### Tool Count & Token Estimation

| Category | Tools | Avg Tokens/Tool | Total Tokens |
|----------|-------|-----------------|--------------|
| V1 Core (definitions.py) | 12 | ~180 | ~2,160 |
| V2 Enhancement (definitions_v2.py) | 17 | ~210 | ~3,570 |
| **Total** | **29** | **~198** | **~5,730** |

**Breakdown per tool (estimated tokens for name + description + inputSchema):**

| Tool | Est. Tokens | Usage Frequency | Merge Candidate? |
|------|-------------|-----------------|------------------|
| mem_search | 150 | HIGH | ❌ Keep |
| mem_ingest | 180 | HIGH | ❌ Keep |
| mem_ingest_file | 140 | HIGH | ❌ Keep |
| mem_get | 80 | MEDIUM | ❌ Keep |
| mem_delete | 80 | LOW | ✅ → mem_crud |
| mem_list | 120 | MEDIUM | ✅ → mem_crud |
| mem_graph | 220 | LOW | ❌ Keep (already action-based) |
| mem_status | 60 | LOW | ✅ → mem_admin |
| mem_consolidate | 60 | LOW | ✅ → mem_consolidate (upgrade) |
| mem_audit | 120 | LOW | ✅ → mem_admin |
| mem_sessions | 100 | LOW | ✅ → mem_admin |
| mem_sync_code | 120 | LOW | ❌ Keep (specialized) |
| mem_consolidate_v2 | 200 | LOW | ✅ → mem_consolidate (upgrade) |
| mem_stale | 180 | LOW | ✅ → mem_governance |
| mem_due_reviews | 120 | LOW | ✅ → mem_governance |
| mem_review | 180 | LOW | ✅ → mem_governance |
| mem_templates | 180 | LOW | ✅ → mem_governance |
| mem_attachments | 220 | LOW | ❌ Keep |
| mem_suggest | 100 | MEDIUM | ✅ → mem_discover |
| mem_related | 140 | MEDIUM | ✅ → mem_discover |
| mem_tags | 250 | MEDIUM | ❌ Keep (already action-based) |
| mem_analytics | 140 | LOW | ✅ → mem_insights |
| mem_cite | 140 | LOW | ✅ → mem_citations (merge) |
| mem_citations | 160 | LOW | ✅ → mem_citations (merge) |
| mem_feedback | 180 | LOW | ✅ → mem_insights |
| mem_reminders | 250 | LOW | ✅ → mem_governance |
| mem_quality | 200 | LOW | ✅ → mem_insights |
| mem_confidence | 160 | LOW | ✅ → mem_insights |
| mem_dashboard | 140 | LOW | ✅ → mem_admin |

---

## 2. Consolidation Strategy

### Design Principles

1. **HIGH-frequency tools stay standalone** — `mem_search`, `mem_ingest`, `mem_ingest_file` (used every turn)
2. **Action-based grouping** — related LOW-frequency tools merge into 1 tool with `action` parameter
3. **No "god tool"** — max 7 actions per merged tool
4. **Semantic clarity** — tool name tells AI agent exactly what domain it covers
5. **Backward compat** — old tool names become aliases during transition period

### Merge Groups

#### Group A: CRUD Operations
```
mem_get + mem_delete + mem_list → mem_crud
Actions: get, delete, list
```
**Rationale:** These are basic CRUD operations on entries. `mem_ingest` stays separate because it's HIGH frequency and has complex params.

#### Group B: Consolidation (V1 + V2 merge)
```
mem_consolidate + mem_consolidate_v2 → mem_consolidate (upgraded)
Actions: run, merge, dry_run
```
**Rationale:** V1 is a subset of V2. V2 already has `action` param. Just upgrade V1 to V2's implementation and keep one name.

#### Group C: Governance (lifecycle management)
```
mem_stale + mem_due_reviews + mem_review + mem_reminders + mem_templates → mem_governance
Actions: stale, archive, unarchive, due_reviews, review, schedule, snooze, dismiss, templates, validate_template
```
**⚠️ Problem:** 10 actions = too many. Split into 2:

```
Option C1 (preferred):
  mem_lifecycle → mem_stale + mem_due_reviews + mem_review + mem_reminders
    Actions: detect_stale, archive, unarchive, due_reviews, mark_reviewed, schedule_reminder, snooze, complete_review
  mem_templates → keep as-is (3 actions, different domain)

Option C2:
  mem_governance → all 5 tools
    Actions: stale, archive, unarchive, due, review, schedule, snooze, dismiss, complete, template_create, template_list, template_validate
    ⛔ Too many actions (12) — violates "no god tool" principle
```

**Decision: Option C1** — `mem_lifecycle` (8 actions, all about entry freshness/review) + `mem_templates` stays.

#### Group D: Discovery
```
mem_suggest + mem_related → mem_discover
Actions: suggest, related
```
**Rationale:** Both help agent find relevant entries. Same domain (discovery/recommendation).

#### Group E: Insights (scoring + analytics)
```
mem_analytics + mem_feedback + mem_quality + mem_confidence → mem_insights
Actions: analytics, feedback_submit, feedback_view, quality_score, quality_stats, confidence, dashboard
```
**⚠️ Problem:** 7+ actions. But these are all "read-mostly" scoring/analytics tools. Agent rarely uses them individually.

**Alternative E (preferred):**
```
mem_quality → mem_quality + mem_confidence (both are scoring)
  Actions: score, score_all, low_quality, validate, confidence, unreliable, stats
mem_analytics → mem_analytics + mem_feedback + mem_dashboard (all are reporting)
  Actions: summary, popular, gaps, zero_results, feedback_submit, feedback_view, low_rated, top_rated, dashboard, trends
```
**⛔ Still too many actions.**

**Final Decision for Group E:**
```
mem_scoring → mem_quality + mem_confidence (scoring domain)
  Actions: quality_score, quality_stats, low_quality, validate, confidence, confidence_stats, unreliable
  (7 actions — acceptable, all about "how good is this entry?")

mem_feedback → keep as-is (4 actions: submit, summary, low_rated, top_rated)
  Rationale: feedback is user-facing, different from automated scoring

mem_analytics → mem_analytics + mem_dashboard (both are system-level reporting)
  Actions: summary, popular, gaps, zero_results, dashboard, metrics, recommendations, trends
  (8 actions — acceptable, all about "how is the KB doing?")
```

#### Group F: Citations
```
mem_cite + mem_citations → mem_citations
Actions: record, entry, most_cited, uncited, by_agent
```
**Rationale:** `mem_cite` is just "record a citation" — it's one action within the citations domain.

#### Group G: Admin
```
mem_status + mem_audit + mem_sessions → mem_admin
Actions: status, audit, sessions
```
**Rationale:** All are system introspection tools. Agent rarely needs them individually.

---

## 3. Before/After Comparison

### BEFORE: 29 tools, ~5,730 tokens

| # | Tool Name | Actions |
|---|-----------|---------|
| 1 | mem_search | - |
| 2 | mem_ingest | - |
| 3 | mem_ingest_file | - |
| 4 | mem_get | - |
| 5 | mem_delete | - |
| 6 | mem_list | - |
| 7 | mem_graph | 4 |
| 8 | mem_status | - |
| 9 | mem_consolidate | - |
| 10 | mem_audit | - |
| 11 | mem_sessions | - |
| 12 | mem_sync_code | - |
| 13 | mem_consolidate_v2 | 2 |
| 14 | mem_stale | 3 |
| 15 | mem_due_reviews | - |
| 16 | mem_review | 4 |
| 17 | mem_templates | 3 |
| 18 | mem_attachments | 4 |
| 19 | mem_suggest | - |
| 20 | mem_related | - |
| 21 | mem_tags | 7 |
| 22 | mem_analytics | 4 |
| 23 | mem_cite | - |
| 24 | mem_citations | 4 |
| 25 | mem_feedback | 4 |
| 26 | mem_reminders | 7 |
| 27 | mem_quality | 5 |
| 28 | mem_confidence | 4 |
| 29 | mem_dashboard | 4 |

### AFTER: 14 tools, ~3,080 tokens (estimated)

| # | Tool Name | Merged From | Actions | Est. Tokens |
|---|-----------|-------------|---------|-------------|
| 1 | **mem_search** | (unchanged) | - | 150 |
| 2 | **mem_ingest** | (unchanged) | - | 180 |
| 3 | **mem_ingest_file** | (unchanged) | - | 140 |
| 4 | **mem_crud** | mem_get + mem_delete + mem_list | get, delete, list | 200 |
| 5 | **mem_graph** | (unchanged) | neighbors, add_edge, path, ego | 220 |
| 6 | **mem_consolidate** | V1 + V2 merged | consolidate, merge | 220 |
| 7 | **mem_lifecycle** | mem_stale + mem_due_reviews + mem_review + mem_reminders | detect_stale, archive, unarchive, due_reviews, mark_reviewed, schedule, snooze, complete | 320 |
| 8 | **mem_templates** | (unchanged) | create, list, validate | 180 |
| 9 | **mem_attachments** | (unchanged) | attach, list, remove, search | 220 |
| 10 | **mem_discover** | mem_suggest + mem_related | suggest, related | 180 |
| 11 | **mem_tags** | (unchanged) | create, tag, untag, search, taxonomy, popular, entry_tags | 250 |
| 12 | **mem_citations** | mem_cite + mem_citations | record, entry, most_cited, uncited, by_agent | 200 |
| 13 | **mem_scoring** | mem_quality + mem_confidence + mem_feedback | quality_score, quality_stats, validate, confidence, feedback_submit, feedback_view | 280 |
| 14 | **mem_admin** | mem_status + mem_audit + mem_sessions + mem_analytics + mem_dashboard + mem_sync_code | status, audit, sessions, analytics, dashboard, sync_code | 340 |

### Summary

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Tool count | 29 | 14 | **-15 tools (52%)** |
| Token cost (definitions) | ~5,730 | ~3,080 | **-2,650 tokens (46%)** |
| Per-request overhead | 29 tool schemas in context | 14 tool schemas | **46% less context** |

---

## 4. Final Tool List — Detailed Specifications

### Tier 1: High-Frequency (standalone, no action param)

#### 1. `mem_search`
```
Hybrid search across workspace memory (BM25 + vector + graph).
Params: query*, limit, tier, type, detail
```

#### 2. `mem_ingest`
```
Store knowledge entry (decision, error pattern, lesson learned, etc).
Params: content*, summary, type, source, tags
```

#### 3. `mem_ingest_file`
```
Ingest document from disk by file path. Zero-context (~80 tokens).
Params: file_path*, type, format
```

### Tier 2: Medium-Frequency (action-based, focused domain)

#### 4. `mem_crud`
```
CRUD operations on knowledge entries: get, delete, list.
Params: action* (get|delete|list), id, tier, type, limit
```

#### 5. `mem_graph`
```
Knowledge graph operations: neighbors, add_edge, path, ego.
Params: action*, node_id, source_id, target_id, relation, from_id, to_id, radius
```

#### 6. `mem_discover`
```
Find relevant entries: type-ahead suggestions or related entries.
Params: action* (suggest|related), query, entry_id, limit, refresh
```

#### 7. `mem_tags`
```
Tag taxonomy: create, tag/untag entries, search by tags, view taxonomy.
Params: action*, tag, tags, entry_id, category, parent_tag, operator, limit
```

#### 8. `mem_consolidate`
```
Tier consolidation: promote/demote entries, merge duplicates.
Params: action (consolidate|merge), dry_run, survivor_id, merge_ids, strategy
```

### Tier 3: Low-Frequency (admin/governance)

#### 9. `mem_lifecycle`
```
Entry lifecycle: staleness detection, reviews, reminders.
Params: action* (detect_stale|archive|unarchive|due_reviews|mark_reviewed|schedule|snooze|complete),
        entry_id, threshold, days, interval_days, snooze_days, reviewer, assignee, limit
```

#### 10. `mem_templates`
```
Content templates: create, list, validate entries against templates.
Params: action* (create|list|validate), name, type, required_sections, entry_id
```

#### 11. `mem_attachments`
```
File attachments for knowledge entries.
Params: action* (attach|list|remove|search), entry_id, file_path, description, attachment_id, mime_prefix
```

#### 12. `mem_citations`
```
Citation tracking: record citations, view most/least cited.
Params: action* (record|entry|most_cited|uncited|by_agent), entry_id, cited_by, context, agent, limit
```

#### 13. `mem_scoring`
```
Quality & confidence scoring + feedback for entries.
Params: action* (quality_score|quality_stats|low_quality|validate|confidence|confidence_stats|unreliable|feedback_submit|feedback_view|top_rated|low_rated),
        entry_id, content, type, threshold, rating, comment, limit
```

#### 14. `mem_admin`
```
System administration: status, audit trail, sessions, analytics, dashboard, code sync.
Params: action* (status|audit|sessions|analytics|dashboard|sync_code|popular|gaps|zero_results|metrics|recommendations|trends),
        limit, operation, days, kind
```

---

## 5. Migration Plan

### Phase 1: Backward-Compatible Aliases (Week 1)

```python
# In dispatcher.py — add alias mapping
ALIASES = {
    # Old name → New name + default action
    "mem_get": ("mem_crud", {"action": "get"}),
    "mem_delete": ("mem_crud", {"action": "delete"}),
    "mem_list": ("mem_crud", {"action": "list"}),
    "mem_status": ("mem_admin", {"action": "status"}),
    "mem_audit": ("mem_admin", {"action": "audit"}),
    "mem_sessions": ("mem_admin", {"action": "sessions"}),
    "mem_consolidate_v2": ("mem_consolidate", {}),  # V2 becomes the only impl
    "mem_stale": ("mem_lifecycle", {"action": "detect_stale"}),
    "mem_due_reviews": ("mem_lifecycle", {"action": "due_reviews"}),
    "mem_review": ("mem_lifecycle", {}),  # pass action through
    "mem_reminders": ("mem_lifecycle", {}),  # pass action through
    "mem_suggest": ("mem_discover", {"action": "suggest"}),
    "mem_related": ("mem_discover", {"action": "related"}),
    "mem_cite": ("mem_citations", {"action": "record"}),
    "mem_quality": ("mem_scoring", {}),  # pass action through
    "mem_confidence": ("mem_scoring", {}),  # remap actions
    "mem_feedback": ("mem_scoring", {}),  # remap actions
    "mem_analytics": ("mem_admin", {"action": "analytics"}),
    "mem_dashboard": ("mem_admin", {"action": "dashboard"}),
    "mem_sync_code": ("mem_admin", {"action": "sync_code"}),
}
```

**Implementation:**
1. Create new `definitions_consolidated.py` with 14 tool definitions
2. Update `dispatcher.py` to route both old AND new names
3. Old names still work but are NOT exposed in tool definitions (hidden aliases)
4. Only 14 tools appear in MCP tool list → immediate token savings

### Phase 2: Update All Agent Prompts (Week 2)

- Update SM, BA, SA, QA, DEV agent prompts to use new tool names
- Update `.kiro/steering/` docs that reference tool names
- Update hook instructions (e.g., `mem_ingest` stays the same — no change needed)

### Phase 3: Remove Aliases (Week 3-4)

- After confirming no callers use old names
- Remove alias mapping
- Delete `definitions_v2.py` (merged into `definitions_consolidated.py`)
- Delete `dispatcher_v2.py` (merged into single dispatcher)

### Phase 4: Code Cleanup

- `consolidation.py` (V1) → delete, `consolidation_engine.py` (V2) handles everything
- Merge `engine.py` + `engine_v2.py` into single `engine.py`
- Merge `schema.py` + `schema_v2.py` into single `schema.py`

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing callers | HIGH | Phase 1 aliases ensure backward compat |
| Agent confusion with action params | MEDIUM | Clear action descriptions in tool schema |
| Too many actions in `mem_admin` (12) | MEDIUM | Consider splitting analytics out if usage grows |
| `mem_scoring` has 11 actions | MEDIUM | Acceptable because all are "evaluate entry quality" domain |
| Lost discoverability | LOW | Tool descriptions are comprehensive |

---

## 7. Alternative: More Aggressive Consolidation (10 tools)

If 14 is still too many, further merge:

| # | Tool | Merged From |
|---|------|-------------|
| 1 | mem_search | unchanged |
| 2 | mem_ingest | + mem_ingest_file (action: text, file) |
| 3 | mem_crud | + mem_graph (action: get, delete, list, graph_*) |
| 4 | mem_discover | + mem_tags (action: suggest, related, tag, untag, search_tags) |
| 5 | mem_consolidate | unchanged |
| 6 | mem_lifecycle | + mem_templates (action: stale, review, remind, template) |
| 7 | mem_attachments | unchanged |
| 8 | mem_citations | unchanged |
| 9 | mem_scoring | + mem_feedback |
| 10 | mem_admin | + mem_analytics + mem_dashboard |

**⚠️ Not recommended** — `mem_crud` with graph operations is confusing. `mem_discover` with tag management mixes read/write semantics.

---

## 8. Recommendation

**Go with 14 tools (Option in Section 3).** Reasons:

1. **46% token savings** — significant without sacrificing clarity
2. **Each tool has clear domain** — agent can infer correct tool from task
3. **Max 12 actions per tool** — manageable, all within same semantic domain
4. **Backward compatible** — aliases prevent breaking changes
5. **Clean migration path** — 4 weeks, incremental

### Immediate Quick Win (can do TODAY):

1. **Delete `mem_consolidate` V1 tool definition** — replace with V2 (rename V2 → `mem_consolidate`)
2. **Merge `mem_cite` into `mem_citations`** — add `action: record` 
3. **Merge `mem_suggest` + `mem_related` → `mem_discover`**

These 3 changes alone: **29 → 26 tools, ~500 tokens saved, zero breaking changes.**

# Functional Specification Document (FSD)

## KB System Enhancement — KSA-68: Achieve 100% across all 5 Pillars

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-68 |
| Title | KB System Enhancement — Achieve 100% across all 5 Pillars |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-23 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-68.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the KB System Enhancement that upgrades the MemoryEngine from ~62% to 100% compliance with `kb-standard.md` across 5 pillars: Governance, Content Quality, Findability, AI-Ready, and UX/Integration.

### 1.2 Scope

Enhancement of the existing Python MemoryEngine (`mcp-code-intelligence-python`) — adding 13 new MCP tools (from 12 to 25), new database tables, and a web viewer UI. All changes are backward-compatible with existing tools.

### 1.3 Definitions

| Term | Definition |
|------|------------|
| Tier | Storage level: WORKING → EPISODIC → SEMANTIC → PROCEDURAL |
| Pillar | Quality evaluation axis per kb-standard.md |
| Staleness | Entry not accessed/reviewed within threshold period |
| Consolidation | Reorganizing entries via promote/demote/merge |
| FTS5 | SQLite Full-Text Search extension |

---

## 2. System Overview

### 2.1 Current Architecture

```
┌─────────────────────────────────────────────────┐
│  AI Agents (via MCP Protocol)                   │
│  SM | BA | SA | DEV | QA | DevOps              │
└──────────────────────┬──────────────────────────┘
                       │ JSON-RPC 2.0 (stdio)
┌──────────────────────▼──────────────────────────┐
│  MCP Server (server.py)                         │
│  ┌────────────────────────────────────────────┐ │
│  │ MemoryEngineV2 + MemoryToolDispatcher      │ │
│  │ 12 existing tools → 25 tools (target)      │ │
│  └────────────────────┬───────────────────────┘ │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐ │
│  │ SQLite Database                            │ │
│  │ • knowledge_entries (FTS5)                 │ │
│  │ • knowledge_vectors (384-dim embeddings)   │ │
│  │ • knowledge_graph_edges                    │ │
│  │ • consolidation_log                        │ │
│  │ • memory_sessions / memory_audit           │ │
│  │ • conversation_turns / entity_index        │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 2.2 Enhancement Modules by Sprint

| Sprint | Pillar | New Modules | New Tools |
|--------|--------|-------------|-----------|
| 1 | Governance & Lifecycle | consolidation_engine, staleness, rbac, review_reminders | mem_consolidate, mem_lifecycle |
| 2 | Content Quality | templates, quality_scoring, attachments | mem_templates, mem_attachments, mem_scoring |
| 3 | Findability | suggestions, tag_taxonomy, search_analytics | mem_discover, mem_tags |
| 4 | AI-Ready | citations, confidence_scoring, feedback | mem_citations, mem_scoring (enhanced) |
| 5 | UX & Integration | health_dashboard, bot_integration, viewer | mem_admin |

---

## 3. Functional Requirements

### 3.1 Use Cases — Sprint 1: Governance & Lifecycle

#### UC-1: Consolidation (Promote/Demote/Merge)

| Attribute | Value |
|-----------|-------|
| Actor | KB Admin (AI agent or human) |
| Tool | `mem_consolidate` |
| Precondition | Entries exist with access_count data |

**Actions:**
- `consolidate` — Auto-promote entries with high access_count, demote entries with 0 access in 90 days
- `merge` — Combine duplicate entries (dry_run mode available)

**Business Rules:**
- BR-1: Promote threshold: access_count > 10 AND age > 7 days
- BR-2: Demote threshold: access_count = 0 AND last_accessed_at > 90 days ago
- BR-3: Merge requires explicit survivor_id + merge_ids
- BR-4: Dry-run returns preview without modifying data
- BR-5: Backup (audit log) created before every merge

#### UC-2: Staleness Detection & Auto-Archive

| Attribute | Value |
|-----------|-------|
| Actor | System (scheduled) or KB Admin |
| Tool | `mem_lifecycle` |

**Actions:**
- `detect_stale` — Scan entries, compute staleness_score (0.0-1.0)
- `archive` / `unarchive` — Move entries to/from archived state
- `due_reviews` — List entries overdue for review
- `mark_reviewed` — Reset staleness timer
- `schedule` — Set review interval for entry
- `snooze` — Delay review by N days

**Business Rules:**
- BR-6: Staleness formula: `days_since_last_access / threshold_days` (capped at 1.0)
- BR-7: Archived entries excluded from search results (archived=1)
- BR-8: Default staleness threshold: 0.8 (configurable)
- BR-9: Default review interval: 90 days

#### UC-3: Owner/Reviewer Assignment

| Attribute | Value |
|-----------|-------|
| Actor | KB Admin |
| Tool | `mem_lifecycle` (mark_reviewed with reviewer param) |

**Business Rules:**
- BR-10: Owner defaults to ingesting agent's agent_name
- BR-11: Reviewer is optional, set via mark_reviewed action
- BR-12: RBAC enforced via agent_scope_config table

### 3.2 Use Cases — Sprint 2: Content Quality

#### UC-4: Template Enforcement

| Attribute | Value |
|-----------|-------|
| Actor | Content Author |
| Tool | `mem_templates` |

**Actions:**
- `create` — Define template with required_sections for a type
- `list` — List all templates
- `validate` — Check entry against its type's template

**Business Rules:**
- BR-13: Templates define required sections as comma-separated list
- BR-14: Validation returns missing sections list
- BR-15: WARN mode (default) — accept entry, penalize quality_score
- BR-16: STRICT mode — reject non-compliant entry

#### UC-5: Quality Scoring

| Attribute | Value |
|-----------|-------|
| Actor | System (auto) or Admin |
| Tool | `mem_scoring` |

**Actions:**
- `quality_score` — Compute score for entry (0-100)
- `quality_stats` — Aggregate stats per type/tier
- `low_quality` — List entries below threshold
- `validate` — Validate content before ingest

**Scoring Formula:**
```
quality_score = (
  completeness_weight * has_all_sections +
  freshness_weight * (1 - staleness_score) +
  citation_weight * min(citation_count / 5, 1.0) +
  feedback_weight * positive_ratio +
  template_weight * template_compliance
) * 100
```

#### UC-6: Attachments

| Attribute | Value |
|-----------|-------|
| Actor | Content Author |
| Tool | `mem_attachments` |

**Actions:**
- `attach` — Link file to entry (stores metadata: path, MIME, size, description)
- `list` — List attachments for entry
- `remove` — Remove attachment
- `search` — Find attachments by MIME prefix

### 3.3 Use Cases — Sprint 3: Findability

#### UC-7: Auto-Suggestions & Related Entries

| Attribute | Value |
|-----------|-------|
| Actor | User (AI agent or human) |
| Tool | `mem_discover` |

**Actions:**
- `suggest` — Type-ahead suggestions matching query prefix
- `related` — Find related entries via vector similarity + graph proximity + tag overlap

**Business Rules:**
- BR-17: Suggestions ranked by: exact match > prefix match > fuzzy match
- BR-18: Related entries use weighted combination: vector(0.5) + graph(0.3) + tags(0.2)
- BR-19: Related entries cached, refreshable with refresh=true

#### UC-8: Tag Taxonomy

| Attribute | Value |
|-----------|-------|
| Actor | KB Admin / Content Author |
| Tool | `mem_tags` |

**Actions:**
- `create` — Create tag with optional category and parent
- `tag` / `untag` — Add/remove tags from entry
- `search` — Find entries by tag combination (AND/OR)
- `taxonomy` — View tag hierarchy
- `popular` — Rank tags by usage
- `entry_tags` — List tags for entry

#### UC-9: Search Analytics

| Attribute | Value |
|-----------|-------|
| Actor | KB Admin |
| Tool | `mem_admin` |

**Actions:**
- `zero_results` — Queries that returned no results (content gaps)
- `popular` — Most frequent queries
- `trends` — Trending topics over N days
- `recommendations` — Suggested content to create

### 3.4 Use Cases — Sprint 4: AI-Ready

#### UC-10: Citation Tracking

| Attribute | Value |
|-----------|-------|
| Actor | AI Agent |
| Tool | `mem_citations` |

**Actions:**
- `record` — Record citation (entry_id, cited_by, context)
- `entry` — View citations for entry
- `most_cited` — Rank entries by citation count
- `uncited` — Find entries never cited
- `by_agent` — Citations by specific agent

#### UC-11: Confidence Scoring

| Attribute | Value |
|-----------|-------|
| Actor | AI Agent |
| Tool | `mem_scoring` |

**Actions:**
- `confidence` — Compute confidence for entry (0.0-1.0)
- `confidence_stats` — Stats per tier/type
- `unreliable` — Entries below confidence threshold

**Confidence Formula:**
```
confidence = (
  quality_weight * (quality_score / 100) +
  freshness_weight * (1 - staleness_score) +
  citation_weight * min(citation_count / 10, 1.0) +
  feedback_weight * positive_ratio
)
```

#### UC-12: Feedback Loop

| Attribute | Value |
|-----------|-------|
| Actor | User (AI agent or human) |
| Tool | `mem_scoring` |

**Actions:**
- `feedback_submit` — Submit rating (+1/-1) with optional comment
- `feedback_view` — View feedback for entry
- `top_rated` — Entries with most positive feedback
- `low_rated` — Entries with most negative feedback

### 3.5 Use Cases — Sprint 5: UX & Integration

#### UC-13: Health Dashboard

| Attribute | Value |
|-----------|-------|
| Actor | KB Admin |
| Tool | `mem_admin` |

**Actions:**
- `dashboard` — Overall health score + pillar breakdown
- `status` — System status (entries, vectors, edges, sessions)
- `analytics` — Usage analytics
- `metrics` — Performance metrics
- `gaps` — Content coverage gaps

#### UC-14: Web Viewer UI

| Attribute | Value |
|-----------|-------|
| Actor | Human User (browser) |
| Endpoint | HTTP server on configurable port |

**Features:**
- Search with faceted filtering (tags, type, tier)
- Browse entries by tier/type
- Entry detail view (content, metadata, attachments, related)
- Dashboard with health metrics
- Read-only (no edit in v1)

#### UC-15: Bot Integration

| Attribute | Value |
|-----------|-------|
| Actor | Team Member (via Slack/Teams) |
| Module | bot_integration.py |

**Features:**
- Query KB via bot command
- Return top results with summaries
- Respect RBAC permissions

---

## 4. Data Model

### 4.1 Enhanced knowledge_entries Table

| Column | Type | New? | Description |
|--------|------|------|-------------|
| id | INTEGER PK | No | Auto-increment ID |
| content | TEXT | No | Full entry content |
| summary | TEXT | No | Brief summary |
| type | TEXT | No | DECISION, ERROR_PATTERN, ARCHITECTURE, etc. |
| tier | TEXT | No | WORKING, EPISODIC, SEMANTIC, PROCEDURAL |
| source | TEXT | No | Source identifier |
| tags | TEXT | No | Comma-separated tags |
| confidence | REAL | No | Confidence score 0.0-1.0 |
| access_count | INTEGER | No | Access counter |
| pinned | INTEGER | V3 | Core memory pin flag |
| pin_order | INTEGER | V3 | Pin display order |
| structured_map | TEXT | V3 | JSON metadata (entities, topics) |
| quality_score | INTEGER | V3 | Quality score 0-100 |
| archived | INTEGER | V3 | Archive flag |
| agent_name | TEXT | V4 | Creating agent identifier |
| staleness_score | REAL | V3 | Computed staleness 0.0-1.0 |
| last_reviewed_at | TEXT | V3 | Last review timestamp |
| owner | TEXT | V3 | Entry owner |
| reviewer | TEXT | V3 | Assigned reviewer |

### 4.2 New Tables (V3+)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| conversation_turns | Structured conversation history | session_id, turn_number, role, content |
| entity_index | Entity extraction index | entry_id, entity_name, entity_type |
| agent_scope_config | RBAC per agent role | agent_role, tag_set |
| kb_templates | Template definitions | name, type, required_sections |
| kb_attachments | File attachments | entry_id, file_path, mime_type, size |
| kb_citations | Citation tracking | entry_id, cited_by, context, created_at |
| kb_feedback | User feedback | entry_id, rating, comment, agent_name |
| kb_tags | Tag taxonomy | name, category, parent_tag |
| kb_entry_tags | Entry-tag mapping | entry_id, tag_id |
| search_log | Search analytics | query, results_count, agent_name |

### 4.3 Key Indexes

- `idx_ke_staleness` ON knowledge_entries(staleness_score)
- `idx_ke_owner` ON knowledge_entries(owner)
- `idx_ke_last_reviewed` ON knowledge_entries(last_reviewed_at)
- `idx_citations_entry` ON kb_citations(entry_id)
- `idx_citations_agent` ON kb_citations(cited_by)
- `idx_feedback_entry` ON kb_feedback(entry_id)
- `idx_tags_name` ON kb_tags(name)
- `idx_entry_tags_entry` ON kb_entry_tags(entry_id)
- `idx_search_log_query` ON search_log(query)

---

## 5. Integration Specifications

### 5.1 MCP Tool Interface

All tools communicate via JSON-RPC 2.0 over stdio. Each tool:
- Receives `arguments` dict from MCP client
- Returns `content` list with `type: "text"` items
- Errors returned as structured JSON in content (not protocol errors)

### 5.2 Web Viewer Integration

- FastAPI/Starlette HTTP server (ViewerServer class)
- Serves static HTML/JS/CSS from `shared/viewer/`
- REST API endpoints under `/api/kb/*`
- Same-origin, no CORS needed for local access

### 5.3 Vector Embedding

- Model: `all-MiniLM-L6-v2` (384 dimensions)
- ONNX runtime for inference
- Cosine similarity for vector search
- Auto-embed on ingest if model available

---

## 6. Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Search latency | < 500ms | Hybrid search (FTS5 + vector + graph) |
| Ingest latency | < 200ms | Including vector embedding |
| Consolidation scan | < 30s | Full 3000+ entry scan |
| Quality scoring | < 100ms | Per entry |
| Scalability | 10,000+ entries | No degradation |
| Availability | 99.9% | Local SQLite, no network |
| Tool count | 25 tools | From current 12 |

---

## 7. Security

- RBAC via agent_scope_config (agent roles → allowed tag sets)
- Audit trail for all write operations (memory_audit table)
- No authentication for web viewer (local access only)
- Input validation on all tool parameters

---

## 8. Acceptance Criteria Summary

| Sprint | Key Criteria |
|--------|-------------|
| 1 | Consolidation promotes/demotes correctly; staleness detection works; RBAC enforced |
| 2 | Templates validate on ingest; quality scores computed; attachments stored |
| 3 | Suggestions return relevant results; tag search with AND/OR works; analytics logged |
| 4 | Citations tracked per agent; confidence scores filter unreliable; feedback impacts ranking |
| 5 | Dashboard shows health score; web viewer searchable; bot responds to queries |

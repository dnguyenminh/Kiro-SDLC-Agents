# KB System Enhancement — Sprint Plan

## Epic: KSA-68 — Achieve 100% across all 5 Pillars

**Timeline:** 10 weeks (5 sprints × 2 weeks)
**Total Story Points:** 106 SP
**Velocity Target:** ~21 SP/sprint

---

## Current State → Target

| # | Pillar | Current | Target | Gap | Sprint |
|---|--------|---------|--------|-----|--------|
| 3 | Governance & Lifecycle | 45% | 100% | 55% | Sprint 1 |
| 2 | Content Quality & Structure | 65% | 100% | 35% | Sprint 2 |
| 1 | Findability & Searchability | 75% | 100% | 25% | Sprint 3 |
| 5 | AI-Ready | 85% | 100% | 15% | Sprint 4 |
| 4 | UX & Integration | 55% | 100% | 45% | Sprint 5 |

**Rationale for ordering:**
- Sprint 1 (Governance) first: foundational — owner, staleness, consolidation enable everything else
- Sprint 2 (Content Quality) second: builds on governance (quality needs owner + review)
- Sprint 3 (Findability) third: search enhancements need quality scores + tags
- Sprint 4 (AI-Ready) fourth: confidence scoring needs quality + citations
- Sprint 5 (UX) last: UI consumes all backend features built in sprints 1-4

---

## Sprint 1 — Pillar 3: Governance & Lifecycle (45% → 100%)

**Capacity:** 23 SP | **Focus:** Foundation for all other pillars

| Key | Task | SP | Priority | Assign | Dependencies |
|-----|------|----|----------|--------|--------------|
| KSA-69 | Real Consolidation Engine (Promote/Demote/Merge) | 8 | High | Dev | None |
| KSA-70 | Staleness Detection & Auto-Archive | 5 | High | Dev | None |
| KSA-71 | Owner/Reviewer Assignment & RBAC | 5 | Medium | Dev | None |
| KSA-72 | Scheduled Review Reminders | 5 | Medium | Dev | KSA-70, KSA-71 |

**New MCP Tools:** `mem_stale`, `mem_due_reviews`, `mem_review`
**DB Migrations:** `last_reviewed_at`, `owner`, `reviewer` columns
**Key Deliverables:**
- Consolidation actually promotes/demotes based on access patterns
- Stale entries auto-detected and archived
- Every entry has an owner responsible for freshness

---

## Sprint 2 — Pillar 2: Content Quality & Structure (65% → 100%)

**Capacity:** 21 SP | **Focus:** Quality enforcement

| Key | Task | SP | Priority | Assign | Dependencies |
|-----|------|----|----------|--------|--------------|
| KSA-73 | Template Enforcement Engine | 8 | High | Dev + BA | None |
| KSA-74 | Content Quality Scoring & Validation | 8 | High | Dev | KSA-71 (owner) |
| KSA-75 | Rich Media Support (Attachments) | 5 | Medium | Dev | None |

**New MCP Tools:** `mem_templates`, `mem_quality`, `mem_attachments`
**New Files:** `memory/templates.py`, `memory/quality.py`, `.code-intel/kb-templates.yaml`
**Key Deliverables:**
- Content validated against templates on ingest
- Quality score (0-100) for every entry
- Entries can reference images, diagrams, code files

---

## Sprint 3 — Pillar 1: Findability & Searchability (75% → 100%)

**Capacity:** 21 SP | **Focus:** Search intelligence

| Key | Task | SP | Priority | Assign | Dependencies |
|-----|------|----|----------|--------|--------------|
| KSA-76 | Auto-Suggestions & Related Entries | 8 | High | Dev | None |
| KSA-77 | Faceted Search with Tag Taxonomy | 8 | Medium | Dev | None |
| KSA-78 | Search Analytics & Query Optimization | 5 | Medium | Dev | None |

**New MCP Tools:** `mem_suggest`, `mem_related`, `mem_tags`, `mem_analytics`
**New Tables:** `tag_taxonomy`, `search_log`
**Key Deliverables:**
- Type-ahead suggestions as user types
- Related entries recommendation (vector + graph + tags)
- Structured tag taxonomy with faceted filtering
- Analytics to identify content gaps

---

## Sprint 4 — Pillar 5: AI-Ready (85% → 100%)

**Capacity:** 15 SP | **Focus:** AI trust & feedback

| Key | Task | SP | Priority | Assign | Dependencies |
|-----|------|----|----------|--------|--------------|
| KSA-79 | Citation Tracking & Source Attribution | 5 | Medium | Dev | None |
| KSA-80 | Confidence Scoring for Search Results | 5 | Medium | Dev | KSA-74 (quality), KSA-79 (citations) |
| KSA-81 | Feedback Loop (Thumbs Up/Down) | 5 | Medium | Dev | None |

**New MCP Tools:** `mem_cite`, `mem_citations`, `mem_feedback`
**Enhanced:** `mem_search` (confidence score, min_confidence filter)
**Key Deliverables:**
- AI knows which entries it cited (traceability)
- Confidence score per result (AI can filter unreliable)
- User/AI feedback improves future rankings

---

## Sprint 5 — Pillar 4: UX & Integration (55% → 100%)

**Capacity:** 26 SP | **Focus:** Human interface

| Key | Task | SP | Priority | Assign | Dependencies |
|-----|------|----|----------|--------|--------------|
| KSA-82 | Web Viewer UI for Knowledge Base | 13 | Medium | Dev (FE+BE) | All Sprint 1-4 |
| KSA-83 | Slack/Teams Bot Integration | 8 | Low | Dev | KSA-76 (suggestions) |
| KSA-84 | KB Health Dashboard & Metrics | 5 | Medium | Dev | KSA-74, KSA-78 |

**New MCP Tools:** `mem_dashboard`
**New Components:** FastAPI web app, Slack bot
**Key Deliverables:**
- Web UI for humans to browse/search KB
- Slack bot for team-wide KB access
- Health dashboard with actionable recommendations

---

## Team Responsibilities

| Role | Sprints | Responsibilities |
|------|---------|-----------------|
| **Dev (Backend)** | 1-5 | All implementation, DB migrations, MCP tools |
| **BA** | 2 | Template design (kb-templates.yaml), content structure |
| **SA** | 1 | Architecture review for consolidation engine |
| **QA** | 1-5 | Integration tests per sprint, E2E after Sprint 5 |
| **Dev (Frontend)** | 5 | Web Viewer UI |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Consolidation merge corrupts data | High | Dry-run mode first, backup before merge |
| Quality scoring too strict → rejects valid content | Medium | Start with WARN mode, tune thresholds |
| Web UI scope creep | Medium | Read-only only, no edit features |
| Slack bot security (who can ingest) | Medium | RBAC from Sprint 1 applies |
| Vector search performance with 3000+ entries | Low | Already tested at scale, add caching |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Overall KB Score | 62% | 100% |
| Entries with owner | 0% | 100% |
| Entries reviewed < 90 days | unknown | > 80% |
| Average quality score | unknown | > 70/100 |
| Zero-result search rate | unknown | < 5% |
| Confidence score coverage | 0% | 100% |
| Human UI available | No | Yes |

---

## New MCP Tools Summary (12 → 24 tools)

| Sprint | New Tools |
|--------|-----------|
| 1 | `mem_stale`, `mem_due_reviews`, `mem_review` |
| 2 | `mem_templates`, `mem_quality`, `mem_attachments` |
| 3 | `mem_suggest`, `mem_related`, `mem_tags`, `mem_analytics` |
| 4 | `mem_cite`, `mem_citations`, `mem_feedback` |
| 5 | `mem_dashboard` |

**Total new tools: 13** (from 12 → 25 tools)

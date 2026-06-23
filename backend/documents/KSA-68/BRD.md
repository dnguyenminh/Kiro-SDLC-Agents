# Business Requirements Document (BRD)

## Knowledge Base System — KSA-68: KB System Enhancement — Achieve 100% across all 5 Pillars

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-68 |
| Title | KB System Enhancement — Achieve 100% across all 5 Pillars |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-23 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | Duc Nguyen Minh – Product Owner | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-23 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-68 and linked tickets |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| Duc Nguyen Minh | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Nâng cấp hệ thống Knowledge Base (MemoryEngine) từ mức đánh giá ~62% lên 100% theo tiêu chuẩn `kb-standard.md`. Hệ thống hiện tại là Python MemoryEngine sử dụng SQLite + FTS5 + vector + graph, cung cấp 12 MCP tools với 3,022 entries, 571 edges, 1,367 vectors, 4 tiers.

Phạm vi bao gồm nâng cấp toàn bộ 5 Pillars:
1. **Findability & Searchability** (75% → 100%)
2. **Content Quality & Structure** (65% → 100%)
3. **Governance & Lifecycle** (45% → 100%)
4. **UX & Integration** (55% → 100%)
5. **AI-Ready** (85% → 100%)

### 1.2 Out of Scope

- Migration sang database khác (PostgreSQL, MongoDB) — giữ nguyên SQLite
- Thay đổi MCP protocol hoặc transport layer
- Multi-tenant support (chỉ single workspace)
- Mobile app
- Paid/commercial features

### 1.3 Preliminary Requirement

- Python MemoryEngine đang hoạt động ổn định với 12 MCP tools
- SQLite database với FTS5, vector search, và graph đã được setup
- Existing data: 3,022 entries | 571 edges | 1,367 vectors | 4 tiers
- `kb-standard.md` document đã được define làm tiêu chuẩn đánh giá

---

## 2. Business Requirements

### 2.1 High Level Process Map

Hệ thống KB Enhancement được chia thành 5 sprints, mỗi sprint tập trung vào 1 pillar theo thứ tự ưu tiên gap lớn nhất và dependency:

1. **Sprint 1** — Governance & Lifecycle (gap 55%): Foundation cho tất cả pillars khác
2. **Sprint 2** — Content Quality & Structure (gap 35%): Builds on governance
3. **Sprint 3** — Findability & Searchability (gap 25%): Search enhancements cần quality scores + tags
4. **Sprint 4** — AI-Ready (gap 15%): Confidence scoring cần quality + citations
5. **Sprint 5** — UX & Integration (gap 45%): UI consumes tất cả backend features

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case / Epic | Priority | Source Ticket |
|---|-------------------------|----------|---------------|
| 1 | As a KB admin, I want real consolidation (promote/demote/merge) so that entries are properly organized by tier | MUST HAVE | KSA-69 |
| 2 | As a KB admin, I want staleness detection & auto-archive so that outdated entries don't pollute search results | MUST HAVE | KSA-70 |
| 3 | As a KB admin, I want owner/reviewer assignment & RBAC so that every entry has accountability | SHOULD HAVE | KSA-71 |
| 4 | As a KB admin, I want scheduled review reminders so that entries stay fresh | SHOULD HAVE | KSA-72 |
| 5 | As a content author, I want template enforcement so that all entries follow consistent structure | MUST HAVE | KSA-73 |
| 6 | As a content author, I want content quality scoring & validation so that I know entry quality before publishing | MUST HAVE | KSA-74 |
| 7 | As a content author, I want rich media support (attachments) so that entries can reference images, diagrams, code files | SHOULD HAVE | KSA-75 |
| 8 | As a user, I want auto-suggestions & related entries so that I can discover relevant knowledge faster | MUST HAVE | KSA-76 |
| 9 | As a user, I want faceted search with tag taxonomy so that I can filter results precisely | SHOULD HAVE | KSA-77 |
| 10 | As a KB admin, I want search analytics & query optimization so that I can identify content gaps | SHOULD HAVE | KSA-78 |
| 11 | As an AI agent, I want citation tracking & source attribution so that I can trace which entries I used | SHOULD HAVE | KSA-79 |
| 12 | As an AI agent, I want confidence scoring for search results so that I can filter unreliable entries | SHOULD HAVE | KSA-80 |
| 13 | As a user, I want feedback loop (thumbs up/down) so that entry quality improves over time | SHOULD HAVE | KSA-81 |
| 14 | As a human user, I want a web viewer UI for KB so that I can browse/search without MCP tools | COULD HAVE | KSA-82 |
| 15 | As a team member, I want Slack/Teams bot integration so that the whole team can access KB | COULD HAVE | KSA-83 |
| 16 | As a KB admin, I want a health dashboard & metrics so that I can monitor KB health at a glance | SHOULD HAVE | KSA-84 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** KB Admin configures governance rules (ownership, review schedules, staleness thresholds)

**Step 2:** Content authors create/update entries following enforced templates

**Step 3:** System validates content quality and assigns quality scores

**Step 4:** Users and AI agents search KB with enhanced findability (suggestions, faceted search, confidence scores)

**Step 5:** System tracks citations, collects feedback, and auto-consolidates based on access patterns

**Step 6:** Dashboard provides health metrics and actionable recommendations

**Step 7:** Stale entries are auto-detected and archived; review reminders sent to owners

---

#### STORY 1: Real Consolidation Engine (Promote/Demote/Merge)

> As a KB admin, I want real consolidation (promote/demote/merge) so that entries are properly organized by tier

**Requirement Details:**

1. Consolidation engine phải thực sự promote entries từ WORKING → EPISODIC → SEMANTIC tier dựa trên access patterns
2. Demote entries ít được truy cập xuống tier thấp hơn
3. Merge duplicate entries với dry-run mode (preview trước khi thực hiện)
4. Backup tự động trước mỗi merge operation
5. Audit trail cho mọi consolidation action

**Acceptance Criteria:**

1. GIVEN entries với high access count WHEN consolidation runs THEN entries được promote lên tier cao hơn
2. GIVEN entries với zero access trong 90 ngày WHEN consolidation runs THEN entries được demote
3. GIVEN 2 duplicate entries WHEN admin triggers merge THEN dry-run hiển thị preview, confirm mới thực hiện
4. GIVEN merge operation WHEN executed THEN backup được tạo trước, audit log ghi nhận

---

#### STORY 2: Staleness Detection & Auto-Archive

> As a KB admin, I want staleness detection & auto-archive so that outdated entries don't pollute search results

**Requirement Details:**

1. Detect entries chưa được review/access trong configurable threshold (default: 90 ngày)
2. Auto-archive stale entries (remove from active search, keep in archive)
3. Notification cho owner khi entry sắp bị archive
4. Unarchive capability khi cần

**Acceptance Criteria:**

1. GIVEN entry không được access 90+ ngày WHEN staleness scan runs THEN entry được flag là stale
2. GIVEN stale entry WHEN auto-archive triggers THEN entry bị remove khỏi active search results
3. GIVEN archived entry WHEN admin unarchives THEN entry trở lại active với reset staleness timer

---

#### STORY 3: Owner/Reviewer Assignment & RBAC

> As a KB admin, I want owner/reviewer assignment & RBAC so that every entry has accountability

**Requirement Details:**

1. Mỗi entry phải có owner (người chịu trách nhiệm freshness)
2. Optional reviewer assignment cho quality gate
3. RBAC: chỉ owner/admin mới được edit/delete entry
4. Bulk assign owner cho entries chưa có owner

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| owner | string | Yes | Owner identifier | "dev-agent" |
| reviewer | string | No | Reviewer identifier | "ba-agent" |
| last_reviewed_at | datetime | No | Last review timestamp | "2026-05-20T10:00:00Z" |

**Acceptance Criteria:**

1. GIVEN new entry WHEN ingested THEN owner field is set (default: ingesting agent)
2. GIVEN entry without owner WHEN bulk assign runs THEN owner is set based on entry type/tags
3. GIVEN non-owner user WHEN attempts edit THEN operation is rejected with permission error

---

#### STORY 4: Scheduled Review Reminders

> As a KB admin, I want scheduled review reminders so that entries stay fresh

**Requirement Details:**

1. Configurable review interval per entry type (default: 90 days)
2. Due reviews list accessible via MCP tool
3. Snooze capability (delay review by N days)
4. Review completion marks entry as reviewed, resets timer

**Acceptance Criteria:**

1. GIVEN entry with review_interval=90 WHEN 90 days pass since last_reviewed_at THEN entry appears in due_reviews list
2. GIVEN due review WHEN owner marks as reviewed THEN last_reviewed_at updates, entry removed from due list
3. GIVEN due review WHEN owner snoozes 7 days THEN entry reappears after 7 days

---

#### STORY 5: Template Enforcement Engine

> As a content author, I want template enforcement so that all entries follow consistent structure

**Requirement Details:**

1. Define templates per entry type (DECISION, ERROR_PATTERN, ARCHITECTURE, etc.)
2. Templates specify required sections/fields
3. Validate content against template on ingest
4. WARN mode (allow but flag) vs STRICT mode (reject non-compliant)

**Acceptance Criteria:**

1. GIVEN template for DECISION type WHEN entry ingested without required "Context" section THEN validation warning/error returned
2. GIVEN STRICT mode WHEN non-compliant entry ingested THEN entry rejected with specific missing sections listed
3. GIVEN WARN mode WHEN non-compliant entry ingested THEN entry accepted with quality score penalty

---

#### STORY 6: Content Quality Scoring & Validation

> As a content author, I want content quality scoring & validation so that I know entry quality before publishing

**Requirement Details:**

1. Quality score 0-100 cho mỗi entry
2. Scoring factors: completeness, freshness, citations, feedback, template compliance
3. Low-quality entries flagged for improvement
4. Quality stats aggregated per type/tier

**Acceptance Criteria:**

1. GIVEN entry with all required sections, recent review, positive feedback WHEN quality scored THEN score > 80
2. GIVEN entry missing sections, stale, no citations WHEN quality scored THEN score < 40
3. GIVEN quality threshold = 40 WHEN querying low_quality THEN all entries below threshold returned

---

#### STORY 7: Rich Media Support (Attachments)

> As a content author, I want rich media support so that entries can reference images, diagrams, code files

**Requirement Details:**

1. Attach files (images, diagrams, code) to KB entries
2. Store file metadata (path, MIME type, size, description)
3. Search attachments by MIME type prefix
4. Remove attachments

**Acceptance Criteria:**

1. GIVEN entry WHEN file attached THEN attachment metadata stored with entry reference
2. GIVEN search for "image/" MIME prefix WHEN executed THEN all image attachments returned
3. GIVEN attachment WHEN removed THEN metadata deleted, entry still intact

---

#### STORY 8: Auto-Suggestions & Related Entries

> As a user, I want auto-suggestions & related entries so that I can discover relevant knowledge faster

**Requirement Details:**

1. Type-ahead suggestions as user types query
2. Related entries recommendation using vector similarity + graph proximity + tag overlap
3. Precomputed related entries (cached, refreshable)
4. Configurable suggestion limit

**Acceptance Criteria:**

1. GIVEN partial query "auth" WHEN suggest called THEN entries matching "auth*" returned ranked by relevance
2. GIVEN entry about "JWT authentication" WHEN related queried THEN entries about "OAuth", "token refresh", "session management" returned
3. GIVEN stale related cache WHEN refresh=true THEN related entries recomputed

---

#### STORY 9: Faceted Search with Tag Taxonomy

> As a user, I want faceted search with tag taxonomy so that I can filter results precisely

**Requirement Details:**

1. Structured tag taxonomy with categories and hierarchy
2. Tag entries with multiple tags
3. Search by tag combination (AND/OR operators)
4. Popular tags ranking
5. Tag-based faceted filtering on search results

**Acceptance Criteria:**

1. GIVEN tag taxonomy with categories WHEN searching by tags "python,backend" with AND THEN only entries with BOTH tags returned
2. GIVEN entries WHEN popular tags queried THEN tags ranked by usage count
3. GIVEN hierarchical tags (e.g., "language/python") WHEN parent tag searched THEN child tag entries included

---

#### STORY 10: Search Analytics & Query Optimization

> As a KB admin, I want search analytics & query optimization so that I can identify content gaps

**Requirement Details:**

1. Log all search queries with results count
2. Identify zero-result queries (content gaps)
3. Track popular queries and trending topics
4. Recommendations for content creation based on gaps

**Acceptance Criteria:**

1. GIVEN search query with 0 results WHEN analytics queried THEN query appears in zero_results list
2. GIVEN 30 days of search data WHEN trends analyzed THEN popular topics and emerging gaps identified
3. GIVEN content gaps WHEN recommendations generated THEN actionable suggestions for new entries provided

---

#### STORY 11: Citation Tracking & Source Attribution

> As an AI agent, I want citation tracking & source attribution so that I can trace which entries I used

**Requirement Details:**

1. Record when an AI agent cites/uses a KB entry
2. Track citation context (what was the query, which agent)
3. Most-cited entries ranking
4. Uncited entries identification (potentially low-value)

**Acceptance Criteria:**

1. GIVEN AI agent uses entry in response WHEN citation recorded THEN entry citation count increases
2. GIVEN entries WHEN most_cited queried THEN entries ranked by citation count
3. GIVEN entries never cited WHEN uncited queried THEN list of potentially low-value entries returned

---

#### STORY 12: Confidence Scoring for Search Results

> As an AI agent, I want confidence scoring for search results so that I can filter unreliable entries

**Requirement Details:**

1. Confidence score per search result (combines quality score, freshness, citations, feedback)
2. min_confidence filter on search
3. Confidence stats per tier/type
4. Unreliable entries identification (low confidence)

**Acceptance Criteria:**

1. GIVEN search results WHEN confidence scored THEN each result has confidence 0.0-1.0
2. GIVEN min_confidence=0.7 WHEN searching THEN only results with confidence ≥ 0.7 returned
3. GIVEN entries WHEN unreliable queried THEN entries with confidence < threshold returned

---

#### STORY 13: Feedback Loop (Thumbs Up/Down)

> As a user, I want feedback loop (thumbs up/down) so that entry quality improves over time

**Requirement Details:**

1. Submit feedback (thumbs up/down + optional comment) on entries
2. Feedback impacts quality score and search ranking
3. View feedback history per entry
4. Top-rated and low-rated entries lists

**Acceptance Criteria:**

1. GIVEN entry WHEN thumbs up submitted THEN quality score increases, entry ranks higher in future searches
2. GIVEN entry WHEN thumbs down with comment THEN quality score decreases, comment stored for review
3. GIVEN entries WHEN top_rated queried THEN entries with most positive feedback returned

---

#### STORY 14: Web Viewer UI for Knowledge Base

> As a human user, I want a web viewer UI for KB so that I can browse/search without MCP tools

**Requirement Details:**

1. Read-only web interface (no edit features in v1)
2. Search with faceted filtering
3. Browse by tier, type, tags
4. Entry detail view with metadata, attachments, related entries
5. FastAPI backend serving the UI

**Acceptance Criteria:**

1. GIVEN web UI WHEN user searches THEN results displayed with facets, quality scores, confidence
2. GIVEN entry detail page WHEN viewed THEN shows content, metadata, attachments, related entries, citations
3. GIVEN web UI WHEN accessed THEN no authentication required (single workspace, local access)

---

#### STORY 15: Slack/Teams Bot Integration

> As a team member, I want Slack/Teams bot integration so that the whole team can access KB

**Requirement Details:**

1. Slack bot responds to KB queries
2. Returns top results with links
3. Supports suggestions (type-ahead in Slack)
4. Respects RBAC from Sprint 1

**Acceptance Criteria:**

1. GIVEN Slack message "@kb-bot search authentication" WHEN processed THEN top 5 results returned in thread
2. GIVEN Slack bot WHEN user without permission queries restricted entry THEN access denied message

---

#### STORY 16: KB Health Dashboard & Metrics

> As a KB admin, I want a health dashboard & metrics so that I can monitor KB health at a glance

**Requirement Details:**

1. Overall KB health score
2. Metrics: total entries, stale %, quality distribution, zero-result rate, coverage gaps
3. Actionable recommendations
4. Trend analysis (improving/declining)

**Acceptance Criteria:**

1. GIVEN dashboard WHEN viewed THEN shows overall health score with breakdown per pillar
2. GIVEN declining quality trend WHEN detected THEN recommendation generated (e.g., "Review 15 stale entries")
3. GIVEN zero-result rate > 5% WHEN detected THEN content gap recommendations generated

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Python MemoryEngine | System | N/A | Core engine phải stable trước khi enhance |
| SQLite FTS5 | Infrastructure | N/A | Full-text search foundation |
| Vector embeddings | System | N/A | Semantic search capability |
| Graph database (SQLite) | System | N/A | Relationship tracking |
| kb-standard.md | Compliance | N/A | Evaluation criteria document |
| KSA-69 → KSA-72 | System | KSA-69, KSA-70, KSA-71, KSA-72 | Sprint 1 — Governance foundation |
| KSA-73 → KSA-75 | System | KSA-73, KSA-74, KSA-75 | Sprint 2 — Quality (depends on Sprint 1) |
| KSA-76 → KSA-78 | System | KSA-76, KSA-77, KSA-78 | Sprint 3 — Findability (depends on Sprint 2) |
| KSA-79 → KSA-81 | System | KSA-79, KSA-80, KSA-81 | Sprint 4 — AI-Ready (depends on Sprint 2-3) |
| KSA-82 → KSA-84 | System | KSA-82, KSA-83, KSA-84 | Sprint 5 — UX (depends on all above) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Duc Nguyen Minh | Prioritize, accept/reject features | Reporter |
| Developer (Backend) | Dev Agent | Implementation, DB migrations, MCP tools | Sprint 1-5 |
| Business Analyst | BA Agent | Template design, content structure | Sprint 2 |
| Solution Architect | SA Agent | Architecture review for consolidation engine | Sprint 1 |
| QA | QA Agent | Integration tests per sprint, E2E after Sprint 5 | Sprint 1-5 |
| Developer (Frontend) | Dev Agent (FE) | Web Viewer UI | Sprint 5 |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Consolidation merge corrupts data | High | Medium | Dry-run mode first, backup before merge |
| Quality scoring too strict → rejects valid content | Medium | Medium | Start with WARN mode, tune thresholds |
| Web UI scope creep | Medium | High | Read-only only, no edit features in v1 |
| Slack bot security (who can ingest) | Medium | Low | RBAC from Sprint 1 applies |
| Vector search performance with 3000+ entries | Low | Low | Already tested at scale, add caching |
| Breaking changes to existing MCP tools | High | Low | Backward-compatible API, deprecation warnings |

### 5.2 Assumptions

- SQLite performance is sufficient for 10,000+ entries (no need to migrate to PostgreSQL)
- Single workspace deployment (no multi-tenant requirements)
- AI agents are the primary consumers (human UI is secondary)
- kb-standard.md criteria are stable and won't change during implementation
- Existing 12 MCP tools continue to work without breaking changes

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Search response < 500ms | Including vector + FTS5 + graph combined search |
| Performance | Consolidation < 30s for full scan | 3000+ entries full consolidation cycle |
| Performance | Quality scoring < 100ms per entry | Real-time scoring on ingest |
| Scalability | Support 10,000+ entries | Without performance degradation |
| Scalability | Support 25+ MCP tools | From current 12 to 25 tools |
| Availability | 99.9% uptime for MCP tools | Local SQLite, no network dependency |
| Security | RBAC enforcement | Owner/reviewer permissions on all write operations |
| Security | Audit trail | All consolidation, delete, merge operations logged |
| Maintainability | Modular architecture | Each pillar as independent module |
| Testability | Integration tests per feature | Automated test suite for all MCP tools |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-68 | KB System Enhancement — Achieve 100% across all 5 Pillars | Done | Epic | Main ticket |
| KSA-69 | Real Consolidation Engine (Promote/Demote/Merge) | Done | Story | Child of KSA-68 |
| KSA-70 | Staleness Detection & Auto-Archive | Done | Story | Child of KSA-68 |
| KSA-71 | Owner/Reviewer Assignment & RBAC | Done | Story | Child of KSA-68 |
| KSA-72 | Scheduled Review Reminders | Done | Story | Child of KSA-68, depends on KSA-70, KSA-71 |
| KSA-73 | Template Enforcement Engine | Done | Story | Child of KSA-68 |
| KSA-74 | Content Quality Scoring & Validation | Done | Story | Child of KSA-68, depends on KSA-71 |
| KSA-75 | Rich Media Support (Attachments) | Done | Story | Child of KSA-68 |
| KSA-76 | Auto-Suggestions & Related Entries | Done | Story | Child of KSA-68 |
| KSA-77 | Faceted Search with Tag Taxonomy | Done | Story | Child of KSA-68 |
| KSA-78 | Search Analytics & Query Optimization | Done | Story | Child of KSA-68 |
| KSA-79 | Citation Tracking & Source Attribution | Done | Story | Child of KSA-68 |
| KSA-80 | Confidence Scoring for Search Results | Done | Story | Child of KSA-68, depends on KSA-74, KSA-79 |
| KSA-81 | Feedback Loop (Thumbs Up/Down) | Done | Story | Child of KSA-68 |
| KSA-82 | Web Viewer UI for Knowledge Base | Done | Story | Child of KSA-68, depends on Sprint 1-4 |
| KSA-83 | Slack/Teams Bot Integration | Done | Story | Child of KSA-68, depends on KSA-76 |
| KSA-84 | KB Health Dashboard & Metrics | Done | Story | Child of KSA-68, depends on KSA-74, KSA-78 |

---

## 8. Appendix

### New MCP Tools Summary (12 → 25 tools)

| Sprint | New Tools | Purpose |
|--------|-----------|---------|
| 1 | `mem_consolidate`, `mem_lifecycle`, `mem_scoring` | Governance & lifecycle management |
| 2 | `mem_templates`, `mem_attachments` | Content quality & structure |
| 3 | `mem_discover`, `mem_tags` | Findability & search |
| 4 | `mem_citations`, `mem_scoring` (enhanced) | AI-ready features |
| 5 | `mem_admin` (dashboard) | UX & integration |

### Glossary

| Term | Definition |
|------|------------|
| KB | Knowledge Base — hệ thống lưu trữ và truy xuất kiến thức |
| MCP | Model Context Protocol — giao thức giao tiếp giữa AI agents và tools |
| FTS5 | Full-Text Search 5 — SQLite extension cho full-text search |
| Tier | Cấp độ lưu trữ: WORKING → EPISODIC → SEMANTIC → PROCEDURAL |
| Pillar | Trụ cột đánh giá chất lượng KB theo kb-standard.md |
| Staleness | Trạng thái entry lỗi thời, không được access/review trong thời gian dài |
| Consolidation | Quá trình tổ chức lại entries (promote/demote/merge) |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| kb-standard.md | Evaluation criteria for KB quality |
| sprint-plan.md | documents/KSA-68/sprint-plan.md |
| kb-improvements-report.md | documents/KSA-68/kb-improvements-report.md |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

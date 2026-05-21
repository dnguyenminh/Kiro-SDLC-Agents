# Business Requirements Document (BRD)

## KB Web Viewer — KSA-86: Frontend HTML Update (Dashboard, Tags, Quality, Analytics Pages)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-86 |
| Title | Frontend HTML Update: Dashboard, Tags, Quality, Analytics Pages |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | BA Agent | Initiate document — based on existing implementation and kb-standard.md |

---

## 1. Introduction

### 1.1 Scope

Xây dựng 4 trang frontend HTML cho KB Web Viewer (port 3201) nhằm cung cấp giao diện trực quan để quản lý và giám sát hệ thống Knowledge Base. Các trang bao gồm:

1. **Dashboard** — Tổng quan sức khỏe KB (health gauge, metrics, recommendations, trends)
2. **Tags** — Quản lý taxonomy (tag cloud, taxonomy tree, search by tag)
3. **Quality** — Giám sát chất lượng entries (stats, distribution chart, low-quality table)
4. **Analytics** — Phân tích search patterns (popular queries, zero-result gaps, trend line)
5. **Navigation** — Tab bar liên kết tất cả pages

### 1.2 Out of Scope

- Backend API development (đã hoàn thành — 15 endpoints sẵn sàng)
- Graph visualization page (đã có sẵn tại `/`)
- Authentication/authorization cho viewer
- Mobile native app
- Data export (CSV/PDF) từ các pages

### 1.3 Preliminary Requirement

- Backend APIs đã deploy và hoạt động (15 endpoints tại `/api/kb/*`)
- KB Web Viewer server chạy trên port 3201
- Browser hỗ trợ ES6+ (Canvas API cho charts)

---

## 2. Business Requirements

### 2.1 High Level Process Map

KB Web Viewer là công cụ giám sát và quản lý Knowledge Base, cho phép:
1. Xem tổng quan sức khỏe hệ thống (Dashboard)
2. Khám phá và tìm kiếm theo tags (Tags)
3. Đánh giá chất lượng nội dung (Quality)
4. Phân tích hành vi tìm kiếm (Analytics)

**Business Context (từ kb-standard.md):**
Một hệ thống KB tốt cần có giao diện trực quan (Clean UI), hỗ trợ Dark mode, và cho phép giám sát chất lượng nội dung liên tục. Các trang frontend này hiện thực hóa các trụ cột: Findability (Tags), Content Quality (Quality), và UX (Dashboard + Analytics).

### 2.2 List of User Stories

| # | Story | Priority | Source |
|---|-------|----------|--------|
| 1 | As a KB Admin, I want to see overall health score so that I can quickly assess KB status | MUST HAVE | KSA-86 |
| 2 | As a KB Admin, I want to browse tags visually so that I can understand content taxonomy | MUST HAVE | KSA-86 |
| 3 | As a KB Admin, I want to identify low-quality entries so that I can prioritize content improvement | MUST HAVE | KSA-86 |
| 4 | As a KB Admin, I want to see search analytics so that I can identify content gaps | MUST HAVE | KSA-86 |
| 5 | As a KB Admin, I want consistent navigation across all pages so that I can switch context quickly | MUST HAVE | KSA-86 |
| 6 | As a KB Admin, I want responsive layout so that I can use the viewer on different screen sizes | SHOULD HAVE | KSA-86 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User mở KB Web Viewer (http://localhost:3201)

**Step 2:** User chọn tab từ navigation bar (Graph / Dashboard / Tags / Quality / Analytics)

**Step 3:** Page tự động fetch data từ backend APIs

**Step 4:** UI render data thành visual components (gauges, charts, tables, clouds)

**Step 5:** User tương tác (click tag, sort table, hover chart) để drill-down

---

#### STORY 1: Dashboard — Health Score & Metrics Overview

> As a KB Admin, I want to see overall health score so that I can quickly assess KB status and take action on recommendations.

**Requirement Details:**

1. Hiển thị Health Score dạng gauge (0-100) với color coding (green ≥70, yellow ≥40, red <40)
2. Hiển thị 4 metric cards: Total Entries, Quality Average, Stale Count, Unowned Count
3. Hiển thị danh sách Recommendations với priority levels (high/low)
4. Hiển thị Trends charts (7 ngày): Search Volume và Ingest Volume

**Acceptance Criteria:**

1. Health gauge hiển thị score chính xác từ API `/api/kb/dashboard`
2. Gauge color thay đổi theo threshold: green (≥70), yellow (≥40), red (<40)
3. Metric cards hiển thị 4 KPIs với label và subtitle
4. Recommendations list hiển thị với color-coded priority borders
5. Trend charts render bar charts từ 7-day data
6. Page load hoàn thành trong < 2 giây

---

#### STORY 2: Tags — Tag Cloud & Taxonomy Browser

> As a KB Admin, I want to browse tags visually so that I can understand content taxonomy and find entries by tag.

**Requirement Details:**

1. Hiển thị Popular Tags dạng tag cloud với font-size tỷ lệ usage count
2. Hiển thị Tag Taxonomy dạng tree (parent → children)
3. Cho phép search entries by tag (click tag hoặc type in search box)
4. Tag colors dựa trên hash của tag name (consistent across sessions)

**Acceptance Criteria:**

1. Tag cloud hiển thị top 30 popular tags từ API `/api/kb/tags/popular`
2. Font size tỷ lệ thuận với usage_count (min 0.65rem, max 1.45rem)
3. Taxonomy tree hiển thị hierarchical structure từ API `/api/kb/tags`
4. Click tag → hiển thị related entries trong results section
5. Search input hỗ trợ Enter key để trigger search
6. Empty state hiển thị message phù hợp khi không có data

---

#### STORY 3: Quality — Score Distribution & Low-Quality Table

> As a KB Admin, I want to identify low-quality entries so that I can prioritize content improvement.

**Requirement Details:**

1. Hiển thị Quality Overview cards: Average Score, Scored Entries, High Quality count, Low Quality count
2. Hiển thị Score Distribution chart (bar chart theo score buckets)
3. Hiển thị Low Quality Entries table (ID, Type, Summary, Score, Visual bar)
4. Score bar color coding: green (≥60), yellow (≥30), red (<30)

**Acceptance Criteria:**

1. Stats cards hiển thị 4 metrics từ API `/api/kb/quality`
2. Distribution chart render bar chart với color-coded bars
3. Low-quality table hiển thị top 20 entries từ API `/api/kb/quality/low?threshold=40`
4. Table rows có hover effect
5. Score bars hiển thị visual progress với correct colors
6. Summary text truncated tại 60 characters

---

#### STORY 4: Analytics — Search Patterns & Content Gaps

> As a KB Admin, I want to see search analytics so that I can identify content gaps and popular topics.

**Requirement Details:**

1. Hiển thị Search Volume Trend (line chart với area fill)
2. Hiển thị Popular Queries table (Query, Count, Avg Results)
3. Hiển thị Zero-Result Queries table (Query, Count, Status badge)
4. Two-column layout cho tables (responsive → single column on mobile)

**Acceptance Criteria:**

1. Trend chart render line + area chart từ API `/api/kb/analytics`
2. Popular queries table hiển thị top 15 queries với count badges
3. Zero-result table hiển thị content gaps với warning badges
4. Layout responsive: 2 columns trên desktop, 1 column trên mobile (≤768px)
5. Empty states hiển thị "No data yet" / "No gaps detected"
6. Data points trên trend chart có dot markers

---

#### STORY 5: Navigation — Consistent Tab Bar

> As a KB Admin, I want consistent navigation across all pages so that I can switch context quickly.

**Requirement Details:**

1. Navigation bar hiển thị 5 tabs: Graph, Dashboard, Tags, Quality, Analytics
2. Active tab highlighted (background + text color change)
3. Navigation responsive (flex-wrap on small screens)

**Acceptance Criteria:**

1. Nav bar hiển thị trên tất cả 5 pages
2. Active page tab có class "active" với distinct styling
3. Click tab navigate đến correct URL
4. Nav items wrap trên small screens (không bị overflow)

---

#### STORY 6: Responsive Design

> As a KB Admin, I want responsive layout so that I can use the viewer on different screen sizes.

**Requirement Details:**

1. Grid layouts sử dụng `auto-fit` với `minmax()` cho cards
2. Two-column layouts collapse thành single column tại breakpoint 768px
3. Font sizes sử dụng rem units
4. Canvas charts có max-width constraints

**Acceptance Criteria:**

1. Dashboard cards grid responsive (min 200px per card)
2. Quality cards grid responsive (min 180px per card)
3. Analytics two-column → single column tại ≤768px
4. Tags cloud wraps naturally (flex-wrap)
5. No horizontal scroll trên mobile viewports

---

## 3. Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| Backend APIs (15 endpoints) | System | `/api/kb/dashboard`, `/api/kb/tags`, `/api/kb/quality`, `/api/kb/analytics`, etc. |
| KB Web Viewer Server | Infrastructure | Python HTTP server running on port 3201 |
| Canvas API | Browser | Required for chart rendering (no external chart library) |
| Modern Browser | External | ES6+ support (async/await, template literals, arrow functions) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | KB Team | Define requirements, accept deliverables |
| Developer | Dev Team | Implement HTML/CSS/JS pages |
| QA | QA Team | Verify UI behavior and responsiveness |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Canvas charts không render đúng trên tất cả browsers | Medium | Low | Test trên Chrome, Firefox, Edge |
| API response chậm → UI blank | Medium | Medium | Thêm loading states và error handling |
| Large dataset (>1000 tags) → performance issue | Low | Low | Limit API responses (top 30 tags, top 20 entries) |

### 5.2 Assumptions

- Backend APIs đã stable và trả về đúng format
- Không cần authentication cho viewer (internal tool)
- Dark theme là default (không cần light mode toggle)
- Vanilla JS (không dùng framework — React, Vue, etc.)
- Charts render bằng Canvas API (không dùng Chart.js hay D3)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Page load < 2s | Tất cả pages phải render hoàn chỉnh trong 2 giây |
| Performance | API calls parallel | Mỗi page chỉ gọi 1-2 API endpoints |
| Accessibility | Color contrast | Text readable trên dark background (#e2e8f0 on #0f172a) |
| Accessibility | Semantic HTML | Sử dụng proper heading hierarchy (h2, h3) |
| Responsive | Mobile-friendly | Usable trên viewport ≥ 320px |
| Maintainability | Single-file pages | Mỗi page là 1 Python file chứa HTML/CSS/JS inline |
| Security | XSS prevention | Escape HTML entities trong user-generated content |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-86 | Frontend HTML Update: Dashboard, Tags, Quality, Analytics | Story | Main ticket |
| KSA-82 | Enhanced KB Viewer API routes | Story | Dependency (APIs) |

---

## 8. Appendix

### API Endpoints Used

| Page | Endpoint | Method | Purpose |
|------|----------|--------|---------|
| Dashboard | `/api/kb/dashboard` | GET | Health score, metrics, recommendations, trends |
| Tags | `/api/kb/tags/popular?limit=30` | GET | Popular tags with usage counts |
| Tags | `/api/kb/tags` | GET | Tag taxonomy tree |
| Tags | `/api/memory/search?q={tag}` | GET | Search entries by tag |
| Quality | `/api/kb/quality` | GET | Quality stats and distribution |
| Quality | `/api/kb/quality/low?threshold=40&limit=20` | GET | Low-quality entries list |
| Analytics | `/api/kb/analytics` | GET | Popular queries, gaps, trends |

### Design System

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0f172a` | Page background (slate-900) |
| Surface | `#1e293b` | Card/panel background (slate-800) |
| Border | `#334155` | Card borders (slate-700) |
| Text Primary | `#e2e8f0` | Main text (slate-200) |
| Text Secondary | `#94a3b8` | Labels, subtitles (slate-400) |
| Accent | `#38bdf8` | Primary accent, links (sky-400) |
| Success | `#22c55e` | Good scores, healthy (green-500) |
| Warning | `#f59e0b` | Medium scores, attention (amber-500) |
| Danger | `#ef4444` | Low scores, critical (red-500) |
| Purple | `#a78bfa` | Secondary accent (violet-400) |
| Font | `system-ui` | System font stack |

### Glossary

| Term | Definition |
|------|------------|
| Health Score | Composite metric (0-100) reflecting overall KB quality |
| Stale Entry | KB entry not reviewed within configured threshold |
| Zero-Result Query | Search query that returned no results (content gap) |
| Tag Cloud | Visual representation of tags where size = popularity |
| Score Distribution | Histogram of quality scores across all entries |

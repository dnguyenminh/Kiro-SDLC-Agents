# Business Requirements Document (BRD)

## KB Web Viewer — KSA-93: UX Improvement & Zero-Training User Guide

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-93 |
| Title | UX Improvement & Zero-Training User Guide for KB Web Viewer |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-01-28 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SM Agent – Scrum Master | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-28 | BA Agent | Initiate document — auto-generated from Jira Epic KSA-93 and child tasks KSA-94 to KSA-100 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Cải thiện trải nghiệm người dùng (UX) của KB Web Viewer để đạt mục tiêu **Zero-Training** — user có thể sử dụng ngay lần đầu mà không cần đọc tài liệu bên ngoài. Phạm vi bao gồm:

- **5 pages**: Graph (4 tabs: Graph/Sessions/Browser/Stream), Dashboard, Tags, Quality, Analytics
- In-app onboarding tour cho first-time users
- Contextual tooltips cho mọi component
- Smart empty states thay vì blank screens
- Actionable recommendations với "Fix Now" buttons
- Graph auto-analysis (detect patterns, suggest actions)
- Embedded help/user guide trong UI
- UI redesign cho information hierarchy rõ ràng

### 1.2 Out of Scope

- Backend API changes (chỉ thêm endpoints mới nếu cần, không refactor existing)
- Database schema changes
- Authentication/authorization (viewer hiện tại không có auth)
- Mobile-native app
- Multi-language/i18n support
- Performance optimization của 3D graph rendering engine

### 1.3 Preliminary Requirement

- KB Web Viewer đang hoạt động trên port 3201
- Python HTTP server với vanilla HTML/CSS/JS frontend
- Existing API endpoints tại `/api/kb/*` và `/api/memory/*`
- Dark theme đã implement (bg #0f172a, surface #1e293b)
- User Guide document (KSA-86) đã có nội dung để embed

---

## 2. Business Requirements

### 2.1 High Level Process Map

**Current State:** User mở KB Web Viewer → thấy 3D graph hoặc dashboard → không biết ý nghĩa các metrics → phải mở USER-GUIDE.md bên ngoài → đọc xong quay lại viewer → mới hiểu cách dùng.

**Target State:** User mở KB Web Viewer lần đầu → onboarding tour tự động highlight từng section → tooltips giải thích mọi component → empty states hướng dẫn bước tiếp theo → recommendations có nút action → user productive ngay lập tức.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a first-time user, I want an onboarding tour so that I understand the viewer's capabilities without reading external docs | MUST HAVE | KSA-94 |
| 2 | As a user, I want contextual tooltips on every component so that I can learn what each element does on hover | MUST HAVE | KSA-95 |
| 3 | As a user, I want smart empty states so that when there's no data, I know exactly what to do next | MUST HAVE | KSA-96 |
| 4 | As a user, I want actionable recommendations with "Fix Now" buttons so that I can resolve issues directly from the UI | SHOULD HAVE | KSA-97 |
| 5 | As a user, I want the Graph page to auto-analyze patterns and suggest actions so that I discover insights without manual exploration | SHOULD HAVE | KSA-98 |
| 6 | As a user, I want embedded help content accessible via ? icons so that I can get detailed guidance without leaving the viewer | SHOULD HAVE | KSA-99 |
| 7 | As a user, I want a redesigned UI with clear information hierarchy so that I can find what I need faster | SHOULD HAVE | KSA-100 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User opens KB Web Viewer (http://localhost:3201) for the first time

**Step 2:** System detects first visit (localStorage flag) → triggers onboarding tour

**Step 3:** Tour highlights key areas: navigation, graph controls, search, tabs

**Step 4:** User completes tour (or skips) → tour dismissed, flag saved

**Step 5:** User navigates pages → tooltips appear on hover over ? icons

**Step 6:** If page has no data → smart empty state shows "Getting Started" guide

**Step 7:** Dashboard/Quality pages show recommendations → user clicks "Fix Now" → action executes via API

**Step 8:** Graph page auto-analyzes → shows insight panel (orphans, clusters, stale nodes)

**Step 9:** User clicks ? icon on any section → slide-in help panel shows relevant guide content

> **Note:** All UX improvements are progressive — they enhance but never block the existing workflow. User can dismiss/skip any guidance element.

---

#### STORY 1: In-app Onboarding Tour (KSA-94)

> As a first-time user, I want an onboarding tour so that I understand the viewer's capabilities without reading external docs.

**Requirement Details:**

1. Tour triggers automatically on first visit (detected via `localStorage`)
2. Tour consists of 6-8 steps highlighting key UI areas
3. Each step has: title, description, highlighted element, position indicator (1/N)
4. User can navigate: Next, Previous, Skip Tour
5. Tour overlay dims background, spotlights target element
6. Tour state persists — once completed/skipped, doesn't show again
7. User can re-trigger tour from Help menu (? icon → "Restart Tour")
8. Tour adapts to current page (Graph tour vs Dashboard tour)

**Tour Steps (Graph Page):**

| Step | Target Element | Title | Description |
|------|---------------|-------|-------------|
| 1 | Navigation bar | Welcome to KB Viewer | Navigate between Graph, Dashboard, Tags, Quality, Analytics |
| 2 | Graph canvas | Knowledge Graph | Your entries visualized as a 3D network. Drag to rotate, scroll to zoom |
| 3 | Tab bar | View Modes | Switch between Graph, Sessions, Browser, and Stream views |
| 4 | Search box | Search | Find entries by keyword — matching nodes highlight in the graph |
| 5 | Module dropdown | Focus | Jump to a specific module cluster |
| 6 | Stats panel | Quick Stats | Entry counts, relationship counts, health score at a glance |

**Acceptance Criteria:**

1. Tour appears on first visit (no prior localStorage flag)
2. Tour does NOT appear on subsequent visits
3. User can skip tour at any step → flag saved as "skipped"
4. User can restart tour from Help menu
5. Tour steps highlight correct elements with spotlight effect
6. Tour is responsive — works on viewport ≥ 1024px width
7. Tour does not interfere with page functionality when dismissed
8. Dark theme consistent: overlay bg rgba(0,0,0,0.7), tooltip bg #1e293b

---

#### STORY 2: Contextual Tooltips (KSA-95)

> As a user, I want contextual tooltips on every component so that I can learn what each element does on hover.

**Requirement Details:**

1. Every major UI component has a small ? icon (help trigger)
2. Hovering ? icon shows tooltip popup with explanation
3. Tooltip content is concise (max 2-3 sentences)
4. Tooltips positioned intelligently (avoid viewport overflow)
5. Tooltips dismiss on mouse-out or click elsewhere
6. Tooltip styling matches dark theme

**Tooltip Locations:**

| Page | Component | Tooltip Content |
|------|-----------|-----------------|
| Graph | Node colors | "Colors represent entry types: blue=DECISION, green=ARCHITECTURE, orange=ERROR_PATTERN..." |
| Graph | Edge thickness | "Thicker edges = stronger relationships (higher confidence score)" |
| Dashboard | Health Score | "Overall KB health: combines quality, freshness, coverage metrics (0-100)" |
| Dashboard | Due Reviews | "Entries not reviewed in 90+ days. Click to see details" |
| Tags | Tag cloud | "Larger tags = more entries. Click a tag to filter entries" |
| Quality | Quality Score | "Based on: content length, structure, citations, freshness (0-100)" |
| Analytics | Zero Results | "Searches that returned no results — indicates content gaps" |

**Acceptance Criteria:**

1. ≥ 15 tooltips across all 5 pages
2. Tooltips appear within 200ms of hover
3. Tooltips disappear within 100ms of mouse-out
4. No tooltip overflows viewport (auto-repositions)
5. Tooltip text is readable (min 14px, contrast ratio ≥ 4.5:1)
6. Tooltips work on both desktop hover and touch (tap ? icon)

---

#### STORY 3: Smart Empty States (KSA-96)

> As a user, I want smart empty states so that when there's no data, I know exactly what to do next.

**Requirement Details:**

1. Every page/section that can be empty shows a helpful empty state instead of blank
2. Empty state includes: icon, title, description, action button(s)
3. Action buttons link to relevant actions (e.g., "Ingest your first document")
4. Empty states are contextual — different message per page/section

**Empty State Definitions:**

| Page/Section | Condition | Title | Description | Action |
|-------------|-----------|-------|-------------|--------|
| Graph (no nodes) | 0 entries in KB | "Your Knowledge Graph is Empty" | "Start by ingesting documents, decisions, or code analysis into the KB" | "Learn How to Ingest" → help panel |
| Dashboard (no data) | 0 entries | "No Data Yet" | "The dashboard shows KB health metrics. Ingest some content to get started" | "Quick Start Guide" |
| Tags (no tags) | 0 tags | "No Tags Created" | "Tags help organize entries. They're auto-created during ingestion or added manually" | "How Tags Work" |
| Quality (all good) | 0 low-quality entries | "All Entries Look Good! ✓" | "No quality issues detected. Keep up the good work!" | None (positive state) |
| Analytics (no searches) | 0 search history | "No Search Data" | "Analytics appear after users search the KB. Start searching to generate insights" | "Try a Search" → focus search box |
| Sessions (no sessions) | 0 sessions | "No Agent Sessions" | "Sessions are recorded when AI agents interact with the KB" | "How Sessions Work" |
| Browser (no entries) | 0 entries matching filter | "No Entries Match" | "Try adjusting your filters or search terms" | "Clear Filters" button |

**Acceptance Criteria:**

1. Every empty state has icon + title + description
2. At least 5 empty states have actionable buttons
3. Empty states disappear immediately when data becomes available (no page reload needed for API-driven pages)
4. Empty state styling: centered, max-width 400px, icon 48px, title 18px bold, desc 14px muted
5. Action buttons use primary color (#3b82f6) with hover state

---

#### STORY 4: Actionable Recommendations with "Fix Now" (KSA-97)

> As a user, I want actionable recommendations with "Fix Now" buttons so that I can resolve issues directly from the UI.

**Requirement Details:**

1. Dashboard and Quality pages show recommendations for improving KB health
2. Each recommendation has: severity icon, description, "Fix Now" button
3. "Fix Now" triggers an API call to resolve the issue
4. After action completes, recommendation updates (success/failure feedback)
5. Recommendations are prioritized by impact

**Recommendation Types:**

| Type | Trigger Condition | Action | API Call |
|------|-------------------|--------|----------|
| Stale entries | Entry not reviewed > 90 days | Mark as reviewed | POST /api/kb/entries/{id}/review |
| Low quality | Quality score < 40 | Open edit panel | Navigate to entry detail |
| Missing tags | Entry has 0 tags | Suggest tags | POST /api/kb/entries/{id}/auto-tag |
| Orphan nodes | Entry has 0 relationships | Suggest related | POST /api/kb/entries/{id}/find-related |
| Duplicate content | High similarity between entries | Merge entries | POST /api/kb/entries/merge |

**Acceptance Criteria:**

1. Dashboard shows top 5 recommendations sorted by priority
2. Quality page shows all recommendations for low-quality entries
3. "Fix Now" button shows loading state during API call
4. Success: green checkmark + "Fixed!" message, recommendation fades out
5. Failure: red X + error message, button re-enabled for retry
6. Recommendations refresh after each action (no stale list)

---

#### STORY 5: Graph Auto-Analysis (KSA-98)

> As a user, I want the Graph page to auto-analyze patterns and suggest actions so that I discover insights without manual exploration.

**Requirement Details:**

1. Graph page runs analysis on load (or on-demand via "Analyze" button)
2. Analysis detects: orphan nodes, large clusters, stale nodes, disconnected subgraphs
3. Results shown in a collapsible "Insights" panel on the right side
4. Each insight is clickable — highlights relevant nodes in the graph
5. Insights have suggested actions

**Analysis Types:**

| Insight | Detection Logic | Suggested Action |
|---------|----------------|------------------|
| Orphan Nodes | Nodes with 0 edges | "Add relationships to connect these entries" |
| Large Clusters | Subgraph with > 20 nodes | "Consider splitting into sub-topics" |
| Stale Nodes | Nodes not updated > 180 days | "Review and update these entries" |
| Hub Nodes | Nodes with > 10 edges | "These are key knowledge hubs — ensure they're high quality" |
| Disconnected Subgraphs | Separate graph components | "These groups are isolated — consider cross-linking" |

**Acceptance Criteria:**

1. Analysis runs within 2 seconds for graphs up to 500 nodes
2. Insights panel shows ≥ 3 insight types when applicable
3. Clicking an insight highlights relevant nodes (pulsing animation)
4. Insights panel is collapsible (default: collapsed on small screens, expanded on large)
5. "Analyze" button available for manual re-run
6. Analysis results cached until graph data changes

---

#### STORY 6: User Guide Integration (KSA-99)

> As a user, I want embedded help content accessible via ? icons so that I can get detailed guidance without leaving the viewer.

**Requirement Details:**

1. Each page section has a ? icon in the header
2. Clicking ? opens a slide-in panel from the right (width: 400px)
3. Panel shows relevant section from User Guide (KSA-86 content)
4. Panel has: title, content (markdown rendered), "Close" button, "Open Full Guide" link
5. Content is context-aware — shows section relevant to current page/component
6. Panel doesn't block main content (overlay with click-outside-to-close)

**Help Content Mapping:**

| Page | Section | Guide Content Source |
|------|---------|---------------------|
| Graph | Graph tab | USER-GUIDE §2.1 (3D Knowledge Graph) |
| Graph | Sessions tab | USER-GUIDE §2.2 (Sessions) |
| Graph | Browser tab | USER-GUIDE §2.3 (Browser) |
| Graph | Stream tab | USER-GUIDE §2.4 (Stream) |
| Dashboard | Main | USER-GUIDE §3 (Dashboard) |
| Tags | Main | USER-GUIDE §4 (Tags) |
| Quality | Main | USER-GUIDE §5 (Quality) |
| Analytics | Main | USER-GUIDE §6 (Analytics) |

**Acceptance Criteria:**

1. ? icon visible on every page header and major section header
2. Help panel slides in from right with 300ms animation
3. Panel content matches current page context
4. Panel closes on: X button, click outside, Escape key
5. Content renders markdown (headers, lists, code blocks, links)
6. "Open Full Guide" links to complete USER-GUIDE.md (or external URL)
7. Panel is scrollable for long content sections

---

#### STORY 7: UI Redesign for Clarity (KSA-100)

> As a user, I want a redesigned UI with clear information hierarchy so that I can find what I need faster.

**Requirement Details:**

1. Apply progressive disclosure — show summary first, details on demand
2. Improve information hierarchy with consistent typography scale
3. Add visual grouping (cards, sections) to reduce cognitive load
4. Improve navigation with active state indicators and breadcrumbs
5. Standardize component patterns across all pages
6. Ensure consistent spacing, alignment, and color usage

**Design Tokens:**

| Token | Value | Usage |
|-------|-------|-------|
| --bg-primary | #0f172a | Page background |
| --bg-surface | #1e293b | Card/panel background |
| --bg-elevated | #334155 | Hover states, elevated surfaces |
| --border-default | #334155 | Borders, dividers |
| --border-focus | #3b82f6 | Focus rings, active states |
| --text-primary | #e2e8f0 | Primary text |
| --text-secondary | #94a3b8 | Secondary/muted text |
| --text-accent | #3b82f6 | Links, interactive elements |
| --color-success | #22c55e | Success states |
| --color-warning | #f59e0b | Warning states |
| --color-error | #ef4444 | Error states |
| --color-info | #06b6d4 | Info states |

**Typography Scale:**

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| H1 | 24px | 700 | Page titles |
| H2 | 20px | 600 | Section headers |
| H3 | 16px | 600 | Card titles |
| Body | 14px | 400 | Content text |
| Small | 12px | 400 | Captions, metadata |

**Acceptance Criteria:**

1. All pages use consistent typography scale (no arbitrary font sizes)
2. Cards have consistent padding (16px), border-radius (8px), border color
3. Navigation shows active page with visual indicator (left border or bg highlight)
4. Spacing follows 4px grid (4, 8, 12, 16, 24, 32, 48px)
5. Interactive elements have visible hover/focus states
6. Information density reduced — no more than 3 levels of nesting visible at once
7. Page load perceived performance: meaningful content visible within 500ms

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| KB Web Viewer (KSA-82) | System | KSA-82 | Existing viewer must be running with all 5 pages functional |
| User Guide (KSA-86) | Content | KSA-86 | USER-GUIDE.md content needed for embedded help |
| API endpoints | System | N/A | Existing /api/kb/* endpoints for recommendations actions |
| localStorage | Browser | N/A | For persisting tour state and user preferences |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Development Team Lead | Approve UX direction, accept UAT | Jira reporter |
| Developer | Frontend Developer | Implement UI changes | Jira assignee |
| UX Designer | UI Agent | Design wireframes, validate usability | Design phase |
| End Users | Developers, Tech Leads | Use the viewer daily | Target audience |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Tour/tooltips feel intrusive to experienced users | Medium | Medium | Allow dismiss/disable, remember preferences |
| Too many UI elements slow down page rendering | High | Low | Lazy-load tour/tooltip JS, use CSS animations |
| Empty states show when data exists but API is slow | Medium | Low | Show loading skeleton before empty state |
| "Fix Now" actions could have unintended side effects | High | Low | Confirm dialog for destructive actions (merge) |
| Graph analysis slow on large graphs (>1000 nodes) | Medium | Medium | Set timeout, show partial results, allow cancel |

### 5.2 Assumptions

- Users access viewer on modern browsers (Chrome/Firefox/Edge, last 2 versions)
- Viewport minimum 1024px width (desktop-first, responsive down to tablet)
- localStorage is available and not blocked
- Existing API endpoints are stable and won't change during implementation
- Dark theme is the only theme (no light mode required)
- English is the primary UI language (Vietnamese in documentation only)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Tour/tooltip rendering < 100ms | No perceptible delay when showing UI guidance elements |
| Performance | Graph analysis < 2s for 500 nodes | Analysis runs client-side with Web Workers if needed |
| Performance | Help panel open < 300ms | Slide-in animation smooth at 60fps |
| Accessibility | WCAG 2.1 AA compliance | Tooltips keyboard-accessible, tour navigable via keyboard |
| Accessibility | Screen reader support | ARIA labels on all interactive guidance elements |
| Code Quality | Max 200 lines per file | Vanilla JS, no frameworks, modular file structure |
| Code Quality | Zero external dependencies | No npm packages, CDN links, or build tools |
| Maintainability | Tooltip content in data file | Easy to update without code changes |
| Maintainability | Tour steps configurable | JSON-driven tour definition |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-93 | UX Improvement & Zero-Training User Guide | To Do | Epic | Main ticket |
| KSA-94 | In-app Onboarding Tour | To Do | Task | Child of KSA-93 |
| KSA-95 | Contextual Tooltips | To Do | Task | Child of KSA-93 |
| KSA-96 | Smart Empty States | To Do | Task | Child of KSA-93 |
| KSA-97 | Actionable Recommendations with "Fix Now" | To Do | Task | Child of KSA-93 |
| KSA-98 | Graph Auto-Analysis | To Do | Task | Child of KSA-93 |
| KSA-99 | User Guide Integration | To Do | Task | Child of KSA-93 |
| KSA-100 | UI Redesign for Clarity | To Do | Task | Child of KSA-93 |
| KSA-82 | KB Web Viewer (base implementation) | Done | Epic | Dependency |
| KSA-86 | User Guide | Done | Task | Content source |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Zero-Training | User can be productive immediately without external documentation or training |
| Onboarding Tour | Step-by-step overlay that highlights UI elements for first-time users |
| Empty State | UI shown when a page/section has no data, providing guidance instead of blank space |
| Progressive Disclosure | Design pattern showing summary first, details on demand |
| Contextual Tooltip | Small popup explaining a UI element, triggered by hover/click on ? icon |
| Smart Empty State | Empty state that provides actionable next steps, not just "no data" message |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| KB Web Viewer User Guide | documents/KSA-86/USER-GUIDE.md |
| KB Web Viewer Implementation | mcp-code-intelligence-python/src/mcp_code_intel/http/ |
| Dark Theme Tokens | Defined in this BRD §Story 7 |

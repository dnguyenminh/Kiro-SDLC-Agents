# Software Test Cases (STC)

## KB Web Viewer — KSA-86: Frontend HTML Update (Dashboard, Tags, Quality, Analytics Pages)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-86 |
| Title | Frontend HTML Update: Dashboard, Tags, Quality, Analytics Pages |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related STP | STP-v1-KSA-86.docx |
| Related FSD | FSD-v1-KSA-86.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | QA Agent | Initiate document — auto-generated from FSD use cases |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Functional — Happy Path | TC-001 to TC-005 | 5 | High |
| Functional — Alternative Flows | TC-100 to TC-104 | 5 | High |
| Functional — Exception/Error Flows | TC-200 to TC-204 | 5 | High |
| Business Rule Validation | TC-300 to TC-305 | 6 | High |
| Boundary & Negative Testing | TC-400 to TC-404 | 5 | Medium |
| UI/UX Testing | TC-500 to TC-505 | 6 | Medium |
| Non-Functional (Performance, Security) | TC-600 to TC-604 | 5 | Medium |
| Integration Testing | TC-700 to TC-706 | 7 | High |
| Regression Testing | TC-800 to TC-802 | 3 | Medium |

**Total: 47 Test Cases**

---

## Test Level Classification

| Prefix | Level | Count | Automation |
|--------|-------|-------|------------|
| UT-01 to UT-06 | Unit Test | 6 | ✅ Automated (Jest) |
| IT-01 to IT-07 | Integration Test | 7 | ✅ Automated (pytest + httpx) |
| E2E-UI-01 to E2E-UI-14 | Browser E2E | 14 | ✅ Automated (Playwright) |
| SIT-01 to SIT-10 | Manual Exploratory | 10 | ❌ Manual |

---

## 1. Functional Test Cases — Happy Path

### TC-001: Dashboard loads and displays health score gauge

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | E2E-UI-01 |
| **Requirement** | Story 1, FSD 3.2 |
| **Preconditions** | KB Web Viewer running on port 3201, KB has entries with quality scores |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to http://localhost:3201/dashboard | Dashboard page loads successfully |
| 2 | Observe Health Score section | SVG gauge displays score (0-100) |
| 3 | Verify gauge color | Green if score ≥70, Yellow if ≥40, Red if <40 |
| 4 | Verify label below gauge | Shows "Healthy" / "Needs Attention" / "Critical" |

**Test Data:** KB with health_score = 72 (should show green gauge, "Healthy" label)
**Postconditions:** Page remains loaded, no console errors

---

### TC-002: Dashboard displays 4 metric cards correctly

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | E2E-UI-02 |
| **Requirement** | Story 1, FSD 3.2.4 |
| **Preconditions** | KB Web Viewer running, dashboard API returns valid data |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /dashboard | Page loads |
| 2 | Verify "Total Entries" card | Shows count matching API response (e.g., 156) |
| 3 | Verify "Quality Avg" card | Shows average score with 1 decimal (e.g., 67.3) |
| 4 | Verify "Stale" card | Shows stale count (e.g., 12) |
| 5 | Verify "Unowned" card | Shows unowned count (e.g., 8) |

**Test Data:** API returns `total_entries: 156, quality_avg: 67.3, stale_count: 12, unowned_count: 8`
**Postconditions:** All 4 cards visible in grid layout

---

### TC-003: Tags page displays tag cloud with proportional sizing

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | E2E-UI-05 |
| **Requirement** | Story 2, FSD 3.3.4 |
| **Preconditions** | KB has 30+ tags with varied usage counts |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /tags | Tags page loads |
| 2 | Observe Popular Tags section | Tag cloud displays up to 30 tags |
| 3 | Verify font sizes | Higher usage_count tags have larger font (max 1.45rem) |
| 4 | Verify tag colors | Each tag has consistent color based on name hash |
| 5 | Verify usage count display | Each tag shows count as small text |

**Test Data:** Tags: python(15), api(12), testing(8), docker(5), ci(3)
**Postconditions:** Tag cloud rendered with flex-wrap layout

---

### TC-004: Quality page displays low-quality entries table

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | E2E-UI-09 |
| **Requirement** | Story 3, FSD 3.4.4 |
| **Preconditions** | KB has entries with quality scores below 40 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /quality | Quality page loads |
| 2 | Scroll to Low Quality Entries table | Table displays with columns: ID, Type, Summary, Score, Bar |
| 3 | Verify table data | Shows up to 20 entries with score < 40 |
| 4 | Verify score bars | Red for <30, Yellow for 30-59, Green for ≥60 |
| 5 | Verify summary truncation | Long summaries truncated at 60 characters |

**Test Data:** Entries with scores: 18, 25, 32, 35 (all below threshold 40)
**Postconditions:** Table rows have hover effect on mouseover

---

### TC-005: Analytics page displays search trend and tables

| Field | Value |
|-------|-------|
| **ID** | TC-005 |
| **Priority** | High |
| **Type** | Functional |
| **Level** | E2E-UI-11 |
| **Requirement** | Story 4, FSD 3.5.4 |
| **Preconditions** | KB has search history with popular queries and zero-result queries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /analytics | Analytics page loads |
| 2 | Observe Search Volume Trend | Canvas line chart renders with dots and area fill |
| 3 | Verify Popular Queries table | Shows queries with count badges (blue) and avg results |
| 4 | Verify Zero-Result table | Shows gap queries with warning badges (amber) |
| 5 | Verify two-column layout | Tables side by side on desktop (>768px) |

**Test Data:** Popular: "python setup"(8, 3.2), "api design"(6, 2.1); Gaps: "grpc config"(5)
**Postconditions:** Both tables populated, trend chart visible

---

## 2. Functional Test Cases — Alternative Flows

### TC-100: Tags page — click tag triggers search and displays results

| Field | Value |
|-------|-------|
| **ID** | TC-100 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Level** | E2E-UI-06 |
| **Requirement** | Story 2, FSD 3.3.4 |
| **Preconditions** | Tags page loaded with tag cloud visible |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click on a tag in the cloud (e.g., "python") | Search is triggered |
| 2 | Observe Results section | Results section populates with matching entries |
| 3 | Verify result format | Each result shows type badge + summary text |
| 4 | Verify result styling | Border-left 3px sky-400, type in violet-400 |

**Test Data:** Click "python" tag → expect entries tagged with "python"
**Postconditions:** Results section visible below search input

---

### TC-101: Tags page — search by typing tag name and pressing Enter

| Field | Value |
|-------|-------|
| **ID** | TC-101 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Level** | E2E-UI-07 |
| **Requirement** | Story 2, FSD 3.3.4 |
| **Preconditions** | Tags page loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click search input field | Input receives focus |
| 2 | Type "api" in the search input | Text appears in input |
| 3 | Press Enter key | Search triggered via keyup event |
| 4 | Observe Results section | Results for "api" tag displayed |

**Test Data:** Search term: "api"
**Postconditions:** Results section shows entries matching "api"

---

### TC-102: Dashboard — recommendations display with priority color coding

| Field | Value |
|-------|-------|
| **ID** | TC-102 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Level** | E2E-UI-03 |
| **Requirement** | Story 1, FSD 3.2.4 |
| **Preconditions** | Dashboard loaded, API returns recommendations |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /dashboard | Page loads |
| 2 | Scroll to Recommendations section | List of recommendations visible |
| 3 | Verify high-priority items | Red border-left (#ef4444) |
| 4 | Verify low-priority items | Green border-left (#22c55e) |
| 5 | Verify recommendation text | Message text matches API response |

**Test Data:** Recommendations: "Review 12 stale entries"(high), "Merge 3 duplicates"(low)
**Postconditions:** Recommendations list rendered with correct styling

---

### TC-103: Dashboard — trend charts render bar charts for 7-day data

| Field | Value |
|-------|-------|
| **ID** | TC-103 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Level** | E2E-UI-04 |
| **Requirement** | Story 1, FSD 3.2.4 |
| **Preconditions** | Dashboard loaded, API returns 7-day trend data |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /dashboard | Page loads |
| 2 | Scroll to Trends section | Two canvas elements visible |
| 3 | Verify Search Volume chart | Canvas renders bar chart with 7 bars |
| 4 | Verify Ingest Volume chart | Canvas renders bar chart with 7 bars |
| 5 | Verify chart labels | "Search Volume" and "Ingest Volume" labels visible |

**Test Data:** search_volume: [5,8,3,6,9,4,7], ingest_volume: [2,4,1,3,5,2,4]
**Postconditions:** Both canvases rendered (300×140px each)

---

### TC-104: Quality page — stats cards display 4 metrics

| Field | Value |
|-------|-------|
| **ID** | TC-104 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Level** | E2E-UI-08 |
| **Requirement** | Story 3, FSD 3.4.4 |
| **Preconditions** | Quality page loaded, API returns quality stats |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /quality | Page loads |
| 2 | Verify "Average Score" card | Shows score with 1 decimal (e.g., 67.3) |
| 3 | Verify "Scored Entries" card | Shows total scored count (e.g., 142) |
| 4 | Verify "High Quality" card | Shows count of entries with score ≥60 |
| 5 | Verify "Low Quality" card | Shows count of entries with score <40 |

**Test Data:** average_score: 67.3, scored_count: 142, high_count: 98, low_count: 44
**Postconditions:** All 4 cards visible in responsive grid

---

## 3. Functional Test Cases — Exception/Error Flows

### TC-200: All pages — API fetch failure handled gracefully

| Field | Value |
|-------|-------|
| **ID** | TC-200 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Level** | E2E-UI-13 |
| **Requirement** | FSD 6.1 |
| **Preconditions** | KB Web Viewer running, backend API unavailable (server stopped) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Stop backend API server | API endpoints return connection refused |
| 2 | Navigate to /dashboard | Page loads (HTML renders) |
| 3 | Open browser console | console.error logged for fetch failure |
| 4 | Verify page state | Components remain empty, no crash/white screen |
| 5 | Repeat for /tags, /quality, /analytics | Same graceful degradation on all pages |

**Test Data:** No API available (network error)
**Postconditions:** Pages remain navigable, no JavaScript exceptions thrown to user

---

### TC-201: Tags page — empty tag cloud when no tags exist

| Field | Value |
|-------|-------|
| **ID** | TC-201 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Level** | E2E-UI-14 |
| **Requirement** | FSD 6.1, Story 2 AC-6 |
| **Preconditions** | KB has zero tags |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /tags | Tags page loads |
| 2 | Observe Popular Tags section | Cloud container is empty (no tags rendered) |
| 3 | Observe Taxonomy section | Tree is empty or shows "No taxonomy data" |
| 4 | Search for any term | Results section shows empty state message |

**Test Data:** Empty KB (no tags, no entries)
**Postconditions:** Page stable, no errors

---

### TC-202: Analytics page — empty state when no search history

| Field | Value |
|-------|-------|
| **ID** | TC-202 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Level** | E2E-UI-12 |
| **Requirement** | FSD 3.5.4, Story 4 AC-5 |
| **Preconditions** | KB has no search history |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /analytics | Analytics page loads |
| 2 | Observe trend chart | Canvas shows "No trend data" text or blank |
| 3 | Observe Popular Queries table | Shows "No data yet" message |
| 4 | Observe Zero-Result table | Shows "No gaps detected" message |

**Test Data:** Empty analytics data (no queries recorded)
**Postconditions:** Empty states displayed gracefully

---

### TC-203: Dashboard — zero entries state

| Field | Value |
|-------|-------|
| **ID** | TC-203 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Level** | IT-06 |
| **Requirement** | FSD 3.2, Story 1 |
| **Preconditions** | KB has zero entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /dashboard | Dashboard loads |
| 2 | Verify health gauge | Shows score 0, red color, "Critical" label |
| 3 | Verify metric cards | All show 0 values |
| 4 | Verify recommendations | May show "No recommendations" or empty list |
| 5 | Verify trend charts | Blank canvases (no bars) |

**Test Data:** health_score: 0, total_entries: 0, quality_avg: 0, stale_count: 0, unowned_count: 0
**Postconditions:** Page renders without errors

---

### TC-204: Quality page — malformed JSON response handling

| Field | Value |
|-------|-------|
| **ID** | TC-204 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Level** | IT-07 |
| **Requirement** | FSD 6.1 |
| **Preconditions** | API returns malformed JSON |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock API to return invalid JSON | API returns `{invalid json` |
| 2 | Navigate to /quality | Page loads (HTML renders) |
| 3 | Open browser console | Error caught by try/catch, logged to console |
| 4 | Verify page state | Components remain empty, no crash |

**Test Data:** Malformed JSON response from /api/kb/quality
**Postconditions:** Page stable, error logged silently

---

## 4. Business Rule Validation

### TC-300: Health gauge color thresholds (green ≥70, yellow ≥40, red <40)

| Field | Value |
|-------|-------|
| **ID** | TC-300 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | E2E-UI-01 |
| **Requirement** | Story 1 AC-2, FSD 3.2.4 |
| **Preconditions** | Dashboard page accessible |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set health_score = 70 | Gauge shows green color (#22c55e) |
| 2 | Set health_score = 69 | Gauge shows yellow color (#f59e0b) |
| 3 | Set health_score = 40 | Gauge shows yellow color (#f59e0b) |
| 4 | Set health_score = 39 | Gauge shows red color (#ef4444) |
| 5 | Set health_score = 0 | Gauge shows red color, "Critical" label |
| 6 | Set health_score = 100 | Gauge shows green color, full arc |

**Test Data:** Boundary values: 0, 39, 40, 69, 70, 100

---

### TC-301: Tag cloud font size proportional to usage count

| Field | Value |
|-------|-------|
| **ID** | TC-301 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | UT-01 |
| **Requirement** | Story 2 AC-2, FSD 3.3.4 |
| **Preconditions** | Tags API returns tags with varied usage_count |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tag with highest usage_count | Font size = 1.45rem (max) |
| 2 | Tag with lowest usage_count | Font size = 0.65rem (min) |
| 3 | Tag with mid-range count | Font size between 0.65 and 1.45rem |

**Test Data:** Tags: max_count=15, min_count=1, formula: 0.65 + (count/maxCount) * 0.8

---

### TC-302: Score bar color coding (red <30, yellow 30-59, green ≥60)

| Field | Value |
|-------|-------|
| **ID** | TC-302 |
| **Priority** | High |
| **Type** | Business Rule |
| **Level** | UT-02 |
| **Requirement** | Story 3 AC-5, FSD 3.4.4 |
| **Preconditions** | Quality page loaded with entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Entry with score = 29 | Score bar is red (#ef4444) |
| 2 | Entry with score = 30 | Score bar is yellow (#f59e0b) |
| 3 | Entry with score = 59 | Score bar is yellow (#f59e0b) |
| 4 | Entry with score = 60 | Score bar is green (#22c55e) |

**Test Data:** Boundary scores: 0, 29, 30, 59, 60, 100

---

### TC-303: Tag color consistency based on name hash

| Field | Value |
|-------|-------|
| **ID** | TC-303 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Level** | UT-03 |
| **Requirement** | Story 2, FSD 3.3.4 |
| **Preconditions** | Tags page loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load tags page | Tags rendered with colors |
| 2 | Reload page | Same tags have same colors (deterministic) |
| 3 | Verify color formula | hsl((charCodeAt(0) * 37) % 360, 60%, 40%) background |

**Test Data:** Tag "python" → charCode 112 × 37 = 4144 % 360 = 184° (teal)

---

### TC-304: Summary text truncation at 60 characters

| Field | Value |
|-------|-------|
| **ID** | TC-304 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Level** | UT-04 |
| **Requirement** | Story 3 AC-6, FSD 3.4.4 |
| **Preconditions** | Quality table has entries with long summaries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Entry with summary = 60 chars | Full text displayed |
| 2 | Entry with summary = 61 chars | Text truncated at 60 chars with "..." |
| 3 | Entry with summary = 10 chars | Full text displayed (no truncation) |

**Test Data:** Summaries: "A"×60 (exact), "A"×61 (truncated), "Short" (no truncation)

---

### TC-305: Recommendation priority border colors

| Field | Value |
|-------|-------|
| **ID** | TC-305 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Level** | UT-05 |
| **Requirement** | Story 1, FSD 3.2.4 |
| **Preconditions** | Dashboard loaded with recommendations |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Recommendation with priority "high" | Border-left: 3px solid #ef4444 (red) |
| 2 | Recommendation with priority "medium" | Border-left: 3px solid #f59e0b (amber) |
| 3 | Recommendation with priority "low" | Border-left: 3px solid #22c55e (green) |

**Test Data:** Recommendations with each priority level

---

## 5. Boundary & Negative Testing

### TC-400: Tag cloud with maximum 30 tags (API limit)

| Field | Value |
|-------|-------|
| **ID** | TC-400 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Level** | IT-01 |
| **Requirement** | Story 2 AC-1, FSD 3.3.3 |
| **Preconditions** | KB has 50+ tags |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call GET /api/kb/tags/popular?limit=30 | Returns exactly 30 tags |
| 2 | Navigate to /tags | Tag cloud shows exactly 30 tags |
| 3 | Verify no overflow | All tags fit within flex-wrap container |

**Test Data:** 50 tags in DB, API limited to 30

---

### TC-401: Low-quality table with maximum 20 entries (API limit)

| Field | Value |
|-------|-------|
| **ID** | TC-401 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Level** | IT-02 |
| **Requirement** | Story 3 AC-3, FSD 3.4.3 |
| **Preconditions** | KB has 50+ entries with score < 40 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call GET /api/kb/quality/low?threshold=40&limit=20 | Returns max 20 entries |
| 2 | Navigate to /quality | Table shows exactly 20 rows |
| 3 | Verify ordering | Entries sorted by score ascending (worst first) |

**Test Data:** 50 entries with scores 5-39, expect only 20 shown

---

### TC-402: Health score boundary values (0 and 100)

| Field | Value |
|-------|-------|
| **ID** | TC-402 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Level** | UT-06 |
| **Requirement** | Story 1 AC-1, FSD 3.2.4 |
| **Preconditions** | Dashboard accessible |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | health_score = 0 | Gauge shows 0, stroke-dasharray = 0, red color |
| 2 | health_score = 100 | Gauge shows 100, full arc (314), green color |
| 3 | health_score = 50 | Gauge shows 50, half arc (157), yellow color |

**Test Data:** Scores: 0, 50, 100

---

### TC-403: Analytics popular queries with maximum 15 rows

| Field | Value |
|-------|-------|
| **ID** | TC-403 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Level** | IT-03 |
| **Requirement** | Story 4, FSD 3.5.4 |
| **Preconditions** | KB has 30+ unique search queries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call GET /api/kb/analytics | Returns popular_queries array |
| 2 | Navigate to /analytics | Popular queries table shows max 15 rows |
| 3 | Verify ordering | Sorted by count descending |

**Test Data:** 30 queries with varied counts

---

### TC-404: Tag name with special characters (XSS attempt)

| Field | Value |
|-------|-------|
| **ID** | TC-404 |
| **Priority** | High |
| **Type** | Negative / Security |
| **Level** | E2E-UI-10 |
| **Requirement** | FSD 6.2 |
| **Preconditions** | KB has tag with HTML/script content |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create tag with name `<script>alert('xss')</script>` | Tag stored in DB |
| 2 | Navigate to /tags | Tags page loads |
| 3 | Observe tag cloud | Tag name displayed as escaped text, NOT executed |
| 4 | Verify HTML source | `&lt;script&gt;` in rendered HTML |
| 5 | Verify no alert dialog | No JavaScript alert appears |

**Test Data:** Tag name: `<script>alert('xss')</script>`
**Postconditions:** XSS prevented, tag displayed as text

---

## 6. UI/UX Testing

### TC-500: Navigation bar present on all pages with correct active state

| Field | Value |
|-------|-------|
| **ID** | TC-500 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Level** | E2E-UI-15 |
| **Requirement** | Story 5, FSD 3.1 |
| **Preconditions** | KB Web Viewer running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /dashboard | Nav bar shows 5 tabs, "Dashboard" has .active class |
| 2 | Navigate to /tags | "Tags" tab has .active class, others do not |
| 3 | Navigate to /quality | "Quality" tab has .active class |
| 4 | Navigate to /analytics | "Analytics" tab has .active class |
| 5 | Navigate to / | "Graph" tab has .active class |

**Test Data:** N/A
**Postconditions:** Active tab styling: background #334155, color #e2e8f0

---

### TC-501: Dark theme color consistency across all pages

| Field | Value |
|-------|-------|
| **ID** | TC-501 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Level** | SIT-01 |
| **Requirement** | Story 6, FSD 8.3 |
| **Preconditions** | All pages accessible |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open each page | Background is #0f172a (slate-900) |
| 2 | Inspect cards | Card background is #1e293b (slate-800) |
| 3 | Inspect borders | Card borders are #334155 (slate-700) |
| 4 | Inspect text | Primary text is #e2e8f0, secondary is #94a3b8 |
| 5 | Inspect accent colors | Links/highlights use #38bdf8 (sky-400) |

**Test Data:** N/A
**Postconditions:** Consistent dark theme across all pages

---

### TC-502: Dashboard metric cards grid layout (auto-fit min 200px)

| Field | Value |
|-------|-------|
| **ID** | TC-502 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Level** | SIT-02 |
| **Requirement** | Story 6, FSD 3.2.4 |
| **Preconditions** | Dashboard loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View at 1200px width | 4 cards in single row |
| 2 | Resize to 800px | Cards wrap to 2×2 grid |
| 3 | Resize to 400px | Cards stack vertically (1 per row) |
| 4 | Verify card min-width | No card narrower than 200px |

**Test Data:** N/A
**Postconditions:** Grid adapts smoothly without horizontal scroll

---

### TC-503: Analytics two-column to single-column responsive transition

| Field | Value |
|-------|-------|
| **ID** | TC-503 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Level** | SIT-03 |
| **Requirement** | Story 6 AC-3, FSD 7.1 |
| **Preconditions** | Analytics page loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View at 1024px width | Two tables side by side (2-column grid) |
| 2 | Resize to 768px | Layout transitions to single column |
| 3 | Resize to 320px | Tables stack vertically, no horizontal scroll |

**Test Data:** N/A
**Postconditions:** Responsive breakpoint at 768px works correctly

---

### TC-504: Tag cloud flex-wrap behavior

| Field | Value |
|-------|-------|
| **ID** | TC-504 |
| **Priority** | Low |
| **Type** | UI/UX |
| **Level** | SIT-04 |
| **Requirement** | Story 6 AC-4, FSD 7.2 |
| **Preconditions** | Tags page loaded with 30 tags |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View at full width | Tags spread across multiple rows naturally |
| 2 | Resize to narrow viewport | Tags wrap to more rows, no overflow |
| 3 | Verify gap spacing | 0.4rem gap between tags maintained |

**Test Data:** 30 tags with varied name lengths
**Postconditions:** No horizontal scrollbar appears

---

### TC-505: Quality table hover effect

| Field | Value |
|-------|-------|
| **ID** | TC-505 |
| **Priority** | Low |
| **Type** | UI/UX |
| **Level** | SIT-05 |
| **Requirement** | Story 3, FSD 3.4.4 |
| **Preconditions** | Quality page loaded with table data |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Hover over a table row | Row background changes to #1e293b |
| 2 | Move mouse away | Row returns to default background |
| 3 | Hover over different rows | Effect applies to each row independently |

**Test Data:** N/A
**Postconditions:** Hover effect is smooth (CSS transition)

---

## 7. Non-Functional Testing

### TC-600: Page load performance — all pages under 2 seconds

| Field | Value |
|-------|-------|
| **ID** | TC-600 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Level** | SIT-06 |
| **Requirement** | BRD NFR: Performance |
| **Preconditions** | Server running, KB has 100+ entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open DevTools Network tab | Network monitoring active |
| 2 | Navigate to /dashboard | Page fully rendered in < 2 seconds |
| 3 | Navigate to /tags | Page fully rendered in < 2 seconds |
| 4 | Navigate to /quality | Page fully rendered in < 2 seconds |
| 5 | Navigate to /analytics | Page fully rendered in < 2 seconds |

**Acceptance Criteria:** DOMContentLoaded + API fetch + render < 2000ms for each page

---

### TC-601: XSS prevention — esc() function escapes HTML entities

| Field | Value |
|-------|-------|
| **ID** | TC-601 |
| **Priority** | High |
| **Type** | Non-Functional — Security |
| **Level** | UT-06 |
| **Requirement** | FSD 6.2, BRD NFR: Security |
| **Preconditions** | esc() function available in page JavaScript |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call esc('<script>alert(1)</script>') | Returns '&lt;script&gt;alert(1)&lt;/script&gt;' |
| 2 | Call esc('<img onerror=alert(1)>') | Returns '&lt;img onerror=alert(1)&gt;' |
| 3 | Call esc(null) | Returns '' (empty string) |
| 4 | Call esc(undefined) | Returns '' (empty string) |
| 5 | Call esc('Normal text') | Returns 'Normal text' (unchanged) |

**Test Data:** Various XSS payloads and edge cases

---

### TC-602: Color contrast accessibility (text on dark background)

| Field | Value |
|-------|-------|
| **ID** | TC-602 |
| **Priority** | Medium |
| **Type** | Non-Functional — Accessibility |
| **Level** | SIT-07 |
| **Requirement** | BRD NFR: Accessibility |
| **Preconditions** | Pages loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check primary text (#e2e8f0) on background (#0f172a) | Contrast ratio ≥ 4.5:1 (WCAG AA) |
| 2 | Check secondary text (#94a3b8) on background (#0f172a) | Contrast ratio ≥ 4.5:1 |
| 3 | Check accent text (#38bdf8) on card (#1e293b) | Contrast ratio ≥ 4.5:1 |

**Acceptance Criteria:** All text meets WCAG AA contrast requirements (4.5:1 for normal text)

---

### TC-603: Semantic HTML structure (heading hierarchy)

| Field | Value |
|-------|-------|
| **ID** | TC-603 |
| **Priority** | Low |
| **Type** | Non-Functional — Accessibility |
| **Level** | SIT-08 |
| **Requirement** | BRD NFR: Accessibility |
| **Preconditions** | Pages loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inspect Dashboard HTML | Uses h2 for section titles, h3 for card labels |
| 2 | Inspect Tags HTML | Proper heading hierarchy (no skipped levels) |
| 3 | Verify nav element | Navigation uses `<nav>` semantic element |
| 4 | Verify link elements | All nav links use `<a>` with href attributes |

**Test Data:** N/A
**Postconditions:** HTML passes basic accessibility audit

---

### TC-604: Canvas chart rendering on different browsers

| Field | Value |
|-------|-------|
| **ID** | TC-604 |
| **Priority** | Medium |
| **Type** | Non-Functional — Compatibility |
| **Level** | SIT-09 |
| **Requirement** | BRD NFR, Dependencies |
| **Preconditions** | Pages accessible on Chrome, Firefox, Edge |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open /dashboard on Chrome | Trend bar charts render correctly |
| 2 | Open /dashboard on Firefox | Same charts render identically |
| 3 | Open /dashboard on Edge | Same charts render identically |
| 4 | Open /quality on all 3 browsers | Distribution chart renders on all |
| 5 | Open /analytics on all 3 browsers | Line chart with area fill renders on all |

**Acceptance Criteria:** Canvas 2D API renders consistently across Chrome 90+, Firefox 88+, Edge 90+

---

## 8. Integration Testing

### TC-700: Dashboard API returns correct schema

| Field | Value |
|-------|-------|
| **ID** | TC-700 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT-01 |
| **Requirement** | FSD 3.2.3, FSD 4.1 |
| **Preconditions** | Server running on port 3201 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/kb/dashboard | Status 200 |
| 2 | Verify response has `health_score` | Integer 0-100 |
| 3 | Verify response has `total_entries` | Integer ≥ 0 |
| 4 | Verify response has `quality_avg` | Float 0-100 |
| 5 | Verify response has `recommendations` | Array of {message, priority} |
| 6 | Verify response has `trends` | Object with search_volume and ingest_volume arrays |

**Test Data:** N/A (live API)
**Postconditions:** Schema validated

---

### TC-701: Tags Popular API returns correct schema

| Field | Value |
|-------|-------|
| **ID** | TC-701 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT-02 |
| **Requirement** | FSD 3.3.3, FSD 4.1 |
| **Preconditions** | Server running, tags exist in KB |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/kb/tags/popular?limit=30 | Status 200 |
| 2 | Verify response is array | Array of objects |
| 3 | Verify each item has `tag` | String (tag name) |
| 4 | Verify each item has `usage_count` | Integer ≥ 0 |
| 5 | Verify array length ≤ 30 | Respects limit parameter |

**Test Data:** N/A
**Postconditions:** Schema validated

---

### TC-702: Tags Taxonomy API returns correct schema

| Field | Value |
|-------|-------|
| **ID** | TC-702 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT-03 |
| **Requirement** | FSD 3.3.3, FSD 4.1 |
| **Preconditions** | Server running, taxonomy configured |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/kb/tags | Status 200 |
| 2 | Verify response structure | Object with categories or array with children |
| 3 | Verify parent-child relationships | Children nested under parents |

**Test Data:** N/A
**Postconditions:** Taxonomy structure validated

---

### TC-703: Quality API returns stats and distribution

| Field | Value |
|-------|-------|
| **ID** | TC-703 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT-04 |
| **Requirement** | FSD 3.4.3, FSD 4.1 |
| **Preconditions** | Server running, entries have quality scores |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/kb/quality | Status 200 |
| 2 | Verify `average_score` | Float 0-100 |
| 3 | Verify `scored_count` | Integer ≥ 0 |
| 4 | Verify `high_count` | Integer ≥ 0 |
| 5 | Verify `low_count` | Integer ≥ 0 |
| 6 | Verify `distribution` | Object with score bucket keys and count values |

**Test Data:** N/A
**Postconditions:** Schema validated

---

### TC-704: Quality Low API returns entries below threshold

| Field | Value |
|-------|-------|
| **ID** | TC-704 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT-05 |
| **Requirement** | FSD 3.4.3, FSD 4.1 |
| **Preconditions** | Server running, entries with low scores exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/kb/quality/low?threshold=40&limit=20 | Status 200 |
| 2 | Verify response is array | Array of entry objects |
| 3 | Verify each entry has `id`, `type`, `summary`, `quality_score` | All fields present |
| 4 | Verify all scores < 40 | No entry exceeds threshold |
| 5 | Verify array length ≤ 20 | Respects limit parameter |

**Test Data:** N/A
**Postconditions:** All returned entries below threshold

---

### TC-705: Analytics API returns queries and trends

| Field | Value |
|-------|-------|
| **ID** | TC-705 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT-06 |
| **Requirement** | FSD 3.5.3, FSD 4.1 |
| **Preconditions** | Server running, search history exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/kb/analytics | Status 200 |
| 2 | Verify `popular_queries` | Array of {query, count, avg_results} |
| 3 | Verify `zero_results` or `gaps` | Array of {query, count} |
| 4 | Verify `search_trend` or `daily_volume` | Array of {count} or numbers |

**Test Data:** N/A
**Postconditions:** Schema validated

---

### TC-706: Memory Search API returns entries by tag

| Field | Value |
|-------|-------|
| **ID** | TC-706 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT-07 |
| **Requirement** | FSD 3.3.3 |
| **Preconditions** | Server running, entries tagged with "python" exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/memory/search?q=python | Status 200 |
| 2 | Verify response is array | Array of entry objects |
| 3 | Verify each entry has `type` and `summary` | Fields present |
| 4 | Verify results are relevant | Entries related to "python" tag |

**Test Data:** Search query: "python"
**Postconditions:** Relevant entries returned

---

## 9. Regression Testing

### TC-800: Graph page still accessible after new pages added

| Field | Value |
|-------|-------|
| **ID** | TC-800 |
| **Priority** | Medium |
| **Type** | Regression |
| **Level** | SIT-10 |
| **Requirement** | Existing functionality |
| **Preconditions** | Server running with all pages deployed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to / (root) | Graph page loads correctly |
| 2 | Verify graph visualization | Canvas/SVG graph renders |
| 3 | Click "Graph" tab from any other page | Returns to graph page |

**Test Data:** N/A
**Postconditions:** Graph page unaffected by new page additions

---

### TC-801: Navigation links work from every page

| Field | Value |
|-------|-------|
| **ID** | TC-801 |
| **Priority** | Medium |
| **Type** | Regression |
| **Level** | E2E-UI-15 |
| **Requirement** | Story 5, FSD 3.1 |
| **Preconditions** | All pages deployed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | From /dashboard, click each nav tab | Each navigates to correct page |
| 2 | From /tags, click each nav tab | Each navigates to correct page |
| 3 | From /quality, click each nav tab | Each navigates to correct page |
| 4 | From /analytics, click each nav tab | Each navigates to correct page |
| 5 | Use browser back/forward | Navigation history works correctly |

**Test Data:** N/A
**Postconditions:** All navigation paths functional

---

### TC-802: API endpoints still return data after frontend changes

| Field | Value |
|-------|-------|
| **ID** | TC-802 |
| **Priority** | High |
| **Type** | Regression |
| **Level** | IT-07 |
| **Requirement** | KSA-82 (dependency) |
| **Preconditions** | Server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/kb/dashboard | Returns 200 with valid JSON |
| 2 | GET /api/kb/tags/popular | Returns 200 with valid JSON |
| 3 | GET /api/kb/quality | Returns 200 with valid JSON |
| 4 | GET /api/kb/analytics | Returns 200 with valid JSON |
| 5 | GET /api/kb/quality/low?threshold=40 | Returns 200 with valid JSON |

**Test Data:** N/A
**Postconditions:** All APIs functional

---

## 10. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| Story 1: Dashboard Health Score | BRD 2.3 | TC-001, TC-300, TC-402 | ✅ |
| Story 1: Metric Cards | BRD 2.3 | TC-002 | ✅ |
| Story 1: Recommendations | BRD 2.3 | TC-102, TC-305 | ✅ |
| Story 1: Trend Charts | BRD 2.3 | TC-103 | ✅ |
| Story 2: Tag Cloud | BRD 2.3 | TC-003, TC-301, TC-303, TC-400 | ✅ |
| Story 2: Taxonomy Tree | BRD 2.3 | TC-003 | ✅ |
| Story 2: Search by Tag | BRD 2.3 | TC-100, TC-101 | ✅ |
| Story 3: Quality Stats | BRD 2.3 | TC-104 | ✅ |
| Story 3: Distribution Chart | BRD 2.3 | TC-004 | ✅ |
| Story 3: Low-Quality Table | BRD 2.3 | TC-004, TC-302, TC-304, TC-401 | ✅ |
| Story 4: Trend Line | BRD 2.3 | TC-005 | ✅ |
| Story 4: Popular Queries | BRD 2.3 | TC-005, TC-403 | ✅ |
| Story 4: Zero-Result Gaps | BRD 2.3 | TC-005 | ✅ |
| Story 5: Navigation Bar | BRD 2.3 | TC-500, TC-801 | ✅ |
| Story 6: Responsive Design | BRD 2.3 | TC-502, TC-503, TC-504 | ✅ |
| FSD 3.1: Nav Component | FSD 3.1 | TC-500, TC-801 | ✅ |
| FSD 3.2: Dashboard Page | FSD 3.2 | TC-001, TC-002, TC-102, TC-103, TC-203 | ✅ |
| FSD 3.3: Tags Page | FSD 3.3 | TC-003, TC-100, TC-101, TC-201, TC-404 | ✅ |
| FSD 3.4: Quality Page | FSD 3.4 | TC-004, TC-104, TC-302, TC-304, TC-401, TC-505 | ✅ |
| FSD 3.5: Analytics Page | FSD 3.5 | TC-005, TC-202, TC-403, TC-503 | ✅ |
| FSD 6.1: Error Handling | FSD 6 | TC-200, TC-201, TC-202, TC-203, TC-204 | ✅ |
| FSD 6.2: XSS Prevention | FSD 6.2 | TC-404, TC-601 | ✅ |
| FSD 7: Responsive Behavior | FSD 7 | TC-502, TC-503, TC-504 | ✅ |
| NFR: Performance | BRD 6 | TC-600 | ✅ |
| NFR: Accessibility | BRD 6 | TC-602, TC-603 | ✅ |
| NFR: Compatibility | BRD 6 | TC-604 | ✅ |
| API: /api/kb/dashboard | FSD 4.1 | TC-700 | ✅ |
| API: /api/kb/tags/popular | FSD 4.1 | TC-701 | ✅ |
| API: /api/kb/tags | FSD 4.1 | TC-702 | ✅ |
| API: /api/kb/quality | FSD 4.1 | TC-703 | ✅ |
| API: /api/kb/quality/low | FSD 4.1 | TC-704 | ✅ |
| API: /api/kb/analytics | FSD 4.1 | TC-705 | ✅ |
| API: /api/memory/search | FSD 4.1 | TC-706 | ✅ |
| Regression: Graph page | Existing | TC-800 | ✅ |
| Regression: Navigation | Existing | TC-801 | ✅ |
| Regression: APIs | KSA-82 | TC-802 | ✅ |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| User Stories (BRD) | 6 | 6 | 100% |
| FSD Features | 5 | 5 | 100% |
| API Endpoints | 7 | 7 | 100% |
| Error Handling | 5 scenarios | 5 | 100% |
| Non-Functional Requirements | 4 | 4 | 100% |
| **Overall** | **34** | **34** | **100%** |

---

## 11. Appendix

### Test Data Setup

**Seed KB with test data before SIT execution:**

```bash
# Seed entries with varied quality scores
curl -X POST http://localhost:3201/api/memory/ingest -d '{"content":"Test entry 1","type":"CONTEXT"}' -H "Content-Type: application/json"

# Seed tags
curl -X POST http://localhost:3201/api/memory/tags -d '{"entry_id":1,"tags":"python,api,testing"}' -H "Content-Type: application/json"

# Trigger quality scoring
curl -X POST http://localhost:3201/api/kb/quality/score -d '{"entry_id":1}' -H "Content-Type: application/json"

# Generate search history
curl http://localhost:3201/api/memory/search?q=python
curl http://localhost:3201/api/memory/search?q=grpc+config
```

### XSS Test Payloads

| # | Payload | Expected Escaped Output |
|---|---------|------------------------|
| 1 | `<script>alert(1)</script>` | `&lt;script&gt;alert(1)&lt;/script&gt;` |
| 2 | `<img src=x onerror=alert(1)>` | `&lt;img src=x onerror=alert(1)&gt;` |
| 3 | `"><script>alert(1)</script>` | `"&gt;&lt;script&gt;alert(1)&lt;/script&gt;` |
| 4 | `javascript:alert(1)` | `javascript:alert(1)` (no < > to escape) |

### Environment Configuration

- Python 3.10+ with aiohttp
- SQLite database (in-memory or file-based)
- Port 3201 (configurable)
- No external dependencies for frontend (vanilla JS + Canvas API)

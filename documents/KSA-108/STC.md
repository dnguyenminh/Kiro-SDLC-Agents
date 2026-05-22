# Software Test Cases (STC)

## KB Web Viewer — KSA-108: Add Mark Reviewed Button and Review Workflow on Dashboard

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-108 |
| Title | Add Mark Reviewed button and review workflow on Dashboard |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-22 |
| Status | Draft |
| Related STP | STP-v1-KSA-108.docx |
| Related FSD | FSD-v1-KSA-108.docx |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Functional — Happy Path | TC-001 to TC-005 | 5 | High |
| Functional — Alternative Flows | TC-100 to TC-102 | 3 | High |
| Functional — Exception/Error Flows | TC-200 to TC-204 | 5 | High |
| Business Rule Validation | TC-300 to TC-307 | 8 | High |
| UI/UX Testing | TC-500 to TC-505 | 6 | Medium |
| Non-Functional (Accessibility) | TC-600 to TC-603 | 4 | Medium |
| Integration Testing | TC-700 to TC-702 | 3 | High |
| Regression Testing | TC-800 to TC-802 | 3 | Medium |
| **Total** | | **37** | |

---

## 1. Functional Test Cases — Happy Path

### TC-001: Mark Reviewed from Dashboard — Success

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-01, BR-02, BR-05, Story 1 |
| **Preconditions** | Dashboard loaded; Due Reviews table has ≥1 entry; server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Dashboard page | Due Reviews table displays with entries and "Action" column |
| 2 | Click "Mark Reviewed" button on first row | Button shows spinner, becomes disabled |
| 3 | Wait for API response | Success toast appears: "Entry #N marked as reviewed" |
| 4 | Observe row | Row fades out over 300ms |
| 5 | Wait 300ms | Row removed from DOM |
| 6 | Check "Stale" metric card | Value decremented by 1 |

**Test Data:** Entry ID 901 (stale entry in DB)
**Postconditions:** Entry staleness_score = 0 in DB; row gone from table

---

### TC-002: Mark Reviewed from Entry Detail — Success

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, BR-07, BR-08, BR-09, Story 2 |
| **Preconditions** | Browser tab open; entry detail panel visible |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click an entry in Browser list | Detail panel opens with "Mark Reviewed" button in header |
| 2 | Click "Mark Reviewed" button | Button shows spinner, becomes disabled |
| 3 | Wait for API response | Success toast: "Entry #N marked as reviewed" |
| 4 | Observe button area | Button replaced with "Reviewed ✓" badge (green) |
| 5 | Verify panel stays open | Detail panel remains visible with entry content |

**Test Data:** Any entry with valid ID
**Postconditions:** Badge shown; entry reviewed in DB

---

### TC-003: Toast Success — Auto-dismiss after 3s

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | BR-10, BR-03, Story 3 |
| **Preconditions** | Dashboard loaded with stale entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Mark Reviewed" on a row | Success toast appears (green) |
| 2 | Wait 3 seconds | Toast fades out and is removed from DOM |
| 3 | Verify no toast remains | Toast container empty or removed |

**Test Data:** Entry ID 901
**Postconditions:** Toast gone after 3s

---

### TC-004: Row Removal — Last Row Shows Empty State

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | AF-01, Story 4 |
| **Preconditions** | Due Reviews table has exactly 1 entry |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Mark Reviewed" on the only row | Row fades out |
| 2 | Wait 300ms | Row removed; table shows "No due reviews" message |
| 3 | Verify colspan | Empty message spans all 5 columns |

**Test Data:** Single stale entry in DB
**Postconditions:** Table shows empty state

---

### TC-005: Multiple Marks in Sequence

| Field | Value |
|-------|-------|
| **ID** | TC-005 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-05 |
| **Preconditions** | Due Reviews table has ≥3 entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Mark Reviewed" on row 1 | Row 1 fades out, stale count -1 |
| 2 | Wait for row 1 removal, click "Mark Reviewed" on row 2 | Row 2 fades out, stale count -1 again |
| 3 | Verify remaining rows | Only unmarked rows remain |

**Test Data:** Entries 901, 902, 903
**Postconditions:** Stale count decremented by 2

---

## 2. Functional Test Cases — Alternative Flows

### TC-100: Table Empty on Load

| Field | Value |
|-------|-------|
| **ID** | TC-100 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | AF-01 |
| **Preconditions** | No stale entries in DB |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Dashboard | Due Reviews table shows "No due reviews" (colspan=5) |
| 2 | Verify no buttons | No "Mark Reviewed" buttons rendered |

**Test Data:** Empty reminders response
**Postconditions:** Empty state displayed

---

### TC-101: Mark Already-Reviewed Entry (Idempotent)

| Field | Value |
|-------|-------|
| **ID** | TC-101 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | BR-06 |
| **Preconditions** | Entry exists but already has staleness_score = 0 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Manually add entry to Due Reviews (or API returns it) | Row visible |
| 2 | Click "Mark Reviewed" | API returns 200 OK (idempotent) |
| 3 | Verify toast | Success toast shown |
| 4 | Verify row removal | Row fades out normally |

**Test Data:** Entry with staleness_score = 0
**Postconditions:** No error; entry remains reviewed

---

### TC-102: Detail Panel — Entry Already Reviewed

| Field | Value |
|-------|-------|
| **ID** | TC-102 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-02, BR-08 |
| **Preconditions** | Entry detail open; user already clicked Mark Reviewed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mark entry as reviewed in detail panel | Badge "Reviewed ✓" replaces button |
| 2 | Close and reopen same entry detail | Button shows again (page state not persisted) |

**Test Data:** Any entry
**Postconditions:** Badge shown until panel closed

---

## 3. Functional Test Cases — Exception/Error Flows

### TC-200: Network Error

| Field | Value |
|-------|-------|
| **ID** | TC-200 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | EF-01 |
| **Preconditions** | Dashboard loaded; network disconnected (DevTools offline mode) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enable offline mode in DevTools | Network requests will fail |
| 2 | Click "Mark Reviewed" on a row | Button shows spinner briefly |
| 3 | Observe error handling | Error toast: "Network error — please try again" (red) |
| 4 | Verify button state | Button re-enabled with original text |
| 5 | Verify row | Row remains in table (not removed) |

**Test Data:** Entry 901
**Postconditions:** Button clickable again; no data change

---

### TC-201: API Returns 404

| Field | Value |
|-------|-------|
| **ID** | TC-201 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | EF-02 |
| **Preconditions** | Entry deleted from DB but still shown in table (stale UI) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Delete entry 901 from DB directly | Entry still in UI table |
| 2 | Click "Mark Reviewed" on that row | API returns 404 |
| 3 | Observe toast | Error toast: "Entry not found" (red) |
| 4 | Verify button | Button re-enabled |

**Test Data:** Non-existent entry ID
**Postconditions:** Row remains; user informed

---

### TC-202: API Returns 503

| Field | Value |
|-------|-------|
| **ID** | TC-202 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | EF-03 |
| **Preconditions** | Server engine not initialized (startup phase) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger 503 response (mock or server restart) | API returns 503 |
| 2 | Click "Mark Reviewed" | Error toast: "Service unavailable — please try again later" |
| 3 | Verify button | Button re-enabled |

**Test Data:** Any entry
**Postconditions:** No data change; user can retry

---

### TC-203: API Returns 500

| Field | Value |
|-------|-------|
| **ID** | TC-203 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Requirement** | EF-04 |
| **Preconditions** | Server returns 500 (DB locked or internal error) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger 500 response | API returns 500 |
| 2 | Click "Mark Reviewed" | Error toast: "Error: 500" |
| 3 | Verify button | Button re-enabled |

**Test Data:** Any entry
**Postconditions:** Button clickable; no data change

---

### TC-204: Error Toast Auto-dismiss after 5s

| Field | Value |
|-------|-------|
| **ID** | TC-204 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Requirement** | BR-04, BR-11 |
| **Preconditions** | Error condition triggered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger any error (e.g., offline mode) | Error toast appears (red) |
| 2 | Wait 5 seconds | Toast fades out and is removed |
| 3 | Verify DOM | Toast element removed |

**Test Data:** N/A
**Postconditions:** Toast gone after 5s

---

## 4. Business Rule Validation

### TC-300: BR-01 — Double-click Prevention

| Field | Value |
|-------|-------|
| **ID** | TC-300 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-01 |
| **Preconditions** | Dashboard loaded with entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Rapidly double-click "Mark Reviewed" button | Only 1 API call made (check Network tab) |
| 2 | Verify button state after first click | Button disabled immediately |

**Test Data:** Entry 901
**Postconditions:** Single API call; no duplicate requests

---

### TC-301: BR-02 — Row Fade Animation Duration

| Field | Value |
|-------|-------|
| **ID** | TC-301 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Requirement** | BR-02 |
| **Preconditions** | Dashboard with entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Mark Reviewed" | Row opacity transitions to 0 |
| 2 | Inspect element transition | CSS transition = "opacity 300ms ease-out" |
| 3 | Time the animation | ~300ms from start to row removal |

**Test Data:** Any stale entry

---

### TC-302: BR-05 — Stale Count Decrement

| Field | Value |
|-------|-------|
| **ID** | TC-302 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-05 |
| **Preconditions** | Dashboard loaded; Stale metric card shows value > 0 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Note current Stale count (e.g., 5) | Value visible in metric card |
| 2 | Mark one entry as reviewed | Row removed |
| 3 | Check Stale metric card | Value = 4 (decremented by 1) |

**Test Data:** Multiple stale entries

---

### TC-303: BR-08 — Badge Replaces Button in Detail

| Field | Value |
|-------|-------|
| **ID** | TC-303 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-08, BR-09 |
| **Preconditions** | Entry detail panel open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Mark Reviewed" in detail panel | Button replaced with badge |
| 2 | Verify badge text | "Reviewed ✓" |
| 3 | Verify badge styling | Green background (#166534), light text (#bbf7d0) |
| 4 | Try to click badge | Non-interactive (no cursor:pointer, no onclick) |

**Test Data:** Any entry

---

### TC-304: BR-10 — Success Toast Green Styling

| Field | Value |
|-------|-------|
| **ID** | TC-304 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Requirement** | BR-10 |
| **Preconditions** | Successful mark reviewed action |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mark entry as reviewed | Toast appears |
| 2 | Inspect toast styling | background: #166534; border-left: 4px solid #22c55e |
| 3 | Verify text color | color: #bbf7d0 |

---

### TC-305: BR-12 — Multiple Toasts Stack

| Field | Value |
|-------|-------|
| **ID** | TC-305 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Requirement** | BR-12 |
| **Preconditions** | Dashboard with multiple entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Rapidly mark 2 entries (before first toast dismisses) | 2 toasts visible |
| 2 | Verify stacking | Toasts stacked vertically, newest on top |
| 3 | Verify no overlap | gap: 0.5rem between toasts |

**Test Data:** Entries 901, 902

---

### TC-306: BR-13 — Toast Doesn't Block Interaction

| Field | Value |
|-------|-------|
| **ID** | TC-306 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Requirement** | BR-13 |
| **Preconditions** | Toast visible on screen |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger a toast | Toast appears at top-right |
| 2 | Click other page elements (nav links, other buttons) | Elements are clickable; toast doesn't block |
| 3 | Verify pointer-events | Toast container doesn't cover full page |

---

### TC-307: BR-14 — Toast Manual Dismiss

| Field | Value |
|-------|-------|
| **ID** | TC-307 |
| **Priority** | Low |
| **Type** | Business Rule |
| **Requirement** | BR-14 |
| **Preconditions** | Toast visible |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger a toast | Toast with ✕ button visible |
| 2 | Click ✕ on toast | Toast immediately removed from DOM |

**Test Data:** N/A

---

## 5. UI/UX Testing

### TC-500: Action Column Header Present

| Field | Value |
|-------|-------|
| **ID** | TC-500 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Requirement** | FSD §3.1.5 |
| **Preconditions** | Dashboard loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inspect Due Reviews table headers | 5 columns: ID, Summary, Last Reviewed, Overdue, Action |
| 2 | Verify Action header styling | Same style as other headers (background:#334155, font-size:.65rem) |

---

### TC-501: Button Styling — Normal State

| Field | Value |
|-------|-------|
| **ID** | TC-501 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Requirement** | FSD §3.1.5, TDD §5.6 |
| **Preconditions** | Dashboard with entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inspect "Mark Reviewed" button | background: #22c55e; color: white; border-radius: 4px |
| 2 | Hover over button | background changes to #16a34a |
| 3 | Verify font-size | 0.65rem |

---

### TC-502: Loading Spinner Visual

| Field | Value |
|-------|-------|
| **ID** | TC-502 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Requirement** | TDD §5.6 |
| **Preconditions** | Slow network (throttle to Slow 3G) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Throttle network to Slow 3G | Network slowed |
| 2 | Click "Mark Reviewed" | Spinner visible (rotating circle) |
| 3 | Verify spinner | 12x12px, white border-top, rotating animation |

---

### TC-503: Toast Position — Top Right

| Field | Value |
|-------|-------|
| **ID** | TC-503 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Requirement** | FSD §3.3.3 |
| **Preconditions** | Toast triggered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger toast | Toast appears |
| 2 | Verify position | Fixed, top: 1rem, right: 1rem |
| 3 | Resize window | Toast stays at top-right |

---

### TC-504: Detail Panel Button Position

| Field | Value |
|-------|-------|
| **ID** | TC-504 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Requirement** | FSD §3.2.4 |
| **Preconditions** | Entry detail panel open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open entry detail | Panel shows header with entry ID |
| 2 | Verify button position | "Mark Reviewed" button left of ✕ close button |
| 3 | Verify button style | Outline style (border: 1px solid #22c55e) — or solid green per TDD |

---

### TC-505: Empty State Message

| Field | Value |
|-------|-------|
| **ID** | TC-505 |
| **Priority** | Medium |
| **Type** | UI/UX |
| **Requirement** | AF-01 |
| **Preconditions** | No stale entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load dashboard with no stale entries | Table shows "No due reviews" |
| 2 | Verify styling | opacity: 0.6, font-size: 0.75rem |
| 3 | Verify colspan | Spans all 5 columns |

---

## 6. Non-Functional Testing (Accessibility)

### TC-600: Keyboard Navigation — Tab Focus

| Field | Value |
|-------|-------|
| **ID** | TC-600 |
| **Priority** | Medium |
| **Type** | Non-Functional — Accessibility |
| **Requirement** | NFR Accessibility |
| **Preconditions** | Dashboard loaded with entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Press Tab repeatedly | Focus reaches "Mark Reviewed" button |
| 2 | Verify focus indicator | 2px solid #22c55e outline visible |
| 3 | Press Enter on focused button | Same behavior as click (API called) |
| 4 | Press Space on focused button | Same behavior as click |

---

### TC-601: ARIA Label

| Field | Value |
|-------|-------|
| **ID** | TC-601 |
| **Priority** | Medium |
| **Type** | Non-Functional — Accessibility |
| **Requirement** | NFR Accessibility |
| **Preconditions** | Dashboard loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inspect button element | aria-label="Mark entry {id} as reviewed" |
| 2 | Verify with screen reader | Announces "Mark entry 901 as reviewed, button" |

---

### TC-602: Toast ARIA — Role Alert

| Field | Value |
|-------|-------|
| **ID** | TC-602 |
| **Priority** | Medium |
| **Type** | Non-Functional — Accessibility |
| **Requirement** | TDD §5.7 |
| **Preconditions** | Toast triggered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger toast | Toast container has role="alert" aria-live="polite" |
| 2 | Verify screen reader | Announces toast message |

---

### TC-603: Color Contrast — WCAG AA

| Field | Value |
|-------|-------|
| **ID** | TC-603 |
| **Priority** | Medium |
| **Type** | Non-Functional — Accessibility |
| **Requirement** | NFR Accessibility |
| **Preconditions** | Elements visible |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check button text contrast (white on #22c55e) | Ratio ≥ 4.5:1 |
| 2 | Check success toast contrast (#bbf7d0 on #166534) | Ratio ≥ 4.5:1 |
| 3 | Check error toast contrast (#fecaca on #7f1d1d) | Ratio ≥ 4.5:1 |
| 4 | Run axe DevTools audit | No contrast violations |

---

## 7. Integration Testing

### TC-700: API Call with basePath

| Field | Value |
|-------|-------|
| **ID** | TC-700 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | TDD §5.4, ui-relative-paths rule |
| **Preconditions** | Server running with basePath configured (e.g., /mcp) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set window.__MCP_BASE = '/mcp' | basePath configured |
| 2 | Click "Mark Reviewed" | Network tab shows POST to /mcp/api/kb/entries/{id}/review |
| 3 | Verify no absolute path | URL does NOT start with just /api (must have basePath prefix) |

**Test Data:** Entry 901 with basePath = '/mcp'

---

### TC-701: API Call without basePath (default)

| Field | Value |
|-------|-------|
| **ID** | TC-701 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | TDD §5.4 |
| **Preconditions** | Server running at root (no basePath) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure window.__MCP_BASE is '' or undefined | No basePath |
| 2 | Click "Mark Reviewed" | Network tab shows POST to /api/kb/entries/{id}/review |
| 3 | Verify response | 200 OK with { status: "ok", entryId: N } |

**Test Data:** Entry 901

---

### TC-702: Dashboard Load — Reminders API with basePath

| Field | Value |
|-------|-------|
| **ID** | TC-702 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | TDD §5.4 |
| **Preconditions** | basePath configured |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load dashboard page | loadReminders() called |
| 2 | Check Network tab | GET request to {basePath}/api/kb/reminders |
| 3 | Verify table populated | Due Reviews table shows entries from API |

---

## 8. Regression Testing

### TC-800: Dashboard Load Still Works

| Field | Value |
|-------|-------|
| **ID** | TC-800 |
| **Priority** | Medium |
| **Type** | Regression |
| **Requirement** | Existing functionality |
| **Preconditions** | Server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /dashboard | Page loads without JS errors |
| 2 | Verify health gauge | Gauge renders with score |
| 3 | Verify metrics cards | 4 cards: Total Entries, Quality Avg, Stale, Unowned |
| 4 | Verify recommendations | List renders |
| 5 | Verify trends charts | Canvas charts render |

---

### TC-801: Browser Tab Still Works

| Field | Value |
|-------|-------|
| **ID** | TC-801 |
| **Priority** | Medium |
| **Type** | Regression |
| **Requirement** | Existing functionality |
| **Preconditions** | Server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Browser tab | Entry list loads |
| 2 | Click an entry | Detail panel opens with entry content |
| 3 | Close detail panel | Panel closes (✕ button works) |
| 4 | Use filters | Entries filter correctly |
| 5 | Use search | Search returns results |

---

### TC-802: Navigation Links Still Work

| Field | Value |
|-------|-------|
| **ID** | TC-802 |
| **Priority** | Medium |
| **Type** | Regression |
| **Requirement** | Existing functionality |
| **Preconditions** | Dashboard page loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Graph" nav link | Navigates to graph page |
| 2 | Click "Dashboard" nav link | Returns to dashboard |
| 3 | Click "Tags" nav link | Navigates to tags page |
| 4 | Click "Quality" nav link | Navigates to quality page |

---

## 9. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Status |
|-------------|--------|------------|--------|
| UC-01 (Mark from Dashboard) | FSD §3.1 | TC-001, TC-004, TC-005, TC-300, TC-301, TC-302 | Covered |
| UC-02 (Mark from Detail) | FSD §3.2 | TC-002, TC-102, TC-303 | Covered |
| BR-01 (Double-click prevention) | FSD §3.1.3 | TC-300 | Covered |
| BR-02 (300ms fade) | FSD §3.1.3 | TC-301 | Covered |
| BR-03 (Success toast 3s) | FSD §3.1.3 | TC-003 | Covered |
| BR-04 (Error toast 5s) | FSD §3.1.3 | TC-204 | Covered |
| BR-05 (Stale decrement) | FSD §3.1.3 | TC-302 | Covered |
| BR-06 (Idempotent) | FSD §3.1.3 | TC-101 | Covered |
| BR-07 (Panel stays open) | FSD §3.2.3 | TC-002 | Covered |
| BR-08 (Badge replaces button) | FSD §3.2.3 | TC-303 | Covered |
| BR-09 (Badge text) | FSD §3.2.3 | TC-303 | Covered |
| BR-10 (Success green) | FSD §3.3.2 | TC-304 | Covered |
| BR-11 (Error red) | FSD §3.3.2 | TC-204 | Covered |
| BR-12 (Stack vertically) | FSD §3.3.2 | TC-305 | Covered |
| BR-13 (No block) | FSD §3.3.2 | TC-306 | Covered |
| BR-14 (Manual dismiss) | FSD §3.3.2 | TC-307 | Covered |
| EF-01 (Network error) | FSD §3.1.2 | TC-200 | Covered |
| EF-02 (404) | FSD §3.1.2 | TC-201 | Covered |
| EF-03 (503) | FSD §3.1.2 | TC-202 | Covered |
| EF-04 (Other error) | FSD §3.1.2 | TC-203 | Covered |
| AF-01 (Empty table) | FSD §3.1.2 | TC-100, TC-004 | Covered |
| NFR — Keyboard | BRD §6 | TC-600 | Covered |
| NFR — ARIA | BRD §6 | TC-601, TC-602 | Covered |
| NFR — Contrast | BRD §6 | TC-603 | Covered |
| basePath compliance | TDD §5.4 | TC-700, TC-701, TC-702 | Covered |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 2 | 2 | 100% |
| Business Rules | 14 | 14 | 100% |
| Exception Flows | 4 | 4 | 100% |
| Alternative Flows | 2 | 2 | 100% |
| NFR | 3 | 3 | 100% |
| **Overall** | **25** | **25** | **100%** |

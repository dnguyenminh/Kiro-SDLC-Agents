# Technical Design Document (TDD)

## KB Web Viewer — KSA-108: Add Mark Reviewed Button and Review Workflow on Dashboard

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-108 |
| Title | KB Web Viewer: Add Mark Reviewed button and review workflow on Dashboard |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-22 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-108.docx |
| Related FSD | FSD-v1-KSA-108.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-22 | SA Agent | Initiate document — frontend-only technical design |

---

## 1. Introduction

### 1.1 Purpose

Technical design for adding "Mark Reviewed" functionality to the KB Web Viewer frontend. This is a **frontend-only change** — the backend API already exists and requires no modification.

### 1.2 Scope

| In Scope | Out of Scope |
|----------|-------------|
| Modify `dashboard.js` — add button + API call | Backend API changes |
| Modify `dashboard.html` — add Action column | Database schema changes |
| Modify `browser.js` — add button to detail panel | New server routes |
| Create toast notification utility | Authentication changes |

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | JavaScript (Vanilla) | ES2020+ |
| UI Framework | None (plain DOM) | N/A |
| Styling | CSS (inline + ui-tokens.css) | N/A |
| Build Tool | None (served as static files) | N/A |
| Server | MCP Server (Kotlin/Python/Node.js) | Existing |
| Database | SQLite | Existing |

### 1.4 Design Principles

- **Minimal footprint** — no new dependencies, no build step, vanilla JS
- **Progressive enhancement** — feature degrades gracefully if API unavailable
- **Accessibility first** — keyboard navigation, ARIA labels, WCAG AA
- **Consistent with existing code** — match dashboard.js/browser.js patterns
- **basePath compliance** — all API calls use `window.__MCP_BASE` prefix

### 1.5 Constraints

- No external libraries (project uses vanilla JS only)
- Must work across all 3 server variants (Kotlin, Python, Node.js)
- Static files served from `/static/` or same-origin root
- No build/transpile step — code must be ES2020 compatible

---

## 2. System Architecture

### 2.1 Architecture Overview

![Architecture Diagram](diagrams/architecture.png)

This is a frontend-only change. The architecture remains unchanged — static HTML/JS files served by the MCP server, communicating via REST API.

**Modified Components:**
- `dashboard.html` — HTML structure (new column)
- `dashboard.js` — JavaScript logic (mark reviewed + toast)
- `browser.js` — JavaScript logic (mark reviewed in detail panel)

**Unchanged Components:**
- Backend API (`UxRoutes.kt` / `ux-routes.ts` / `ux_routes.py`)
- Database schema (`knowledge_entries` table)
- Other viewer pages

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| dashboard.html | Page structure, table layout | HTML |
| dashboard.js | Load reminders, render table, mark reviewed, toast | Vanilla JS |
| browser.js | Entry detail panel, mark reviewed button | Vanilla JS |
| ui-tokens.css | Design tokens (colors, spacing) | CSS |
| ux-components.css | Reusable component styles | CSS |
| Backend API | POST /api/kb/entries/{id}/review | Kotlin/Python/Node.js |

### 2.3 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| dashboard.js | Backend API | HTTP REST | Sync (fetch) | POST mark reviewed |
| dashboard.js | DOM | Direct | Sync | Update table, show toast |
| browser.js | Backend API | HTTP REST | Sync (fetch) | POST mark reviewed |
| browser.js | DOM | Direct | Sync | Replace button with badge |

---

## 3. API Design

### 3.1 API Overview

| # | Endpoint | Method | Description | Source |
|---|----------|--------|-------------|--------|
| 1 | /api/kb/entries/{id}/review | POST | Mark entry as reviewed | UC-01, UC-02 |

**No new API endpoints.** The existing endpoint is used as-is.

### 3.2 API: Mark Entry as Reviewed

**Implements:** UC-01, UC-02, BR-01 through BR-06

| Attribute | Value |
|-----------|-------|
| Method | POST |
| Path | /api/kb/entries/{id}/review |
| Auth | None (same-origin) |
| Rate Limit | None |
| Body | Empty (no request body) |

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | Integer | Yes | KB entry ID (positive integer) |

**Response — 200 OK:**

```json
{
  "status": "ok",
  "entryId": 42
}
```

**Error Responses:**

| Status | Code | Message | When |
|--------|------|---------|------|
| 400 | INVALID_ID | "Invalid id" | Non-numeric or negative ID |
| 503 | ENGINE_UNAVAILABLE | "Engine not initialized" | Server starting up |
| 500 | INTERNAL_ERROR | Error message | DB update failure |

**Frontend URL Construction:**

```javascript
const basePath = window.__MCP_BASE || '';
const url = basePath + '/api/kb/entries/' + entryId + '/review';
```

---

## 4. Database Design

**No database changes required.** The existing `knowledge_entries` table already has all necessary columns:

```sql
-- Existing columns used by this feature:
-- id INTEGER PRIMARY KEY
-- staleness_score REAL DEFAULT 0.0
-- last_reviewed_at TEXT (ISO 8601)
-- updated_at TEXT (ISO 8601)
```

**Existing UPDATE query (in UxRoutes.kt):**

```sql
UPDATE knowledge_entries SET updated_at = datetime('now') WHERE id = ?
```

**Note:** The Kotlin variant only updates `updated_at`. The `KbStaleTool.kt` variant (used by MCP tools) also resets `staleness_score = 0` and sets `last_reviewed_at`. The API endpoint behavior is sufficient for the UI use case — the staleness score recalculation happens on next `detect_stale` run.

---

## 5. Module Design

### 5.1 File Structure (Changes Only)

```
shared/viewer/
├── dashboard.html          # MODIFIED — add Action column header
├── dashboard.js            # MODIFIED — add markReviewed(), showToast(), updated loadReminders()
└── browser.js              # MODIFIED — add Mark Reviewed button to showBrowserDetail()
```

### 5.2 Function Design — dashboard.js

#### New Functions

| Function | Parameters | Returns | Responsibility |
|----------|-----------|---------|----------------|
| `markReviewed(entryId, buttonEl, context)` | entryId: number, buttonEl: HTMLElement, context: 'dashboard'\|'detail' | void (async) | Call API, handle success/error |
| `showToast(message, type)` | message: string, type: 'success'\|'error' | void | Create and show toast notification |
| `decrementStaleCount()` | none | void | Decrement stale metric card value |

#### Modified Functions

| Function | Change |
|----------|--------|
| `loadReminders()` | Add "Action" column with button to each row |

### 5.3 Function Design — browser.js

#### Modified Functions

| Function | Change |
|----------|--------|
| `showBrowserDetail(id)` | Add "Mark Reviewed" button to detail panel header |

### 5.4 Implementation Details

#### markReviewed() — Core Logic

```javascript
async function markReviewed(entryId, buttonEl, context) {
  // 1. Prevent double-click (BR-01)
  buttonEl.disabled = true;
  const originalHTML = buttonEl.innerHTML;
  buttonEl.innerHTML = '<span class="spinner"></span>';

  try {
    // 2. Call API (basePath compliance)
    const basePath = window.__MCP_BASE || '';
    const r = await fetch(basePath + '/api/kb/entries/' + entryId + '/review', {
      method: 'POST'
    });

    // 3. Handle errors
    if (!r.ok) {
      const msg = r.status === 404 ? 'Entry not found'
        : r.status === 503 ? 'Service unavailable — please try again later'
        : 'Error: ' + r.status;
      showToast(msg, 'error');
      buttonEl.disabled = false;
      buttonEl.innerHTML = originalHTML;
      return;
    }

    // 4. Success
    showToast('Entry #' + entryId + ' marked as reviewed', 'success');

    if (context === 'dashboard') {
      // 5a. Dashboard: fade out row (BR-02)
      const row = buttonEl.closest('tr');
      row.style.transition = 'opacity 300ms ease-out';
      row.style.opacity = '0';
      setTimeout(function() {
        row.remove();
        const tbody = document.getElementById('reminders');
        if (!tbody.children.length) {
          tbody.innerHTML = '<tr><td colspan="5" style="padding:.4rem;font-size:.75rem;opacity:.6">No due reviews</td></tr>';
        }
        decrementStaleCount();
      }, 300);
    } else {
      // 5b. Detail: replace with badge (BR-08)
      const badge = document.createElement('span');
      badge.textContent = 'Reviewed ✓';
      badge.className = 'review-badge';
      buttonEl.replaceWith(badge);
    }
  } catch (err) {
    showToast('Network error — please try again', 'error');
    buttonEl.disabled = false;
    buttonEl.innerHTML = originalHTML;
  }
}
```

#### showToast() — Notification System

```javascript
function showToast(message, type) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span>' + esc(message) + '</span><span style="cursor:pointer;margin-left:8px;opacity:.7" onclick="this.parentElement.remove()">✕</span>';
  toast.style.cssText = 'min-width:250px;max-width:350px;padding:.75rem 1rem;border-radius:.5rem;font-size:.75rem;'
    + 'box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:space-between;'
    + 'opacity:0;transition:opacity 200ms;'
    + (type === 'success'
      ? 'background:#166534;color:#bbf7d0;border-left:4px solid #22c55e;'
      : 'background:#7f1d1d;color:#fecaca;border-left:4px solid #ef4444;');

  container.prepend(toast);
  requestAnimationFrame(function() { toast.style.opacity = '1'; });

  var timeout = type === 'success' ? 3000 : 5000;
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 200);
  }, timeout);
}
```

#### decrementStaleCount()

```javascript
function decrementStaleCount() {
  var cards = document.querySelectorAll('#metrics .card');
  cards.forEach(function(card) {
    var label = card.querySelector('h3');
    if (label && label.textContent.trim() === 'Stale') {
      var val = card.querySelector('.val');
      var current = parseInt(val.textContent) || 0;
      if (current > 0) val.textContent = current - 1;
    }
  });
}
```

### 5.5 HTML Changes — dashboard.html

Add "Action" column header to the Due Reviews table:

```html
<!-- BEFORE -->
<th>Overdue</th>
</tr></thead>

<!-- AFTER -->
<th>Overdue</th>
<th style="text-align:left;padding:.4rem;background:#334155;font-size:.65rem;color:#94a3b8">Action</th>
</tr></thead>
```

### 5.6 CSS Additions

```css
/* Toast styles */
.toast { animation: toast-in 200ms ease-out; }
@keyframes toast-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

/* Mark Reviewed button */
.btn-review { background:#22c55e;color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:.65rem;cursor:pointer; }
.btn-review:hover { background:#16a34a; }
.btn-review:disabled { opacity:.6;cursor:not-allowed; }
.btn-review:focus { outline:2px solid #22c55e;outline-offset:2px; }

/* Review badge */
.review-badge { background:#166534;color:#bbf7d0;border-radius:4px;padding:3px 6px;font-size:.65rem; }

/* Spinner */
.spinner { display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
```

### 5.7 Accessibility Implementation

| Element | ARIA | Keyboard | Notes |
|---------|------|----------|-------|
| Mark Reviewed button | `aria-label="Mark entry {id} as reviewed"` | Tab focus, Enter/Space activate | Standard button behavior |
| Toast notification | `role="alert" aria-live="polite"` | N/A (auto-dismiss) | Screen reader announces |
| Loading state | `aria-busy="true"` on button | N/A | Communicates loading |

---

## 6. Integration Design

### 6.1 Existing API Integration

| Attribute | Value |
|-----------|-------|
| Protocol | HTTP REST |
| Endpoint | Same-origin `/api/kb/entries/{id}/review` |
| Authentication | None (same-origin cookie/session) |
| Timeout | Browser default (no custom timeout) |
| Retry Policy | Manual (user clicks again) |
| Circuit Breaker | None needed (single user action) |

**No new integrations.** The feature uses the existing API endpoint.

---

## 7. Security Design

### 7.1 Input Validation

| Input | Client Validation | Server Validation |
|-------|-------------------|-------------------|
| entry_id | Extracted from DOM data attribute (trusted) | `toLongOrNull()` — rejects non-numeric |

### 7.2 XSS Prevention

- Toast messages use `esc()` function (HTML entity encoding)
- Entry summaries in table already escaped by existing `esc()` function
- No user-provided content rendered as raw HTML

### 7.3 CSRF Protection

- Same-origin requests only (no CORS)
- POST method with no body — standard browser same-origin policy applies

---

## 8. Performance & Scalability

### 8.1 Performance Targets

| Operation | Target | Actual (Expected) |
|-----------|--------|-------------------|
| Button click → loading state | < 100ms | ~16ms (single rAF) |
| API round-trip | < 500ms | ~50-200ms (local SQLite) |
| Row fade animation | 300ms | Exactly 300ms (CSS transition) |
| Toast appear | < 200ms | 200ms (CSS animation) |

### 8.2 Resource Impact

- **JS bundle size increase:** ~2KB (unminified) — negligible
- **DOM nodes added:** 1 button per row + toast container — negligible
- **Network requests:** 1 POST per click — negligible
- **Memory:** No persistent state — garbage collected after animation

---

## 9. Monitoring & Observability

### 9.1 Logging

| Log Event | Level | Where | Fields |
|-----------|-------|-------|--------|
| Mark reviewed success | INFO | Browser console | entry_id |
| Mark reviewed error | ERROR | Browser console | entry_id, status, error message |
| Network failure | ERROR | Browser console | entry_id, error type |

### 9.2 Server-Side (Existing)

The backend already logs the UPDATE operation. No additional server logging needed.

---

## 10. Implementation Checklist

### Files to Modify

| # | File | Change | Effort |
|---|------|--------|--------|
| 1 | `shared/viewer/dashboard.html` | Add "Action" th column | 5 min |
| 2 | `shared/viewer/dashboard.js` | Add `markReviewed()`, `showToast()`, `decrementStaleCount()`; modify `loadReminders()` | 30 min |
| 3 | `shared/viewer/browser.js` | Add button to `showBrowserDetail()`; import `markReviewed` | 15 min |

### Files NOT Modified

- Backend routes (all 3 variants) — API already exists
- Database schema — no changes
- Other viewer pages — not affected
- CSS files — styles added inline or via `<style>` block in dashboard.html

### Implementation Order

1. Add `showToast()` function to dashboard.js (reusable utility)
2. Add `markReviewed()` function to dashboard.js
3. Add `decrementStaleCount()` function to dashboard.js
4. Modify `loadReminders()` to render button in each row
5. Add "Action" column header to dashboard.html
6. Add CSS for button, badge, spinner, toast to dashboard.html `<style>`
7. Modify `showBrowserDetail()` in browser.js to add button
8. Test all scenarios (success, error, empty state, keyboard)

---

## 11. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

### Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Should `showToast()` be extracted to a shared module? | Resolved | No — keep in dashboard.js for now. Can refactor later if other pages need it. |
| 2 | Should the Kotlin API also reset staleness_score (like KbStaleTool)? | Resolved | Not in scope — the detect_stale job handles recalculation. UI just needs the visual feedback. |

### Glossary

| Term | Definition |
|------|------------|
| basePath | URL prefix for API calls, detected from `window.__MCP_BASE` |
| rAF | requestAnimationFrame — browser API for smooth animations |
| Same-origin | Request to the same protocol+host+port as the page |

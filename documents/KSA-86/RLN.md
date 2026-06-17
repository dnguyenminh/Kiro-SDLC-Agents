# Release Notes (RLN)

## KSA-86: Frontend HTML Update (Dashboard, Tags, Quality, Analytics Pages)

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | MINOR (new features) |
| Release Date | 2025-07-15 |
| Jira Ticket | KSA-86 |
| Branch | KSA-86 |
| Author | DevOps Agent |

---

## 1. Summary

Added three frontend enhancements to the KB Web Viewer: typeahead search on Tags page, due reviews/reminders widget on Dashboard, and most-cited entries section on Quality page with new API endpoint.

---

## 2. New Features

| # | Feature | Page | Description |
|---|---------|------|-------------|
| 1 | Typeahead search | Tags | Auto-suggestions as user types in search |
| 2 | Due reviews/reminders | Dashboard | Shows entries needing review |
| 3 | Most cited entries | Quality | Displays most referenced KB entries |
| 4 | Citations API | Backend | /api/kb/citations/most endpoint |

---

## 3. Technical Changes

| File | Change |
|------|--------|
| viewer_tags_html.py | Added typeahead JS + API call |
| viewer_dashboard_html.py | Added reminders section |
| viewer_quality_html.py | Added citations section |
| kb_viewer_routes.py | New /api/kb/citations/most route |

---

## 4. Breaking Changes

None.

---

## 5. Testing

| Test Type | Result |
|-----------|--------|
| Manual verification | PASS |
| All 3 gap fixes verified | PASS |

---

## 6. Upgrade Instructions

Deploy updated Python files, restart server. No configuration needed.

---

## 7. Rollback

Revert 4 Python files, restart. Features disappear, no data loss.

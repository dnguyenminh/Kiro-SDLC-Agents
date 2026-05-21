# Pending Jira Tickets

> Tạo khi Jira MCP tools available. SM agent sẽ sync lên Jira.

---

## Ticket 1: Bug Fix (đã commit)

| Field | Value |
|-------|-------|
| Type | Bug |
| Project | KSA |
| Summary | KB Web Viewer: Missing search_log, auto-cite, auto-score, auto-owner on ingest |
| Priority | High |
| Status | Done (code committed) |
| Assignee | dev-agent |

### Description

Multiple data pipeline issues in all 3 MCP servers (Kotlin, Python, Node.js) causing KB Web Viewer pages to show empty data.

### Bugs Fixed

1. **Analytics page empty** — `mem_search` and `code_search` did not log to `search_log` table
2. **Most Cited empty** — `mem_search` did not auto-record citations for returned entries
3. **Low Quality empty** — `mem_ingest` did not auto-compute quality score
4. **UNOWNED = 100%** — `mem_ingest` did not set `owner` field
5. **Kotlin missing /api/kb/* routes** — HTML pages served but no API handlers

### Files Changed (16 files, +983 lines)

**Kotlin:** MemoryToolDispatcher.kt, ToolDispatcher.kt, ViewerServer.kt + 8 new service files
**Python:** dispatcher.py, server.py, kb_viewer_routes.py
**Node.js:** tool-dispatcher.ts, register-tools.ts

### Commit
`fix: KB Web Viewer data pipeline — add search_log, auto-cite, auto-score, auto-owner on ingest`

---

## Ticket 2: Feature — KB Web Viewer Review UI

| Field | Value |
|-------|-------|
| Type | Story |
| Project | KSA |
| Summary | KB Web Viewer: Add "Mark Reviewed" button and review workflow on Dashboard |
| Priority | Medium |
| Status | To Do |

### Description

Dashboard page shows "Due Reviews" table but has no way to mark entries as reviewed directly from the UI. Users must use MCP tools (`mem_lifecycle(action="mark_reviewed")`) which is not discoverable.

### Acceptance Criteria

1. Due Reviews table has "Mark Reviewed" button per row
2. Clicking button calls `POST /api/kb/entries/{id}/review`
3. Entry disappears from Due Reviews after marking
4. Success toast notification shown
5. Browser tab (Entry detail view) also has "Mark Reviewed" button
6. Staleness score resets to 0 after review

### Related
- KSA-93 (UX Improvements)
- KSA-86 (Frontend HTML Update)

---

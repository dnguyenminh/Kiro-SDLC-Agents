# Release Notes (RLN)

## Code Intelligence Extension — KSA-286: Web Admin Portal v1.0

---

## Release Information

| Field | Value |
|-------|-------|
| Version | 1.0.0 |
| Release Date | 2025-07-14 |
| Jira Ticket | KSA-286 |
| Type | Feature (Major) |
| Parent | KSA-284 (Backend MCP Server) |

---

## Summary

First release of the **Web Admin Portal** — a comprehensive administration interface for the Code Intelligence Backend MCP Server. Provides dashboard monitoring, KB management, MCP server control, user management, RBAC, configuration editing, search debugging, and audit trail.

---

## New Features

### Dashboard & Monitoring
- Real-time system health (uptime, memory, CPU, DB size)
- MCP server status overview
- KB statistics per tier
- Activity feed (last 20 actions)
- System alerts with threshold detection

### Knowledge Base Management
- Browse, search, filter KB entries (paginated)
- Link/unlink entries with circular reference protection
- Tag management with auto-connect suggestions
- Promotion queue (approve/reject with comment)
- Bulk import/export (JSON/CSV)

### KB Graph Visualization
- D3.js force-directed graph (up to 500 nodes at 60fps)
- Color-coded by tier, sized by quality
- Interactive: zoom, pan, click-to-detail, search

### MCP Server Management
- Server status monitoring (auto-refresh 10s)
- Toggle individual tools on/off
- Restart stopped/error servers
- Log viewer (last 200 lines)

### User Management
- Create/disable/delete users
- Force logout (terminate sessions)
- Password reset with temporary credentials
- Session management

### RBAC (Role-Based Access Control)
- Access Groups with permission assignment
- 14 granular permissions with roleData
- UI modules hidden based on permissions
- Permission check on every API call

### Configuration Editor
- Live config editing by section
- Hot-reload (no restart for most settings)
- Restart-required indicator
- Change history with diff

### Search Explorer
- Test queries with ranked results
- Score breakdown (embedding, keyword, recency, quality)
- Side-by-side comparison mode

### Audit Trail
- Immutable log of all admin actions
- Search/filter (user, action, date range)
- Export as CSV/JSON
- Configurable retention (default 90 days)

### Analytics & Quality
- Quality score distribution and trends
- Embedding space 2D visualizer
- Stale entry detection

---

## Technical Details

- **Architecture**: Plugin module within Backend MCP Server
- **Backend**: TypeScript, Hono, SQLite (better-sqlite3)
- **Frontend**: React 18 SPA (Babel standalone CDN, single HTML file)
- **Auth**: JWT (from KSA-285)
- **New DB Tables**: 9 (users, access_groups, permissions, group_permissions, sessions, audit_entries, config_entries, config_history, kb_promotion_queue)
- **API Endpoints**: 35+ under /api/admin/*
- **Test Cases**: 126 (90% automated)

---

## Breaking Changes

None. This is a new module added to the existing Backend MCP Server.

---

## Known Limitations

- Desktop-only (no mobile responsive design)
- English only (no multi-language)
- SSE-based updates (no WebSocket)
- Graph limited to 500 nodes for performance
- Import file max 50MB

---

## Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| KSA-284 | Running | Host server |
| KSA-285 | Running | JWT authentication |
| bcrypt | ^5.0 | Password hashing |
| hono | ^4.x | HTTP framework |
| better-sqlite3 | Existing | Database |

---

## Upgrade Instructions

See Deployment Guide (DPG-v1-KSA-286.docx) for step-by-step deployment.

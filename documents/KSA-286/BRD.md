# Business Requirements Document (BRD)

## Code Intelligence Extension — KSA-286: Web Admin Portal - Server Operations Dashboard and RBAC

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-286 |
| Title | Web Admin Portal - Server Operations Dashboard and RBAC |
| Author | BA Agent |
| Version | 3.0 |
| Date | 2025-07-22 |
| Status | Draft |
| Architecture Pattern | Plugin (extends existing Backend MCP Server) |
| Parent Ticket | KSA-284 (Split Extension: Lightweight Proxy + Backend MCP Server) |
| Depends On | KSA-285 (Authentication, Multi-Tenant KB, and MCP Server Configuration) |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-286 |
| 2.0 | 2025-07-14 | BA Agent | Added Permission Rules Specification (32 fixed rules) |
| 3.0 | 2025-07-22 | SM Agent | Added STORY 13 (Multi-tab Tenant Comparison View), STORY 14 (KB Quality), STORY 15 (KB Tags). Updated STORY 7 with Impersonation feature. Updated page count to 13. |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request adds a **Web Admin Portal** to the Backend MCP Server (KSA-284). The portal is a React SPA served by the backend on the same port under `/admin/*`, providing a comprehensive operations dashboard and Role-Based Access Control (RBAC) system for administering the Code Intelligence platform.

**Key capabilities:**

1. **Dashboard & Monitoring** — Real-time system overview, health status, activity feeds
2. **KB Management** — Link/unlink entries, tag management with auto-connect, promotion queue (short-term → long-term), health monitor, bulk operations, import/export
3. **KB Graph Visualization** — 3D Force Graph (ForceGraph3D/Three.js), minimap, toolbar (search/filter/fit), click-to-detail panel
4. **Analytics & Quality** — Quality scores, metrics, charts, embedding space 2D visualizer
5. **MCP Server Management** — Toggle individual tools on/off, child server health/logs/restart
6. **User Management** — CRUD users (create/enable/disable/delete), active sessions, force logout
7. **Permission & Role System** — Access Groups, Permissions with Roles + roleData (granular control), Impersonation (admin views portal as another user)
8. **Configuration Editor** — Live edit server configuration with validation
9. **Search Explorer** — Test queries, view similarity scores, ranking debug information
10. **Audit Trail** — Complete log of who did what, when
11. **Multi-tab Tenant Comparison** — Admin opens side-by-side panels showing portal from different users' perspectives
12. **KB Quality** — Quality scores, distribution chart, status indicators (good/fair/poor)
13. **KB Tags** — Full CRUD tag management (create/rename/delete/merge tags)

**RBAC Model:**
- User Profile → Access Group (1:1) → Permissions (1:N) → Roles (1:N) with roleData
- Example: Permission `MCP_ACCESS` → roleData = `{mcpServers: ["jira"], methods: ["get_issue", "search"]}`

### 1.2 Out of Scope

- Mobile-responsive design (desktop-only admin portal)
- Public-facing user portal (this is admin-only)
- Multi-language UI (English only in this phase)
- Backend API redesign — extends existing HTTP server with new routes
- SSO integration for portal login (reuses KSA-285 JWT)
- Offline mode for the portal
- Real-time WebSocket push notifications (SSE implemented instead)
- Custom dashboard widgets / user-customizable layouts

### 1.3 Preliminary Requirement

| # | Prerequisite | Source |
|---|-------------|--------|
| 1 | Backend MCP Server operational (KSA-284) | HTTP server running on port 48721 |
| 2 | JWT Authentication functional (KSA-285) | Backend issues JWT, validates on all requests |
| 3 | Multi-Tenant KB architecture (KSA-285) | 3-tier KB with user/project/shared separation |
| 4 | User table exists in Backend database | From KSA-285 authentication implementation |
| 5 | Node.js >= 18.0 runtime available | Backend requirement from KSA-284 |

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Web Admin Portal extends the Backend MCP Server (KSA-284) by adding:
- Static file serving for the React SPA under `/admin/*`
- REST API endpoints under `/api/admin/*` for all portal operations
- RBAC middleware that checks permissions on every admin API call
- Server-Sent Events (SSE) endpoint for real-time health/activity updates

**End-to-end flow:**
1. User navigates to `http://localhost:48721/admin/`
2. Backend serves React SPA (index.html + bundled JS/CSS)
3. SPA initializes → checks JWT token validity
4. If unauthenticated → redirect to login page
5. If valid JWT → fetch user profile + permissions → render dashboard based on allowed modules
6. User interacts with portal modules → SPA calls `/api/admin/*` endpoints → Backend validates JWT + RBAC → executes operation → returns result
7. Audit trail records every admin action

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As an admin, I want to see a system dashboard so that I can monitor overall health at a glance | MUST HAVE | KSA-286 |
| 2 | As an admin, I want to manage KB entries (link/unlink, tag, promote) so that knowledge stays organized | MUST HAVE | KSA-286 |
| 3 | As an admin, I want to visualize the KB graph so that I can understand knowledge relationships | SHOULD HAVE | KSA-286 |
| 4 | As an admin, I want to view analytics and quality scores so that I can assess KB health | SHOULD HAVE | KSA-286 |
| 5 | As an admin, I want to manage MCP servers (toggle tools, view health, restart) so that I can operate the system | MUST HAVE | KSA-286 |
| 6 | As an admin, I want to manage users (create/enable/disable/delete) so that I control who accesses the system | MUST HAVE | KSA-286 |
| 7 | As an admin, I want to configure permissions and roles so that I can enforce least-privilege access | MUST HAVE | KSA-286 |
| 8 | As an admin, I want to edit server configuration live so that I can tune the system without restart | SHOULD HAVE | KSA-286 |
| 9 | As an admin, I want to explore search results so that I can debug query ranking | COULD HAVE | KSA-286 |
| 10 | As an admin, I want to view audit trail so that I can track all administrative actions | MUST HAVE | KSA-286 |
| 11 | As an admin, I want to manage KB promotion queue so that I can review and approve entries moving from short-term to long-term | MUST HAVE | KSA-286 |
| 12 | As an admin, I want to bulk import/export KB entries so that I can migrate data between environments | SHOULD HAVE | KSA-286 |
| 13 | As an admin, I want to compare the portal view of different users side-by-side (Multi-tab Tenant Comparison) so that I can verify permission configurations visually | SHOULD HAVE | KSA-286 |
| 14 | As an admin, I want to view KB Quality scores and distribution so that I can identify entries needing improvement | SHOULD HAVE | KSA-286 |
| 15 | As an admin, I want to manage KB Tags (create/rename/delete/merge) so that I can maintain a clean tag taxonomy | SHOULD HAVE | KSA-286 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Admin opens browser → navigates to `http://localhost:48721/admin/`

**Step 2:** Backend serves React SPA (index.html + bundled JS/CSS)

**Step 3:** SPA initializes → checks JWT token validity

**Step 4:** If unauthenticated → redirect to `/admin/login` → authenticate via KSA-285 JWT flow

**Step 5:** SPA fetches user profile + permissions from `/api/admin/me`

**Step 6:** Render navigation sidebar based on permitted modules (hide unauthorized sections)

**Step 7:** Admin interacts with modules → each action calls REST API with JWT header

**Step 8:** Backend validates JWT → checks RBAC permission → executes → records audit trail → returns response

**Step 9:** SPA renders updated state

> **Note:** All admin actions are audited. The portal degrades gracefully when a user lacks permissions — modules are hidden, not broken.

---

#### STORY 1: Dashboard & Monitoring

> As an admin, I want to see a system dashboard so that I can monitor overall health at a glance.

**Requirement Details:**

1. Display real-time system health summary (Backend uptime, memory usage, CPU, SQLite size)
2. Show MCP server status overview (how many servers running/stopped/error)
3. Show KB statistics (total entries per tier, recent additions, promotion queue size)
4. Display active users count and recent activity feed (last 20 actions)
5. Show system alerts/warnings (disk space low, server crash, high memory)
6. Auto-refresh every 30 seconds (configurable)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| uptime | number | Yes | Backend uptime in seconds | 86400 |
| memoryUsageMB | number | Yes | Current memory usage | 256 |
| cpuPercent | number | Yes | CPU usage percentage | 12.5 |
| sqliteFileSizeMB | number | Yes | Database file size | 45.2 |
| mcpServersOnline | number | Yes | Count of healthy MCP servers | 4 |
| mcpServersTotal | number | Yes | Total configured MCP servers | 5 |
| kbEntryCount | object | Yes | Entries per tier | `{user: 150, project: 500, shared: 200}` |
| activeUsers | number | Yes | Currently active sessions | 3 |
| recentActivity | array | Yes | Last 20 audit events | `[{user, action, timestamp}]` |
| alerts | array | No | Active system alerts | `[{severity, message, since}]` |

**Acceptance Criteria:**

1. Dashboard loads within 2 seconds showing all widgets
2. Health data refreshes automatically every 30 seconds
3. If a metric exceeds threshold (memory > 80%, disk > 90%), alert badge appears
4. Clicking an alert navigates to the relevant management section
5. Dashboard is the default landing page after login

---

#### STORY 2: KB Management

> As an admin, I want to manage KB entries (link/unlink, tag, promote) so that knowledge stays organized.

**Requirement Details:**

1. List KB entries with pagination, search, and filter (by tier, tags, date range, author)
2. View entry detail (content preview, metadata, linked entries, quality score)
3. Link/unlink entries (create/remove relationships between entries)
4. Add/remove tags with auto-connect (adding a tag auto-links to other entries with same tag)
5. View short-term entries per user → promote to long-term (admin approval)
6. Promotion queue: list pending promotions, approve/reject with comment
7. Health monitor: identify orphan entries, low-quality entries, stale entries
8. Bulk operations: bulk tag, bulk delete, bulk promote
9. Import/export: JSON/CSV format, with conflict resolution on import

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| entryId | string | Yes | Unique KB entry identifier | "kb-001-abc" |
| tier | enum | Yes | USER / PROJECT / SHARED | "PROJECT" |
| title | string | Yes | Entry title | "API Authentication Pattern" |
| content | string | Yes | Entry content (markdown) | "## Steps..." |
| tags | string[] | Yes | Associated tags | ["auth", "jwt", "security"] |
| qualityScore | number | Yes | Quality score (0-100) | 85 |
| author | string | Yes | Creator user ID | "user-123" |
| linkedEntries | string[] | No | Related entry IDs | ["kb-002", "kb-003"] |
| createdAt | datetime | Yes | Creation timestamp | "2025-07-14T10:00:00Z" |
| promotionStatus | enum | No | NONE / PENDING / APPROVED / REJECTED | "PENDING" |

**Acceptance Criteria:**

1. Admin can list, search, and filter KB entries across all tiers
2. Admin can link/unlink entries and see relationships reflected in KB graph
3. Adding a tag to an entry automatically suggests and optionally creates links to entries sharing that tag
4. Promotion queue shows all PENDING entries with metadata for review
5. Admin can approve/reject promotion with mandatory comment
6. Bulk operations work on up to 100 entries simultaneously
7. Import accepts JSON format and reports conflicts (duplicate IDs) with resolution options (skip/overwrite/merge)
8. Export generates downloadable JSON/CSV with all metadata

**Validation Rules:**

- Tags must be lowercase, alphanumeric + hyphens, max 50 chars each
- Maximum 20 tags per entry
- Bulk operations require confirmation dialog when affecting > 10 entries
- Promotion requires comment (min 10 characters)

**Error Handling:**

- Entry not found: Show "Entry not found or deleted" message
- Circular link detected: Warn user, prevent creation
- Import file too large (> 50MB): Reject with size limit error
- Concurrent edit conflict: Show diff and ask user to resolve

---

#### STORY 3: KB Graph Visualization

> As an admin, I want to visualize the KB graph so that I can understand knowledge relationships.

**Requirement Details:**

1. 3D Force Graph (ForceGraph3D library, Three.js/WebGL based) showing entries as nodes and links as edges
2. Nodes colored by type (document=blue, code=green, config=orange, api=purple, module=cyan)
3. Node size proportional to quality score
4. Toolbar above graph: search combobox, "Fit View" button, "Filter Types" dropdown with checkboxes per type
5. Click node → detail panel (top-right overlay): name, type badge, tier badge, content preview (300 chars), tags, links count, quality score, created date, ✕ close button
6. Minimap (bottom-right, 180×140 canvas overlay) — draws scaled copy of main graph WebGL canvas via `drawImage`. Interactive: scroll=zoom main graph, drag=rotate main graph, right-drag=pan main graph
7. Legend (bottom-left) — color-coded node types
8. Node labels on hover — "{name} ({type})"
9. Dark background (#0f172a)
10. Search within graph: type node name → camera focuses on matched node + shows detail panel

**Acceptance Criteria:**

1. Graph renders up to 500 nodes without performance degradation (60fps WebGL)
2. Filtering updates graph in real-time (< 500ms) — unchecking type hides nodes of that type
3. Click on node opens detail panel with entry info fetched from GET /api/admin/kb/entries/:id
4. Minimap syncs with main graph (scroll/drag/right-drag controls)
5. Legend showing type colors, node labels on hover

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Graph Canvas | WebGL (Three.js) | Yes | Main ForceGraph3D visualization area | Full width/height, dark bg #0f172a |
| 2 | Toolbar | Bar above graph | Yes | Search combobox + Fit View button + Filter Types dropdown | Horizontal layout |
| 3 | Detail Panel | Overlay (top-right) | No | Shows node details on click | Has ✕ close button |
| 4 | Minimap | Canvas overlay (bottom-right) | Yes | 180×140 scaled copy of main graph | Interactive: scroll/drag/right-drag |
| 5 | Legend | Panel (bottom-left) | Yes | Color-coded node types | Always visible |
| 6 | Node Labels | Hover tooltip | Yes | Shows "{name} ({type})" on hover | Disappears on mouseout |

---

#### STORY 4: Analytics & Quality

> As an admin, I want to view analytics and quality scores so that I can assess KB health.

**Requirement Details:**

1. Quality score distribution chart (histogram: how many entries at each score range)
2. Quality trends over time (line chart: average score per week/month)
3. Metrics dashboard: total entries, avg score, top tags, most linked entries
4. Embedding space 2D visualizer (t-SNE/UMAP projection of entry embeddings)
5. Cluster quality analysis: score per cluster, cluster size distribution
6. Stale entry report: entries not accessed/updated in > 30 days

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| scoreDistribution | object | Yes | Count per score bucket | `{0-20: 5, 21-40: 12, ...}` |
| avgScore | number | Yes | Global average quality score | 72.5 |
| trendData | array | Yes | Weekly/monthly average scores | `[{week, avgScore}]` |
| topTags | array | Yes | Most used tags with count | `[{tag, count}]` |
| embeddingProjection | array | Yes | 2D coordinates per entry | `[{id, x, y, cluster}]` |

**Acceptance Criteria:**

1. Charts render within 3 seconds for up to 10,000 entries
2. Embedding visualizer supports zoom, pan, and hover-to-detail
3. Clicking a point in embedding space shows the entry detail
4. Date range selector filters all analytics views
5. Export analytics data as CSV

---

#### STORY 5: MCP Server Management

> As an admin, I want to manage MCP servers (toggle tools, view health, restart) so that I can operate the system.

**Requirement Details:**

1. List all configured MCP child servers with status (running/stopped/error/starting)
2. View individual server detail: health metrics, last heartbeat, error logs (last 100 lines)
3. Toggle individual tools on/off per server (disable a tool without stopping the server)
4. Restart a crashed/stopped server
5. View server logs in real-time (tail -f style, last 200 lines)
6. Health timeline: server uptime chart over last 24h/7d/30d

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| serverId | string | Yes | MCP server identifier | "atlassian" |
| serverName | string | Yes | Display name | "Atlassian (Jira + Confluence)" |
| status | enum | Yes | RUNNING / STOPPED / ERROR / STARTING | "RUNNING" |
| tools | array | Yes | List of tools with enabled flag | `[{name, enabled, lastCall}]` |
| lastHeartbeat | datetime | Yes | Last health check time | "2025-07-14T10:30:00Z" |
| uptimeSeconds | number | Yes | Current uptime | 3600 |
| errorLog | string[] | No | Recent error messages | ["Connection timeout..."] |
| restartCount | number | Yes | Times restarted since last config | 2 |

**Acceptance Criteria:**

1. Server list refreshes every 10 seconds showing current status
2. Toggling a tool off immediately prevents it from being called (returns "tool disabled" error)
3. Restarting a server shows loading state and reports success/failure within 30 seconds
4. Log viewer shows last 200 lines with auto-scroll for new entries
5. Health timeline shows uptime/downtime periods color-coded

**Error Handling:**

- Server unresponsive: Show "Unresponsive" status after 3 missed heartbeats
- Restart failed: Show error message from restart attempt, offer "Force Kill + Restart"
- Tool toggle failed: Show error, revert toggle UI to previous state

---

#### STORY 6: User Management

> As an admin, I want to manage users (create/enable/disable/delete) so that I control who accesses the system.

**Requirement Details:**

1. List all users with status (active/disabled/pending), last login, assigned Access Group
2. Create new user: username, email, initial password, assign Access Group
3. Enable/disable user (soft delete — disabled users cannot login but data preserved)
4. Delete user (hard delete with confirmation — removes all user data)
5. View active sessions per user (device, IP, login time)
6. Force logout: terminate a specific session or all sessions for a user
7. Password reset: generate temporary password and force change on next login

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| userId | string | Yes | Unique user identifier | "user-abc-123" |
| username | string | Yes | Login username | "john.doe" |
| email | string | Yes | User email | "john@company.com" |
| status | enum | Yes | ACTIVE / DISABLED / PENDING | "ACTIVE" |
| accessGroup | string | Yes | Assigned Access Group name | "Developers" |
| lastLogin | datetime | No | Last successful login | "2025-07-14T09:00:00Z" |
| createdAt | datetime | Yes | Account creation time | "2025-07-01T00:00:00Z" |
| sessions | array | No | Active sessions | `[{sessionId, device, ip, loginAt}]` |

**Acceptance Criteria:**

1. User list supports search by username/email and filter by status/Access Group
2. Creating a user validates: unique username, valid email, password min 8 chars
3. Disabling a user immediately invalidates all their active sessions
4. Hard delete requires typing the username to confirm
5. Force logout terminates session within 5 seconds
6. Password reset generates secure random password (16 chars)

**Validation Rules:**

- Username: 3-50 chars, alphanumeric + dots + hyphens, must be unique
- Email: valid email format, must be unique
- Password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
- Cannot delete the last admin user (System Owner group must have >= 1 member)

---

#### STORY 7: Permission & Role System (RBAC)

> As an admin, I want to configure permissions and roles so that I can enforce least-privilege access.

**Requirement Details:**

1. **Access Groups**: CRUD access groups (e.g., "Administrators", "Developers", "Viewers")
2. **Permissions**: Define permissions (e.g., `KB_READ`, `KB_WRITE`, `MCP_ACCESS`, `USER_MANAGE`, `AUDIT_VIEW`)
3. **Roles within Permission**: Each permission has roles with `roleData` for granular control
4. **Assignment**: Assign user to exactly one Access Group (1:1 relationship)
5. **Access Group → Permissions**: An Access Group has multiple permissions (1:N)
6. **Permission → Roles**: Each permission has roles with roleData (1:N)
7. **roleData examples**:
   - `MCP_ACCESS` → `{mcpServers: ["jira", "drawio"], methods: ["get_issue", "search", "export_png"]}`
   - `KB_WRITE` → `{tiers: ["USER", "PROJECT"], maxEntries: 1000}`
   - `CONFIG_EDIT` → `{sections: ["mcp-servers", "embedding"], readOnly: false}`

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| accessGroupId | string | Yes | Unique group ID | "grp-admin-001" |
| accessGroupName | string | Yes | Display name | "Administrators" |
| permissions | array | Yes | List of permissions in group | `["KB_READ", "KB_WRITE", "MCP_ACCESS"]` |
| permissionId | string | Yes | Permission identifier | "MCP_ACCESS" |
| permissionName | string | Yes | Display name | "MCP Server Access" |
| roles | array | Yes | Roles within this permission | `[{roleName, roleData}]` |
| roleData | object | Yes | Granular configuration per role | `{mcpServers: ["jira"]}` |

**RBAC Model:**

```
User Profile ──(1:1)──► Access Group ──(1:N)──► Permission ──(1:N)──► Role
                                                                        │
                                                                   roleData (JSON)
```

**Acceptance Criteria:**

1. Admin can create/edit/delete Access Groups with assigned permissions
2. Each user belongs to exactly one Access Group
3. Changing a user's Access Group immediately updates their available permissions
4. roleData is validated as valid JSON matching the permission's schema
5. Built-in "System Owner" Access Group cannot be deleted and has all permissions
6. Permission checks happen on every API call (middleware)
7. UI modules are hidden/shown based on user's permissions
8. Attempting an unauthorized action returns HTTP 403 with clear error message
9. Admin with RBAC_MANAGE permission can impersonate another user via `X-Impersonate` header or `GET /api/admin/impersonate/:userId`
10. Impersonation returns the target user's permissions and portal renders as if that user is logged in
11. Full permission enforcement on ALL 17 fixed endpoints (KB links/tags/promotions/export/import, MCP logs/toggle, config history/reset, search, RBAC permissions)

**Validation Rules:**

- Access Group name: 3-100 chars, unique
- Permission IDs: UPPER_SNAKE_CASE, unique
- roleData must match the JSON schema defined for each permission type
- Cannot remove last user from "System Owner" group
- Cannot delete permissions that are in use by Access Groups

#### Permission Rules Specification

> **Design Principle:** Each permission has a FIXED set of configurable rules. Admin selects values from predefined options via dropdowns/checkboxes — NO freeform JSON input. The UI renders appropriate form controls for each rule type.

| Permission | Rule Name | Type | Allowed Values | Default | Description |
|-----------|-----------|------|----------------|---------|-------------|
| DASHBOARD_VIEW | exportAllowed | boolean | true, false | false | Allow exporting dashboard data to CSV/PDF |
| KB_READ | allowedTiers | enum[] | USER, PROJECT, SHARED | [USER, PROJECT, SHARED] | KB tiers user can read from |
| KB_WRITE | allowedTiers | enum[] | USER, PROJECT, SHARED | [USER] | KB tiers user can write to |
| KB_WRITE | maxEntries | number | 1–100000 | 1000 | Max total entries user can create |
| KB_WRITE | allowedOperations | enum[] | CREATE, UPDATE, DELETE | [CREATE, UPDATE] | Write operations user can perform |
| KB_PROMOTE | targetTiers | enum[] | PROJECT, SHARED | [PROJECT] | Tiers user can promote entries to |
| KB_PROMOTE | maxPendingPromotions | number | 1–500 | 50 | Max simultaneous pending promotion requests |
| KB_IMPORT_EXPORT | allowedFormats | enum[] | JSON, CSV | [JSON, CSV] | Allowed import/export file formats |
| KB_IMPORT_EXPORT | allowImport | boolean | true, false | true | Allow importing entries |
| KB_IMPORT_EXPORT | allowExport | boolean | true, false | true | Allow exporting entries |
| KB_IMPORT_EXPORT | maxBatchSize | number | 1–10000 | 1000 | Max entries per import/export batch |
| MCP_ACCESS | allowedServers | enum[] | * (all), atlassian, drawio, markdown-exporter, code-intel | [*] | MCP servers user can access |
| MCP_ACCESS | allowedTools | dynamic enum[] | * (all), or specific tool names loaded from server runtime | [*] | Specific MCP tools user can call (per server) |
| MCP_MANAGE | allowedServers | enum[] | * (all), atlassian, drawio, markdown-exporter, code-intel | [*] | MCP servers user can manage (restart/stop) |
| MCP_MANAGE | allowRestart | boolean | true, false | true | Allow restarting servers |
| MCP_MANAGE | allowStop | boolean | true, false | false | Allow stopping servers |
| USER_MANAGE | canDelete | boolean | true, false | false | Can permanently delete users |
| USER_MANAGE | canForceLogout | boolean | true, false | false | Can force logout active sessions |
| USER_MANAGE | canDisable | boolean | true, false | true | Can disable/enable user accounts |
| RBAC_MANAGE | canDeleteSystemGroups | boolean | true, false | false (LOCKED) | Can delete system-defined Access Groups (always false, non-editable) |
| RBAC_MANAGE | canEditSystemPermissions | boolean | true, false | false | Can modify permissions of system groups |
| CONFIG_EDIT | allowedSections | enum[] | server, embedding, mcp-servers, kb, auth | [server, embedding] | Config sections user can edit |
| CONFIG_EDIT | readOnly | boolean | true, false | true | If true, user can view but not modify config |
| SEARCH_EXPLORE | maxResults | number | 10–1000 | 100 | Max search results returned per query |
| SEARCH_EXPLORE | allowDebugMode | boolean | true, false | false | Allow access to debug/explain query mode |
| AUDIT_VIEW | exportAllowed | boolean | true, false | false | Allow exporting audit log to CSV |
| AUDIT_VIEW | maxDaysVisible | number | 1–365 | 90 | How many days of audit history user can view |
| GRAPH_VIEW | exportAllowed | boolean | true, false | false | Allow exporting graph as PNG/SVG |
| GRAPH_VIEW | maxNodes | number | 50–5000 | 500 | Max nodes rendered in graph view |
| ANALYTICS_VIEW | exportAllowed | boolean | true, false | false | Allow exporting analytics data to CSV/PDF |
| ANALYTICS_VIEW | allowedMetrics | enum[] | quality-scores, embedding-space, usage-stats, health-monitor | [quality-scores, usage-stats] | Which analytics dashboards user can access |

**Rule Type Definitions:**

| Type | UI Control | Storage | Validation |
|------|-----------|---------|------------|
| boolean | Toggle switch | `true` / `false` | Must be boolean |
| number | Number input with min/max slider | Integer | Must be within Allowed Values range |
| enum[] | Multi-select checkboxes | Array of selected values | Each value must be in Allowed Values list |

**Key Constraints:**

- `RBAC_MANAGE.canDeleteSystemGroups` is **LOCKED to false** — cannot be changed via UI. Only direct DB access (emergency) can override.
- When `allowedServers` = `[*]`, it means ALL current and future servers. When specific servers are listed, only those are accessible.
- `CONFIG_EDIT.readOnly = true` overrides `allowedSections` — user sees all sections but cannot edit any.
- Number ranges define the min–max that admin can set. Values outside range are rejected by API validation.
- `enum[]` values are system-defined constants. Adding new values requires code deployment (e.g., adding a new MCP server ID to the enum list).


---

#### STORY 8: Configuration Editor

> As an admin, I want to edit server configuration live so that I can tune the system without restart.

**Requirement Details:**

1. Display current server configuration organized by section (server, embedding, MCP, KB, auth)
2. Edit configuration values inline with type-appropriate inputs (text, number, toggle, select)
3. Validate changes before applying (schema validation, type checking)
4. Apply changes: some take effect immediately (hot-reload), others require restart (show indicator)
5. Configuration history: show last 10 changes with diff and who made them
6. Reset to defaults: revert a section or entire config to default values

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| section | string | Yes | Config section name | "embedding" |
| key | string | Yes | Configuration key | "model.dimensions" |
| value | any | Yes | Current value | 384 |
| type | enum | Yes | Value type | "number" |
| defaultValue | any | Yes | Default value | 384 |
| requiresRestart | boolean | Yes | Whether change needs restart | false |
| lastModified | datetime | No | Last change timestamp | "2025-07-14T10:00:00Z" |
| modifiedBy | string | No | Who changed it | "admin" |

**Acceptance Criteria:**

1. Configuration loads showing all sections with current values
2. Edit mode shows type-appropriate input controls
3. Invalid values show validation error before save
4. Hot-reload configs apply within 5 seconds without restart
5. Restart-required configs show warning badge and prompt admin to restart
6. Config history shows last 10 changes with diff view
7. Reset to defaults requires confirmation

---

#### STORY 9: Search Explorer

> As an admin, I want to explore search results so that I can debug query ranking.

**Requirement Details:**

1. Input field to enter test query
2. Execute search and show ranked results with similarity scores
3. Show score breakdown: embedding similarity, keyword match, recency boost, quality weight
4. Compare two queries side-by-side (before/after tuning)
5. Show which KB tier each result came from
6. Debug mode: show raw embedding vectors, distance calculations

**Acceptance Criteria:**

1. Search executes within 2 seconds and shows top 20 results
2. Each result shows overall score + score components breakdown
3. Side-by-side comparison mode shows two result sets with highlights for differences
4. Results can be filtered by tier after search
5. Debug mode shows technical details (vector dimensions, distance metric)

---

#### STORY 10: Audit Trail

> As an admin, I want to view audit trail so that I can track all administrative actions.

**Requirement Details:**

1. Log every admin action: who, what, when, what resource, what changed (before/after)
2. Searchable audit log with filters (user, action type, date range, resource)
3. Export audit log as CSV/JSON
4. Retention policy: configurable (default 90 days)
5. Cannot delete or modify audit records (immutable log)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| auditId | string | Yes | Unique audit entry ID | "aud-001" |
| userId | string | Yes | Who performed the action | "user-abc" |
| username | string | Yes | Username for display | "john.doe" |
| action | string | Yes | Action type | "USER_CREATED" |
| resource | string | Yes | Affected resource type | "user" |
| resourceId | string | Yes | Affected resource ID | "user-xyz" |
| changes | object | No | Before/after values | `{before: {status: "active"}, after: {status: "disabled"}}` |
| timestamp | datetime | Yes | When action occurred | "2025-07-14T10:30:00Z" |
| ipAddress | string | No | Client IP | "127.0.0.1" |

**Action Types:**

| Category | Actions |
|----------|---------|
| User | USER_CREATED, USER_UPDATED, USER_DISABLED, USER_DELETED, USER_FORCE_LOGOUT |
| RBAC | GROUP_CREATED, GROUP_UPDATED, GROUP_DELETED, PERMISSION_ASSIGNED, PERMISSION_REVOKED |
| KB | KB_ENTRY_PROMOTED, KB_ENTRY_REJECTED, KB_BULK_DELETE, KB_IMPORTED, KB_EXPORTED |
| MCP | SERVER_RESTARTED, TOOL_ENABLED, TOOL_DISABLED |
| Config | CONFIG_UPDATED, CONFIG_RESET |
| Auth | LOGIN_SUCCESS, LOGIN_FAILED, TOKEN_REVOKED |

**Acceptance Criteria:**

1. Every admin API call generates an audit entry (no gaps)
2. Audit log loads with latest-first ordering, paginated (50 per page)
3. Search and filter work within 2 seconds for up to 100,000 records
4. Export generates complete CSV/JSON file for selected date range
5. Audit records cannot be modified or deleted via any API
6. Retention policy automatically purges entries older than configured days

---

#### STORY 11: KB Promotion Queue

> As an admin, I want to manage KB promotion queue so that I can review and approve entries moving from short-term to long-term.

**Requirement Details:**

1. List all entries pending promotion (from USER tier to PROJECT/SHARED)
2. Show entry content, quality score, usage count, author, and auto-promotion reason
3. Approve: move entry to target tier with optional tag additions
4. Reject: keep in current tier with reason (visible to author)
5. Bulk approve/reject with same reason
6. Auto-promotion rules display: show which rules triggered the promotion suggestion

**Acceptance Criteria:**

1. Queue shows count badge in sidebar navigation
2. Each pending entry shows full context for informed decision
3. Approve immediately moves entry to target tier
4. Reject marks entry as "REJECTED" with reason, prevents re-suggestion for 7 days
5. Bulk operations require confirmation with count summary
6. Queue refreshes when new promotions arrive

---

#### STORY 12: KB Import/Export

> As an admin, I want to bulk import/export KB entries so that I can migrate data between environments.

**Requirement Details:**

1. Export: select entries by filter (tier, tags, date range) → download as JSON
2. Import: upload JSON file → validate → preview changes → apply
3. Conflict resolution: when imported entry ID already exists, offer skip/overwrite/merge
4. Progress indicator for large imports (> 100 entries)
5. Import log: record what was imported, skipped, or failed

**Acceptance Criteria:**

1. Export generates valid JSON with all entry metadata
2. Import validates JSON schema before processing
3. Preview shows count of new/conflicting/unchanged entries
4. Conflict resolution is applied per-entry or as bulk policy
5. Import of 1,000 entries completes within 30 seconds
6. Import log downloadable after operation completes

---

#### STORY 13: Multi-tab Tenant Comparison View

> As an admin, I want to compare the portal view of different users side-by-side so that I can verify permission configurations visually.

**Requirement Details:**

1. Admin with RBAC_MANAGE permission can open a "Compare View" mode
2. "+ Compare Users" button in sidebar opens a user picker dialog
3. Selecting a user opens a new tab panel showing the portal from that user's perspective
4. Each tab has its own sidebar (180px width) filtered by that user's permissions + content area
5. Top bar shows "Compare View" label with tabs for each impersonated user
6. Each tab can be closed independently via ✕ button
7. Multiple tabs can be open simultaneously (side-by-side comparison)
8. Impersonation uses `GET /api/admin/impersonate/:userId` to fetch the target user's permission set

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| userId | string | Yes | Target user ID to impersonate | "user-abc-123" |
| username | string | Yes | Target username for tab label | "john.doe" |
| permissions | string[] | Yes | Target user's permission list | `["KB_READ", "DASHBOARD_VIEW"]` |

**Acceptance Criteria:**

1. Only users with RBAC_MANAGE permission can see the "+ Compare Users" button
2. Each comparison tab shows only pages the target user has permission to see
3. Tab sidebar shows "{username}" and "{N} perms" indicator
4. Tabs render the same page components but filtered by target user's permissions
5. Closing all tabs returns to normal single-user view
6. Maximum of 5 simultaneous comparison tabs

---

#### STORY 14: KB Quality Page

> As an admin, I want to view KB Quality scores and distribution so that I can identify entries needing improvement.

**Requirement Details:**

1. Dedicated page showing KB entry quality scores overview
2. Quality score distribution chart (bar chart showing count per score range)
3. Summary statistics: average score, total entries, good/fair/poor breakdown
4. Status indicators: Good (score >= 80), Fair (60-79), Poor (< 60) with color coding
5. List of entries grouped by quality status with entry details

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| distribution | object | Yes | Count per score bucket | `{"0-20": 5, "21-40": 12, "41-60": 30, "61-80": 45, "81-100": 28}` |
| averageScore | number | Yes | Global average quality score | 72.5 |
| totalEntries | number | Yes | Total KB entries | 120 |
| good | number | Yes | Entries with score >= 80 | 45 |
| fair | number | Yes | Entries with score 60-79 | 42 |
| poor | number | Yes | Entries with score < 60 | 33 |

**Acceptance Criteria:**

1. KB Quality page accessible from sidebar with star icon
2. Distribution chart renders showing score buckets
3. Summary shows good/fair/poor counts with color badges (green/yellow/red)
4. Data fetched from `GET /api/admin/kb/quality`
5. Permission required: KB_READ

---

#### STORY 15: KB Tags Management Page

> As an admin, I want to manage KB Tags (create/rename/delete/merge) so that I can maintain a clean tag taxonomy.

**Requirement Details:**

1. Dedicated page listing all tags with entry count and last used date
2. Create new tags via form input
3. Rename existing tags (propagates to all entries using that tag)
4. Delete tags (removes from all entries)
5. Merge tags: combine source tag into target tag (all entries with source tag get target tag instead)
6. View entries using a specific tag
7. Filter/search tags

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| name | string | Yes | Tag name | "security" |
| count | number | Yes | Number of entries with this tag | 15 |
| lastUsed | datetime | Yes | Last time tag was applied | "2025-07-20T10:00:00Z" |

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/kb/tags | List all tags with counts |
| POST | /api/admin/kb/tags | Create a new tag |
| PUT | /api/admin/kb/tags/:name | Rename a tag |
| DELETE | /api/admin/kb/tags/:name | Delete a tag |
| POST | /api/admin/kb/tags/merge | Merge source tag into target |
| GET | /api/admin/kb/tags/:name/entries | List entries with a specific tag |

**Acceptance Criteria:**

1. KB Tags page accessible from sidebar with tag icon
2. Tags listed in table with name, count, and last used columns
3. Create tag via input field + button
4. Rename updates the tag name across all entries
5. Delete removes tag from all entries (with confirmation)
6. Merge combines two tags (source entries gain target tag, source is deleted)
7. Permission required: KB_READ (view), KB_WRITE (create/rename/delete/merge)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Backend MCP Server | System | KSA-284 | The portal runs within the existing backend HTTP server |
| JWT Authentication | System | KSA-285 | All portal requests authenticated via JWT tokens |
| Multi-Tenant KB | System | KSA-285 | KB management operates on the 3-tier KB structure |
| SQLite Database | Infrastructure | KSA-284 | All portal data stored in the existing SQLite database |
| Node.js >= 18.0 | Infrastructure | KSA-284 | Runtime for backend + SPA build |
| React | Library | N/A | Frontend SPA framework |
| D3.js | Library | N/A | Embedding space 2D visualizer |
| ForceGraph3D (Three.js) | Library (CDN) | N/A | 3D force-directed graph for KB Graph page |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Platform Team Lead | Approve requirements, UAT | Ticket creator |
| Developer | Backend Team | Implement APIs and SPA | Assignee |
| System Administrator | Operations | Primary portal user | End user |
| Security Reviewer | Security Team | Review RBAC design | Watcher |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Portal increases Backend memory footprint significantly | Medium | Medium | Lazy-load SPA, paginate all data views |
| RBAC complexity leads to permission misconfiguration | High | Medium | Provide "System Owner" default group, validate role schemas |
| 3D graph performance with large KB (>5000 entries) | Medium | High | Progressive loading, limit visible nodes, ForceGraph3D WebGL rendering |
| Configuration editor allows breaking changes | High | Low | Validation before apply, rollback capability, restart-required warnings |
| Audit log grows unbounded | Low | High | Configurable retention policy, automatic purge |

### 5.2 Assumptions

- Backend MCP Server (KSA-284) is fully operational before this work begins
- KSA-285 JWT authentication is implemented and functional
- Portal is accessed only from localhost (same machine) — no external network exposure
- Single admin can manage the system (no concurrent admin conflict resolution needed initially)
- SQLite can handle the additional tables without performance issues (< 100 concurrent users)
- React SPA build output is < 5MB (served as static files)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Dashboard load < 2s | All dashboard widgets render within 2 seconds |
| Performance | API response < 500ms | 95th percentile for all admin API calls |
| Performance | Graph renders 500 nodes smoothly | ForceGraph3D (WebGL) at 60fps with up to 500 nodes |
| Security | RBAC on every API call | Middleware checks permission before handler execution |
| Security | Audit trail immutable | No API endpoint to modify/delete audit records |
| Security | JWT validation | Every request must have valid, non-expired JWT |
| Scalability | Handle 100 concurrent admin sessions | Without performance degradation |
| Availability | Portal available when Backend is running | No separate process or port needed |
| Usability | WCAG 2.1 AA compliance | Keyboard navigation, ARIA labels, color contrast |
| Maintainability | React component library | Reusable UI components for consistent design |
| Data Integrity | Config validation before apply | Schema validation prevents invalid configuration |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-286 | Web Admin Portal - Server Operations Dashboard and RBAC | To Do | Story | Main ticket |
| KSA-284 | Split Extension: Lightweight Proxy + Backend MCP Server | In Progress | Story | Parent (extends) |
| KSA-285 | Authentication, Multi-Tenant KB, and MCP Server Configuration | In Progress | Story | Depends on (JWT + KB) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Access Group | A named collection of permissions assigned to users (e.g., "Administrators", "Developers") |
| Permission | A named capability (e.g., `KB_WRITE`, `MCP_ACCESS`) that grants access to a feature |
| Role | A specific configuration within a permission, defined by roleData JSON |
| roleData | JSON object containing granular configuration for a role (e.g., allowed MCP servers, allowed KB tiers) |
| Promotion | Moving a KB entry from short-term (USER tier) to long-term (PROJECT/SHARED tier) |
| Hot-reload | Configuration change that takes effect immediately without server restart |
| Force Logout | Admin action to terminate a user's active session immediately |
| SPA | Single Page Application — frontend loaded once, navigates without page reloads |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| KSA-284 BRD | BRD-v1-KSA-284.docx |
| KSA-285 BRD | BRD-v1-KSA-285.docx |
| KSA-284 TDD | TDD-v1-KSA-284.docx |

### RBAC Model Detail

```
┌─────────────┐     1:1      ┌──────────────┐     1:N      ┌─────────────┐     1:N      ┌──────────┐
│ User Profile │────────────►│ Access Group  │────────────►│ Permission  │────────────►│   Role   │
└─────────────┘              └──────────────┘              └─────────────┘              └──────────┘
                              e.g. "Admins"                  e.g. MCP_ACCESS              roleData:
                              "Developers"                   KB_WRITE                    {mcpServers:
                              "Viewers"                      USER_MANAGE                  ["jira"],
                                                                                         methods: [...]}
```

### Permission Catalog (Initial Set)

| Permission ID | Display Name | Description | roleData Schema |
|---------------|-------------|-------------|-----------------|
| DASHBOARD_VIEW | Dashboard View | View system dashboard | `{}` (no granular config) |
| KB_READ | KB Read | Read KB entries | `{tiers: string[]}` |
| KB_WRITE | KB Write | Create/edit/delete KB entries | `{tiers: string[], maxEntries: number}` |
| KB_PROMOTE | KB Promote | Approve/reject promotions | `{targetTiers: string[]}` |
| KB_IMPORT_EXPORT | KB Import/Export | Bulk import and export | `{formats: string[]}` |
| MCP_ACCESS | MCP Server Access | Access MCP server tools | `{mcpServers: string[], methods: string[]}` |
| MCP_MANAGE | MCP Server Manage | Start/stop/restart servers | `{mcpServers: string[]}` |
| USER_MANAGE | User Management | Create/edit/disable/delete users | `{canDelete: boolean}` |
| RBAC_MANAGE | RBAC Management | Manage Access Groups and Permissions | `{}` |
| CONFIG_EDIT | Configuration Edit | Edit server configuration | `{sections: string[], readOnly: boolean}` |
| SEARCH_EXPLORE | Search Explorer | Test and debug search queries | `{}` |
| AUDIT_VIEW | Audit Trail View | View audit log | `{exportAllowed: boolean}` |
| GRAPH_VIEW | KB Graph View | View KB graph visualization | `{}` |
| ANALYTICS_VIEW | Analytics View | View analytics and quality metrics | `{exportAllowed: boolean}` |

### Default Access Groups

| Group Name | Permissions | Description |
|-----------|------------|-------------|
| System Owner | ALL | Full access, cannot be deleted |
| Administrator | All except RBAC_MANAGE | Can manage users, KB, MCP, config |
| Operator | DASHBOARD_VIEW, MCP_ACCESS, MCP_MANAGE, KB_READ, AUDIT_VIEW | Operations focus |
| Developer | DASHBOARD_VIEW, KB_READ, KB_WRITE, MCP_ACCESS, SEARCH_EXPLORE, GRAPH_VIEW | Dev focus |
| Viewer | DASHBOARD_VIEW, KB_READ, GRAPH_VIEW, ANALYTICS_VIEW | Read-only access |

---

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

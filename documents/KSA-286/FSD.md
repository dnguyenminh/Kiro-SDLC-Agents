# Functional Specification Document (FSD)

## Code Intelligence Extension — KSA-286: Web Admin Portal - Server Operations Dashboard and RBAC

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-286 |
| Title | Web Admin Portal - Server Operations Dashboard and RBAC |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Architecture Pattern | Plugin (extends existing Backend MCP Server) |
| Related BRD | BRD-v1-KSA-286.docx |
| Parent Ticket | KSA-284 (Split Extension: Lightweight Proxy + Backend MCP Server) |
| Depends On | KSA-285 (Authentication, Multi-Tenant KB, and MCP Server Configuration) |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document (business sections) |
| Technical Enrichment | TA Agent – Technical Architect | API contracts, integration specs |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA Agent | Initiate document — auto-generated from BRD and Jira ticket KSA-286 |
| 1.1 | 2025-07-15 | SM Agent | Cascade update — Permission Rules Specification (32 fixed rules, structured types replacing freeform JSON) |
| 2.0 | 2025-07-22 | SM Agent | Added UC-13 (Impersonation), UC-14 (Multi-tab Comparison), UC-15 (KB Quality), UC-16 (KB Tags). Updated UI specs for sidebar permission filtering, 403 handling, force password change. 13 pages total. |
| 2.1 | 2025-07-23 | SM Agent | UC-14 redesigned: PortalInstance architecture (independent components per tab, display:none pattern, own sidebar 200px + content, own graph instance). Replaces old TenantTab shared-content approach. |

---

## 1. Introduction

### 1.1 Purpose

This FSD defines the functional specifications for the **Web Admin Portal** — a React SPA served by the Backend MCP Server (KSA-284) that provides a comprehensive operations dashboard, KB management, MCP server control, user management, RBAC (Role-Based Access Control), and audit capabilities.

### 1.2 Scope

The portal extends the Backend MCP Server by adding:
- Static file serving for React SPA under `/admin/*`
- REST API endpoints under `/api/admin/*` for all portal operations
- RBAC middleware checking permissions on every admin API call
- Server-Sent Events (SSE) for real-time health/activity updates

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| SPA | Single Page Application — frontend loaded once, navigates without page reloads |
| RBAC | Role-Based Access Control |
| Access Group | Named collection of permissions assigned to users |
| Permission | Named capability granting access to a feature (e.g., `KB_WRITE`) |
| Permission Rule | A fixed, typed configuration parameter within a permission (e.g., `maxEntries: number`) |
| Rule Definition | System-defined metadata for a permission rule: name, type, allowed values, default |
| roleData | Structured object containing permission rule values — NOT freeform JSON. Each key maps to a rule defined in the Permission Rules registry. |
| Promotion | Moving KB entry from USER tier to PROJECT/SHARED tier |
| Hot-reload | Config change taking effect immediately without server restart |
| JWT | JSON Web Token — authentication token issued by KSA-285 |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-286.docx |
| KSA-284 TDD | TDD-v1-KSA-284.docx |
| KSA-285 BRD | BRD-v1-KSA-285.docx |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The Web Admin Portal operates within the Backend MCP Server ecosystem:

- **Admin User** → interacts with React SPA via browser
- **React SPA** → served by Backend HTTP Server at `/admin/*`
- **Admin REST API** → `/api/admin/*` endpoints handle all operations
- **RBAC Middleware** → intercepts every API call, validates JWT + permissions
- **Backend MCP Server** (KSA-284) → hosts the portal, provides MCP orchestration
- **JWT Auth Service** (KSA-285) → issues/validates tokens
- **SQLite Database** → stores all portal data (users, groups, permissions, audit, config)
- **Multi-Tenant KB** (KSA-285) → 3-tier knowledge base accessed via portal

### 2.2 System Architecture

The portal follows a layered architecture within the existing Backend MCP Server:

1. **Presentation Layer**: React SPA (served as static files)
2. **API Layer**: Hono routes under `/api/admin/*`
3. **Middleware Layer**: JWT validation + RBAC permission check
4. **Service Layer**: Business logic for each portal module
5. **Data Layer**: SQLite repositories for CRUD operations
6. **Integration Layer**: Interfaces to KB engine, MCP orchestrator, Config manager

---

## 3. Functional Requirements (continued)

### 3.3 Feature: KB Graph Visualization

**Source:** BRD Story 3

#### 3.3.1 Description

3D Force Graph visualization (ForceGraph3D CDN library, Three.js/WebGL based) showing KB entries as nodes and their relationships as edges. Features: toolbar with search/filter/fit-view, minimap overlay, node click detail panel, legend, dark background (#0f172a).

#### 3.3.2 Use Case

**Use Case ID:** UC-03
**Actor:** Admin User
**Preconditions:** User authenticated with `GRAPH_VIEW` permission; KB contains entries with links
**Postconditions:** 3D graph rendered with interactive capabilities

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Opens KB Graph page | | Navigate to /admin/kb/graph |
| 2 | | Fetches graph data | GET /api/admin/kb/graph |
| 3 | | Renders 3D ForceGraph3D | Nodes colored by type, sized by quality, dark bg #0f172a |
| 4 | Uses toolbar search combobox | | Types node name |
| 5 | | Camera focuses on matched node | Shows detail panel for matched node |
| 6 | Clicks "Fit View" button | | Zooms to fit all nodes in viewport |
| 7 | Uses "Filter Types" dropdown | | Unchecks type checkboxes (document, code, config, api, module) |
| 8 | | Hides nodes of unchecked types | < 500ms filter response |
| 9 | Clicks a node | | Selects entry |
| 10 | | Shows detail panel (top-right overlay) | Name, type badge, tier badge, content preview (300 chars), tags, links count, quality score, created date |
| 11 | | Fetches full entry details | GET /api/admin/kb/entries/:id |
| 12 | Hovers over node | | Shows label "{name} ({type})" |
| 13 | Interacts with minimap (bottom-right) | | Scroll=zoom, drag=rotate, right-drag=pan main graph |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-03-1 | Graph exceeds 500 nodes | Progressive loading — show top-connected nodes first, load more on zoom |
| AF-03-2 | No links exist | Show nodes without edges, suggest "Link entries for better visualization" |
| AF-03-3 | Search finds no match | Show "No matching nodes" in search combobox dropdown |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-03-1 | Browser WebGL not supported | Show error message "WebGL required for 3D graph visualization" |
| EF-03-2 | Graph data too large (> 5000 entries) | Show warning, force filter selection before render |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-15 | Graph renders up to 500 nodes at 60fps without degradation (WebGL) | BRD Story 3 AC-1 |
| BR-16 | Node color by type: document=blue, code=green, config=orange, api=purple, module=cyan | BRD Story 3 |
| BR-17 | Node size proportional to quality score | BRD Story 3 |
| BR-18 | Minimap (180×140) syncs with main graph via drawImage of WebGL canvas | BRD Story 3 AC-4 |
| BR-19 | Filter Types dropdown updates graph within 500ms | BRD Story 3 AC-2 |

#### 3.3.4 API Contract (Functional View)

**Endpoint:** `GET /api/admin/kb/graph`
**Purpose:** Retrieve graph data (nodes + edges) for visualization
**Permission Required:** `GRAPH_VIEW`

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| type | enum | No | | Filter by node type (document, code, config, api, module) |
| tier | enum | No | | Filter by tier |
| tags | string | No | | Filter by tags |
| minQuality | number | No | 0-100 | Minimum quality score |
| limit | number | No | BR-15 (default 500) | Max nodes to return |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| nodes | array | `[{id, name, type, tier, qualityScore, tags, linksCount, contentPreview, createdAt}]` |
| edges | array | `[{source, target, linkType}]` |
| totalCount | number | Total entries (may exceed returned nodes) |

**Endpoint:** `GET /api/admin/kb/entries/:id`
**Purpose:** Fetch full entry details for detail panel on node click
**Permission Required:** `KB_READ`

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Entry ID |
| name | string | Entry name |
| type | enum | document, code, config, api, module |
| tier | enum | USER, PROJECT, SHARED |
| contentPreview | string | First 300 chars of content |
| tags | array | List of tags |
| linksCount | number | Number of linked entries |
| qualityScore | number | 0-100 |
| createdAt | datetime | Entry creation timestamp |

#### 3.3.5 UI Component Specification

| Component | Position | Behavior |
|-----------|----------|----------|
| ForceGraph3D canvas | Main area | 3D WebGL graph, dark bg #0f172a |
| Toolbar | Above graph | Search combobox + "Fit View" btn + "Filter Types" dropdown |
| Search combobox | Toolbar left | Type node name → dropdown shows matches → select → camera focuses + detail panel opens |
| "Fit View" button | Toolbar center | Zooms camera to fit all visible nodes |
| "Filter Types" dropdown | Toolbar right | Checkboxes per type (document, code, config, api, module) — uncheck hides nodes |
| Detail panel | Top-right overlay | Shows on node click: name, type badge, tier badge, content (300ch), tags, links count, quality, date. ✕ to close |
| Minimap | Bottom-right (180×140 canvas) | Draws scaled copy of main WebGL canvas via drawImage. scroll=zoom, drag=rotate, right-drag=pan |
| Legend | Bottom-left | Color-coded: document=blue, code=green, config=orange, api=purple, module=cyan |
| Node labels | On hover | "{name} ({type})" tooltip |

---

### 3.4 Feature: Analytics & Quality

**Source:** BRD Story 4

#### 3.4.1 Description

Analytics dashboard showing quality score distribution, trends over time, top tags, embedding space 2D visualizer (t-SNE/UMAP), cluster analysis, and stale entry reports.

#### 3.4.2 Use Case

**Use Case ID:** UC-04
**Actor:** Admin User
**Preconditions:** User authenticated with `ANALYTICS_VIEW` permission
**Postconditions:** Analytics charts rendered with current data

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Opens Analytics page | | Navigate to /admin/analytics |
| 2 | | Fetches analytics data | GET /api/admin/analytics/overview |
| 3 | | Renders charts (histogram, line chart, metrics) | Charts render < 3s |
| 4 | Selects date range | | Filter analytics window |
| 5 | | Re-fetches filtered data | Updates all charts |
| 6 | Opens Embedding Visualizer tab | | 2D projection view |
| 7 | | Fetches embedding projections | GET /api/admin/analytics/embeddings |
| 8 | Hovers over point | | Shows entry details |
| 9 | Exports data as CSV | | Download analytics |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-20 | Charts render within 3 seconds for up to 10,000 entries | BRD Story 4 AC-1 |
| BR-21 | Embedding visualizer supports zoom, pan, hover-to-detail | BRD Story 4 AC-2 |
| BR-22 | Stale entry = not accessed/updated in > 30 days | BRD Story 4 |
| BR-23 | Analytics exportable as CSV | BRD Story 4 AC-5 |

#### 3.4.4 API Contract (Functional View)

**Endpoint:** `GET /api/admin/analytics/overview`
**Purpose:** Retrieve quality metrics and distribution data
**Permission Required:** `ANALYTICS_VIEW`

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| dateFrom | datetime | No | Start of analysis window |
| dateTo | datetime | No | End of analysis window |
| granularity | enum | No | week/month (for trends) |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| scoreDistribution | object | `{0-20: N, 21-40: N, 41-60: N, 61-80: N, 81-100: N}` |
| avgScore | number | Global average quality score |
| trendData | array | `[{period, avgScore, entryCount}]` |
| topTags | array | `[{tag, count}]` — top 20 |
| staleEntries | number | Count of entries not accessed > 30 days |
| totalEntries | number | Total KB entries |

---

### 3.5 Feature: MCP Server Management

**Source:** BRD Story 5

#### 3.5.1 Description

Manage MCP child servers: view status, health metrics, logs; toggle individual tools on/off; restart servers; view health timeline.

#### 3.5.2 Use Cases

**Use Case ID:** UC-05a — View MCP Server Status
**Actor:** Admin User
**Preconditions:** User authenticated with `MCP_ACCESS` permission
**Postconditions:** Server list displayed with current status

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Opens MCP Management page | | Navigate to /admin/mcp |
| 2 | | Fetches server list | GET /api/admin/mcp/servers |
| 3 | | Renders server cards with status | RUNNING/STOPPED/ERROR/STARTING |
| 4 | | Auto-refreshes every 10 seconds | Polling for status changes |
| 5 | Clicks server card | | Opens server detail |
| 6 | | Shows health metrics, tools, logs | Detailed server view |

---

**Use Case ID:** UC-05b — Toggle Tool
**Actor:** Admin User
**Preconditions:** User authenticated with `MCP_MANAGE` permission; server is RUNNING
**Postconditions:** Tool enabled/disabled; takes effect immediately

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Opens server detail | | Views tool list |
| 2 | Toggles tool switch | | Enable → Disable (or vice versa) |
| 3 | | Sends toggle request | PATCH /api/admin/mcp/servers/{id}/tools/{toolName} |
| 4 | | Updates tool state | Disabled tool returns "tool disabled" on next call |
| 5 | | Shows confirmation | "Tool {name} disabled" toast |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-05b-1 | Toggle fails (server unresponsive) | Revert UI toggle, show error "Server unresponsive" |

---

**Use Case ID:** UC-05c — Restart Server
**Actor:** Admin User
**Preconditions:** User authenticated with `MCP_MANAGE` permission; server in STOPPED/ERROR state
**Postconditions:** Server restarted and RUNNING

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Clicks "Restart" on server card | | Initiates restart |
| 2 | | Shows confirmation dialog | "Restart server {name}?" |
| 3 | Confirms | | |
| 4 | | Sends restart command | POST /api/admin/mcp/servers/{id}/restart |
| 5 | | Shows loading state | Status = STARTING |
| 6 | | Reports success/failure | Within 30 seconds |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-05c-1 | Restart fails after 30s | Show "Restart failed: {error}". Offer "Force Kill + Restart" |
| EF-05c-2 | Server unresponsive (3 missed heartbeats) | Show "Unresponsive" status |

#### 3.5.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-24 | Server list refreshes every 10 seconds | BRD Story 5 AC-1 |
| BR-25 | Disabled tool returns "tool disabled" error immediately | BRD Story 5 AC-2 |
| BR-26 | Restart must complete within 30 seconds or report failure | BRD Story 5 AC-3 |
| BR-27 | Log viewer shows last 200 lines with auto-scroll | BRD Story 5 AC-4 |
| BR-28 | Unresponsive = 3 missed heartbeats | BRD Story 5 Error Handling |

#### 3.5.4 API Contracts (Functional View)

**Endpoint:** `GET /api/admin/mcp/servers`
**Purpose:** List all MCP child servers with status
**Permission Required:** `MCP_ACCESS`

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| servers | array | `[{serverId, serverName, status, toolCount, enabledToolCount, lastHeartbeat, uptimeSeconds, restartCount}]` |

---

**Endpoint:** `POST /api/admin/mcp/servers/{serverId}/restart`
**Purpose:** Restart a stopped/error MCP server
**Permission Required:** `MCP_MANAGE`

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Server already running | "Server is already running" | Status = RUNNING |
| Restart timeout | "Restart timed out after 30s" | No heartbeat within 30s |
| Force kill required | "Normal restart failed. Use Force Restart?" | Previous restart failed |

---

### 3.6 Feature: User Management

**Source:** BRD Story 6

#### 3.6.1 Description

CRUD operations for users: create, enable/disable (soft delete), hard delete, view sessions, force logout, password reset. Users belong to exactly one Access Group.

#### 3.6.2 Use Cases

**Use Case ID:** UC-06a — Create User
**Actor:** Admin User
**Preconditions:** User authenticated with `USER_MANAGE` permission
**Postconditions:** New user created with assigned Access Group

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Clicks "Create User" | | Opens create form |
| 2 | Fills username, email, password, Access Group | | Form input |
| 3 | Submits form | | |
| 4 | | Validates input | Username unique, email valid, password strong |
| 5 | | Creates user | POST /api/admin/users |
| 6 | | Shows success | "User {username} created" |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-06a-1 | Username already exists | Show "Username already taken" |
| EF-06a-2 | Email already in use | Show "Email already registered" |
| EF-06a-3 | Password too weak | Show password requirements |

---

**Use Case ID:** UC-06b — Disable User
**Actor:** Admin User
**Preconditions:** Target user exists and is ACTIVE
**Postconditions:** User disabled; all sessions terminated

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Clicks "Disable" on user row | | Initiates disable |
| 2 | | Shows confirmation | "Disable user {username}? All sessions will be terminated." |
| 3 | Confirms | | |
| 4 | | Disables user + terminates sessions | PATCH /api/admin/users/{id}/status |
| 5 | | Shows success | "User disabled. 2 sessions terminated." |

---

**Use Case ID:** UC-06c — Hard Delete User
**Actor:** Admin User
**Preconditions:** `USER_MANAGE` with `roleData.canDelete = true`
**Postconditions:** User permanently removed

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Clicks "Delete" on user row | | Initiates hard delete |
| 2 | | Shows danger confirmation | "Type username to confirm deletion" |
| 3 | Types username | | Confirmation input |
| 4 | | Validates typed name matches | Must be exact match |
| 5 | | Deletes user permanently | DELETE /api/admin/users/{id} |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-06c-1 | Last user in System Owner group | Show "Cannot delete last System Owner" |
| EF-06c-2 | Typed name doesn't match | Disable confirm button |

#### 3.6.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-29 | Username: 3-50 chars, alphanumeric + dots + hyphens, unique | BRD Story 6 Validation |
| BR-30 | Email: valid format, unique | BRD Story 6 Validation |
| BR-31 | Password: min 8 chars, 1 uppercase, 1 lowercase, 1 number | BRD Story 6 Validation |
| BR-32 | Cannot delete last admin in System Owner group | BRD Story 6 Validation |
| BR-33 | Disabling user immediately terminates all active sessions | BRD Story 6 AC-3 |
| BR-34 | Hard delete requires typing username to confirm | BRD Story 6 AC-4 |
| BR-35 | Force logout terminates session within 5 seconds | BRD Story 6 AC-5 |
| BR-36 | Password reset generates 16-char random password | BRD Story 6 AC-6 |

#### 3.6.4 API Contracts (Functional View)

**Endpoint:** `POST /api/admin/users`
**Purpose:** Create new user
**Permission Required:** `USER_MANAGE`

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| username | string | Yes | BR-29 | Login username |
| email | string | Yes | BR-30 | User email |
| password | string | Yes | BR-31 | Initial password |
| accessGroupId | string | Yes | | Access Group to assign |

---

**Endpoint:** `DELETE /api/admin/users/{userId}`
**Purpose:** Permanently delete user
**Permission Required:** `USER_MANAGE` with `roleData.canDelete = true`

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Last System Owner | "Cannot delete the last System Owner" | BR-32 |
| User not found | "User not found" | Invalid userId |


---

### 3.9 Feature: Impersonation

**Source:** BRD Story 7 (AC-9, AC-10), Story 13

#### 3.9.1 Description

Admin users with RBAC_MANAGE permission can impersonate another user to view the portal from their perspective. This enables verifying permission configurations without logging in as that user.

#### 3.9.2 Use Case

**Use Case ID:** UC-13
**Actor:** Admin User (with RBAC_MANAGE)
**Preconditions:** User authenticated with `RBAC_MANAGE` permission; target user exists
**Postconditions:** Admin receives target user's permission set for comparison view

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Requests impersonation | | GET /api/admin/impersonate/:userId |
| 2 | | Validates JWT | Checks request has valid auth token |
| 3 | | Checks RBAC_MANAGE permission | Only admins with this permission can impersonate |
| 4 | | Fetches target user | Retrieves userId, username, accessGroupId |
| 5 | | Resolves permissions | Gets all permissions for target user's access group |
| 6 | | Returns impersonation payload | `{userId, username, permissions: [...]}` |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-13-1 | X-Impersonate header used | System reads header value as userId, resolves same as endpoint |
| AF-13-2 | Impersonating self | System returns own permissions (no-op) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-13-1 | No RBAC_MANAGE permission | HTTP 403 "Access denied" |
| EF-13-2 | Target user not found | HTTP 404 "User not found" |

#### 3.9.3 API Contract

**Endpoint:** `GET /api/admin/impersonate/:userId`
**Permission Required:** `RBAC_MANAGE`

**Response (200):**
```json
{
  "userId": "user-abc-123",
  "username": "john.doe",
  "permissions": ["DASHBOARD_VIEW", "KB_READ", "GRAPH_VIEW"]
}
```

**Header-based Impersonation:**
Any admin API call can include `X-Impersonate: {userId}` header. When present, the RBAC middleware resolves permissions from the impersonated user instead of the caller (caller still needs RBAC_MANAGE).

---

### 3.10 Feature: Multi-tab Tenant Comparison View

**Source:** BRD Story 13

#### 3.10.1 Description

Admin can open multiple side-by-side panels, each showing the portal from a different user's perspective (filtered by their permissions). A "Compare View" top bar shows tabs for each user. Each tab has its own sidebar (180px) + content area.

#### 3.10.2 Use Case

**Use Case ID:** UC-14
**Actor:** Admin User (with RBAC_MANAGE)
**Preconditions:** User authenticated with `RBAC_MANAGE`; at least 2 users exist
**Postconditions:** Multi-tab comparison view displayed with independent PortalInstance per tab

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Clicks "+" button in tab bar | | Button visible in top tab bar (only with RBAC_MANAGE) |
| 2 | | Shows user list dropdown | Fetches all users (GET /api/admin/users?pageSize=100) |
| 3 | Selects a user from list | | Clicks username in dropdown |
| 4 | | Calls impersonate endpoint | GET /api/admin/impersonate/:userId → returns permissions |
| 5 | | Creates new PortalInstance | New tab appears in tab bar with username + perm count |
| 6 | | Renders PortalInstance component | Independent sidebar (200px) filtered by user's permissions + own content area with own graph instance |
| 7 | Clicks tab in tab bar | | Switches active tab |
| 8 | | Toggles visibility | Active tab: display:flex, all others: display:none. No remount, no data loss, graph camera preserved |
| 9 | Navigates within tab | | Clicks nav-item in tab's sidebar |
| 10 | | Sets __impersonateUserId global | Routes API calls to correct user context |
| 11 | | Renders page in that tab | Isolated from other tabs — independent state |
| 12 | Closes tab via X button | | Clicks close icon on tab in tab bar |
| 13 | | Unmounts PortalInstance | Returns to previous active tab |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-14-1 | Multiple tabs open | All PortalInstances rendered in parallel (display:none when inactive), switch = toggle visibility only |
| AF-14-2 | User has no permissions | Tab sidebar shows empty (no nav-items visible) |
| AF-14-3 | Graph page open in inactive tab | Graph instance preserved — camera position, zoom level intact when tab reactivated |

#### 3.10.3 UI Specifications

| Component | Properties | Behavior |
|-----------|-----------|----------|
| Tab Bar | Fixed top, dark bg (#1e293b), always visible | Shows all tabs: "Admin (14) \| editor1 (7) \| +" format |
| Tab Item | Username + perm count badge + X close | Click = switch active, X = close/unmount |
| "+" Button | In tab bar, opens dropdown | Only visible with RBAC_MANAGE |
| PortalInstance | props: permissions, username, isActive, impersonateUserId | display:flex when active, display:none when inactive |
| PortalInstance Sidebar | 200px width, className="nav-item" items | Filtered PAGES by permissions, independent navigation |
| PortalInstance Content | className="main", flex:1 | Own page rendering, own graph instance, own camera |
| Logout Button | Top-right of tab bar | Single logout for entire session |

---

### 3.11 Feature: KB Quality Page

**Source:** BRD Story 14

#### 3.11.1 Description

Dedicated page showing quality scores overview: distribution chart, summary statistics (good/fair/poor), and average score.

#### 3.11.2 Use Case

**Use Case ID:** UC-15
**Actor:** Admin User
**Preconditions:** User authenticated with `KB_READ` permission
**Postconditions:** Quality overview displayed

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Opens KB Quality page | | Navigates via sidebar (star icon) |
| 2 | | Fetches quality data | GET /api/admin/kb/quality |
| 3 | | Renders distribution chart | Bar chart with score buckets (0-20, 21-40, etc.) |
| 4 | | Shows summary cards | Average score, total entries, good/fair/poor counts |
| 5 | | Shows status badges | Green (good >= 80), Yellow (fair 60-79), Red (poor < 60) |

#### 3.11.3 API Contract

**Endpoint:** `GET /api/admin/kb/quality`
**Permission Required:** `KB_READ`

**Response (200):**
```json
{
  "distribution": {"0-20": 5, "21-40": 12, "41-60": 30, "61-80": 45, "81-100": 28},
  "averageScore": 72.5,
  "totalEntries": 120,
  "good": 45,
  "fair": 42,
  "poor": 33
}
```

---

### 3.12 Feature: KB Tags Management Page

**Source:** BRD Story 15

#### 3.12.1 Description

Dedicated page for managing KB tags: list all tags with counts, create new tags, rename, delete, merge tags, and view entries by tag.

#### 3.12.2 Use Case

**Use Case ID:** UC-16
**Actor:** Admin User
**Preconditions:** User authenticated with `KB_READ` (view) or `KB_WRITE` (modify) permission
**Postconditions:** Tags managed (created/renamed/deleted/merged)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Opens KB Tags page | | Navigates via sidebar (tag icon) |
| 2 | | Fetches all tags | GET /api/admin/kb/tags |
| 3 | | Renders tag table | Name, count, last used columns |
| 4 | Enters new tag name | | Types in create input |
| 5 | Clicks Create | | POST /api/admin/kb/tags {name} |
| 6 | | Tag created | Appears in table with count 0 |
| 7 | Clicks Rename on a tag | | Prompts for new name |
| 8 | Enters new name, confirms | | PUT /api/admin/kb/tags/:name {newName} |
| 9 | Clicks Delete on a tag | | Confirmation dialog shown |
| 10 | Confirms delete | | DELETE /api/admin/kb/tags/:name |
| 11 | Clicks Merge | | Selects source and target tags |
| 12 | Confirms merge | | POST /api/admin/kb/tags/merge {sourceTag, targetTag} |

#### 3.12.3 API Contracts

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| GET | /api/admin/kb/tags | KB_READ | — | `{tags: [{name, count, lastUsed}]}` |
| POST | /api/admin/kb/tags | KB_WRITE | `{name}` | `{success: true, tag: name}` |
| PUT | /api/admin/kb/tags/:name | KB_WRITE | `{newName}` | `{success: true, renamed: N}` |
| DELETE | /api/admin/kb/tags/:name | KB_WRITE | — | `{success: true, removed: N}` |
| POST | /api/admin/kb/tags/merge | KB_WRITE | `{sourceTag, targetTag}` | `{success: true, merged: N}` |
| GET | /api/admin/kb/tags/:name/entries | KB_READ | — | `{tag, entryIds: [...]}` |

---

### 3.13 Feature: UI Multi-tenant Support

**Source:** BRD Story 7, Story 13

#### 3.13.1 Description

The SPA implements full multi-tenant permission-based UI including:
- Sidebar dynamically filters pages by user's permissions (PAGES have `perm` field)
- "Logged in as {username}" display + permission count in sidebar
- Force password change form when `forcePasswordChange=true` in user profile
- 403 error handling in the global `api()` fetch wrapper
- "+ Compare Users" button for multi-tab comparison

#### 3.13.2 UI Specifications

| Component | Behavior | Trigger |
|-----------|----------|---------|
| Sidebar Navigation | Only shows pages where user has the required permission | `PAGES.filter(p => hasPerm(p.perm))` |
| User Info Display | Shows "{username}" + "{N} permissions" below sidebar header | Always visible when logged in |
| Force Password Change | Modal/full-screen form requiring password change | `userInfo.forcePasswordChange === true` |
| 403 Handler | Global `api()` function catches 403 responses, shows "Access Denied" toast | Any API call returning HTTP 403 |
| Compare Button | "+ Compare Users" button in sidebar | Only visible when user has RBAC_MANAGE |

#### 3.13.3 PAGES Configuration (13 pages total)

| ID | Label | Icon | Required Permission |
|----|-------|------|-------------------|
| dashboard | Dashboard | 📊 | DASHBOARD_VIEW |
| kb | KB Management | 📚 | KB_READ |
| graph | KB Graph | 🕸️ | GRAPH_VIEW |
| quality | KB Quality | ⭐ | KB_READ |
| tags | KB Tags | 🏷️ | KB_READ |
| analytics | Analytics | 📈 | ANALYTICS_VIEW |
| mcp | MCP Servers | 🖥️ | MCP_ACCESS |
| users | Users | 👥 | USER_MANAGE |
| rbac | RBAC | 🔒 | RBAC_MANAGE |
| config | Configuration | ⚙️ | CONFIG_EDIT |
| search | Search Explorer | 🔍 | SEARCH_EXPLORE |
| audit | Audit Trail | 📋 | AUDIT_VIEW |
| profile | Profile | 👤 | (none — always visible) |

#### 3.13.4 Permission Enforcement on All Endpoints (17 fixed endpoints)

All previously unprotected endpoints now enforce RBAC:

| # | Endpoint | Required Permission |
|---|----------|-------------------|
| 1 | POST /api/admin/kb/entries/:id/link | KB_WRITE |
| 2 | GET /api/admin/kb/entries/:id/links | KB_READ |
| 3 | POST /api/admin/kb/entries/:id/tags | KB_WRITE |
| 4 | GET /api/admin/kb/entries/:id/tags | KB_READ |
| 5 | GET /api/admin/kb/promotions | KB_PROMOTE |
| 6 | POST /api/admin/kb/promotions | KB_PROMOTE |
| 7 | POST /api/admin/kb/promotions/:id/review | KB_PROMOTE |
| 8 | GET /api/admin/kb/export | KB_IMPORT_EXPORT |
| 9 | POST /api/admin/kb/import | KB_IMPORT_EXPORT |
| 10 | GET /api/admin/mcp/servers/:id/logs | MCP_ACCESS |
| 11 | POST /api/admin/mcp/servers/:id/tools/:toolName/toggle | MCP_MANAGE |
| 12 | GET /api/admin/config/history | CONFIG_EDIT |
| 13 | POST /api/admin/config/reset | CONFIG_EDIT |
| 14 | POST /api/admin/search | SEARCH_EXPLORE |
| 15 | GET /api/admin/rbac/permissions | RBAC_MANAGE |
| 16 | GET /api/admin/kb/quality | KB_READ |
| 17 | GET /api/admin/kb/tags | KB_READ |

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

![ER Diagram](diagrams/er-diagram.png)

### 4.2 Logical Entities

#### Entity: User

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| userId | string (UUID) | Yes | | Primary key |
| username | string | Yes | BR-29 | Login name (unique) |
| email | string | Yes | BR-30 | Email address (unique) |
| passwordHash | string | Yes | BR-31 | Bcrypt hash of password |
| status | enum | Yes | | ACTIVE / DISABLED / PENDING |
| accessGroupId | string | Yes | BR-37 | FK to AccessGroup (1:1) |
| createdAt | datetime | Yes | | Account creation timestamp |
| lastLogin | datetime | No | | Last successful login |
| forcePasswordChange | boolean | Yes | | True after password reset |

#### Entity: AccessGroup

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| accessGroupId | string (UUID) | Yes | | Primary key |
| accessGroupName | string | Yes | BR-38 | Display name (unique) |
| isSystemGroup | boolean | Yes | BR-41 | True for System Owner (cannot delete) |
| createdAt | datetime | Yes | | Creation timestamp |
| updatedAt | datetime | Yes | | Last modification |

#### Entity: Permission

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| permissionId | string | Yes | BR-39 | UPPER_SNAKE_CASE identifier (PK) |
| permissionName | string | Yes | | Display name |
| description | string | No | | What this permission grants |

#### Entity: PermissionRuleDefinition

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| permissionId | string | Yes | | FK to Permission |
| ruleName | string | Yes | | Rule identifier (e.g., `allowedTiers`, `maxEntries`) |
| ruleType | enum | Yes | | `boolean` / `number` / `enum[]` |
| allowedValues | JSON | Yes | | For boolean: `[true, false]`; for number: `{min, max}`; for enum[]: array of valid options |
| defaultValue | JSON | Yes | | Default value when rule not explicitly set |
| isLocked | boolean | Yes | | If true, value cannot be changed via UI (e.g., `RBAC_MANAGE.canDeleteSystemGroups`) |
| description | string | No | | Human-readable description of what this rule controls |

#### Entity: GroupPermission (Join Table)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| accessGroupId | string | Yes | | FK to AccessGroup |
| permissionId | string | Yes | | FK to Permission |
| roleData | JSON | Yes | BR-40 | Structured object: keys = rule names, values = configured values per PermissionRuleDefinition. NOT freeform — validated against rule type/allowedValues. |

#### Entity: Session

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| sessionId | string (UUID) | Yes | | Primary key |
| userId | string | Yes | | FK to User |
| device | string | No | | Device info |
| ipAddress | string | No | | Client IP |
| loginAt | datetime | Yes | | Session start |
| expiresAt | datetime | Yes | | JWT expiration |
| isActive | boolean | Yes | BR-33, BR-35 | Can be force-terminated |

#### Entity: AuditEntry

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| auditId | string (UUID) | Yes | | Primary key |
| userId | string | Yes | | Who performed action |
| username | string | Yes | | Denormalized for display |
| action | string | Yes | BR-56 | Action type (e.g., USER_CREATED) |
| resource | string | Yes | | Resource type affected |
| resourceId | string | Yes | | Specific resource ID |
| changes | JSON | No | | `{before: {...}, after: {...}}` |
| timestamp | datetime | Yes | | When action occurred |
| ipAddress | string | No | | Client IP |

#### Entity: ConfigEntry

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| section | string | Yes | | Config section (e.g., "embedding") |
| key | string | Yes | | Config key within section |
| value | string (JSON) | Yes | | Current value (JSON-encoded) |
| type | enum | Yes | | string/number/boolean/select |
| defaultValue | string (JSON) | Yes | | Default value |
| requiresRestart | boolean | Yes | BR-48 | Whether change needs server restart |
| lastModified | datetime | No | | Last change time |
| modifiedBy | string | No | | Who changed it |

#### Entity: ConfigHistory

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| historyId | string (UUID) | Yes | | Primary key |
| section | string | Yes | | Config section |
| key | string | Yes | | Config key |
| oldValue | string (JSON) | Yes | | Value before change |
| newValue | string (JSON) | Yes | | Value after change |
| changedAt | datetime | Yes | BR-49 | When changed |
| changedBy | string | Yes | | Who changed |

#### Entity: KbPromotionQueue

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| promotionId | string (UUID) | Yes | | Primary key |
| entryId | string | Yes | | KB entry pending promotion |
| sourceTier | enum | Yes | | Current tier (USER) |
| targetTier | enum | Yes | | Proposed tier (PROJECT/SHARED) |
| reason | string | Yes | | Why promotion suggested |
| status | enum | Yes | | PENDING / APPROVED / REJECTED |
| reviewComment | string | No | BR-09 | Reviewer comment (min 10 chars) |
| reviewedBy | string | No | | Reviewer user ID |
| reviewedAt | datetime | No | | Review timestamp |
| createdAt | datetime | Yes | | When queued |
| cooldownUntil | datetime | No | BR-13 | If rejected, no re-suggest until |

### 4.3 Relationships

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| User | AccessGroup | N:1 | Each user belongs to exactly one group |
| AccessGroup | GroupPermission | 1:N | Group has multiple permission assignments |
| Permission | GroupPermission | 1:N | Permission assigned to multiple groups |
| User | Session | 1:N | User can have multiple active sessions |
| User | AuditEntry | 1:N | User generates many audit entries |
| ConfigEntry | ConfigHistory | 1:N | Each config key has change history |
| KbEntry (KB) | KbPromotionQueue | 1:1 | Entry can have one pending promotion |

---

## 5. Integration Specifications

### 5.1 External System: Backend MCP Server (KSA-284)

| Attribute | Value |
|-----------|-------|
| Purpose | Host for the admin portal — provides HTTP server, MCP orchestration |
| Direction | Bidirectional |
| Data Format | JSON (REST API) |
| Frequency | Real-time (every admin action) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| MCP server status request | Server health, tool list | Receive | MCP Management module |
| Tool toggle command | Toggle confirmation | Send | BR-25 |
| Server restart command | Restart result | Send | BR-26 |
| System health request | Uptime, memory, CPU | Receive | Dashboard module |

### 5.2 External System: JWT Auth Service (KSA-285)

| Attribute | Value |
|-----------|-------|
| Purpose | Authentication — issues and validates JWT tokens |
| Direction | Inbound (validate tokens on every request) |
| Data Format | JWT (Authorization header) |
| Frequency | Every API request |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| JWT token in header | Token validation result | Send/Receive | Every API call validated |
| Login credentials | JWT token | Receive | Login flow |
| User ID from token | | Receive | Identify current user |

### 5.3 External System: Multi-Tenant KB (KSA-285)

| Attribute | Value |
|-----------|-------|
| Purpose | Knowledge base storage and retrieval — portal manages entries |
| Direction | Bidirectional |
| Data Format | JSON |
| Frequency | On-demand (admin operations) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| KB search/filter query | Entry list | Receive | KB Management module |
| Link/unlink command | Updated relationships | Send | UC-02b |
| Tag updates | Updated entry | Send | UC-02c |
| Promotion approval | Entry tier change | Send | BR-09 |
| Import data | Created entries | Send | BR-14 |
| Export request | Entry data (JSON/CSV) | Receive | Story 12 |
| Graph data request | Nodes + edges | Receive | UC-03 |
| Analytics request | Scores, embeddings | Receive | UC-04 |
| Search query | Ranked results with scores | Receive | UC-09 |

---

## 6. Processing Logic

### 6.1 RBAC Permission Check (Middleware)

**Trigger:** Every incoming request to `/api/admin/*`
**Input:** HTTP request with JWT Authorization header
**Output:** Allow (proceed to handler) or Deny (HTTP 403)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Extract JWT from Authorization header | 401 if missing/malformed |
| 2 | Validate JWT (signature, expiry) | 401 if invalid/expired |
| 3 | Extract userId from JWT claims | 401 if no userId claim |
| 4 | Fetch user record + AccessGroup + Permissions | 403 if user disabled |
| 5 | Determine required permission for endpoint | Route → Permission mapping |
| 6 | Check if user's AccessGroup contains required permission | 403 if not found |
| 7 | If permission has roleData, validate each rule value against PermissionRuleDefinition (type check + allowed values) | 403 if roleData rule denies |
| 8 | Allow request to proceed | — |
| 9 | After handler completes, record audit entry | Log failure as WARNING |

![RBAC Check Flow](diagrams/sequence-rbac.png)

### 6.1.1 Permission Rules Specification (Structured roleData)

> **Design Principle:** Each permission has a FIXED set of configurable rules. Admin selects values from predefined options via UI controls (toggles, sliders, multi-select checkboxes) — NO freeform JSON input. The RBAC middleware validates roleData against these rule definitions at runtime.

**Rule Type → UI Control Mapping:**

| Type | UI Control | Storage Format | Validation |
|------|-----------|----------------|------------|
| boolean | Toggle switch | `true` / `false` | Must be boolean |
| number | Number input with min/max slider | Integer | Must be within defined range |
| enum[] | Multi-select checkboxes | Array of selected values | Each value must be in allowed values list |

**Complete Permission Rules Registry (32 rules across 14 permissions):**

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
| MCP_ACCESS | allowedServers | enum[] | *, atlassian, drawio, markdown-exporter, code-intel | [*] | MCP servers user can access |
| MCP_ACCESS | allowedMethods | enum[] | *, read-only, read-write | [read-only] | Method access level per server |
| MCP_MANAGE | allowedServers | enum[] | *, atlassian, drawio, markdown-exporter, code-intel | [*] | MCP servers user can manage |
| MCP_MANAGE | allowRestart | boolean | true, false | true | Allow restarting servers |
| MCP_MANAGE | allowStop | boolean | true, false | false | Allow stopping servers |
| USER_MANAGE | canDelete | boolean | true, false | false | Can permanently delete users |
| USER_MANAGE | canForceLogout | boolean | true, false | false | Can force logout active sessions |
| USER_MANAGE | canDisable | boolean | true, false | true | Can disable/enable user accounts |
| RBAC_MANAGE | canDeleteSystemGroups | boolean | true, false | false (LOCKED) | Cannot be changed via UI |
| RBAC_MANAGE | canEditSystemPermissions | boolean | true, false | false | Can modify permissions of system groups |
| CONFIG_EDIT | allowedSections | enum[] | server, embedding, mcp-servers, kb, auth | [server, embedding] | Config sections user can edit |
| CONFIG_EDIT | readOnly | boolean | true, false | true | If true, view-only regardless of allowedSections |
| SEARCH_EXPLORE | maxResults | number | 10–1000 | 100 | Max search results returned per query |
| SEARCH_EXPLORE | allowDebugMode | boolean | true, false | false | Allow access to debug/explain query mode |
| AUDIT_VIEW | exportAllowed | boolean | true, false | false | Allow exporting audit log to CSV |
| AUDIT_VIEW | maxDaysVisible | number | 1–365 | 90 | How many days of audit history visible |
| GRAPH_VIEW | exportAllowed | boolean | true, false | false | Allow exporting graph as PNG/SVG |
| GRAPH_VIEW | maxNodes | number | 50–5000 | 500 | Max nodes rendered in graph view |
| ANALYTICS_VIEW | exportAllowed | boolean | true, false | false | Allow exporting analytics data |
| ANALYTICS_VIEW | allowedMetrics | enum[] | quality-scores, embedding-space, usage-stats, health-monitor | [quality-scores, usage-stats] | Which analytics dashboards accessible |

**Key Constraints:**

- `RBAC_MANAGE.canDeleteSystemGroups` is **LOCKED to false** — cannot be changed via UI
- `allowedServers = [*]` means ALL current and future servers
- `CONFIG_EDIT.readOnly = true` overrides `allowedSections` — user sees all but cannot edit
- Number ranges define admin-settable min–max; values outside rejected by API validation
- `enum[]` values are system-defined constants; adding new values requires code deployment

**UI Rendering Rules for RBAC Form:**

| Rule Type | Form Control | Interaction |
|-----------|-------------|-------------|
| boolean | Toggle switch | On/Off, immediate visual feedback |
| number | Slider with number input | Constrained to min/max, step = 1 |
| enum[] | Checkbox group | Each option as labeled checkbox, at least one required |
| LOCKED rule | Disabled toggle (greyed out) | Tooltip: "This setting is system-locked" |

### 6.2 KB Entry Promotion Process

**Trigger:** Admin approves/rejects a pending promotion
**Input:** entryId, decision (APPROVE/REJECT), comment, targetTier
**Output:** Entry moved to new tier (or marked rejected)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Validate promotion exists and is PENDING | 404 if not found, 400 if not PENDING |
| 2 | Validate comment length >= 10 chars | 400 with validation error |
| 3 | If APPROVE: move entry to targetTier | Rollback on failure |
| 4 | If APPROVE: update entry metadata (promotedAt, promotedBy) | — |
| 5 | If REJECT: mark as REJECTED, set cooldownUntil = now + 7 days | — |
| 6 | Update promotion queue record | — |
| 7 | Record audit entry | — |

![KB Entry Lifecycle](diagrams/state-kb-entry.png)

### 6.3 Configuration Hot-Reload Process

**Trigger:** Admin updates a config value where `requiresRestart = false`
**Input:** section, key, newValue
**Output:** Config applied live, history recorded

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Validate newValue against schema | 400 with validation error |
| 2 | Read current value (for history) | — |
| 3 | Update config in database | Rollback on failure |
| 4 | Push change to in-memory config | — |
| 5 | Notify affected subsystems to reload | Log if notification fails |
| 6 | Record config history entry | — |
| 7 | Record audit entry | — |
| 8 | Verify change took effect (within 5s) | Warn if not confirmed |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role (Access Group) | Permissions | Portal Modules |
|---------------------|-------------|----------------|
| System Owner | ALL | All modules visible and functional |
| Administrator | All except RBAC_MANAGE | All modules except RBAC management |
| Operator | DASHBOARD_VIEW, MCP_ACCESS, MCP_MANAGE, KB_READ, AUDIT_VIEW | Dashboard, MCP, KB (read), Audit |
| Developer | DASHBOARD_VIEW, KB_READ, KB_WRITE, MCP_ACCESS, SEARCH_EXPLORE, GRAPH_VIEW | Dashboard, KB, Search, Graph |
| Viewer | DASHBOARD_VIEW, KB_READ, GRAPH_VIEW, ANALYTICS_VIEW | Dashboard, KB (read), Graph, Analytics |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| User credentials (passwordHash) | Restricted | Never exposed via API; bcrypt hashed |
| JWT tokens | Confidential | Transmitted only in headers; short-lived |
| Audit trail | Internal | Immutable; retained per policy |
| KB content | Internal | Access controlled by tier + roleData |
| Server configuration | Confidential | Section-level access control via roleData |
| Session data | Confidential | Auto-expired; force-revokable |

### 7.3 Audit Trail

| Event | Logged Fields | Retention | Business Reason |
|-------|--------------|-----------|-----------------|
| All admin API calls | userId, action, resource, resourceId, changes, timestamp, IP | 90 days (configurable) | Compliance, accountability |
| Login attempts | userId, success/fail, IP, device | 90 days | Security monitoring |
| Permission changes | userId, group, before/after permissions | 90 days | Access control audit |
| Configuration changes | userId, section, key, oldValue, newValue | 90 days | Change tracking |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Dashboard loads quickly | All widgets render < 2 seconds |
| Performance | API responses fast | 95th percentile < 500ms |
| Performance | Graph smooth | 60fps with up to 500 nodes |
| Performance | Search responsive | Results within 2 seconds |
| Performance | Charts render | Within 3 seconds for 10K entries |
| Scalability | Concurrent admins | Support 100 concurrent sessions |
| Availability | Portal always available | Available whenever Backend is running |
| Security | RBAC enforcement | Permission check on every API call |
| Security | Immutable audit | No API to modify/delete audit records |
| Usability | Accessibility | WCAG 2.1 AA (keyboard nav, ARIA, contrast) |
| Maintainability | Component reuse | React component library for consistency |
| Data Integrity | Config validation | Schema validation before applying changes |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| JWT expired | Warning | "Session expired. Please login again." | Redirect to login, preserve URL for return |
| Permission denied | Warning | "You don't have permission for this action." | Show which permission needed |
| Server unresponsive | Critical | "MCP Server {name} is not responding." | Offer restart option |
| KB entry not found | Info | "Entry not found or has been deleted." | Return to list |
| Import file too large | Warning | "File exceeds 50MB limit." | Show current size, suggest splitting |
| Config validation error | Warning | "{field}: expected {type}, got {actual}" | Highlight field, show expected format |
| Circular link detected | Warning | "Cannot create link: would form a circular reference." | Show existing path |
| Last System Owner | Critical | "Cannot remove last System Owner." | Block action |
| Concurrent edit conflict | Warning | "This entry was modified by another admin." | Show diff, ask to resolve |
| Network timeout | Warning | "Request timed out. Please try again." | Retry button |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| MCP server crash | All admins with MCP_MANAGE | In-app alert (dashboard) | Immediate |
| Memory threshold exceeded | All admins with DASHBOARD_VIEW | In-app alert badge | Immediate |
| Promotion pending | Admins with KB_PROMOTE | Sidebar badge count | On queue change |
| Password reset completed | Target user | Email (future) / In-app | Immediate |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Dashboard loads all widgets | Authenticated admin | All metrics displayed < 2s | High |
| TC-02 | RBAC blocks unauthorized access | User without KB_WRITE calls KB edit | HTTP 403 | High |
| TC-03 | User creation with valid data | Valid username, email, password, group | User created, can login | High |
| TC-04 | KB entry promotion approval | APPROVE + comment (10+ chars) | Entry moves to target tier | High |
| TC-05 | KB entry promotion rejection | REJECT + comment | Entry stays, 7-day cooldown | High |
| TC-06 | MCP server restart | Click restart on STOPPED server | Server transitions to RUNNING | High |
| TC-07 | Tool toggle off | Disable tool on running server | Tool returns "disabled" on call | High |
| TC-08 | Config hot-reload | Update non-restart config | Change effective within 5s | Medium |
| TC-09 | Audit immutability | Attempt DELETE on audit endpoint | 403/404 — no endpoint exists | High |
| TC-10 | Graph performance | Render 500 nodes | 60fps, no lag | Medium |
| TC-11 | KB import with conflicts | JSON with existing IDs | Conflict resolution UI shown | Medium |
| TC-12 | Force logout | Admin force-logouts user session | Session terminated < 5s | High |
| TC-13 | Last System Owner protection | Delete last user in System Owner | Blocked with error message | High |
| TC-14 | Search score breakdown | Execute test query | Scores + breakdown shown | Low |
| TC-15 | Audit export | Export 30-day range as CSV | Valid CSV file downloaded | Medium |

---

## 11. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Authentication Sequence | [sequence-auth.png](diagrams/sequence-auth.png) | [sequence-auth.drawio](diagrams/sequence-auth.drawio) |
| 3 | RBAC Permission Check | [sequence-rbac.png](diagrams/sequence-rbac.png) | [sequence-rbac.drawio](diagrams/sequence-rbac.drawio) |
| 4 | KB Management Sequence | [sequence-kb-management.png](diagrams/sequence-kb-management.png) | [sequence-kb-management.drawio](diagrams/sequence-kb-management.drawio) |
| 5 | KB Entry State Diagram | [state-kb-entry.png](diagrams/state-kb-entry.png) | [state-kb-entry.drawio](diagrams/state-kb-entry.drawio) |

### Change Log from BRD

- Consolidated Stories 2, 11, 12 into single "KB Management" feature section (UC-02a through UC-02c + promotion + import/export) for logical grouping
- Added explicit RBAC middleware processing logic (Section 6.1) not detailed in BRD
- Added Configuration History entity (not explicitly in BRD but implied by Story 8 AC-6)
- Added KbPromotionQueue entity to track promotion workflow state
- Specified roleData validation against per-permission JSON schemas (implementation detail from BRD's RBAC model)


---

## 12. Technical Enrichment (TA Review)

### 12.1 API Response Standards

All admin API responses follow a consistent envelope format:

**Success Response:**
```json
{
  "success": true,
  "data": { },
  "meta": { "requestId": "uuid", "timestamp": "ISO-8601" }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You don't have KB_WRITE permission",
    "details": { "requiredPermission": "KB_WRITE" }
  },
  "meta": { "requestId": "uuid", "timestamp": "ISO-8601" }
}
```

**Pagination Response:**
```json
{
  "success": true,
  "data": { "items": [] },
  "pagination": {
    "page": 1, "size": 20, "total": 156, "totalPages": 8,
    "hasNext": true, "hasPrev": false
  }
}
```

**HTTP Status Codes:**

| Code | Usage |
|------|-------|
| 200 | Successful GET, PATCH, DELETE |
| 201 | Successful POST (resource created) |
| 400 | Validation error, malformed request |
| 401 | Missing/invalid/expired JWT |
| 403 | Valid JWT but insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (duplicate username, concurrent edit) |
| 413 | Request too large (import file > 50MB) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

### 12.2 JWT Token Structure

**JWT Claims (from KSA-285):**
```json
{
  "sub": "user-abc-123",
  "username": "john.doe",
  "accessGroupId": "grp-admin-001",
  "iat": 1720950000,
  "exp": 1720953600,
  "jti": "session-uuid"
}
```

**Token Lifecycle:**
- Access token TTL: 1 hour (configurable)
- Refresh token TTL: 7 days
- On 401: SPA attempts token refresh before redirecting to login

### 12.3 SSE (Server-Sent Events) Specification

**Endpoint:** `GET /api/admin/events`
**Permission Required:** `DASHBOARD_VIEW`

**Event Types:**

| Event | Data | Trigger |
|-------|------|---------|
| health_update | `{uptime, memoryUsageMB, cpuPercent}` | Every 30s |
| activity | `{auditId, userId, action, timestamp}` | On any admin action |
| mcp_status_change | `{serverId, status, previousStatus}` | Server state change |
| alert | `{severity, message, since}` | Threshold exceeded |
| promotion_queued | `{entryId, title, sourceTier}` | New promotion pending |

**Connection Management:**
- `Last-Event-ID` header for reconnection
- `retry: 30000` (30s reconnect interval)
- Heartbeat every 15s (`:keepalive`)

### 12.4 Pseudocode — RBAC Middleware

```
function rbacMiddleware(request, response, next):
    // 1. Extract JWT
    token = extractBearerToken(request.headers.authorization)
    if not token: return 401 "Missing token"
    
    // 2. Validate JWT
    claims = jwtService.validate(token)
    if not claims: return 401 "Invalid or expired token"
    
    // 3. Check user status
    user = userRepository.findById(claims.sub)
    if not user or user.status != "ACTIVE": return 403 "Account disabled"
    
    // 4. Determine required permission for route
    requiredPermission = routePermissionMap.get(request.method + request.path)
    if not requiredPermission: return next()  // Public route
    
    // 5. Fetch permissions via AccessGroup
    group = accessGroupRepository.findWithPermissions(user.accessGroupId)
    
    // 6. Check permission exists in group
    matched = group.permissions.find(p => p.permissionId == requiredPermission)
    if not matched: return 403 "Requires: " + requiredPermission
    
    // 7. Validate roleData rule constraints against request
    if matched.roleData:
        ruleDefinitions = ruleDefinitionRegistry.getRules(requiredPermission)
        for rule in ruleDefinitions:
            ruleValue = matched.roleData[rule.ruleName] ?? rule.defaultValue
            if not validateRuleAgainstRequest(request, rule, ruleValue):
                return 403 "Rule " + rule.ruleName + " denies this action"
    
    // 8. Attach user context
    request.user = { userId, username, accessGroup, permissions }
    next()
    
    // 9. Record audit (async)
    auditService.recordAsync({ userId, action, resource, timestamp, ip })

function validateRuleAgainstRequest(request, ruleDefinition, ruleValue):
    switch ruleDefinition.ruleType:
        case 'boolean':
            // e.g., exportAllowed=false blocks export endpoints
            if ruleDefinition.ruleName.startsWith('allow') or ruleDefinition.ruleName.startsWith('can'):
                return ruleValue == true or not isActionRequiringRule(request, ruleDefinition)
        case 'number':
            // e.g., maxEntries — check current count against limit
            return getCurrentCount(request, ruleDefinition) <= ruleValue
        case 'enum[]':
            // e.g., allowedServers — check requested resource is in list
            if ruleValue.includes('*'): return true
            return ruleValue.includes(getRequestedResource(request, ruleDefinition))
```

### 12.5 Pseudocode — Circular Link Detection

```
function hasCircularLink(sourceId, targetId, kbEngine):
    // BFS from target → check if source reachable
    visited = Set()
    queue = [targetId]
    while queue not empty:
        current = queue.dequeue()
        if current == sourceId: return true  // Circular!
        if current in visited: continue
        visited.add(current)
        for linked in kbEngine.getLinkedEntries(current):
            queue.enqueue(linked.id)
    return false
```

### 12.6 Pseudocode — Config Hot-Reload

```
function updateConfig(section, key, newValue, user):
    // 1. Validate against schema
    schema = configSchemaRegistry.getSchema(section, key)
    if not schema.validate(newValue): throw ValidationError
    
    // 2. Transactional update + history
    current = configRepository.get(section, key)
    db.transaction(() => {
        configRepository.set(section, key, newValue)
        configHistoryRepository.add({ section, key, oldValue, newValue, changedBy })
    })
    
    // 3. Apply or mark restart-required
    if entry.requiresRestart:
        serverState.markRestartRequired(section, key)
        return { applied: false, requiresRestart: true }
    else:
        runtimeConfig.set(section, key, newValue)
        eventBus.emit("config:changed", { section, key, newValue })
        return { applied: true }
```

### 12.7 Pseudocode — KB Promotion Auto-Trigger

```
function evaluatePromotionEligibility(entry):
    // Check cooldown (BR-13: rejected = 7-day wait)
    existing = promotionQueue.findByEntryId(entry.id)
    if existing?.status == "REJECTED" and now() < existing.cooldownUntil:
        return  // Still in cooldown
    
    // Evaluate rules
    rules = [
        { condition: entry.qualityScore > 85 for 7 days, targetTier: "PROJECT" },
        { condition: entry.accessCount > 50 in 30 days, targetTier: "PROJECT" },
        { condition: entry.linkedCount > 5, targetTier: "SHARED" }
    ]
    for rule in rules:
        if rule.condition(entry):
            promotionQueue.add({ entryId, sourceTier, targetTier, reason, status: "PENDING" })
            notifyAdminsByPermission("KB_PROMOTE", { type: "promotion_queued", entry })
            return
```

### 12.8 Rate Limiting

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Read (GET) | 100 req | /min |
| Write (POST/PATCH/DELETE) | 30 req | /min |
| Search/Analytics | 20 req | /min |
| Import/Export | 5 req | /hour |
| SSE connection | 1 per user | persistent |

### 12.9 Open Issues / Technical Decisions

| # | Issue | Options | Recommendation | Status |
|---|-------|---------|----------------|--------|
| 1 | SPA bundling | Vite vs Webpack | Vite (faster dev) | Pending |
| 2 | State management | Redux vs Zustand vs React Query | React Query + Zustand | Pending |
| 3 | Graph library | D3.js vs react-force-graph | ForceGraph3D (CDN, Three.js) | Decided |
| 4 | Config format | YAML vs JSON | YAML | Decided |
| 5 | Audit storage | Same SQLite vs separate | Same SQLite (partitioned) | Pending |
| 6 | RBAC cache | On-write vs TTL | On-write (immediate) | Decided |

---

*Technical enrichment completed by TA Agent. FSD ready for Phase 3 (TDD).*

# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-64: Session Replay: Redesign for richer event data and AI context value

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-64 |
| Title | Session Replay: Redesign for richer event data and AI context value |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-20 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | Duc Nguyen Minh – Tech Lead | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-20 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-64 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Redesign the Session Replay feature in MCP Code Intelligence to capture richer event data and provide meaningful AI context value. The current implementation only displays operation names with truncated details (200 chars), offering minimal value for AI agents or users reviewing session history.

This CR covers:
- **Server-side (Kotlin)**: Expand audit log schema to store full tool arguments, result summaries, duration per operation, and structured metadata
- **API layer (Node.js)**: Update session/event endpoints to serve enriched data with filtering and export capabilities
- **Viewer UI (shared/viewer)**: Redesign session replay with visual timeline, task grouping, duration display, richer event cards, and AI context export

### 1.2 Out of Scope

- Real-time collaborative session viewing (multi-user)
- Session recording for external MCP servers (only internal operations)
- Video/screen recording of user interactions
- Historical data migration (existing audit entries remain as-is)
- Authentication/authorization changes for session access

### 1.3 Preliminary Requirement

- Existing audit trail infrastructure (memory_audit table) must be operational
- Node.js HTTP server with `/sessions` and `/sessions/:id/events` endpoints must be running
- Shared viewer must be accessible via the existing static file serving mechanism

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Session Replay feature enables developers and AI agents to review past tool execution sessions with full context. The redesigned flow captures richer data at write-time (Kotlin audit), serves it through enhanced APIs (Node.js), and presents it in an improved timeline UI (viewer).

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want to see full tool arguments and results in session replay so that I can debug agent behavior | MUST HAVE | KSA-64 |
| 2 | As a developer, I want to see operation duration for each event so that I can identify performance bottlenecks | MUST HAVE | KSA-64 |
| 3 | As a developer, I want events grouped by task/goal so that I can understand the logical flow of a session | SHOULD HAVE | KSA-64 |
| 4 | As an AI agent, I want to export a session as markdown context so that I can resume work from a previous session | MUST HAVE | KSA-64 |
| 5 | As a developer, I want richer event cards with structured metadata display so that I can quickly scan session activity | SHOULD HAVE | KSA-64 |
| 6 | As a developer, I want sticky playback controls that don't jump when scrolling so that replay navigation is smooth | SHOULD HAVE | KSA-64 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Agent performs tool operations (INGEST, SEARCH, DELETE, TOOL_CALL, etc.) during a session

**Step 2:** Kotlin AuditRepository logs each operation with expanded schema: full arguments, result summary, duration, task context

**Step 3:** Node.js API serves session list and event details through enhanced endpoints with filtering

**Step 4:** User opens Session Replay in viewer, sees session list with duration and event counts

**Step 5:** User selects a session, sees visual timeline with events grouped by task

**Step 6:** User navigates events via playback controls, sees full details in richer event cards

**Step 7:** User (or AI agent) exports session as markdown for context resumption

> **Note:** Steps 1-2 happen automatically during normal agent operation. Steps 3-7 are user-initiated.

---

#### STORY 1: Rich Event Data Capture

> As a developer, I want to see full tool arguments and results in session replay so that I can debug agent behavior

**Requirement Details:**

1. Expand `memory_audit` table schema to include new columns: `arguments` (TEXT), `result_summary` (TEXT), `duration_ms` (INTEGER), `task_id` (TEXT), `tool_name` (TEXT)
2. AuditRepository.log() must accept and persist these new fields
3. `details` field remains for backward compatibility but new fields provide structured access
4. Arguments stored as JSON string (full tool input parameters)
5. Result summary stored as truncated result (max 2000 chars) with indicator if truncated
6. Duration calculated as milliseconds between operation start and completion

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| arguments | TEXT | No | Full JSON of tool input arguments | `{"query": "session replay", "top_k": 5}` |
| result_summary | TEXT | No | Truncated result output (max 2000 chars) | `Found 3 entries matching...` |
| duration_ms | INTEGER | No | Operation duration in milliseconds | `245` |
| task_id | TEXT | No | Logical task/goal grouping identifier | `task_abc123` |
| tool_name | TEXT | No | Specific tool name (more granular than operation) | `kb_search` |

**Acceptance Criteria:**

1. New audit entries include full tool arguments when available
2. Result summary captures meaningful output (not just "success")
3. Duration is accurately measured for each operation
4. Existing audit entries without new fields continue to work (nullable columns)
5. Schema migration runs without data loss on existing installations

---

#### STORY 2: Operation Duration Tracking

> As a developer, I want to see operation duration for each event so that I can identify performance bottlenecks

**Requirement Details:**

1. Each audit log entry must record `duration_ms` — time from operation start to completion
2. Duration displayed in event cards with human-readable format (e.g., "245ms", "1.2s", "3.5s")
3. Timeline bar width proportional to duration (visual indicator)
4. Session summary shows total duration and average operation time

**Acceptance Criteria:**

1. Duration displayed for each event in replay timeline
2. Events with duration > 1000ms highlighted as "slow" (yellow indicator)
3. Events with duration > 5000ms highlighted as "very slow" (red indicator)
4. Session header shows total session duration and operation count

---

#### STORY 3: Task Grouping

> As a developer, I want events grouped by task/goal so that I can understand the logical flow of a session

**Requirement Details:**

1. Events within a session can be tagged with a `task_id` representing a logical unit of work
2. Viewer groups consecutive events with same `task_id` into collapsible sections
3. Each task group shows: task description (if available), event count, total duration
4. Events without `task_id` shown as ungrouped (flat list, backward compatible)

**Acceptance Criteria:**

1. Events with same `task_id` rendered in a collapsible group
2. Group header shows task summary, event count, and aggregate duration
3. Ungrouped events display normally (no regression)
4. User can expand/collapse task groups independently

---

#### STORY 4: AI Context Export

> As an AI agent, I want to export a session as markdown context so that I can resume work from a previous session

**Requirement Details:**

1. "Export as Markdown" button in session detail view
2. Export generates structured markdown with: session metadata, chronological events, tool calls with arguments/results
3. Export format optimized for AI agent context window (concise but complete)
4. API endpoint: `GET /sessions/:id/export?format=markdown`
5. Export includes task groupings if available

**Export Format:**

```markdown
# Session: {agent_name} — {start_time}
Duration: {total_duration} | Events: {count}

## Task: {task_description}
- [{timestamp}] {tool_name}: {arguments_summary} → {result_summary} ({duration}ms)
- [{timestamp}] {tool_name}: {arguments_summary} → {result_summary} ({duration}ms)

## Ungrouped Events
- [{timestamp}] {operation}: {details}
```

**Acceptance Criteria:**

1. Export button visible in session detail view
2. Clicking export downloads/copies markdown to clipboard
3. API endpoint returns markdown string with correct content-type
4. Exported markdown is parseable and useful for AI context resumption
5. Export respects session boundaries (only events within selected session)

---

#### STORY 5: Richer Event Cards

> As a developer, I want richer event cards with structured metadata display so that I can quickly scan session activity

**Requirement Details:**

1. Event cards show: operation type (color-coded), tool name, duration badge, timestamp
2. Expandable section shows: full arguments (formatted JSON), result summary
3. Visual indicators: success/failure icon, duration color coding, entry link
4. Compact mode (list view) and expanded mode (detail view) toggle

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Operation Badge | Label | Yes | Color-coded operation type | Uses existing opColor() mapping |
| 2 | Tool Name | Label | No | Specific tool name | Only shown if tool_name field populated |
| 3 | Duration Badge | Label | No | Duration in human format | Color: green <500ms, yellow 500-2000ms, red >2000ms |
| 4 | Timestamp | Label | Yes | Event time | Relative format (e.g., "+2.3s from session start") |
| 5 | Arguments Toggle | Button | No | Expand/collapse arguments | Only shown if arguments field populated |
| 6 | Result Preview | Text | No | First 200 chars of result | Expandable to full result |
| 7 | Entry Link | Link | No | Link to memory entry | Only shown if entryId populated |

**Acceptance Criteria:**

1. Event cards display all available metadata fields
2. Cards gracefully handle missing optional fields (no empty space)
3. JSON arguments formatted with syntax highlighting
4. Performance: rendering 200+ events does not cause UI lag

---

#### STORY 6: Smooth Playback Controls

> As a developer, I want sticky playback controls that don't jump when scrolling so that replay navigation is smooth

**Requirement Details:**

1. Playback controls bar (play/pause, step, scrub) remains sticky at top of session detail
2. Event list does not rebuild DOM on each step (only updates highlight and detail)
3. Smooth scrolling to active event (already partially implemented)
4. Speed control: 0.5x, 1x, 2x, 4x playback speed options

**Acceptance Criteria:**

1. Controls remain visible when scrolling through long event lists
2. No DOM rebuild flicker during playback (incremental updates only)
3. Speed selector allows changing playback interval
4. Keyboard shortcuts: Space (play/pause), Left/Right (step), Home/End (first/last)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| SQLite memory_audit table | System | N/A | Existing audit table must support schema migration (ALTER TABLE) |
| Kotlin AuditRepository | System | N/A | Must be extended without breaking existing callers |
| Node.js HTTP server | System | N/A | Session endpoints must be backward compatible |
| Shared viewer static serving | Infrastructure | N/A | Viewer files served by Node.js HTTP server |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter / Tech Lead | Duc Nguyen Minh | Define requirements, review implementation | Jira reporter |
| Developer | Unassigned | Implement changes across Kotlin, Node.js, viewer | Jira assignee |
| End User | AI Agent developers | Use session replay for debugging and context | Target audience |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Schema migration breaks existing installations | High | Low | Use ALTER TABLE ADD COLUMN (nullable), no data loss |
| Full arguments storage increases DB size significantly | Medium | Medium | Implement configurable max size, truncation with indicator |
| Rendering 500+ events causes UI performance issues | Medium | Medium | Virtual scrolling or pagination for large sessions |
| Backward compatibility break in API responses | High | Low | Add new fields alongside existing ones, never remove |

### 5.2 Assumptions

- SQLite supports ALTER TABLE ADD COLUMN for the new fields
- Existing audit entries will not be backfilled (new fields null for old data)
- Session replay is used primarily for debugging, not real-time monitoring
- AI context export format does not need to be standardized across tools (internal use)
- The viewer is single-user (no concurrent session viewing concerns)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Event list rendering < 100ms for 200 events | No DOM rebuild on step; incremental updates only |
| Performance | API response < 200ms for session with 500 events | Efficient SQL query with proper indexing |
| Storage | Arguments field max 10KB per entry | Truncate with indicator if exceeded |
| Storage | Result summary max 2KB per entry | Truncate with `[truncated]` suffix |
| Compatibility | Backward compatible API | New fields added, existing fields unchanged |
| Compatibility | Existing viewer features unaffected | Playback, filtering, session list all preserved |
| Usability | Export markdown < 50KB for typical session | Concise format optimized for AI context windows |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-64 | Session Replay: Redesign for richer event data and AI context value | To Do | Task | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Session | A logical grouping of agent operations from start to end of a task |
| Audit Entry | A single logged operation in the memory_audit table |
| Task Group | A subset of events within a session sharing the same task_id |
| Context Export | Markdown representation of a session for AI agent consumption |
| Duration | Time in milliseconds between operation start and completion |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Current AuditRepository | mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/memory/repository/AuditRepository.kt |
| Current Session Viewer | shared/viewer/sessions.js |
| Node.js API Routes | mcp-code-intelligence-nodejs/src/http/api-routes.ts |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

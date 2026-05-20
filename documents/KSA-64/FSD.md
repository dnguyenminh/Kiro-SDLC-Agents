# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-64: Session Replay: Redesign for richer event data and AI context value

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-64 |
| Title | Session Replay: Redesign for richer event data and AI context value |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-20 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-64.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-20 | BA Agent | Initiate document — auto-generated from BRD KSA-64 |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the redesigned Session Replay feature. It defines use cases, API contracts, data model changes, and UI specifications needed to deliver richer event data capture and AI context export.

### 1.2 Scope

- Kotlin: Schema migration + AuditRepository expansion (new columns, new log method signature)
- Node.js: Enhanced session/event API endpoints + new export endpoint
- Viewer: Redesigned timeline UI with task grouping, duration display, richer event cards, and export button

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Session | A logical grouping of agent operations from SESSION_START to SESSION_END |
| Audit Entry | A single row in memory_audit table representing one operation |
| Task Group | Consecutive events sharing the same task_id within a session |
| Context Export | Markdown representation of session for AI agent consumption |
| Duration | Milliseconds between operation start and completion |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-64/BRD.md |
| Current AuditRepository | mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/memory/repository/AuditRepository.kt |
| Current sessions.js | shared/viewer/sessions.js |
| Current api-routes.ts | mcp-code-intelligence-nodejs/src/http/api-routes.ts |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

*[Edit in draw.io](diagrams/system-context.drawio)*

The Session Replay system spans three layers:
1. **Kotlin Server** — writes enriched audit data to SQLite
2. **Node.js Bridge** — reads audit data and serves via HTTP API
3. **Viewer UI** — renders session timeline and provides export functionality

### 2.2 System Architecture

![System Architecture](diagrams/system-context.png)

*[Edit in draw.io](diagrams/system-context.drawio)*

---

## 3. Functional Requirements

### 3.1 Feature: Rich Event Data Capture

**Source:** BRD Story 1, Story 2

#### 3.1.1 Description

Expand the audit logging system to capture full tool arguments, result summaries, operation duration, task context, and specific tool names. This data is persisted in new columns added to the `memory_audit` table.

#### 3.1.2 Use Case

**Use Case ID:** UC-01
**Actor:** Kotlin Server (automated)
**Preconditions:** Agent is executing a tool operation within an active session
**Postconditions:** Audit entry created with all available enriched fields

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent | | Invokes a tool (e.g., kb_search, mem_ingest) |
| 2 | | Kotlin Server | Records start timestamp |
| 3 | | Kotlin Server | Executes tool operation |
| 4 | | Kotlin Server | Records end timestamp, calculates duration_ms |
| 5 | | Kotlin Server | Calls AuditRepository.log() with enriched fields |
| 6 | | SQLite | Persists audit entry with arguments, result_summary, duration_ms, task_id, tool_name |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Tool has no arguments | arguments field stored as null |
| AF-02 | Result exceeds 2000 chars | Truncate to 2000 chars + append "[truncated]" |
| AF-03 | No active task context | task_id stored as null |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Tool execution throws exception | Log with duration_ms up to error point, result_summary = error message |
| EF-02 | DB write fails | Log error to stderr, operation continues (audit is non-blocking) |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | Arguments stored as JSON string, max 10KB | BRD Story 1, NFR |
| BR-02 | Result summary max 2000 chars with truncation indicator | BRD Story 1 |
| BR-03 | Duration measured in milliseconds (Long/INTEGER) | BRD Story 2 |
| BR-04 | All new fields are nullable for backward compatibility | BRD Story 1 AC-4 |
| BR-05 | Existing callers of AuditRepository.log() must continue working without changes | BRD Story 1 AC-4 |

#### 3.1.4 Data Specifications

**Input Data (AuditRepository.log parameters):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| operation | String | Y | Non-empty, max 50 chars | Operation type (INGEST, SEARCH, etc.) |
| entryId | Long? | N | Positive integer if present | Related memory entry ID |
| sessionId | String? | N | UUID format | Active session identifier |
| agentName | String? | N | Max 100 chars | Agent performing operation |
| details | String? | N | Max 500 chars | Legacy details field (backward compat) |
| arguments | String? | N | Valid JSON, max 10KB | Full tool input arguments as JSON |
| resultSummary | String? | N | Max 2000 chars | Truncated operation result |
| durationMs | Long? | N | Non-negative | Operation duration in milliseconds |
| taskId | String? | N | Max 100 chars | Logical task grouping identifier |
| toolName | String? | N | Max 100 chars | Specific tool name |

**Output Data (stored in memory_audit):**

| Field | Type | Description |
|-------|------|-------------|
| id | Long | Auto-increment primary key |
| operation | String | Operation type |
| entry_id | Long? | Related entry ID |
| session_id | String? | Session identifier |
| agent_name | String? | Agent name |
| details | String? | Legacy details |
| arguments | String? | JSON tool arguments |
| result_summary | String? | Truncated result |
| duration_ms | Long? | Duration in ms |
| task_id | String? | Task group ID |
| tool_name | String? | Tool name |
| created_at | String | ISO timestamp (auto) |

---

### 3.2 Feature: Enhanced Session List API

**Source:** BRD Story 1, Story 2

#### 3.2.1 Description

Enhance the `/sessions` endpoint to include aggregate duration and richer metadata per session.

#### 3.2.2 Use Case

**Use Case ID:** UC-02
**Actor:** Developer (via Viewer UI)
**Preconditions:** At least one session exists in the database
**Postconditions:** Session list displayed with duration and event counts

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Opens Sessions tab in viewer |
| 2 | | Viewer | Calls GET /sessions |
| 3 | | Node.js API | Queries sessions with aggregate stats |
| 4 | | Viewer | Renders session list with duration badges |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Filter by agent name | Add agent query param, filter results |
| AF-02 | Filter by status | Add status query param (active/ended) |
| AF-03 | No sessions found | Display "No sessions found" message |

#### 3.2.3 API Contract (Functional View)

**Endpoint:** `GET /sessions`
**Purpose:** List sessions with aggregate metadata

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| agent | String | N | Partial match | Filter by agent name |
| status | String | N | "active" or "ended" | Filter by session status |
| limit | Integer | N | Default 50, max 200 | Max results |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| id | String | Session ID |
| agentName | String | Agent name |
| startedAt | String | ISO timestamp |
| endedAt | String? | ISO timestamp (null if active) |
| status | String | "active" or "ended" |
| observationCount | Integer | Total events in session |
| totalDurationMs | Integer | Sum of all event durations |
| taskCount | Integer | Number of distinct task groups |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Memory not initialized | "Memory not initialized" | Engine not ready (503) |

---

### 3.3 Feature: Enhanced Session Events API

**Source:** BRD Story 1, Story 2, Story 3

#### 3.3.1 Description

Enhance the `/sessions/:id/events` endpoint to return enriched event data including arguments, results, duration, and task grouping.

#### 3.3.2 Use Case

**Use Case ID:** UC-03
**Actor:** Developer (via Viewer UI)
**Preconditions:** A session exists with events
**Postconditions:** Event list displayed with full details

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Clicks on a session in the list |
| 2 | | Viewer | Calls GET /sessions/:id/events |
| 3 | | Node.js API | Queries events for session, ordered by created_at ASC |
| 4 | | Viewer | Renders timeline with enriched event cards |

#### 3.3.3 API Contract (Functional View)

**Endpoint:** `GET /sessions/:id/events`
**Purpose:** Get all events for a session with enriched data

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | String (path) | Y | Must exist | Session ID |
| limit | Integer | N | Default 200, max 1000 | Max events |

**Output Data (per event):**

| Field | Type | Description |
|-------|------|-------------|
| id | Long | Event ID |
| operation | String | Operation type |
| toolName | String? | Specific tool name |
| entryId | Long? | Related entry ID |
| sessionId | String | Session ID |
| details | String? | Legacy details |
| arguments | String? | Full JSON arguments |
| resultSummary | String? | Truncated result |
| durationMs | Long? | Duration in ms |
| taskId | String? | Task group ID |
| createdAt | String | ISO timestamp |

---

### 3.4 Feature: Session Export as Markdown

**Source:** BRD Story 4

#### 3.4.1 Description

New API endpoint that exports a session's events as structured markdown optimized for AI agent context resumption.

#### 3.4.2 Use Case

**Use Case ID:** UC-04
**Actor:** Developer or AI Agent
**Preconditions:** Session exists with at least one event
**Postconditions:** Markdown string returned representing the session

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Actor | | Requests export (button click or API call) |
| 2 | | Node.js API | Fetches all events for session |
| 3 | | Node.js API | Groups events by task_id |
| 4 | | Node.js API | Generates markdown with metadata + events |
| 5 | | Response | Returns markdown string |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | No task groups (all task_id null) | Render flat chronological list |
| AF-02 | Session still active | Include note "Session in progress" at top |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Session not found | Return 404 with error message |
| EF-02 | Session has 0 events | Return markdown with "No events recorded" |

#### 3.4.3 API Contract (Functional View)

**Endpoint:** `GET /sessions/:id/export`
**Purpose:** Export session as markdown for AI context

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | String (path) | Y | Must exist | Session ID |
| format | String | N | Default "markdown" | Export format |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| (body) | String | Markdown content (Content-Type: text/markdown) |

**Export Format Template:**

```markdown
# Session: {agent_name} — {start_time}
Duration: {total_duration} | Events: {event_count} | Tasks: {task_count}

## Task: {task_id}
- [{HH:MM:SS}] **{tool_name}** ({duration}ms): {arguments_summary} → {result_summary}

## Ungrouped Events
- [{HH:MM:SS}] **{operation}**: {details}
```

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Session not found | "Session not found" | Invalid session ID (404) |
| Memory not initialized | "Memory not initialized" | Engine not ready (503) |

---

### 3.5 Feature: Visual Timeline with Task Grouping

**Source:** BRD Story 3, Story 5, Story 6

#### 3.5.1 Description

Redesign the session replay viewer to display events in a visual timeline with task grouping, duration indicators, and richer event cards.

#### 3.5.2 Use Case

**Use Case ID:** UC-05
**Actor:** Developer
**Preconditions:** Session selected, events loaded
**Postconditions:** Timeline rendered with grouped events and playback controls

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Selects a session from list |
| 2 | | Viewer | Fetches events via API |
| 3 | | Viewer | Groups events by task_id |
| 4 | | Viewer | Renders timeline with task group headers |
| 5 | Developer | | Clicks play or steps through events |
| 6 | | Viewer | Highlights current event, shows detail card |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | No task groups | Render flat list (backward compatible) |
| AF-02 | User collapses a task group | Hide events in group, show summary only |
| AF-03 | User changes playback speed | Adjust interval (500ms/1000ms/2000ms/4000ms) |

#### 3.5.3 UI Specifications

**Screen: Session Timeline**

| No. | Element | Type | Required | Behavior | Validation |
|-----|---------|------|----------|----------|------------|
| 1 | Session Header | Label | Y | Shows agent name, duration, event count | — |
| 2 | Progress Bar | Slider | Y | Shows position in timeline, clickable to scrub | — |
| 3 | Play/Pause Button | Button | Y | Toggle playback | — |
| 4 | Step Back/Forward | Button | Y | Move one event at a time | — |
| 5 | Speed Selector | Dropdown | Y | Options: 0.5x, 1x, 2x, 4x | Default 1x |
| 6 | Export Button | Button | Y | Exports session as markdown | — |
| 7 | Task Group Header | Collapsible | N | Shows task summary, event count, duration | Only if task_id present |
| 8 | Event Card | Card | Y | Shows operation, tool, duration, timestamp | — |
| 9 | Arguments Panel | Expandable | N | Shows formatted JSON arguments | Only if arguments present |
| 10 | Result Preview | Text | N | First 200 chars, expandable | Only if result_summary present |
| 11 | Duration Badge | Badge | Y | Color-coded: green/yellow/red | Based on duration thresholds |
| 12 | Position Counter | Label | Y | Shows "N/M" current position | — |

#### 3.5.4 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-06 | Duration badge green: < 500ms | BRD Story 5 |
| BR-07 | Duration badge yellow: 500ms - 2000ms | BRD Story 5 |
| BR-08 | Duration badge red: > 2000ms | BRD Story 5 |
| BR-09 | Task groups are collapsible, default expanded | BRD Story 3 |
| BR-10 | Playback does not rebuild DOM, only updates highlight | BRD Story 6 |
| BR-11 | Controls sticky at top during scroll | BRD Story 6 |
| BR-12 | Keyboard shortcuts: Space=play/pause, ←/→=step, Home/End=first/last | BRD Story 6 |

---

### 3.6 Feature: Export Button in Viewer

**Source:** BRD Story 4

#### 3.6.1 Description

Add an "Export as Markdown" button in the session detail view that calls the export API and copies the result to clipboard.

#### 3.6.2 Use Case

**Use Case ID:** UC-06
**Actor:** Developer
**Preconditions:** Session detail view is open
**Postconditions:** Markdown copied to clipboard (or downloaded)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Clicks "Export" button |
| 2 | | Viewer | Calls GET /sessions/:id/export |
| 3 | | Viewer | Copies markdown to clipboard |
| 4 | | Viewer | Shows success toast "Copied to clipboard" |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Clipboard API not available | Offer download as .md file instead |
| AF-02 | Export fails (API error) | Show error toast with message |

---

## 4. Data Model

### 4.1 Entity: memory_audit (Extended)

**Current columns (unchanged):**

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| id | INTEGER | Y (PK) | Auto-increment |
| operation | TEXT | Y | Operation type |
| entry_id | INTEGER | N | FK to memory entries |
| session_id | TEXT | N | Session identifier |
| agent_name | TEXT | N | Agent name |
| details | TEXT | N | Legacy details (max 500) |
| created_at | TEXT | Y | ISO timestamp (DEFAULT CURRENT_TIMESTAMP) |

**New columns (added via migration):**

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| arguments | TEXT | N | BR-01: max 10KB JSON | Full tool input arguments |
| result_summary | TEXT | N | BR-02: max 2000 chars | Truncated operation result |
| duration_ms | INTEGER | N | BR-03: non-negative | Operation duration in ms |
| task_id | TEXT | N | Max 100 chars | Task group identifier |
| tool_name | TEXT | N | Max 100 chars | Specific tool name |

### 4.2 Migration SQL

```sql
ALTER TABLE memory_audit ADD COLUMN arguments TEXT;
ALTER TABLE memory_audit ADD COLUMN result_summary TEXT;
ALTER TABLE memory_audit ADD COLUMN duration_ms INTEGER;
ALTER TABLE memory_audit ADD COLUMN task_id TEXT;
ALTER TABLE memory_audit ADD COLUMN tool_name TEXT;
```

### 4.3 Indexes (for query performance)

```sql
CREATE INDEX IF NOT EXISTS idx_audit_session_task ON memory_audit(session_id, task_id);
CREATE INDEX IF NOT EXISTS idx_audit_duration ON memory_audit(duration_ms) WHERE duration_ms IS NOT NULL;
```

---

## 5. Integration Specifications

### 5.1 Kotlin → SQLite (Write Path)

| Attribute | Value |
|-----------|-------|
| Purpose | Persist enriched audit events |
| Direction | Outbound (Kotlin writes to SQLite) |
| Data Format | SQL INSERT with prepared statements |
| Frequency | Real-time (on every tool operation) |

### 5.2 Node.js → SQLite (Read Path)

| Attribute | Value |
|-----------|-------|
| Purpose | Read session and event data for API |
| Direction | Inbound (Node.js reads from SQLite) |
| Data Format | SQL SELECT with JSON mapping |
| Frequency | On-demand (API requests) |

### 5.3 Viewer → Node.js API (HTTP)

| Attribute | Value |
|-----------|-------|
| Purpose | Fetch session data and export markdown |
| Direction | Bidirectional (request/response) |
| Data Format | JSON (sessions, events) / text/markdown (export) |
| Frequency | On-demand (user interaction) |

---

## 6. Processing Logic

### 6.1 Duration Calculation

**Trigger:** Tool operation starts
**Input:** Start timestamp (System.currentTimeMillis())
**Output:** duration_ms field in audit entry

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Record startTime before tool execution | — |
| 2 | Execute tool operation | On exception: still calculate duration |
| 3 | Record endTime after completion | — |
| 4 | Calculate: duration_ms = endTime - startTime | If negative (clock skew): set to 0 |
| 5 | Pass duration_ms to AuditRepository.log() | — |

### 6.2 Markdown Export Generation

**Trigger:** GET /sessions/:id/export request
**Input:** Session ID
**Output:** Markdown string

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Fetch session metadata (agent, start, end) | 404 if not found |
| 2 | Fetch all events for session (ordered by created_at ASC) | Empty list → "No events" |
| 3 | Group events by task_id (null task_id → "Ungrouped") | — |
| 4 | For each group: generate markdown section | — |
| 5 | For each event: format as list item with tool, duration, args summary | Truncate args to 200 chars |
| 6 | Concatenate all sections | — |
| 7 | Return as text/markdown response | — |

### 6.3 Task Grouping in Viewer

**Trigger:** Events loaded for a session
**Input:** Array of events with optional task_id
**Output:** Grouped DOM structure

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Sort events by createdAt ASC | Already sorted from API |
| 2 | Iterate events, group consecutive same task_id | — |
| 3 | For each group: create collapsible section | — |
| 4 | Calculate group stats: count, total duration | Handle null duration_ms |
| 5 | Render group header with stats | — |
| 6 | Render event cards within group | — |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Screens/Features |
|------|-------------|-------------------|
| Any local user | Full access | All session replay features |

> Note: Session replay is a local development tool. No authentication required (same as current behavior).

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Tool arguments | Internal | May contain file paths, queries — local only |
| Result summaries | Internal | May contain code snippets — local only |
| Session metadata | Internal | Agent names, timestamps — local only |

### 7.3 Audit Trail

| Event | Logged Fields | Retention | Business Reason |
|-------|--------------|-----------|-----------------|
| All tool operations | operation, arguments, result, duration | Indefinite (SQLite) | Debugging and context resumption |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Event list renders smoothly for 200+ events | No DOM rebuild on step; render < 100ms |
| Performance | API response fast for large sessions | /sessions/:id/events < 200ms for 500 events |
| Storage | Arguments don't bloat database excessively | Max 10KB per arguments field |
| Compatibility | Existing features unaffected | All current viewer functionality preserved |
| Usability | Export useful for AI agents | Markdown < 50KB for typical session |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Session not found | Warning | "Session not found" | Show error in detail panel |
| API unavailable | Critical | "Cannot connect to server" | Show retry button |
| Export fails | Warning | "Export failed: {reason}" | Show error toast, allow retry |
| Empty session | Info | "No events recorded" | Show empty state message |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Log event with all enriched fields | Full arguments + result + duration | All fields persisted in DB | High |
| TC-02 | Log event with null optional fields | Only operation + sessionId | Entry created, new fields null | High |
| TC-03 | Arguments exceeding 10KB | 15KB JSON string | Truncated to 10KB | Medium |
| TC-04 | Session list with duration aggregates | 3 sessions with events | totalDurationMs calculated correctly | High |
| TC-05 | Export session as markdown | Session with 10 events, 2 tasks | Valid markdown with task groups | High |
| TC-06 | Task grouping in viewer | Events with mixed task_ids | Correct visual grouping | High |
| TC-07 | Playback without DOM rebuild | Step through 50 events | No innerHTML rebuild, only highlight update | Medium |
| TC-08 | Duration badge colors | Events with 100ms, 1000ms, 3000ms | Green, yellow, red badges | Medium |
| TC-09 | Keyboard shortcuts | Press Space, ←, → | Play/pause, step back/forward | Low |
| TC-10 | Export with clipboard API | Click export button | Markdown in clipboard | Medium |

---

## 11. Appendix

### State Diagram: Session Lifecycle

![State Diagram](diagrams/state-session-lifecycle.png)

*[Edit in draw.io](diagrams/state-session-lifecycle.drawio)*

### Sequence Diagram: Export Flow

![Sequence Diagram](diagrams/sequence-export.png)

*[Edit in draw.io](diagrams/sequence-export.drawio)*

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Export | [sequence-export.png](diagrams/sequence-export.png) | [sequence-export.drawio](diagrams/sequence-export.drawio) |
| 3 | State — Session Lifecycle | [state-session-lifecycle.png](diagrams/state-session-lifecycle.png) | [state-session-lifecycle.drawio](diagrams/state-session-lifecycle.drawio) |

### Change Log from BRD

- No deviations from BRD. All 6 user stories addressed in functional specifications.
- Added specific API contracts with request/response schemas.
- Added migration SQL for schema changes.
- Added processing logic for duration calculation and export generation.

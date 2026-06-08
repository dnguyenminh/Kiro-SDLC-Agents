# Functional Specification Document (FSD)

## Kiro SDLC Agents — KSA-247: Chat Panel: Restore collapsible tool call UI blocks with icons

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-247 |
| Title | Chat Panel: Restore collapsible tool call UI blocks with icons |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-09 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-247.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-09 | BA Agent | Initiate document from BRD and Jira ticket KSA-247 |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior for restoring collapsible tool call UI blocks in the Chat Panel webview. It covers the rendering lifecycle, persistence strategy, expand/collapse interaction, and category icon mapping that ensures tool call blocks survive streaming, reload, and user interaction.

### 1.2 Scope

- Fix the regression where tool call blocks are wiped during assistant text streaming
- Implement category icon mapping for tool call blocks
- Ensure tool call data persists through panel reload via workspaceState
- Implement expand/collapse interaction showing tool arguments and results

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Tool Call Block | A collapsible UI element in the chat messages area representing a single MCP tool invocation |
| Category Icon | An emoji or SVG icon representing the tool's functional category (search, write, file, etc.) |
| postMessage | VS Code webview ↔ extension host communication mechanism |
| workspaceState | VS Code API for persisting key-value data per workspace |
| MCP | Model Context Protocol — standard for AI tool invocation |
| LangGraph | Agent orchestration engine executing tool calls |
| DOM | Document Object Model — the browser's in-memory representation of the webview HTML |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-247/BRD.md |
| Chat Panel MVP | KSA-210 (prerequisite — provides ChatPanelProvider, message protocol) |
| Chat State Persistence | KSA-240 (prerequisite — provides workspaceState save/restore) |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)
*[Edit in draw.io](diagrams/system-context.drawio)*

The Chat Panel operates as a VS Code webview. External actors and systems:

- **Developer**: Interacts with the Chat Panel — sends messages, clicks tool call blocks to expand/collapse
- **LangGraph Engine**: Orchestrates agent execution, decides when to call tools
- **Extension Host (ChatPanelProvider)**: Bridges between LangGraph and webview, emits tool call events
- **VS Code workspaceState**: Persistence store for chat conversation state including tool call data
- **MCP Tool Servers**: Execute the actual tool operations (file read, search, etc.)

### 2.2 System Architecture

The feature touches two main layers:

1. **Extension Host** (`ChatPanelProvider.ts`): Emits `chat:toolCall` and `chat:toolCallUpdate` messages to the webview. Also persists conversation state including tool call data to `workspaceState`.
2. **Webview** (`chat.js` + `chat.css`): Renders tool call blocks, manages expand/collapse, handles streaming without destroying existing blocks.

Key interaction flow:
- Extension Host → (postMessage) → Webview: tool call events
- Webview → (postMessage) → Extension Host: user actions
- Extension Host → workspaceState: persistence on state change
- workspaceState → Extension Host → Webview: restore on reload

---

## 3. Functional Requirements

### 3.1 Feature: Category Icon Mapping

**Source:** BRD Story 1

#### 3.1.1 Description

Each tool call block displays a category icon (emoji) based on the tool name pattern. This provides instant visual identification of tool type without reading the tool name.

#### 3.1.2 Use Case: UC-1 — Render Tool Call Block with Category Icon

**Use Case ID:** UC-1
**Actor:** Developer (passive — views the block rendered by system)
**Preconditions:** Chat Panel is open, LangGraph is processing a message and invokes an MCP tool
**Postconditions:** A collapsible block with the correct category icon is visible in the messages area

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension Host | Receives tool invocation from LangGraph with tool id, name, args |
| 2 | | Extension Host | Emits `chat:toolCall` message to webview with `{id, name, args, status: "running"}` |
| 3 | | Webview (chat.js) | Receives message, calls `renderToolCall(toolData)` |
| 4 | | Webview | Determines category from tool name using `getToolCategory(name)` |
| 5 | | Webview | Creates DOM element: collapsed block with chevron + category icon + tool name + category chip + spinner |
| 6 | | Webview | Stores reference in `toolCalls` map (id → DOM element) |
| 7 | Developer | | Sees the tool call block appear in the messages area |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Tool name does not match any known category pattern | Use fallback category "TOOL" with wrench icon 🔧 |
| AF-2 | Multiple tool calls arrive simultaneously | Each call renders independently; order preserved by message arrival sequence |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | `chat:toolCall` message missing required fields (id or name) | Log warning to console, do not render block, continue processing other messages |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-1 | Category determined by tool name prefix/pattern matching (see Category Map table) | BRD Story 1 |
| BR-2 | Unknown tool names default to category "TOOL" with fallback icon 🔧 | BRD Story 1 AC-2 |
| BR-3 | Category chip uses CSS class `cat-{category}` for color coding | BRD Story 1 AC-3 |
| BR-4 | Icon appears between chevron and tool name in the header | BRD Story 1 |

**Category Map:**

| Category | Icon | CSS Class | Matching Patterns |
|----------|------|-----------|-------------------|
| SEARCH | 🔍 | cat-search | `mem_search`, `code_search`, `grep`, `find_*`, `grep_search` |
| WRITE | ✏️ | cat-write | `fs_write`, `str_replace`, `stream_write_file` |
| FILE | 📁 | cat-file | `fs_read`, `list_directory`, `glob`, `read_file`, `read_files`, `read_code` |
| AI | 🤖 | cat-ai | `execute_dynamic_tool`, `find_tools` |
| DOC | 📄 | cat-doc | `export_docx`, `embed_images`, `drawio_*` |
| TOOL | 🔧 | cat-tool | (fallback — any unrecognized tool name) |

#### 3.1.4 Data Specifications

**Input Data (chat:toolCall message):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| id | string | Y | Non-empty, unique per conversation | Unique identifier for this tool call |
| name | string | Y | Non-empty | The MCP tool name (e.g., `mem_search`) |
| args | object | N | Valid JSON object | Arguments passed to the tool |
| status | string | Y | One of: "running", "completed", "failed" | Current execution status |

**Output Data (rendered DOM):**

| Field | Type | Description |
|-------|------|-------------|
| DOM element | HTMLDivElement | `.tool-call-block` with `.collapsed` class |
| toolCalls map entry | Map<string, HTMLElement> | Reference stored for later updates |

#### 3.1.5 UI Specifications

**Screen: Tool Call Block (Collapsed State)**

| No. | Element | Type | Required | Behavior | Validation |
|-----|---------|------|----------|----------|------------|
| 1 | Chevron | SVG/CSS arrow | Y | Points right when collapsed, rotates 90° when expanded | CSS transition 200ms |
| 2 | Category Icon | Emoji span | Y | Displays emoji from Category Map | Fallback to 🔧 |
| 3 | Tool Name | Text span | Y | Displays the tool's MCP name | Truncate at 40 chars with ellipsis |
| 4 | Category Chip | Span with bg color | Y | Shows category label (e.g., "SEARCH") in colored chip | CSS class `cat-{category}` |
| 5 | Status Indicator | Spinner/Icon | Y | Animated spinner when running, ✓ when completed, ✗ when failed | — |
| 6 | Duration | Text span | N | Shows execution time (e.g., "1.2s") when completed | Only visible after completion |

---

### 3.2 Feature: Tool Call Block Persistence During Streaming

**Source:** BRD Story 2

#### 3.2.1 Description

When the LLM streams text tokens after tool calls complete, the existing tool call DOM elements must remain intact. The streaming text must be appended as a separate message bubble — never replacing or overwriting the tool call blocks.

#### 3.2.2 Use Case: UC-2 — Stream Text Without Destroying Tool Blocks

**Use Case ID:** UC-2
**Actor:** System (automatic — triggered by streaming events)
**Preconditions:** One or more tool call blocks exist in the messages area; LLM begins streaming text response
**Postconditions:** All tool call blocks remain visible; text response appears as separate bubble below them

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension Host | Emits `chat:streamChunk` with token text |
| 2 | | Webview | Receives stream chunk |
| 3 | | Webview | Checks if current assistant message bubble exists; if not, creates NEW bubble element BELOW tool call blocks |
| 4 | | Webview | Appends token text to the assistant message bubble (NOT to tool call container) |
| 5 | | Webview | Repeats steps 1-4 for each chunk until `chat:streamComplete` |
| 6 | | Webview | On streamComplete, finalizes the message bubble (parse markdown, etc.) |
| 7 | Developer | | Sees tool call blocks + text response all visible |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | No tool calls preceded the stream (normal text response) | Standard text bubble creation — no tool blocks to protect |
| AF-2 | Multiple rounds of tool calls + text in one turn | Each round creates its own set of blocks + bubble; all persist in order |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Stream arrives but messages container is null (panel not ready) | Queue messages until panel ready event fires |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-5 | Tool call DOM elements MUST NOT be removed or overwritten when streaming text arrives | BRD Story 2 |
| BR-6 | Assistant text response MUST be a SEPARATE message bubble below tool call blocks | BRD Story 2 |
| BR-7 | The `toolCalls` in-memory map MUST NOT be cleared during streaming | BRD Story 2 |
| BR-8 | If multiple tool calls precede text, ALL blocks persist in their original order | BRD Story 2 AC-2 |

---

### 3.3 Feature: Tool Call Persistence After Reload

**Source:** BRD Story 3

#### 3.3.1 Description

Tool call data is serialized as part of the chat conversation state and saved to `workspaceState`. On panel reload (hide/show, VS Code restart), the tool call blocks are reconstructed from persisted data.

#### 3.3.2 Use Case: UC-3 — Restore Tool Call Blocks on Panel Reload

**Use Case ID:** UC-3
**Actor:** Developer (triggers by switching panels or restarting VS Code)
**Preconditions:** A conversation with tool calls has been persisted to workspaceState
**Postconditions:** All tool call blocks are restored with full data (status, result, duration) and are interactive

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Reopens Chat Panel (or VS Code restarts) |
| 2 | | Extension Host | Reads conversation state from workspaceState |
| 3 | | Extension Host | Emits `tab:updated` message to webview with all messages including tool call messages |
| 4 | | Webview | Iterates messages, identifies those with `role: "tool"` and `toolData` field |
| 5 | | Webview | For each tool message, calls `renderToolCall(toolData, isReplay=true)` |
| 6 | | Webview | Reconstructs block with persisted status, result, and duration (no spinner for completed) |
| 7 | Developer | | Sees all tool call blocks restored, can expand to see results |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Tool call was still "running" when panel was closed | Restore with status "interrupted" and appropriate icon; do not show spinner |
| AF-2 | workspaceState has no tool call data (older format) | Skip tool call restoration; render text messages only |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Tool call data is corrupted (missing id or name) | Skip that individual block, log warning, continue restoring others |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-9 | Tool call data (id, name, args, status, result, duration) MUST be included in workspaceState | BRD Story 3 |
| BR-10 | Restored blocks must be fully interactive (expand/collapse works) | BRD Story 3 AC-3 |
| BR-11 | `isReplay=true` skips spinner animation — shows final state immediately | BRD Story 3 |

#### 3.3.4 Data Specifications

**Persisted Tool Call Data (in workspaceState):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| id | string | Y | Non-empty | Unique tool call identifier |
| name | string | Y | Non-empty | MCP tool name |
| args | object | N | Valid JSON | Tool arguments (serialized) |
| status | string | Y | "running" / "completed" / "failed" / "interrupted" | Final status at time of persistence |
| result | string | N | — | Tool execution result text |
| duration | number | N | ≥ 0 | Execution duration in milliseconds |
| timestamp | string | N | ISO 8601 | When the tool call occurred |

---

### 3.4 Feature: Expand/Collapse Interaction

**Source:** BRD Story 4

#### 3.4.1 Description

Users can click a tool call block header to toggle its expanded state, revealing tool arguments (while running) or results (when completed/failed).

#### 3.4.2 Use Case: UC-4 — Toggle Tool Call Block Expansion

**Use Case ID:** UC-4
**Actor:** Developer
**Preconditions:** A tool call block is rendered in the messages area
**Postconditions:** Block toggles between collapsed and expanded states

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Clicks on the tool call block header |
| 2 | | Webview | Toggle `expanded` CSS class on the block element |
| 3 | | Webview | If expanding: show body content (args or result) |
| 4 | | Webview | Chevron rotates 90° (CSS transition) |
| 5 | Developer | | Sees the body content |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Developer uses keyboard (Enter/Space on focused block) | Same toggle behavior as click |
| AF-2 | Block is running — expanded shows args; then completes while expanded | Body content updates in-place: args replaced by result |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Block has no args AND no result (edge case) | Show empty body with message "No data available" |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-12 | Clicking header toggles `expanded` class | BRD Story 4 |
| BR-13 | Running tool → body shows JSON.stringify(args, null, 2) | BRD Story 4 |
| BR-14 | Completed tool → body shows result text (replacing args) | BRD Story 4 |
| BR-15 | Failed tool → body shows error message with `.failed` styling | BRD Story 4 |
| BR-16 | Chevron rotates 90° on expand, 0° on collapse (200ms CSS transition) | BRD Story 4 AC-1/AC-2 |
| BR-17 | Tool call blocks are focusable (`tabindex="0"`) and toggle via Enter/Space | BRD NFR |

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

This feature does not introduce persistent database entities. The data model is in-memory (webview DOM + JavaScript state) and ephemeral persistence (workspaceState JSON).

### 4.2 Logical Entities

#### Entity: ToolCallMessage

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | string | Y | BR-9 | Unique tool call identifier |
| role | string | Y | — | Always "tool" for tool call messages |
| name | string | Y | BR-1, BR-2 | MCP tool name |
| args | object | N | BR-13 | Arguments passed to the tool |
| status | enum | Y | — | running / completed / failed / interrupted |
| result | string | N | BR-14 | Tool execution result text |
| error | string | N | BR-15 | Error message if failed |
| duration | number | N | — | Execution time in ms |
| timestamp | string | N | — | ISO 8601 timestamp |
| category | string | N | BR-1 | Resolved category (SEARCH/WRITE/FILE/AI/DOC/TOOL) |

#### Entity: ToolCallUIState (in-memory)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| domElement | HTMLElement | Y | BR-5 | Reference to the rendered DOM block |
| expanded | boolean | Y | BR-12 | Whether the block is currently expanded |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| Conversation | ToolCallMessage | 1:N | A conversation contains zero or more tool call messages |
| ToolCallMessage | ToolCallUIState | 1:1 | Each persisted tool call maps to one UI block (when rendered) |

---

## 5. Integration Specifications

### 5.1 External System: VS Code Extension Host (ChatPanelProvider)

| Attribute | Value |
|-----------|-------|
| Purpose | Bridges LangGraph tool execution events to webview UI |
| Direction | Extension Host → Webview (postMessage) |
| Data Format | JSON (postMessage protocol) |
| Frequency | Real-time, per tool invocation |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Rendered DOM block | `chat:toolCall` message | Receive | Webview renders block on receipt |
| Updated DOM block | `chat:toolCallUpdate` message | Receive | Webview updates status/result |
| Persisted state request | `state:save` message | Send | Webview signals state dirty |

### 5.2 External System: VS Code workspaceState

| Attribute | Value |
|-----------|-------|
| Purpose | Persist conversation state (including tool calls) across sessions |
| Direction | Bidirectional |
| Data Format | JSON (serialized via VS Code API) |
| Frequency | On state change (tool complete, stream complete) + on restore |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| ToolCallMessage[] | workspaceState JSON | Send (save) | BR-9 |
| Restored ToolCallMessage[] | workspaceState JSON | Receive (restore) | BR-10 |

---

## 6. Processing Logic

### 6.1 Tool Call Rendering Process

**Trigger:** `chat:toolCall` message received by webview
**Schedule:** Real-time (event-driven)
**Input:** ToolCall message data (id, name, args, status)
**Output:** Rendered DOM element + toolCalls map entry

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Validate message has `id` and `name` fields | If missing, log warning, skip rendering |
| 2 | Call `getToolCategory(name)` to resolve category and icon | Always returns at least fallback category |
| 3 | Create `.tool-call-block` div with header elements | — |
| 4 | Set `tabindex="0"` for accessibility | — |
| 5 | Attach click event listener for expand/collapse | — |
| 6 | Attach keydown listener for Enter/Space | — |
| 7 | Append to messages container | — |
| 8 | Store in `toolCalls.set(id, element)` | — |

### 6.2 Tool Call Update Process

**Trigger:** `chat:toolCallUpdate` message received by webview
**Input:** Update data (id, status, result, duration)
**Output:** Updated DOM element

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Look up element in `toolCalls` map by id | If not found, log warning, skip |
| 2 | Update status indicator (spinner → ✓ or ✗) | — |
| 3 | If completed: store result, show duration | — |
| 4 | If failed: store error, add `.failed` class | — |
| 5 | If block is expanded: update body content (args → result) | — |

### 6.3 Streaming Protection Process

**Trigger:** `chat:streamChunk` message received after tool calls
**Input:** Token text
**Output:** Text appended to new/existing assistant message bubble (tool blocks untouched)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Check if assistant text bubble exists after tool blocks | — |
| 2 | If not: create new `.message.assistant` div AFTER last tool block | If container null, queue |
| 3 | Append token text to the text bubble element | — |
| 4 | Do NOT modify toolCalls map or tool block elements | — |
| 5 | On `chat:streamComplete`: finalize bubble (markdown parse) | — |

### 6.4 State Persistence Process

**Trigger:** Tool call completes OR stream completes
**Input:** Current conversation messages array (including tool call messages)
**Output:** Serialized state saved to workspaceState

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Serialize all messages including tool call messages with full data | — |
| 2 | Send `state:save` to extension host | If fails, retry once after 1s |
| 3 | Extension host writes to workspaceState API | If quota exceeded, drop oldest conversations |

### 6.5 State Restoration Process

**Trigger:** Panel reload (webview created/restored)
**Input:** `tab:updated` message with persisted messages
**Output:** Fully reconstructed UI with tool call blocks

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Receive `tab:updated` message with messages array | — |
| 2 | Iterate messages in order | — |
| 3 | For `role: "tool"` messages: call `renderToolCall(toolData, isReplay=true)` | Skip corrupted entries (EF-1) |
| 4 | For `role: "assistant"` messages: render text bubble | — |
| 5 | `isReplay=true`: no spinner, show final state (✓/✗), skip animation | — |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Screens/Features |
|------|-------------|-------------------|
| Developer | Full access | Chat Panel — all tool call interactions |

No additional auth required — the Chat Panel inherits VS Code workspace context.

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Tool arguments | Internal | May contain file paths, code snippets — not transmitted externally |
| Tool results | Internal | May contain file content — stored locally in workspaceState only |
| Tool names | Public | MCP tool names are not sensitive |

### 7.3 Audit Trail

No audit trail required for this feature — it is a local UI component with no external data transmission.

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Tool call blocks render instantly | Block appears within 16ms (one animation frame) of event receipt |
| Performance | Expand/collapse is smooth | CSS transition completes in 200ms, no jank |
| Reliability | Zero data loss during streaming | Tool call blocks never wiped by subsequent messages |
| Reliability | Full restoration on reload | 100% of persisted tool calls restored correctly |
| Accessibility | Keyboard navigation | All blocks focusable via Tab, toggle via Enter/Space |
| Accessibility | Screen reader support | Blocks have `role="button"` and `aria-expanded` attribute |
| UX | Visual category identification | Category icons distinguish tool types at a glance |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Tool call block fails to render | Warning | (no visible error — block simply not shown) | Console warning logged; other messages continue rendering |
| Tool execution fails | Info | Tool block shows ✗ icon + "Failed" chip | Block expandable to show error message |
| Restoration fails for one block | Warning | (no visible error — other blocks render) | Skip corrupted block, continue restoration |
| workspaceState quota exceeded | Warning | (no visible error) | Oldest conversations dropped to make room |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Tool execution failed | Developer | In-UI (✗ icon on block) | Immediate |
| State persistence failed | Developer | Console warning (dev tools) | Immediate |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-1 | Render tool call with known category | `chat:toolCall` with name="mem_search" | Block with 🔍 icon, "SEARCH" chip | High |
| TC-2 | Render tool call with unknown category | `chat:toolCall` with name="custom_tool" | Block with 🔧 icon, "TOOL" chip | High |
| TC-3 | Stream text after tool calls | 3 tool calls + stream chunks | 3 blocks + 1 text bubble, all visible | High |
| TC-4 | Expand completed tool block | Click on completed block header | Body shows result text | High |
| TC-5 | Expand running tool block | Click on running block header | Body shows formatted JSON args | Medium |
| TC-6 | Collapse expanded block | Click header of expanded block | Body hidden, chevron rotates back | Medium |
| TC-7 | Persist and restore tool calls | Close panel, reopen | All blocks restored with correct status/result | High |
| TC-8 | Keyboard toggle | Focus block, press Enter | Block toggles expansion | Medium |
| TC-9 | Multiple tools then text, repeated | 2 rounds of (tools + text) | All blocks and text in correct order | High |
| TC-10 | Corrupted tool data on restore | Missing 'name' field in persisted data | Block skipped, others render fine | Low |

---

## 11. Appendix

### State Machine: Tool Call Block Lifecycle

![State - Tool Call Block](diagrams/state-tool-call-block.png)
*[Edit in draw.io](diagrams/state-tool-call-block.drawio)*

**States:**

| State | Description | Visual |
|-------|-------------|--------|
| Rendering | Initial creation of DOM element | — |
| Running (Collapsed) | Tool executing, block collapsed | Spinner + collapsed |
| Running (Expanded) | Tool executing, block expanded showing args | Spinner + args visible |
| Completed (Collapsed) | Tool finished, block collapsed | ✓ + duration shown |
| Completed (Expanded) | Tool finished, block expanded showing result | ✓ + result visible |
| Failed (Collapsed) | Tool errored, block collapsed | ✗ + failed styling |
| Failed (Expanded) | Tool errored, block expanded showing error | ✗ + error visible |
| Persisted | Saved to workspaceState | (not visible — stored) |
| Restored | Reconstructed from persisted data | Same as Completed/Failed |

### Sequence Diagrams

![Sequence - Tool Call Lifecycle](diagrams/sequence-tool-call-lifecycle.png)
*[Edit in draw.io](diagrams/sequence-tool-call-lifecycle.drawio)*

![Sequence - Streaming Protection](diagrams/sequence-streaming-protection.png)
*[Edit in draw.io](diagrams/sequence-streaming-protection.drawio)*

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | State - Tool Call Block | [state-tool-call-block.png](diagrams/state-tool-call-block.png) | [state-tool-call-block.drawio](diagrams/state-tool-call-block.drawio) |
| 3 | Sequence - Tool Call Lifecycle | [sequence-tool-call-lifecycle.png](diagrams/sequence-tool-call-lifecycle.png) | [sequence-tool-call-lifecycle.drawio](diagrams/sequence-tool-call-lifecycle.drawio) |
| 4 | Sequence - Streaming Protection | [sequence-streaming-protection.png](diagrams/sequence-streaming-protection.png) | [sequence-streaming-protection.drawio](diagrams/sequence-streaming-protection.drawio) |

### Change Log from BRD

- No deviations from BRD. All 4 User Stories are covered in full with detailed use cases.
- Added explicit state machine for tool call block lifecycle (not in BRD but implied by the business flow).
- Added "interrupted" status for tool calls that were running when panel was closed (edge case clarification).

---

## 12. TA Enrichment — Technical Review & Additions

*Added by: TA Agent | Date: 2026-06-09 | Version: 1.1*

### 12.1 Discrepancies: FSD vs Actual Codebase

| # | FSD States | Actual Code | Impact | Resolution |
|---|-----------|-------------|--------|------------|
| 1 | Category icons are emojis (🔍 ✏️ 📁 🤖 📄 🔧) | Icons are text chars (`>_`, `[]`, `?`, `m`, `J`, `D`, `T`) | UI Spec incorrect | **Decision needed** before Phase 5 |
| 2 | Categories: SEARCH, WRITE, FILE, AI, DOC, TOOL | Categories: CMD, FILE, SEARCH, MEM, JIRA, DOC, TOOL | Category map mismatch | Align FSD with code or update code |
| 3 | Function named `getToolCategory(name)` | Function named `categorizeTool(name)` returning `{icon, label, cls}` | Naming discrepancy | FSD uses code's naming |
| 4 | `tabindex="0"` + keyboard listeners (Enter/Space) | Not implemented in current code | Accessibility gap | **Must implement** (BRD NFR) |
| 5 | `state:save` message type | Actual: `chat:saveState` message type | Integration spec wrong | FSD corrected below |
| 6 | Body content swap on completion (in-place) | `updateToolCall()` replaces body.textContent | Incomplete impl | Accept current behavior |
| 7 | Persisted status "interrupted" for running tools | No interrupt logic exists — saves raw status | Edge case unhandled | Implement in Phase 5 |

### 12.2 API Contracts (postMessage Protocol)

#### 12.2.1 Extension → Webview: `chat:toolCall`

```typescript
interface ToolCallDisplay {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  status: "running" | "completed" | "failed";
  result?: string;
  duration?: number;
}
// Message shape:
{ type: "chat:toolCall"; toolCall: ToolCallDisplay }
```

#### 12.2.2 Extension → Webview: `chat:toolCallUpdate`

```typescript
{ type: "chat:toolCallUpdate"; id: string; status: "completed" | "failed"; result?: string; duration?: number }
```

#### 12.2.3 Extension → Webview: `chat:streamChunk`

```typescript
{ type: "chat:streamChunk"; streamId: string; nodeId: string; eventType: "token" | "status" | "error"; content: string; timestamp: string }
```

#### 12.2.4 Webview → Extension: `chat:saveState` (corrected from `state:save`)

```typescript
{ type: "chat:saveState"; payload: { tabs: TabState[]; activeTabId: string } }
```

### 12.3 Pseudocode — Core Functions

#### `categorizeTool(name)` — Actual Implementation

```javascript
function categorizeTool(name) {
  var n = (name || "").toLowerCase();
  if (n.indexOf("pwsh") !== -1 || n.indexOf("shell") !== -1 || 
      n.indexOf("execute") !== -1 || n.indexOf("command") !== -1)
    return { icon: ">_", label: "CMD", cls: "cat-command" };
  if (n.indexOf("read") !== -1 || n.indexOf("write") !== -1 || 
      n.indexOf("file") !== -1 || n.indexOf("list") !== -1 || 
      n.indexOf("directory") !== -1)
    return { icon: "[]", label: "FILE", cls: "cat-file" };
  if (n.indexOf("search") !== -1 || n.indexOf("grep") !== -1 || 
      n.indexOf("find") !== -1 || n.indexOf("code_") !== -1)
    return { icon: "?", label: "SEARCH", cls: "cat-search" };
  if (n.indexOf("mem_") !== -1 || n.indexOf("kb_") !== -1)
    return { icon: "m", label: "MEM", cls: "cat-memory" };
  if (n.indexOf("jira") !== -1 || n.indexOf("issue") !== -1)
    return { icon: "J", label: "JIRA", cls: "cat-jira" };
  if (n.indexOf("drawio") !== -1 || n.indexOf("export") !== -1 || 
      n.indexOf("docx") !== -1)
    return { icon: "D", label: "DOC", cls: "cat-doc" };
  return { icon: "T", label: "TOOL", cls: "cat-tool" };
}
```

#### Streaming Protection Mechanism

```javascript
// Tool blocks: toolCalls map. Stream bubbles: streamingNodes map.
// SEPARATE tracking = no collision.
function handleStreamChunk(msg) {
  if (msg.eventType === "status") { setWorking(true, label); return; }
  if (!msg.content.trim()) return;
  if (!streamingNodes[msg.nodeId]) {
    var el = createElement("div", { class: "message assistant streaming" });
    messagesEl.appendChild(el); // AFTER tool blocks — never replaces
    streamingNodes[msg.nodeId] = { el, content: "" };
  }
  streamingNodes[msg.nodeId].content += msg.content;
}
```

### 12.4 Open Issues

| # | Issue | Impact | Resolution |
|---|-------|--------|------------|
| OI-1 | Category Map Mismatch: emoji (BRD) vs text chars (code) | UI spec inconsistency | Decision needed before Phase 5 |
| OI-2 | Missing Accessibility: tabindex, aria, keyboard | Non-compliance | Must implement |
| OI-3 | "interrupted" status not implemented | Stale spinner on restore | Implement interrupt detection |
| OI-4 | categorizeTool priority: `file_search` → FILE not SEARCH | Unexpected categorization | Consider explicit map |
| OI-5 | workspaceState quota: no eviction | Potential data loss | Implement LRU |
| OI-6 | Duration span duplication on repeated updates | Visual bug | Guard against duplicate |

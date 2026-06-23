# Business Requirements Document (BRD)

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
| 1.0 | 2026-06-09 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-247 |

---

## 1. Introduction

### 1.1 Scope

This change request addresses a regression in the Chat Panel's tool call UI blocks. Currently, collapsible tool call blocks render correctly during execution (showing tool name, category icon, status spinner), but their text content is wiped when the streaming response arrives. The goal is to restore full persistence of tool call blocks so they survive streaming, reload, and expansion interactions.

### 1.2 Out of Scope

- Changes to the LangGraph engine or tool execution logic
- New tool call categories or icons beyond existing ones
- Tool call result formatting/syntax highlighting (future enhancement)
- Chat Panel layout/styling overhaul unrelated to tool blocks

### 1.3 Preliminary Requirement

- KSA-210: Chat Panel MVP (already implemented — provides ChatPanelProvider, message protocol, basic tool call rendering)
- KSA-240: Chat State Persistence (already implemented — provides tab persistence via workspaceState)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Chat Panel acts as a full AI agent interface. When the LLM invokes MCP tools during a conversation, the UI renders collapsible blocks showing each tool call's name, arguments, status, and result. These blocks must persist throughout the conversation lifecycle (streaming, tab switch, panel reload).

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want tool call blocks to display category icons so I can quickly identify the type of tool being called | MUST HAVE | KSA-247 |
| 2 | As a developer, I want tool call blocks to persist after the streaming response completes so I can review what tools were called | MUST HAVE | KSA-247 |
| 3 | As a developer, I want tool call blocks to persist after panel reload so I don't lose context when switching views | MUST HAVE | KSA-247 |
| 4 | As a developer, I want to expand tool call blocks to see arguments and results so I can debug agent behavior | MUST HAVE | KSA-247 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User sends a message in the Chat Panel

**Step 2:** LangGraph engine processes the message, decides to call one or more MCP tools

**Step 3:** Extension host emits `chat:toolCall` message to webview with tool metadata (id, name, args, status=running)

**Step 4:** Webview renders a collapsible tool call block with category icon, tool name, and spinning status indicator

**Step 5:** Tool execution completes; extension host emits `chat:toolCallUpdate` with status=completed, result, and duration

**Step 6:** Webview updates the block: status icon changes to checkmark, duration shown, body contains result

**Step 7:** LLM generates text response; extension host emits `chat:streamChunk` tokens

**Step 8:** Webview appends streaming text to messages area — tool call blocks MUST NOT be wiped/overwritten

**Step 9:** Stream completes; conversation state (including tool call blocks) is persisted to workspaceState

**Step 10:** On panel reload, persisted tool call blocks are restored with their full state

> **Note:** The bug occurs at Step 8 — when streaming text arrives, the DOM manipulation that appends assistant text content inadvertently clears or overwrites the tool call block elements.

---

#### STORY 1: Collapsible blocks with category icons

> As a developer, I want tool call blocks to display category icons so I can quickly identify the type of tool being called.

**Requirement Details:**

1. Each tool call block MUST display an icon/emoji representing the tool's category
2. Tool categories are determined by tool name prefix/pattern matching:
   - Search/Read: mem_search, code_search, grep, find_*
   - Write/Edit: fs_write, str_replace, stream_write_file
   - File ops: fs_read, list_directory, glob
   - AI/LLM: execute_dynamic_tool, find_tools
   - Document: export_docx, embed_images, drawio_*
   - Tool (fallback): any unrecognized tool name
3. The category icon appears between the chevron and the tool name
4. A short category label (e.g., "SEARCH", "WRITE", "FILE") in a colored chip follows the tool name

**Acceptance Criteria:**

1. GIVEN a tool call event arrives, WHEN the block renders, THEN the correct category icon is displayed based on tool name
2. GIVEN an unknown tool name, WHEN the block renders, THEN the fallback icon is used
3. GIVEN a category label chip, WHEN displayed, THEN it uses the appropriate CSS class for color coding (cat-search, cat-write, cat-file, cat-ai, cat-doc, cat-tool)

---

#### STORY 2: Persist after response

> As a developer, I want tool call blocks to persist after the streaming response completes so I can review what tools were called.

**Requirement Details:**

1. When the LLM streams text tokens after tool calls, tool call DOM elements MUST remain in the message container
2. The assistant's text response MUST be appended as a SEPARATE message bubble below the tool call blocks — NOT replacing them
3. If multiple tool calls occur before a text response, ALL blocks persist in order
4. The toolCalls object (in-memory map of id to DOM element) MUST NOT be cleared during streaming

**Acceptance Criteria:**

1. GIVEN tool call blocks exist in messages area, WHEN chat:streamChunk arrives, THEN all existing tool call blocks remain visible and unchanged
2. GIVEN 3 tool calls followed by text response, WHEN stream completes, THEN 3 tool call blocks + 1 text message are all visible
3. GIVEN tool call blocks exist, WHEN chat:streamComplete fires, THEN tool call blocks retain their status, result, and duration data

---

#### STORY 3: Persist after reload

> As a developer, I want tool call blocks to persist after panel reload so I don't lose context when switching views.

**Requirement Details:**

1. Tool call data (id, name, args, status, result, duration) MUST be included in the chat state saved to workspaceState
2. On panel reload/restore, the tab:updated message MUST include tool call messages with role="tool" and toolData field
3. The renderToolCall(toolData, isReplay=true) function correctly reconstructs the block from persisted data
4. Blocks restored from persistence are fully interactive (expand/collapse works)

**Acceptance Criteria:**

1. GIVEN a conversation with tool calls, WHEN the panel is hidden and re-shown, THEN all tool call blocks reappear with correct data
2. GIVEN a conversation with completed tool calls, WHEN VS Code is restarted, THEN tool call blocks are restored from workspaceState
3. GIVEN a restored tool call block, WHEN user clicks it, THEN it expands to show args and result

---

#### STORY 4: Expand shows args and result

> As a developer, I want to expand tool call blocks to see arguments and results so I can debug agent behavior.

**Requirement Details:**

1. Each tool call block is collapsible: header always visible, body hidden by default
2. Clicking the header toggles the expanded CSS class on the block
3. When expanded, the body shows:
   - For running tools: the JSON-stringified arguments
   - For completed tools: the tool result text (replacing args)
   - For failed tools: the error message
4. A chevron indicator (collapsed arrow, rotated 90deg when expanded) in the header signals state

**Acceptance Criteria:**

1. GIVEN a collapsed tool call block, WHEN user clicks the header, THEN the block expands showing the body content
2. GIVEN an expanded block, WHEN user clicks the header again, THEN it collapses (body hidden)
3. GIVEN a running tool, WHEN expanded, THEN args are shown as formatted JSON
4. GIVEN a completed tool, WHEN expanded, THEN the result text is shown
5. GIVEN a failed tool, WHEN expanded, THEN the error message is shown with failed styling

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Chat Panel MVP | System | KSA-210 | ChatPanelProvider, message protocol, basic rendering |
| Chat State Persistence | System | KSA-240 | workspaceState save/restore for tabs and messages |
| Stream Handler | System | KSA-210 | emitDirect for toolCall messages, token buffering |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter | Duc Nguyen Minh | Define requirements, accept deliverable | Jira reporter |
| Developer | Unassigned | Implement the fix | Jira assignee |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| DOM manipulation in streaming path may have side effects on other UI elements | Medium | Low | Targeted fix only to tool call persistence, comprehensive E2E tests |
| Large number of tool calls may degrade scroll performance | Low | Low | Existing virtual scrolling handles this; no change needed |

### 5.2 Assumptions

- The chat:toolCall and chat:toolCallUpdate events from the extension host are already correct and contain all necessary data
- The issue is purely in the webview rendering logic (chat.js), not in the extension host
- The CSS for tool call blocks (chat.css) is correct and does not need changes
- The persistence mechanism (KSA-240) already supports saving tool call data in messages

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Tool call blocks render within 16ms (one frame) | No visible lag when tool call event arrives |
| Reliability | Zero data loss on streaming | Tool call data must never be wiped by subsequent messages |
| UX | Smooth expand/collapse animation | CSS transition on chevron rotation (200ms) |
| Accessibility | Keyboard navigation | Tool call blocks should be focusable and toggle-able via Enter/Space |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-247 | Chat Panel: Restore collapsible tool call UI blocks with icons | In Progress | Task | Main ticket |
| KSA-210 | Chat Panel MVP | Done | Story | Parent feature |
| KSA-240 | Chat State Persistence | Done | Task | Prerequisite (persistence framework) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Tool Call Block | A collapsible UI element in the chat messages area representing a single MCP tool invocation |
| Category Icon | An emoji or SVG icon representing the tool's functional category (search, write, file, etc.) |
| postMessage | VS Code webview to extension host communication mechanism |
| workspaceState | VS Code API for persisting key-value data per-workspace |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

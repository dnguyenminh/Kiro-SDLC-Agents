# Business Requirements Document (BRD)

## Kiro SDLC Agents — KSA-249: Developer Experience: Steering Optimization + Context Usage Graph + Full Hook System

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-249 |
| Title | Developer Experience: Steering Optimization + Context Usage Graph + Full Hook System |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-249.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Reviewer | TA Agent – Technical Analyst | Technical review |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | BA Agent | Initiate document — complete scope: 3 requirements (Steering Optimization, Context Usage Graph UI, Full Hook System) |

---

## 1. Introduction

### 1.1 Scope

This ticket encompasses three Developer Experience improvements for the `kiro-sdlc-agents` VS Code extension:

**Requirement 1 — Steering Rules Optimization (DONE)**
- 18 steering files changed from always-load to `inclusion: manual`
- Only `concise-responses.md` and `sm-default-agent.md` remain always-included
- Result: context window usage reduced significantly
- Status: Code already committed, no further implementation needed

**Requirement 2 — Context Usage Graph UI (NEW)**
- Implement Kiro-style context usage indicator in chat panel extension
- Show breakdown: Conversation %, MCP tools %, Steering files %, Total %
- Visual bar chart with color-coded segments (thresholds: safe/warning/critical/full)
- Collapsible panel, auto-updates after each message exchange

**Requirement 3 — Full Hook System (NEW)**
- Implement ALL 10 Kiro hook event types in our extension (`kiro-sdlc-agents`)
- Currently 6/10 types work via Kiro native; need 4 more in our extension `hook-loader.ts`:
  - `userTriggered` — manual hook invocation by user
  - `postToolUse` — fires after MCP tool calls with filtering by tool categories/regex
  - `preTaskExecution` — fires before LangGraph task/node execution
  - `postTaskExecution` — fires after LangGraph task/node execution
- Implement complete constraint system:
  - `preToolUse` access denial → FORBIDDEN retry
  - `preToolUse` exact parameter retry (if not denied)
  - `preToolUse` circular dependency detection (top-level honored, nested skipped)
  - `postToolUse` filtering by tool categories/regex
  - `runCommand` timeout (default 60s)
- Schema validation: `name`, `version`, `when.type`, `then.type` required fields

### 1.2 Out of Scope

- Changes to the LLM engine's actual token counting logic (Context Usage Graph only visualizes)
- Real-time streaming token count during LLM generation
- Integration with external analytics/monitoring systems
- Changes to the existing context-usage-icon donut in the header
- Hooks that require Kiro IDE kernel (6 types already handled by Kiro native)
- Changes to existing hook file format (`.json` and `.kiro.hook` stay as-is)

### 1.3 Preliminary Requirements

- KSA-240 (Tab System + Context Usage Icon) — Done
- KSA-210 (Chat Panel Foundation) — Done
- KSA-230 (Kiro-style UI) — Done
- KSA-242 (Hook Loader base implementation) — Done
- `tab:contextUpdate` message protocol — exists in `message-protocol.ts`
- Hook infrastructure: `hook-loader.ts` already has type definitions and file loading

---

## 2. Business Requirements

### 2.1 High Level Process Map

The feature improves developer experience in two active areas:

**Context Usage Graph:** Developers using the chat panel can see exactly what's consuming their context window. The panel shows breakdown by category so developers can decide when to start a new tab or reduce steering file load.

**Full Hook System:** Developers define automation hooks in `.kiro/hooks/` directory. Currently only 6 event types fire via Kiro native. After this feature, all 10 types will fire — either via Kiro native OR our extension's hook-loader. This enables full automation: pre/post task hooks for pipeline orchestration, manual triggers for developer workflows, and post-tool monitoring.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Requirement |
|---|------------------|----------|-------------|
| 1 | Context Usage Breakdown Display | MUST HAVE | Req 2 |
| 2 | Visual Bar Chart with Color-Coded Thresholds | MUST HAVE | Req 2 |
| 3 | Collapsible Context Usage Panel | SHOULD HAVE | Req 2 |
| 4 | Auto-Updating Context Usage | MUST HAVE | Req 2 |
| 5 | userTriggered Hook Event | MUST HAVE | Req 3 |
| 6 | postToolUse Hook Event with Filtering | MUST HAVE | Req 3 |
| 7 | preTaskExecution Hook Event | MUST HAVE | Req 3 |
| 8 | postTaskExecution Hook Event | MUST HAVE | Req 3 |
| 9 | preToolUse Access Denial Constraint | MUST HAVE | Req 3 |
| 10 | preToolUse Exact Parameter Retry | SHOULD HAVE | Req 3 |
| 11 | Circular Dependency Detection | MUST HAVE | Req 3 |
| 12 | runCommand Timeout | MUST HAVE | Req 3 |
| 13 | Hook Schema Validation | MUST HAVE | Req 3 |

---

### 2.3 Details of User Stories

---

#### Business Flow — Context Usage Graph

**Step 1:** User opens Chat Panel sidebar in VS Code
**Step 2:** Extension loads steering files, initializes LangGraph engine
**Step 3:** Extension sends `chat:contextUsage` message to webview with initial breakdown
**Step 4:** User sends message — engine processes — tokens consumed
**Step 5:** After response completes, extension calculates token breakdown by category
**Step 6:** Extension sends updated `chat:contextUsage` message to webview
**Step 7:** Webview renders Context Usage Graph panel with updated percentages and bars
**Step 8:** User can expand/collapse the graph panel
**Step 9:** When total usage crosses threshold (60%, 80%, 95%), colors change and panel may auto-expand

#### Business Flow — Hook System

**Step 1:** Developer creates hook file in `.kiro/hooks/` (JSON or `.kiro.hook`)
**Step 2:** Extension loads hooks on startup via `hook-loader.ts`
**Step 3:** During pipeline execution, events fire at appropriate points:
- `preTaskExecution` fires before LangGraph node runs
- `postTaskExecution` fires after LangGraph node completes
- `postToolUse` fires after MCP tool call returns result
- `userTriggered` fires when user manually invokes a hook
**Step 4:** For each matching hook, extension executes the `then` action:
- `askAgent` injects prompt into current agent context
- `runCommand` executes shell command (with timeout)
**Step 5:** Constraint system enforces:
- If `preToolUse` hook returns denial → tool call FORBIDDEN, no retry
- If `preToolUse` hook returns modified params → retry with exact params
- Circular dependency detection prevents infinite hook chains

---

#### STORY 1: Context Usage Breakdown Display

> As a developer, I want to see a detailed breakdown of my context window usage so that I can understand what's consuming tokens

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| conversationTokens | number | Yes | Tokens from user + assistant messages | 45000 |
| mcpToolsTokens | number | Yes | Tokens from MCP tool results | 12000 |
| steeringTokens | number | Yes | Tokens from steering files | 3000 |
| totalTokens | number | Yes | Total tokens used | 60000 |
| maxTokens | number | Yes | Max context window size | 128000 |

**Acceptance Criteria:**

1. Context Usage panel visible in chat panel below messages area
2. Shows 3 category bars: Conversation, MCP Tools, Steering Files
3. Shows Total usage bar (sum of all categories)
4. Each bar displays: category label, token count (formatted with commas), percentage
5. Percentages calculated against `maxTokens` (128,000 default)
6. Panel renders correctly in light, dark, and high-contrast VS Code themes

---

#### STORY 2: Visual Bar Chart with Color-Coded Thresholds

> As a developer, I want color-coded percentage bars so that I can quickly identify threshold status

**Threshold Colors (Total bar only):**

| Range | Color | Meaning |
|-------|-------|---------|
| 0-59% | Green `#4CAF50` | Safe |
| 60-79% | Amber `#FFC107` | Warning |
| 80-94% | Red `#F44336` | Critical |
| 95-100% | Red `#F44336` + pulse animation | Full |

**Category Bar Colors (non-threshold):**

| Category | Color |
|----------|-------|
| Conversation | Blue `#2196F3` |
| MCP Tools | Purple `#9C27B0` |
| Steering Files | Teal `#009688` |

**Acceptance Criteria:**

1. Bars fill proportionally to percentage
2. Total bar color transitions at threshold boundaries
3. Smooth CSS transition on bar width changes
4. Accessible: `aria-valuenow`, `aria-valuemin`, `aria-valuemax` attributes
5. Works with VS Code high-contrast themes (CSS variables with fallbacks)
6. Pulse animation on Total bar at >=95%

---

#### STORY 3: Collapsible Context Usage Panel

> As a developer, I want the panel collapsible so it doesn't take space when not needed

**Acceptance Criteria:**

1. Clickable header toggles expand/collapse
2. Collapsed: shows "Context: 47% used" (compact one-liner)
3. Expanded: shows all category bars + total bar
4. Smooth expand/collapse CSS animation
5. State persists within session (tab switches don't reset)
6. Auto-expands once when crossing 80% threshold

---

#### STORY 4: Auto-Updating Context Usage

> As a developer, I want the usage graph to update automatically without refresh

**Acceptance Criteria:**

1. Bars update within 500ms after message exchange completes
2. Tab switching shows correct per-tab usage
3. Smooth CSS transitions (no flickering)
4. Steering file load/unload triggers update
5. MCP tool call completion triggers update

---

#### STORY 5: userTriggered Hook Event

> As a developer, I want to manually trigger hooks so I can run automation on demand

**Hook Definition Example:**
```json
{
  "name": "Run Code Audit",
  "version": "1",
  "when": { "type": "userTriggered" },
  "then": {
    "type": "runCommand",
    "command": "npx eslint src/ --fix"
  }
}
```

**Acceptance Criteria:**

1. Extension registers VS Code command for each `userTriggered` hook
2. Hooks appear in Command Palette with hook name as label
3. Executing command fires the hook's `then` action
4. Both `askAgent` and `runCommand` action types supported
5. Hook must have `enabled: true` to appear in palette
6. Hook list refreshes when files in `.kiro/hooks/` change

---

#### STORY 6: postToolUse Hook Event with Filtering

> As a developer, I want hooks to fire after tool calls so I can audit/log/transform results

**Hook Definition Example:**
```json
{
  "name": "Log Write Operations",
  "version": "1",
  "when": {
    "type": "postToolUse",
    "toolTypes": ["write"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "A write operation just completed. Log the file path and summary to KB."
  }
}
```

**Acceptance Criteria:**

1. Hook fires after MCP tool call returns result
2. `toolTypes` filtering works with categories: `read`, `write`, `shell`, `web`, `spec`, `*`
3. `toolTypes` filtering works with regex patterns for specific tool names
4. Hook receives tool call context: tool name, arguments, result summary
5. Multiple matching hooks fire in order of file load sequence
6. Hook action has access to tool result data

---

#### STORY 7: preTaskExecution Hook Event

> As a developer, I want hooks to fire before pipeline tasks so I can gate or prepare

**Hook Definition Example:**
```json
{
  "name": "Pre-Agent Context Injection",
  "version": "1",
  "when": { "type": "preTaskExecution" },
  "then": {
    "type": "askAgent",
    "prompt": "Before this task executes, search KB for relevant context."
  }
}
```

**Acceptance Criteria:**

1. Hook fires before LangGraph node execution begins
2. `askAgent` prompt injected into agent context before task runs
3. `runCommand` executes and completes before task starts
4. If hook action fails, task still executes (non-blocking by default)
5. Hook has access to task metadata: node name, input state

---

#### STORY 8: postTaskExecution Hook Event

> As a developer, I want hooks to fire after pipeline tasks so I can audit results

**Hook Definition Example:**
```json
{
  "name": "Post-Agent KB Ingest",
  "version": "1",
  "when": { "type": "postTaskExecution" },
  "then": {
    "type": "askAgent",
    "prompt": "Task completed. Ingest summary into KB."
  }
}
```

**Acceptance Criteria:**

1. Hook fires after LangGraph node completes
2. Hook has access to task output/result
3. Multiple matching hooks fire in sequence
4. Hook failure does not affect pipeline continuation
5. Timing: fires before control passes to next node

---

#### STORY 9: preToolUse Access Denial Constraint

> As a developer, I want preToolUse hooks to DENY tool access for security

**Acceptance Criteria:**

1. `preToolUse` hook can signal denial via "FORBIDDEN" or "DENY" response pattern
2. When denied, tool call is NOT executed
3. Agent receives clear error: "Tool access denied by hook: {hook_name}"
4. Agent does NOT retry the same tool call after denial
5. Denial is logged for audit trail

---

#### STORY 10: preToolUse Exact Parameter Retry

> As a developer, I want preToolUse hooks to modify tool parameters before execution

**Acceptance Criteria:**

1. Hook response can include modified parameters in structured format
2. Modified parameters replace original parameters exactly
3. Tool executes with modified parameters (not re-interpreted by LLM)
4. If hook does not modify params, original params pass through unchanged
5. Only one parameter modification pass (no recursive modification)

---

#### STORY 11: Circular Dependency Detection

> As a developer, I want the system to detect and prevent infinite hook chains

**Acceptance Criteria:**

1. System tracks hook execution stack (which hooks are currently executing)
2. If a hook would re-trigger an already-executing hook, it is skipped
3. Top-level (first) invocation always executes
4. Skipped hooks logged with warning: "Circular dependency detected: {hook_name} skipped"
5. Maximum nesting depth: 3 levels (configurable)

---

#### STORY 12: runCommand Timeout

> As a developer, I want runCommand hooks to have a timeout so they don't hang

**Acceptance Criteria:**

1. Default timeout: 60 seconds for all `runCommand` actions
2. Timeout configurable per hook (optional `timeout` field in ms)
3. When timeout exceeded, child process killed (SIGTERM then SIGKILL)
4. Hook marked as "timed_out" in execution log
5. Pipeline continues after timeout (non-blocking)

---

#### STORY 13: Hook Schema Validation

> As a developer, I want invalid hook files to be reported clearly

**Required Fields:**
- `name` (string)
- `version` (string)
- `when.type` (one of 10 valid event types)
- `then.type` (one of: "askAgent", "runCommand")

**Acceptance Criteria:**

1. Missing required fields → hook skipped with error in output channel
2. Invalid `when.type` → hook skipped with list of valid types
3. `askAgent` without `prompt` → error
4. `runCommand` without `command` → error
5. Malformed JSON → hook skipped with parse error location
6. Validation errors visible in "Kiro SDLC" output channel
7. Valid hooks load even if other hooks are invalid

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| KSA-240 Tab System | System | KSA-240 | Tab state, context icon, `tab:contextUpdate` |
| KSA-210 Chat Panel | System | KSA-210 | Base chat panel webview |
| KSA-230 Kiro-style UI | System | KSA-230 | Design system, CSS variables |
| KSA-242 Hook Loader | System | KSA-242 | Base hook loading infrastructure |
| LangGraph Engine | System | N/A | Token counting, task execution lifecycle |
| Message Protocol | System | N/A | `message-protocol.ts` webview messages |
| MCP Tool System | System | N/A | Tool call interception for pre/postToolUse |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Developer | Engineering Team | Implementation |
| Product Owner | Project Lead | Approval, UAT |
| QA | QA Agent | Test planning and execution |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Token counting inaccuracy | Medium | Medium | Best-effort estimation; tooltip disclaimer |
| Performance from frequent DOM updates | Low | Low | requestAnimationFrame, debounce |
| Infinite hook chains | High | Medium | Circular dependency detection + max depth |
| runCommand security (arbitrary shell) | High | Low | Workspace trust model; user-defined only |
| preToolUse denial UX confusion | Medium | Medium | Clear error messages + audit log |
| Hook latency slowing pipeline | Medium | Medium | Async execution, timeout enforcement |

### 5.2 Assumptions

- LangGraph engine can provide per-category token breakdown
- Token counting +/-5% accuracy is acceptable
- `tab:contextUpdate` message can be extended without breaking compatibility
- Hook-loader can intercept LangGraph node lifecycle events
- Extension has access to MCP tool call results for `postToolUse`
- Users trust their own hook files (workspace-level security model)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Panel update < 16ms | CSS transitions, requestAnimationFrame |
| Performance | Hook execution overhead < 100ms | Async processing, non-blocking |
| Accessibility | WCAG 2.1 AA | aria roles, color not sole indicator |
| Theme Support | All VS Code themes | CSS variables: light, dark, high-contrast |
| Reliability | Hook failures don't crash pipeline | Try-catch, graceful degradation |
| Security | runCommand respects workspace trust | Only execute in trusted workspaces |
| Timeout | runCommand default 60s | Configurable, kill on exceed |
| Logging | All hook events logged | Output channel: "Kiro SDLC" |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Relationship |
|------------|---------|--------|--------------|
| KSA-249 | Developer Experience: Steering + Context Graph + Hooks | To Do | Main ticket |
| KSA-240 | Chat Panel Tab System + Context Usage Icon | Done | Prerequisite |
| KSA-242 | Hook Loader Base Implementation | Done | Prerequisite |
| KSA-210 | Chat Panel Foundation | Done | Prerequisite |
| KSA-230 | Kiro-style UI Enhancements | Done | Prerequisite |

---

## 8. Appendix

### Technical Context

**Context Usage Graph UI:**
- Webview assets: `kiro-sdlc-agents/resources/webview-assets/chat/`
- Main JS: `chat.js` (existing context-usage-icon logic)
- Main CSS: `chat.css` (existing `.context-usage-icon` styles)
- Message protocol: `src/chat-panel/message-protocol.ts`
- Extension provider: `src/chat-panel/chat-panel-provider.ts`

**Hook System:**
- Hook loader: `kiro-sdlc-agents/src/langgraph/hook-loader.ts`
- Hook files: `.kiro/hooks/*.json` and `.kiro/hooks/*.kiro.hook`
- Existing types in loader: all 10 type definitions exist, but only 6 fire via Kiro native
- Need implementation in our extension: `userTriggered`, `postToolUse`, `preTaskExecution`, `postTaskExecution`

**Existing Hook Examples (14 hooks in `.kiro/hooks/`):**
- `stream-user-prompt.kiro.hook` — promptSubmit → askAgent (log to KB)
- `validate-drawio-edit.kiro.hook` — fileEdited → askAgent (validate XML)
- `drawio-kb-lookup.kiro.hook` — preToolUse [write] → askAgent (search KB)
- `code-index-create.json` — fileCreated → runCommand (incremental indexer)

### Glossary

| Term | Definition |
|------|------------|
| Context Window | Max tokens an LLM can process in a single interaction |
| Steering Files | `.kiro/steering/*.md` providing persistent instructions |
| MCP Tools | Model Context Protocol tools for external capabilities |
| Hook | Automation rule firing on specific events |
| LangGraph | Pipeline orchestration framework for multi-agent workflows |
| preToolUse | Event before tool call (can deny or modify) |
| postToolUse | Event after tool returns result |
| userTriggered | Event fired by explicit user action |
| FORBIDDEN | Denial signal preventing tool execution with no retry |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

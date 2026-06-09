# Functional Specification Document (FSD)

## Kiro SDLC Agents — KSA-249: Developer Experience: Steering Optimization + Context Usage Graph + Full Hook System

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-249 |
| Title | Developer Experience: Steering Optimization + Context Usage Graph + Full Hook System |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-249.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | BA + TA | Initial FSD — full specification for Context Usage Graph UI + Full Hook System |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of two features:
1. **Context Usage Graph UI** — visual breakdown of context window usage in the chat panel
2. **Full Hook System** — complete implementation of all 10 Kiro hook event types in our extension

### 1.2 Scope

- Requirement 1 (Steering Optimization) is DONE — no specification needed
- Requirement 2 (Context Usage Graph) — UI component + data flow
- Requirement 3 (Full Hook System) — 4 new event types + constraint system + schema validation

### 1.3 Definitions and Acronyms

| Term | Definition |
|------|------------|
| Context Window | Maximum tokens an LLM can process per interaction (128K default) |
| Token | Unit of text (approximately 3/4 of a word) |
| Hook | Automation rule defined in `.kiro/hooks/` that fires on events |
| LangGraph | Pipeline orchestration framework for multi-agent workflows |
| MCP | Model Context Protocol — standard for tool integration |
| preToolUse | Event before MCP tool execution |
| postToolUse | Event after MCP tool returns result |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-249.docx |
| Message Protocol | `src/chat-panel/message-protocol.ts` |
| Hook Loader | `src/langgraph/hook-loader.ts` |
| Chat Panel Provider | `src/chat-panel/chat-panel-provider.ts` |

---

## 2. System Overview

### 2.1 System Context

The kiro-sdlc-agents VS Code extension provides:
- Chat panel (webview) for LLM interaction
- LangGraph pipeline for multi-agent SDLC orchestration
- Hook system for automation

This feature adds:
- Context usage visualization in the webview
- Complete hook lifecycle management in the extension host

### 2.2 Actors

| Actor | Description |
|-------|-------------|
| Developer | Human user interacting with chat panel and defining hooks |
| LangGraph Engine | Pipeline executor that processes tasks/nodes |
| MCP Tool System | External tools called by the agent during execution |
| VS Code Extension Host | Runtime that manages extension lifecycle |

---

## 3. Functional Requirements

---

### 3.1 Feature: Context Usage Graph UI

---

#### UC-CUG-01: Display Context Usage Breakdown

**Actors:** Developer, LangGraph Engine

**Preconditions:** Chat panel is open, at least one tab exists

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Chat panel loads | Initialize context usage panel in collapsed state |
| 2 | Developer | Sends message | Engine processes, calculates tokens |
| 3 | System | Engine completes response | Calculate per-category token breakdown |
| 4 | System | Send `chat:contextUsage` to webview | Webview renders/updates bars |

**Alternative Flows:**

| ID | Condition | Action |
|----|-----------|--------|
| AF-01 | No messages yet (empty tab) | Show all bars at 0%, steering tokens only if loaded |
| AF-02 | Tab switch | Load that tab's cached usage data, update bars |

**Exception Flows:**

| ID | Condition | Action |
|----|-----------|--------|
| EF-01 | Token count unavailable from engine | Show "N/A" instead of numbers, bars at previous state |
| EF-02 | maxTokens unknown | Default to 128,000 |

**Business Rules:**

| ID | Rule | Details |
|----|------|---------|
| BR-CUG-01 | Categories mutually exclusive | A token belongs to exactly one category |
| BR-CUG-02 | Total = sum of categories | `total = conversation + mcpTools + steering` |
| BR-CUG-03 | Percentage calculation | `(category / maxTokens) * 100`, rounded to 1 decimal |
| BR-CUG-04 | Display format | Token count with commas: `45,231` |

---

#### UC-CUG-02: Threshold Color Coding

**Actors:** System

**Preconditions:** Context usage data available

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Total percentage calculated | Determine threshold level |
| 2 | System | Apply color to Total bar | Green/Amber/Red based on threshold |
| 3 | System | If >= 95% | Add pulse animation CSS class |

**Business Rules:**

| ID | Rule | Details |
|----|------|---------|
| BR-CUG-05 | Safe threshold | 0-59%: color `#4CAF50` (green) |
| BR-CUG-06 | Warning threshold | 60-79%: color `#FFC107` (amber) |
| BR-CUG-07 | Critical threshold | 80-94%: color `#F44336` (red) |
| BR-CUG-08 | Full threshold | 95-100%: color `#F44336` + CSS pulse animation |
| BR-CUG-09 | Category colors | Conversation=#2196F3, MCP=#9C27B0, Steering=#009688 |

---

#### UC-CUG-03: Collapse/Expand Panel

**Actors:** Developer

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Developer | Clicks panel header | Toggle expand/collapse state |
| 2 | System | Collapsed | Show one-liner: "Context: {pct}% used" |
| 3 | System | Expanded | Show all category bars + total bar |

**Alternative Flows:**

| ID | Condition | Action |
|----|-----------|--------|
| AF-01 | Total crosses 80% (first time) | Auto-expand panel, set `autoExpandTriggered = true` |
| AF-02 | User manually collapsed after auto-expand | Respect user choice, no re-expand |

**Business Rules:**

| ID | Rule | Details |
|----|------|---------|
| BR-CUG-10 | Default state | Collapsed |
| BR-CUG-11 | Auto-expand once only | Per tab per session |
| BR-CUG-12 | State persistence | Stored in tab state object |

---

#### UC-CUG-04: Auto-Update After Message Exchange

**Actors:** LangGraph Engine

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Engine | Completes response | Calculate new token breakdown |
| 2 | System | Send `chat:contextUsage` | Webview animates bar transitions |
| 3 | System | Bar widths change | CSS transition 300ms ease-in-out |

**Triggers for Update:**
- Message exchange completes (user + assistant)
- MCP tool call returns result
- Steering files loaded/unloaded
- Tab switched (shows cached data)

---

#### 3.1.5 API Contract — Context Usage Messages

**New Message Type (Extension to Webview):**

```typescript
// Add to ChatExtToWebviewMessage union:
| { type: "chat:contextUsage"; payload: ContextUsagePayload }

interface ContextUsagePayload {
  tabId: string;
  conversation: { tokens: number; percentage: number };
  mcpTools: { tokens: number; percentage: number };
  steering: { tokens: number; percentage: number };
  total: { tokens: number; percentage: number; threshold: "safe" | "warning" | "critical" | "full" };
  maxTokens: number;
}
```

**Calculation Logic (Extension Host):**

```typescript
function calculateContextUsage(tabState: TabState): ContextUsagePayload {
  const conv = tabState.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const mcp = tabState.toolCalls.reduce((sum, tc) => sum + estimateTokens(tc.result), 0);
  const steer = tabState.loadedSteering.reduce((sum, s) => sum + estimateTokens(s.content), 0);
  const total = conv + mcp + steer;
  const max = tabState.maxTokens || 128000;
  const pct = (v: number) => Math.round((v / max) * 1000) / 10;
  const totalPct = pct(total);
  
  let threshold: "safe" | "warning" | "critical" | "full";
  if (totalPct >= 95) threshold = "full";
  else if (totalPct >= 80) threshold = "critical";
  else if (totalPct >= 60) threshold = "warning";
  else threshold = "safe";

  return {
    tabId: tabState.id,
    conversation: { tokens: conv, percentage: pct(conv) },
    mcpTools: { tokens: mcp, percentage: pct(mcp) },
    steering: { tokens: steer, percentage: pct(steer) },
    total: { tokens: total, percentage: totalPct, threshold },
    maxTokens: max
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // character-based approximation
}
```

---

### 3.2 Feature: Full Hook System

---

#### UC-HOOK-01: userTriggered Hook Event

**Actors:** Developer

**Preconditions:** Hook file with `when.type: "userTriggered"` in `.kiro/hooks/`

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Extension activates | Load hooks, register commands for userTriggered hooks |
| 2 | Developer | Opens Command Palette | See: "Kiro Hook: {hook.name}" commands |
| 3 | Developer | Selects a hook command | Execute hook's `then` action |
| 4 | System | `then.type = "askAgent"` | Inject prompt into current agent |
| 5 | System | `then.type = "runCommand"` | Execute shell command with timeout |

**Alternative Flows:**

| ID | Condition | Action |
|----|-----------|--------|
| AF-01 | No userTriggered hooks | No commands registered |
| AF-02 | Hook file added/removed | FileSystemWatcher triggers reload |
| AF-03 | Hook disabled | Skip registration |

**Exception Flows:**

| ID | Condition | Action |
|----|-----------|--------|
| EF-01 | runCommand fails | Log to output channel, show notification |
| EF-02 | askAgent with no active pipeline | Queue for next invocation |

**Business Rules:**

| ID | Rule | Details |
|----|------|---------|
| BR-HOOK-01 | Command ID | `kiro-sdlc.hook.{sanitizedName}` (alphanumeric + hyphens) |
| BR-HOOK-02 | Command label | `Kiro Hook: {hook.name}` |
| BR-HOOK-03 | Refresh trigger | FileSystemWatcher on `.kiro/hooks/` |

---

#### UC-HOOK-02: postToolUse Hook Event with Filtering

**Actors:** MCP Tool System

**Preconditions:** Hook with `when.type: "postToolUse"` exists and enabled

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | MCP tool returns result | Check matching postToolUse hooks |
| 2 | System | Filter by toolTypes | Match category or regex against tool name |
| 3 | System | Each matching hook | Execute `then` action with tool context |
| 4 | System | `askAgent` | Inject prompt with `${toolName}`, `${toolResult}` |
| 5 | System | `runCommand` | Execute, pass tool info via env vars |

**Tool Category Classification:**

| Category | Tools Matched |
|----------|--------------|
| `read` | readFile, read_code, grep_search, file_search, list_directory, read_files |
| `write` | fs_write, str_replace, fs_append, delete_file |
| `shell` | execute_pwsh, control_pwsh_process |
| `web` | web_search, fetch_url |
| `spec` | get_diagnostics, get_process_output |
| `*` | All tools |
| `/pattern/` | Regex matched against tool name |

**Business Rules:**

| ID | Rule | Details |
|----|------|---------|
| BR-HOOK-04 | Multiple matches fire in order | File-load sequence determines order |
| BR-HOOK-05 | Placeholders | `${toolName}`, `${toolArgs}`, `${toolResult}` in prompt |
| BR-HOOK-06 | Regex detection | toolTypes entry containing `/` chars treated as regex |
| BR-HOOK-07 | Non-blocking | postToolUse does not delay next operation |

---

#### UC-HOOK-03: preTaskExecution Hook Event

**Actors:** LangGraph Engine

**Preconditions:** Hook with `when.type: "preTaskExecution"` exists

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Engine | About to execute node | Fire preTaskExecution event |
| 2 | System | Find matching hooks | Execute in order |
| 3 | System | `askAgent` | Inject prompt before task |
| 4 | System | `runCommand` | Execute, wait for completion |
| 5 | Engine | Hooks complete | Proceed with node |

**Business Rules:**

| ID | Rule | Details |
|----|------|---------|
| BR-HOOK-08 | Metadata | `${nodeName}`, `${inputState}` placeholders |
| BR-HOOK-09 | Non-blocking | Hook failure does not prevent task |
| BR-HOOK-10 | Sequential | Multiple hooks run one after another |

---

#### UC-HOOK-04: postTaskExecution Hook Event

**Actors:** LangGraph Engine

**Preconditions:** Hook with `when.type: "postTaskExecution"` exists

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Engine | Node completes | Fire postTaskExecution event |
| 2 | System | Find matching hooks | Execute in order |
| 3 | System | `askAgent` | Inject prompt with output context |
| 4 | System | `runCommand` | Execute command |
| 5 | System | Hooks complete | Pipeline proceeds |

**Business Rules:**

| ID | Rule | Details |
|----|------|---------|
| BR-HOOK-11 | Metadata | `${nodeName}`, `${taskOutput}`, `${duration}` placeholders |
| BR-HOOK-12 | Non-blocking | Failure does not affect pipeline |
| BR-HOOK-13 | Timing | Fires between current node end and next node start |

---

#### UC-HOOK-05: preToolUse Access Denial (FORBIDDEN)

**Actors:** MCP Tool System, Hook System

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Agent requests tool call | Fire preToolUse |
| 2 | Hook | Returns FORBIDDEN signal | Detect denial |
| 3 | System | Block tool execution | Return error to agent |
| 4 | Agent | Receives denial | Must NOT retry same call |

**Denial Detection:**
- Response contains: `FORBIDDEN`, `DENY`, `ACCESS_DENIED` (case-insensitive)
- Or structured: `{ "action": "deny", "reason": "..." }`

**Business Rules:**

| ID | Rule | Details |
|----|------|---------|
| BR-HOOK-14 | No retry | Agent receives non-retryable error |
| BR-HOOK-15 | Audit log | Timestamp, hook, tool, args logged |
| BR-HOOK-16 | First denial wins | Remaining hooks skipped |
| BR-HOOK-17 | Error format | `"[HOOK DENIED] {hookName}: {reason}"` |

---

#### UC-HOOK-06: preToolUse Parameter Modification

**Actors:** MCP Tool System, Hook System

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Agent requests tool with params | Fire preToolUse |
| 2 | Hook | Returns modified params | Detect MODIFY signal |
| 3 | System | Replace params | Use exact modified params |
| 4 | System | Execute tool | With modified params |

**Modification Detection:**
```json
{ "action": "modify", "params": { "key": "newValue" } }
```

**Business Rules:**

| ID | Rule | Details |
|----|------|---------|
| BR-HOOK-18 | Exact replacement | Modified params used verbatim |
| BR-HOOK-19 | Single pass | No recursive modification |
| BR-HOOK-20 | Partial merge | Only specified keys replaced |
| BR-HOOK-21 | Priority | Denial beats modification |

---

#### UC-HOOK-07: Circular Dependency Detection

**Actors:** Hook System

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Hook A fires | Push A to execution stack |
| 2 | Hook A | Action triggers event | Check stack for circular |
| 3 | System | Circular detected | Skip nested invocation |
| 4 | System | Log warning | "Circular dependency: {hookName} skipped" |

**Business Rules:**

| ID | Rule | Details |
|----|------|---------|
| BR-HOOK-22 | Stack-based | Track `Set<hookName>` of executing hooks |
| BR-HOOK-23 | Top-level honored | First invocation always runs |
| BR-HOOK-24 | Max depth 3 | Configurable via extension settings |
| BR-HOOK-25 | Cleanup | Pop from stack on completion (even on error) |

---

#### UC-HOOK-08: runCommand Timeout

**Actors:** Hook System

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Execute shell command | Start process + timeout timer |
| 2 | System | Timeout exceeded | SIGTERM |
| 3 | System | 5s grace period | SIGKILL if still alive |
| 4 | System | Mark "timed_out" | Log, continue pipeline |

**Business Rules:**

| ID | Rule | Details |
|----|------|---------|
| BR-HOOK-26 | Default timeout | 60,000ms |
| BR-HOOK-27 | Custom timeout | Optional `timeout` field in hook (ms) |
| BR-HOOK-28 | Graceful kill | SIGTERM, 5s wait, SIGKILL |
| BR-HOOK-29 | Capture output | stdout/stderr in log |
| BR-HOOK-30 | CWD | Workspace root |

---

#### UC-HOOK-09: Hook Schema Validation

**Actors:** Hook System (on load)

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Load hook file | Parse JSON |
| 2 | System | Validate required fields | name, version, when.type, then.type |
| 3 | System | Valid | Add to active hooks |
| 4 | System | Invalid | Skip, log error |

**Validation Rules:**

| Field | Constraint | Error Message |
|-------|-----------|---------------|
| `name` | Required, non-empty string | "Hook in {file}: missing 'name'" |
| `version` | Required, non-empty string | "Hook in {file}: missing 'version'" |
| `when.type` | One of 10 valid types | "Hook '{name}': invalid when.type" |
| `then.type` | "askAgent" or "runCommand" | "Hook '{name}': invalid then.type" |
| `then.prompt` | Required if askAgent | "Hook '{name}': askAgent requires 'prompt'" |
| `then.command` | Required if runCommand | "Hook '{name}': runCommand requires 'command'" |

**Business Rules:**

| ID | Rule | Details |
|----|------|---------|
| BR-HOOK-32 | Partial failure | Invalid hooks don't block valid ones |
| BR-HOOK-33 | Output channel | "Kiro SDLC" channel |
| BR-HOOK-34 | File formats | `.json` and `.kiro.hook` supported |
| BR-HOOK-35 | Reload on change | FileSystemWatcher re-validates |

---

## 4. Data Specifications

### 4.1 Context Usage Data Model

```typescript
interface TabContextUsage {
  tabId: string;
  conversationTokens: number;
  mcpToolsTokens: number;
  steeringTokens: number;
  maxTokens: number;
  lastUpdated: number;
  panelExpanded: boolean;
  autoExpandTriggered: boolean;
}
```

### 4.2 Hook Execution State

```typescript
interface HookExecutionState {
  executionStack: Set<string>;
  executionLog: HookLogEntry[];
  registeredCommands: Map<string, vscode.Disposable>;
}

interface HookLogEntry {
  timestamp: number;
  hookName: string;
  eventType: string;
  action: "askAgent" | "runCommand";
  status: "completed" | "failed" | "timed_out" | "skipped_circular" | "denied";
  duration: number;
  error?: string;
}
```

### 4.3 Complete Hook Schema

```typescript
interface HookDefinition {
  name: string;
  version: string;
  description?: string;
  enabled?: boolean;  // default: true
  when: {
    type: HookEventType;
    patterns?: string[];   // file globs for file* events
    toolTypes?: string[];  // categories/regex for *ToolUse
  };
  then: {
    type: "askAgent" | "runCommand";
    prompt?: string;
    command?: string;
    timeout?: number;  // ms, default 60000
  };
}

type HookEventType =
  | "promptSubmit" | "agentStop"
  | "fileCreated" | "fileEdited" | "fileDeleted"
  | "userTriggered"
  | "preToolUse" | "postToolUse"
  | "preTaskExecution" | "postTaskExecution";
```

---

## 5. UI Specifications

### 5.1 Context Usage Panel Layout

**Position:** Between chat messages container and input area

**Collapsed State:**
```
+-------------------------------------------+
| > Context: 47% used                       |
+-------------------------------------------+
```

**Expanded State:**
```
+-------------------------------------------+
| v Context Usage                           |
|-------------------------------------------|
| Conversation  ========------  35% (45K)   |
| MCP Tools     ===----------   9% (12K)    |
| Steering      ==-----------   2%  (3K)    |
| ----------------------------------------- |
| Total         ===========---  47% (60K)   |
+-------------------------------------------+
```

### 5.2 CSS Classes

```css
.context-usage-panel { }
.context-usage-panel--collapsed { }
.context-usage-panel--expanded { }
.context-usage-header { cursor: pointer; }
.context-usage-bar { height: 8px; border-radius: 4px; transition: width 300ms ease-in-out; }
.context-usage-bar--safe { background: var(--kiro-green, #4CAF50); }
.context-usage-bar--warning { background: var(--kiro-amber, #FFC107); }
.context-usage-bar--critical { background: var(--kiro-red, #F44336); }
.context-usage-bar--full { background: var(--kiro-red, #F44336); animation: pulse 1.5s infinite; }
.context-usage-bar--conversation { background: var(--kiro-blue, #2196F3); }
.context-usage-bar--mcp { background: var(--kiro-purple, #9C27B0); }
.context-usage-bar--steering { background: var(--kiro-teal, #009688); }
```

### 5.3 Accessibility

| Element | ARIA | Details |
|---------|------|---------|
| Panel | `role="region"`, `aria-label="Context usage"` | Landmark |
| Header | `role="button"`, `aria-expanded` | Toggle |
| Bar | `role="progressbar"`, `aria-valuenow/min/max` | Progress |
| Label | `aria-label="{category}: {pct}% ({tokens} tokens)"` | Screen reader |

---

## 6. Integration Requirements

### 6.1 Hook Pipeline Integration

```typescript
// Pseudocode for LangGraph node execution with hooks:
async function executeNode(node: PipelineNode, state: PipelineState) {
  await fireHookEvent("preTaskExecution", { nodeName: node.name, inputState: state });
  
  const result = await node.execute(state, {
    onToolCall: async (tool, args) => {
      const preResult = await firePreToolUse(tool, args);
      if (preResult.denied) throw new HookDeniedError(preResult.hookName, preResult.reason);
      const finalArgs = preResult.modifiedArgs || args;
      const toolResult = await executeTool(tool, finalArgs);
      await fireHookEvent("postToolUse", { toolName: tool, args: finalArgs, result: toolResult });
      return toolResult;
    }
  });
  
  await fireHookEvent("postTaskExecution", { nodeName: node.name, output: result });
  return result;
}
```

### 6.2 FileSystemWatcher for Hook Reload

```typescript
const hookWatcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(workspaceRoot, ".kiro/hooks/**/*.{json,kiro.hook}")
);
hookWatcher.onDidCreate(() => reloadHooks());
hookWatcher.onDidChange(() => reloadHooks());
hookWatcher.onDidDelete(() => reloadHooks());
```

### 6.3 Token Estimation

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // character-based approximation
}
```

---

## 7. Error Handling

| Error | Handling | User Impact |
|-------|----------|-------------|
| Token estimation fails | Use 0 | Bar shows 0% |
| Hook JSON parse error | Skip, log | Hook doesn't fire |
| runCommand crash | Capture exit code, log | Pipeline continues |
| runCommand timeout | Kill, mark timed_out | Pipeline continues |
| askAgent injection fails | Log, skip | Pipeline continues |
| Circular dependency | Skip nested, log warning | Top-level runs |
| FORBIDDEN denial | Return error to agent | Agent adjusts |

---

## 8. Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Panel render | < 16ms | No frame drops |
| Hook overhead | < 10ms per hook | Event to action start |
| runCommand timeout | Default 60s | Process killed |
| Hook loading | < 500ms for 50 hooks | On activate |
| Memory | < 5MB hook state | Logs + state |
| Panel update delay | < 500ms | After message complete |

---

## 9. Open Issues

| # | Issue | Status | Decision |
|---|-------|--------|----------|
| 1 | postToolUse raw vs summarized result | Decided | Summarized (first 1000 chars) to avoid token bloat |
| 2 | Token estimation method | Decided | char_count / 4 for performance |
| 3 | userTriggered file pattern support | Deferred | Not in v1 |

---

## 10. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence: Context Usage | [sequence-context-usage.png](diagrams/sequence-context-usage.png) | [sequence-context-usage.drawio](diagrams/sequence-context-usage.drawio) |
| 3 | State: Hook Lifecycle | [state-hook-lifecycle.png](diagrams/state-hook-lifecycle.png) | [state-hook-lifecycle.drawio](diagrams/state-hook-lifecycle.drawio) |

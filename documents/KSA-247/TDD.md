# Technical Design Document (TDD)

## Kiro SDLC Agents — KSA-247: Chat Panel: Restore collapsible tool call UI blocks with icons

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-247 |
| Title | Chat Panel: Restore collapsible tool call UI blocks with icons |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-09 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-247.docx |
| Related FSD | FSD-v1-KSA-247.docx |
| Architecture Pattern | Plugin (VS Code Extension Webview) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-09 | SA Agent | Initial TDD from FSD + codebase analysis |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical design for restoring collapsible tool call UI blocks with category icons in the Chat Panel webview. It addresses a regression where tool call blocks are wiped during streaming, and adds accessibility improvements.

### 1.2 Scope

- Fix streaming protection (tool blocks persist when chat:streamChunk arrives)
- Enhance categorizeTool() with expanded category map + resolve OI-4 priority issue
- Add accessibility attributes (tabindex, aria-expanded, keyboard listeners)
- Implement "interrupted" status for tools running when panel closes
- Ensure state persistence includes full tool call data for reload

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Extension Host | TypeScript | 5.x |
| Webview | Vanilla JavaScript (ES5 compat) | - |
| Styling | CSS3 (VS Code CSS variables) | - |
| Build | esbuild (bundled via VS Code extension) | - |
| Host Platform | VS Code Extension API | 1.85+ |
| Persistence | VS Code workspaceState (Memento API) | - |
| Message Protocol | postMessage (JSON) | Custom (message-protocol.ts) |

### 1.4 Design Principles

1. **Zero framework** - Webview uses vanilla JS; no React/Vue/Svelte
2. **ES5 compatibility** - var, no arrow functions, no let/const in webview code
3. **Separation of concerns** - Extension Host handles data/persistence; Webview handles rendering
4. **Incremental enhancement** - Fix regression first, then add new capabilities
5. **Existing pattern adherence** - Follow streamingNodes pattern for tool call tracking

### 1.5 References

| Document | Purpose |
|----------|---------|
| BRD-v1-KSA-247 | Business requirements and acceptance criteria |
| FSD-v1-KSA-247 | Functional specification with use cases UC-1 through UC-4 |
| KSA-210 | Chat Panel MVP (ChatPanelProvider, message protocol) |
| KSA-240 | Chat State Persistence (workspaceState, tab management) |

---

## 2. System Architecture

### 2.1 High-Level Architecture

![Architecture](diagrams/architecture.png)
*[Edit in draw.io](diagrams/architecture.drawio)*

The Chat Panel operates as a VS Code Webview Panel with a plugin architecture:

- **Extension Host Process** (Node.js): Runs ChatPanelProvider, LangGraphEngine, MessageHandler
- **Webview Process** (Chromium sandbox): Renders chat UI in isolated browser context
- **Communication**: postMessage (JSON) - async, bidirectional
- **Persistence**: workspaceState (Memento API) - per workspace, synchronous read/async write

### 2.2 Component Responsibilities

| Component | Responsibility | File |
|-----------|---------------|------|
| ChatPanelProvider | WebviewViewProvider, message routing, state persistence | src/chat-panel/chat-panel-provider.ts |
| MessageHandler | Delegates webview messages to appropriate handlers | src/chat-panel/message-handler.ts |
| LangGraphEngine | Orchestrates tool execution, emits tool call events | src/langgraph/langgraph-engine.ts |
| Webview (chat.js) | DOM rendering, user interaction, streaming display | resources/webview-assets/chat/chat.js |
| Webview (chat.css) | Visual styling for tool call blocks | resources/webview-assets/chat/chat.css |
| Message Protocol | Type definitions for postMessage communication | src/chat-panel/message-protocol.ts |

### 2.3 Communication Patterns

All communication between Extension Host and Webview is async via postMessage:

- Extension to Webview: this.view.webview.postMessage(msg) triggers window message event
- Webview to Extension: vscode.postMessage(msg) triggers onDidReceiveMessage handler
- Persistence: Webview sends chat:saveState, Extension writes workspaceState.update()
- Restore: Extension sends tab:updated on ready event, Webview re-renders from data

---

## 3. Detailed Design

### 3.1 Component Diagram

![Component](diagrams/component.png)
*[Edit in draw.io](diagrams/component.drawio)*

### 3.2 Module Design - Webview (chat.js)

#### 3.2.1 Tool Category Resolution (Enhanced categorizeTool)

**Implements:** UC-1, BR-1, BR-2 | **Resolves:** OI-4 (priority fix), Discrepancy #1/#2

The existing categorizeTool(name) function has a priority bug: file_search matches "file" before "search". The fix uses an explicit map with ordered priority rules.

```javascript
/**
 * Enhanced categorizeTool - explicit prefix map with priority ordering.
 * Returns { icon: string, label: string, cls: string }
 *
 * Priority: Explicit prefix match > contains match > fallback
 * Resolves OI-4: file_search -> SEARCH (not FILE)
 */
function categorizeTool(name) {
  var n = (name || "").toLowerCase();

  // Priority 1: Explicit prefix matches (most specific first)
  var prefixMap = [
    { prefix: "execute_pwsh",    icon: ">_", label: "CMD",    cls: "cat-command" },
    { prefix: "control_pwsh",    icon: ">_", label: "CMD",    cls: "cat-command" },
    { prefix: "get_process",     icon: ">_", label: "CMD",    cls: "cat-command" },
    { prefix: "list_process",    icon: ">_", label: "CMD",    cls: "cat-command" },
    { prefix: "grep_search",     icon: "?",  label: "SEARCH", cls: "cat-search" },
    { prefix: "file_search",     icon: "?",  label: "SEARCH", cls: "cat-search" },
    { prefix: "mem_search",      icon: "m",  label: "MEM",    cls: "cat-memory" },
    { prefix: "mem_ingest",      icon: "m",  label: "MEM",    cls: "cat-memory" },
    { prefix: "read_file",       icon: "[]", label: "FILE",   cls: "cat-file" },
    { prefix: "read_files",      icon: "[]", label: "FILE",   cls: "cat-file" },
    { prefix: "read_code",       icon: "[]", label: "FILE",   cls: "cat-file" },
    { prefix: "list_directory",  icon: "[]", label: "FILE",   cls: "cat-file" },
    { prefix: "fs_write",        icon: "[]", label: "FILE",   cls: "cat-file" },
    { prefix: "stream_write",    icon: "[]", label: "FILE",   cls: "cat-file" },
    { prefix: "export_docx",     icon: "D",  label: "DOC",    cls: "cat-doc" },
    { prefix: "embed_images",    icon: "D",  label: "DOC",    cls: "cat-doc" },
    { prefix: "drawio",          icon: "D",  label: "DOC",    cls: "cat-doc" },
    { prefix: "jira_",           icon: "J",  label: "JIRA",   cls: "cat-jira" }
  ];

  for (var i = 0; i < prefixMap.length; i++) {
    if (n.indexOf(prefixMap[i].prefix) === 0 || n === prefixMap[i].prefix) {
      return { icon: prefixMap[i].icon, label: prefixMap[i].label, cls: prefixMap[i].cls };
    }
  }

  // Priority 2: Contains-based matching (broader patterns)
  if (n.indexOf("pwsh") !== -1 || n.indexOf("shell") !== -1 || n.indexOf("command") !== -1)
    return { icon: ">_", label: "CMD", cls: "cat-command" };
  if (n.indexOf("search") !== -1 || n.indexOf("grep") !== -1 || n.indexOf("find") !== -1)
    return { icon: "?", label: "SEARCH", cls: "cat-search" };
  if (n.indexOf("mem_") !== -1 || n.indexOf("kb_") !== -1)
    return { icon: "m", label: "MEM", cls: "cat-memory" };
  if (n.indexOf("jira") !== -1 || n.indexOf("issue") !== -1)
    return { icon: "J", label: "JIRA", cls: "cat-jira" };
  if (n.indexOf("read") !== -1 || n.indexOf("write") !== -1 || n.indexOf("file") !== -1 ||
      n.indexOf("list") !== -1 || n.indexOf("directory") !== -1)
    return { icon: "[]", label: "FILE", cls: "cat-file" };
  if (n.indexOf("drawio") !== -1 || n.indexOf("export") !== -1 || n.indexOf("docx") !== -1)
    return { icon: "D", label: "DOC", cls: "cat-doc" };

  // Priority 3: Fallback
  return { icon: "T", label: "TOOL", cls: "cat-tool" };
}
```

**Design Decision (OI-1):** Keep text-char icons (>_, [], ?, m, J, D, T) rather than emojis.
Rationale: Existing CSS supports text-char sizing/styling; emojis render inconsistently across OS; text chars integrate better with VS Code monospace theme.

#### 3.2.2 Tool Call Rendering (Enhanced renderToolCall)

**Implements:** UC-1, UC-3, BR-4, BR-10, BR-11, BR-17 | **Resolves:** Discrepancy #4, OI-2

```javascript
/**
 * Render a tool call block with accessibility attributes.
 * @param {ToolCallDisplay} tc - Tool call data
 * @param {boolean} isReplay - True when restoring from persistence (skip animations)
 */
function renderToolCall(tc, isReplay) {
  // Validation: EF-1 - skip if required fields missing
  if (!tc || !tc.id || !tc.name) {
    console.warn("[chat.js] renderToolCall: missing id or name, skipping", tc);
    return;
  }

  showMessages();
  var block = document.createElement("div");
  block.className = "tool-call-block";
  block.id = "tc-" + tc.id;

  // Accessibility: BR-17, OI-2
  block.setAttribute("tabindex", "0");
  block.setAttribute("role", "button");
  block.setAttribute("aria-expanded", "false");
  block.setAttribute("aria-label", "Tool call: " + tc.name + " - " + (tc.status || "running"));

  var cat = categorizeTool(tc.name);

  // Determine status display
  var displayStatus = tc.status;
  if (isReplay && tc.status === "running") {
    displayStatus = "interrupted"; // OI-3: stale running -> interrupted
  }

  var header = document.createElement("div");
  header.className = "tool-call-header";
  header.innerHTML = '<span class="tool-chevron">&#x25B6;</span>' +
    '<span class="tool-icon">' + cat.icon + '</span>' +
    '<span class="tool-cat ' + cat.cls + '">' + cat.label + '</span>' +
    '<span class="tool-name">' + escapeHtml(tc.name) + '</span>' +
    '<span class="tool-status ' + displayStatus + '">' + statusIcon(displayStatus) + '</span>';

  // Duration display (for completed/replayed blocks)
  if (tc.duration) {
    var dur = document.createElement("span");
    dur.className = "tool-duration";
    dur.textContent = formatDuration(tc.duration);
    header.appendChild(dur);
  }

  // Click handler: toggle expand/collapse
  header.addEventListener("click", function () {
    var isExpanded = block.classList.toggle("expanded");
    block.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  });

  // Keyboard handler: Enter/Space toggle (BR-17)
  block.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      var isExpanded = block.classList.toggle("expanded");
      block.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    }
  });

  // Body content
  var body = document.createElement("div");
  body.className = "tool-call-body";
  if (displayStatus === "completed" && tc.result) {
    body.textContent = tc.result;
  } else if (displayStatus === "failed" && tc.error) {
    body.textContent = tc.error;
    body.classList.add("failed");
  } else if (tc.args) {
    body.textContent = JSON.stringify(tc.args, null, 2);
  } else {
    body.textContent = "No data available";
  }

  block.appendChild(header);
  block.appendChild(body);
  messagesEl.appendChild(block);
  toolCalls[tc.id] = block;
  scrollToBottom();

  // Persist to tab state (skip if replay to avoid duplication)
  if (!isReplay) {
    var currentTab = getTab(activeTabId);
    if (currentTab) {
      if (!currentTab.messages) currentTab.messages = [];
      currentTab.messages.push({
        role: "tool",
        content: "",
        toolData: {
          id: tc.id,
          name: tc.name,
          args: tc.args,
          status: tc.status,
          result: tc.result,
          duration: tc.duration,
          timestamp: new Date().toISOString()
        }
      });
      saveStateToDisk();
    }
  }
}
```

#### 3.2.3 Tool Call Update (Enhanced updateToolCall)

**Implements:** UC-2 (partial), BR-14, BR-15 | **Resolves:** OI-6 (duration duplication)

```javascript
/**
 * Update an existing tool call block with completion/failure data.
 * Guards against duplicate duration spans (OI-6).
 */
function updateToolCall(msg) {
  var block = toolCalls[msg.id];
  if (!block) {
    console.warn("[chat.js] updateToolCall: block not found for id", msg.id);
    return;
  }

  // Update status indicator
  var statusSpan = block.querySelector(".tool-status");
  statusSpan.className = "tool-status " + msg.status;
  statusSpan.textContent = statusIcon(msg.status);

  // Update aria-label
  var toolName = block.querySelector(".tool-name");
  block.setAttribute("aria-label", "Tool call: " +
    (toolName ? toolName.textContent : "") + " - " + msg.status);

  // Update body content (BR-14: result replaces args)
  if (msg.result) {
    var body = block.querySelector(".tool-call-body");
    body.textContent = msg.result;
    if (msg.status === "failed") {
      body.classList.add("failed");
    } else {
      body.classList.remove("failed");
    }
  }

  // Duration display - guard against duplicates (OI-6)
  if (msg.duration) {
    var existingDur = block.querySelector(".tool-duration");
    if (!existingDur) {
      var dur = document.createElement("span");
      dur.className = "tool-duration";
      dur.textContent = formatDuration(msg.duration);
      block.querySelector(".tool-call-header").appendChild(dur);
    } else {
      existingDur.textContent = formatDuration(msg.duration);
    }
  }

  // Update persisted state in tab
  var currentTab = getTab(activeTabId);
  if (currentTab && currentTab.messages) {
    for (var i = currentTab.messages.length - 1; i >= 0; i--) {
      var m = currentTab.messages[i];
      if (m.role === "tool" && m.toolData && m.toolData.id === msg.id) {
        m.toolData.status = msg.status;
        if (msg.result) m.toolData.result = msg.result;
        if (msg.duration) m.toolData.duration = msg.duration;
        break;
      }
    }
    saveStateToDisk();
  }
}

/**
 * Format duration from ms to human-readable.
 */
function formatDuration(ms) {
  if (ms < 1000) return ms + "ms";
  return (ms / 1000).toFixed(1) + "s";
}
```

#### 3.2.4 Streaming Protection (Fix for Regression)

**Implements:** UC-2, BR-5, BR-6, BR-7, BR-8

The streaming protection is already working correctly in the current codebase. The architecture ensures tool blocks and stream bubbles never collide:

- toolCalls map tracks tool call DOM elements by ID
- streamingNodes map tracks streaming text bubbles by nodeId
- handleStreamChunk creates NEW .message.assistant.streaming divs - never touches toolCalls
- messagesEl.appendChild(el) naturally places stream bubbles AFTER tool blocks

**No code change needed** for streaming protection. The regression was previously fixed in KSA-210. The TDD documents the architecture to prevent future regressions.

Key invariant: toolCalls map is NEVER referenced or modified in handleStreamChunk/handleStreamComplete.

#### 3.2.5 Status Icon Enhancement

**Resolves:** OI-3 (interrupted status)

```javascript
function statusIcon(status) {
  if (status === "running") return "\u23F3";      // hourglass
  if (status === "completed") return "\u2713";    // checkmark
  if (status === "failed") return "\u2717";       // X mark
  if (status === "interrupted") return "\u23F8";  // pause
  return "";
}
```

### 3.3 Module Design - Extension Host (ChatPanelProvider.ts)

#### 3.3.1 State Persistence (No Changes Needed)

**Implements:** UC-3, BR-9

The saveChatState method in ChatPanelProvider already persists the full tab state including tool call messages. Data flow:

1. Webview saveStateToDisk() sends chat:saveState with { tabs, activeTabId, messageHistory }
2. Extension Host saveChatState() writes to workspaceState.update("chatPanel.state", state)
3. Each tab messages[] includes { role: "tool", toolData: {...} } entries

No change needed to extension host persistence logic.

#### 3.3.2 State Restoration (No Changes Needed)

**Implements:** UC-3, BR-10, BR-11

On webview ready event, restoreChatState() sends tab:updated with full state. The webview handleTabsUpdated() and switchToTab() iterate messages and call renderToolCall(toolData, true) for role: "tool" entries.

Enhancement in webview: isReplay=true triggers "interrupted" status for stale "running" tools.

### 3.4 CSS Additions

**Resolves:** OI-3 (interrupted styling), Accessibility focus styles

```css
/* Interrupted status (OI-3) */
.tool-call-header .tool-status.interrupted { color: #94a3b8; }

/* Duration span styling */
.tool-duration {
  margin-left: 8px;
  opacity: 0.5;
  font-size: 10px;
}

/* Accessibility: focus-visible outline */
.tool-call-block:focus-visible {
  outline: 2px solid var(--vscode-focusBorder, #6366f1);
  outline-offset: 1px;
}

/* Failed body styling */
.tool-call-body.failed {
  color: #ef4444;
  border-left: 2px solid #ef4444;
  padding-left: 10px;
}

/* Category colors (ensure all categories have styles) */
.tool-cat.cat-memory { background: rgba(168, 85, 247, 0.18); color: #c084fc; }
.tool-cat.cat-jira { background: rgba(59, 130, 246, 0.18); color: #60a5fa; }
.tool-cat.cat-command { background: rgba(34, 197, 94, 0.18); color: #4ade80; }
```

---

## 4. Data Model

### 4.1 In-Memory State (Webview)

No persistent database. State lives in:

| Store | Type | Scope | Contents |
|-------|------|-------|----------|
| toolCalls | Object (id to HTMLElement) | Tab session | Map of tool call ID to DOM element |
| streamingNodes | Object (nodeId to {el, content}) | Stream session | Map of nodeId to streaming bubble |
| tabs[].messages[] | Array of MessageEntry | Workspace | Full conversation history |

#### ToolCallMessageEntry Schema

```typescript
interface ToolCallMessageEntry {
  role: "tool";
  content: "";
  toolData: {
    id: string;
    name: string;
    args?: Record<string, unknown>;
    status: "running" | "completed" | "failed" | "interrupted";
    result?: string;
    error?: string;
    duration?: number;
    timestamp?: string;
  };
}
```

### 4.2 workspaceState Persistence Schema

Key: chatPanel.state

```typescript
interface PersistedChatState {
  tabs: Array<{
    id: string;
    name: string;
    messages: Array<MessageEntry>;
    tokenCount: number;
    maxTokens: number;
  }>;
  activeTabId: string;
  messageHistory?: string[];
}
```

### 4.3 State Lifecycle

User sends message -> LangGraph invokes tools -> Extension emits chat:toolCall -> Webview renders block + stores in toolCalls map -> Webview persists to tabs[].messages[] via saveStateToDisk() -> Extension writes to workspaceState (debounced 500ms)

Panel reload -> Extension reads workspaceState -> Extension sends tab:updated -> Webview iterates messages -> renderToolCall(toolData, isReplay=true) -> Blocks reconstructed with final state

---

## 5. Integration Design

### 5.1 Message Protocol (postMessage)

#### Extension to Webview Messages (Tool Call Related)

| Message Type | Payload | Trigger |
|--------------|---------|---------|
| chat:toolCall | { toolCall: ToolCallDisplay } | LangGraph invokes a tool |
| chat:toolCallUpdate | { id, status, result?, duration? } | Tool execution completes/fails |
| chat:streamChunk | { streamId, nodeId, eventType, content, timestamp } | LLM streams text tokens |
| chat:streamComplete | { streamId, nodeId, finalContent } | Stream finishes |
| tab:updated | { tabs: [...], activeTabId } | State restore on reload |

#### Webview to Extension Messages (Tool Call Related)

| Message Type | Payload | Trigger |
|--------------|---------|---------|
| chat:saveState | { tabs, activeTabId, messageHistory } | State dirty (debounced 500ms) |

### 5.2 ToolCallDisplay Interface (from message-protocol.ts)

```typescript
interface ToolCallDisplay {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  status: "running" | "completed" | "failed";
  result?: string;
  duration?: number;
}
```

---

## 6. Security Design

### 6.1 Threat Model

| Threat | Mitigation | Risk |
|--------|------------|------|
| XSS via tool name/result | escapeHtml() applied to all dynamic content | Low |
| Prototype pollution via args | JSON.stringify displays only, no eval | Low |
| CSP violation | Strict CSP with nonce-based script-src | Low |
| workspaceState tampering | VS Code API isolation per workspace | Negligible |

### 6.2 Content Security Policy

Already configured in getHtml():
- default-src 'none'
- script-src 'nonce-{nonce}'
- style-src {cspSource} 'unsafe-inline'
- img-src {cspSource} data:
- connect-src 'none'

No changes required.

### 6.3 Input Sanitization

All user-visible text from tool calls passes through escapeHtml():

```javascript
function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

Tool body content uses textContent (not innerHTML) which is inherently safe.

---

## 7. Performance and Scalability

### 7.1 Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Block render time | < 16ms (1 frame) | BRD NFR |
| Expand/collapse transition | 200ms CSS | BRD NFR |
| saveStateToDisk debounce | 500ms | Avoid excessive postMessage |
| Max tool calls per tab | ~200 | workspaceState quota |

### 7.2 Optimizations

1. **Debounced persistence** - saveStateToDisk uses 500ms setTimeout to batch
2. **In-place DOM updates** - updateToolCall modifies existing elements (no re-render)
3. **prefixMap early exit** - categorizeTool returns on first match, O(n) with n=18
4. **No virtual scrolling needed** - Tool blocks are ~100px each; 200 blocks well within limits

### 7.3 Memory

- toolCalls map cleared on tab switch (messagesEl.innerHTML = "")
- streamingNodes cleaned on handleStreamComplete
- Large results: consider 10KB truncation for persistence (tech debt)

---

## 8. Error Handling

### 8.1 Error Strategy

| Scenario | Detection | Handling | User Impact |
|----------|-----------|----------|-------------|
| Missing id/name in toolCall | Validation in renderToolCall | console.warn, skip block | Invisible |
| Block not found in updateToolCall | toolCalls[msg.id] falsy | console.warn, skip | Invisible |
| Corrupted toolData on restore | Missing id/name check | Skip entry, continue | Other blocks OK |
| workspaceState write failure | Try/catch in saveChatState | Log error | State may be stale |
| JSON.stringify fails (circular) | Try/catch | Show "Cannot display" | Graceful fallback |

### 8.2 Graceful Degradation

- categorizeTool always returns fallback {icon:"T", label:"TOOL", cls:"cat-tool"}
- Restored "running" status converts to "interrupted" (no stale spinners)
- workspaceState eviction: tracked as tech debt (OI-5)

---

## 9. Monitoring and Observability

### 9.1 Debug Logging

Uses existing chat:debugLog round-trip to extension host debugLog():

```javascript
vscode.postMessage({ type: "chat:debugLog", text: "toolCall obj: " + JSON.stringify(msg.toolCall).slice(0, 200) });
```

### 9.2 Diagnostics

| What to Monitor | How | Alert Condition |
|-----------------|-----|-----------------|
| Render failures | Console warnings | "missing id or name" |
| Update misses | Console warnings | "block not found" |
| State save failures | debugError | saveChatState failed |
| Tab message count | tabs[].messages.length | > 500 entries |

---

## 10. Implementation Checklist

### 10.1 Files to Modify

| # | File | Changes | Priority |
|---|------|---------|----------|
| 1 | resources/webview-assets/chat/chat.js | Enhanced categorizeTool, renderToolCall, updateToolCall, statusIcon, add formatDuration | MUST |
| 2 | resources/webview-assets/chat/chat.css | Add .interrupted, .tool-duration, :focus-visible, .failed body, category colors | MUST |
| 3 | webview-assets/chat/chat.js | Mirror changes from resources/ | MUST |
| 4 | webview-assets/chat/chat.css | Mirror changes from resources/ | MUST |

### 10.2 Files NOT Modified

| File | Reason |
|------|--------|
| src/chat-panel/chat-panel-provider.ts | Persistence and routing already correct |
| src/chat-panel/message-protocol.ts | Protocol types already include ToolCallDisplay |
| src/chat-panel/message-handler.ts | No changes to delegation logic |
| src/langgraph/langgraph-engine.ts | Tool emission already correct |

### 10.3 Implementation Order

1. CSS additions - new classes (interrupted, focus, duration, category colors)
2. categorizeTool enhancement - prefixMap-based implementation
3. renderToolCall enhancement - accessibility, interrupted, validation
4. updateToolCall enhancement - duration guard, failed styling, state update
5. statusIcon enhancement - add "interrupted" case
6. Add formatDuration helper
7. Verify streaming protection (already working)
8. Test all use cases UC-1 through UC-4

### 10.4 Requirements Traceability

| FSD Requirement | TDD Section | Implementation |
|-----------------|-------------|----------------|
| UC-1: Render with category icon | 3.2.1, 3.2.2 | categorizeTool(), renderToolCall() |
| UC-2: Stream without destroying | 3.2.4 | handleStreamChunk() - already working |
| UC-3: Persist and restore | 3.3.1, 3.3.2 | saveChatState(), renderToolCall(tc, true) |
| UC-4: Expand/collapse | 3.2.2, 3.2.3 | Click/keyboard handlers |
| BR-1/BR-2: Category map | 3.2.1 | prefixMap in categorizeTool() |
| BR-5-BR-8: Streaming protection | 3.2.4 | Separate toolCalls vs streamingNodes |
| BR-9-BR-11: Persistence | 3.3.1, 3.3.2 | saveStateToDisk() + isReplay flag |
| BR-12-BR-16: Expand/collapse | 3.2.2 | CSS transitions + class toggle |
| BR-17: Keyboard accessibility | 3.2.2 | tabindex, keydown listener |
| OI-1: Icon format decision | 3.2.1 | Decision: keep text chars |
| OI-2: Accessibility gap | 3.2.2, 3.4 | tabindex, aria-expanded, :focus-visible |
| OI-3: Interrupted status | 3.2.2, 3.2.5, 3.4 | New status + CSS |
| OI-4: Priority bug | 3.2.1 | prefixMap with explicit ordering |
| OI-5: workspaceState eviction | 8.2 | Tech debt |
| OI-6: Duration duplication | 3.2.3 | Guard with .tool-duration selector |

---

## 11. Deployment

### 11.1 Packaging

Ships as part of VS Code extension. Build: npm run compile. Webview assets copied to out/. Package: vsce package.

### 11.2 Feature Flags

None needed - this is a bug fix + enhancement to existing functionality.

### 11.3 Rollback Strategy

Revert commit affecting chat.js and chat.css. No database, no external system changes. workspaceState format is backward-compatible (new fields are optional).

### 11.4 Backward Compatibility

| Concern | Mitigation |
|---------|-----------|
| Old state without toolData.timestamp | Field optional - handled |
| Old state without toolData.error | Field optional - falls back to args |
| Old state with status "running" | isReplay converts to "interrupted" |

---

## 12. Appendix

### 12.1 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

### 12.2 Glossary

| Term | Definition |
|------|------------|
| postMessage | VS Code webview to extension host communication API |
| workspaceState | VS Code Memento API for per-workspace key-value persistence |
| MCP | Model Context Protocol - standard for AI tool invocation |
| CSP | Content Security Policy - browser security mechanism |
| DOM | Document Object Model - in-memory HTML representation |
| LangGraph | Agent orchestration engine that decides tool invocations |
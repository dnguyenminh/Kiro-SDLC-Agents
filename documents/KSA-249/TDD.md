# Technical Design Document (TDD)

## Kiro SDLC Agents — KSA-249: Developer Experience: Steering Optimization + Context Usage Graph + Full Hook System

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-249 |
| Title | Developer Experience: Steering Optimization + Context Usage Graph + Full Hook System |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-249.docx |
| Related BRD | BRD-v1-KSA-249.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | SA Agent | Initial TDD |

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

The implementation extends the existing kiro-sdlc-agents VS Code extension with two subsystems:

1. **Context Usage Graph** — token tracking in extension host + visual panel in webview
2. **Full Hook System** — extends hook-loader.ts with execution engine, constraint handling, VS Code command registration

### 1.2 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Extension Host | TypeScript | 5.x |
| Build | esbuild | Existing |
| UI | Vanilla JS + CSS (webview) | N/A |
| Pipeline | LangGraph (custom TS) | N/A |
| VS Code API | vscode | ^1.85.0 |
| Testing | Vitest | Existing |

### 1.3 Design Principles

- Minimal coupling — Hook executor independent of hook content
- Non-blocking — Hook failures never crash pipeline
- Progressive enhancement — Context panel degrades gracefully
- Single responsibility — Each module one concern

---

## 2. Component Architecture

### 2.1 Context Usage Graph Components

Extension Host:
- src/chat-panel/context-usage-tracker.ts (NEW) — token tracking per tab
- src/chat-panel/chat-panel-provider.ts (MODIFY) — send contextUsage messages
- src/chat-panel/message-protocol.ts (MODIFY) — add contextUsage type

Webview:
- resources/webview-assets/chat/chat.js (MODIFY) — handle contextUsage messages
- resources/webview-assets/chat/chat.css (MODIFY) — context-usage-panel styles

### 2.2 Hook System Components

Extension Host:
- src/langgraph/hook-loader.ts (MODIFY) — add schema validation
- src/langgraph/hook-executor.ts (NEW) — execute hook actions
- src/langgraph/hook-events.ts (NEW) — event firing + circular detection
- src/langgraph/hook-commands.ts (NEW) — userTriggered command registration
- src/langgraph/pipeline-executor.ts (MODIFY) — integrate pre/post task hooks

---

## 3. Detailed Design

### 3.1 Context Usage Tracker (context-usage-tracker.ts)

Purpose: Track token consumption per category per tab.

```typescript
export class ContextUsageTracker {
  private tabUsage: Map<string, TabContextUsage> = new Map();
  
  constructor(private maxTokens: number = 128000) {}

  updateFromMessages(tabId: string, messages: ChatMessage[]): void;
  addToolTokens(tabId: string, toolResult: string): void;
  updateSteeringTokens(tabId: string, steeringContent: string[]): void;
  getUsagePayload(tabId: string): ContextUsagePayload;
  clearTab(tabId: string): void;
  
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
```

Integration: ChatPanelProvider calls tracker after each engine response, sends to webview.

### 3.2 Hook Executor (hook-executor.ts)

Purpose: Execute hook actions with timeout and error handling.

```typescript
export class HookExecutor {
  private outputChannel: vscode.OutputChannel;
  
  async executeAskAgent(hook: HookDefinition, context: HookContext): Promise<HookResult>;
  async executeRunCommand(hook: HookDefinition, context: HookContext): Promise<HookResult>;
  private killProcess(pid: number): Promise<void>;
  private substitutePlaceholders(template: string, context: HookContext): string;
}

interface HookContext {
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  nodeName?: string;
  inputState?: unknown;
  taskOutput?: unknown;
  duration?: number;
}

interface HookResult {
  status: "completed" | "failed" | "timed_out" | "denied";
  output?: string;
  modifiedParams?: Record<string, unknown>;
  error?: string;
  duration: number;
}
```

### 3.3 Hook Events Manager (hook-events.ts)

Purpose: Central event dispatcher with circular dependency detection.

```typescript
export class HookEventsManager {
  private executionStack: Set<string> = new Set();
  private executionLog: HookLogEntry[] = [];
  private maxDepth: number = 3;
  
  async fireEvent(eventType: HookEventType, context: HookContext): Promise<void>;
  async firePreToolUse(toolName: string, category: string, args: Record<string, unknown>): Promise<PreToolUseResult>;
  private isCircular(hookName: string): boolean;
  private classifyTool(toolName: string): string;
  private matchesToolType(hook: HookDefinition, toolName: string, category: string): boolean;
}

interface PreToolUseResult {
  denied: boolean;
  hookName?: string;
  reason?: string;
  modifiedArgs?: Record<string, unknown>;
}
```

Tool Category Classification:
- read: readFile, read_code, grep_search, file_search, list_directory, read_files
- write: fs_write, str_replace, fs_append, delete_file
- shell: execute_pwsh, control_pwsh_process
- web: web_search, fetch_url
- spec: get_diagnostics, get_process_output
- *: matches all

### 3.4 Hook Commands (hook-commands.ts)

Purpose: Register VS Code commands for userTriggered hooks.

```typescript
export class HookCommands {
  private disposables: vscode.Disposable[] = [];
  
  registerCommands(hooks: HookDefinition[]): void {
    this.dispose();
    const userTriggered = hooks.filter(h => h.when.type === "userTriggered" && h.enabled !== false);
    for (const hook of userTriggered) {
      const commandId = kiro-sdlc.hook.+this.sanitizeName(hook.name);
      const disposable = vscode.commands.registerCommand(commandId, async () => {
        await this.executor.executeHook(hook, {});
      });
      this.disposables.push(disposable);
    }
  }
  
  dispose(): void { this.disposables.forEach(d => d.dispose()); }
  private sanitizeName(name: string): string { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
}
```

### 3.5 Schema Validation (enhanced hook-loader.ts)

Valid event types: promptSubmit, agentStop, fileCreated, fileEdited, fileDeleted, userTriggered, preToolUse, postToolUse, preTaskExecution, postTaskExecution

Valid action types: askAgent, runCommand

Validation checks:
1. name: required, non-empty string
2. version: required, non-empty string
3. when: required object with valid type
4. then: required object with valid type
5. then.prompt required if askAgent
6. then.command required if runCommand

Errors logged to "Kiro SDLC" output channel. Invalid hooks skipped, valid ones still load.

---

## 4. API Design

### 4.1 New Message Type (Extension to Webview)

```typescript
| { type: "chat:contextUsage"; payload: ContextUsagePayload }

interface ContextUsagePayload {
  tabId: string;
  conversation: { tokens: number; percentage: number };
  mcpTools: { tokens: number; percentage: number };
  steering: { tokens: number; percentage: number };
  total: { tokens: number; percentage: number; threshold: "safe"|"warning"|"critical"|"full" };
  maxTokens: number;
}
```

### 4.2 VS Code Commands

| Command ID | Label |
|-----------|-------|
| kiro-sdlc.hook.{sanitizedName} | Kiro Hook: {hook.name} |

### 4.3 Extension Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| kiro-sdlc.hooks.maxDepth | number | 3 | Max hook nesting depth |
| kiro-sdlc.hooks.defaultTimeout | number | 60000 | Default runCommand timeout (ms) |
| kiro-sdlc.contextUsage.maxTokens | number | 128000 | Max context window size |

---

## 5. Implementation Checklist

### 5.1 Files to Create

| # | File | Purpose | Priority |
|---|------|---------|----------|
| 1 | src/chat-panel/context-usage-tracker.ts | Token tracking | P1 |
| 2 | src/langgraph/hook-executor.ts | Execute actions | P1 |
| 3 | src/langgraph/hook-events.ts | Event dispatch | P1 |
| 4 | src/langgraph/hook-commands.ts | userTriggered commands | P2 |

### 5.2 Files to Modify

| # | File | Changes | Priority |
|---|------|---------|----------|
| 1 | src/chat-panel/message-protocol.ts | Add chat:contextUsage | P1 |
| 2 | src/chat-panel/chat-panel-provider.ts | Integrate tracker | P1 |
| 3 | src/langgraph/hook-loader.ts | Schema validation | P1 |
| 4 | src/langgraph/pipeline-executor.ts | pre/postTask hooks | P1 |
| 5 | resources/webview-assets/chat/chat.js | Render panel | P1 |
| 6 | resources/webview-assets/chat/chat.css | Panel styles | P1 |
| 7 | package.json | Settings, commands | P2 |

### 5.3 Implementation Order

1. Hook Schema Validation (hook-loader.ts enhancement)
2. Hook Executor (hook-executor.ts)
3. Hook Events Manager (hook-events.ts)
4. Hook Commands (hook-commands.ts)
5. Pipeline Integration (pipeline-executor.ts)
6. Context Usage Tracker (context-usage-tracker.ts)
7. Message Protocol update
8. Chat Panel Provider integration
9. Webview UI (chat.js + chat.css)

---

## 6. Error Handling

### 6.1 Hook Execution Errors

| Error Type | Handling | Recovery |
|-----------|----------|----------|
| JSON parse error | Skip hook, log | Others unaffected |
| runCommand exit != 0 | Log stderr, mark failed | Pipeline continues |
| runCommand timeout | SIGTERM/SIGKILL, timed_out | Pipeline continues |
| askAgent injection fail | Log error | Pipeline continues |
| Circular dependency | Skip, log warning | Top-level runs |
| FORBIDDEN denial | Return error to agent | No retry |

### 6.2 Context Usage Errors

| Error Type | Handling | Recovery |
|-----------|----------|----------|
| Estimation NaN | Use 0 | Bar shows 0% |
| Tab not found | Init empty state | Fresh calc |
| Webview not ready | Queue message | Send on ready |

---

## 7. Security Design

### 7.1 runCommand Security
- Only in VS Code trusted workspace
- User-defined commands (workspace trust model)
- No secret injection
- All commands logged to output channel

### 7.2 preToolUse Denial
- Cannot be bypassed by retry
- All denials logged (hook name, tool, args)
- Denial evaluated before modification

### 7.3 Input Validation
- Hook JSON untrusted — full validation
- Placeholder substitution escapes shell chars
- Tool args serialized with 1000 char limit

---

## 8. Performance

| Area | Approach | Target |
|------|----------|--------|
| Token estimation | char/4 | < 1ms |
| Hook loading | Cached + FileSystemWatcher | < 500ms for 50 hooks |
| Hook execution | Async, non-blocking | < 100ms overhead |
| Context panel | CSS animations | < 16ms |
| runCommand | Timeout | Default 60s |
| FileSystemWatcher | Debounce 300ms | No rapid reloads |

---

## 9. Testing Strategy

### 9.1 Unit Tests

| Module | Focus |
|--------|-------|
| context-usage-tracker.ts | Token calc, threshold, tab lifecycle |
| hook-executor.ts | askAgent/runCommand, timeout, placeholders |
| hook-events.ts | Circular detection, tool classification |
| hook-loader.ts | Schema validation, parse errors |

### 9.2 Integration Tests

| Scenario | Verification |
|----------|-------------|
| Pipeline with hooks | pre/postTask fire correctly |
| preToolUse denial | Tool blocked, error returned |
| Context usage update | Webview gets correct payload |
| userTriggered command | Command executes hook |

---

## 10. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

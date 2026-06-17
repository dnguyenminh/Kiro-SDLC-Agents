# Technical Design Document (TDD)

## Chatbox UI — KSA-252: Context Menu ("#" Trigger)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-252 |
| Title | Context Menu ("#" Trigger) |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-15 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-252.docx |
| Related FSD | FSD-v1-KSA-252.docx |
| Architecture Pattern | Plugin (VS Code Extension) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-15 | SA Agent | Initial TDD — architecture, component design, implementation plan |

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

The Context Menu feature follows a layered plugin architecture within a VS Code Extension webview:

![Architecture Diagram](diagrams/architecture.png)

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Presentation | Webview DOM | Render menu UI, badge chips, picker panels |
| Controller | Webview TypeScript | State machine, event handling, orchestration |
| Service | Webview TypeScript | Fuzzy filter, badge management, data formatting |
| Communication | postMessage bridge | Request/response between webview and extension host |
| Provider | Extension Host | Resolve context data from VS Code APIs |

### 1.2 Design Principles

1. Separation of concerns: UI rendering decoupled from logic via Controller pattern
2. Async-first: All extension host communication is async with timeout handling
3. State machine: Menu lifecycle managed by explicit FSM (prevents invalid transitions)
4. Lazy resolution: Context content resolved only on message submit (not on badge insert)
5. Plugin sandbox: All file access goes through extension host

### 1.3 Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Menu UI | TypeScript + DOM API | Lightweight, no framework overhead |
| State Management | Finite State Machine (custom) | Predictable, testable |
| Fuzzy Filter | Custom implementation | Simple, no dependency |
| Badge Rendering | Custom DOM elements | contentEditable with non-editable islands |
| Communication | VS Code postMessage API | Only IPC available in webview |
| Extension Host | VS Code Extension API | Standard extension development |

---

## 2. Component Design

### 2.1 Component Diagram

![Component Diagram](diagrams/component.png)

### 2.2 Module Structure

```
src/
  webview/
    context-menu/
      ContextMenuController.ts    # State machine + orchestration
      ContextMenuView.ts          # DOM rendering for menu popup
      ContextMenuItems.ts         # Static menu item definitions
      FuzzyFilter.ts              # Fuzzy matching algorithm
      PickerPanel.ts              # Secondary picker rendering
      FilePicker.ts               # File tree picker
      FolderPicker.ts             # Folder tree picker
      ListPicker.ts               # Simple list picker (Spec, Steering, MCP)
      types.ts                    # Shared interfaces
    badges/
      BadgeManager.ts             # Badge CRUD operations
      BadgeRenderer.ts            # DOM rendering for badges
      types.ts                    # Badge interfaces
    bridge/
      MessageBridge.ts            # postMessage request/response
      types.ts                    # Message protocol types
    input/
      InputAreaIntegration.ts     # Integration with input field
  extension/
    providers/
      ContextResolverProvider.ts  # Main resolver orchestrator
      FileTreeProvider.ts         # Workspace file tree
      GitDiffProvider.ts          # Git diff resolution
      TerminalProvider.ts         # Terminal output capture
      DiagnosticsProvider.ts      # Problems/diagnostics
      SpecProvider.ts             # .kiro/specs/ reading
      SteeringProvider.ts         # .kiro/steering/ reading
      McpProvider.ts              # MCP resource discovery
      CurrentFileProvider.ts      # Active editor file
    message-handler/
      ContextMessageHandler.ts    # Handle webview messages
  shared/
    protocol.ts                   # Shared types (webview + extension)
```

### 2.3 Class Design

#### ContextMenuController (State Machine)

```typescript
class ContextMenuController {
  private state: ContextMenuState = 'CLOSED';
  private view: ContextMenuView;
  private badgeManager: BadgeManager;
  private bridge: MessageBridge;
  private filterText: string = '';
  private highlightIndex: number = 0;
  private visibleItems: ContextMenuItem[] = [];

  open(): void;
  close(): void;
  filter(text: string): void;
  openPicker(item: ContextMenuItem): void;
  selectInstant(item: ContextMenuItem): void;
  selectFromPicker(metadata: ContextMetadata): void;
  handleKeyDown(event: KeyboardEvent): void;
  handleItemClick(item: ContextMenuItem): void;
  handleOutsideClick(event: MouseEvent): void;
  handleEscape(): void;
}
```

#### BadgeManager

```typescript
class BadgeManager {
  private badges: Map<string, ContextTagBadge> = new Map();

  insert(badge: ContextTagBadge): void;
  remove(badgeId: string): void;
  getAll(): ContextTagBadge[];
  clear(): void;
  async resolveAll(): Promise<ResolvedContext[]>;
}
```

#### MessageBridge

```typescript
class MessageBridge {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private defaultTimeout: number = 3000;

  async request<T>(message: ContextRequest, timeout?: number): Promise<T>;
  handleResponse(event: MessageEvent): void;
  async getFileTree(): Promise<FileTreeNode[]>;
  async getSpecList(): Promise<string[]>;
  async getFolderTree(): Promise<FolderTreeNode[]>;
  async getSteeringFiles(): Promise<string[]>;
  async getMcpResources(): Promise<McpResourceItem[]>;
  async getActiveFileName(): Promise<string | null>;
  async resolveGitDiff(): Promise<string>;
  async resolveTerminalOutput(lines?: number): Promise<string>;
  async resolveDiagnostics(): Promise<DiagnosticItem[]>;
}
```

#### ContextResolverProvider (Extension Host)

```typescript
class ContextResolverProvider {
  handleMessage(message: ContextRequest): Promise<ContextResponse>;
  dispose(): void;
}
```

---

## 3. Detailed Design

### 3.1 State Machine Implementation

```typescript
type ContextMenuState = 'CLOSED' | 'OPEN' | 'FILTERING' | 'PICKER_OPEN' | 'BADGE_INSERTED';

const TRANSITIONS: StateTransition[] = [
  { from: 'CLOSED', to: 'OPEN', trigger: 'HASH_TYPED' },
  { from: 'OPEN', to: 'FILTERING', trigger: 'CHAR_TYPED' },
  { from: 'OPEN', to: 'PICKER_OPEN', trigger: 'PICKER_SELECTED' },
  { from: 'OPEN', to: 'BADGE_INSERTED', trigger: 'INSTANT_SELECTED' },
  { from: 'OPEN', to: 'CLOSED', trigger: 'DISMISS' },
  { from: 'FILTERING', to: 'PICKER_OPEN', trigger: 'PICKER_SELECTED' },
  { from: 'FILTERING', to: 'BADGE_INSERTED', trigger: 'INSTANT_SELECTED' },
  { from: 'FILTERING', to: 'OPEN', trigger: 'FILTER_CLEARED' },
  { from: 'FILTERING', to: 'CLOSED', trigger: 'DISMISS' },
  { from: 'PICKER_OPEN', to: 'BADGE_INSERTED', trigger: 'ITEM_SELECTED' },
  { from: 'PICKER_OPEN', to: 'OPEN', trigger: 'BACK' },
  { from: 'PICKER_OPEN', to: 'CLOSED', trigger: 'DISMISS' },
  { from: 'BADGE_INSERTED', to: 'CLOSED', trigger: 'AUTO' },
];
```

### 3.2 Fuzzy Filter Algorithm

```typescript
function fuzzyMatch(target: string, query: string): { match: boolean; score: number } {
  const targetLower = target.toLowerCase();
  const queryLower = query.toLowerCase();
  let qi = 0, score = 0, consecutive = 0;
  
  for (let ti = 0; ti < targetLower.length && qi < queryLower.length; ti++) {
    if (targetLower[ti] === queryLower[qi]) {
      qi++;
      consecutive++;
      score += consecutive * 2;
      if (ti === qi - 1) score += 5; // Prefix bonus
    } else {
      consecutive = 0;
    }
  }
  return { match: qi === queryLower.length, score };
}
```

### 3.3 postMessage Communication Pattern

```typescript
class MessageBridge {
  private requestId = 0;
  
  async request<T>(message: ContextRequest, timeout = 3000): Promise<T> {
    const id = `ctx-${++this.requestId}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Timeout: ${message.type} (${timeout}ms)`));
      }, timeout);
      this.pendingRequests.set(id, { resolve, reject, timer });
      this.vscodeApi.postMessage({ ...message, requestId: id });
    });
  }
}
```

### 3.4 Badge DOM Integration

```typescript
class BadgeRenderer {
  createBadgeElement(badge: ContextTagBadge): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = 'context-badge';
    el.contentEditable = 'false';
    el.dataset.badgeId = badge.id;
    el.innerHTML = `
      <span class="badge-icon">${this.getIcon(badge.type)}</span>
      <span class="badge-label">${this.escapeHtml(badge.label)}</span>
      <span class="badge-remove" data-action="remove">&times;</span>
    `;
    return el;
  }
}
```

---

## 4. Error Handling Design

| Category | Example | Strategy |
|----------|---------|----------|
| Communication Timeout | postMessage no response in 3s | Retry UI in picker |
| Empty Results | No files found | Empty state message |
| Large Payload | >10000 items | Virtual scroll + lazy load |
| Extension Host Crash | Host process dies | Error banner + reload |
| Permission Error | File not readable | Skip + warning |

### Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| No git installed | Badge resolves to "No git repository" |
| No active terminal | Badge resolves to "No terminal output" |
| MCP servers offline | Picker shows "No servers available" |
| Very large workspace | File picker shows first 200 + "partial results" |

---

## 5. Performance Design

| Operation | Budget | Strategy |
|-----------|--------|----------|
| Menu open | < 100ms | Pre-render DOM, CSS toggle |
| Fuzzy filter | < 50ms | In-memory, hide/show items |
| File tree load | < 200ms first paint | Skeleton UI, stream |
| Badge insertion | < 16ms (1 frame) | Simple DOM insert |
| Context resolution | < 3000ms per item | Parallel with timeout |

### Optimizations

- DOM pooling: Pre-create menu items, reuse on filter
- Virtual scrolling: For pickers with 1000+ items
- Debounced filter: 30ms debounce
- Lazy tree expansion: Load children on expand
- Request cache: 30s TTL for file tree

---

## 6. Security Design

| Boundary | Enforcement |
|----------|-------------|
| Webview to Host | Structured JSON only |
| File Access | Workspace-scoped, no traversal |
| MCP Resources | Only configured servers |
| Badge Content | HTML-escaped (no XSS) |
| Path Validation | No `..`, no absolute paths |

---

## 7. Accessibility Design

### ARIA Roles

- Menu container: `role="listbox"`, `aria-label="Context sources"`
- Menu items: `role="option"`, `aria-selected`
- Badge: `role="img"`, `aria-label="Context: {label}"`
- Remove button: `aria-label="Remove {label} context"`

### Keyboard Map

| Key | OPEN | FILTERING | PICKER_OPEN |
|-----|------|-----------|-------------|
| Arrow Down | Next item | Next filtered | Navigate picker |
| Arrow Up | Prev item | Prev filtered | Navigate picker |
| Enter | Select | Select | Select |
| Escape | Close | Close | Back to menu |
| Tab | Close + focus next | Close + focus next | Close |

### Screen Reader

```typescript
function announce(message: string): void {
  const el = document.getElementById('sr-announcer');
  el!.textContent = '';
  requestAnimationFrame(() => { el!.textContent = message; });
}
```

---

## 8. Implementation Checklist

### Files to Create (24 files)

| # | File | Priority |
|---|------|----------|
| 1 | src/shared/protocol.ts | P0 |
| 2 | src/webview/bridge/MessageBridge.ts | P0 |
| 3 | src/webview/context-menu/ContextMenuController.ts | P0 |
| 4 | src/webview/context-menu/ContextMenuView.ts | P0 |
| 5 | src/webview/context-menu/ContextMenuItems.ts | P0 |
| 6 | src/webview/context-menu/FuzzyFilter.ts | P0 |
| 7 | src/webview/context-menu/PickerPanel.ts | P0 |
| 8 | src/webview/context-menu/FilePicker.ts | P0 |
| 9 | src/webview/context-menu/FolderPicker.ts | P1 |
| 10 | src/webview/context-menu/ListPicker.ts | P0 |
| 11 | src/webview/context-menu/types.ts | P0 |
| 12 | src/webview/context-menu/styles.css | P0 |
| 13 | src/webview/badges/BadgeManager.ts | P0 |
| 14 | src/webview/badges/BadgeRenderer.ts | P0 |
| 15 | src/webview/badges/types.ts | P0 |
| 16 | src/webview/badges/styles.css | P0 |
| 17 | src/extension/providers/ContextResolverProvider.ts | P0 |
| 18 | src/extension/providers/FileTreeProvider.ts | P0 |
| 19 | src/extension/providers/GitDiffProvider.ts | P1 |
| 20 | src/extension/providers/TerminalProvider.ts | P1 |
| 21 | src/extension/providers/DiagnosticsProvider.ts | P1 |
| 22 | src/extension/providers/SpecProvider.ts | P1 |
| 23 | src/extension/providers/SteeringProvider.ts | P1 |
| 24 | src/extension/providers/McpProvider.ts | P2 |
| 25 | src/extension/providers/CurrentFileProvider.ts | P1 |
| 26 | src/extension/message-handler/ContextMessageHandler.ts | P0 |

### Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | src/webview/input/InputArea.ts | Add "#" detection, badge container |
| 2 | src/extension/extension.ts | Register ContextMessageHandler |
| 3 | src/webview/index.ts | Initialize ContextMenuController |

### Implementation Order

1. Sprint 1: protocol.ts, MessageBridge, Controller, View, FuzzyFilter, Items
2. Sprint 2: BadgeManager, BadgeRenderer, InputArea integration
3. Sprint 3: PickerPanel, FilePicker, ListPicker, FolderPicker
4. Sprint 4: ContextResolverProvider, FileTreeProvider, GitDiffProvider, TerminalProvider
5. Sprint 5: SpecProvider, SteeringProvider, McpProvider, CurrentFileProvider
6. Sprint 6: Accessibility, performance, edge cases

---

## 9. Constraints

| Constraint | Impact |
|-----------|--------|
| Webview sandbox | No direct FS access from webview |
| postMessage serialization | All data must be JSON-serializable |
| VS Code webview lifecycle | Webview may be disposed/recreated |
| Single-threaded webview | Long ops must be async |
| CSP | No inline scripts, restricted styles |

No additional NPM dependencies required — uses only DOM APIs, VS Code API, and TypeScript stdlib.

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

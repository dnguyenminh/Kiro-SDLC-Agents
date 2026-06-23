# Functional Specification Document (FSD)

## Chatbox UI — KSA-252: Context Menu ("#" Trigger)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-252 |
| Title | Context Menu ("#" Trigger) |
| Author | BA Agent + TA Agent |
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
| 1.0 | 2026-06-15 | BA Agent | Initial FSD draft |
| 1.0 | 2026-06-15 | TA Agent | Technical enrichment — API contracts, integration specs, pseudocode |

---

## 1. System Overview

### 1.1 System Context

The Context Menu is a UI component within the Chatbox VS Code Extension webview. It operates in a sandboxed webview environment and communicates with the Extension Host via VS Code's `postMessage` API.

![System Context](diagrams/system-context.png)

### 1.2 Component Boundaries

| Component | Runs In | Technology | Responsibility |
|-----------|---------|------------|----------------|
| ContextMenu UI | Webview (iframe) | TypeScript + DOM | Render menu, handle input, manage badges |
| ContextMenuController | Webview | TypeScript | Orchestrate menu lifecycle, filtering, selection |
| ContextResolver | Extension Host | TypeScript + VS Code API | Resolve file trees, git diff, terminal, diagnostics |
| MessageBridge | Both | postMessage JSON | Communicate between webview and extension host |

---

## 2. Use Cases

### UC-01: Trigger Context Menu

| Field | Value |
|-------|-------|
| ID | UC-01 |
| Actor | User |
| Precondition | Input Area is focused, text cursor active |
| Trigger | User types "#" character |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | User types "#" in input field | |
| 2 | | ContextMenuController detects "#" keystroke |
| 3 | | ContextMenu renders popup above input within 100ms |
| 4 | | Menu displays 9 context categories with icons |

**Alternative Flows:**

| ID | Condition | Flow |
|----|-----------|------|
| AF-01a | "#" typed mid-word (not standalone) | Menu still opens — "#" is always a trigger regardless of position |
| AF-01b | Input field is empty when "#" typed | Menu opens normally, "#" is consumed as trigger |

**Exception Flows:**

| ID | Condition | Flow |
|----|-----------|------|
| EF-01a | Render timeout (>100ms) | Menu appears late but still functional |
| EF-01b | Extension host disconnected | Menu shows only categories that don't need host (badge management) |

---

### UC-02: Navigate and Filter Menu

| Field | Value |
|-------|-------|
| ID | UC-02 |
| Actor | User |
| Precondition | Context Menu is open |
| Trigger | User types characters after "#" OR uses arrow keys |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | User types characters after "#" | |
| 2 | | Fuzzy filter applied to 9 items in real-time |
| 3 | | Matching items re-rendered (non-matching hidden) |
| 4 | User presses Arrow Down/Up | |
| 5 | | Highlight moves to next/previous visible item |
| 6 | User presses Enter | |
| 7 | | Selected item's action triggered |

**Alternative Flows:**

| ID | Condition | Flow |
|----|-----------|------|
| AF-02a | No items match filter | Show empty state "No matching items" |
| AF-02b | Only 1 item matches | Auto-highlight it |

**Exception Flows:**

| ID | Condition | Flow |
|----|-----------|------|
| EF-02a | User presses Escape | Menu closes, no insertion, "#" text removed |
| EF-02b | User clicks outside menu | Menu closes, no insertion, "#" text removed |

---

### UC-03: Select Files Context

| Field | Value |
|-------|-------|
| ID | UC-03 |
| Actor | User |
| Precondition | Context Menu open, "Files" highlighted |
| Trigger | User selects "Files" item |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | User selects "Files" | |
| 2 | | postMessage request sent to Extension Host: `getWorkspaceFileTree` |
| 3 | | Secondary panel renders with file tree |
| 4 | User types to fuzzy-filter files | |
| 5 | | Tree filtered in real-time |
| 6 | User clicks a file | |
| 7 | | Tag badge "#File: {path}" inserted into input |
| 8 | | Context Menu closes |

**Alternative Flows:**

| ID | Condition | Flow |
|----|-----------|------|
| AF-03a | User holds Ctrl/Cmd + click | Multiple files selected, one badge per file |
| AF-03b | User presses Escape in file picker | Return to main Context Menu |

**Exception Flows:**

| ID | Condition | Flow |
|----|-----------|------|
| EF-03a | File tree request times out (>3s) | Show "Loading..." then "Failed to load" with retry |
| EF-03b | Workspace has >10,000 files | Virtual scroll, lazy load, show first 200 |

---

### UC-04: Select Spec Context

| Field | Value |
|-------|-------|
| ID | UC-04 |
| Actor | User |
| Precondition | Context Menu open |
| Trigger | User selects "Spec" |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | User selects "Spec" | |
| 2 | | postMessage: `getSpecList` → Extension Host reads .kiro/specs/ |
| 3 | | Secondary panel shows spec folder names |
| 4 | User selects a spec | |
| 5 | | Tag badge "#Spec: {name}" inserted |
| 6 | | Full content of requirements.md + design.md + tasks.md attached as context |

**Exception Flows:**

| ID | Condition | Flow |
|----|-----------|------|
| EF-04a | No .kiro/specs/ directory | Show "No specs found in workspace" |
| EF-04b | Spec folder missing files | Attach only available files, skip missing |

---

### UC-05: Attach Git Diff (Instant)

| Field | Value |
|-------|-------|
| ID | UC-05 |
| Actor | User |
| Precondition | Context Menu open |
| Trigger | User selects "Git Diff" |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | User selects "Git Diff" | |
| 2 | | Tag badge "#Git Diff" inserted immediately |
| 3 | | Context Menu closes |
| 4 | | (Deferred) On message submit, postMessage: `resolveGitDiff` |

**Exception Flows:**

| ID | Condition | Flow |
|----|-----------|------|
| EF-05a | No git repository | Badge inserted but on submit: "No git changes found" warning |
| EF-05b | Very large diff (>100KB) | Truncate to first 100KB, add "[truncated]" note |

---

### UC-06: Attach Terminal Output (Instant)

| Field | Value |
|-------|-------|
| ID | UC-06 |
| Actor | User |
| Precondition | Context Menu open |
| Trigger | User selects "Terminal" |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | User selects "Terminal" | |
| 2 | | Tag badge "#Terminal" inserted |
| 3 | | Context Menu closes |
| 4 | | (Deferred) On submit, postMessage: `resolveTerminalOutput` (last 100 lines) |

**Exception Flows:**

| ID | Condition | Flow |
|----|-----------|------|
| EF-06a | No active terminal | Badge shows warning icon, on submit: "No terminal output" |

---

### UC-07: Attach Problems (Instant)

| Field | Value |
|-------|-------|
| ID | UC-07 |
| Actor | User |
| Precondition | Context Menu open |
| Trigger | User selects "Problems" |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | User selects "Problems" | |
| 2 | | Tag badge "#Problems" inserted |
| 3 | | Context Menu closes |
| 4 | | (Deferred) On submit, postMessage: `resolveDiagnostics` |

---

### UC-08: Select Folder Context

| Field | Value |
|-------|-------|
| ID | UC-08 |
| Actor | User |
| Precondition | Context Menu open |
| Trigger | User selects "Folder" |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | User selects "Folder" | |
| 2 | | postMessage: `getWorkspaceFolderTree` |
| 3 | | Folder picker shows directory tree (folders only) |
| 4 | User selects a folder | |
| 5 | | Tag badge "#Folder: {path}" inserted |
| 6 | | Recursive file listing attached as context |

---

### UC-09: Attach Current File (Instant)

| Field | Value |
|-------|-------|
| ID | UC-09 |
| Actor | User |
| Precondition | Context Menu open, a file is active in editor |
| Trigger | User selects "Current File" |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | User selects "Current File" | |
| 2 | | postMessage: `getActiveFileName` → returns filename |
| 3 | | Tag badge "#Current File: {filename}" inserted |
| 4 | | Full file content attached on submit |

**Exception Flows:**

| ID | Condition | Flow |
|----|-----------|------|
| EF-09a | No file currently open | Show "No active file" notification |

---

### UC-10: Select Steering Context

| Field | Value |
|-------|-------|
| ID | UC-10 |
| Actor | User |
| Precondition | Context Menu open |
| Trigger | User selects "Steering" |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | User selects "Steering" | |
| 2 | | postMessage: `getSteeringFiles` → reads .kiro/steering/*.md |
| 3 | | Secondary panel shows filenames (without path/extension) |
| 4 | User selects a steering file | |
| 5 | | Tag badge "#Steering: {name}" inserted |
| 6 | | Full markdown content attached as context |

---

### UC-11: Select MCP Resource

| Field | Value |
|-------|-------|
| ID | UC-11 |
| Actor | User |
| Precondition | Context Menu open |
| Trigger | User selects "MCP" |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | User selects "MCP" | |
| 2 | | postMessage: `getMcpResources` → reads MCP server configs |
| 3 | | Secondary panel shows available MCP resources/tools |
| 4 | User selects a resource | |
| 5 | | Tag badge "#MCP: {resource_name}" inserted |
| 6 | | Resource content (tool schema/data) attached |

**Exception Flows:**

| ID | Condition | Flow |
|----|-----------|------|
| EF-11a | No MCP servers configured | Show "No MCP servers configured" empty state |
| EF-11b | MCP server unreachable | Show server name with "unavailable" status |

---

### UC-12: Manage Tag Badges

| Field | Value |
|-------|-------|
| ID | UC-12 |
| Actor | User |
| Precondition | At least one tag badge exists in input |
| Trigger | User wants to remove a badge |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | User positions cursor adjacent to badge | |
| 2 | User presses Backspace | |
| 3 | | Badge removed from input |
| 4 | | Associated context detached from message |

**Alternative Flows:**

| ID | Condition | Flow |
|----|-----------|------|
| AF-12a | User clicks (X) icon on badge | Badge removed |
| AF-12b | User submits message with badges | All badge contexts included in payload |

---

## 3. Business Rules

| ID | Rule | Category |
|----|------|----------|
| BR-01 | "#" character ALWAYS triggers Context Menu regardless of cursor position in input | Trigger |
| BR-02 | Context Menu appears within 100ms of "#" keystroke | Performance |
| BR-03 | Fuzzy filter updates within 50ms of each keystroke | Performance |
| BR-04 | Escape or click-outside ALWAYS dismisses menu without side effects | Interaction |
| BR-05 | Instant categories insert badge immediately (no picker) | Behavior |
| BR-06 | Picker categories open secondary panel before badge insertion | Behavior |
| BR-07 | Tag badges are non-editable inline chips | Display |
| BR-08 | Badges removable via Backspace (adjacent cursor) or (X) click | Management |
| BR-09 | Multiple badges can coexist in same input | Composability |
| BR-10 | File picker supports multi-select via Ctrl/Cmd+click | Multi-select |
| BR-11 | MCP item shows "Model Context Protocol ->" sublabel | Display |
| BR-12 | Steering files shown without path/extension (filename only) | Display |
| BR-13 | Git Diff attaches both unstaged + staged changes | Data |
| BR-14 | Terminal attaches last 100 lines from active terminal | Data |
| BR-15 | Folder attaches recursive file listing of selected folder | Data |

---

## 4. Data Specifications

### 4.1 Context Tag Badge Data Model

```typescript
interface ContextTagBadge {
  id: string;                    // Unique ID (uuid)
  type: ContextSourceType;       // Enum of 9 types
  label: string;                 // Display text (e.g., "#File: main.ts")
  icon: string;                  // Icon identifier
  metadata: ContextMetadata;     // Type-specific data
  resolvedContent?: string;      // Filled on message submit
}

type ContextSourceType = 
  | 'files' | 'spec' | 'git-diff' | 'terminal' 
  | 'problems' | 'folder' | 'current-file' 
  | 'steering' | 'mcp';

interface ContextMetadata {
  // Files
  filePaths?: string[];
  // Spec  
  specName?: string;
  // Folder
  folderPath?: string;
  // Steering
  steeringFile?: string;
  // MCP
  mcpServer?: string;
  mcpResource?: string;
  // Current File
  activeFileName?: string;
}
```

### 4.2 Context Menu Item Schema

```typescript
interface ContextMenuItem {
  id: ContextSourceType;
  label: string;
  icon: string;           // Icon component name
  type: 'instant' | 'picker' | 'submenu';
  subLabel?: string;      // e.g., "Model Context Protocol →" for MCP
}

const CONTEXT_MENU_ITEMS: ContextMenuItem[] = [
  { id: 'files',        label: 'Files',        icon: 'folder',          type: 'picker' },
  { id: 'spec',         label: 'Spec',         icon: 'document',        type: 'picker' },
  { id: 'git-diff',     label: 'Git Diff',     icon: 'plus',            type: 'instant' },
  { id: 'terminal',     label: 'Terminal',      icon: 'terminal',        type: 'instant' },
  { id: 'problems',     label: 'Problems',      icon: 'warning',         type: 'instant' },
  { id: 'folder',       label: 'Folder',        icon: 'folder',          type: 'picker' },
  { id: 'current-file', label: 'Current File',  icon: 'document',        type: 'instant' },
  { id: 'steering',     label: 'Steering',      icon: 'steering-wheel',  type: 'picker' },
  { id: 'mcp',          label: 'MCP',           icon: 'gem',             type: 'submenu', subLabel: 'Model Context Protocol →' },
];
```

### 4.3 postMessage Protocol

```typescript
// Webview → Extension Host (Requests)
type ContextRequest = 
  | { type: 'getWorkspaceFileTree' }
  | { type: 'getSpecList' }
  | { type: 'getWorkspaceFolderTree' }
  | { type: 'getSteeringFiles' }
  | { type: 'getMcpResources' }
  | { type: 'getActiveFileName' }
  | { type: 'resolveGitDiff' }
  | { type: 'resolveTerminalOutput'; lines?: number }
  | { type: 'resolveDiagnostics' }
  | { type: 'resolveFileContent'; paths: string[] }
  | { type: 'resolveSpecContent'; specName: string }
  | { type: 'resolveSteeringContent'; fileName: string }
  | { type: 'resolveMcpResource'; server: string; resource: string }
  | { type: 'resolveFolderListing'; folderPath: string };

// Extension Host → Webview (Responses)
type ContextResponse =
  | { type: 'workspaceFileTree'; data: FileTreeNode[] }
  | { type: 'specList'; data: string[] }
  | { type: 'workspaceFolderTree'; data: FolderTreeNode[] }
  | { type: 'steeringFiles'; data: string[] }
  | { type: 'mcpResources'; data: McpResourceItem[] }
  | { type: 'activeFileName'; data: string | null }
  | { type: 'gitDiff'; data: string }
  | { type: 'terminalOutput'; data: string }
  | { type: 'diagnostics'; data: DiagnosticItem[] }
  | { type: 'fileContent'; data: { path: string; content: string }[] }
  | { type: 'specContent'; data: { requirements: string; design: string; tasks: string } }
  | { type: 'steeringContent'; data: string }
  | { type: 'mcpResourceContent'; data: string }
  | { type: 'folderListing'; data: string[] }
  | { type: 'error'; message: string; requestType: string };

interface FileTreeNode {
  name: string;
  path: string;       // Relative to workspace root
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

interface FolderTreeNode {
  name: string;
  path: string;
  children?: FolderTreeNode[];
}

interface McpResourceItem {
  server: string;
  name: string;
  type: 'tool' | 'resource' | 'prompt';
  description?: string;
}

interface DiagnosticItem {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
}
```

---

## 5. UI Specifications

### 5.1 Context Menu Popup

| Property | Value |
|----------|-------|
| Position | Directly above Input Area, left-aligned with text field |
| Width | 280px |
| Max Height | 400px (scrollable if needed) |
| Background | #2d2d3d (dark panel) |
| Border | 1px solid #3d3d5c |
| Border Radius | 8px |
| Box Shadow | 0 4px 12px rgba(0,0,0,0.3) |
| Z-index | 1000 (above all other UI) |
| Animation | fadeIn 100ms ease-out |

### 5.2 Menu Item

| Property | Value |
|----------|-------|
| Height | 36px |
| Padding | 8px 12px |
| Icon Size | 16x16px |
| Icon Color | #a0a0c0 |
| Label Font | 13px, #e0e0e0 |
| SubLabel Font | 11px, #808090 |
| Hover Background | #3d3d5c |
| Highlight Background | #4d4d6c (keyboard navigation) |
| Border Radius (item) | 4px |

### 5.3 Tag Badge

| Property | Value |
|----------|-------|
| Display | inline-flex |
| Background | #3d3d5c |
| Border | 1px solid #5d5d7c |
| Border Radius | 12px |
| Padding | 2px 8px |
| Font Size | 12px |
| Color | #c0c0e0 |
| (X) Icon | 12x12, visible on hover |
| Margin | 0 4px |
| Max Width | 200px (ellipsis overflow) |

### 5.4 Secondary Picker Panel

| Property | Value |
|----------|-------|
| Width | 320px |
| Max Height | 400px |
| Position | Replaces or extends Context Menu area |
| Search Input | Top of panel, 32px height |
| Item Height | 28px |
| Virtual Scroll | Enabled for lists > 100 items |

---

## 6. State Machine

### 6.1 Context Menu States

![State Diagram](diagrams/state-context-menu.png)

| State | Description | Transitions Out |
|-------|-------------|-----------------|
| CLOSED | Menu not visible | → OPEN (on "#" typed) |
| OPEN | Main menu displayed with 9 items | → FILTERING, → PICKER_OPEN, → CLOSED |
| FILTERING | User typing filter text | → OPEN (clear filter), → PICKER_OPEN (select), → CLOSED |
| PICKER_OPEN | Secondary picker panel visible | → BADGE_INSERTED (select item), → OPEN (back), → CLOSED |
| BADGE_INSERTED | Transient state — badge added | → CLOSED (auto) |

### 6.2 Transitions

| From | To | Trigger |
|------|-----|---------|
| CLOSED | OPEN | "#" typed in input |
| OPEN | FILTERING | User types character after "#" |
| OPEN | PICKER_OPEN | User selects picker category |
| OPEN | BADGE_INSERTED | User selects instant category |
| OPEN | CLOSED | Escape / click-outside |
| FILTERING | OPEN | User clears filter text |
| FILTERING | PICKER_OPEN | User selects from filtered list (picker) |
| FILTERING | BADGE_INSERTED | User selects from filtered list (instant) |
| FILTERING | CLOSED | Escape / click-outside |
| PICKER_OPEN | BADGE_INSERTED | User selects item in picker |
| PICKER_OPEN | OPEN | User presses back/Escape in picker |
| PICKER_OPEN | CLOSED | Escape (from picker root) / click-outside |
| BADGE_INSERTED | CLOSED | Auto-transition after badge inserted |

---

## 7. Integration Requirements

### 7.1 VS Code Extension Host Communication

| Request | VS Code API Used | Timeout |
|---------|-----------------|---------|
| getWorkspaceFileTree | `vscode.workspace.findFiles('**/*')` | 3000ms |
| getSpecList | `vscode.workspace.fs.readDirectory(specsUri)` | 1000ms |
| getWorkspaceFolderTree | `vscode.workspace.findFiles('**/', ...)` | 3000ms |
| getSteeringFiles | `vscode.workspace.fs.readDirectory(steeringUri)` | 1000ms |
| getMcpResources | Read .kiro/settings/mcp.json + query servers | 5000ms |
| getActiveFileName | `vscode.window.activeTextEditor?.document.fileName` | 100ms |
| resolveGitDiff | `vscode.extensions.getExtension('vscode.git')` | 3000ms |
| resolveTerminalOutput | `vscode.window.terminals[active].processId` | 1000ms |
| resolveDiagnostics | `vscode.languages.getDiagnostics()` | 500ms |

### 7.2 Error Handling

| Error | User Feedback | Recovery |
|-------|---------------|----------|
| postMessage timeout | "Unable to load {category}. Try again." | Retry button in picker |
| Extension host crash | "Extension disconnected. Reload window." | Full page reload |
| Empty results | "{category} is empty" message in picker | Allow dismiss |
| Large payload (>1MB) | "Content too large, truncating..." | Truncate with note |

---

## 8. Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-01 | Performance | Menu popup latency | < 100ms |
| NFR-02 | Performance | Fuzzy filter response | < 50ms |
| NFR-03 | Performance | File tree initial load | < 200ms (first 50 items) |
| NFR-04 | Performance | Badge insertion | < 16ms (single frame) |
| NFR-05 | Accessibility | Keyboard navigation | Full support (Up/Down/Enter/Escape) |
| NFR-06 | Accessibility | ARIA roles | listbox, option, combobox |
| NFR-07 | Accessibility | Focus management | Returns to input after dismiss |
| NFR-08 | Accessibility | Screen reader | aria-live announcements |
| NFR-09 | Compatibility | VS Code version | 1.80+ |
| NFR-10 | Security | File access scope | Workspace only |
| NFR-11 | Usability | Touch targets | >= 44x44px |
| NFR-12 | Memory | Max badge count per message | 20 badges |

---

## 9. Pseudocode — Key Logic

### 9.1 Context Menu Trigger Detection

```typescript
function handleInputKeyDown(event: KeyboardEvent): void {
  if (event.key === '#') {
    // Open context menu immediately
    contextMenuState = 'OPEN';
    filterText = '';
    renderContextMenu(CONTEXT_MENU_ITEMS);
    startTimer('menu_render', 100); // Perf SLA check
  }
}
```

### 9.2 Fuzzy Filter Algorithm

```typescript
function fuzzyFilter(items: ContextMenuItem[], query: string): ContextMenuItem[] {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items.filter(item => {
    const label = item.label.toLowerCase();
    let qi = 0;
    for (let li = 0; li < label.length && qi < lower.length; li++) {
      if (label[li] === lower[qi]) qi++;
    }
    return qi === lower.length;
  });
}
```

### 9.3 Badge Insertion

```typescript
function insertContextBadge(type: ContextSourceType, metadata: ContextMetadata): void {
  const badge: ContextTagBadge = {
    id: generateUUID(),
    type,
    label: formatBadgeLabel(type, metadata),
    icon: getIconForType(type),
    metadata,
  };
  inputArea.insertBadge(badge);
  contextMenuState = 'CLOSED';
}

function formatBadgeLabel(type: ContextSourceType, meta: ContextMetadata): string {
  switch (type) {
    case 'files': return `#File: ${meta.filePaths?.[0] ?? ''}`;
    case 'spec': return `#Spec: ${meta.specName}`;
    case 'git-diff': return '#Git Diff';
    case 'terminal': return '#Terminal';
    case 'problems': return '#Problems';
    case 'folder': return `#Folder: ${meta.folderPath}`;
    case 'current-file': return `#Current File: ${meta.activeFileName}`;
    case 'steering': return `#Steering: ${meta.steeringFile}`;
    case 'mcp': return `#MCP: ${meta.mcpResource}`;
  }
}
```

### 9.4 Context Resolution on Submit

```typescript
async function resolveAllBadgeContexts(badges: ContextTagBadge[]): Promise<ResolvedContext[]> {
  const resolvePromises = badges.map(badge => resolveContext(badge));
  return Promise.allSettled(resolvePromises).then(results =>
    results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<ResolvedContext>).value)
  );
}

async function resolveContext(badge: ContextTagBadge): Promise<ResolvedContext> {
  switch (badge.type) {
    case 'files':
      return postMessageRequest({ type: 'resolveFileContent', paths: badge.metadata.filePaths! });
    case 'git-diff':
      return postMessageRequest({ type: 'resolveGitDiff' });
    case 'terminal':
      return postMessageRequest({ type: 'resolveTerminalOutput', lines: 100 });
    // ... etc
  }
}
```

---

## 10. Open Issues

| # | Issue | Impact | Decision Needed |
|---|-------|--------|-----------------|
| 1 | Should "#" in middle of URL/code be treated as trigger? | Medium | Product decision — current spec says always trigger |
| 2 | Max number of context badges per message? | Low | Suggest 20 max |
| 3 | Should resolved content be cached across messages? | Medium | Performance vs freshness tradeoff |
| 4 | MCP resource discovery — real-time or cached? | Medium | Depends on MCP server response time |

---

## 11. Sequence Diagrams

### 11.1 Instant Category Flow (Git Diff)

![Sequence — Instant](diagrams/sequence-instant.png)

### 11.2 Picker Category Flow (Files)

![Sequence — Picker](diagrams/sequence-picker.png)

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | State Machine | [state-context-menu.png](diagrams/state-context-menu.png) | [state-context-menu.drawio](diagrams/state-context-menu.drawio) |
| 3 | Sequence — Instant | [sequence-instant.png](diagrams/sequence-instant.png) | [sequence-instant.drawio](diagrams/sequence-instant.drawio) |
| 4 | Sequence — Picker | [sequence-picker.png](diagrams/sequence-picker.png) | [sequence-picker.drawio](diagrams/sequence-picker.drawio) |

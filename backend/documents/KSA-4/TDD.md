# Technical Design Document (TDD)

## Kiro SDLC Agents Extension — KSA-4: Indexer Selection — Choose ONE Language

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-4 |
| Title | Indexer Selection — Choose ONE Language |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-07-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-4.docx |
| Related FSD | FSD-v1-KSA-4.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | SA Agent – Solution Architect | Create document |
| Peer Reviewer | TA Agent – Technical Analyst | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-10 | SA Agent | Initiate document — technical design from FSD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the technical design in this TDD |
| | ☐ I agree and confirm the technical design in this TDD |

---

## 1. Introduction

> **Scope Boundary:** This TDD specifies HOW to implement the Indexer Selection feature defined in the FSD. It does NOT repeat functional requirements, business rules, or use cases — refer to the FSD for those. This document focuses on: implementation patterns, code structure, and integration with existing modules.

### 1.1 Purpose

This TDD describes the technical implementation of the Indexer Selection QuickPick UI within the Kiro SDLC Agents VS Code extension. The feature is already implemented in the current codebase (`injector.ts` → `pickIndexer()` function). This document serves as the authoritative technical reference for the implementation.

### 1.2 Scope

- `pickIndexer()` function implementation in `injector.ts`
- `INDEXER_OPTIONS` and `INDEXER_BASE` configuration in `config.ts`
- Integration with `injectAll()` and `injectSelective()` flows
- File copy mechanics (filtered copy for base, recursive copy for language)

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | ^5.4.0 |
| Runtime | Node.js (VS Code Extension Host) | ^20.0.0 |
| Framework | VS Code Extension API | ^1.85.0 |
| Build Tool | tsc (TypeScript Compiler) | ^5.4.0 |
| Package Tool | @vscode/vsce | ^2.24.0 |
| Module System | CommonJS (compiled from ES modules) | — |

### 1.4 Design Principles

- **Single Responsibility**: `pickIndexer()` only handles UI selection; file copy is delegated to `injectComponent()`
- **Configuration-Driven**: All indexer options defined in `config.ts` — no hardcoded values in logic
- **Graceful Degradation**: Cancellation returns undefined; callers handle gracefully
- **No External Dependencies**: Uses only VS Code API and Node.js stdlib

### 1.5 Constraints

- Must work within VS Code Extension Host (no direct DOM access)
- QuickPick API is async — must use `await`
- File operations use synchronous `fs` methods (acceptable for small file sets)
- Extension resources path resolved via `context.extensionPath`

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-4.docx |
| FSD | FSD-v1-KSA-4.docx |
| VS Code Extension API | https://code.visualstudio.com/api |

---

## 2. System Architecture

### 2.1 Architecture Overview

The Indexer Selection feature is a thin UI layer within the existing extension architecture. It follows the Command → Handler → Module → File System pattern established by KSA-2 and KSA-3.

![Architecture Diagram](diagrams/architecture.png)

```
┌─────────────────────────────────────────────────────────┐
│ VS Code Extension Host                                   │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │ extension.ts │───▶│ injector.ts  │───▶│ config.ts │ │
│  │ (commands)   │    │ (logic)      │    │ (data)    │ │
│  └──────────────┘    └──────┬───────┘    └───────────┘ │
│                             │                            │
│                    ┌────────┴────────┐                   │
│                    │                 │                    │
│              ┌─────▼─────┐   ┌──────▼──────┐           │
│              │ QuickPick  │   │ File System  │           │
│              │ (VS Code)  │   │ (Node.js fs) │           │
│              └────────────┘   └─────────────┘           │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| `extension.ts` | Command registration, entry point | VS Code Extension API |
| `injector.ts` | Injection orchestration, `pickIndexer()` | TypeScript, VS Code API |
| `config.ts` | Static configuration (INDEXER_OPTIONS, INDEXER_BASE) | TypeScript constants |
| `checksum.ts` | File modification detection | Node.js crypto + fs |
| `indexer.ts` | Runtime detection and indexer execution | Node.js child_process |

### 2.3 Deployment Architecture

The extension is packaged as a `.vsix` file and installed in VS Code's extension directory. No server-side deployment — entirely client-side.

```
Extension Package (.vsix)
├── out/                    ← Compiled JavaScript
│   ├── extension.js
│   ├── injector.js
│   ├── config.js
│   ├── checksum.js
│   └── indexer.js
├── resources/              ← Bundled SDLC resources
│   └── .analysis/
│       └── code-intelligence/
│           ├── index-config.json
│           ├── modules/
│           └── scripts/
│               ├── README.md
│               ├── python/
│               ├── java/
│               ├── powershell/
│               ├── bash/
│               └── nodejs/
└── package.json
```

### 2.4 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| extension.ts | injector.ts | Function call | Sync (await) | handleInjectAll → injectAll() |
| injector.ts | VS Code API | Function call | Async (Promise) | showQuickPick() returns selection |
| injector.ts | Node.js fs | Function call | Sync | copyDirRecursive(), copyFiltered() |
| injector.ts | config.ts | Import | Static | Reads INDEXER_OPTIONS, INDEXER_BASE |

---

## 3. API Design

> **Prerequisite:** Functional API contracts are defined in FSD §3.1.6. This section specifies the technical implementation details.

### 3.1 API Overview

| # | Function | Module | Description | Source |
|---|----------|--------|-------------|--------|
| 1 | `pickIndexer()` | injector.ts | Shows QuickPick, returns Component | UC-1 |
| 2 | `injectAll()` | injector.ts | Full injection with indexer selection | UC-1, UC-2, UC-3 |
| 3 | `injectSelective()` | injector.ts | Selective injection with optional indexer | UC-1 |
| 4 | `injectComponent()` | injector.ts | Copies single component to workspace | UC-2, UC-3 |
| 5 | `copyFiltered()` | injector.ts | Copies only whitelisted items | UC-2 |
| 6 | `copyDirRecursive()` | injector.ts | Recursive directory copy with exclusions | UC-3 |

---

### 3.2 Function: pickIndexer()

**Implements:** UC-1 (Select Indexer Language)

| Attribute | Value |
|-----------|-------|
| Module | `injector.ts` |
| Visibility | `async function` (module-private) |
| Returns | `Promise<Component \| undefined>` |
| Side Effects | Displays VS Code QuickPick UI |

**Implementation:**

```typescript
async function pickIndexer(): Promise<Component | undefined> {
    const picks = INDEXER_OPTIONS.map(c => ({
        label: c.label,
        description: c.description,
        component: c
    }));
    const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: false,
        placeHolder: "Choose ONE indexer language for this workspace"
    });
    return selected?.component;
}
```

**Parameters:** None (reads from INDEXER_OPTIONS import)

**Return Value:**

| Case | Return | Description |
|------|--------|-------------|
| User selects an option | `Component` | The INDEXER_OPTIONS entry matching selection |
| User cancels (ESC) | `undefined` | No selection made |
| User clicks outside | `undefined` | QuickPick dismissed |

**Error Handling:**

| Error | Handling | Recovery |
|-------|----------|----------|
| VS Code API unavailable | Not possible — extension host guarantees API | — |
| INDEXER_OPTIONS empty | QuickPick shows empty list | User cancels → undefined |

---

### 3.3 Function: injectAll()

**Implements:** UC-1 + UC-2 + UC-3

| Attribute | Value |
|-----------|-------|
| Module | `injector.ts` |
| Visibility | `export async function` |
| Returns | `Promise<string[]>` (injected component IDs) |

**Relevant Indexer Section:**

```typescript
// After copying CORE_COMPONENTS...
const indexerChoice = await pickIndexer();
if (indexerChoice) {
    await injectComponent(INDEXER_BASE, root, extensionPath);  // Always copy base
    if (await injectComponent(indexerChoice, root, extensionPath)) {
        injected.push(indexerChoice.id);
    }
}
```

**Flow:**
1. Copy all 4 CORE_COMPONENTS (agents, steering, hooks, templates)
2. Call `pickIndexer()` → get user's language choice
3. If choice is not undefined:
   a. Copy INDEXER_BASE (filtered: index-config.json, modules/, scripts/README.md)
   b. Copy selected language directory (recursive)
4. Save workspace version
5. Return list of injected component IDs

---

### 3.4 Function: injectComponent()

**Implements:** File copy for any Component

| Attribute | Value |
|-----------|-------|
| Module | `injector.ts` |
| Visibility | `async function` (module-private) |
| Returns | `Promise<boolean>` |

**Logic:**

```typescript
async function injectComponent(
    component: Component, workspaceRoot: string, extensionPath: string
): Promise<boolean> {
    const source = path.join(extensionPath, "resources", component.sourcePath);
    const target = path.join(workspaceRoot, component.targetPath);

    if (!fs.existsSync(source)) {
        vscode.window.showWarningMessage(`Source not found: ${component.sourcePath}`);
        return false;
    }
    try {
        if (component.filter) {
            copyFiltered(source, target, component.filter);
        } else {
            copyDirRecursive(source, target);
        }
        return true;
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to inject ${component.id}: ${err}`);
        return false;
    }
}
```

**Decision Logic:**

| Condition | Action | Used By |
|-----------|--------|---------|
| `component.filter` exists | `copyFiltered()` | INDEXER_BASE |
| `component.filter` is undefined | `copyDirRecursive()` | INDEXER_OPTIONS entries |

---

## 4. Database Design

> Not applicable — this feature has no database. All data is static TypeScript configuration.

---

## 5. Class / Module Design

### 5.1 Package Structure

```
kiro-sdlc-agents/src/
├── extension.ts      ← Entry point: command registration
├── injector.ts       ← Core logic: injectAll, pickIndexer, copy functions
├── config.ts         ← Configuration: INDEXER_OPTIONS, INDEXER_BASE, CORE_COMPONENTS
├── checksum.ts       ← File modification detection (not KSA-4 scope)
└── indexer.ts        ← Runtime detection & execution (not KSA-4 scope)
```

### 5.2 Key Interfaces

```typescript
// config.ts
export interface Component {
    id: string;           // Unique identifier (e.g., "indexer-python")
    label: string;        // QuickPick primary text
    description: string;  // QuickPick secondary text
    sourcePath: string;   // Relative to extension resources/
    targetPath: string;   // Relative to workspace root
    filter?: string[];    // Optional whitelist for filtered copy
}
```

```typescript
// Internal QuickPick item type (injector.ts)
interface IndexerPickItem {
    label: string;        // From Component.label
    description: string;  // From Component.description
    component: Component; // Reference back to config
}
```

### 5.3 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Configuration Object | `config.ts` INDEXER_OPTIONS | Separates data from logic; easy to extend |
| Adapter | `picks` mapping in pickIndexer() | Adapts Component to VS Code QuickPickItem |
| Strategy | `injectComponent()` filter check | Chooses copy strategy based on component config |
| Null Object | `undefined` return from pickIndexer() | Callers handle absence without null checks |

### 5.4 Error Handling

| Exception | Behavior | Error Code | When Thrown |
|-----------|----------|------------|------------|
| Source not found | Warning message + return false | — | Extension resources missing/corrupt |
| Copy failure (EACCES) | Error message + return false | — | Target directory not writable |
| Copy failure (ENOSPC) | Error message + return false | — | Disk full |

---

## 6. Integration Design

> **Prerequisite:** Business integration requirements defined in FSD §5.

### 6.1 Internal Integration: Extension Commands → Injector

| Attribute | Value |
|-----------|-------|
| Protocol | TypeScript function call (async/await) |
| Caller | `extension.ts` → `handleInjectAll()` |
| Callee | `injector.ts` → `injectAll()` |
| Timeout | None (user-driven — QuickPick blocks until selection) |
| Retry Policy | None (user can re-invoke command) |

**Sequence Diagram:**

![API Sequence — Inject All](diagrams/api-sequence-inject-all.png)

### 6.2 External Integration: VS Code QuickPick API

| Attribute | Value |
|-----------|-------|
| Protocol | VS Code Extension API (in-process) |
| Endpoint | `vscode.window.showQuickPick()` |
| Authentication | None (extension host context) |
| Timeout | None (waits for user interaction) |
| Retry Policy | None |

**API Signature:**

```typescript
function showQuickPick<T extends QuickPickItem>(
    items: T[],
    options?: QuickPickOptions
): Thenable<T | undefined>
```

**Options Used:**

```typescript
{
    canPickMany: false,                                    // Single-select
    placeHolder: "Choose ONE indexer language for this workspace"  // Hint text
}
```

---

## 7. Security Design

### 7.1 Authentication

Not applicable — local extension, no network calls, no authentication required.

### 7.2 Authorization

| Role | Access | Permissions |
|------|--------|-------------|
| Any VS Code user | Full | Can select any indexer, copy files to workspace |

### 7.3 Data Protection

| Data Type | At Rest | In Transit | In Logs |
|-----------|---------|------------|---------|
| Indexer scripts | Plain text (source code) | N/A (local only) | Not logged |
| Workspace paths | Plain text | N/A (local only) | Logged in Output Channel |

### 7.4 Input Validation

| Field | Validation | Sanitization |
|-------|-----------|--------------|
| QuickPick selection | Must be from INDEXER_OPTIONS (type-safe) | None needed — VS Code API guarantees valid item |
| File paths | `fs.existsSync()` check before copy | `path.join()` prevents path traversal |

---

## 8. Performance & Scalability

### 8.1 Caching Strategy

| Cache | What | TTL | Eviction | Technology |
|-------|------|-----|----------|------------|
| None | — | — | — | — |

No caching needed — INDEXER_OPTIONS is a static array (5 items), QuickPick renders instantly.

### 8.2 Connection Pooling

Not applicable — no network connections.

### 8.3 Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| QuickPick display | < 50ms | Time from pickIndexer() call to UI visible |
| Base config copy | < 100ms | Time to copy 3 items (config, modules dir, README) |
| Language script copy | < 500ms | Time to recursively copy one language directory |
| Total injection (all) | < 2s | End-to-end including all CORE_COMPONENTS + indexer |

---

## 9. Monitoring & Observability

### 9.1 Logging

| Log Event | Level | Fields | Destination |
|-----------|-------|--------|-------------|
| Injection started | INFO | component IDs | VS Code Output Channel |
| Source not found | WARN | sourcePath | VS Code Warning Message |
| Copy failed | ERROR | component ID, error message | VS Code Error Message |
| Injection complete | INFO | injected count, component list | VS Code Info Message |

### 9.2 Metrics

Not applicable — VS Code extensions don't typically emit metrics for local operations.

### 9.3 Health Checks

| Check | Method | Expected |
|-------|--------|----------|
| Extension activated | Status bar visible | "$(check) SDLC Agents" or "$(warning) SDLC Agents" |
| Indexer present | `checkStatus()` | `indexer: true` if index-config.json exists |

---

## 10. Deployment Considerations

### 10.1 Environment Configuration

| Property | DEV | Production (installed) |
|----------|-----|----------------------|
| Extension path | `./out` (local) | `~/.vscode/extensions/kiro-sdlc-agents-x.x.x/` |
| Resources path | `./resources` | `{extensionPath}/resources/` |
| Compile | `tsc -watch` | `vsce package` → `.vsix` |

### 10.2 Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `kiroSdlc.preferredIndexer` | "auto" | If set to specific language, `runIndex` uses it directly (bypasses picker for execution, not injection) |
| `kiroSdlc.autoIndex` | true | Auto-run indexer after injection if indexer was injected |

### 10.3 Rollback Strategy

- Extension can be downgraded via VS Code extension management
- Injected files can be deleted manually from workspace
- No persistent state beyond copied files — safe to re-inject at any time

---

## 11. Implementation Checklist

### Files to Create/Modify

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `src/config.ts` | EXISTS | INDEXER_OPTIONS and INDEXER_BASE already defined |
| 2 | `src/injector.ts` | EXISTS | `pickIndexer()` already implemented |
| 3 | `src/extension.ts` | EXISTS | Command handlers already call injectAll/injectSelective |
| 4 | `package.json` | EXISTS | Commands and settings already registered |

### Implementation Status

This feature is **already fully implemented** in the current codebase. The TDD documents the existing implementation for reference and future maintenance.

| Component | Status | Location |
|-----------|--------|----------|
| INDEXER_OPTIONS config | ✅ Done | `src/config.ts` lines 47-82 |
| INDEXER_BASE config | ✅ Done | `src/config.ts` lines 39-45 |
| pickIndexer() function | ✅ Done | `src/injector.ts` (pickIndexer function) |
| injectAll() integration | ✅ Done | `src/injector.ts` (injectAll function) |
| injectSelective() integration | ✅ Done | `src/injector.ts` (injectSelective function) |
| copyFiltered() for base | ✅ Done | `src/injector.ts` (copyFiltered function) |
| copyDirRecursive() for language | ✅ Done | `src/injector.ts` (copyDirRecursive function) |

---

## 12. Appendix

### Glossary

| Term | Definition |
|------|------------|
| QuickPick | VS Code's built-in list selection UI component |
| Component | TypeScript interface representing an injectable resource set |
| INDEXER_OPTIONS | Array of 5 Component objects for indexer languages |
| INDEXER_BASE | Component object for base config (always copied) |
| Filtered Copy | Copy only whitelisted items from a directory |
| Recursive Copy | Copy entire directory tree, skipping excluded dirs |

### Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Should we pre-select based on detected runtime? | Resolved | No — KSA-5 handles runtime detection separately for `runIndex` |
| 2 | Should we allow changing indexer after initial injection? | Resolved | Yes — user can re-inject; old language dir stays, new one added |
| 3 | Should we show a "recommended" badge on Python? | Resolved | Yes — included in label text "(recommended — zero dependency)" |

---

## ⛔ MANDATORY: Diagram Requirements

### Required draw.io Diagrams

| # | Diagram | File | Section | Required |
|---|---------|------|---------|----------|
| 1 | Architecture Overview | `diagrams/architecture.drawio` + `.png` | §2.1 | ✅ MANDATORY |
| 2 | Component Diagram | `diagrams/component.drawio` + `.png` | §2.2 | ✅ MANDATORY |
| 3 | API Sequence — Inject All | `diagrams/api-sequence-inject-all.drawio` + `.png` | §6.1 | ✅ MANDATORY |
| 4 | Class Diagram | `diagrams/class-diagram.drawio` + `.png` | §5.x | ✅ MANDATORY |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
| 3 | API Sequence — Inject All | [api-sequence-inject-all.png](diagrams/api-sequence-inject-all.png) | [api-sequence-inject-all.drawio](diagrams/api-sequence-inject-all.drawio) |
| 4 | Class Diagram | [class-diagram.png](diagrams/class-diagram.png) | [class-diagram.drawio](diagrams/class-diagram.drawio) |

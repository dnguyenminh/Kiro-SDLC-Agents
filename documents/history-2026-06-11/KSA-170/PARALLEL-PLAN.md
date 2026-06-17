# Parallel Execution Plan — KSA-170: Code Intelligence UI

## Epic Overview

| Field | Value |
|-------|-------|
| Epic Key | KSA-170 |
| Summary | Code Intelligence UI — VS Code Extension Capabilities |
| Parent Epic | KSA-144 (Code Intelligence v2 — Graph Engine + Static Analysis) |
| Total Tickets | 10 |
| Parallel Batches | 4 |

## Dependency Graph

```
Batch A (Foundation) ─────────────────────────────────────────
  ├── KSA-180: Settings & Configuration  ◄── ALL others depend on this
  ├── KSA-179: Symbol Search (Quick Pick)
  └── KSA-175: Entry Point Explorer (TreeView)
         │
         ▼ (after Batch A completes)
┌────────┼────────────────────────────────────────────────────┐
│        │                                                     │
▼        ▼                          ▼                          ▼
Batch B  Batch C                    Batch D
(Viz)    (Quality)                  (Commands)
├─ KSA-171: Graph Viz TreeView     ├─ KSA-174: Impact Analysis
├─ KSA-176: Dep Graph D3.js        └─ KSA-177: AI Context Cmds
│           ├─ KSA-172: Code Quality CodeLens
│           ├─ KSA-173: Security Panel
│           └─ KSA-178: Diagnostics Provider
```

## Execution Strategy

### Phase 1: Batch A (Foundation) — 1 Session

Run these 3 tickets sequentially in ONE session (they share settings infrastructure):

```
Session 1: KSA-180 → KSA-179 → KSA-175
```

### Phase 2: Batch B + C + D — 3 Parallel Sessions

After Batch A is done, run 3 sessions simultaneously:

```
Session 2: KSA-171 → KSA-176  (Visualization)
Session 3: KSA-172 → KSA-173 → KSA-178  (Quality)
Session 4: KSA-174 → KSA-177  (Commands)
```

## Session Prompts (Copy-Paste Ready)

### Session 1 — Batch A: Foundation

```
KSA-180 tạo tài liệu đầy đủ

Sau khi xong KSA-180:
KSA-179 tạo tài liệu đầy đủ

Sau khi xong KSA-179:
KSA-175 tạo tài liệu đầy đủ
```

### Session 2 — Batch B: Visualization (run AFTER Batch A done)

```
KSA-171 tạo tài liệu đầy đủ

Sau khi xong KSA-171:
KSA-176 tạo tài liệu đầy đủ
```

### Session 3 — Batch C: Quality (run AFTER Batch A done)

```
KSA-172 tạo tài liệu đầy đủ

Sau khi xong KSA-172:
KSA-173 tạo tài liệu đầy đủ

Sau khi xong KSA-173:
KSA-178 tạo tài liệu đầy đủ
```

### Session 4 — Batch D: Commands (run AFTER Batch A done)

```
KSA-174 tạo tài liệu đầy đủ

Sau khi xong KSA-174:
KSA-177 tạo tài liệu đầy đủ
```

## Ticket Summary Table

| # | Key | Summary | Batch | VS Code API | MCP Tools |
|---|-----|---------|-------|-------------|-----------|
| 1 | KSA-171 | Graph Visualization — TreeView + Webview | B | TreeDataProvider, TreeView | code_context, mem_graph, code_symbols |
| 2 | KSA-172 | Code Quality UI — CodeLens + Decorations | C | CodeLensProvider, TextEditorDecorationType | code_search, code_symbols |
| 3 | KSA-173 | Security Findings Panel — Webview | C | WebviewPanel | code_search, mem_search |
| 4 | KSA-174 | Impact Analysis Command — Blast Radius | D | WebviewPanel, QuickPick | code_context, mem_graph |
| 5 | KSA-175 | Entry Point Explorer — TreeView | A | TreeDataProvider | code_search, code_symbols |
| 6 | KSA-176 | Dependency Graph Webview — D3.js | B | WebviewPanel, message passing | code_modules, code_context |
| 7 | KSA-177 | AI Context Commands — Clipboard | D | commands, env.clipboard | code_context, code_search, mem_search |
| 8 | KSA-178 | Diagnostics Provider — VS Code Diagnostics | C | DiagnosticCollection, CodeActionProvider | code_search |
| 9 | KSA-179 | Symbol Search — Quick Pick | A | window.createQuickPick | code_search, code_symbols |
| 10 | KSA-180 | Settings & Configuration | A | workspace.getConfiguration | N/A (config only) |

## Notes

- All tickets are children of Epic KSA-170
- All tickets have labels: `code-intelligence`, `vscode-extension`, `batch-{A/B/C/D}`
- Extension source: `kiro-sdlc-agents/src/extension/` (VS Code extension code)
- MCP server source: `mcp-code-intelligence-nodejs/` (data provider)
- Relationship to KSA-144: KSA-144 builds the MCP server capabilities, KSA-170 builds the UI that consumes them

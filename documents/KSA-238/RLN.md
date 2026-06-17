# Release Notes (RLN)

## Kiro SDLC Agents — KSA-238: LangGraph Workflow Visualization Panel

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | MINOR (new feature) |
| Release Date | 2026-06-17 |
| Jira Ticket | KSA-238 |
| Branch | KSA-238 |
| Author | DevOps Agent |

---

## 1. Summary

Added an interactive Workflow Visualization Panel that renders the SDLC agent pipeline as a DAG using D3.js and dagre. Users can visualize how agents (BA, TA, SA, QA, DEV, DevOps, SM) connect and flow through the development pipeline.

---

## 2. New Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | DAG visualization | SDLC workflow rendered as directed acyclic graph |
| 2 | dagre layout | Automatic hierarchical layout with no overlapping |
| 3 | Zoom/Pan | Mouse wheel zoom, click-drag pan |
| 4 | Node interaction | Click to highlight node and connected edges |
| 5 | Theme support | Dark, light, and high-contrast color palettes |
| 6 | Keyboard navigation | Tab between nodes, Enter to select |
| 7 | Responsive | Auto-fits to panel width on resize |

---

## 3. Technical Changes

| File | Change |
|------|--------|
| `src/panels/workflow-panel.ts` | New — panel class |
| `src/langgraph/workflow-graph-data.ts` | New — static graph definition |
| `webview-assets/workflow-graph.js` | New — D3 + dagre rendering |
| `webview-assets/workflow-graph.css` | New — theme-aware styles |

### New Dependencies

| Package | Version | Size |
|---------|---------|------|
| d3 | 7.x | ~250KB bundled |
| dagre | 0.8.x | ~30KB bundled |

---

## 4. Testing

| Test Type | Cases | Result |
|-----------|-------|--------|
| PBT | 4 properties | PASS |
| Unit Tests | 20 | PASS |
| Integration | 4 | PASS |
| **Total** | **28** | **100% pass** |

---

## 5. Known Limitations

- Graph data is static (does not reflect real-time pipeline execution)
- Maximum tested with 50 nodes (performance may degrade beyond)
- SVG export not available (screenshot only)

---

## 6. Upgrade Instructions

1. Update extension to latest version
2. Restart IDE
3. Open via Command Palette: "Kiro: Show Workflow"

---

## 7. Rollback

Revert to previous version. Workflow panel command will not be registered.

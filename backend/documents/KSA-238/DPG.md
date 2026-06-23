# Deployment Guide (DPG)

## Kiro SDLC Agents — KSA-238: LangGraph Workflow Visualization Panel

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-238 |
| Title | LangGraph Workflow Visualization Panel - D3.js + dagre interactive graph |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |
| Related TDD | TDD-v1-KSA-238.docx |

---

## 1. Overview

### 1.1 Feature Summary

Interactive workflow visualization panel that renders the SDLC agent pipeline as a directed acyclic graph (DAG) using D3.js and dagre layout. Users can zoom, pan, click nodes to see details, and navigate via keyboard.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| `src/panels/workflow-panel.ts` | New | Panel class extending BasePanel |
| `src/langgraph/workflow-graph-data.ts` | New | Static graph definition |
| `webview-assets/workflow-graph.js` | New | D3 + dagre rendering |
| `webview-assets/workflow-graph.css` | New | Theme-aware styles |
| Dependencies | New | d3@7.x, dagre@0.8.x (bundled) |

### 1.3 Target Environments

| Environment | Deploy Order |
|-------------|-------------|
| DEV (local extension) | 1st |
| Extension Bundle (VSIX) | 2nd |

---

## 2. Prerequisites

| Requirement | Notes |
|-------------|-------|
| VS Code / Kiro IDE 1.85+ | Webview API support |
| Node.js 20.x | Build-time only |
| D3.js 7.x | Bundled in VSIX |
| dagre 0.8.x | Bundled in VSIX |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | All unit tests pass | Done |
| 2 | Graph renders in all 3 themes | Done |
| 3 | Zoom/pan/click interactions work | Done |
| 4 | D3 and dagre bundled correctly in VSIX | Done |
| 5 | CSP nonce configured for webview scripts | Done |
| 6 | Code pushed to branch KSA-238 | Done |

---

## 4. Database Migration

Not applicable — UI-only feature.

---

## 5. Application Deployment

### 5.1 Build Steps

| Step | Command | Verification |
|------|---------|-------------|
| 1 | `npm ci` | Dependencies (incl d3, dagre) installed |
| 2 | `npm run test` | Tests pass |
| 3 | `npm run build` | dist created, webview-assets bundled |
| 4 | `vsce package` | VSIX generated with webview assets |

### 5.2 Deployment Steps

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Build VSIX | Generated without errors |
| 2 | Install extension | Activates cleanly |
| 3 | Open Workflow Panel | Command palette: "Show Workflow" |
| 4 | Verify graph renders | SVG with nodes and edges visible |
| 5 | Test interactions | Zoom, pan, click work |

---

## 6. Configuration Changes

No configuration changes. D3 and dagre are bundled dependencies.

---

## 7. Post-Deployment Verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Open workflow panel | DAG renders with 7+ SDLC nodes |
| 2 | Mouse wheel zoom | Graph zooms in/out smoothly |
| 3 | Click+drag pan | Graph moves with cursor |
| 4 | Click node | Node highlighted, description tooltip |
| 5 | Switch theme | Colors update to match theme |
| 6 | Tab navigation | Focus moves between nodes |
| 7 | Panel resize | Graph re-fits to panel width |

---

## 8. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Revert to previous VSIX without workflow panel |
| 2 | Or: git revert KSA-238 commits, rebuild |

Rollback Time: ~1 minute. No data loss. Workflow panel simply not available.

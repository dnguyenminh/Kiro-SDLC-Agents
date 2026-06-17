# Deployment Guide (DPG)

## Kiro SDLC Agents — KSA-247: Chat Panel: Restore collapsible tool call UI blocks with icons

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-247 |
| Title | Chat Panel: Restore collapsible tool call UI blocks with icons |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-06-10 |
| Status | Final |
| Related TDD | TDD-v1-KSA-247.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-10 | DevOps Agent | Initial deployment guide |

---

## 1. Overview

### 1.1 Feature Summary

This deployment fixes a regression in the Chat Panel webview where collapsible tool call UI blocks are wiped during streaming. It restores full persistence of tool call blocks, adds category icons, accessibility attributes (keyboard navigation, aria-expanded), and "interrupted" status for tools running when panel closes.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| `webview/chat-panel.js` | Modified | Streaming protection, tool block persistence |
| `webview/tool-blocks.js` | Modified | categorizeTool() expansion, icon rendering |
| `webview/styles/tool-blocks.css` | Modified | Collapsible block styling, accessibility |
| `src/chat/state-manager.ts` | Modified | Tool call data persistence on reload |
| Database | None | No database changes |
| Configuration | None | No new config required |

### 1.3 Target Environments

| Environment | Deploy Order |
|-------------|-------------|
| DEV (local extension) | 1st |
| Extension Bundle (VSIX) | 2nd |

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Notes |
|-------------|-------|
| VS Code / Kiro IDE | Extension host |
| Node.js 20.x | Build-time only |

### 2.2 Software Dependencies

| Dependency | Version | Notes |
|-----------|---------|-------|
| TypeScript | 5.x | Build-time |
| esbuild | latest | VSIX bundler |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | All unit tests pass | Done |
| 2 | Extension tests pass | Done |
| 3 | Tool block rendering verified visually | Done |
| 4 | Streaming does not wipe tool blocks | Done |
| 5 | Keyboard navigation works (Tab, Enter/Space) | Done |
| 6 | Panel reload preserves tool call state | Done |
| 7 | Code pushed to branch KSA-247 | Done |

---

## 4. Database Migration

Not applicable — no database changes. UI-only fix.

---

## 5. Application Deployment

### 5.1 Build Steps

| Step | Command | Verification |
|------|---------|-------------|
| 1 | `npm ci` | Dependencies installed |
| 2 | `npm run test` | All tests pass |
| 3 | `npm run build` | `dist/` created |
| 4 | `vsce package` | `.vsix` file generated |

### 5.2 Deployment Steps

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Build VSIX with fixed webview | VSIX generated without errors |
| 2 | Install extension | Extension activates |
| 3 | Open Chat Panel | Panel renders correctly |
| 4 | Trigger tool call | Collapsible block appears with icon |
| 5 | Wait for streaming | Block persists (not wiped) |
| 6 | Collapse/expand block | Animation works, aria-expanded updates |

---

## 6. Configuration Changes

No configuration changes required. This is a UI-only fix.

---

## 7. Post-Deployment Verification

### 7.1 Smoke Tests

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Trigger tool call via chat | Collapsible block with category icon appears |
| 2 | Stream response arrives | Tool block persists, text content preserved |
| 3 | Click to collapse/expand | Smooth animation, content toggles |
| 4 | Keyboard Tab + Enter | Block toggles via keyboard |
| 5 | Close and reopen panel | Tool call blocks restored from state |
| 6 | Multiple tool calls | Each has correct category icon |
| 7 | Interrupted tool (close panel mid-execution) | Shows "interrupted" status badge |

### 7.2 Accessibility Verification

| Check | Expected |
|-------|----------|
| Screen reader announces tool block | "Tool: {name}, {status}, collapsed/expanded" |
| Tab order correct | Tool blocks in DOM order |
| aria-expanded attribute | Toggles true/false on collapse |
| Focus visible | Outline visible when focused via keyboard |

---

## 8. Rollback Plan

### 8.1 Rollback Steps

| Step | Action |
|------|--------|
| 1 | Revert to previous VSIX version |
| 2 | Or: `git revert` KSA-247 commits, rebuild |

### 8.2 Rollback Impact

- Tool call blocks will be wiped during streaming again (regression returns)
- No data loss
- Core chat functionality unaffected

### 8.3 Rollback Time: ~1 minute

---

## 9. Appendix

### Related Tickets

| Ticket | Relationship |
|--------|-------------|
| KSA-247 | Main ticket — UI regression fix |

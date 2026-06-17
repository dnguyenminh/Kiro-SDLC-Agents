# Deployment Guide (DPG)

## Chatbox UI — KSA-252: Context Menu ("#" Trigger)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-252 |
| Title | Context Menu ("#" Trigger) |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |
| Related TDD | TDD-v1-KSA-252.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-17 | DevOps Agent | Initial deployment guide |

---

## 1. Overview

### 1.1 Feature Summary

The Context Menu ("#" Trigger) feature enables users to type "#" in the chat input area to invoke a context menu that allows selecting files, folders, symbols, and other context items. Selected items appear as badges/chips in the input, and their content is resolved and injected into the AI prompt on message submit.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| `webview/context-menu/` | New | Context menu UI components (menu renderer, fuzzy filter, badge manager) |
| `webview/context-menu/state-machine.ts` | New | FSM for menu lifecycle |
| `webview/context-menu/providers/` | New | Context data providers (file, folder, symbol, git) |
| `src/context/context-resolver.ts` | New | Extension host context resolution |
| `src/context/context-types.ts` | New | Shared type definitions |
| `webview/styles/context-menu.css` | New | Context menu styling |
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
| Vitest | 2.1.9 | Test runner |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | All PBT tests pass (12/12) | Done |
| 2 | All unit tests pass (45/45) | Done |
| 3 | All integration tests pass (15/15) | Done |
| 4 | Context menu renders on "#" keypress | Done |
| 5 | Fuzzy filter works with CJK characters | Done |
| 6 | Badge insertion and removal works | Done |
| 7 | postMessage bridge communication verified | Done |
| 8 | Keyboard navigation (Up/Down/Enter/Escape) | Done |
| 9 | Code pushed to branch KSA-252 | Done |

---

## 4. Database Migration

Not applicable — no database changes. This is a UI feature within a VS Code Extension webview.

---

## 5. Application Deployment

### 5.1 Build Steps

| Step | Command | Verification |
|------|---------|-------------|
| 1 | `npm ci` | Dependencies installed |
| 2 | `npm run test` | All 72 tests pass |
| 3 | `npm run build` | `dist/` created |
| 4 | `vsce package` | `.vsix` file generated |

### 5.2 Deployment Steps

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Build VSIX with context menu feature | VSIX generated without errors |
| 2 | Install extension in VS Code / Kiro IDE | Extension activates |
| 3 | Open Chat Panel | Panel renders correctly |
| 4 | Type "#" in input area | Context menu appears |
| 5 | Select file/folder/symbol | Badge chip inserted in input |
| 6 | Submit message | Context resolved and included in prompt |

---

## 6. Configuration Changes

No configuration changes required. The context menu feature is enabled by default with no feature flags.

---

## 7. Post-Deployment Verification

### 7.1 Smoke Tests

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Type "#" in empty input | Context menu appears with file/folder/symbol categories |
| 2 | Type "#fi" | Fuzzy filter shows matching files |
| 3 | Arrow Down + Enter | Item selected, badge inserted |
| 4 | Click badge "x" button | Badge removed from input |
| 5 | Submit with badges | AI receives context content in prompt |
| 6 | Press Escape | Menu closes, input restored |
| 7 | Type "#" mid-sentence | Menu appears at cursor position |
| 8 | Multiple "#" invocations | Multiple badges supported |

### 7.2 Accessibility Verification

| Check | Expected |
|-------|----------|
| Screen reader announces menu items | Role="listbox", aria-activedescendant |
| Keyboard-only operation | Full functionality via keyboard |
| Badge chips accessible | Role="option", aria-label with context name |
| Focus management | Focus returns to input on menu close |

---

## 8. Rollback Plan

### 8.1 Rollback Steps

| Step | Action |
|------|--------|
| 1 | Revert to previous VSIX version |
| 2 | Or: `git revert` KSA-252 commits, rebuild VSIX |

### 8.2 Rollback Impact

- Context menu feature unavailable
- No data loss
- Core chat functionality unaffected
- Users cannot use "#" to add context (must copy-paste manually)

### 8.3 Rollback Time: ~1 minute

---

## 9. Appendix

### Related Tickets

| Ticket | Relationship |
|--------|-------------|
| KSA-252 | Main ticket — Context Menu feature |

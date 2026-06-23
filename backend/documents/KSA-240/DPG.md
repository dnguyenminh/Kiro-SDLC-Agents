# Deployment Guide (DPG)

## FEC CR Builder — KSA-240: Chat Panel UI: Context Window Usage Icon + Conversation Tabs

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-240 |
| Title | Chat Panel UI: Context Window Usage Icon + Conversation Tabs |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |
| Related TDD | TDD-v1-KSA-240.docx |

---

## 1. Overview

### 1.1 Feature Summary

Adds two UI enhancements to the Chat Panel: (1) a Context Window Usage Icon showing real-time token consumption with color thresholds, and (2) Conversation Tabs for managing multiple chat threads within a single panel.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| `webview/token-counter/` | New | Token usage icon component |
| `webview/conversation-tabs/` | New | Tab bar and tab management UI |
| `src/chat/conversation-manager.ts` | New | Multi-conversation state management |
| `src/chat/token-counter.ts` | New | Token counting service |
| `webview/styles/tabs.css` | New | Tab bar styling |
| Database | None | No database changes |

### 1.3 Target Environments

| Environment | Deploy Order |
|-------------|-------------|
| DEV (local extension) | 1st |
| Extension Bundle (VSIX) | 2nd |

---

## 2. Prerequisites

| Requirement | Notes |
|-------------|-------|
| VS Code / Kiro IDE | Extension host |
| Node.js 20.x | Build-time only |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | All unit tests pass | Done |
| 2 | Token counter displays correctly | Done |
| 3 | Tab create/switch/close works | Done |
| 4 | State persists across panel reload | Done |
| 5 | Code pushed to branch KSA-240 | Done |

---

## 4. Database Migration

Not applicable — UI-only feature.

---

## 5. Application Deployment

### 5.1 Build Steps

| Step | Command | Verification |
|------|---------|-------------|
| 1 | `npm ci` | Dependencies installed |
| 2 | `npm run test` | Tests pass |
| 3 | `npm run build` | dist created |
| 4 | `vsce package` | VSIX generated |

### 5.2 Deployment Steps

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Build VSIX | Generated without errors |
| 2 | Install extension | Activates cleanly |
| 3 | Open Chat Panel | Token icon visible in header |
| 4 | Send a message | Token icon updates percentage |
| 5 | Click "+" button | New conversation tab created |

---

## 6. Configuration Changes

No configuration changes required.

---

## 7. Post-Deployment Verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Token icon shows 0% initially | Green icon, "0 / N tokens" tooltip |
| 2 | After messages, icon updates | Percentage reflects usage |
| 3 | At 90%+ usage | Icon turns red |
| 4 | Create new tab | Empty conversation, token resets |
| 5 | Switch tabs | Previous conversation restored |
| 6 | Close panel, reopen | All tabs and state preserved |

---

## 8. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Revert to previous VSIX version |
| 2 | Or: git revert KSA-240 commits, rebuild |

Rollback Time: ~1 minute. No data loss. Chat panel functions without token icon/tabs.

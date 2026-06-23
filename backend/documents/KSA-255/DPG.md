# Deployment Guide (DPG)

## Kiro SDLC Extension — KSA-255: Chat Panel Spinner + Working Indicator

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-255 |
| Title | Chat Panel: Spinner + Working Indicator on Input Area during AI Processing |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |
| Related TDD | TDD-v1-KSA-255.docx |

---

## 1. Overview

### 1.1 Feature Summary

Adds a visual spinner and "Working..." text indicator on the Chat Panel input area while the AI is processing. The input area is disabled during processing to prevent duplicate submissions. Follows the Controller+View pattern from KSA-252.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| `webview/spinner/spinner-controller.ts` | New | State machine (idle/processing) |
| `webview/spinner/spinner-view.ts` | New | DOM rendering |
| `webview/styles/spinner.css` | New | CSS animation + theme vars |
| `webview/chat-input.ts` | Modified | Integration with input area |
| `src/chat/message-handler.ts` | Modified | Sends processing signals |

### 1.3 Target Environments

| Environment | Deploy Order |
|-------------|-------------|
| DEV (local extension) | 1st |
| Extension Bundle (VSIX) | 2nd |

---

## 2. Prerequisites

| Requirement | Notes |
|-------------|-------|
| VS Code / Kiro IDE 1.85+ | Webview support |
| Node.js 20.x | Build-time only |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | All PBT tests pass | Done |
| 2 | All unit tests pass | Done |
| 3 | Integration tests pass | Done |
| 4 | Spinner renders in all 3 themes | Done |
| 5 | CSS animation smooth (no JS loops) | Done |
| 6 | Input disabled during processing | Done |
| 7 | Idempotent signal handling verified | Done |
| 8 | Code pushed to branch KSA-255 | Done |

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
| 1 | Build VSIX | Generated |
| 2 | Install extension | Activates |
| 3 | Open Chat Panel | Panel renders |
| 4 | Send message | Spinner appears during processing |
| 5 | Wait for response | Spinner disappears, input re-enabled |

---

## 6. Configuration Changes

No configuration changes. Feature is enabled by default.

---

## 7. Post-Deployment Verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Send message | Spinner + "Working..." appears |
| 2 | Response completes | Spinner disappears immediately |
| 3 | Click Stop during processing | Spinner removes, input re-enables |
| 4 | Rapid send attempts during processing | Input stays disabled (no duplicates) |
| 5 | Theme switch | Spinner colors match theme |
| 6 | Long processing (>30s) | Spinner persists until done |

---

## 8. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Revert to previous VSIX |
| 2 | Or: git revert KSA-255, rebuild |

Rollback Time: ~1 minute. No data loss. Input area works without spinner (no processing indicator).

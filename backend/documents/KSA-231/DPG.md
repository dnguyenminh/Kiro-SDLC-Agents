# Deployment Guide (DPG)

## Kiro SDLC Agents — KSA-231: Tích hợp Kiro API Client (Node.js) vào Extension

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-231 |
| Title | Tích hợp Kiro API Client (Node.js) vào Extension — Thay thế kiro-rs Proxy |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |
| Related TDD | TDD-v1-KSA-231.docx |

---

## 1. Overview

### 1.1 Feature Summary

Replaces the external kiro-rs.exe proxy with a native TypeScript Kiro API Client running in-process. Five modules (TokenManager, KiroClient, AnthropicAdapter, StreamHandler, ModelRegistry) provide credential management, API communication, and streaming support without any external dependencies.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| `src/langgraph/providers/token-manager.ts` | New | AWS SSO credential detection/refresh |
| `src/langgraph/providers/kiro-client.ts` | New | Main Kiro API provider |
| `src/langgraph/providers/anthropic-adapter.ts` | New | Format adapter |
| `src/langgraph/providers/stream-handler.ts` | New | SSE stream parser |
| `src/langgraph/providers/model-registry.ts` | New | Model list cache |
| `src/langgraph/llm-provider.ts` | Modified | Provider factory updated |
| `src/langgraph/providers/index.ts` | Modified | Exports updated |
| `package.json` | Modified | Settings schema for kiro provider |
| kiro-rs.exe dependency | Removed | No longer needed |

### 1.3 Target Environments

| Environment | Deploy Order |
|-------------|-------------|
| DEV (local extension) | 1st |
| Extension Bundle (VSIX) | 2nd |

---

## 2. Prerequisites

| Requirement | Notes |
|-------------|-------|
| VS Code / Kiro IDE 1.85+ | Native fetch support (Node 18+) |
| Node.js 20.x | Build-time only |
| AWS SSO active session | Runtime credential source |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | All 5 modules compile | Done |
| 2 | Provider factory registers "kiro" | Done |
| 3 | Token detection works with real SSO cache | Done |
| 4 | Streaming works end-to-end | Done |
| 5 | No new npm dependencies added | Done |
| 6 | Activation time < 200ms (lazy init) | Done |
| 7 | Code pushed to branch KSA-231 | Done |

---

## 4. Database Migration

Not applicable — no database. Pure client-side integration.

---

## 5. Application Deployment

### 5.1 Build Steps

| Step | Command | Verification |
|------|---------|-------------|
| 1 | `npm ci` | Dependencies installed (no new ones) |
| 2 | `npm run test` | Tests pass |
| 3 | `npm run build` | dist created |
| 4 | `vsce package` | VSIX generated |

### 5.2 Deployment Steps

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Build VSIX | Generated without errors |
| 2 | Install extension | Activates < 200ms |
| 3 | Set provider to "kiro" | Setting accepted |
| 4 | Send chat message | Streaming response received via Kiro API |

---

## 6. Configuration Changes

### New Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `kiroSdlc.llmProvider` | `"anthropic"` | Now accepts "kiro" as option |
| `kiroSdlc.kiro.modelId` | `"claude-sonnet-4-20250514"` | Kiro model selection |

### Removed Dependencies

| Item | Reason |
|------|--------|
| kiro-rs.exe | Replaced by native TypeScript client |
| kiro-rs PATH config | No longer needed |

---

## 7. Post-Deployment Verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Switch to Kiro provider | No errors, credentials detected |
| 2 | Send message | Streaming response from Kiro API |
| 3 | Check process list | No kiro-rs.exe spawned |
| 4 | Token refresh | Automatic, no user action needed |
| 5 | Model list in settings | Dropdown populated from API |

---

## 8. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Revert to previous VSIX |
| 2 | Restore kiro-rs.exe on PATH |
| 3 | Switch provider setting to "anthropic" as fallback |

Rollback Time: ~2 minutes. No data loss.

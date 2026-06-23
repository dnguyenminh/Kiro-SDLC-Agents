# Deployment Guide (DPG)

## KSA-244: Context Compression Module — Port Headroom Algorithms to Node.js

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-244 |
| Title | Context Compression Module — Port Headroom Algorithms to Node.js |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-07-15 |
| Status | Final |
| Related TDD | TDD-v1-KSA-244.docx |

---

## 1. Overview

### 1.1 Feature Summary

Ports the context headroom/compression algorithms from the Python code-intelligence server to the Node.js backend. Provides token-aware context management that automatically compresses context when approaching model limits.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Context compression module | New | Headroom algorithm implementation in TypeScript |
| Token counter | New | Accurate token estimation for context budgeting |
| Compression strategies | New | Multiple strategies (truncate, summarize, prioritize) |

### 1.3 Target Environments

| Environment | Deploy Order |
|-------------|-------------|
| DEV (local) | 1st |
| Production (MCP server) | 2nd |

---

## 2. Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 20.x | Runtime |
| npm packages installed | npm ci |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | All 74 tests pass | Done |
| 2 | Compression algorithms validated against Python reference | Done |
| 3 | Token counting accuracy verified | Done |
| 4 | Code pushed to branch KSA-244 | Done |

---

## 4. Database Migration

Not applicable — stateless compression module.

---

## 5. Application Deployment

### 5.1 Build Steps

| Step | Command | Verification |
|------|---------|-------------|
| 1 | `npm ci` | Dependencies installed |
| 2 | `npm run test` | 74/74 tests pass |
| 3 | `npm run build` | Compiles without errors |

### 5.2 Deployment Steps

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Merge KSA-244 branch | No conflicts |
| 2 | Build project | Clean compilation |
| 3 | Start server | Module loads successfully |
| 4 | Test compression | Context correctly compressed within headroom |

---

## 6. Configuration Changes

No new configuration. Module uses existing context budget settings.

---

## 7. Post-Deployment Verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Large context input | Compressed to fit within token budget |
| 2 | Small context input | Passes through unmodified |
| 3 | Multiple strategies | Correct strategy selected by content type |

---

## 8. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Revert merge commit |
| 2 | Rebuild and redeploy |

Rollback Time: ~5 minutes. No data loss.

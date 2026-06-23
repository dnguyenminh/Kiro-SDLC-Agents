# Deployment Guide (DPG)

## KSA-171: Code Intelligence v2 — Feature Parity Sync (Kotlin + Python)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-171 |
| Title | Code Intelligence v2 — Feature Parity Sync (Kotlin + Python) |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-07-15 |
| Status | Final |
| Related TDD | TDD-v1-KSA-171.docx |

---

## 1. Overview

### 1.1 Feature Summary

Epic encompassing feature parity between Kotlin and Python code intelligence implementations. Ensures both language analyzers provide consistent capabilities: graph engine, semantic search, symbol resolution, and cross-reference analysis.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Kotlin graph engine | New/Updated | Graph-based code analysis for Kotlin |
| Python analyzer parity | Updated | Match Kotlin capabilities |
| Shared interfaces | Modified | Common analysis contracts |

### 1.3 Target Environments

| Environment | Deploy Order |
|-------------|-------------|
| DEV (local) | 1st |
| MCP Server | 2nd |

---

## 2. Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 20.x | Runtime for MCP server |
| Python 3.11+ | Python analyzer |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | Kotlin graph engine implemented | Done |
| 2 | Python parity features complete | Done |
| 3 | Integration tests pass | Done |
| 4 | Code pushed | Done |

---

## 4. Database Migration

Not applicable.

---

## 5. Application Deployment

### 5.1 Build Steps

| Step | Command | Verification |
|------|---------|-------------|
| 1 | `npm ci` | Dependencies |
| 2 | `npm run build` | Compiles |
| 3 | `npm run test` | Tests pass |

### 5.2 Deployment Steps

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Merge branch | No conflicts |
| 2 | Build and start | Server starts with both analyzers |
| 3 | Test Kotlin analysis | Graph engine returns results |
| 4 | Test Python analysis | Parity features work |

---

## 6. Configuration Changes

No new configuration required.

---

## 7. Post-Deployment Verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Analyze Kotlin project | Full graph + symbols |
| 2 | Analyze Python project | Same capabilities as Kotlin |
| 3 | Cross-language references | Detected correctly |

---

## 8. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Revert merge commit |
| 2 | Previous analyzers still functional |

Rollback Time: ~5 minutes.

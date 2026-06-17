# Deployment Guide (DPG)

## KSA-249: Developer Experience — Steering Optimization + Context Usage Graph + Full Hook System

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-249 |
| Title | Steering Optimization + Context Usage Graph + Full Hook System |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-06-09 |
| Status | Final |
| Related TDD | TDD-v1-KSA-249.docx |

---

## 1. Overview

### 1.1 Feature Summary

Enhanced developer experience through three improvements: steering file optimization for reduced context usage, a context usage graph for visibility into token consumption, and a full hook system for lifecycle event handling.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Steering optimizer module | New | Optimizes steering file loading order |
| Context usage graph | New | Visualizes token consumption per component |
| Hook system | New | Pre/post lifecycle hooks for pipeline events |

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
| Node.js 20.x | Build-time |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | All modules compile | Done |
| 2 | Tests pass | Done |
| 3 | Code pushed to branch KSA-249 | Done |
| 4 | No breaking changes to existing steering API | Done |

---

## 4. Database Migration

Not applicable — no database changes.

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
| 2 | Install extension | Activates successfully |
| 3 | Verify steering optimization | Reduced token usage in logs |
| 4 | Verify context graph | Graph renders in panel |
| 5 | Verify hook system | Hooks fire on lifecycle events |

---

## 6. Configuration Changes

No new configuration required. Steering optimization is automatic.

---

## 7. Post-Deployment Verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Open steering panel | Context usage graph displayed |
| 2 | Trigger pipeline | Hooks fire pre/post events |
| 3 | Check token usage | Reduced vs previous version |

---

## 8. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Revert to previous VSIX version |
| 2 | No data migration needed |

Rollback Time: ~2 minutes.

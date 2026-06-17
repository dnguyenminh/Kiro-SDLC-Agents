# Deployment Guide (DPG)

## KSA-182: [Bug] httpStream Transport Not Supported for Upstream MCP Servers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-182 |
| Title | httpStream Transport Not Supported for Upstream MCP Servers |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-07-15 |
| Status | Final |
| Related TDD | TDD-v1-KSA-182.docx |

---

## 1. Overview

### 1.1 Feature Summary

Bug fix: Added httpStream transport support for connecting to upstream MCP servers. Previously only stdio and SSE transports were supported, causing connection failures when upstream servers used HTTP streaming.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Transport layer | Modified | Added httpStream transport type |
| Connection factory | Modified | httpStream connection handling |
| Config schema | Modified | New transport option in config |

### 1.3 Target Environments

| Environment | Deploy Order |
|-------------|-------------|
| DEV (local) | 1st |
| Production (MCP server) | 2nd |

---

## 2. Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 20.x | Native fetch for HTTP streaming |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | httpStream transport connects to upstream | Done |
| 2 | Existing stdio/SSE transports unaffected | Done |
| 3 | Tests pass | Done |
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
| 2 | Build and start | Server starts |
| 3 | Configure upstream with httpStream | Connection established |
| 4 | Verify tool calls via httpStream | Responses received |

---

## 6. Configuration Changes

New transport option in upstream server config: transport httpStream now accepted alongside stdio and sse.

---

## 7. Post-Deployment Verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Connect to httpStream upstream | Successful connection |
| 2 | Call tools via httpStream | Correct responses |
| 3 | Existing stdio upstreams | Still work (no regression) |
| 4 | Existing SSE upstreams | Still work (no regression) |

---

## 8. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Revert merge commit |
| 2 | httpStream upstreams will fail (known limitation of old version) |

Rollback Time: ~5 minutes.

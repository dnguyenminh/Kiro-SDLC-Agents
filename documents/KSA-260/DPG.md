# Deployment Guide (DPG)

## Kiro SDLC Agents — KSA-260: Chuyển MCP Server từ Child Process sang In-Process

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-260 |
| Title | Chuyển MCP server từ child process (spawn) sang in-process trong extension host |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |

---

## 1. Overview

### 1.1 Feature Summary

Technical refactor that eliminates the external Node.js child process dependency for the MCP Code Intelligence server. The server now runs in-process within the VS Code extension host, removing spawn failures, PATH issues, and process management complexity.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| `src/mcp-server-inprocess.ts` | New | In-process MCP server implementation |
| `src/mcp-server-manager.ts` | Modified | Re-exports in-process implementation |
| Child process spawn logic | Removed | No longer spawns external Node.js process |

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
| 1 | In-process server starts without errors | Done |
| 2 | All MCP tools respond correctly | Done |
| 3 | No child process spawn code remaining | Done |
| 4 | Extension activates cleanly | Done |
| 5 | Code pushed to branch KSA-260 | Done |

---

## 4. Database Migration

Not applicable — internal architecture refactor only.

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
| 1 | Build VSIX with in-process MCP | VSIX generated |
| 2 | Install extension | Extension activates |
| 3 | Verify MCP server starts in-process | No child process spawned |
| 4 | Call MCP tools | Tools respond correctly |

---

## 6. Configuration Changes

No configuration changes. Removes need for system Node.js PATH.

---

## 7. Post-Deployment Verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Extension activates | MCP server starts in-process |
| 2 | Call code_search tool | Returns results |
| 3 | Check process list | No separate node child process |
| 4 | Extension deactivates | Clean shutdown |

---

## 8. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Revert to previous VSIX (child process model) |
| 2 | Ensure system Node.js on PATH |

Rollback Time: ~1 minute. No data loss.

---

## 9. Appendix

| Ticket | Relationship |
|--------|-------------|
| KSA-260 | Main ticket — MCP in-process refactor |

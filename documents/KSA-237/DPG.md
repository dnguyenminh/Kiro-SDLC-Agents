# Deployment Guide (DPG)

## kiro-ts — KSA-237: Integrate chat completions endpoint into MCP server

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-237 |
| Title | Integrate chat completions endpoint into MCP server (kiro-ts) |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-06-06 |
| Status | Final |
| Related TDD | TDD-v1-KSA-237.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-06 | DevOps Agent | Initial deployment guide |

---

## 1. Overview

### 1.1 Feature Summary

This deployment integrates an Anthropic Messages API-compatible chat completions endpoint into the kiro-ts MCP Code Intelligence HTTP server. The endpoint (`/v1/messages`, `/v1/models`) enables external AI agents (Cline, Cursor, etc.) to use Kiro's backend models via a gateway adapter pattern. Auto-discovers Kiro SSO credentials, auto-refreshes tokens, exposes 14 models.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| `src/http/kiro-ts/` | New Module | Chat proxy with Anthropic-compatible API |
| `src/http/http-entry.ts` | Modified | Route registration for `/v1/messages`, `/v1/models` |
| `src/http/kiro-ts/credential-resolver.ts` | New | AWS SSO credential discovery + auto-refresh |
| `src/http/kiro-ts/sigv4-signer.ts` | New | SigV4 request signing for Kiro Q API |
| `src/http/kiro-ts/sse-proxy.ts` | New | SSE streaming proxy handler |
| Database | None | No database changes |
| Configuration | Optional | `KIRO_TS_PORT` (default 9181) |

### 1.3 Target Environments

| Environment | URL | Deploy Order |
|-------------|-----|-------------|
| DEV | http://127.0.0.1:9181/anthropic | 1st |
| Extension Bundle | kiro-sdlc-agents VSIX | 2nd |

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| Node.js 20.x LTS | Required | Runtime |
| VS Code / Kiro IDE | Required | Extension host |
| AWS SSO credentials | Required | `~/.aws/sso/cache/` must have valid token |

### 2.2 Software Dependencies

| Dependency | Version | Notes |
|-----------|---------|-------|
| TypeScript | 5.x | Build-time |
| esbuild | latest | VSIX bundler |
| @aws-sdk/client-sso | ^3.x | Credential resolution |

### 2.3 Access Requirements

| Access | Type | Notes |
|--------|------|-------|
| Git repository | SSH | Push to KSA-237 branch |
| Kiro Q API | Network | Auto-discovered via SSO |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | All 78 kiro-ts tests passed | Done |
| 2 | All 48 extension tests passed | Done |
| 3 | TypeScript build succeeds | Done |
| 4 | SSO credential discovery tested | Done |
| 5 | SigV4 signing verified | Done |
| 6 | SSE streaming verified | Done |
| 7 | Model list endpoint returns 14 models | Done |
| 8 | Code pushed to branch KSA-237 | Done |

---

## 4. Database Migration

Not applicable — no database changes.

---

## 5. Application Deployment

### 5.1 Build Steps

| Step | Command | Verification |
|------|---------|-------------|
| 1 | `npm ci` | Dependencies installed |
| 2 | `npm run test` | 78+48 tests pass |
| 3 | `npm run build` | `dist/` created |
| 4 | `vsce package` (if VSIX) | `.vsix` file generated |

### 5.2 Deployment Steps (Extension)

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Build VSIX with new chat proxy module | VSIX size includes new module |
| 2 | Install extension in VS Code / Kiro | Extension activates without errors |
| 3 | Verify HTTP server starts on port 9181 | `curl http://127.0.0.1:9181/health` returns OK |
| 4 | Verify model list | `GET /v1/models` returns 14 models |
| 5 | Verify chat endpoint | `POST /v1/messages` streams SSE response |

### 5.3 Deployment Steps (Standalone)

```bash
# Build
npm ci && npm run build

# Start
node dist/index.js --port 9181

# Verify
curl http://127.0.0.1:9181/anthropic/v1/models
```

---

## 6. Configuration Changes

### 6.1 Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| KIRO_TS_PORT | Gateway port | 9181 | No |
| KIRO_Q_REGION | AWS region for SigV4 | us-east-1 | No |

### 6.2 No Feature Flags Required

The chat completions endpoint is always active once deployed.

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Endpoint | Expected |
|-------|----------|----------|
| Server alive | `GET /health` | 200 OK |
| Models available | `GET /v1/models` | 200 with 14 models |

### 7.2 Smoke Tests

| # | Scenario | Expected |
|---|----------|----------|
| 1 | GET /v1/models | JSON with 14 Kiro models |
| 2 | POST /v1/messages (simple) | SSE stream with text response |
| 3 | POST /v1/messages (tool_use) | SSE stream with tool_use blocks |
| 4 | Invalid API key | 401 Unauthorized |
| 5 | SSO token expired | Auto-refresh, then success |

---

## 8. Rollback Plan

### 8.1 Rollback Steps

| Step | Action |
|------|--------|
| 1 | Revert to previous VSIX version (without chat proxy) |
| 2 | Or: `git revert` the KSA-237 commits, rebuild |
| 3 | Reinstall extension |

### 8.2 Rollback Impact

- External agents (Cline/Cursor) lose access to Kiro models
- Core MCP functionality unaffected
- No data loss (stateless proxy)

### 8.3 Rollback Time: ~2 minutes

---

## 9. Appendix

### Related Tickets

| Ticket | Relationship |
|--------|-------------|
| KSA-237 | Main ticket |

# Deployment Guide (DPG)

## Code Intelligence Extension — KSA-284: Split Extension: Lightweight Proxy + Backend MCP Server

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-284 |
| Title | Split Extension: Lightweight Proxy + Backend MCP Server |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-07-11 |
| Status | Draft |
| Related TDD | TDD-v1-KSA-284.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-11 | DevOps Agent | Initiate document — auto-generated from TDD and project context |

---

## Sign-Off

| Name | Role | Signature and date |
|------|------|--------------------|
| | Dev Lead | ☐ Approved for deployment |
| | QA Lead | ☐ Testing completed |
| | Ops Lead | ☐ Infrastructure ready |

---

## 1. Overview

### 1.1 Feature Summary

This deployment covers the restructuring of the monolithic Code Intelligence VS Code/Kiro extension into a two-part architecture:

1. **Extension (Thin Proxy)** — Lightweight IDE extension (<5MB) that registers MCP tools, forwards requests to Backend, renders Webview UIs, and manages connection lifecycle. Contains zero business logic.
2. **Backend MCP Server** — Standalone Node.js HTTP server (Hono framework, port 48721) handling all heavy operations: Memory (SQLite + ONNX), Code Intelligence, Orchestration, Analytics, KB Graph.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Extension (code-intel-extension) | New | Lightweight VS Code extension proxy (~2MB .vsix) |
| Backend (code-intel-backend) | New | Standalone Node.js MCP server with HTTP API |
| Extension Host Process | Modified | Reduced from ~200MB to <5MB |
| Backend Process | New | Separate OS process on port 48721 |
| Configuration | New | VS Code settings for backend connection |

### 1.3 Target Environments

| Environment | Context | Deploy Order | Approval Required |
|-------------|---------|-------------|-------------------|
| DEV | Local developer machine | 1st | No |
| SIT | Shared test environment | 2nd | No |
| UAT | User acceptance testing | 3rd | QA Sign-off |
| PROD (Marketplace) | VS Code Marketplace + npm | 4th | PM + Team Lead Sign-off |

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| Developer machine (Windows/macOS/Linux) | Ready | Both components run locally |
| Node.js >= 18.0 installed | Required | Backend runtime |
| VS Code >= 1.85.0 | Required | Extension host |
| Port 48721 available on localhost | Required | Backend HTTP server |
| npm >= 9.0 installed | Required | Package management |

### 2.2 Software Dependencies

| Dependency | Version | Component |
|-----------|---------|-----------|
| Node.js | >= 18.0 | Backend |
| VS Code / Kiro | >= 1.85.0 | Extension |
| TypeScript | ^5.5.0 | Build (both) |
| esbuild | ^0.21.0 | Extension build |
| Hono | ^4.0.0 | Backend HTTP |
| better-sqlite3 | ^11.0 | Backend persistence |
| onnxruntime-node | ^1.18 | Backend ML |
| pino | ^9.2.0 | Backend logging |
| zod | ^3.23.0 | Backend validation |
| vsce | latest | Extension packaging |

### 2.3 Access Requirements

| Access | Type | Who Needs It |
|--------|------|-------------|
| VS Code Marketplace publisher | PAT token | DevOps / Release Manager |
| npm registry (if publishing backend) | npm auth token | DevOps |
| GitHub repository | Push access | Developer |
| CI/CD pipeline | Service account | Automated |

### 2.4 Backup Requirements

- [ ] Previous monolithic extension .vsix archived
- [ ] Previous extension version noted in marketplace
- [ ] User settings backup documented (migration path)

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch | Developer | ☐ |
| 2 | All 29 unit/integration tests passed | Developer | ☐ |
| 3 | Extension builds without errors (`npm run build` in src/extension/) | Developer | ☐ |
| 4 | Backend builds without errors (`npm run build` in src/backend/) | Developer | ☐ |
| 5 | Extension .vsix < 5MB verified | DevOps | ☐ |
| 6 | Backend startup < 10s verified | QA | ☐ |
| 7 | Proxy latency < 50ms (p99) verified | QA | ☐ |
| 8 | All 52 MCP tools functional through proxy | QA | ☐ |
| 9 | Health check endpoint responding | DevOps | ☐ |
| 10 | Rollback plan reviewed and tested | Team | ☐ |
| 11 | VS Code marketplace publisher token valid | DevOps | ☐ |
| 12 | CHANGELOG updated | Developer | ☐ |

---

## 4. Database Migration

### 4.1 Migration Status

**No database migration required for KSA-284.**

The Backend reuses the existing SQLite database from the monolith without schema changes. Business logic is re-hosted, not rewritten. The SQLite file remains at the same location (`.code-intel/index.db`).

### 4.2 Data Continuity

| Item | Status | Notes |
|------|--------|-------|
| SQLite database location | Unchanged | `.code-intel/index.db` |
| Schema changes | None | Same tables, same columns |
| Data migration | Not needed | Backend reads existing data |
| ONNX model files | Unchanged | `.code-intel/models/` |

### 4.3 Verification

```bash
# Verify database is accessible after backend starts
curl http://127.0.0.1:48721/health
# Expected: {"status":"healthy","tools_loaded":52,"modules":{"memory":"ready",...}}
```

---

## 5. Application Deployment

### 5.1 Deployment Flow

![Deployment Flow](diagrams/deployment-flow.png)

### 5.2 Component A: Backend MCP Server

#### Step 1: Build Backend

```bash
cd src/backend
npm install
npm run build
```

**Verification:** `dist/index.js` exists, no TypeScript compilation errors.

#### Step 2: Package Backend

Option A — npm package (recommended for local distribution):
```bash
cd src/backend
npm pack
# Output: code-intel-backend-1.0.0.tgz
```

Option B — Standalone binary (for zero-dependency distribution):
```bash
cd src/backend
npx pkg . --targets node18-win-x64,node18-macos-x64,node18-linux-x64
# Output: code-intel-backend-win.exe, code-intel-backend-macos, code-intel-backend-linux
```

#### Step 3: Install/Deploy Backend

```bash
# Option A: npm global install
npm install -g ./code-intel-backend-1.0.0.tgz

# Option B: Copy binary to known path
cp code-intel-backend-win.exe "C:\Program Files\code-intel-backend\code-intel-backend.exe"
```

#### Step 4: Verify Backend Starts

```bash
# Start backend manually
cd src/backend
npm start

# Or if installed globally
code-intel-backend

# Verify health
curl http://127.0.0.1:48721/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 5,
  "tools_loaded": 52,
  "modules": {
    "memory": "ready",
    "codeIntel": "ready",
    "orchestration": "ready",
    "analytics": "ready",
    "kbGraph": "ready"
  }
}
```

### 5.3 Component B: Extension (Thin Proxy)

#### Step 1: Build Extension

```bash
cd src/extension
npm install
npm run build
```

**Verification:** `dist/extension.js` exists, bundle size < 1MB.

#### Step 2: Package Extension (.vsix)

```bash
cd src/extension
npm run package
# Output: code-intel-extension-1.0.0.vsix
```

**Verification:** .vsix file size < 5MB.

```powershell
# Verify size
(Get-Item "code-intel-extension-1.0.0.vsix").Length / 1MB
# Must be < 5
```

#### Step 3: Install Extension Locally (DEV/SIT)

```bash
code --install-extension code-intel-extension-1.0.0.vsix
```

#### Step 4: Publish to Marketplace (UAT/PROD)

```bash
cd src/extension
npx vsce publish --pat $VSCE_PAT
```

#### Step 5: Verify Extension Activation

1. Open VS Code
2. Check Output Channel: "Code Intelligence" → "Connecting to Backend..."
3. Wait for status bar: "$(check) Code Intel: Connected"
4. Verify tool count: Run command `Code Intel: Show Connection Status`

### 5.4 Deployment Order

```
1. Deploy Backend FIRST (must be running before Extension connects)
2. Verify Backend health check passes
3. Deploy Extension
4. Verify Extension connects to Backend
5. Verify all 52 tools functional
```

---

## 6. Configuration Changes

### 6.1 New VS Code Settings (Extension)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `codeIntel.backend.port` | number | 48721 | Backend server port |
| `codeIntel.backend.host` | string | 127.0.0.1 | Backend host (localhost only) |
| `codeIntel.backend.backendPath` | string | "" | Path to backend entry point |
| `codeIntel.backend.autoStart` | boolean | true | Auto-start backend on activation |
| `codeIntel.backend.healthCheckInterval` | number | 5000 | Health check interval (ms) |
| `codeIntel.backend.startupTimeout` | number | 30000 | Max wait for backend startup (ms) |

### 6.2 Environment Variables (Backend)

| Variable | Description | Default | DEV | SIT | UAT | PROD |
|----------|-------------|---------|-----|-----|-----|------|
| `CODE_INTEL_PORT` | Server port | 48721 | 48721 | 48721 | 48721 | 48721 |
| `CODE_INTEL_HOST` | Bind address | 127.0.0.1 | 127.0.0.1 | 127.0.0.1 | 127.0.0.1 | 127.0.0.1 |
| `CODE_INTEL_LOG_LEVEL` | Pino log level | info | debug | info | info | warn |
| `CODE_INTEL_DB_PATH` | SQLite database path | .code-intel/index.db | (auto) | (auto) | (auto) | (auto) |
| `CODE_INTEL_MODEL_PATH` | ONNX model directory | .code-intel/models | (auto) | (auto) | (auto) | (auto) |

### 6.3 Settings.json Example

```json
{
  "codeIntel.backend.port": 48721,
  "codeIntel.backend.host": "127.0.0.1",
  "codeIntel.backend.autoStart": true,
  "codeIntel.backend.healthCheckInterval": 5000,
  "codeIntel.backend.startupTimeout": 30000
}
```

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Endpoint/Command | Expected Result | Timeout |
|-------|-----------------|-----------------|---------|
| Backend alive | `GET http://127.0.0.1:48721/health` | 200 OK, `status: "healthy"` | 3s |
| Tools loaded | `GET http://127.0.0.1:48721/mcp/tools/list` | 200 OK, 52 tools returned | 5s |
| Extension connected | VS Code status bar | "$(check) Code Intel: Connected" | 30s |
| Module: Memory | Health response `modules.memory` | "ready" | 10s |
| Module: CodeIntel | Health response `modules.codeIntel` | "ready" | 10s |
| Module: Orchestration | Health response `modules.orchestration` | "ready" | 10s |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Tool proxy works | Call `mem_search` with query "test" | Returns results (no error) |
| 2 | Tool count correct | Call `find_tools` with query "*" | Returns 52 tools |
| 3 | Code intel works | Call `code_search` with query "function" | Returns code results |
| 4 | Webview renders | Open Dashboard panel | Shows data from backend API |
| 5 | Crash isolation | Kill backend process | Extension shows "Disconnected" (no crash) |
| 6 | Auto-reconnect | Restart backend after kill | Extension reconnects within 30s |
| 7 | Version display | Check status/about | Shows Backend v1.0.0 |

### 7.3 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| "Backend server started on 127.0.0.1:48721" | INFO | Within 10s of start | Backend stdout / pino logs |
| "All modules initialized" | INFO | Within 10s of start | Backend stdout |
| "Connected to Backend v1.0.0" | INFO | Within 30s of extension activate | Extension Output Channel |
| "Registered 52 tools" | INFO | After connection | Extension Output Channel |

### 7.4 Performance Verification

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Extension activate() | < 2,000ms | VS Code Extension Host profiler |
| Proxy latency (p99) | < 50ms | Timestamp diff in tool call logs |
| Backend startup | < 10,000ms | Time from spawn to healthy /health |
| .vsix file size | < 5MB | File system check |
| Backend memory usage | < 400MB | OS process monitor |

### 7.5 Monitoring

| Endpoint | Purpose | Frequency |
|----------|---------|-----------|
| `GET /health` | Backend availability | Every 5s (Extension polls) |
| Extension Output Channel | Debug logs | On-demand |
| Backend pino logs | Server-side diagnostics | Continuous |
| VS Code Status Bar | Visual connection indicator | Real-time |

---

## 8. Rollback Plan

### 8.1 Rollback Flow

![Rollback Flow](diagrams/rollback-flow.png)

### 8.2 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| Health check fails after backend deploy | Rollback backend immediately |
| Extension activation fails (> 5s) | Uninstall new extension, reinstall old |
| > 5% tool calls failing through proxy | Rollback to monolithic extension |
| Backend memory > 500MB (leak) | Rollback backend, investigate |
| Extension .vsix > 5MB (build issue) | Do not publish, fix build |
| All 52 tools not registered | Rollback extension, check tool list |
| Proxy latency > 200ms sustained | Rollback, investigate network |

### 8.3 Rollback Steps — Extension

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Uninstall new extension | `code --uninstall-extension code-intel-extension` | Extension removed |
| 2 | Install previous monolithic version | `code --install-extension code-intel-monolith-{prev_version}.vsix` | Extension activated |
| 3 | Stop backend (not needed for monolith) | Kill process on port 48721 | Port freed |
| 4 | Verify monolith tools work | Call any MCP tool | Returns expected result |

### 8.4 Rollback Steps — Backend Only

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Stop current backend | `taskkill /f /pid {PID}` or `kill {PID}` | Process stopped |
| 2 | Deploy previous backend version | `npm install -g code-intel-backend@{prev_version}` | Installed |
| 3 | Start previous backend | `code-intel-backend` | Process running |
| 4 | Verify health | `curl http://127.0.0.1:48721/health` | 200 OK |
| 5 | Verify extension reconnects | Check status bar | "Connected" |

### 8.5 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Stop backend | 5 seconds |
| Deploy previous version | 30 seconds |
| Restart and verify | 15 seconds |
| Extension reconnection | 30 seconds |
| **Total Backend Rollback** | **~80 seconds** |
| **Total Full Rollback (to monolith)** | **~3 minutes** |

---

## 9. Environment-Specific Notes

### 9.1 DEV

- Backend auto-started by extension (default `autoStart: true`)
- Logs at DEBUG level for development visibility
- Port conflicts: if 48721 in use, configure alternative in settings
- Hot reload: use `npm run dev` (tsx watch mode) during development

### 9.2 SIT

- Backend started manually or via system service
- Shared test machine may have port conflicts — verify before deploy
- Log level: INFO
- Run full smoke test suite after deploy

### 9.3 UAT

- Deploy after QA sign-off on SIT
- Extension installed from .vsix (not marketplace)
- Backend deployed as npm global package
- QA team verifies all 52 tools with parity testing

### 9.4 PROD (Marketplace)

- **Deployment Window:** Any time (local-only, no server impact)
- **Extension:** Published to VS Code Marketplace via `vsce publish`
- **Backend:** Distributed as npm package or bundled binary
- **Communication Plan:** Release notes in marketplace listing + CHANGELOG.md
- **Rollback:** Users can install previous extension version from marketplace
- **On-Call Contact:** Extension Team Lead

---

## 10. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Deployment Flow | [deployment-flow.png](diagrams/deployment-flow.png) | [deployment-flow.drawio](diagrams/deployment-flow.drawio) |
| 2 | Rollback Flow | [rollback-flow.png](diagrams/rollback-flow.png) | [rollback-flow.drawio](diagrams/rollback-flow.drawio) |

### Contacts

| Role | Name | Contact |
|------|------|---------|
| DevOps Lead | DevOps Agent | devops@team |
| Extension Dev Lead | Dev Lead | dev-lead@team |
| QA Lead | QA Agent | qa@team |

### Related Tickets

| Ticket | Summary | Relationship |
|--------|---------|-------------|
| KSA-284 | Split Extension: Lightweight Proxy + Backend MCP Server | Main ticket |

# Deployment Guide (DPG)

## Kiro SDLC Agents — KSA-293: Refactor Extension to Light Client of Remote Backend

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-293 |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Related BRD | BRD-v1-KSA-293.docx |
| Related TDD | TDD-v1-KSA-293.docx |

---

## 1. Overview

This guide covers deploying the refactored `kiro-sdlc-agents` VS Code extension v2.0.0. The extension has been transformed from a monolithic architecture (local MCP server + SQLite + ONNX) into a **lightweight client** that connects to a remote Kiro backend server.

**Key Changes:**
- No local MCP server spawn
- No local SQLite/ONNX dependencies
- No native binary addons
- All heavy computation delegated to remote backend
- Bundle size reduced from ~150MB to < 500KB

---

## 2. Prerequisites

| Prerequisite | Version | Verification |
|-------------|---------|--------------|
| VS Code / Kiro IDE | >= 1.85 | `code --version` |
| Node.js (extension host) | >= 18.0 | `node --version` |
| Remote Kiro Backend | Running | `curl {BACKEND_URL}/health` |
| Network Access | HTTP/HTTPS to backend | `ping {BACKEND_HOST}` |
| Backend JWT Auth | Configured | Login endpoint responds |

---

## 3. Deployment Steps

### Step 1: Build Extension Package

```bash
cd kiro-sdlc-agents
npm install
npm run package
# Output: kiro-sdlc-agents-2.0.0.vsix
```

### Step 2: Verify Bundle Size

```bash
ls -la kiro-sdlc-agents-2.0.0.vsix
# Expected: < 500KB (vs previous ~150MB with native addons)
```

### Step 3: Install Extension

**Option A: Command Line**
```bash
code --install-extension kiro-sdlc-agents-2.0.0.vsix
```

**Option B: VS Code UI**
1. Open VS Code → Extensions panel
2. Click "..." menu → "Install from VSIX..."
3. Select `kiro-sdlc-agents-2.0.0.vsix`

### Step 4: Configure Backend URL

```json
// settings.json
{
  "kiroSdlc.backend.url": "http://localhost:48721",
  "kiroSdlc.backend.healthCheckInterval": 30000
}
```

For production:
```json
{
  "kiroSdlc.backend.url": "https://kiro-backend.company.com",
  "kiroSdlc.backend.healthCheckInterval": 60000
}
```

### Step 5: Authenticate

1. Open command palette → "Kiro SDLC: Login"
2. Enter username/password OR click "SSO Login" for PKCE OAuth
3. Status bar shows green indicator on success

### Step 6: Verify Connection

```
Status bar: "Kiro: Connected" (green)
Command palette → "Kiro SDLC: Connection Status" → shows health metrics
```

### Step 7: Sync Workspace

On successful connection, WorkspaceSyncService automatically:
1. Scans workspace file tree
2. Sends structure to backend `/api/workspace/sync`
3. Status bar shows sync progress

---

## 4. Pre-Deployment Checklist

| # | Item | Done |
|---|------|------|
| 1 | Remote backend server running and healthy | ☐ |
| 2 | Backend `/health` endpoint responds 200 | ☐ |
| 3 | Backend `/mcp/tools/list` returns 52+ tools | ☐ |
| 4 | JWT auth endpoint `/api/auth/login` working | ☐ |
| 5 | Previous extension version uninstalled or will be overwritten | ☐ |
| 6 | User has network access to backend URL | ☐ |
| 7 | VS Code version >= 1.85 | ☐ |
| 8 | Extension .vsix built successfully (< 500KB) | ☐ |
| 9 | No local `.code-intel/models/` folder needed (cleanup optional) | ☐ |

---

## 5. Post-Deployment Verification

| # | Test | Expected Result |
|---|------|----------------|
| 1 | Extension activates in < 2s | No process spawn, fast activation |
| 2 | Status bar shows connection state | Green = connected, Red = disconnected |
| 3 | Login via command palette | JWT token stored in SecretStorage |
| 4 | "Kiro SDLC: Inject All Agents" | Agents injected to `.kiro/agents/` |
| 5 | Webview panels load remote data | Dashboard, Graph, Tags panels show data |
| 6 | MCP tool call forwarding | `find_tools` returns 52+ tools |
| 7 | Chat panel streams via SSE | Messages streamed from remote LLM |
| 8 | "Index Documents" uploads to backend | Progress bar, completion notification |
| 9 | Auto-reconnect on network loss | Reconnects within 30s (exponential backoff) |
| 10 | No local SQLite files created | `.code-intel/*.db` not created |

---

## 6. Rollback Plan

### Immediate Rollback (< 2 minutes)

1. Uninstall v2.0.0:
   ```bash
   code --uninstall-extension dnguyenminh.kiro-sdlc-agents
   ```
2. Reinstall previous version:
   ```bash
   code --install-extension kiro-sdlc-agents-1.26.0.vsix
   ```
3. Previous version will spawn local MCP server as before

### Rollback Considerations

| Scenario | Action | Risk |
|----------|--------|------|
| Backend unreachable | Extension shows disconnected state, local ops still work | Low |
| Auth failure | Re-login or check backend auth config | Low |
| Feature regression | Rollback to v1.26.0 | Low — no data migration |
| Network latency issues | Adjust timeout settings or use closer backend | Medium |

### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backend downtime | Extension limited to local ops | Auto-reconnect + offline mode for inject/config |
| Token expiry | Brief auth interruption | Auto-refresh before expiry |
| Network issues | Tool calls fail | Retry with exponential backoff |
| Bundle incompatibility | Extension won't activate | Keep previous .vsix for rollback |

---

## 7. Migration from v1.x (Monolith)

### What's Removed (No Longer Needed)

| Item | Previous Location | Action |
|------|-------------------|--------|
| Local MCP server | In-process / child-process | Removed — backend handles |
| SQLite databases | `.code-intel/*.db` | Can delete (optional) |
| ONNX models | `.code-intel/models/` | Can delete (saves ~90-470MB) |
| Native binaries | `prebuilds/` | Removed from extension |
| better-sqlite3 | node_modules | Removed from dependencies |
| onnxruntime-node | node_modules | Removed from dependencies |

### Settings Migration

| Old Setting | New Setting | Notes |
|-------------|-------------|-------|
| `kiroSdlc.enableMcpServer` | Removed | No local server |
| `kiroSdlc.mcpServerPort` | Removed | No local port |
| — | `kiroSdlc.backend.url` | New: backend URL |
| — | `kiroSdlc.backend.healthCheckInterval` | New: health check interval |

### Commands Migration

| Old Command | New Command | Notes |
|-------------|-------------|-------|
| Restart MCP Server | Removed | No local server |
| Stop MCP Server | Removed | No local server |
| Change Port | Removed | No local port |
| Download Embedding Model | Removed | Remote backend handles |
| — | Kiro SDLC: Login | New: authenticate |
| — | Kiro SDLC: Logout | New: clear credentials |
| — | Kiro SDLC: Connection Status | New: show health |

---

## 8. Monitoring

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Extension activation time | VS Code performance tab | > 2 seconds |
| Connection status | Status bar indicator | Red for > 60s |
| Tool call latency | Backend logs | p95 > 5 seconds |
| Auth token refresh | SecretStorage events | Refresh failures > 3 |
| Workspace sync | Backend logs | Sync timeout > 30s |
| Bundle size | .vsix file | > 1MB |

---

## 9. Configuration Reference

```json
{
  "kiroSdlc.backend.url": "http://localhost:48721",
  "kiroSdlc.backend.healthCheckInterval": 30000,
  "kiroSdlc.backend.toolCallTimeout": 300000,
  "kiroSdlc.backend.uploadTimeout": 600000,
  "kiroSdlc.backend.reconnectMaxAttempts": 5,
  "kiroSdlc.auth.mode": "jwt",
  "kiroSdlc.auth.ssoProvider": ""
}
```

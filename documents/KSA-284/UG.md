# User Guide

## Code Intelligence Extension — Split Architecture

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-284 |
| Version | 1.0 |
| Date | 2025-07-11 |
| Status | Draft |

---

## 1. Quick Start

Get up and running in 3 steps:

1. **Install Extension** from VS Code Marketplace (search "Code Intelligence")
2. **Backend auto-starts** — no manual setup needed (default: `autoStart: true`)
3. **Verify** — status bar shows green "Connected" icon with Backend version

That's it. All 52 MCP tools are now available to AI agents and commands.

---

## 2. Installation

### 2.1 System Requirements

| Component | Minimum Version |
|-----------|----------------|
| VS Code / Kiro | >= 1.85.0 |
| Node.js | >= 18.0 |
| OS | Windows 10+, macOS 12+, Ubuntu 20.04+ |
| RAM | 320MB (20MB extension + 300MB backend) |
| Disk | 250MB (5MB extension + 220MB backend) |

### 2.2 Install Extension

**Option A — Marketplace (recommended):**
```
Ctrl+Shift+X -> Search "Code Intelligence" -> Install
```

**Option B — From .vsix:**
```bash
code --install-extension code-intel-extension-1.0.0.vsix
```

### 2.3 Install Backend

**Option A — Bundled (default):**
Backend ships with the extension and auto-starts. No action needed.

**Option B — Standalone npm:**
```bash
npm install -g code-intel-backend
```

**Option C — From source:**
```bash
cd src/backend
npm install
npm run build
```

---

## 3. Configuration Reference

### 3.1 Extension Settings (VS Code settings.json)

| Setting | Type | Default | Range | Description |
|---------|------|---------|-------|-------------|
| `codeIntel.backend.port` | number | 48721 | 1024-65535 | Backend HTTP port |
| `codeIntel.backend.host` | string | "127.0.0.1" | — | Backend host (localhost only) |
| `codeIntel.backend.backendPath` | string | "" | valid path | Path to Backend entry point |
| `codeIntel.backend.autoStart` | boolean | true | — | Auto-spawn Backend on activation |
| `codeIntel.backend.healthCheckInterval` | number | 5000 | 1000-60000 | Health poll interval (ms) |
| `codeIntel.backend.startupTimeout` | number | 30000 | 5000-120000 | Max Backend startup wait (ms) |

### 3.2 Example settings.json

```json
{
  "codeIntel.backend.port": 48721,
  "codeIntel.backend.autoStart": true,
  "codeIntel.backend.healthCheckInterval": 5000,
  "codeIntel.backend.startupTimeout": 30000
}
```

### 3.3 Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CODE_INTEL_PORT` | 48721 | HTTP server port |
| `CODE_INTEL_HOST` | 127.0.0.1 | Bind address |
| `CODE_INTEL_DATA_DIR` | .code-intel | Data directory path |
| `CODE_INTEL_LOG_LEVEL` | info | Log level (debug/info/warn/error) |
| `CODE_INTEL_ONNX_PATH` | models/model.onnx | ONNX model location |
| `CODE_INTEL_DB_PATH` | index.db | SQLite database path |

---

## 4. Usage

### 4.1 MCP Tools (52 tools)

All tools are available to AI agents automatically. Categories:

| Category | Count | Examples |
|----------|-------|---------|
| Memory | 17 | `mem_search`, `mem_ingest`, `mem_graph`, `mem_tags` |
| Code Intelligence | 25 | `code_search`, `code_symbols`, `code_context`, `find_duplicates` |
| Orchestration | 6 | `find_tools`, `execute_dynamic_tool`, `orchestration_status` |
| Utility | 4 | `agent_log`, `stream_write_file`, `drawio_auto_layout` |

**Example tool call (from AI agent):**
```
mem_search(query: "authentication flow", limit: 5)
```

### 4.2 Webview Panels

Open via Command Palette (`Ctrl+Shift+P`):

| Command | Panel | Description |
|---------|-------|-------------|
| `Code Intel: Open Dashboard` | Dashboard | Overview metrics, recent activity |
| `Code Intel: Open KB Graph` | KB Graph | Knowledge base visualization |
| `Code Intel: Open Analytics` | Analytics | Usage statistics, timelines |
| `Code Intel: Open Tags` | Tags | Tag management (CRUD) |
| `Code Intel: Open Quality` | Quality | Quality scores, audit results |

### 4.3 Commands

| Command | Description |
|---------|-------------|
| `Code Intel: Reconnect to Backend` | Force reconnection |
| `Code Intel: Disconnect from Backend` | Disconnect (tools unavailable) |
| `Code Intel: Show Connection Status` | Display state, version, PID |

---

## 5. Architecture Overview

```
+-------------------+         HTTP (localhost:48721)         +-------------------+
|                   |                                         |                   |
|   VS Code IDE     |  --- Tool Call ----------------------> |  Backend MCP      |
|                   |                                         |  Server           |
|  +-----------+    |  <-- JSON Response ------------------- |                   |
|  | Extension |    |                                         |  - Memory         |
|  | (Proxy)   |    |  --- GET /health -------------------->  |  - Code Intel     |
|  |  <5MB     |    |                                         |  - Orchestration  |
|  +-----------+    |  --- GET /api/* --------------------->  |  - Analytics      |
|                   |                                         |  - KB Graph       |
|  +-----------+    |                                         |  - Utility        |
|  | Webview   |    |                                         |                   |
|  | Panels    |    |                                         |  ~300MB RAM       |
|  +-----------+    |                                         |  Port 48721       |
|                   |                                         |                   |
+-------------------+                                         +-------------------+
     ~20MB RAM                                                  Separate process
```

**Key points:**
- Extension is a thin proxy — zero business logic
- Backend crash does NOT affect IDE
- Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s... max 30s)
- All communication over localhost only (secure)

---

## 6. Administration

### 6.1 Start Backend Manually

```bash
# If installed globally
code-intel-backend

# If from source
cd src/backend && npm run dev

# With custom port
CODE_INTEL_PORT=9000 code-intel-backend
```

### 6.2 Stop Backend

```bash
# Windows:
tasklist | findstr "code-intel"
taskkill /PID <pid>

# macOS/Linux:
ps aux | grep code-intel
kill <pid>
```

### 6.3 View Logs

- **Extension logs:** VS Code Output Panel -> select "Code Intelligence"
- **Backend logs:** stdout of Backend process (structured JSON via pino)

### 6.4 Data Locations

| Data | Location | Description |
|------|----------|-------------|
| SQLite DB | `.code-intel/index.db` | Memory entries, code index |
| ONNX Model | `.code-intel/models/model.onnx` | Embedding model |
| Orchestration | `.code-intel/orchestration.json` | Child server config |
| Agent Log | `.code-intel/agent-log.jsonl` | Agent action history |

---

## 7. Troubleshooting

### Common Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Status bar red "Disconnected" | Backend not running | Check if Backend process is alive. Run `Code Intel: Reconnect` |
| "Backend not found" notification | backendPath invalid | Set correct path in settings or install Backend globally |
| Port conflict (ERR-008) | Another service on 48721 | Change `codeIntel.backend.port` to different port |
| Slow activation (>2s) | Should not happen | Extension activates async. Check Output channel |
| Tool returns "Backend unavailable" | Connection lost mid-call | Backend crashed or restarting. Wait for auto-reconnect |
| Webview shows "No data" | Backend still initializing | Wait for modules to load (~5-10s on first start) |
| "Version incompatible" warning | Backend/Extension mismatch | Update Backend to compatible version |

### Diagnostic Steps

1. **Check Output channel:** `View -> Output -> Code Intelligence`
2. **Check Backend process:** `Code Intel: Show Connection Status`
3. **Test health endpoint:** `curl http://127.0.0.1:48721/health`
4. **Check port:** `netstat -an | findstr 48721`
5. **Restart:** Kill Backend then run `Code Intel: Reconnect`

---

## 8. Error Codes

| Code | Severity | Category | Message | Action |
|------|----------|----------|---------|--------|
| ERR-001 | Critical | Connection | Backend not installed | Install Backend or set backendPath |
| ERR-002 | Critical | Connection | Backend failed to start | Check Output channel for details |
| ERR-003 | Warning | Connection | Backend disconnected | Auto-reconnect in progress. Wait. |
| ERR-004 | Critical | Connection | Backend unreachable (100 retries) | Click status bar to retry manually |
| ERR-005 | Warning | Proxy | Tool call timeout | Backend may be overloaded. Retry. |
| ERR-006 | Warning | Proxy | Tool call failed (5xx) | Check Backend logs for internal error |
| ERR-007 | Info | Version | Backend version mismatch | Consider updating Backend |
| ERR-008 | Critical | Config | Port conflict | Change port in settings.json |
| ERR-009 | Critical | Config | Invalid configuration | Check settings values and ranges |
| ERR-010 | Warning | Webview | API data fetch failed | Click retry in panel. Check Backend. |

---

## 9. FAQ

**Q: Does the extension need internet access?**
A: No. All communication is localhost only (127.0.0.1). No data leaves your machine.

**Q: How do I back up my data?**
A: Copy the `.code-intel/` directory. It contains the SQLite database and all indexed data.

**Q: How do I update the Backend?**
A: Stop Backend, replace binary (or `npm update -g code-intel-backend`), restart. Extension auto-reconnects.

**Q: Can multiple IDEs share one Backend?**
A: Yes, if they connect to the same port. Backend is IDE-agnostic.

**Q: What happens if Backend crashes?**
A: Extension stays active, shows "Disconnected" status. Auto-reconnects when Backend restarts. No IDE crash.

**Q: How much memory does it use?**
A: Extension ~20MB (in VS Code), Backend ~300MB (ONNX model + SQLite).

**Q: Can I run Backend on a remote machine?**
A: Not in v1 (localhost only). Remote support planned for future versions.

**Q: How do I check which tools are available?**
A: `curl http://127.0.0.1:48721/mcp/tools/list` or check status bar tooltip.

**Q: Why is Backend startup slow (~10s)?**
A: ONNX model loading takes 5-10s. This is async — Extension is usable immediately.

**Q: Can I disable auto-start?**
A: Yes. Set `codeIntel.backend.autoStart: false` in settings. Then start Backend manually.

---

## 10. API Reference

For developers building alternative frontends or debugging.

### GET /health

```bash
curl http://127.0.0.1:48721/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
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

### GET /mcp/tools/list

```bash
curl http://127.0.0.1:48721/mcp/tools/list
```

Returns array of 52 tool definitions with name, description, and inputSchema.

### POST /mcp/tools/call

```bash
curl -X POST http://127.0.0.1:48721/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"tool_name":"mem_search","arguments":{"query":"test","limit":5}}'
```

**Response:**
```json
{
  "content": [{"type": "text", "text": "Found 3 results..."}],
  "isError": false
}
```

### Webview Data APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/dashboard/summary | GET | Dashboard metrics |
| /api/dashboard/recent | GET | Recent activity |
| /api/kb/graph | GET | KB graph nodes + edges |
| /api/analytics/overview | GET | Analytics summary |
| /api/analytics/timeline | GET | Time-series data |
| /api/tags/list | GET | All tags |
| /api/tags | POST | Create tag |
| /api/tags/:id | PUT | Update tag |
| /api/tags/:id | DELETE | Delete tag |
| /api/quality/scores | GET | Quality scores |
| /api/quality/summary | GET | Quality summary |

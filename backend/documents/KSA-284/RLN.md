# Release Notes (RLN)

## Code Intelligence Extension — KSA-284: Split Extension: Lightweight Proxy + Backend MCP Server

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | 1.0.0 |
| Release Date | 2025-07-11 |
| Jira Ticket | KSA-284 |
| Environment | DEV / SIT / UAT / PROD |
| Author | DevOps Agent |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-11 | DevOps Agent | Initiate document |

---

## 1. What's New

### 1.1 Feature Summary

The Code Intelligence extension has been restructured from a monolithic architecture into a lightweight two-part system. Users will experience significantly faster IDE startup times, smaller extension download size, and improved stability — while all existing features continue to work identically.

**Key Benefits:**
- **10x faster activation** — Extension activates in <2s (down from ~10s)
- **40x smaller install** — Extension is <5MB (down from ~200MB)
- **Crash-proof** — Backend crashes no longer affect IDE stability
- **Independent updates** — Backend can be updated without marketplace review

### 1.2 User-Facing Changes

| # | Change | Description | Impact |
|---|--------|-------------|--------|
| 1 | Faster IDE startup | Extension loads in <2s instead of ~10s | High |
| 2 | Smaller extension size | Download reduced from ~200MB to <5MB | High |
| 3 | New status bar indicator | Shows Backend connection state (Connected/Disconnected) | Low |
| 4 | Auto-reconnect capability | Extension auto-reconnects if Backend restarts | Medium |
| 5 | Configurable Backend settings | Port, host, auto-start options in VS Code settings | Low |

### 1.3 Architecture Change

The monolithic extension has been split into two independently deployable components:

| Component | Responsibility | Size | Process |
|-----------|---------------|------|---------|
| Extension (Thin Proxy) | Tool registration, UI rendering, connection management | <5MB | VS Code Extension Host |
| Backend MCP Server | All business logic (Memory, Code Intel, Orchestration, Analytics, KB Graph) | ~220MB | Standalone Node.js process |

---

## 2. Technical Changes

### 2.1 API Changes

| Type | Endpoint | Method | Description |
|------|----------|--------|-------------|
| New | /health | GET | Backend health and version info |
| New | /mcp/tools/list | GET | List all 52 available tool definitions |
| New | /mcp/tools/call | POST | Execute an MCP tool via HTTP proxy |
| New | /api/dashboard/summary | GET | Dashboard overview metrics |
| New | /api/kb/graph | GET | KB graph nodes and edges |
| New | /api/analytics/overview | GET | Analytics summary data |
| New | /api/tags/list | GET | Tags with counts |
| New | /api/quality/scores | GET | Quality scores per entry |

### 2.2 Database Changes

| Type | Object | Description |
|------|--------|-------------|
| No changes | .code-intel/index.db | SQLite database unchanged — reused by Backend |

### 2.3 Configuration Changes

| Property | Change Type | Description |
|----------|-----------|-------------|
| `codeIntel.backend.port` | New | Backend server port (default: 48721) |
| `codeIntel.backend.host` | New | Backend host (default: 127.0.0.1) |
| `codeIntel.backend.backendPath` | New | Path to backend entry point |
| `codeIntel.backend.autoStart` | New | Auto-start backend (default: true) |
| `codeIntel.backend.healthCheckInterval` | New | Health check interval (default: 5000ms) |
| `codeIntel.backend.startupTimeout` | New | Backend startup timeout (default: 30000ms) |

### 2.4 Infrastructure Changes

| Component | Change | Description |
|-----------|--------|-------------|
| Extension process | Modified | Reduced to thin proxy (~20MB RAM) |
| Backend process | New | Standalone Node.js on port 48721 (~300MB RAM) |
| Communication | New | HTTP/JSON on localhost between Extension and Backend |
| Process isolation | New | Backend crash does not affect IDE |

---

## 3. Bug Fixes

No bug fixes included in this release. This is a new architecture release (restructure).

---

## 4. Known Issues & Limitations

| # | Issue | Impact | Workaround | Target Fix |
|---|-------|--------|------------|------------|
| 1 | Backend startup includes ONNX model load (~5-10s) | First tool call may wait for Backend initialization | Extension shows "Connecting..." status; wait for "Connected" | Future: lazy module loading |
| 2 | Port 48721 may conflict with other services | Backend fails to start if port in use | Configure alternative port in `codeIntel.backend.port` | N/A (by design) |
| 3 | No authentication between Extension and Backend | Only localhost — no security concern for local use | N/A | Future: if remote Backend needed |
| 4 | Backend requires Node.js >= 18.0 on machine | Users without Node.js cannot run Backend standalone | Use bundled binary distribution instead | v1.1.0 (auto-bundled Node) |
| 5 | Windows firewall may prompt on first Backend start | User sees firewall dialog | Allow access for Node.js on localhost only | Document in user guide |

---

## 5. Dependencies

### 5.1 Pre-requisite Releases

| Release | Version | Status | Required Before |
|---------|---------|--------|-----------------|
| Node.js | >= 18.0 | Available | Backend deployment |
| VS Code | >= 1.85.0 | Available | Extension activation |

### 5.2 External System Changes

| System | Change Required | Status | Contact |
|--------|----------------|--------|---------|
| VS Code Marketplace | New extension listing (lightweight version) | Pending | DevOps |
| npm Registry | New package: code-intel-backend | Pending (if publishing) | DevOps |

---

## 6. Migration Notes

### 6.1 Migration from Monolithic Extension

| Step | Action | Automated | Estimated Time |
|------|--------|-----------|----------------|
| 1 | Uninstall monolithic extension | Manual | 10 seconds |
| 2 | Install Backend (npm or binary) | Manual | 30 seconds |
| 3 | Install new lightweight Extension | Manual | 10 seconds |
| 4 | Open VS Code — Backend auto-starts | Automatic | 10 seconds |
| 5 | Verify connection via status bar | Automatic | 5 seconds |

**Total migration time: ~1 minute**

### 6.2 Breaking Changes

| Change | Impact | Migration Path |
|--------|--------|---------------|
| Extension no longer contains business logic | None visible to users — all tools work identically | Install both Extension + Backend |
| Separate Backend process required | Backend must be running for tools to work | Extension auto-starts Backend (default) |
| New VS Code settings namespace | Old settings (if any) not migrated | Configure new `codeIntel.backend.*` settings |

### 6.3 Backward Compatibility

**Fully backward compatible from a user perspective.** All 52 MCP tools maintain identical:
- Tool names
- Parameter schemas (input)
- Response formats (output)
- Error codes and messages

The proxy is transparent — callers (IDE, agents, users) see no behavioral difference.

### 6.4 Data Preservation

- SQLite database (`.code-intel/index.db`) — **preserved as-is**, no migration needed
- ONNX model files (`.code-intel/models/`) — **preserved as-is**
- Orchestration config (`.code-intel/orchestration.json`) — **preserved as-is**
- Tool list (`.code-intel/tool-list.txt`) — **preserved as-is**

---

## 7. Testing Summary

| Test Level | Total | Passed | Failed | Blocked | Pass Rate |
|-----------|-------|--------|--------|---------|-----------|
| Unit Tests | 18 | 18 | 0 | 0 | 100% |
| Integration Tests | 11 | 11 | 0 | 0 | 100% |
| Total | 29 | 29 | 0 | 0 | 100% |

### Defect Summary

| Severity | Found | Fixed | Open | Deferred |
|----------|-------|-------|------|----------|
| Critical | 0 | 0 | 0 | 0 |
| Major | 0 | 0 | 0 | 0 |
| Minor | 0 | 0 | 0 | 0 |

---

## 8. Deployment Instructions

See: [Deployment Guide](DPG-v1-KSA-284.docx)

### Quick Reference

| Step | Action | Estimated Time |
|------|--------|---------------|
| 1 | Build Backend (`npm run build`) | 15 seconds |
| 2 | Package Backend (`npm pack`) | 5 seconds |
| 3 | Build Extension (`npm run build`) | 10 seconds |
| 4 | Package Extension (`vsce package`) | 10 seconds |
| 5 | Deploy Backend + verify health | 30 seconds |
| 6 | Deploy Extension + verify connection | 30 seconds |
| 7 | Run smoke tests | 2 minutes |
| **Total** | | **~3.5 minutes** |

---

## 9. Rollback Plan

See: [Deployment Guide — Section 8](DPG-v1-KSA-284.docx)

**Rollback Decision Criteria:**
- Health check fails after Backend deployment
- Extension activation exceeds 5 seconds
- More than 5% of tool calls failing
- Backend memory usage exceeds 500MB

**Estimated Rollback Time:** ~80 seconds (Backend only) / ~3 minutes (full rollback to monolith)

---

## 10. Contacts

| Role | Name | Contact | Responsibility |
|------|------|---------|---------------|
| Release Manager | DevOps Agent | devops@team | Release coordination |
| Dev Lead | Extension Dev Lead | dev-lead@team | Technical issues |
| QA Lead | QA Agent | qa@team | Testing sign-off |
| DevOps | DevOps Agent | devops@team | Deployment execution |
| Business Owner | Extension Team Lead | team-lead@team | Business sign-off |

---

## 11. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Dev Lead | | | ☐ Approved |
| QA Lead | | | ☐ Approved |
| Business Owner | | | ☐ Approved |
| Release Manager | | | ☐ Approved |

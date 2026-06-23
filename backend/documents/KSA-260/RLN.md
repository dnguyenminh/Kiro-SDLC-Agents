# Release Notes (RLN)

## Kiro SDLC Agents — KSA-260: Chuyển MCP Server từ Child Process sang In-Process

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | PATCH (technical refactor) |
| Release Date | 2026-06-17 |
| Jira Ticket | KSA-260 |
| Branch | KSA-260 |
| Author | DevOps Agent |

---

## 1. Summary

Migrated the MCP Code Intelligence server from a spawned child process to an in-process implementation running directly in the VS Code extension host. Eliminates external Node.js runtime dependency, spawn failures, and orphan process issues.

---

## 2. Improvements

| # | Improvement | Description |
|---|-------------|-------------|
| 1 | No child process | MCP server runs in extension host directly |
| 2 | No system Node.js dependency | Removed runtime requirement for node on PATH |
| 3 | Faster startup | No process spawn overhead |
| 4 | No orphan processes | Clean lifecycle tied to extension host |
| 5 | Simplified architecture | Single process, direct function calls |

---

## 3. Technical Changes

### 3.1 New Files

| File | Purpose |
|------|---------|
| `src/mcp-server-inprocess.ts` | In-process MCP server class |

### 3.2 Modified Files

| File | Change |
|------|--------|
| `src/mcp-server-manager.ts` | Re-exports in-process implementation |

### 3.3 Removed

| Item | Reason |
|------|--------|
| Child process spawn logic | Replaced by in-process |
| PATH detection code | No longer needed |
| Process health monitor | No external process to monitor |

---

## 4. Breaking Changes

No breaking changes. All MCP tool interfaces remain identical.

---

## 5. Known Limitations

- MCP server shares memory with extension host (larger footprint in single process)
- Cannot restart MCP independently (requires extension reload)

---

## 6. Upgrade Instructions

1. Update extension to latest version
2. Restart VS Code / Kiro IDE
3. No configuration changes needed
4. System Node.js no longer required on PATH

---

## 7. Rollback

Revert to previous extension version. Will require system Node.js on PATH again.

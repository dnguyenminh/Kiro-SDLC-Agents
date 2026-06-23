# Deployment Guide (DPG)

## FEC_CR_Builder — KSA-191: Salesforce Language Support (v2 — Extend Existing Tools)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-191 |
| Title | Salesforce Language Support — Extend Existing Tools |
| Author | DevOps Agent |
| Version | 2.0 |
| Date | 2026-06-02 |
| Status | Final |
| Related TDD | TDD-v2-KSA-191.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-27 | DevOps Agent | Initial — 3 MCP servers approach (SUPERSEDED) |
| 2.0 | 2026-06-02 | DevOps Agent | v2 rewrite — extend existing tools, shared library |

---

## 1. Overview

### 1.1 Feature Summary

This deployment extends `mcp-code-intelligence-nodejs` with Salesforce language support. No new MCP servers are created. All SF capabilities are delivered by:

1. **Extending 7 existing tools** — `code_index_status`, `code_search`, `code_symbols`, `code_dependencies`, `code_impact`, `code_callers`/`code_callees`, `mem_ingest_file`
2. **Adding parsers** — `apex-parser.ts` (Tree-sitter) + `salesforce-meta-parser.ts` (DOMParser)
3. **Shared library** — `mcp-salesforce-intelligence/` (reusable SF parsing utilities, NOT a server)

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| `mcp-code-intelligence-nodejs/` | MODIFIED | Apex parser, SF meta parser, graph enhancements, indexer SFDX detection |
| `mcp-salesforce-intelligence/` | NEW (shared lib) | Reusable SF utilities (SfdxDetector, relationship types, grammar loader) |
| No new MCP servers | N/A | Existing server enhanced — zero new processes |
| No new tools | N/A | Existing 7 tools return richer results for SFDX projects |
| No database schema changes | N/A | Same SQLite tables, new relationship `kind` values |

### 1.3 Architecture Change

```
BEFORE (v1.14.0):                    AFTER (v1.15.0):
mcp-code-intelligence-nodejs         mcp-code-intelligence-nodejs
├── 7 languages supported            ├── 9 languages supported (+apex, +salesforce-meta)
├── TypeScript, Python, Kotlin...    ├── TypeScript, Python, Kotlin, Apex, SF-Meta...
└── No SFDX awareness                ├── SFDX project auto-detection
                                     ├── SF relationship types in graph
                                     └── Enhanced tool responses for SF projects

                                     mcp-salesforce-intelligence/ (shared library)
                                     ├── SfdxDetector
                                     ├── SF relationship type constants
                                     └── Apex grammar loader utility
```

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| Local development machine | Ready | Windows/macOS/Linux |
| Node.js 20+ | Required | `node --version >= 20.0.0` |
| Git access to FEC_CR_Builder repo | Required | Clone or pull latest |

### 2.2 Software Dependencies

| Dependency | Version | Purpose | Type |
|-----------|---------|---------|------|
| web-tree-sitter | ^0.26.9 | AST parsing (Apex grammar) | Existing dep |
| salesforce-ast | ^1.0.0 | Apex .wasm grammar source | Optional dep |
| better-sqlite3 | ^12.10.0 | SQLite storage | Existing dep |
| @modelcontextprotocol/sdk | ^1.12.0 | MCP protocol | Existing dep |

### 2.3 No New Dependencies Required

All runtime dependencies are already in `mcp-code-intelligence-nodejs/package.json`. The `salesforce-ast` package is listed as `optionalDependencies` — the server functions without it (graceful degradation).

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | All 148 tests pass | QA | ✅ Verified |
| 2 | TypeScript compilation clean | DEV | ✅ Verified |
| 3 | mcp-salesforce-intelligence/ builds successfully | DEV | ✅ Verified |
| 4 | Non-SF project regression: zero impact | QA | ✅ Verified |
| 5 | Apex grammar .wasm present in grammars/ | DEV | ✅ Verified |
| 6 | grammar-config.json has apex + salesforce-meta entries | DEV | ✅ Verified |
| 7 | UAT accepted | User | ✅ Confirmed |

---

## 4. Deployment Steps

### 4.1 Deployment Flow

```
┌──────────────┐   ┌──────────────┐   ┌────────────────┐   ┌──────────────┐
│  Pull main   │──▶│ npm install   │──▶│  npm run build  │──▶│   Verify     │
│  (latest)    │   │ (both dirs)   │   │  (both dirs)    │   │  (tests)     │
└──────────────┘   └──────────────┘   └────────────────┘   └──────────────┘
```

### 4.2 Step-by-Step

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Pull latest main | `git pull origin main` | Up to date |
| 2 | Install shared library deps | `cd mcp-salesforce-intelligence && npm install` | No errors |
| 3 | Build shared library | `npm run build` | `dist/` populated |
| 4 | Install MCP server deps | `cd mcp-code-intelligence-nodejs && npm install` | No errors |
| 5 | Build MCP server | `npm run build` | `dist/` populated, apex.wasm copied |
| 6 | Run tests | `npm run test:vitest` | All pass |
| 7 | Restart MCP server | Reload Kiro IDE | Server reconnects |

### 4.3 Detailed Commands

```powershell
# Step 1: Pull latest
cd c:\projects\kiro\FEC_CR_Builder
git pull origin main

# Step 2-3: Build shared library
cd mcp-salesforce-intelligence
npm install
npm run build

# Step 4-6: Build MCP server
cd ..\mcp-code-intelligence-nodejs
npm install
npm run build
npm run test:vitest

# Step 7: Verify
node dist/index.js --version
```

---

## 5. Configuration Changes

### 5.1 No Configuration Changes Required

The existing `mcp-code-intelligence-nodejs` server automatically detects SFDX projects. No mcp.json changes, no env vars, no feature flags.

| Config | Change | Notes |
|--------|--------|-------|
| `.kiro/settings/mcp.json` | NONE | Same server entry as before |
| Environment variables | NONE | Auto-detection via `sfdx-project.json` |
| grammar-config.json | Already updated | Apex + salesforce-meta entries added during implementation |

### 5.2 Automatic Activation

SF support auto-activates when:
- File with `.cls`, `.trigger`, `.flow-meta.xml`, `.object-meta.xml`, or `.js-meta.xml` extension is encountered during indexing
- OR `sfdx-project.json` exists in workspace root

---

## 6. Post-Deployment Verification

### 6.1 Health Checks

| Check | Method | Expected Result |
|-------|--------|-----------------|
| Server starts | Reload IDE | MCP server connected |
| Non-SF workspace | `code_index_status` | Normal response, no `sfdx` section |
| SF workspace | `code_index_status` on SFDX project | `sfdx.detected: true` with stats |
| Apex parsing | `code_symbols` on .cls file | Returns class, methods, properties |
| SF relationships | `code_dependencies` on Apex class | Shows trigger-on, soql, dml edges |

### 6.2 Smoke Tests

| # | Scenario | Tool | Expected |
|---|----------|------|----------|
| 1 | Index non-SF project | `code_index_status` | No regression, no `sfdx` section |
| 2 | Index SFDX project | `code_index_status` | `sfdx.detected: true`, stats populated |
| 3 | Parse Apex class | `code_symbols` on .cls file | Class name, methods, annotations |
| 4 | Query SF dependencies | `code_dependencies` | trigger-on, soql, dml relationships |
| 5 | Impact analysis | `code_impact` on SObject | Shows all referencing Apex + Flows |

---

## 7. Rollback Plan

### 7.1 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| MCP server crashes on startup | Revert to v1.14.0 tag |
| Non-SF project performance regression | Remove apex/sf-meta from grammar-config.json |
| Apex parsing causes memory issues | Remove tree-sitter-apex.wasm, rebuild |
| All tools affected | `git checkout v1.14.0 -- mcp-code-intelligence-nodejs/` |

### 7.2 Quick Rollback (Grammar Disable)

```json
// In grammar-config.json: remove "apex" and "salesforce-meta" entries
// Then rebuild: npm run build
// Result: server ignores SF files, no Apex grammar loaded
```

### 7.3 Full Rollback

```powershell
git checkout v1.14.0 -- mcp-code-intelligence-nodejs/
cd mcp-code-intelligence-nodejs
npm install && npm run build
# Reload Kiro IDE
```

### 7.4 Rollback Time: < 3 minutes

---

## 8. Database Impact

### 8.1 No Schema Migration

Same SQLite tables, same columns. New `kind` values in `relationships` table:

| New kind value | Description |
|---------------|-------------|
| trigger-on | Trigger fires on SObject |
| soql | Method queries SObject |
| dml | Method writes to SObject |
| wire | LWC imports Apex via @wire |
| flow-action | Flow invokes Apex class |
| flow-object | Flow references SObject |
| apex-import | LWC imports Apex method |

### 8.2 Cleanup (if rollback needed)

```sql
DELETE FROM relationships WHERE kind IN ('trigger-on','soql','dml','wire','flow-action','flow-object','apex-import');
DELETE FROM files WHERE language IN ('apex', 'salesforce-meta');
```

---

## 9. Performance Impact

| Metric | Before (v1.14.0) | After (v1.15.0) | Impact |
|--------|-------------------|------------------|--------|
| Server startup (non-SF) | ~2s | ~2s | NONE |
| Server startup (SF detected) | N/A | ~2.5s (+500ms grammar load) | Minimal |
| Memory (non-SF) | ~80MB | ~80MB | NONE |
| Memory (SF, 500 files) | N/A | ~85MB (+5MB wasm) | Minimal |
| Tool response time (non-SF) | Baseline | Baseline | NONE (guaranteed) |

---

## 10. Contacts

| Role | Name | Contact |
|------|------|---------|
| Product Owner | Duc Nguyen | dnguyenminh@hotmail.com |
| Developer | Dev Agent | Internal |
| Architect | SA Agent | Internal |
| QA | QA Agent | Internal |

# Release Notes (RLN)

## FEC_CR_Builder v1.15.0 — KSA-191: Salesforce Language Support

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | 1.15.0 |
| Release Date | 2026-06-02 |
| Jira Ticket | KSA-191 |
| Type | Feature (minor version bump) |
| Author | DevOps Agent |
| Status | Released |

---

## 1. What's New

### 1.1 Feature Summary

**Salesforce Language Support** — The `mcp-code-intelligence-nodejs` server now understands Salesforce DX projects. Apex classes, triggers, Flows, Custom Objects, and LWC components are automatically parsed, indexed, and included in dependency/impact analysis.

**Key points:**
- No new MCP servers — all 7 existing tools enhanced
- Zero impact on non-SF projects (lazy grammar loading)
- Shared reusable library: `mcp-salesforce-intelligence/`

### 1.2 User-Facing Changes

| # | Change | Description | Impact |
|---|--------|-------------|--------|
| 1 | Apex class/trigger parsing | `code_symbols` returns Apex classes, methods, properties | High |
| 2 | SF metadata parsing | Flows, Objects, LWC parsed and indexed | High |
| 3 | SF dependency graph | `code_dependencies` shows trigger-on, SOQL, DML, wire, flow relationships | High |
| 4 | SF impact analysis | `code_impact` traverses cross-metadata relationships | High |
| 5 | SFDX stats in index status | `code_index_status` shows SF-specific metrics | Medium |
| 6 | SF call graph | `code_callers`/`code_callees` includes Apex method calls, @wire, flow actions | Medium |
| 7 | SF file ingestion | `mem_ingest_file` enriches .cls/.trigger/.flow-meta.xml with structured metadata | Medium |

### 1.3 Enhanced Tools

| Tool | Enhancement |
|------|-------------|
| `code_index_status` | + `sfdx` section with detected project info, file counts, relationship stats |
| `code_search` | + Apex/Flow/Object/LWC symbols in search results |
| `code_symbols` | + Apex class, method, trigger, annotation symbols |
| `code_dependencies` | + SF relationship types (trigger-on, soql, dml, wire, flow-action, flow-object) |
| `code_impact` | + Cross-metadata impact traversal (SObject -> Triggers -> Classes -> Flows) |
| `code_callers` / `code_callees` | + SF call types (method_call, apex_action, wire_adapter) |
| `mem_ingest_file` | + Structured parsing for .cls, .trigger, .flow-meta.xml |

---

## 2. Technical Changes

### 2.1 New Components

| Component | Type | Description |
|-----------|------|-------------|
| `mcp-salesforce-intelligence/` | Shared library | SfdxDetector, SF relationship types, Apex grammar loader |
| `apex-parser.ts` | Parser (in existing server) | Tree-sitter based Apex parsing |
| `salesforce-meta-parser.ts` | Parser (in existing server) | DOMParser for Flow/Object/LWC XML |
| `tree-sitter-apex.wasm` | Grammar file | Apex Tree-sitter grammar for AST parsing |

### 2.2 Modified Components

| Component | Change |
|-----------|--------|
| `grammar-config.json` | Added apex + salesforce-meta entries |
| `grammar-registry.ts` | Compound extension support (.flow-meta.xml) |
| `indexing-engine.ts` | SFDX detection, SF module mapping |
| `dependency-graph-service.ts` | SF relationship type awareness |
| `impact-analysis-service.ts` | Cross-metadata traversal |
| `call-graph-service.ts` | SF call types |
| `code-index-status.ts` | SFDX stats section |

### 2.3 New Relationship Types in Graph

| Kind | Source | Target | Example |
|------|--------|--------|---------|
| trigger-on | Trigger | SObject | AccountTrigger -> Account |
| soql | Apex method | SObject | getAccounts() -> Account |
| dml | Apex method | SObject | save() -> Account |
| wire | LWC | Apex class | accountList -> AccountController |
| flow-action | Flow | Apex class | Auto_Create -> ContactService |
| flow-object | Flow | SObject | Auto_Create -> Contact |
| apex-import | LWC | Apex method | LWC -> getRecords |

### 2.4 Database Changes

| Type | Object | Description |
|------|--------|-------------|
| No schema change | relationships table | New `kind` values added (additive) |
| No schema change | files table | New `language` values: apex, salesforce-meta |
| No migration needed | N/A | Same SQLite tables, same columns |

---

## 3. Testing Summary

| Test Suite | Framework | Tests | Status |
|-----------|-----------|-------|--------|
| mcp-salesforce-intelligence | Vitest | 44 | PASS |
| mcp-code-intelligence-nodejs (vitest) | Vitest | 39 | PASS |
| java-parser | node:test | 19 | PASS |
| salesforce-meta-parser | node:test | 17 | PASS |
| graph-services | node:test | 29 | PASS |
| **Total** | | **148** | **ALL PASS** |

TypeScript compilation: clean (zero errors).

---

## 4. Known Issues and Limitations

| # | Issue | Impact | Workaround | Target Fix |
|---|-------|--------|------------|------------|
| 1 | Apex grammar may miss edge-case syntax | Partial parse results for complex generics | Returns partial results with errors[] | Upstream grammar update |
| 2 | No real-time file watching for SF files | Manual re-index after SF code changes | Run indexer again | Future enhancement |
| 3 | Large orgs (>5000 SF files) slower first index | ~60s for very large projects | Incremental re-index is fast | v1.16.0 optimization |

---

## 5. Breaking Changes

**None.** This release is fully backward compatible:
- Non-SF projects see zero behavior change
- Existing tool response schemas are additive only (new fields, no removals)
- No new tools to configure
- No environment variables required
- No MCP server config changes needed

---

## 6. Migration Notes

No migration required. After pulling the latest code and rebuilding:
- Existing indexes continue to work
- SF files are indexed on next full/incremental index
- No manual setup needed — SFDX detection is automatic

---

## 7. Dependencies

### 7.1 Runtime (existing — no new additions)

| Package | Version | Status |
|---------|---------|--------|
| web-tree-sitter | ^0.26.9 | Existing |
| better-sqlite3 | ^12.10.0 | Existing |
| @modelcontextprotocol/sdk | ^1.12.0 | Existing |
| salesforce-ast | ^1.0.0 | Existing (optionalDependencies) |

### 7.2 Dev Dependencies (no changes)

| Package | Version |
|---------|---------|
| typescript | ^5.5.0 |
| vitest | ^4.1.7 |
| fast-check | ^4.8.0 |

---

## 8. Rollback Plan

1. Revert to `v1.14.0`: `git checkout v1.14.0`
2. Rebuild: `cd mcp-code-intelligence-nodejs && npm install && npm run build`
3. Reload IDE

Estimated rollback time: < 3 minutes.

---

## 9. Contacts

| Role | Name | Contact |
|------|------|---------|
| Product Owner | Duc Nguyen | dnguyenminh@hotmail.com |
| Developer | Dev Agent | Internal |
| Architect | SA Agent | Internal |
| QA | QA Agent | Internal |

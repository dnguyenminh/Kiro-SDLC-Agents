# User Guide (UG)

## mcp-code-intelligence-nodejs — KSA-191: Salesforce Language Support (v2 — Extend Existing Tools)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-191 |
| Title | Salesforce Language Support — Extend Existing Tools |
| Author | DEV Agent |
| Reviewer | BA Agent |
| Version | 2.0 |
| Date | 2026-06-02 |
| Status | Draft |
| Related BRD | BRD-v2-KSA-191.docx |
| Related FSD | FSD-v2-KSA-191.docx |
| Related TDD | TDD-v2-KSA-191.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-27 | DEV Agent | Initial (v1 — 3 MCP servers) — SUPERSEDED |
| 2.0 | 2026-06-02 | DEV Agent | Complete rewrite for v2 (extend existing tools) |

---

## 1. Introduction

### 1.1 Purpose

This guide covers the Salesforce code intelligence capabilities integrated into
the **existing** `mcp-code-intelligence-nodejs` server (KSA-191 v2).

All Salesforce features are delivered by extending 7 existing MCP tools — no new
servers or tools are created.

After setup, AI agents and developers can:
- Index SFDX projects (Apex classes, triggers, Flows, Objects, LWC)
- Search Salesforce symbols via `code_search`
- Query SF dependencies and impact via existing graph tools
- Ingest SF metadata files into the Knowledge Base

### 1.2 Audience

| Audience | What They Need |
|----------|---------------|
| AI Agent | How to invoke enhanced tools for SF intelligence |
| Salesforce Developer | How to index SFDX projects and query dependencies |
| System Administrator | How to configure and verify SF support is active |

### 1.3 Prerequisites

| Prerequisite | Version | Required |
|-------------|---------|----------|
| Node.js | 20+ | Yes |
| mcp-code-intelligence-nodejs | 0.6.0+ | Yes |
| Kiro IDE | Latest | Yes (for extension command) |
| SFDX Project | Any | Yes (target project to analyze) |
| salesforce-ast (npm) | 1.0.0+ | Optional (provides tree-sitter-apex.wasm) |

### 1.4 What Changed (v1 → v2)

| Aspect | v1 (SUPERSEDED) | v2 (Current) |
|--------|-----------------|--------------|
| Architecture | 3 new MCP servers | Extend existing server |
| New tools | 14 sf_* tools | 0 new — enhance 7 existing |
| Configuration | 3 server entries in mcp.json | No config changes needed |
| User experience | New tool names to learn | Same tools, richer results |

---

## 2. Getting Started

### 2.1 Quick Start

```bash
# Step 1: Build the shared library
cd mcp-salesforce-intelligence
npm install
npm run build

# Step 2: Build the main server (includes Apex grammar copy)
cd ../mcp-code-intelligence-nodejs
npm install
npm run build
# ↑ Automatically copies tree-sitter-apex.wasm from salesforce-ast

# Step 3: Verify Apex grammar is available
ls src/parsers/grammars/tree-sitter-apex.wasm
# Expected: file exists

# Step 4: Start server (Kiro does this automatically)
node dist/index.js --config .code-intel/orchestration.json

# Step 5: Verify SF support active — call code_index_status
# If SFDX project detected, you'll see the ⚡ Salesforce section
```

### 2.2 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 20.0.0 | 22+ |
| Memory | 256 MB | 512 MB (large SFDX projects) |
| Disk | 50 MB (server + grammar) | 100 MB (with index DB) |
| OS | Windows 10, macOS 12, Linux | Any modern OS |

### 2.3 How SF Support Activates

SF support is **automatic** — no explicit activation required:

1. Server starts and loads `grammar-config.json` (includes `apex` + `salesforce-meta` entries)
2. When a workspace contains `sfdx-project.json`, the indexer detects SFDX project
3. Indexer scans `packageDirectories` paths for `.cls`, `.trigger`, `.flow-meta.xml`, `.object-meta.xml`, `.js-meta.xml`
4. Parsers extract symbols + relationships → stored in existing SQLite DB
5. Existing tools now return SF results alongside standard language results

**If no SFDX project is detected:** Zero additional processing. Non-SF projects are unaffected.

### 2.4 Verify Installation

| Check | Command / Action | Expected Result |
|-------|-----------------|-----------------|
| Build OK | `npm run build` in mcp-code-intelligence-nodejs | No errors |
| Grammar exists | Check `src/parsers/grammars/tree-sitter-apex.wasm` | File present |
| Server starts | Start server, check stderr | `[indexer] Tree-sitter indexer initialized (9 languages)` |
| SFDX detected | Call `code_index_status` on SFDX workspace | `⚡ Salesforce (SFDX)` section visible |

---

## 3. Configuration

### 3.1 MCP Server Configuration

The existing `mcp-code-intelligence-nodejs` server entry in `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "code-intelligence-nodejs": {
      "command": "node",
      "args": [
        "mcp-code-intelligence-nodejs/dist/index.js",
        "--config", ".\\.code-intel\\orchestration.json"
      ],
      "cwd": "c:\\projects\\kiro\\FEC_CR_Builder",
      "env": {
        "CODE_INTEL_VIEWER_PORT": "3202",
        "CODE_INTEL_WORKSPACE": ".",
        "CODE_INTEL_DB_PATH": ".code-intel/index.db"
      }
    }
  }
}
```

**No additional server entries needed for SF support.** The existing server handles everything.

### 3.2 Grammar Configuration

Salesforce languages registered in `src/parsers/grammar-config.json`:

```json
{
  "id": "apex",
  "extensions": [".cls", ".trigger"],
  "wasmPath": "grammars/tree-sitter-apex.wasm",
  "parserModule": "./languages/apex-parser.js"
},
{
  "id": "salesforce-meta",
  "extensions": [".flow-meta.xml", ".object-meta.xml", ".field-meta.xml",
                 ".js-meta.xml", ".component-meta.xml"],
  "wasmPath": null,
  "parserModule": "./languages/salesforce-meta-parser.js"
}
```

**Note:** `salesforce-meta` uses `wasmPath: null` — it uses DOMParser for XML, no tree-sitter grammar needed.

### 3.3 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| CODE_INTEL_WORKSPACE | `.` | Workspace root (SFDX detected here) |
| CODE_INTEL_DB_PATH | `.code-intel/index.db` | SQLite database path |
| CODE_INTEL_VIEWER_PORT | `3202` | Web viewer port |

No SF-specific environment variables are needed.

### 3.4 SFDX Project Configuration

The server reads `sfdx-project.json` at workspace root:

```json
{
  "packageDirectories": [
    { "path": "force-app", "default": true }
  ],
  "namespace": "",
  "sourceApiVersion": "59.0"
}
```

All `packageDirectories` paths are scanned for SF metadata during indexing.

---

## 4. Usage

### 4.1 Checking Index Status — `code_index_status`

Shows indexing stats including SFDX section when SF project detected.

**Example call:**

```json
{ "name": "code_index_status", "arguments": {} }
```

**Enhanced response (with SFDX section):**

```
📊 Code Intelligence Index Status

State: ✅ Idle
Files: 1500
Symbols: 12000
Modules: 25
Last indexed: 2026-06-02T10:00:00Z

Languages:
  typescript: 800 files
  apex: 150 files
  salesforce-meta: 145 files

⚡ Salesforce (SFDX):
  Detected: true
  Package directories: force-app
  Apex classes: 150
  Apex triggers: 20
  Flows: 45
  Objects: 80
  LWC components: 30
  Last indexed: 2026-06-02T10:00:00Z
  Relationships:
    trigger-on: 20
    soql: 180
    dml: 95
    wire: 30
    flow-action: 15
    flow-object: 45
```

**Trigger re-index:**

```json
{ "name": "code_index_status", "arguments": { "reindex": true } }
```

### 4.2 Searching SF Symbols — `code_search`

Searches ALL indexed symbols including Apex, Flow, Object, and LWC.

**Find Apex class:**
```json
{ "name": "code_search", "arguments": { "query": "AccountService" } }
```

**Filter by type:**
```json
{ "name": "code_search", "arguments": { "query": "Account", "type": "object" } }
```

Results include: file path, line number, signature, modifiers, annotations.

### 4.3 Querying SF Symbols — `code_symbols`

Returns Apex class/method/trigger/property symbols for a specific file.

**Apex class symbols:**
```json
{ "name": "code_symbols", "arguments": { "file_path": "force-app/main/default/classes/AccountService.cls" } }
```

Response includes class name with modifiers, methods with annotations,
properties, and trigger events/SObject reference for `.trigger` files.

**Query by annotation:**
```json
{ "name": "code_symbols", "arguments": { "query": "@AuraEnabled" } }
```

### 4.4 Querying SF Dependencies — `code_dependencies`

Shows SF-specific dependency relationships in the existing graph.

**What depends on Account object:**
```json
{
  "name": "code_dependencies",
  "arguments": { "symbol": "Account", "direction": "dependents" }
}
```

**SF Relationship Types:**

| Kind | Meaning | Example |
|------|---------|---------|
| `trigger-on` | Trigger fires on SObject | AccountTrigger → Account |
| `soql` | SOQL query on SObject | AccountService.getAccounts → Account |
| `dml` | DML operation on SObject | AccountService.save → Account |
| `wire` | LWC @wire adapter call | accountList → AccountController |
| `flow-action` | Flow invokes Apex class | Auto_Create_Contact → ContactService |
| `flow-object` | Flow references SObject | Auto_Create_Contact → Contact |
| `inherits` | Class extends class | AccountService → BaseService |
| `implements` | Class implements interface | AccountService → IAccountService |

**Forward dependencies of a class:**
```json
{
  "name": "code_dependencies",
  "arguments": { "symbol": "AccountService", "direction": "dependencies", "depth": 2 }
}
```

### 4.5 Impact Analysis — `code_impact`

Transitive impact analysis across SF metadata types.

**Impact of modifying Account object:**
```json
{
  "name": "code_impact",
  "arguments": { "symbol": "Account", "depth": 3 }
}
```

Response includes:
- Direct impact: triggers on Account, classes with SOQL/DML on Account, flows referencing Account
- Indirect impact: classes calling impacted classes, LWC importing impacted Apex
- Grouped by metadata type for clarity
- Severity hints: direct = high, transitive = medium/low

**Impact of modifying an Apex class:**
```json
{
  "name": "code_impact",
  "arguments": { "symbol": "AccountService" }
}
```

Returns: all callers (Apex + Flow + LWC) with transitive impact chain.

### 4.6 Call Graph — `code_callers` / `code_callees`

Query cross-metadata-type call relationships.

**Who calls AccountService.createAccount:**
```json
{ "name": "code_callers", "arguments": { "symbol": "AccountService.createAccount" } }
```

Returns callers with call type: `method_call`, `apex_action` (Flow), `wire_adapter` (LWC).

**What does AccountTrigger call:**
```json
{ "name": "code_callees", "arguments": { "symbol": "AccountTrigger" } }
```

Returns callees: `method_call`, `dml` (SObject writes), `soql` (SObject queries).

### 4.7 Ingesting SF Files — `mem_ingest_file`

Accepts Apex and SF metadata files with structured parsing.

```json
{ "name": "mem_ingest_file", "arguments": { "path": "force-app/main/default/classes/AccountService.cls" } }
```

When SF files are ingested:
1. Parsed by appropriate parser (apex-parser or salesforce-meta-parser)
2. Structured metadata extracted (symbols, relationships, annotations)
3. Formatted as enriched markdown before KB storage
4. Tagged with: `salesforce`, `{metadata-type}`, `{component-name}`

---

## 5. Extension Command

### 5.1 Index Salesforce Project

**Command:** `Kiro SDLC: Index Salesforce Project`

**Steps:**
1. Open SFDX project workspace in Kiro IDE
2. Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Type "Index Salesforce" → select command
4. Wait for progress notification

**Behavior:**
- Auto-detects SFDX project root (`sfdx-project.json`)
- Calls existing indexer with SF options (no new server)
- Shows progress during indexing
- Reports: "{N} Apex classes, {M} triggers, {K} flows, {L} objects indexed"

**Errors:**
- No SFDX project → "No SFDX project found (missing sfdx-project.json)"
- Already running → "Indexing already in progress"
- Server unavailable → "Cannot connect to code intelligence server"

---

## 6. Administration

### 6.1 Rebuilding After Code Changes

```bash
cd mcp-salesforce-intelligence && npm run clean && npm run build
cd ../mcp-code-intelligence-nodejs && npm run clean && npm run build
```

Restart server after rebuild (Kiro does this automatically).

### 6.2 Forcing Full Re-index

```json
{ "name": "code_index_status", "arguments": { "reindex": true } }
```

Or delete index DB: `rm .code-intel/index.db`

### 6.3 Updating Apex Grammar

```bash
cd mcp-code-intelligence-nodejs
npm run copy-apex-wasm
npm run build
```

### 6.4 Monitoring Health

Server stderr shows SF-specific logs:
```
[indexer] Tree-sitter indexer initialized (9 languages) [SFDX project detected]
[grammar-registry] Loaded grammar: apex
[grammar-registry] Loaded grammar: salesforce-meta
[indexer] SF stats: 150 apex, 20 triggers, 45 flows, 80 objects
```

### 6.5 Shared Library

`mcp-salesforce-intelligence/` consumed as file dependency:
```json
"mcp-salesforce-intelligence": "file:../mcp-salesforce-intelligence"
```

---

## 7. Troubleshooting

### 7.1 Common Issues

| # | Symptom | Cause | Solution |
|---|---------|-------|----------|
| 1 | No SF section in code_index_status | No sfdx-project.json | Ensure SFDX project at workspace root |
| 2 | Apex files not indexed | Grammar .wasm missing | Run `npm run copy-apex-wasm` then rebuild |
| 3 | "9 languages" not in init log | Grammar config outdated | Rebuild: `npm run build` |
| 4 | Partial Apex parse results | Syntax errors in .cls | Fix Apex syntax; partial results still returned |
| 5 | Flow/Object not detected | Wrong extension | Must end `.flow-meta.xml` not `.flow.xml` |
| 6 | Slow first indexing (>30s) | Large project | Normal; incremental re-index is fast |
| 7 | Memory errors | Heap too small | `node --max-old-space-size=4096 dist/index.js` |
| 8 | Extension command missing | Extension not rebuilt | Rebuild kiro-sdlc-agents |
| 9 | SF relationships missing | Incomplete index | Run code_index_status with reindex:true |
| 10 | Non-SF projects slow | Bug (should not happen) | File issue — SF activates only with SFDX |

### 7.2 Error Codes

| Code | Message | Description | Action |
|------|---------|-------------|--------|
| SF-001 | File not found: {path} | File does not exist | Verify path relative to workspace |
| SF-002 | Unsupported file type | Extension not in grammar-config | Use .cls, .trigger, or supported meta XML |
| SF-003 | No SFDX project found | Missing sfdx-project.json | Create valid SFDX project structure |
| SF-004 | Parse error in {file} | Malformed source | Fix syntax; partial results returned |
| SF-005 | Parser init failed | Grammar .wasm load error | Check Node.js version, rebuild |
| SF-006 | Grammar not available | .wasm missing | Run `npm run copy-apex-wasm` |
| SF-007 | Index state corrupted | Cache/DB damaged | Delete .code-intel/index.db, re-index |

### 7.3 Logs

| Location | Content | Useful For |
|----------|---------|------------|
| stderr | Server lifecycle, tool calls, warnings | All debugging |
| .code-intel/index.db | SQLite with symbols + relationships | Verify indexed data |

### 7.4 FAQ

**Q: Do I need to change MCP configuration for SF support?**
A: No. Built into existing server. No new entries needed.

**Q: Does incremental indexing work for SF files?**
A: Yes. Same file hash comparison as other languages.

**Q: Can I use without sfdx-project.json?**
A: Auto-detection requires it. Individual file parsing via `mem_ingest_file` works regardless.

**Q: What if Apex grammar .wasm is missing?**
A: Server starts normally but Apex files won't parse. Warning logged. Other languages unaffected.

**Q: Will SF support slow non-SF projects?**
A: No. Detection is single fs.existsSync() call (<1ms). Zero additional processing if no SFDX.

**Q: Memory impact?**
A: Apex grammar adds ~5MB. Indexed data in SQLite (not RAM). 500-file project adds <1MB to DB.

---

## 8. API Reference — Enhanced Tools

| # | Tool | SF Enhancement | Backward Compatible |
|---|------|---------------|---------------------|
| 1 | `code_index_status` | + SFDX stats section | Yes (new field) |
| 2 | `code_search` | + Apex/Flow/Object/LWC symbols | Yes (same schema) |
| 3 | `code_symbols` | + Apex class/method/trigger symbols | Yes (same schema) |
| 4 | `code_dependencies` | + SF relationship types | Yes (new edge types) |
| 5 | `code_impact` | + Cross-metadata impact | Yes (same schema) |
| 6 | `code_callers`/`code_callees` | + SF call relationships | Yes (same schema) |
| 7 | `mem_ingest_file` | + .cls/.trigger/.flow-meta.xml | Yes (same API) |

### 8.2 Supported File Types

| Extension | Language ID | Parser | Description |
|-----------|------------|--------|-------------|
| `.cls` | apex | apex-parser (tree-sitter) | Apex class |
| `.trigger` | apex | apex-parser (tree-sitter) | Apex trigger |
| `.flow-meta.xml` | salesforce-meta | salesforce-meta-parser | Flow |
| `.object-meta.xml` | salesforce-meta | salesforce-meta-parser | Object |
| `.field-meta.xml` | salesforce-meta | salesforce-meta-parser | Field |
| `.js-meta.xml` | salesforce-meta | salesforce-meta-parser | LWC |
| `.component-meta.xml` | salesforce-meta | salesforce-meta-parser | Aura |

### 8.3 Shared Library API (mcp-salesforce-intelligence)

```typescript
import {
  SfdxDetector,           // Detect SFDX project structure
  SF_RELATIONSHIP_KINDS,  // All SF relationship kind constants
  isSfRelationship,       // Type guard
  getSfRelationshipLabel, // Human-readable label
  SfMetadataType,         // Enum: ApexClass, ApexTrigger, Flow, etc.
  detectMetadataType,     // Detect type from file path
  loadApexGrammar,        // Load tree-sitter-apex.wasm
  isApexGrammarAvailable, // Check grammar file exists
  buildSfIndexingOptions, // SFDX-specific indexing config
} from 'mcp-salesforce-intelligence';
```

---

## 9. Appendix

### 9.1 Glossary

| Term | Definition |
|------|------------|
| SFDX | Salesforce DX — developer platform with sfdx-project.json |
| Apex | Salesforce proprietary language (Java-like) |
| LWC | Lightning Web Components — SF frontend framework |
| Flow | Salesforce declarative automation (.flow-meta.xml) |
| SObject | Salesforce Object — database table equivalent |
| MCP | Model Context Protocol — AI tool integration standard |
| DML | Data Manipulation Language (INSERT/UPDATE/DELETE in Apex) |
| SOQL | Salesforce Object Query Language |
| Tree-Sitter | Incremental parsing library for programming languages |

### 9.2 Related Documents

| Document | Location |
|----------|----------|
| BRD | BRD-v2-KSA-191.docx |
| FSD | FSD-v2-KSA-191.docx |
| TDD | TDD-v2-KSA-191.docx |
| STP | STP-v2-KSA-191.docx |

### 9.3 Version Compatibility

| Component | Version | Notes |
|-----------|---------|-------|
| mcp-code-intelligence-nodejs | 0.6.0+ | Includes SF support |
| mcp-salesforce-intelligence | 2.0.0 | Shared library |
| Node.js | 20+ | Required |
| web-tree-sitter | 0.26.9+ | Grammar loading |
| salesforce-ast | 1.0.0+ | Optional (.wasm provider) |
| MCP Protocol | 2024-11-05 | Standard version |

### 9.4 Architecture Summary

```
Kiro IDE
  └── spawns → mcp-code-intelligence-nodejs (stdio, EXISTING)
                  ├── parsers/languages/apex-parser.ts
                  ├── parsers/languages/salesforce-meta-parser.ts
                  ├── parsers/grammars/tree-sitter-apex.wasm
                  ├── indexer/indexing-engine.ts (SFDX detection)
                  ├── graph/* (SF relationship traversal)
                  ├── tools/* (enhanced with SF results)
                  └── uses → mcp-salesforce-intelligence/ (shared lib)

  └── extension → kiro-sdlc-agents
                    └── "Index Salesforce Project" command
```

No new servers. No new tools. Same MCP connection. Richer results.

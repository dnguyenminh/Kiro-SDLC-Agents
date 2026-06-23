# Technical Design Document (TDD)

## mcp-code-intelligence-nodejs — KSA-191: Salesforce Language Support (v2 — Extend Existing Tools)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-191 |
| Title | Salesforce Language Support — Extend Existing Tools |
| Author | SA Agent |
| Version | 2.0 |
| Date | 2026-06-02 |
| Status | Draft |
| Related BRD | BRD-v2-KSA-191.docx |
| Related FSD | FSD-v2-KSA-191.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | SA Agent – Solution Architect | Create document |
| Peer Reviewer | Dev Agent – Developer | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-27 | SA Agent | Initial — 3 MCP servers (SUPERSEDED) |
| 2.0 | 2026-06-02 | SA Agent | v2 rewrite — extend existing tools |

---
## 1. Introduction

> **Scope Boundary:** This TDD specifies HOW to implement the requirements defined in the FSD. It does NOT repeat functional requirements - refer to FSD-v2-KSA-191.docx. This document focuses on: technology choices, architecture decisions, implementation patterns, and integration design.

### 1.1 Purpose

This TDD specifies the technical architecture for integrating Salesforce code intelligence into the **existing** `mcp-code-intelligence-nodejs` server. All SF capabilities are delivered by extending existing parsers, graph services, and tools - NO new MCP servers are created.

### 1.2 Scope

| Component | Type | Description |
|-----------|------|-------------|
| mcp-code-intelligence-nodejs | EXTENDED | Host server - parsers, graph, indexer, tools enhanced |
| mcp-salesforce-intelligence/ | NEW (shared lib) | Reusable SF parsing logic (NOT an MCP server) |
| kiro-sdlc-agents | EXTENDED | Extension - Index Salesforce Project command |

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.5+ |
| Runtime | Node.js | 20+ |
| Protocol | MCP (JSON-RPC 2.0 over stdio) | 2024-11-05 |
| Database | SQLite (better-sqlite3) | Existing |
| Parser | web-tree-sitter + Apex grammar | 0.22+ |
| XML Parsing | DOMParser (built-in) | N/A |
| Test Framework | Vitest | 4.x |
| Build | tsc | 5.5+ |

### 1.4 Design Principles

1. **Extend, dont replace** - all changes are additive to existing modules
2. **Backward compatible** - non-SF projects see zero behavior change
3. **Same tool surface** - no new MCP tools; existing tools return richer results
4. **Graceful degradation** - malformed Apex/XML returns partial results, never crashes
5. **Incremental indexing** - file hash comparison (existing mechanism)
6. **Shared library** - SF parsing logic reusable by future kotlin/python servers

### 1.5 Constraints

- No new MCP servers (EXPLICITLY OUT OF SCOPE)
- Apex grammar .wasm must be compatible with existing web-tree-sitter version
- New relationship types must not break existing graph queries
- Existing tool response schemas are additive-only (new fields, no removals)
- Shared library consumed as workspace npm link (not published to registry)

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v2-KSA-191.docx |
| FSD | FSD-v2-KSA-191.docx |
| salesforce-ast | https://github.com/dnguyenminh/apex-ast |
| MCP Protocol | https://modelcontextprotocol.io |
| Existing apex-parser.ts | mcp-code-intelligence-nodejs/src/parsers/languages/apex-parser.ts |
| Existing salesforce-meta-parser.ts | mcp-code-intelligence-nodejs/src/parsers/languages/salesforce-meta-parser.ts |

---

## 2. System Architecture

### 2.1 Architecture Overview

The v2 approach extends the existing `mcp-code-intelligence-nodejs` server architecture. No new servers are created - all Salesforce capabilities are integrated into the existing pipeline.

![Architecture Diagram](diagrams/architecture.png)

**Key architectural decisions:**

1. **Single server** - all SF capabilities live inside `mcp-code-intelligence-nodejs`
2. **Existing parser pipeline** - `apex-parser.ts` and `salesforce-meta-parser.ts` registered in `grammar-config.json` (already done)
3. **Existing SQLite DB** - new relationship types stored in same `relationships` table
4. **Existing graph services** - `DependencyGraphService`, `CallGraphService`, `ImpactAnalysisService` enhanced to handle SF relationship kinds
5. **Shared library** - `mcp-salesforce-intelligence/` provides reusable utilities (SFDX detection, SF type definitions, grammar loader)
6. **Extension command** - `kiroSdlc.indexSalesforceProject` in `kiro-sdlc-agents` calls existing indexer with SF-specific options

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology | Status |
|-----------|---------------|------------|--------|
| GrammarRegistry | Load/cache tree-sitter grammars | web-tree-sitter | EXISTING (apex entry added) |
| ApexParser | Parse .cls/.trigger files via tree-sitter | TypeScript + WASM | EXISTING (already created) |
| SalesforceMetaParser | Parse .flow-meta.xml, .object-meta.xml, etc. | TypeScript + DOMParser | EXISTING (already created) |
| IndexingEngine | Orchestrate file scanning + parsing | TypeScript + SQLite | MODIFIED (SFDX detection) |
| GraphRepository | Store/query relationships in SQLite | better-sqlite3 | MODIFIED (new relationship kinds) |
| DependencyGraphService | Forward/reverse dependency queries | TypeScript | MODIFIED (SF relationship traversal) |
| ImpactAnalysisService | Transitive impact analysis | TypeScript | MODIFIED (cross-metadata impact) |
| CallGraphService | Caller/callee graph queries | TypeScript | MODIFIED (SF call types) |
| SfdxDetector | Detect SFDX project structure | TypeScript (shared lib) | NEW |
| SfRelationshipTypes | SF relationship type definitions | TypeScript (shared lib) | NEW |
| ApexGrammarLoader | Load Apex .wasm grammar | TypeScript (shared lib) | NEW |
| IndexSalesforceCommand | Extension command for manual indexing | TypeScript (extension) | NEW |

### 2.3 Deployment Architecture

No deployment changes. The existing `mcp-code-intelligence-nodejs` server continues to run as a single process via stdio. The shared library is linked as a workspace dependency.

```
Kiro IDE
  |-- spawns --> mcp-code-intelligence-nodejs (stdio)
  |                |-- uses --> mcp-salesforce-intelligence/ (npm link)
  |                |-- reads --> SFDX project files on disk
  |                |-- stores --> .code-intel/index.db (SQLite)
  |
  |-- extension --> kiro-sdlc-agents
                      |-- command --> "Index Salesforce Project"
                      |-- calls --> mcp-code-intelligence-nodejs tools
```

### 2.4 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| AI Agent / IDE | mcp-code-intelligence-nodejs | stdio JSON-RPC | Sync | All tool calls |
| Extension | mcp-code-intelligence-nodejs | MCP tools/call | Sync | Index Salesforce Project |
| IndexingEngine | ApexParser | Direct function call | Sync | Parse .cls/.trigger files |
| IndexingEngine | SalesforceMetaParser | Direct function call | Sync | Parse metadata XML |
| IndexingEngine | GraphRepository | SQLite queries | Sync | Store relationships |
| Graph Services | GraphRepository | SQLite queries | Sync | Query relationships |

---

## 3. Tool Enhancement Design

> **Note:** No new MCP tools are created. All 7 existing tools are enhanced to include SF results when an SFDX project is detected.

### 3.1 Enhanced Tool Overview

| # | Tool | Enhancement | Backward Compatible |
|---|------|-------------|---------------------|
| 1 | code_index_status | + SFDX stats section | Yes (new field) |
| 2 | code_search | + Apex/Flow/Object/LWC symbols in results | Yes (same schema) |
| 3 | code_symbols | + Apex class/method/trigger symbols | Yes (same schema) |
| 4 | code_dependencies | + SF relationship types in graph | Yes (new edge types) |
| 5 | code_impact | + Cross-metadata impact traversal | Yes (same schema) |
| 6 | code_callers / code_callees | + SF call relationships | Yes (same schema) |
| 7 | mem_ingest_file | + Structured parsing for .cls/.trigger/.flow-meta.xml | Yes (same API) |

### 3.2 code_index_status Enhancement

**Current response (unchanged):**
```json
{
  "status": "ready",
  "files_indexed": 1200,
  "symbols_count": 8500,
  "languages": ["typescript", "python", "kotlin"]
}
```

**Enhanced response (additive):**
```json
{
  "status": "ready",
  "files_indexed": 1500,
  "symbols_count": 12000,
  "languages": ["typescript", "python", "kotlin", "apex", "salesforce-meta"],
  "sfdx": {
    "detected": true,
    "project_root": "force-app",
    "package_directories": ["force-app"],
    "stats": {
      "apex_classes": 150,
      "apex_triggers": 20,
      "flows": 45,
      "objects": 80,
      "lwc_components": 30
    },
    "last_indexed": "2026-06-02T10:00:00Z",
    "relationships": {
      "trigger-on": 20,
      "soql": 180,
      "dml": 95,
      "wire": 30,
      "flow-action": 15,
      "flow-object": 45,
      "inherits": 40,
      "implements": 25
    }
  }
}
```

### 3.3 code_dependencies Enhancement

**New relationship types supported:**

| Relationship Kind | Source | Target | Example |
|-------------------|--------|--------|---------|
| trigger-on | Trigger | SObject | AccountTrigger -> Account |
| soql | Apex method | SObject | AccountService.getAccounts -> Account |
| dml | Apex method | SObject | AccountService.save -> Account |
| wire | LWC component | Apex class | accountList -> AccountController |
| flow-action | Flow | Apex class | Auto_Create_Contact -> ContactService |
| flow-object | Flow | SObject | Auto_Create_Contact -> Contact |
| inherits | Apex class | Apex class | AccountService -> BaseService |
| implements | Apex class | Interface | AccountService -> IAccountService |
| decorates | Annotation | Apex method | @AuraEnabled -> AccountService.getAccounts |

**Implementation:** The existing `DependencyGraphService.getForwardDeps()` and `getReverseDeps()` already traverse the `relationships` table. New SF relationship kinds are stored in the same table with the same schema - no code changes needed in the graph traversal logic itself.

### 3.4 code_impact Enhancement

**Cross-metadata impact traversal:**

When analyzing impact of changing an SObject (e.g., Account):
1. Find all `trigger-on` edges -> triggers on Account
2. Find all `soql` edges -> classes querying Account
3. Find all `dml` edges -> classes writing to Account
4. Find all `flow-object` edges -> flows referencing Account
5. For each impacted class, recursively find callers (existing behavior)

**Implementation:** `ImpactAnalysisService` already does BFS traversal. The only change is ensuring SF relationship kinds are included in the traversal filter (they already are, since the service traverses ALL relationship kinds by default).

### 3.5 code_callers / code_callees Enhancement

**New call types included:**

| Call Type | Direction | Example |
|-----------|-----------|---------|
| method_call | callers/callees | Apex method -> Apex method |
| apex_action | callers | Flow -> Apex class (via InvocableMethod) |
| wire_adapter | callers | LWC -> Apex class (via @wire) |
| dml | callees | Apex method -> SObject (write) |
| soql | callees | Apex method -> SObject (read) |

### 3.6 mem_ingest_file Enhancement

When `mem_ingest_file` receives a `.cls`, `.trigger`, or `.flow-meta.xml` file:
1. Parse using appropriate parser (ApexParser or SalesforceMetaParser)
2. Extract structured metadata (symbols, relationships, annotations)
3. Format as enriched markdown before ingestion
4. Tag with: `salesforce`, `{metadata-type}`, `{component-name}`

---

## 4. Database Design

### 4.1 Schema Overview

No new tables are created. The existing schema is used as-is. SF data is stored in the same tables with new values in existing columns.

**Existing tables used:**

| Table | SF Usage |
|-------|----------|
| files | Store .cls, .trigger, .flow-meta.xml, .object-meta.xml, .js-meta.xml files |
| symbols | Store Apex classes, methods, triggers, Flow names, Object names, LWC names |
| relationships | Store SF relationship edges (trigger-on, soql, dml, wire, flow-action, etc.) |
| modules | Store SF module groupings (apex-classes, apex-triggers, sf-flows, sf-objects, lwc-components) |

### 4.2 Relationship Storage

Existing `relationships` table schema (no changes):

```sql
CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file TEXT NOT NULL,
  source_symbol TEXT NOT NULL,
  target_symbol TEXT NOT NULL,
  kind TEXT NOT NULL,           -- NEW VALUES: 'trigger-on', 'soql', 'dml', 'wire', 'flow-action', 'flow-object'
  line INTEGER,
  metadata TEXT,               -- JSON: { events: [...], fields: [...], operation: "INSERT" }
  resolved_target_file TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**New `kind` values (additive):**

| kind | Stored by | Description |
|------|-----------|-------------|
| trigger-on | ApexParser | Trigger fires on SObject |
| soql | ApexParser | Method queries SObject |
| dml | ApexParser | Method writes to SObject |
| wire | SalesforceMetaParser | LWC imports Apex via @wire |
| flow-action | SalesforceMetaParser | Flow invokes Apex class |
| flow-object | SalesforceMetaParser | Flow references SObject |
| apex-import | SalesforceMetaParser | LWC imports Apex method |

### 4.3 Module Detection (SFDX)

The existing `detectModule()` function in `indexing-engine.ts` already handles SFDX paths:

```typescript
// Already implemented in indexing-engine.ts
if (relativePath.includes('force-app/')) {
  if (relativePath.includes('/classes/')) return 'apex-classes';
  if (relativePath.includes('/triggers/')) return 'apex-triggers';
  if (relativePath.includes('/flows/')) return 'sf-flows';
  if (relativePath.includes('/objects/')) return 'sf-objects';
  if (relativePath.includes('/lwc/')) return 'lwc-components';
  if (relativePath.includes('/aura/')) return 'aura-components';
  return 'salesforce';
}
```

### 4.4 Query Patterns

| Operation | Query | Expected Performance |
|-----------|-------|---------------------|
| Get SF stats | `SELECT kind, COUNT(*) FROM relationships WHERE kind IN ('trigger-on','soql','dml','wire','flow-action','flow-object') GROUP BY kind` | < 10ms |
| Get triggers for object | `SELECT * FROM relationships WHERE target_symbol = ? AND kind = 'trigger-on'` | < 5ms |
| Get all SF relationships for symbol | `SELECT * FROM relationships WHERE (source_symbol = ? OR target_symbol = ?) AND kind IN (...)` | < 20ms |
| Count SF files | `SELECT language, COUNT(*) FROM files WHERE language IN ('apex', 'salesforce-meta') GROUP BY language` | < 5ms |

---

## 5. Class / Module Design

### 5.1 Package Structure — Changes to Existing Server

```
mcp-code-intelligence-nodejs/
+-- src/
|   +-- parsers/
|   |   +-- grammars/
|   |   |   +-- tree-sitter-apex.wasm          <-- EXISTING (grammar file)
|   |   +-- languages/
|   |   |   +-- apex-parser.ts                 <-- EXISTING (already created, KSA-191)
|   |   |   +-- salesforce-meta-parser.ts      <-- EXISTING (already created, KSA-191)
|   |   +-- grammar-config.json               <-- EXISTING (apex + salesforce-meta entries added)
|   |   +-- grammar-registry.ts               <-- EXISTING (compound extension support added)
|   +-- indexer/
|   |   +-- indexing-engine.ts                 <-- MODIFIED (SFDX detection, SF module mapping)
|   +-- graph/
|   |   +-- dependency-graph-service.ts        <-- MODIFIED (SF relationship type awareness)
|   |   +-- impact-analysis-service.ts         <-- MODIFIED (cross-metadata traversal)
|   |   +-- call-graph-service.ts              <-- MODIFIED (SF call types)
|   +-- tools/
|   |   +-- code-index-status.ts              <-- MODIFIED (SFDX stats section)
|   |   +-- code-search.ts                    <-- NO CHANGE (already searches all symbols)
|   |   +-- code-symbols.ts                   <-- NO CHANGE (already returns all symbols)
|   |   +-- dependency-tools.ts               <-- NO CHANGE (uses graph service)
|   |   +-- impact-tools.ts                   <-- NO CHANGE (uses impact service)
|   |   +-- call-graph-tools.ts               <-- NO CHANGE (uses call graph service)
```

### 5.2 Package Structure — Shared Library

```
mcp-salesforce-intelligence/                   <-- SHARED LIBRARY (NOT a server)
+-- package.json
+-- tsconfig.json
+-- vitest.config.ts
+-- src/
|   +-- index.ts                              <-- Public API exports
|   +-- sfdx-detector.ts                      <-- Detect SFDX project structure
|   +-- apex-grammar-loader.ts                <-- Load Apex .wasm grammar utility
|   +-- sf-relationship-types.ts              <-- SF relationship type definitions + constants
|   +-- sf-metadata-types.ts                  <-- SF metadata type enum + helpers
|   +-- sf-indexing-options.ts                <-- SFDX-specific indexing configuration
+-- tests/
|   +-- sfdx-detector.test.ts
|   +-- sf-relationship-types.test.ts
+-- README.md
```

### 5.3 Package Structure — Extension Command

```
kiro-sdlc-agents/
+-- src/
|   +-- commands/
|   |   +-- index-salesforce.ts               <-- NEW command handler
|   +-- extension.ts                          <-- MODIFIED (register new command)
+-- package.json                              <-- EXISTING (command already registered)
```

### 5.4 Key Interfaces

```typescript
// mcp-salesforce-intelligence/src/sfdx-detector.ts
export interface SfdxProject {
  root: string;
  configPath: string;
  packageDirectories: string[];
  namespace?: string;
  sourceApiVersion?: string;
}

export class SfdxDetector {
  static detect(workspacePath: string): SfdxProject | null;
  static isValidSfdxProject(projectPath: string): boolean;
  static getPackageDirectories(configPath: string): string[];
}

// mcp-salesforce-intelligence/src/sf-relationship-types.ts
export const SF_RELATIONSHIP_KINDS = [
  'trigger-on', 'soql', 'dml', 'wire',
  'flow-action', 'flow-object', 'apex-import'
] as const;

export type SfRelationshipKind = typeof SF_RELATIONSHIP_KINDS[number];

export function isSfRelationship(kind: string): kind is SfRelationshipKind;

// mcp-salesforce-intelligence/src/sf-metadata-types.ts
export enum SfMetadataType {
  ApexClass = 'ApexClass',
  ApexTrigger = 'ApexTrigger',
  Flow = 'Flow',
  CustomObject = 'CustomObject',
  CustomField = 'CustomField',
  LwcComponent = 'LwcComponent',
  AuraComponent = 'AuraComponent',
}

export function detectMetadataType(filePath: string): SfMetadataType | null;
```

### 5.5 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Strategy | Language parsers (ApexParser, SalesforceMetaParser) | Different parsing logic per file type, same ILanguageParser interface |
| Registry | GrammarRegistry | Lazy-load parsers by file extension |
| Decorator | Tool enhancement | Existing tools decorated with SF-aware logic |
| Facade | mcp-salesforce-intelligence/index.ts | Single entry point for shared SF utilities |
| Observer | IndexingEngine file watcher | React to file changes for incremental indexing |

### 5.6 Error Handling

| Error Scenario | Component | Handling |
|----------------|-----------|----------|
| Apex .wasm grammar not found | GrammarRegistry | Mark language unavailable, log warning, continue without Apex |
| Malformed Apex syntax | ApexParser | Return partial ParseResult with errors[], never throw |
| Malformed metadata XML | SalesforceMetaParser | Return partial ParseResult with errors[], never throw |
| No sfdx-project.json | IndexingEngine | Skip SFDX detection, index normally |
| Invalid packageDirectories | SfdxDetector | Return empty array, log warning |
| SQLite write failure | GraphRepository | Log error, skip relationship, continue |

---

## 6. Integration Design

### 6.1 Internal: Shared Library Integration

| Attribute | Value |
|-----------|-------|
| Package | mcp-salesforce-intelligence |
| Integration | npm workspace link |
| Import | `import { SfdxDetector, SF_RELATIONSHIP_KINDS } from 'mcp-salesforce-intelligence'` |
| Coupling | Loose - only type definitions and utility functions |

**Dependency direction:**
```
mcp-code-intelligence-nodejs --> mcp-salesforce-intelligence (imports utilities)
kiro-sdlc-agents --> mcp-salesforce-intelligence (imports types for command)
```

### 6.2 Internal: Parser Registration Flow

```
1. IndexingEngine.initTreeSitter()
2.   -> loadGrammarConfig("grammar-config.json")
3.   -> GrammarRegistry constructed with 9 language entries (including apex, salesforce-meta)
4.   -> On first .cls file encountered:
5.      -> GrammarRegistry.loadParser("apex")
6.      -> Load tree-sitter-apex.wasm
7.      -> Instantiate ApexParser(parser, "apex")
8.      -> Cache in languageParsers map
9.   -> On first .flow-meta.xml file encountered:
10.     -> GrammarRegistry.loadParser("salesforce-meta")
11.     -> wasmPath is null (no tree-sitter grammar needed)
12.     -> Instantiate SalesforceMetaParser(null, "salesforce-meta")
13.     -> Cache in languageParsers map
```

### 6.3 Internal: SFDX Detection in Indexer

```typescript
// In IndexingEngine.initTreeSitter() - already implemented
private detectSfdxProject(): boolean {
  const workspace = this.config.workspace;
  return fs.existsSync(path.join(workspace, 'sfdx-project.json'))
    || fs.existsSync(path.join(workspace, 'force-app'));
}
```

**Enhancement needed:** When SFDX detected, ensure `scanWorkspace()` includes SF metadata paths from `sfdx-project.json` packageDirectories.

### 6.4 Internal: Extension Command Flow

```
1. User runs "Kiro SDLC: Index Salesforce Project" from command palette
2. Extension checks for sfdx-project.json in workspace
3. If not found -> show error notification
4. If found -> show progress notification
5. Extension calls MCP tool: code_index_status (triggers full re-index if needed)
6. Extension shows result notification with SF stats
```

### 6.5 External: salesforce-ast npm Package

| Attribute | Value |
|-----------|-------|
| Package | salesforce-ast (apex-ast) |
| Source | https://github.com/dnguyenminh/apex-ast |
| Usage | Provides tree-sitter-apex.wasm grammar file |
| Integration | .wasm file copied to grammars/ directory at build time |
| Fallback | If .wasm unavailable, ApexParser uses regex-based extraction |

---

## 7. Security Design

### 7.1 No Authentication Changes

The existing MCP server runs locally via stdio - no network exposure, no auth needed. This change does not alter the security posture.

### 7.2 Input Validation

| Input | Validation | Component |
|-------|-----------|-----------|
| File paths (.cls, .trigger) | Must exist, must be within workspace | GrammarRegistry.getParser() |
| File paths (metadata XML) | Must exist, must match compound extension | GrammarRegistry.getLanguageId() |
| sfdx-project.json | Must be valid JSON with packageDirectories | SfdxDetector |
| Apex source code | Parsed by tree-sitter (safe - no eval) | ApexParser |
| XML metadata | Parsed by DOMParser (safe - no external entities) | SalesforceMetaParser |

### 7.3 Path Traversal Prevention

Existing protection in `IndexingEngine` and `file-scanner.ts`:
- All file paths resolved relative to workspace root
- Symlinks not followed by default
- `.gitignore` patterns respected

### 7.4 XML External Entity (XXE) Prevention

`SalesforceMetaParser` uses Node.js built-in DOMParser which does NOT resolve external entities by default. No additional protection needed.

---

## 8. Performance and Scalability

### 8.1 Performance Targets

| Operation | Target | Current (non-SF) | Notes |
|-----------|--------|-------------------|-------|
| Single Apex file parse | < 500ms | N/A (new) | Tree-sitter is fast |
| Single metadata XML parse | < 100ms | N/A (new) | DOMParser is fast |
| Full SFDX index (500 files) | < 30s | N/A (new) | Parallel with existing indexing |
| Dependency query (SF) | < 200ms | < 100ms (existing) | Same SQLite queries |
| Impact analysis (SF) | < 500ms | < 300ms (existing) | BFS with more edge types |
| code_index_status | < 50ms | < 20ms (existing) | + 1 extra SQL query for SF stats |
| Non-SF tool response time | UNCHANGED | Baseline | Zero regression |

### 8.2 Memory Budget

| Scenario | Additional Memory | Notes |
|----------|-------------------|-------|
| Apex grammar loaded | +5MB | .wasm file in memory |
| 500 Apex files indexed | +0MB | Stored in SQLite, not RAM |
| 2000 SF relationships | +0MB | Stored in SQLite, not RAM |
| SalesforceMetaParser active | +2MB | DOMParser instances (GC'd after parse) |

### 8.3 Scalability

| Metric | Supported | Degradation Strategy |
|--------|-----------|---------------------|
| Apex files | 5000 | Batch indexing (existing 50-file batches) |
| Metadata XML files | 10000 | Same batch mechanism |
| SF relationships | 50000+ | SQLite handles millions of rows |
| Total symbols | 100000+ | Existing SQLite indexes |

### 8.4 Non-SF Performance Guarantee

**Critical requirement:** Adding SF support MUST NOT degrade performance for non-SF projects.

**How this is achieved:**
1. Grammar loading is lazy - Apex grammar only loaded when .cls/.trigger file encountered
2. SFDX detection is a single `fs.existsSync()` call during init (< 1ms)
3. SF relationship kinds are stored in same table - no extra JOINs
4. Tool queries use existing indexes - no schema changes
5. If no SFDX project detected, zero additional processing occurs

---

## 9. Monitoring and Observability

### 9.1 Logging

All logging goes to stderr (existing pattern):

| Event | Level | Format |
|-------|-------|--------|
| SFDX project detected | INFO | `[indexer] Tree-sitter indexer initialized (N languages) [SFDX project detected]` |
| Apex grammar loaded | INFO | `[grammar-registry] Loaded grammar: apex` |
| SF meta grammar loaded | INFO | `[grammar-registry] Loaded grammar: salesforce-meta` |
| Apex parse error | WARN | `[apex-parser] Parse error in {file}: {msg}` |
| XML parse error | WARN | `[sf-meta-parser] Parse error in {file}: {msg}` |
| SF indexing stats | INFO | `[indexer] SF stats: {N} apex, {M} triggers, {K} flows, {L} objects` |
| Grammar .wasm not found | WARN | `[grammar-registry] WASM not found: {path}` |

### 9.2 Metrics (via code_index_status)

The `code_index_status` tool serves as the observability endpoint:
- Total files indexed (including SF)
- Languages available (including apex, salesforce-meta)
- SFDX-specific stats (classes, triggers, flows, objects, LWC)
- Relationship counts by type
- Last indexed timestamp

---

## 10. Deployment Considerations

### 10.1 No Deployment Changes

The existing deployment model is unchanged:
- `mcp-code-intelligence-nodejs` continues to be spawned via stdio
- No new server processes
- No new ports
- No new environment variables

### 10.2 Build Changes

| Change | Location | Description |
|--------|----------|-------------|
| Add workspace dependency | mcp-code-intelligence-nodejs/package.json | `"mcp-salesforce-intelligence": "file:../mcp-salesforce-intelligence"` |
| Copy .wasm grammar | Build script | Copy tree-sitter-apex.wasm to dist/parsers/grammars/ |
| Build shared library | CI pipeline | `cd mcp-salesforce-intelligence && npm run build` before main build |

### 10.3 Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| N/A | N/A | No feature flags needed - SF support auto-activates when SFDX project detected |

### 10.4 Rollback Strategy

1. Remove `apex` and `salesforce-meta` entries from `grammar-config.json`
2. Remove `tree-sitter-apex.wasm` from grammars directory
3. Rebuild and restart server
4. Existing SF data in SQLite becomes orphaned (harmless) or can be cleaned:
   ```sql
   DELETE FROM relationships WHERE kind IN ('trigger-on','soql','dml','wire','flow-action','flow-object','apex-import');
   DELETE FROM files WHERE language IN ('apex', 'salesforce-meta');
   ```

---

## 11. Implementation Checklist

### Phase A: Shared Library (mcp-salesforce-intelligence/)

- [ ] `src/index.ts` - Public API exports
- [ ] `src/sfdx-detector.ts` - SFDX project detection utility
- [ ] `src/apex-grammar-loader.ts` - Apex .wasm grammar loader helper
- [ ] `src/sf-relationship-types.ts` - SF relationship kind constants + type guards
- [ ] `src/sf-metadata-types.ts` - SF metadata type enum + file detection
- [ ] `src/sf-indexing-options.ts` - SFDX-specific indexing configuration
- [ ] `tests/sfdx-detector.test.ts` - Unit tests
- [ ] `tests/sf-relationship-types.test.ts` - Unit tests
- [ ] `package.json` - Package configuration
- [ ] `README.md` - Library documentation

### Phase B: Parser Enhancements (already mostly done)

- [x] `src/parsers/languages/apex-parser.ts` - Apex tree-sitter parser (DONE)
- [x] `src/parsers/languages/salesforce-meta-parser.ts` - Metadata XML parser (DONE)
- [x] `src/parsers/grammar-config.json` - Apex + salesforce-meta entries (DONE)
- [x] `src/parsers/grammar-registry.ts` - Compound extension support (DONE)
- [x] `src/parsers/grammars/tree-sitter-apex.wasm` - Grammar file (DONE)
- [ ] Unit tests for ApexParser edge cases
- [ ] Unit tests for SalesforceMetaParser edge cases

### Phase C: Indexer Enhancement

- [x] `src/indexer/indexing-engine.ts` - SFDX detection + module mapping (DONE)
- [ ] Enhance `scanWorkspace()` to read packageDirectories from sfdx-project.json
- [ ] Add SFDX stats reporting after indexing completes
- [ ] Integration test: index sample SFDX project

### Phase D: Graph Service Enhancement

- [ ] `src/graph/dependency-graph-service.ts` - Ensure SF kinds included in traversal
- [ ] `src/graph/impact-analysis-service.ts` - Cross-metadata impact grouping
- [ ] `src/graph/call-graph-service.ts` - SF call type labels
- [ ] Unit tests for SF relationship traversal

### Phase E: Tool Enhancement

- [ ] `src/tools/code-index-status.ts` - Add SFDX stats section to response
- [ ] Verify code_search works with SF symbols (should work already)
- [ ] Verify code_symbols works with SF symbols (should work already)
- [ ] Verify dependency-tools works with SF relationships (should work already)
- [ ] Integration test: full tool flow with SFDX project

### Phase F: Extension Command

- [ ] `kiro-sdlc-agents/src/commands/index-salesforce.ts` - Command handler
- [ ] Register command in extension.ts activate()
- [ ] Progress notification during indexing
- [ ] Result notification with SF stats
- [ ] Error handling (no SFDX project, already indexing)

### Phase G: Testing

- [ ] Unit tests for shared library
- [ ] Unit tests for parser edge cases
- [ ] Integration tests with fixture SFDX project
- [ ] E2E test: index + query via MCP tools
- [ ] Regression test: non-SF project unchanged behavior

---

## 12. Appendix

### Glossary

| Term | Definition |
|------|------------|
| SFDX | Salesforce DX - standardized project structure and CLI |
| Apex | Salesforce proprietary language (Java-like) |
| LWC | Lightning Web Components - Salesforce frontend framework |
| Flow | Salesforce declarative automation (.flow-meta.xml) |
| MCP | Model Context Protocol - AI tool integration standard |
| SObject | Salesforce Object - database table equivalent |
| DML | Data Manipulation Language (INSERT, UPDATE, DELETE) |
| SOQL | Salesforce Object Query Language |
| Tree-Sitter | Incremental parsing library for programming languages |

### Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Should SF indexing run in parallel with standard indexing or sequentially? | Resolved | Parallel - same batch mechanism, SF files mixed with others |
| 2 | Should we add a separate SFDX file watcher? | Resolved | No - existing file watcher already covers all workspace files |
| 3 | How to handle Apex grammar version mismatch with web-tree-sitter? | Resolved | Pin compatible versions; if load fails, mark unavailable |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

---

## DISCREPANCY CHECK

After reviewing BRD v2 and FSD v2 against this TDD v2 design:

**No discrepancies found.** The TDD v2 design fully aligns with:
- BRD v2 approach: extend existing tools, no new MCP servers
- FSD v2 specifications: all 9 user stories addressable through the design
- Existing codebase: parsers already created, grammar already registered, SFDX detection already in indexer

**Alignment summary:**
- BRD Story 1 (SFDX detection) -> Section 6.3 (already implemented in indexer)
- BRD Story 2 (Apex symbols) -> Section 5.1 (ApexParser already extracts symbols)
- BRD Story 3 (code_search) -> Section 3.1 (no change needed - searches all symbols)
- BRD Story 4 (dependencies) -> Section 3.3 (new relationship kinds in same table)
- BRD Story 5 (impact) -> Section 3.4 (existing BFS traversal handles new kinds)
- BRD Story 6 (callers/callees) -> Section 3.5 (existing call graph includes SF)
- BRD Story 7 (mem_ingest_file) -> Section 3.6 (structured parsing before ingestion)
- BRD Story 8 (extension command) -> Section 6.4 (command already registered)
- BRD Story 9 (index status) -> Section 3.2 (additive SFDX stats field)

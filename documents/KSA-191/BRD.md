# Business Requirements Document (BRD)

## FEC_CR_Builder — KSA-191: Tích hợp Salesforce Intelligence vào Existing MCP Code Intelligence (v2 — Extend Existing Tools)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-191 |
| Title | Tích hợp Salesforce Intelligence vào Existing MCP Code Intelligence — Extend Existing Tools |
| Author | BA Agent |
| Version | 2.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Approach | **v2 — Extend existing tools, NO new MCP servers** |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-27 | BA Agent | Initial draft (v1 approach — 3 new MCP servers) — **SUPERSEDED** |
| 2.0 | 2026-06-01 | BA Agent | Complete rewrite for v2 approach — extend existing tools, no new servers |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request adds **Salesforce code intelligence** to the **existing** `mcp-code-intelligence-nodejs` server by extending its parsers, graph, and indexer modules. The approach is:

1. **Add Apex tree-sitter grammar** (`.wasm`) to the existing grammar registry
2. **Add `apex-parser.ts`** to `src/parsers/languages/` (already created)
3. **Add `salesforce-meta-parser.ts`** for Flow/Object/LWC XML parsing (already created)
4. **Detect SFDX projects** in the indexer (`sfdx-project.json` detection)
5. **Add SF relationship types** to the existing graph module (trigger-on, flow-action, lwc-wire, soql, dml)
6. **Enhance existing tools** — `code_index_status`, `code_search`, `code_symbols`, `code_dependencies`, `code_impact`, `code_callers`/`code_callees`, `mem_ingest_file`
7. **Add shared library** `mcp-salesforce-intelligence/` for reusable SF parsing logic
8. **Extension command** — "Kiro SDLC: Index Salesforce Project" in `kiro-sdlc-agents`

**Key Principle:** NO new MCP servers. All Salesforce capabilities are delivered through the existing tool surface.

### 1.2 Out of Scope

- Creating new MCP servers (sf-parser, sf-graph, sf-kb-indexer) — **EXPLICITLY OUT OF SCOPE**
- Modifying the `salesforce-ast` library itself (used as npm dependency)
- Salesforce deployment/CI/CD automation
- Salesforce org authentication or metadata retrieval from live orgs
- Real-time file watching for SFDX projects (future enhancement)
- Salesforce-specific test execution
- Changes to `mcp-code-intelligence-kotlin` or `mcp-code-intelligence-python` (future — they can consume the shared library later)

### 1.3 Preliminary Requirement

- `salesforce-ast` npm package accessible (https://github.com/dnguyenminh/apex-ast)
- Node.js 20+ runtime
- Existing `mcp-code-intelligence-nodejs` server operational
- Kiro extension (`kiro-sdlc-agents`) v1.13+ with existing "Index Workspace" command pattern
- Tree-sitter Apex grammar `.wasm` file available (from `salesforce-ast` or compiled separately)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Salesforce Intelligence integration extends the existing code intelligence pipeline:

1. **Grammar Registration** — Apex `.wasm` grammar added to `grammar-registry.ts`
2. **Parser Registration** — `apex-parser.ts` + `salesforce-meta-parser.ts` registered in parser index
3. **SFDX Detection** — Indexer detects `sfdx-project.json` and includes SF metadata paths
4. **Indexing** — Existing `code_index_status` tool triggers indexing that now includes `.cls`, `.trigger`, `.flow-meta.xml`, `.object-meta.xml`, `.js-meta.xml`
5. **Graph Enhancement** — SF-specific relationships (trigger-on, flow-action, lwc-wire, soql, dml) stored in existing graph DB
6. **Tool Enhancement** — Existing tools (`code_search`, `code_symbols`, `code_dependencies`, `code_impact`, `code_callers`/`code_callees`) now return SF results alongside standard results
7. **Extension Command** — "Index Salesforce Project" command in `kiro-sdlc-agents` calls existing indexer with SF-specific options

**Business Flow:**

**Step 1:** Developer opens a workspace containing an SFDX project in Kiro IDE

**Step 2:** Developer runs "Kiro SDLC: Index Salesforce Project" (or existing "Index Workspace" auto-detects SFDX)

**Step 3:** Extension calls existing `code_index_status` tool (which now supports SFDX indexing)

**Step 4:** Indexer uses `apex-parser.ts` and `salesforce-meta-parser.ts` to parse SF files

**Step 5:** Parsed symbols and relationships are stored in existing SQLite DB (same schema, new relationship types)

**Step 6:** AI agents query using existing tools — `code_search`, `code_symbols`, `code_dependencies`, `code_impact` — which now include SF results

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want the existing indexer to automatically detect and index SFDX projects | MUST HAVE | KSA-191 |
| 2 | As a developer, I want `code_symbols` to return Apex class/method/trigger symbols | MUST HAVE | KSA-191 |
| 3 | As a developer, I want `code_search` to find Apex/Flow/Object symbols by name or pattern | MUST HAVE | KSA-191 |
| 4 | As a developer, I want `code_dependencies` to show SF-specific dependencies (trigger-on, flow-action) | MUST HAVE | KSA-191 |
| 5 | As a developer, I want `code_impact` to analyze impact across SF metadata types | MUST HAVE | KSA-191 |
| 6 | As a developer, I want `code_callers`/`code_callees` to include SF call relationships | MUST HAVE | KSA-191 |
| 7 | As a developer, I want `mem_ingest_file` to support `.cls`, `.trigger`, `.flow-meta.xml` files | SHOULD HAVE | KSA-191 |
| 8 | As a developer, I want a dedicated "Index Salesforce Project" command in Kiro IDE | MUST HAVE | KSA-191 |
| 9 | As a developer, I want `code_index_status` to show SFDX indexing progress and stats | SHOULD HAVE | KSA-191 |

---

### 2.3 Details of User Stories

---

#### Business Flow

The integration follows the existing `mcp-code-intelligence-nodejs` architecture:
- Parsers extract symbols + relationships from source files
- Indexer orchestrates parsing and stores results in SQLite
- Graph module builds dependency/call graphs from stored relationships
- Tools expose query capabilities via MCP protocol
- Extension provides UI commands that invoke tools

**No new servers, no new protocols, no new databases.** Everything extends what already exists.

---

#### STORY 1: SFDX Project Auto-Detection in Indexer

> As a developer, I want the existing indexer to automatically detect and index SFDX projects

**Requirement Details:**

1. The indexer SHALL detect SFDX project structure by presence of `sfdx-project.json`
2. When SFDX detected, the indexer SHALL include SF metadata paths (`force-app/`, custom paths from `sfdx-project.json`)
3. The indexer SHALL register `.cls`, `.trigger` files with `apex-parser.ts`
4. The indexer SHALL register `.flow-meta.xml`, `.object-meta.xml`, `.field-meta.xml`, `.js-meta.xml` with `salesforce-meta-parser.ts`
5. The indexer SHALL support incremental re-indexing (file hash comparison, same as existing behavior)
6. The indexer SHALL report SF-specific stats in indexing results (apex classes, triggers, flows, objects, LWC)

**Acceptance Criteria:**

1. Given a workspace with `sfdx-project.json`, when indexing runs, then all `.cls`, `.trigger`, and metadata XML files are parsed and stored
2. Given `sfdx-project.json` with custom `packageDirectories`, when indexing runs, then all configured paths are scanned
3. Given a previously indexed SFDX project with modified files, when re-indexing runs, then only changed files are re-parsed
4. Given a workspace WITHOUT `sfdx-project.json`, when indexing runs, then behavior is unchanged (no SF-specific processing)

---

#### STORY 2: Apex Symbols in `code_symbols`

> As a developer, I want `code_symbols` to return Apex class/method/trigger symbols

**Requirement Details:**

1. `code_symbols` SHALL return Apex classes, interfaces, enums, triggers as top-level symbols
2. `code_symbols` SHALL return methods, constructors, properties as nested symbols under their parent class
3. `code_symbols` SHALL include Apex-specific modifiers: `global`, `virtual`, `with sharing`, `without sharing`, `webservice`
4. `code_symbols` SHALL include annotations: `@IsTest`, `@AuraEnabled`, `@InvocableMethod`, `@Future`, etc.
5. Symbol signatures SHALL follow Apex conventions (not Java)

**Acceptance Criteria:**

1. Given an indexed Apex class, when `code_symbols(file_path="AccountService.cls")` is called, then class + all methods/properties are returned with correct signatures
2. Given an indexed trigger, when `code_symbols(file_path="AccountTrigger.trigger")` is called, then trigger symbol with events and SObject reference is returned
3. Given `code_symbols(query="@AuraEnabled")`, when called, then all methods with `@AuraEnabled` annotation are returned

---

#### STORY 3: SF Symbols in `code_search`

> As a developer, I want `code_search` to find Apex/Flow/Object symbols by name or pattern

**Requirement Details:**

1. `code_search` SHALL include Apex symbols in search results (classes, methods, triggers)
2. `code_search` SHALL include Flow names, Object names, LWC component names
3. `code_search` SHALL support filtering by SF metadata type (e.g., `type:apex`, `type:flow`, `type:object`)
4. Search results SHALL include the same metadata as other languages (file path, line, signature)

**Acceptance Criteria:**

1. Given an indexed SFDX project, when `code_search(query="AccountService")` is called, then the Apex class and all references are returned
2. Given `code_search(query="Account", type="object")`, when called, then Custom Object metadata is returned
3. Given `code_search(query="handleSave")`, when called, then both Apex methods and LWC handlers matching the name are returned

---

#### STORY 4: SF Dependencies in `code_dependencies`

> As a developer, I want `code_dependencies` to show SF-specific dependencies

**Requirement Details:**

1. `code_dependencies` SHALL show trigger-on relationships (which triggers fire on which objects)
2. `code_dependencies` SHALL show flow-action relationships (which flows invoke which Apex classes)
3. `code_dependencies` SHALL show flow-object relationships (which flows operate on which objects)
4. `code_dependencies` SHALL show lwc-wire relationships (which LWC components import which Apex methods)
5. `code_dependencies` SHALL show class-class relationships (Apex inheritance, method calls)
6. `code_dependencies` SHALL show SOQL relationships (which classes query which objects)
7. `code_dependencies` SHALL show DML relationships (which classes perform DML on which objects)

**Data Fields (enhanced):**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| symbol | string | Yes | Symbol to query dependencies for | `AccountService` |
| direction | string | No | `dependents` or `dependencies` (default: both) | `dependents` |
| depth | number | No | Max traversal depth (default: 3) | `5` |
| include_types | string[] | No | Filter by relationship types | `["trigger-on", "calls", "soql"]` |

**Acceptance Criteria:**

1. Given an indexed Object `Account`, when `code_dependencies(symbol="Account", direction="dependents")` is called, then all triggers, flows, and classes that reference Account are returned
2. Given an Apex class, when `code_dependencies(symbol="AccountService")` is called, then both forward deps (what it calls) and reverse deps (what calls it) are returned
3. Given a Flow, when `code_dependencies(symbol="Auto_Create_Contact")` is called, then referenced objects and Apex actions are returned

---

#### STORY 5: SF Impact Analysis in `code_impact`

> As a developer, I want `code_impact` to analyze impact across SF metadata types

**Requirement Details:**

1. `code_impact` SHALL traverse SF relationship types in impact analysis
2. Impact of changing an Object SHALL include: triggers, flows, Apex classes with SOQL/DML, LWC components
3. Impact of changing an Apex class SHALL include: calling classes, flows that invoke it, LWC that import it
4. Impact of changing a Flow SHALL include: subflows, referenced Apex classes
5. Impact results SHALL be grouped by metadata type for clarity

**Acceptance Criteria:**

1. Given Object `Account` modified, when `code_impact(symbol="Account")` is called, then all triggers on Account, flows referencing Account, classes with SOQL on Account are returned
2. Given Apex class `AccountService` modified, when `code_impact(symbol="AccountService")` is called, then all callers (Apex + Flow + LWC) are returned with transitive impact
3. Impact results SHALL include severity hints (direct dependency = high, transitive = medium/low)

---

#### STORY 6: SF Call Graph in `code_callers`/`code_callees`

> As a developer, I want `code_callers`/`code_callees` to include SF call relationships

**Requirement Details:**

1. `code_callers` SHALL include: Apex method calls, Flow action invocations, LWC Apex imports, trigger handler calls
2. `code_callees` SHALL include: methods called by Apex, SOQL queries (as "calls" to SObject), DML operations
3. Call graph SHALL support cross-metadata-type traversal (Apex to Flow to Apex)

**Acceptance Criteria:**

1. Given `code_callers(symbol="AccountService.createAccount")`, when called, then all Apex methods, flows, and LWC components that call this method are returned
2. Given `code_callees(symbol="AccountTrigger")`, when called, then all methods/classes invoked by the trigger handler are returned
3. Call graph SHALL distinguish call types: `method_call`, `apex_action`, `wire_adapter`, `dml`, `soql`

---

#### STORY 7: SF File Support in `mem_ingest_file`

> As a developer, I want `mem_ingest_file` to support `.cls`, `.trigger`, `.flow-meta.xml` files

**Requirement Details:**

1. `mem_ingest_file` SHALL accept Apex files (`.cls`, `.trigger`) and extract structured metadata before ingestion
2. `mem_ingest_file` SHALL accept SF metadata XML files and extract structured metadata
3. Ingested content SHALL include: symbol names, relationships, annotations, modifiers
4. KB entries SHALL be tagged with: `salesforce`, `{metadata-type}`, `{component-name}`

**Acceptance Criteria:**

1. Given `mem_ingest_file(path="force-app/.../AccountService.cls")`, when called, then the file is parsed by `apex-parser.ts` and structured metadata is stored in KB
2. Given `mem_ingest_file(path="force-app/.../MyFlow.flow-meta.xml")`, when called, then flow structure is parsed and stored
3. KB search for "AccountService" SHALL return the ingested Apex class metadata

---

#### STORY 8: Extension Command "Index Salesforce Project"

> As a developer, I want a dedicated "Index Salesforce Project" command in Kiro IDE

**Requirement Details:**

1. The extension SHALL register command "Kiro SDLC: Index Salesforce Project" in command palette
2. The command SHALL auto-detect SFDX project root (look for `sfdx-project.json` in workspace)
3. The command SHALL call the existing indexer with SFDX-specific options (not a new server)
4. The command SHALL show progress notification during indexing
5. The command SHALL report results: files parsed, symbols found, relationships built, errors
6. The command SHALL follow the existing "Index Workspace" command pattern in `kiro-sdlc-agents`

**Acceptance Criteria:**

1. Given Kiro IDE with an SFDX project, when user runs "Kiro SDLC: Index Salesforce Project", then the existing indexer is invoked with SF paths and results are shown
2. Given no SFDX project in workspace, when command is run, then error notification "No SFDX project found (missing sfdx-project.json)"
3. Given indexing in progress, when command is triggered again, then "Indexing already in progress" message
4. Given successful indexing, then notification shows: "{N} Apex classes, {M} triggers, {K} flows, {L} objects indexed"

---

#### STORY 9: SFDX Stats in `code_index_status`

> As a developer, I want `code_index_status` to show SFDX indexing progress and stats

**Requirement Details:**

1. `code_index_status` SHALL include SFDX-specific section when SFDX project detected
2. Stats SHALL include: apex classes count, triggers count, flows count, objects count, LWC count
3. Stats SHALL include: last indexed timestamp, files pending re-index
4. Stats SHALL include: SF relationship counts by type

**Acceptance Criteria:**

1. Given an indexed SFDX project, when `code_index_status` is called, then response includes SF-specific stats section
2. Stats section SHALL show breakdown: `{ apex: 150, triggers: 20, flows: 45, objects: 80, lwc: 30 }`
3. Given no SFDX project, when `code_index_status` is called, then SF section is omitted (backward compatible)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| salesforce-ast (apex-ast) | External npm package | N/A | Provides Tree-Sitter Apex grammar + SFDX scanning utilities |
| mcp-code-intelligence-nodejs | Internal module (EXTENDED) | N/A | **Host server** — all SF capabilities added here |
| kiro-sdlc-agents | Internal module (EXTENDED) | N/A | Extension — new command added |
| mcp-salesforce-intelligence/ | Internal module (NEW — shared library only) | N/A | Shared parsing logic, NOT an MCP server |
| web-tree-sitter | Existing dependency | N/A | Already used by mcp-code-intelligence-nodejs |
| better-sqlite3 | Existing dependency | N/A | Already used for graph/index storage |
| Node.js 20+ | Runtime | N/A | Same as existing requirement |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Duc Nguyen | Define requirements, accept deliverables | Project owner |
| Developer | Dev Agent | Extend existing modules | Assigned |
| Architect | SA Agent | Design integration into existing architecture | Reviewer |
| QA | QA Agent | Test enhanced tools | Verifier |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Apex grammar `.wasm` not compatible with existing web-tree-sitter version | High | Low | Test grammar loading early; pin compatible versions |
| Large SFDX projects causing indexing slowdown for non-SF files | Medium | Medium | Index SF files in separate pass; do not block standard indexing |
| New relationship types breaking existing graph queries | High | Low | Additive-only changes; existing queries unaffected by new types |
| `salesforce-meta-parser.ts` regex-based XML parsing fragile for edge cases | Medium | Medium | Graceful degradation — partial results with warnings |
| Extension command conflicts with existing "Index Workspace" | Low | Low | Separate command ID; can coexist |

### 5.2 Assumptions

- `salesforce-ast` npm package provides a compatible Tree-Sitter Apex `.wasm` grammar
- Existing SQLite schema can accommodate new relationship types without migration (additive)
- Existing tool response formats are extensible (new fields do not break consumers)
- The shared library `mcp-salesforce-intelligence/` is consumed as a local npm dependency (workspace link)
- `apex-parser.ts` and `salesforce-meta-parser.ts` already created follow the `ILanguageParser` interface correctly

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Full SFDX indexing < 30 seconds | For typical project (500 Apex files, 100 flows, 200 objects) |
| Performance | Individual Apex file parse < 500ms | Single class parse via tree-sitter |
| Performance | Existing tool response time unchanged | SF additions must not degrade non-SF queries |
| Performance | Dependency/impact query < 200ms | Graph traversal including SF relationships |
| Backward Compatibility | Existing tool behavior unchanged for non-SF projects | Zero regression for current users |
| Backward Compatibility | Existing tool response schema additive-only | New fields added, no fields removed or renamed |
| Scalability | Support SFDX projects up to 5000 metadata components | Without degradation |
| Reliability | Graceful error handling for malformed Apex/XML | Partial results, never crash server |
| Compatibility | Cross-platform (Windows, macOS, Linux) | Same as existing |
| Maintainability | TypeScript strict mode | Consistent with existing codebase |
| Maintainability | Vitest for testing | Consistent with existing test framework |
| Testability | Shared library independently testable | `mcp-salesforce-intelligence/` has own test suite |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-191 | Tich hop Salesforce Intelligence vao FEC_CR_Builder | In Progress | Story | Main ticket |

---

## 8. Appendix

### Approach Comparison (v1 vs v2)

| Aspect | v1 (REJECTED) | v2 (APPROVED) |
|--------|---------------|---------------|
| Architecture | 3 new MCP servers | Extend existing server |
| New tools | 14 new tools (sf_*) | 0 new tools — enhance 7 existing |
| Complexity | High (new servers, new protocols) | Low (additive changes to existing) |
| Maintenance | 3 servers to maintain | 1 server (existing) |
| User experience | New tool names to learn | Same tools, richer results |
| Backward compat | N/A (new) | Must maintain |

### Existing Tools Enhanced

| Tool | Current Behavior | Enhanced Behavior (v2) |
|------|-----------------|----------------------|
| `code_index_status` | Shows indexing stats for supported languages | + SFDX section with SF-specific counts |
| `code_search` | Searches symbols across indexed files | + Includes Apex/Flow/Object/LWC symbols |
| `code_symbols` | Returns symbols for a file or query | + Apex classes, triggers, methods with SF modifiers |
| `code_dependencies` | Shows import/call dependencies | + trigger-on, flow-action, lwc-wire, soql, dml |
| `code_impact` | Transitive impact analysis | + Cross-metadata-type impact (Object to Trigger to Apex) |
| `code_callers` | Who calls this symbol | + Flow actions, LWC imports, trigger handlers |
| `code_callees` | What does this symbol call | + SOQL targets, DML targets, Apex invocations |
| `mem_ingest_file` | Ingests file content to KB | + Structured parsing for .cls, .trigger, .flow-meta.xml |

### New Relationship Types (added to existing graph)

| Relationship Kind | Source | Target | Example |
|-------------------|--------|--------|---------|
| `trigger-on` | Trigger | SObject | AccountTrigger to Account |
| `soql` | Apex method | SObject | AccountService.getAccounts to Account |
| `dml` | Apex method | SObject | AccountService.save to Account |
| `wire` | LWC component | Apex class | accountList to AccountController |
| `flow-action` | Flow | Apex class | Auto_Create_Contact to ContactService |
| `flow-object` | Flow | SObject | Auto_Create_Contact to Contact |
| `inherits` | Apex class | Apex class | AccountService to BaseService |
| `implements` | Apex class | Interface | AccountService to IAccountService |
| `decorates` | Annotation | Apex method | @AuraEnabled to AccountService.getAccounts |

### Module Structure (v2)

```
mcp-code-intelligence-nodejs/          <-- EXISTING SERVER (extended)
├── src/
│   ├── parsers/
│   │   ├── grammars/
│   │   │   └── tree-sitter-apex.wasm  <-- NEW grammar file
│   │   ├── languages/
│   │   │   ├── apex-parser.ts         <-- NEW (already created)
│   │   │   └── salesforce-meta-parser.ts <-- NEW (already created)
│   │   └── grammar-registry.ts        <-- MODIFIED (add apex entry)
│   ├── indexer/
│   │   └── (modified to detect sfdx-project.json)
│   ├── graph/
│   │   └── (modified to handle new relationship types)
│   └── tools/
│       └── (existing tools enhanced with SF results)

mcp-salesforce-intelligence/           <-- NEW shared library (NOT a server)
├── package.json
├── src/
│   ├── sfdx-detector.ts              <-- Detect SFDX project structure
│   ├── apex-grammar-loader.ts        <-- Load Apex .wasm grammar
│   ├── sf-relationship-types.ts      <-- SF relationship type definitions
│   └── index.ts                      <-- Public API exports
├── tests/
└── README.md

kiro-sdlc-agents/                      <-- EXISTING extension (extended)
├── src/
│   └── commands/
│       └── index-salesforce.ts        <-- NEW command
└── package.json                       <-- MODIFIED (add command contribution)
```

### Glossary

| Term | Definition |
|------|------------|
| SFDX | Salesforce DX — Salesforce's developer experience platform and CLI |
| Apex | Salesforce's proprietary programming language (Java-like) |
| LWC | Lightning Web Components — Salesforce's modern frontend framework |
| Flow | Salesforce's declarative automation tool (visual process builder) |
| MCP | Model Context Protocol — standard for AI tool integration |
| Tree-Sitter | Incremental parsing library for programming languages |
| SObject | Salesforce Object — database table equivalent in Salesforce |
| DML | Data Manipulation Language — insert/update/delete/upsert in Apex |
| SOQL | Salesforce Object Query Language — SQL-like query language for SObjects |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| salesforce-ast GitHub | https://github.com/dnguyenminh/apex-ast |
| MCP SDK Documentation | https://modelcontextprotocol.io |
| Existing MCP Server | `mcp-code-intelligence-nodejs/` in this repo |
| Kiro Extension | `kiro-sdlc-agents/` in this repo |
| Existing apex-parser.ts | `mcp-code-intelligence-nodejs/src/parsers/languages/apex-parser.ts` |
| Existing salesforce-meta-parser.ts | `mcp-code-intelligence-nodejs/src/parsers/languages/salesforce-meta-parser.ts` |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

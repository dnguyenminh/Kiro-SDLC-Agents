# Functional Specification Document (FSD)

## mcp-code-intelligence-nodejs — KSA-191: Salesforce Language Support (v2 — Plugin Integration)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-191 |
| Title | Salesforce Language Support — Extend mcp-code-intelligence-nodejs |
| Author | BA Agent |
| Version | 2.0 |
| Date | 2026-06-01 |
| Status | Draft |
| Related BRD | BRD-v2-KSA-191.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create FSD draft (business sections) |
| Technical Reviewer | TA Agent – Technical Analyst | Enrich with API contracts, pseudocode |
| Peer Reviewer | SA Agent – Solution Architect | Review architectural consistency |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-27 | BA Agent | Initial FSD — 3 MCP servers approach (SUPERSEDED) |
| 2.0 | 2026-06-01 | BA Agent + TA Agent | Complete rewrite for v2 plugin integration |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of Salesforce code intelligence
capabilities integrated into the existing `mcp-code-intelligence-nodejs` server.
All SF features are delivered by extending existing tools — no new MCP servers.

### 1.2 Scope

- Apex language parsing via tree-sitter grammar
- Salesforce metadata XML parsing (Flow, Object, Field, LWC)
- SFDX project detection and indexing
- SF-specific relationship types in the existing graph
- Enhanced existing tools with SF results
- Extension command for manual SF indexing

### 1.3 Out of Scope

- Creating new MCP servers (EXPLICITLY OUT OF SCOPE)
- Salesforce org authentication or live metadata retrieval
- Real-time file watching for SFDX projects (future)
- Changes to kotlin/python code-intelligence servers (future)
- Salesforce deployment/CI/CD automation

### 1.4 Definitions & Acronyms

| Term | Definition |
|------|------------|
| SFDX | Salesforce DX — developer experience platform and CLI |
| Apex | Salesforce proprietary programming language (Java-like) |
| LWC | Lightning Web Components — Salesforce frontend framework |
| Flow | Salesforce declarative automation tool |
| SObject | Salesforce Object — database table equivalent |
| DML | Data Manipulation Language (insert/update/delete/upsert in Apex) |
| SOQL | Salesforce Object Query Language |
| MCP | Model Context Protocol — AI tool integration standard |

### 1.5 References

| Document | Location |
|----------|----------|
| BRD | BRD-v2-KSA-191.docx |
| Existing apex-parser.ts | mcp-code-intelligence-nodejs/src/parsers/languages/apex-parser.ts |
| Existing salesforce-meta-parser.ts | mcp-code-intelligence-nodejs/src/parsers/languages/salesforce-meta-parser.ts |
| Grammar Config | mcp-code-intelligence-nodejs/src/parsers/grammar-config.json |
| salesforce-ast GitHub | https://github.com/dnguyenminh/apex-ast |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The system extends the existing `mcp-code-intelligence-nodejs` MCP server:
- **Developer** — uses Kiro IDE to trigger indexing and query SF intelligence
- **AI Agents** — invoke MCP tools via MCP protocol
- **Kiro Extension** — provides UI commands calling the MCP server
- **SFDX Project** — source files on disk (Apex, Flow, Object, LWC)

### 2.2 System Architecture (v2 — Plugin Integration)

The v2 approach integrates Salesforce capabilities as a **plugin** into existing architecture:

| Layer | Status | SF Enhancement |
|-------|--------|----------------|
| Tools | EXISTING | Enhanced responses include SF results |
| Graph | EXISTING | New relationship types (trigger-on, soql, dml, wire) |
| Indexer | EXISTING | SFDX project detection + SF file scanning |
| Parsers | EXISTING + NEW | apex-parser.ts + salesforce-meta-parser.ts added |
| Database | EXISTING | Additive schema — new relationship kinds only |

**Key Principle:** Zero new servers, zero new tools, zero new protocols.

### 2.3 Component Change Summary

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `src/parsers/languages/apex-parser.ts` | **EXISTS** | Apex language parser (ILanguageParser) |
| `src/parsers/languages/salesforce-meta-parser.ts` | **EXISTS** | Flow/Object/LWC metadata parser |
| `src/parsers/grammars/tree-sitter-apex.wasm` | **NEW FILE** | Tree-sitter Apex grammar binary |
| `src/parsers/grammar-config.json` | **ALREADY MODIFIED** | Apex + salesforce-meta entries added |
| `src/indexer/indexing-engine.ts` | **MODIFIED** | detectSfdxProject() + SF file scanning |
| `src/graph/*` | **ENHANCED** | New relationship types traversal |
| `src/tools/*` | **ENHANCED** | SF results in existing tool responses |
| `mcp-salesforce-intelligence/` | **NEW LIBRARY** | Shared SF parsing logic (npm package) |
| `kiro-sdlc-agents/src/commands/index-salesforce.ts` | **NEW** | Extension command |


---

## 3. Functional Requirements

### 3.1 Feature: SFDX Project Auto-Detection

**Source:** BRD Story 1

#### 3.1.1 Description

The existing indexer (`IndexingEngine`) detects SFDX project structure by presence of `sfdx-project.json` in the workspace root. When detected, it includes Salesforce metadata paths in the indexing scan.

#### 3.1.2 Use Case

**Use Case ID:** UC-01
**Actor:** Developer / AI Agent
**Preconditions:** Workspace contains an SFDX project with `sfdx-project.json`
**Postconditions:** All SF metadata files are indexed with symbols and relationships stored

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Triggers indexing (manual or auto) |
| 2 | | IndexingEngine | Calls `detectSfdxProject()` — checks for `sfdx-project.json` |
| 3 | | IndexingEngine | Reads `packageDirectories` from `sfdx-project.json` |
| 4 | | IndexingEngine | Scans SF paths for `.cls`, `.trigger`, `.flow-meta.xml`, `.object-meta.xml`, `.js-meta.xml` |
| 5 | | apex-parser | Parses Apex files → extracts symbols + relationships |
| 6 | | salesforce-meta-parser | Parses metadata XML → extracts symbols + relationships |
| 7 | | Database | Stores symbols and relationships in SQLite |
| 8 | | IndexingEngine | Reports SF-specific stats (apex count, trigger count, etc.) |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | No `sfdx-project.json` found | Skip SF-specific processing; standard indexing only |
| AF-02 | Custom `packageDirectories` in config | Use configured paths instead of default `force-app/` |
| AF-03 | Incremental re-index (files unchanged) | Skip unchanged files (hash comparison) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Malformed `sfdx-project.json` | Log warning, skip SF detection, continue standard indexing |
| EF-02 | Apex parse error (syntax error in .cls) | Log error for file, continue with other files, report partial results |
| EF-03 | Missing grammar .wasm file | Log error, disable Apex tree-sitter parsing, fall back to regex |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | SFDX detection MUST NOT affect non-SF project indexing performance | BRD NFR |
| BR-02 | Incremental indexing MUST use file hash comparison (same as existing) | BRD Story 1 AC3 |
| BR-03 | All `packageDirectories` paths from sfdx-project.json MUST be scanned | BRD Story 1 AC2 |
| BR-04 | SF indexing MUST be additive — never remove existing non-SF index data | BRD Approach v2 |


#### 3.1.4 Data Specifications

**Input Data (sfdx-project.json):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| packageDirectories | array | Yes | Non-empty array | List of package directory configs |
| packageDirectories[].path | string | Yes | Valid relative path | Directory containing SF metadata |
| packageDirectories[].default | boolean | No | — | Whether this is the default package |
| namespace | string | No | — | Org namespace prefix |

**Output Data (IndexResult — enhanced):**

| Field | Type | Description |
|-------|------|-------------|
| totalFiles | number | Total files indexed |
| sfStats.apexClasses | number | Count of .cls files indexed |
| sfStats.triggers | number | Count of .trigger files indexed |
| sfStats.flows | number | Count of .flow-meta.xml files indexed |
| sfStats.objects | number | Count of .object-meta.xml files indexed |
| sfStats.lwcComponents | number | Count of .js-meta.xml files indexed |
| sfStats.relationships | number | Total SF relationships extracted |
| errors | ParseError[] | Files that failed to parse |

---

### 3.2 Feature: Apex Symbols in `code_symbols`

**Source:** BRD Story 2

#### 3.2.1 Description

The existing `code_symbols` tool returns Apex class, interface, enum, trigger, method, constructor, and property symbols when querying indexed Apex files.

#### 3.2.2 Use Case

**Use Case ID:** UC-02
**Actor:** AI Agent
**Preconditions:** SFDX project indexed; Apex files parsed
**Postconditions:** Apex symbols returned with correct signatures and metadata

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | AI Agent | | Calls `code_symbols(file_path="AccountService.cls")` |
| 2 | | SymbolResolver | Resolves file path in index |
| 3 | | Database | Queries symbols for resolved file |
| 4 | | Tool | Returns symbols with Apex-specific metadata |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Query by annotation (e.g., `@AuraEnabled`) | Filter symbols by decorator field |
| AF-02 | Query by symbol name pattern | Fuzzy match across all indexed Apex symbols |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | File not indexed | Return "File not found in index" message |
| EF-02 | File indexed but no symbols extracted | Return empty array (valid for empty files) |


#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-05 | Apex symbols MUST include modifiers: global, virtual, with sharing, without sharing, webservice | BRD Story 2 |
| BR-06 | Apex symbols MUST include annotations: @IsTest, @AuraEnabled, @InvocableMethod, @Future, etc. | BRD Story 2 |
| BR-07 | Symbol signatures MUST follow Apex conventions (not Java) | BRD Story 2 |
| BR-08 | Trigger symbols MUST include trigger events and SObject reference | BRD Story 2 AC2 |

#### 3.2.4 Data Specifications

**Apex Symbol Output (ExtractedSymbol — existing interface):**

| Field | Type | Description | Apex Example |
|-------|------|-------------|--------------|
| name | string | Symbol name | `AccountService` |
| kind | SymbolKind | class/method/interface/enum/property | `class` |
| filePath | string | Source file path | `force-app/.../AccountService.cls` |
| startLine | number | Start line | `1` |
| endLine | number | End line | `150` |
| signature | string | Full signature | `public with sharing class AccountService` |
| modifiers | string[] | Apex modifiers | `["public", "with sharing"]` |
| decorators | string[] | Annotations | `["@AuraEnabled"]` |
| parentName | string/null | Parent class (for methods) | `AccountService` |
| returnType | string/null | Return type (for methods) | `List<Account>` |
| parameters | string/null | Parameter list | `(String name, Integer limit)` |

---

### 3.3 Feature: SF Symbols in `code_search`

**Source:** BRD Story 3

#### 3.3.1 Description

The existing `code_search` tool includes Apex, Flow, Object, and LWC symbols in search results. Supports filtering by SF metadata type.

#### 3.3.2 Use Case

**Use Case ID:** UC-03
**Actor:** AI Agent
**Preconditions:** SFDX project indexed
**Postconditions:** Search results include SF symbols alongside standard language symbols

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | AI Agent | | Calls `code_search(query="AccountService")` |
| 2 | | SearchEngine | Searches across ALL indexed symbols (including SF) |
| 3 | | Database | Returns matching symbols from all languages |
| 4 | | Tool | Formats results with file path, line, signature |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Type filter: `code_search(query="Account", type="object")` | Filter by metadata type |
| AF-02 | Cross-type search: `code_search(query="handleSave")` | Return both Apex methods and LWC handlers |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-09 | Search MUST include Apex classes, methods, triggers in results | BRD Story 3 |
| BR-10 | Search MUST include Flow names, Object names, LWC component names | BRD Story 3 |
| BR-11 | Search MUST support type filtering (apex, flow, object, lwc) | BRD Story 3 |
| BR-12 | Search results MUST include same metadata as other languages | BRD Story 3 |


---

### 3.4 Feature: SF Dependencies in `code_dependencies`

**Source:** BRD Story 4

#### 3.4.1 Description

The existing `code_dependencies` tool shows SF-specific dependency relationships: trigger-on, flow-action, flow-object, lwc-wire, class-class, SOQL, and DML relationships.

#### 3.4.2 Use Case

**Use Case ID:** UC-04
**Actor:** AI Agent
**Preconditions:** SFDX project indexed with relationships extracted
**Postconditions:** SF dependencies returned with relationship types

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | AI Agent | | Calls `code_dependencies(file="AccountService.cls", direction="both")` |
| 2 | | FileResolver | Resolves file path |
| 3 | | DependencyGraphService | Traverses graph including SF relationship types |
| 4 | | Tool | Returns dependencies grouped by type |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Query by SObject name | Show all triggers, flows, classes referencing that object |
| AF-02 | Filter by relationship type | `include_types=["trigger-on", "soql"]` |
| AF-03 | Deep traversal (depth > 1) | Follow transitive SF dependencies |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-13 | MUST show trigger-on relationships (trigger → SObject) | BRD Story 4 |
| BR-14 | MUST show flow-action relationships (flow → Apex class) | BRD Story 4 |
| BR-15 | MUST show SOQL relationships (Apex method → SObject) | BRD Story 4 |
| BR-16 | MUST show DML relationships (Apex method → SObject) | BRD Story 4 |
| BR-17 | MUST show wire relationships (LWC → Apex class) | BRD Story 4 |
| BR-18 | MUST show class inheritance (Apex class → Apex class) | BRD Story 4 |
| BR-19 | Dependency query response time < 200ms | BRD NFR |

#### 3.4.4 New Relationship Types

| Relationship Kind | Source Type | Target Type | Example |
|-------------------|-------------|-------------|---------|
| `trigger-on` | Trigger | SObject | AccountTrigger → Account |
| `soql` | Apex method | SObject | AccountService.getAccounts → Account |
| `dml` | Apex method | SObject | AccountService.save → Account |
| `wire` | LWC component | Apex class | accountList → AccountController |
| `flow-action` | Flow | Apex class | Auto_Create_Contact → ContactService |
| `flow-object` | Flow | SObject | Auto_Create_Contact → Contact |
| `inherits` | Apex class | Apex class | AccountService → BaseService |
| `implements` | Apex class | Interface | AccountService → IAccountService |
| `decorates` | Annotation | Apex method | @AuraEnabled → AccountService.getAccounts |
| `apex-import` | Apex class | Apex class | AccountService → AccountHelper |

---

### 3.5 Feature: SF Impact Analysis in `code_impact`

**Source:** BRD Story 5

#### 3.5.1 Description

The existing `code_impact` tool traverses SF relationship types when analyzing blast radius. Impact of changing an Object includes triggers, flows, Apex classes with SOQL/DML, and LWC components.

#### 3.5.2 Use Case

**Use Case ID:** UC-05
**Actor:** AI Agent
**Preconditions:** SFDX project indexed with full relationship graph
**Postconditions:** Impact analysis includes cross-metadata-type traversal

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | AI Agent | | Calls `code_impact(symbol="Account", action="modify")` |
| 2 | | SymbolResolver | Resolves "Account" to SObject symbol |
| 3 | | ImpactAnalysisService | Traverses ALL relationship types (including SF) |
| 4 | | Tool | Returns grouped impact: triggers, flows, classes, LWC |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Impact on Apex class | Include callers (Apex + Flow + LWC) with transitive impact |
| AF-02 | Impact on Flow | Include subflows, referenced Apex classes |
| AF-03 | Severity filtering | Filter by severity_threshold parameter |

#### 3.5.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-20 | Object impact MUST include: triggers, flows, classes with SOQL/DML, LWC | BRD Story 5 |
| BR-21 | Apex class impact MUST include: calling classes, flows, LWC imports | BRD Story 5 |
| BR-22 | Impact results MUST include severity hints (direct=high, transitive=medium/low) | BRD Story 5 AC3 |
| BR-23 | Impact results MUST be grouped by metadata type | BRD Story 5 |


---

### 3.6 Feature: SF Call Graph in `code_callers`/`code_callees`

**Source:** BRD Story 6

#### 3.6.1 Description

The existing `code_callers` and `code_callees` tools include SF call relationships: Apex method calls, Flow action invocations, LWC Apex imports, trigger handler calls.

#### 3.6.2 Use Case

**Use Case ID:** UC-06
**Actor:** AI Agent
**Preconditions:** SFDX project indexed with call graph built
**Postconditions:** Call graph includes cross-metadata-type relationships

**Main Flow (code_callers):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | AI Agent | | Calls `code_callers(symbol="AccountService.createAccount")` |
| 2 | | SymbolResolver | Resolves symbol to definition(s) |
| 3 | | CallGraphService | Finds all callers including SF types |
| 4 | | Tool | Returns callers with call type annotation |

**Main Flow (code_callees):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | AI Agent | | Calls `code_callees(symbol="AccountTrigger")` |
| 2 | | SymbolResolver | Resolves trigger symbol |
| 3 | | CallGraphService | Finds all methods/classes invoked by trigger |
| 4 | | Tool | Returns callees with relationship kind |

#### 3.6.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-24 | code_callers MUST include: Apex calls, Flow actions, LWC imports, trigger handlers | BRD Story 6 |
| BR-25 | code_callees MUST include: method calls, SOQL targets, DML targets | BRD Story 6 |
| BR-26 | Call graph MUST support cross-metadata-type traversal | BRD Story 6 |
| BR-27 | Results MUST distinguish call types: method_call, apex_action, wire_adapter, dml, soql | BRD Story 6 AC3 |

---

### 3.7 Feature: SF File Support in `mem_ingest_file`

**Source:** BRD Story 7

#### 3.7.1 Description

The existing `mem_ingest_file` tool accepts Apex and SF metadata files, parses them using the appropriate parser, and stores structured metadata in the knowledge base.

#### 3.7.2 Use Case

**Use Case ID:** UC-07
**Actor:** AI Agent
**Preconditions:** File exists on disk
**Postconditions:** File content parsed and stored in KB with structured metadata

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | AI Agent | | Calls `mem_ingest_file(path="force-app/.../AccountService.cls")` |
| 2 | | Tool | Detects file extension → selects parser |
| 3 | | apex-parser | Parses file → extracts symbols + relationships |
| 4 | | KB | Stores structured metadata with tags |

#### 3.7.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-28 | MUST accept .cls, .trigger files and parse with apex-parser | BRD Story 7 |
| BR-29 | MUST accept .flow-meta.xml, .object-meta.xml and parse with salesforce-meta-parser | BRD Story 7 |
| BR-30 | Ingested content MUST include: symbol names, relationships, annotations, modifiers | BRD Story 7 |
| BR-31 | KB entries MUST be tagged with: salesforce, {metadata-type}, {component-name} | BRD Story 7 |

---

### 3.8 Feature: Extension Command "Index Salesforce Project"

**Source:** BRD Story 8

#### 3.8.1 Description

A new command "Kiro SDLC: Index Salesforce Project" registered in the Kiro extension command palette. It auto-detects the SFDX project root and triggers the existing indexer with SF-specific options.

#### 3.8.2 Use Case

**Use Case ID:** UC-08
**Actor:** Developer
**Preconditions:** Kiro IDE open with workspace containing SFDX project
**Postconditions:** SF project fully indexed, results shown in notification

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Opens command palette, selects "Kiro SDLC: Index Salesforce Project" |
| 2 | | Extension | Searches workspace for `sfdx-project.json` |
| 3 | | Extension | Shows progress notification "Indexing Salesforce project..." |
| 4 | | Extension | Calls existing indexer MCP tool with SF options |
| 5 | | IndexingEngine | Performs full SF indexing |
| 6 | | Extension | Shows result notification with stats |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | No SFDX project found | Show error: "No SFDX project found (missing sfdx-project.json)" |
| AF-02 | Indexing already in progress | Show info: "Indexing already in progress" |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Indexer connection failed | Show error: "Cannot connect to code intelligence server" |
| EF-02 | Partial indexing failure | Show warning with partial results + error count |

#### 3.8.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-32 | Command MUST follow existing "Index Workspace" pattern | BRD Story 8 |
| BR-33 | MUST show progress notification during indexing | BRD Story 8 |
| BR-34 | MUST report results: files parsed, symbols found, relationships built, errors | BRD Story 8 |
| BR-35 | MUST NOT create a new MCP server connection — use existing | BRD Approach v2 |


---

### 3.9 Feature: SFDX Stats in `code_index_status`

**Source:** BRD Story 9

#### 3.9.1 Description

The existing `code_index_status` tool includes an SFDX-specific section when an SFDX project is detected, showing SF metadata counts and relationship statistics.

#### 3.9.2 Use Case

**Use Case ID:** UC-09
**Actor:** AI Agent
**Preconditions:** SFDX project detected and indexed
**Postconditions:** Index status includes SF-specific stats section

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | AI Agent | | Calls `code_index_status` |
| 2 | | Tool | Queries database for standard stats |
| 3 | | Tool | Detects SFDX project → queries SF-specific stats |
| 4 | | Tool | Returns combined response with SF section |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | No SFDX project | Omit SF section entirely (backward compatible) |

#### 3.9.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-36 | MUST include SF section only when SFDX project detected | BRD Story 9 AC3 |
| BR-37 | Stats MUST include: apex classes, triggers, flows, objects, LWC counts | BRD Story 9 |
| BR-38 | Stats MUST include: last indexed timestamp, files pending re-index | BRD Story 9 |
| BR-39 | Stats MUST include: SF relationship counts by type | BRD Story 9 |

#### 3.9.4 Data Specifications

**Enhanced code_index_status Response (SF section):**

| Field | Type | Description |
|-------|------|-------------|
| salesforce.detected | boolean | Whether SFDX project was detected |
| salesforce.projectRoot | string | Path to sfdx-project.json |
| salesforce.stats.apexClasses | number | Indexed Apex class count |
| salesforce.stats.triggers | number | Indexed trigger count |
| salesforce.stats.flows | number | Indexed flow count |
| salesforce.stats.objects | number | Indexed object count |
| salesforce.stats.lwcComponents | number | Indexed LWC count |
| salesforce.stats.fields | number | Indexed field count |
| salesforce.relationships | object | Counts by relationship type |
| salesforce.relationships.triggerOn | number | trigger-on relationship count |
| salesforce.relationships.soql | number | SOQL relationship count |
| salesforce.relationships.dml | number | DML relationship count |
| salesforce.relationships.wire | number | Wire relationship count |
| salesforce.relationships.flowAction | number | Flow-action relationship count |
| salesforce.lastIndexed | string | ISO timestamp of last SF indexing |
| salesforce.pendingFiles | number | Files changed since last index |

---

## 4. Data Model

### 4.1 Existing Schema (Extended)

The existing SQLite database schema is extended with **additive changes only**:

#### symbols table (EXISTING — no schema change)

Apex symbols stored using existing columns:
- `kind` = class/method/interface/enum/property/constructor
- `modifiers` = JSON array of Apex modifiers
- `decorators` = JSON array of annotations
- `language` = "apex" or "salesforce-meta"

#### relationships table (EXISTING — new `kind` values)

New relationship kinds added to existing `kind` column:
- `trigger-on`, `soql`, `dml`, `wire`, `apex-import`, `flow-action`, `flow-object`

These are additive — existing relationship kinds (`calls`, `imports`, `inherits`, `implements`, `uses`, `decorates`) remain unchanged.

#### files table (EXISTING — no schema change)

SF files stored with existing columns:
- `language` = "apex" or "salesforce-meta"
- `module` = detected from SFDX package directory

### 4.2 Logical Entities (SF-specific)

#### Entity: ApexClass

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Class name (e.g., AccountService) |
| kind | enum | Yes | class/interface/enum |
| modifiers | string[] | Yes | global, public, virtual, abstract, with sharing, without sharing |
| annotations | string[] | No | @IsTest, @AuraEnabled, @InvocableMethod, etc. |
| parentClass | string | No | Superclass name (if extends) |
| interfaces | string[] | No | Implemented interfaces |
| methods | Method[] | Yes | Class methods |
| properties | Property[] | No | Class properties |

#### Entity: ApexTrigger

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Trigger name |
| sObject | string | Yes | Target SObject (e.g., Account) |
| events | string[] | Yes | before insert, after update, etc. |
| handlerCalls | string[] | No | Methods called by trigger body |

#### Entity: SalesforceFlow

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Flow API name |
| type | enum | Yes | AutoLaunchedFlow, ScreenFlow, RecordTriggeredFlow |
| triggerObject | string | No | Object that triggers the flow |
| apexActions | string[] | No | Apex classes invoked as actions |
| referencedObjects | string[] | No | Objects referenced in flow |
| subflows | string[] | No | Subflows called |

#### Entity: SalesforceObject

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Object API name (e.g., Account, Custom__c) |
| label | string | No | Display label |
| fields | Field[] | No | Custom fields |
| isCustom | boolean | Yes | Whether custom object |

#### Entity: LWCComponent

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Component name |
| apexImports | string[] | No | Apex classes imported via @wire |
| targets | string[] | No | Lightning page targets |

---

## 5. Integration Specifications

### 5.1 Internal Integration: mcp-salesforce-intelligence (Shared Library)

| Attribute | Value |
|-----------|-------|
| Purpose | Reusable SF parsing logic consumed by mcp-code-intelligence-nodejs |
| Direction | Inbound (library consumed by server) |
| Data Format | TypeScript module exports |
| Frequency | Build-time dependency (npm workspace link) |

**Public API Exports:**

| Export | Type | Description |
|--------|------|-------------|
| `detectSfdxProject(rootPath)` | function | Returns SFDX config or null |
| `getSfFilePaths(sfdxConfig)` | function | Returns all SF metadata file paths |
| `SF_RELATIONSHIP_TYPES` | constant | Enum of SF relationship type strings |
| `ApexGrammarLoader` | class | Loads tree-sitter-apex.wasm |

### 5.2 Internal Integration: kiro-sdlc-agents Extension

| Attribute | Value |
|-----------|-------|
| Purpose | Provide "Index Salesforce Project" command in IDE |
| Direction | Outbound (extension calls MCP server) |
| Data Format | MCP tool call (JSON-RPC) |
| Frequency | On-demand (user-triggered) |

**Command Registration:**

| Field | Value |
|-------|-------|
| Command ID | `kiro-sdlc.indexSalesforceProject` |
| Title | Kiro SDLC: Index Salesforce Project |
| Category | Kiro SDLC |
| When | `workspaceFolderCount > 0` |

### 5.3 External Integration: salesforce-ast npm package

| Attribute | Value |
|-----------|-------|
| Purpose | Provides Tree-Sitter Apex grammar (.wasm) and SFDX utilities |
| Direction | Inbound (npm dependency) |
| Data Format | npm package with .wasm binary |
| Frequency | Build-time dependency |

---

## 6. Processing Logic

### 6.1 SFDX Detection Process

**Trigger:** IndexingEngine.startBackgroundIndexing() or runFullIndex()
**Input:** Workspace root path
**Output:** Boolean (SFDX detected) + SFDX config

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Check `{workspace}/sfdx-project.json` exists | If not exists → return false, skip SF processing |
| 2 | Read and parse JSON | If malformed → log warning, return false |
| 3 | Extract `packageDirectories` array | If missing/empty → log warning, use default `force-app/` |
| 4 | Validate each path exists on disk | If path missing → log warning, skip that path |
| 5 | Store SFDX config for later use | — |

### 6.2 Apex File Indexing Process

**Trigger:** File with `.cls` or `.trigger` extension encountered during scan
**Input:** File path + file content
**Output:** ParseResult (symbols + relationships)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Load tree-sitter-apex.wasm grammar (cached) | If grammar missing → fall back to regex |
| 2 | Parse source with tree-sitter → AST | If parse error → log, attempt partial extraction |
| 3 | Extract class/interface/enum declarations | — |
| 4 | Extract methods, constructors, properties | — |
| 5 | Extract trigger declarations + events | — |
| 6 | Extract DML operations → dml relationships | — |
| 7 | Extract SOQL queries → soql relationships | — |
| 8 | Extract method calls → calls relationships | — |
| 9 | Extract inheritance → inherits/implements relationships | — |
| 10 | Return ParseResult | — |

### 6.3 Metadata XML Parsing Process

**Trigger:** File with `.flow-meta.xml`, `.object-meta.xml`, `.field-meta.xml`, `.js-meta.xml` extension
**Input:** File path + XML content
**Output:** ParseResult (symbols + relationships)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Detect metadata type from file extension | If unknown type → skip |
| 2 | Parse XML content (regex-based extraction) | If malformed XML → log warning, partial results |
| 3 | Extract component name from file path | — |
| 4 | Extract type-specific data (flow actions, object fields, etc.) | — |
| 5 | Build relationships (flow-action, flow-object, wire, etc.) | — |
| 6 | Return ParseResult | — |


---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Features |
|------|-------------|----------|
| Developer | Read/Write | Trigger indexing, query tools, ingest files |
| AI Agent | Read | Query tools (code_search, code_symbols, etc.) |
| Extension | Execute | Invoke indexing commands |

**Note:** Security model is inherited from existing MCP server — no additional auth required for SF features.

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Apex source code | Internal | Stored locally in SQLite, never transmitted externally |
| SF metadata XML | Internal | Parsed locally, symbols stored in index |
| SFDX project config | Internal | Read-only, used for path detection |
| Index database | Internal | Local file, no network exposure |

### 7.3 Audit Trail

No additional audit requirements beyond existing MCP server logging.

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Full SFDX indexing completes quickly | < 30 seconds for 500 Apex files + 100 flows + 200 objects |
| Performance | Individual Apex file parse is fast | < 500ms per file via tree-sitter |
| Performance | Existing tool response time unchanged | SF additions must not degrade non-SF queries |
| Performance | Dependency/impact query responsive | < 200ms including SF relationship traversal |
| Backward Compat | Non-SF projects unaffected | Zero regression for current users |
| Backward Compat | Tool response schema additive-only | New fields added, no fields removed or renamed |
| Scalability | Large SFDX projects supported | Up to 5000 metadata components without degradation |
| Reliability | Graceful error handling | Malformed Apex/XML → partial results, never crash |
| Compatibility | Cross-platform | Windows, macOS, Linux (same as existing) |
| Maintainability | TypeScript strict mode | Consistent with existing codebase |
| Maintainability | Vitest for testing | Consistent with existing test framework |
| Testability | Shared library independently testable | mcp-salesforce-intelligence/ has own test suite |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Apex grammar .wasm not found | Warning | "Apex tree-sitter grammar not available, using regex fallback" | Degraded parsing, still functional |
| Malformed Apex file (syntax error) | Info | None (logged internally) | Skip file, continue indexing others |
| Malformed metadata XML | Info | None (logged internally) | Partial extraction, continue |
| No SFDX project detected | Info | "No SFDX project found" (extension command only) | No SF processing, standard behavior |
| Indexing timeout (very large project) | Warning | "Indexing taking longer than expected" | Continue in background |
| Database write failure | Critical | "Failed to store index data" | Retry once, then report error |

### 9.2 Error Codes

| Code | Category | Description | Recovery |
|------|----------|-------------|----------|
| SF-001 | Grammar | Apex .wasm grammar load failed | Use regex fallback parser |
| SF-002 | Parse | Apex file parse error | Skip file, log error, continue |
| SF-003 | Parse | Metadata XML parse error | Partial extraction, continue |
| SF-004 | Detection | sfdx-project.json malformed | Skip SF detection, standard indexing |
| SF-005 | Index | Database write failure | Retry once, report if persistent |
| SF-006 | Extension | MCP server connection failed | Show error notification |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | SFDX project detection (positive) | Workspace with sfdx-project.json | detectSfdxProject() returns true | High |
| TC-02 | SFDX project detection (negative) | Workspace without sfdx-project.json | detectSfdxProject() returns false | High |
| TC-03 | Apex class parsing | Valid AccountService.cls | Symbols: class + methods + properties | High |
| TC-04 | Apex trigger parsing | Valid AccountTrigger.trigger | Trigger symbol + events + trigger-on relationship | High |
| TC-05 | Flow metadata parsing | Valid .flow-meta.xml | Flow symbol + flow-action relationships | High |
| TC-06 | Object metadata parsing | Valid .object-meta.xml | Object symbol + fields | Medium |
| TC-07 | LWC metadata parsing | Valid .js-meta.xml | LWC symbol + wire relationships | Medium |
| TC-08 | code_symbols with Apex file | Indexed .cls file path | Apex symbols with modifiers/annotations | High |
| TC-09 | code_search with SF symbols | Query matching Apex class name | SF symbols in results | High |
| TC-10 | code_dependencies with SF relationships | File with trigger-on, soql, dml | SF relationships in dependency tree | High |
| TC-11 | code_impact cross-metadata | SObject name | Impact includes triggers, flows, classes | High |
| TC-12 | code_callers with SF call types | Apex method name | Callers include Flow actions, LWC imports | High |
| TC-13 | code_index_status SF section | Indexed SFDX project | SF stats section present | Medium |
| TC-14 | Extension command (positive) | SFDX project in workspace | Indexing triggered, results shown | High |
| TC-15 | Extension command (negative) | No SFDX project | Error notification shown | Medium |
| TC-16 | Incremental re-indexing | Modified .cls file | Only changed file re-parsed | Medium |
| TC-17 | Malformed Apex file | Syntax error in .cls | Error logged, other files still indexed | Medium |
| TC-18 | Large project performance | 500 Apex files | Indexing < 30 seconds | High |
| TC-19 | Non-SF project regression | Standard TS/JS project | No behavior change, no SF section | High |
| TC-20 | mem_ingest_file with .cls | Valid Apex file path | Structured metadata in KB | Medium |


---

## 11. Appendix

### 11.1 Sequence Diagram: Index Salesforce Project

![Sequence - Index Project](diagrams/sequence-index-project.png)

### 11.2 State Diagram: Indexing Lifecycle

![State - Indexing](diagrams/state-indexing.png)

### 11.3 Existing Parser Interface (ILanguageParser)

```typescript
interface ILanguageParser {
  readonly languageId: string;
  parse(source: string, filePath: string): ParseResult;
  getSupportedExtensions(): string[];
}

interface ParseResult {
  symbols: ExtractedSymbol[];
  relationships: ExtractedRelationship[];
  errors: ParseError[];
}
```

### 11.4 Existing Tool Interfaces (Enhanced)

**code_dependencies (existing input schema — no change):**
```json
{
  "file": "string (required)",
  "direction": "incoming | outgoing | both",
  "depth": "number (1-5, default 1)",
  "include_external": "boolean (default false)",
  "format": "tree | flat | graph",
  "limit": "number (default 50)"
}
```

**code_impact (existing input schema — no change):**
```json
{
  "symbol": "string (required)",
  "action": "modify | delete | rename",
  "depth": "number (1-5, default 3)",
  "include_tests": "boolean (default true)",
  "severity_threshold": "critical | high | medium | low"
}
```

**code_callers / code_callees (existing input schema — no change):**
```json
{
  "symbol": "string (required)",
  "depth": "number (1-5, default 1)",
  "limit": "number (default 20)",
  "file_filter": "string (glob pattern)",
  "kind_filter": "string (relationship kind)"
}
```

**Note:** The `kind_filter` parameter in `code_callers` now accepts SF relationship kinds: `trigger-on`, `soql`, `dml`, `wire`, `apex-import`, `flow-action`.

### 11.5 Grammar Config (Already Modified)

```json
{
  "id": "apex",
  "extensions": [".cls", ".trigger"],
  "wasmPath": "grammars/tree-sitter-apex.wasm",
  "parserModule": "./languages/apex-parser.js"
},
{
  "id": "salesforce-meta",
  "extensions": [".flow-meta.xml", ".object-meta.xml", ".field-meta.xml", ".js-meta.xml", ".component-meta.xml"],
  "wasmPath": null,
  "parserModule": "./languages/salesforce-meta-parser.js"
}
```

### 11.6 Module Structure (v2)

```
mcp-code-intelligence-nodejs/          <-- EXISTING SERVER (extended)
+-- src/
|   +-- parsers/
|   |   +-- grammars/
|   |   |   +-- tree-sitter-apex.wasm  <-- NEW grammar file
|   |   +-- languages/
|   |   |   +-- apex-parser.ts         <-- EXISTS (ILanguageParser)
|   |   |   +-- salesforce-meta-parser.ts <-- EXISTS (ILanguageParser)
|   |   +-- grammar-config.json        <-- ALREADY MODIFIED
|   +-- indexer/
|   |   +-- indexing-engine.ts         <-- MODIFIED (detectSfdxProject)
|   +-- graph/
|   |   +-- (enhanced for new relationship types)
|   +-- tools/
|       +-- (existing tools enhanced with SF results)

mcp-salesforce-intelligence/           <-- NEW shared library (NOT a server)
+-- package.json
+-- src/
|   +-- sfdx-detector.ts
|   +-- apex-grammar-loader.ts
|   +-- sf-relationship-types.ts
|   +-- index.ts
+-- tests/

kiro-sdlc-agents/                      <-- EXISTING extension (extended)
+-- src/
|   +-- commands/
|       +-- index-salesforce.ts        <-- NEW command
+-- package.json                       <-- MODIFIED (add command)
```

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence - Index Project | [sequence-index-project.png](diagrams/sequence-index-project.png) | [sequence-index-project.drawio](diagrams/sequence-index-project.drawio) |
| 3 | State - Indexing | [state-indexing.png](diagrams/state-indexing.png) | [state-indexing.drawio](diagrams/state-indexing.drawio) |

---

*End of Document*

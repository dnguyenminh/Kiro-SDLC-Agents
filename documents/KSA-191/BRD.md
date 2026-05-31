# Business Requirements Document (BRD)

## FEC_CR_Builder — KSA-191: Tích hợp salesforce-ast (apex-ast) vào FEC_CR_Builder — 3 MCP Servers + Kiro Extension

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-191 |
| Title | Tích hợp salesforce-ast (apex-ast) vào FEC_CR_Builder — 3 MCP Servers + Kiro Extension |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-07-27 |
| Status | Draft |

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
| 1.0 | 2026-07-27 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-191 context |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request integrates the `salesforce-ast` (apex-ast) npm package into the FEC_CR_Builder ecosystem to provide Salesforce-specific code intelligence capabilities. The integration delivers:

1. **A new module** `mcp-salesforce-intelligence/` containing 3 MCP servers
2. **sf-parser** — Parse Apex classes, Flows, Objects, LWC components from SFDX projects
3. **sf-graph** — Build and query dependency graphs with impact analysis
4. **sf-kb-indexer** — Index Salesforce project metadata into the existing Knowledge Base (via `mem_ingest`)
5. **Kiro Extension command** — "Kiro SDLC: Index Salesforce Project" for one-click indexing

The `salesforce-ast` library (https://github.com/dnguyenminh/apex-ast) uses Tree-Sitter for Apex parsing and supports full SFDX project scanning including Apex, Flow, Object, LWC, Permissions, Labels, and Layouts.

### 1.2 Out of Scope

- Modifying the `salesforce-ast` library itself (used as npm dependency only)
- Salesforce deployment/CI/CD automation
- Salesforce org authentication or metadata retrieval from live orgs
- Real-time file watching for SFDX projects (future enhancement)
- Salesforce-specific test execution
- Changes to the existing `mcp-code-intelligence-nodejs` server (separate module)

### 1.3 Preliminary Requirement

- `salesforce-ast` npm package must be published and accessible (currently at https://github.com/dnguyenminh/apex-ast)
- Node.js 20+ runtime environment
- Existing `mcp-code-intelligence-nodejs` server operational (for KB integration via `mem_ingest`)
- Kiro extension (`kiro-sdlc-agents`) v1.13+ with existing "Index Workspace" command pattern

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Salesforce Intelligence module enables AI agents to understand Salesforce codebases by:

1. **Parsing** — User triggers "Index Salesforce Project" command or agent calls `sf_scan_project`
2. **Analysis** — `salesforce-ast` parses all SFDX metadata types (Apex, Flow, Object, LWC, etc.)
3. **Graph Building** — Dependency relationships are computed (class→class, trigger→object, flow→field, LWC→apex)
4. **KB Storage** — Parsed metadata is ingested into the existing Knowledge Base via `mem_ingest`
5. **Querying** — AI agents query the KB or use MCP tools directly for impact analysis, dependency lookup, and code understanding

**Business Flow:**

**Step 1:** Developer opens an SFDX project in Kiro IDE

**Step 2:** Developer runs "Kiro SDLC: Index Salesforce Project" command (or agent auto-detects SFDX project)

**Step 3:** Extension invokes `sf-kb-indexer` MCP server's `sf_index_project` tool

**Step 4:** `sf-kb-indexer` calls `salesforce-ast` to parse the entire SFDX project

**Step 5:** Parsed metadata (classes, triggers, flows, objects, LWC components) is stored in KB

**Step 6:** Dependency graph is built and stored for impact analysis queries

**Step 7:** AI agents can now query Salesforce-specific context via `sf-parser`, `sf-graph`, or KB search

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a Salesforce developer, I want to index my SFDX project so that AI agents understand my Apex code structure | MUST HAVE | KSA-191 |
| 2 | As a Salesforce developer, I want to parse individual Apex files to get class/method signatures and dependencies | MUST HAVE | KSA-191 |
| 3 | As a Salesforce developer, I want to query dependency graphs to understand impact of changes | MUST HAVE | KSA-191 |
| 4 | As a Salesforce developer, I want to parse Flow metadata to understand automation logic | SHOULD HAVE | KSA-191 |
| 5 | As a Salesforce developer, I want to parse Object/Field definitions to understand data model | SHOULD HAVE | KSA-191 |
| 6 | As a Salesforce developer, I want to parse LWC components to understand frontend structure | SHOULD HAVE | KSA-191 |
| 7 | As a Salesforce developer, I want one-click indexing from Kiro IDE command palette | MUST HAVE | KSA-191 |
| 8 | As an AI agent, I want to search indexed Salesforce metadata in KB to provide context-aware assistance | MUST HAVE | KSA-191 |

---

### 2.3 Details of User Stories

---

#### Business Flow

The overall flow follows the existing `mcp-code-intelligence-nodejs` pattern:
- MCP servers expose tools via Model Context Protocol
- Kiro extension registers commands that invoke MCP tools
- KB stores indexed data for cross-session persistence
- AI agents query KB or call MCP tools directly during conversations

---

#### STORY 1: Index SFDX Project

> As a Salesforce developer, I want to index my SFDX project so that AI agents understand my Apex code structure

**Requirement Details:**

1. The system shall detect SFDX project structure (presence of `sfdx-project.json` or `force-app/` directory)
2. The system shall parse all supported metadata types in a single indexing operation
3. The system shall store parsed metadata in the existing Knowledge Base via `mem_ingest`
4. The system shall report indexing progress and results (files parsed, errors encountered)
5. The system shall support incremental re-indexing (only changed files)

**Acceptance Criteria:**

1. Given an SFDX project with `sfdx-project.json`, when `sf_index_project` is called, then all Apex classes, triggers, flows, objects, and LWC components are parsed and stored in KB
2. Given a previously indexed project, when `sf_index_project` is called again, then only modified files are re-indexed (based on file hash comparison)
3. Given an indexing operation, when it completes, then a summary report shows: total files, parsed successfully, errors, time elapsed
4. Given a non-SFDX directory, when `sf_index_project` is called, then an appropriate error message is returned

---

#### STORY 2: Parse Individual Apex Files

> As a Salesforce developer, I want to parse individual Apex files to get class/method signatures and dependencies

**Requirement Details:**

1. The system shall parse Apex classes, interfaces, enums, and triggers
2. The system shall extract: class name, modifiers, parent class, interfaces, methods (with signatures), properties, inner classes
3. The system shall identify dependencies: referenced classes, DML operations, SOQL queries, method calls
4. The system shall use Tree-Sitter for accurate AST parsing (via `salesforce-ast`)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| file_path | string | Yes | Path to Apex file relative to project root | `force-app/main/default/classes/AccountService.cls` |
| include_body | boolean | No | Whether to include method bodies in output | `false` |

**Acceptance Criteria:**

1. Given a valid Apex class file, when `sf_parse_apex` is called, then the response includes class name, methods with signatures, properties, and dependencies
2. Given an Apex trigger file, when `sf_parse_apex` is called, then the response includes trigger name, object, events (before/after insert/update/delete/undelete), and referenced classes
3. Given an invalid/malformed Apex file, when `sf_parse_apex` is called, then a partial parse result is returned with error details for unparseable sections

---

#### STORY 3: Query Dependency Graphs

> As a Salesforce developer, I want to query dependency graphs to understand impact of changes

**Requirement Details:**

1. The system shall build a directed dependency graph from parsed metadata
2. The system shall support forward dependency queries (what does X depend on?)
3. The system shall support reverse dependency queries (what depends on X?)
4. The system shall support impact analysis (transitive closure of reverse dependencies)
5. The system shall export graph data in standard formats (JSON, DOT)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| node_name | string | Yes | Fully qualified name of the component | `AccountService` |
| depth | number | No | Max traversal depth (default: 3) | `5` |
| direction | string | No | `dependents` or `dependencies` | `dependents` |
| include_types | string[] | No | Filter by metadata types | `["ApexClass", "ApexTrigger"]` |

**Acceptance Criteria:**

1. Given an indexed project, when `sf_dependencies` is called for a class, then all classes/objects/flows it references are returned
2. Given an indexed project, when `sf_dependents` is called for a class, then all classes/triggers/flows that reference it are returned
3. Given an indexed project, when `sf_impact_analysis` is called for a class with depth=3, then the full transitive impact tree is returned up to 3 levels deep
4. Given `sf_graph_export`, when called with format=JSON, then the complete dependency graph is exported as a JSON adjacency list

---

#### STORY 4: Parse Flow Metadata

> As a Salesforce developer, I want to parse Flow metadata to understand automation logic

**Requirement Details:**

1. The system shall parse Flow XML metadata files (`.flow-meta.xml`)
2. The system shall extract: flow type, entry conditions, decision elements, actions, subflows, variables
3. The system shall identify dependencies: referenced objects, fields, Apex actions, subflows

**Acceptance Criteria:**

1. Given a Flow metadata file, when `sf_parse_flow` is called, then the response includes flow structure (elements, connectors, variables) and referenced objects/fields
2. Given a Screen Flow, when parsed, then screen elements and their field references are included
3. Given a Record-Triggered Flow, when parsed, then trigger conditions (object, when to run, criteria) are included

---

#### STORY 5: Parse Object/Field Definitions

> As a Salesforce developer, I want to parse Object/Field definitions to understand data model

**Requirement Details:**

1. The system shall parse Custom Object metadata (`.object-meta.xml`)
2. The system shall parse Custom Field metadata (`.field-meta.xml`)
3. The system shall extract: field types, relationships (lookup/master-detail), validation rules, record types

**Acceptance Criteria:**

1. Given an Object metadata directory, when `sf_parse_object` is called, then all fields, relationships, validation rules, and record types are returned
2. Given a relationship field, when parsed, then the related object and relationship type (lookup/master-detail) are identified
3. Given validation rules, when parsed, then the formula expression and error message are included

---

#### STORY 6: Parse LWC Components

> As a Salesforce developer, I want to parse LWC components to understand frontend structure

**Requirement Details:**

1. The system shall parse LWC component bundles (HTML template, JS controller, CSS, metadata)
2. The system shall extract: public properties (@api), tracked properties (@track), wire adapters, Apex method calls
3. The system shall identify dependencies: imported Apex classes, other LWC components, platform events

**Acceptance Criteria:**

1. Given an LWC component directory, when `sf_parse_lwc` is called, then the response includes component structure (properties, methods, wire adapters, event handlers)
2. Given an LWC that imports Apex methods, when parsed, then the imported Apex class and method names are identified
3. Given an LWC that references other components in its template, then child component dependencies are identified

---

#### STORY 7: Kiro Extension Command

> As a Salesforce developer, I want one-click indexing from Kiro IDE command palette

**Requirement Details:**

1. The extension shall register command "Kiro SDLC: Index Salesforce Project" in the command palette
2. The command shall auto-detect SFDX project root (look for `sfdx-project.json`)
3. The command shall show progress notification during indexing
4. The command shall report results via notification (success/failure with summary)
5. The command shall follow the existing "Index Workspace" command pattern in `kiro-sdlc-agents`

**Acceptance Criteria:**

1. Given Kiro IDE with an SFDX project open, when user runs "Kiro SDLC: Index Salesforce Project", then the project is indexed and results are shown
2. Given no SFDX project detected in workspace, when command is run, then an error notification explains no SFDX project found
3. Given indexing in progress, when user triggers command again, then it shows "indexing already in progress" message
4. Given successful indexing, when complete, then a notification shows: "{N} files indexed, {M} components discovered"

---

#### STORY 8: KB Search Integration

> As an AI agent, I want to search indexed Salesforce metadata in KB to provide context-aware assistance

**Requirement Details:**

1. The `sf-kb-indexer` shall store metadata using the existing `mem_ingest` tool (not a separate KB)
2. Indexed entries shall be tagged with: `salesforce`, `{metadata-type}`, `{component-name}`
3. The system shall provide `sf_kb_search` tool for Salesforce-specific queries (wraps KB search with SF-specific filters)
4. The system shall provide `sf_kb_sync` tool to check sync status (what's indexed vs what's on disk)

**Acceptance Criteria:**

1. Given an indexed SFDX project, when `sf_kb_search` is called with query "AccountService", then all KB entries related to AccountService are returned (class definition, dependencies, dependents)
2. Given an indexed project with file changes, when `sf_kb_sync` is called, then a list of out-of-sync files is returned
3. Given KB entries from SF indexing, when searched via standard `mem_search`, then SF entries are discoverable with appropriate tags

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| salesforce-ast (apex-ast) | External npm package | N/A | Core parsing library — https://github.com/dnguyenminh/apex-ast |
| @modelcontextprotocol/sdk | External npm package | N/A | MCP server framework (same as mcp-code-intelligence-nodejs) |
| mcp-code-intelligence-nodejs | Internal module | N/A | Provides `mem_ingest` KB integration endpoint |
| kiro-sdlc-agents | Internal module | N/A | VS Code/Kiro extension — hosts the new command |
| Node.js 20+ | Runtime | N/A | Required by salesforce-ast and MCP SDK |
| Tree-Sitter | Transitive dependency | N/A | Used by salesforce-ast for Apex parsing |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Duc Nguyen | Define requirements, accept deliverables | Project owner |
| Developer | Dev Agent | Implement MCP servers and extension command | Assigned |
| Architect | SA Agent | Design module structure and integration patterns | Reviewer |
| QA | QA Agent | Test MCP tools and extension command | Verifier |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `salesforce-ast` API changes breaking integration | High | Low | Pin specific version, add integration tests |
| Large SFDX projects causing memory issues during parsing | Medium | Medium | Implement streaming/chunked parsing, set memory limits |
| Tree-Sitter Apex grammar incomplete for edge cases | Medium | Medium | Graceful degradation — return partial results with warnings |
| MCP server startup time with large dependency graph | Low | Medium | Lazy-load graph, cache in SQLite |
| KB storage bloat from large projects (thousands of components) | Medium | Medium | Implement selective indexing, configurable depth |

### 5.2 Assumptions

- `salesforce-ast` npm package is stable and supports the documented API
- SFDX project structure follows standard Salesforce DX conventions
- The existing `mem_ingest` tool can handle the volume of entries from a typical SFDX project (100-500 components)
- Users have Node.js 20+ installed (same requirement as existing MCP servers)
- The 3 MCP servers can run independently or together (no hard coupling between them)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Full project indexing < 30 seconds | For a typical SFDX project (500 Apex files, 100 flows, 200 objects) |
| Performance | Individual file parse < 500ms | Single Apex class parse response time |
| Performance | Dependency query < 200ms | Graph traversal for impact analysis |
| Scalability | Support projects up to 5000 metadata components | Without degradation in query performance |
| Reliability | Graceful error handling | Partial results returned for malformed files, never crash the MCP server |
| Compatibility | Node.js 20+ | Same as existing mcp-code-intelligence-nodejs |
| Compatibility | Cross-platform | Windows, macOS, Linux (same as existing tools) |
| Maintainability | TypeScript strict mode | Consistent with existing codebase patterns |
| Maintainability | Vitest for testing | Consistent with mcp-code-intelligence-nodejs test framework |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-191 | Tích hợp salesforce-ast vào FEC_CR_Builder — 3 MCP Servers + Kiro Extension | To Do | Story | Main ticket |

---

## 8. Appendix

### MCP Server Tool Inventory

| Server | Tool Name | Description |
|--------|-----------|-------------|
| sf-parser | `sf_parse_apex` | Parse a single Apex file (class/trigger/interface) |
| sf-parser | `sf_parse_flow` | Parse a Flow metadata XML file |
| sf-parser | `sf_parse_object` | Parse Object/Field metadata |
| sf-parser | `sf_parse_lwc` | Parse LWC component bundle |
| sf-parser | `sf_scan_project` | Scan entire SFDX project structure (discovery, no deep parse) |
| sf-graph | `sf_dependencies` | Get forward dependencies of a component |
| sf-graph | `sf_dependents` | Get reverse dependencies (what depends on this) |
| sf-graph | `sf_impact_analysis` | Transitive impact analysis with configurable depth |
| sf-graph | `sf_graph_export` | Export full dependency graph (JSON/DOT format) |
| sf-kb-indexer | `sf_index_project` | Full project indexing into KB |
| sf-kb-indexer | `sf_index_file` | Index a single file into KB |
| sf-kb-indexer | `sf_kb_search` | Search KB with Salesforce-specific filters |
| sf-kb-indexer | `sf_kb_sync` | Check sync status between disk and KB |

### Module Structure (Proposed)

```
mcp-salesforce-intelligence/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── servers/
│   │   ├── sf-parser/
│   │   │   ├── index.ts          # MCP server entry point
│   │   │   └── tools/            # Tool implementations
│   │   ├── sf-graph/
│   │   │   ├── index.ts
│   │   │   └── tools/
│   │   └── sf-kb-indexer/
│   │       ├── index.ts
│   │       └── tools/
│   ├── shared/
│   │   ├── types.ts              # Shared TypeScript types
│   │   ├── sfdx-detector.ts      # SFDX project detection
│   │   └── kb-client.ts          # KB integration (calls mem_ingest)
│   └── index.ts                  # Multi-server launcher
├── tests/
│   ├── sf-parser.test.ts
│   ├── sf-graph.test.ts
│   └── sf-kb-indexer.test.ts
└── README.md
```

### Glossary

| Term | Definition |
|------|------------|
| SFDX | Salesforce DX — Salesforce's developer experience platform and CLI |
| Apex | Salesforce's proprietary programming language (Java-like, runs on Force.com) |
| LWC | Lightning Web Components — Salesforce's modern frontend framework |
| Flow | Salesforce's declarative automation tool (visual process builder) |
| MCP | Model Context Protocol — standard for AI tool integration |
| Tree-Sitter | Incremental parsing library for programming languages |
| KB | Knowledge Base — local SQLite-based storage in mcp-code-intelligence |
| Impact Analysis | Determining all components affected by a change to a given component |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| salesforce-ast GitHub | https://github.com/dnguyenminh/apex-ast |
| MCP SDK Documentation | https://modelcontextprotocol.io |
| Existing MCP Server | `mcp-code-intelligence-nodejs/` in this repo |
| Kiro Extension | `kiro-sdlc-agents/` in this repo |
| Salesforce Metadata API | https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/ |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

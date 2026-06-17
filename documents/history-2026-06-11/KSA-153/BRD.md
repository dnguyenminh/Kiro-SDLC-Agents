# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-153: [Graph] Data Model & Storage - relationships table

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-153 |
| Title | [Graph] Data Model & Storage - relationships table |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-28 | BA Agent | Initial document — auto-generated from Jira ticket KSA-153 |

---

## 1. Introduction

### 1.1 Scope

Design and implement the graph data model for code relationships. This includes:
- Adding a `relationships` table to SQLite storing edges between symbols (calls, imports, inherits, implements)
- Enhancing the `symbols` table with additional columns (parameters, return_type, parent_symbol_id, decorators, complexity, is_async)
- Providing the storage foundation for call graph (KSA-154), dependency graph, and impact analysis tools

This is the **data layer foundation** for the entire Graph Engine sub-epic.

### 1.2 Out of Scope

- Tree-sitter parsing implementation (KSA-145)
- Language-specific relationship extraction logic (KSA-146+)
- Call graph query tools (KSA-154)
- AI context tools (KSA-158)
- Graph visualization or UI
- RocksDB or alternative storage engines (staying with SQLite)

### 1.3 Preliminary Requirements

- Existing SQLite database with symbols table (current schema)
- Understanding of relationship types from CodeGraph analysis
- Tree-sitter core integration (KSA-145) for populating enhanced symbol data

---

## 2. Business Requirements

### 2.1 High Level Process Map

The current system stores only flat symbol data (name, kind, file, line). There is **no relationship data** — no way to know which function calls which, what imports what, or class inheritance hierarchies.

The graph data model adds:
- **Relationships table**: Directed edges between symbols (source → target) with kind labels
- **Enhanced symbols table**: Rich metadata enabling graph queries
- **Indexes**: Optimized for graph traversal patterns (callers, callees, imports, inheritance)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a developer, I want a relationships table storing code edges so that graph queries can find callers/callees | MUST HAVE | KSA-153 |
| 2 | As a developer, I want enhanced symbol metadata so that graph nodes carry rich information | MUST HAVE | KSA-153 |
| 3 | As a developer, I want efficient indexes for graph traversal so that queries complete in sub-100ms | MUST HAVE | KSA-153 |
| 4 | As a developer, I want relationship kinds (calls/imports/inherits/implements) so that different graph queries are possible | MUST HAVE | KSA-153 |
| 5 | As a developer, I want incremental relationship updates so that re-indexing a file only updates its edges | SHOULD HAVE | KSA-153 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Tree-sitter parser extracts symbols AND relationships from source file

**Step 2:** Extracted relationships are stored in `relationships` table with source/target/kind

**Step 3:** Enhanced symbol metadata (params, return type, complexity) stored in `symbols` table

**Step 4:** Graph query tools (KSA-154) traverse relationships table to answer caller/callee queries

**Step 5:** AI context tools (KSA-158) use graph data to provide intent-aware context

---

#### STORY 1: Relationships Table

> As a developer, I want a relationships table storing code edges so that graph queries can find callers/callees, imports, and inheritance chains.

**Requirement Details:**

1. Create `relationships` table in SQLite with the following schema
2. Each row represents a directed edge: source_symbol → target_symbol
3. Support multiple relationship kinds per source-target pair
4. Store file_path and line for each relationship (where the reference occurs)

**Data Fields (relationships table):**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| id | integer | Yes | Primary key, auto-increment | `1` |
| source_symbol_id | integer | Yes | FK to symbols.id (caller/importer) | `42` |
| target_symbol | string | Yes | Target symbol qualified name | `utils.parseJSON` |
| target_symbol_id | integer | No | FK to symbols.id (if resolved) | `87` |
| kind | string | Yes | Relationship type | `calls`, `imports`, `inherits`, `implements` |
| file_path | string | Yes | File where relationship occurs | `src/parser.ts` |
| line | integer | Yes | Line number of reference | `25` |
| metadata | string | No | JSON extra data (e.g., import alias) | `{"alias": "pj"}` |

**Relationship Kinds:**

| Kind | Description | Example |
|------|-------------|---------|
| `calls` | Function/method invocation | `parseFile()` calls `readFile()` |
| `imports` | Module/symbol import | `import { readFile } from 'fs'` |
| `inherits` | Class inheritance | `class Dog extends Animal` |
| `implements` | Interface implementation | `class UserService implements IService` |
| `uses` | Type usage (parameter, return, field) | `function foo(x: Bar)` uses `Bar` |
| `decorates` | Decorator application | `@Injectable() class Service` |

**Acceptance Criteria:**

1. `relationships` table created with all specified columns
2. Foreign key constraint on `source_symbol_id` referencing `symbols.id`
3. Composite index on `(source_symbol_id, kind)` for efficient caller queries
4. Composite index on `(target_symbol, kind)` for efficient callee queries
5. Index on `(file_path)` for efficient file-level relationship deletion on re-index
6. Supports 100K+ relationships without performance degradation

---

#### STORY 2: Enhanced Symbol Metadata

> As a developer, I want enhanced symbol metadata so that graph nodes carry rich information for AI context.

**Requirement Details:**

1. Add new nullable columns to existing `symbols` table
2. No breaking changes to existing queries
3. Migration script handles schema upgrade

**New Columns (symbols table):**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| parameters | string | No | Parameter list with types | `(path: string, encoding?: string)` |
| return_type | string | No | Return type annotation | `Promise<Buffer>` |
| parent_symbol_id | integer | No | FK to parent symbol (method→class) | `42` |
| decorators | string | No | JSON array of decorators | `["@Injectable", "@Singleton"]` |
| complexity | integer | No | Cyclomatic complexity score | `7` |
| is_async | boolean | No | Whether symbol is async | `true` |
| is_exported | boolean | No | Whether symbol is exported | `true` |
| doc_comment | string | No | JSDoc/docstring content | `/** Parses a file */` |
| start_line | integer | No | First line of symbol body | `10` |
| end_line | integer | No | Last line of symbol body | `45` |

**Acceptance Criteria:**

1. All new columns added as nullable (ALTER TABLE, no data loss)
2. Existing queries continue working without modification
3. Migration script is idempotent (safe to run multiple times)
4. `parent_symbol_id` enables method→class hierarchy queries

---

#### STORY 3: Efficient Graph Indexes

> As a developer, I want efficient indexes for graph traversal so that queries complete in sub-100ms even with 100K+ relationships.

**Requirement Details:**

1. Create indexes optimized for common graph query patterns
2. Benchmark with realistic data volumes (100K symbols, 500K relationships)

**Required Indexes:**

| Index | Columns | Purpose |
|-------|---------|---------|
| idx_rel_source | (source_symbol_id, kind) | Find all outgoing edges from a symbol |
| idx_rel_target | (target_symbol, kind) | Find all incoming edges to a symbol |
| idx_rel_file | (file_path) | Delete all relationships for a file on re-index |
| idx_sym_parent | (parent_symbol_id) | Find all methods of a class |
| idx_sym_file_kind | (file_path, kind) | Find all symbols of a kind in a file |

**Acceptance Criteria:**

1. All indexes created in migration script
2. Query for callers of a symbol completes in <50ms with 100K relationships
3. Query for callees of a symbol completes in <50ms with 100K relationships
4. File re-index (delete + re-insert relationships) completes in <100ms per file

---

#### STORY 4: Relationship Kind Taxonomy

> As a developer, I want well-defined relationship kinds so that different graph queries can filter by edge type.

**Acceptance Criteria:**

1. Relationship kinds are defined as constants/enum in code
2. Invalid kind values rejected on insert
3. Graph query tools can filter by single kind or multiple kinds
4. Documentation lists all supported kinds with examples

---

#### STORY 5: Incremental Relationship Updates

> As a developer, I want incremental relationship updates so that re-indexing a file only updates its edges without full graph rebuild.

**Acceptance Criteria:**

1. Re-indexing a single file only affects relationships from that file
2. Delete + re-insert wrapped in SQLite transaction
3. Dangling `target_symbol_id` references handled (set to NULL or lazy-resolve)
4. Full re-index of 1000 files completes in <30 seconds

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Existing SQLite database | System | N/A | Current symbols table to extend |
| Tree-sitter core (KSA-145) | System | KSA-145 | Provides parsed AST for relationship extraction |
| Language parsers (KSA-146+) | System | KSA-146 | Populate relationships from parsed code |
| SQLite WAL mode | Infrastructure | N/A | Required for concurrent read/write |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve schema design |
| Developer | Code Intelligence Team | Implement schema + migration |
| QA | QA Team | Verify data integrity and performance |
| Downstream | Graph query tools (KSA-154) | Consume relationship data |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Schema migration breaks existing data | High | Low | Backup before migration, additive-only changes |
| Performance degradation with large graphs | Medium | Medium | Proper indexing, benchmark with realistic data |
| Unresolved target_symbol references | Low | High | Use string-based target_symbol as primary, ID as optional |
| SQLite file size growth | Low | Medium | Monitor, consider VACUUM schedule |

### 5.2 Assumptions

- SQLite can handle 500K+ relationships with proper indexing
- WAL mode provides sufficient concurrency for read-during-write
- String-based target_symbol matching is acceptable (vs. requiring all targets resolved to IDs)
- Schema migration can be run without full re-index of existing symbols

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Graph query <50ms | For single-hop caller/callee queries |
| Performance | File re-index <100ms | Delete + re-insert relationships per file |
| Scalability | 500K+ relationships | Without performance degradation |
| Reliability | Atomic updates | Transaction-wrapped file re-index |
| Data Integrity | FK constraints | source_symbol_id references symbols.id |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-153 | [Graph] Data Model & Storage | To Do | Task | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | To Do | Epic | Parent epic |
| KSA-145 | [Tree-sitter] Core Integration | To Do | Task | Provides parsed data |
| KSA-146 | [Tree-sitter] TypeScript/JavaScript Parser | To Do | Task | Populates relationships |
| KSA-154 | [Graph] Call Graph | To Do | Task | Consumes relationship data |
| KSA-158 | [AI Context] get_ai_context | To Do | Task | Uses graph for context |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Graph | Data structure of nodes (symbols) and edges (relationships) |
| Edge | Directed connection between two symbols (e.g., calls, imports) |
| Transitive | Following edges recursively (caller of caller of caller...) |
| WAL | Write-Ahead Logging — SQLite mode for concurrent access |
| FK | Foreign Key — referential integrity constraint |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| SQLite FTS5 documentation | https://www.sqlite.org/fts5.html |
| Current schema | src/database/schema.sql |

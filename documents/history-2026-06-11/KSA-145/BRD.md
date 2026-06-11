# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-145: [Tree-sitter] Core Integration - tree-sitter bindings for Node.js

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-145 |
| Title | [Tree-sitter] Core Integration - tree-sitter bindings for Node.js |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-28 | BA Agent | Initial document — auto-generated from Jira ticket KSA-145 |

---

## 1. Introduction

### 1.1 Scope

This ticket covers the integration of tree-sitter npm package into `mcp-code-intelligence-nodejs` to replace the current regex-based symbol extraction (`extractSymbols()`) with AST-based parsing. This is the **foundation ticket** for the entire Tree-sitter Migration sub-epic — all language-specific parsers (KSA-146, KSA-147, etc.) depend on this infrastructure.

**Key deliverables:**
- Tree-sitter npm package integration and parser infrastructure
- Language grammar loading mechanism (dynamic, per-language)
- AST traversal utilities for symbol extraction
- Replacement of regex-based `extractSymbols()` with tree-sitter AST parsing
- Base parser interface that language-specific parsers will implement

### 1.2 Out of Scope

- Language-specific parser implementations (TypeScript/JS → KSA-146, Python → separate ticket)
- Relationship extraction (calls, imports, inheritance → KSA-153)
- Graph storage and query tools (KSA-153, KSA-154)
- AI context tools (KSA-158)
- Security static analysis tools
- Embedding model changes

### 1.3 Preliminary Requirements

- Node.js >= 18 (tree-sitter npm package requirement)
- Existing `mcp-code-intelligence-nodejs` codebase with current regex-based extraction
- npm/yarn package manager access for tree-sitter dependencies

---

## 2. Business Requirements

### 2.1 High Level Process Map

The current code intelligence system uses regex patterns (~150 lines) to extract symbols from source code. This approach:
- Extracts only names (no parameters, return types, decorators)
- Cannot detect relationships (calls, imports, inheritance)
- Has no complexity analysis capability
- Fails on complex syntax (nested functions, decorators, generics)

Tree-sitter integration replaces this with AST-based parsing that provides:
- Full symbol extraction with metadata (params, return types, modifiers)
- Foundation for relationship extraction
- Foundation for complexity analysis
- Accurate parsing regardless of code complexity

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a developer, I want code symbols extracted with full metadata (parameters, return types, modifiers) so that AI agents have richer context | MUST HAVE | KSA-145 |
| 2 | As a developer, I want tree-sitter grammars loaded dynamically so that new languages can be added without code changes | MUST HAVE | KSA-145 |
| 3 | As a developer, I want AST traversal utilities so that language-specific parsers can be implemented consistently | MUST HAVE | KSA-145 |
| 4 | As a developer, I want backward-compatible symbol output so that existing tools (code_search, code_symbols) continue working | MUST HAVE | KSA-145 |
| 5 | As a developer, I want parsing performance of 10ms per file or less so that indexing remains fast | SHOULD HAVE | KSA-145 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer opens/modifies a source file in the workspace

**Step 2:** Code intelligence indexer detects file change (mtime + hash)

**Step 3:** Tree-sitter parser infrastructure loads appropriate grammar for file extension

**Step 4:** File is parsed into AST using tree-sitter

**Step 5:** AST traversal utilities walk the tree, extracting symbols with full metadata

**Step 6:** Extracted symbols are stored in SQLite (symbols table with enhanced columns)

**Step 7:** MCP tools (code_search, code_symbols, code_context) serve enriched data to AI agents

---

#### STORY 1: Full Metadata Symbol Extraction

> As a developer, I want code symbols extracted with full metadata (parameters, return types, modifiers) so that AI agents have richer context for code understanding.

**Requirement Details:**

1. Replace `extractSymbols()` regex-based extraction with tree-sitter AST parsing
2. Extract the following metadata per symbol:
   - Name, kind (function/class/method/interface/etc.)
   - Parameters with types (where available)
   - Return type (where available)
   - Modifiers (async, static, abstract, export, etc.)
   - Decorators/annotations
   - Parent symbol (for methods inside class)
   - Line range (start_line, end_line)
   - Documentation/comments (JSDoc, docstrings)
3. Maintain backward compatibility with existing symbol schema

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| name | string | Yes | Symbol name | `parseFile` |
| kind | string | Yes | Symbol type | `function`, `class`, `method` |
| parameters | string | No | Parameter list with types | `(filePath: string, options?: ParseOptions)` |
| return_type | string | No | Return type annotation | `Promise<Symbol[]>` |
| modifiers | string[] | No | Modifiers/keywords | `["async", "export"]` |
| decorators | string[] | No | Decorators/annotations | `["@deprecated"]` |
| parent_symbol_id | integer | No | FK to parent symbol | `42` (class ID) |
| start_line | integer | Yes | First line of symbol | `15` |
| end_line | integer | Yes | Last line of symbol | `45` |
| complexity | integer | No | Cyclomatic complexity | `5` |
| is_async | boolean | No | Whether symbol is async | `true` |

**Acceptance Criteria:**

1. Tree-sitter parses files and extracts symbols with parameters, return types, and modifiers
2. Existing `code_symbols` and `code_search` tools return enriched data without breaking changes
3. Symbol extraction covers at minimum: functions, classes, methods, interfaces, type aliases
4. Parsing a single file completes in 10ms or less for files under 1000 lines
5. Graceful fallback to regex extraction if tree-sitter grammar is unavailable for a language

---

#### STORY 2: Dynamic Grammar Loading

> As a developer, I want tree-sitter grammars loaded dynamically so that new languages can be added by installing grammar packages without code changes.

**Requirement Details:**

1. Implement grammar registry that maps file extensions to tree-sitter grammar packages
2. Grammars loaded lazily on first use (not all at startup)
3. Support adding new languages via configuration (no code change required)
4. Grammar packages installed as npm dependencies (`tree-sitter-typescript`, `tree-sitter-python`, etc.)

**Configuration:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| language | string | Yes | Language identifier | `typescript` |
| extensions | string[] | Yes | File extensions | `[".ts", ".tsx"]` |
| grammar_package | string | Yes | npm package name | `tree-sitter-typescript` |
| parser_module | string | No | Custom parser module path | `./parsers/typescript` |

**Acceptance Criteria:**

1. Grammar registry correctly maps `.ts` to TypeScript, `.py` to Python, `.kt` to Kotlin, etc.
2. Grammars are loaded lazily — startup time not affected by number of registered languages
3. Missing grammar for a file extension falls back to regex extraction with warning log
4. New language can be added by: (a) installing grammar npm package, (b) adding config entry

---

#### STORY 3: AST Traversal Utilities

> As a developer, I want AST traversal utilities so that language-specific parsers can be implemented consistently using shared infrastructure.

**Requirement Details:**

1. Provide base `TreeSitterParser` class/interface that language parsers extend
2. Utility functions for common AST operations:
   - `walkTree(node, visitor)` — depth-first traversal with visitor pattern
   - `findNodes(node, type)` — find all nodes of a given type
   - `getNodeText(node)` — extract source text for a node
   - `getNodeRange(node)` — get line/column range
   - `getParentOfType(node, type)` — walk up to find parent of specific type
3. Standard symbol output format that all language parsers produce

**Acceptance Criteria:**

1. Base `TreeSitterParser` interface defined with `parse(source, filePath)` method
2. At least 5 utility functions available for AST traversal
3. Language-specific parsers (KSA-146+) can extend base class and use utilities
4. Unit tests cover all utility functions with sample AST nodes

---

#### STORY 4: Backward Compatibility

> As a developer, I want backward-compatible symbol output so that existing MCP tools continue working without changes.

**Requirement Details:**

1. New tree-sitter extraction produces output compatible with existing SQLite schema
2. Existing fields (name, kind, file_path, line, signature) remain unchanged
3. New fields (parameters, return_type, parent_symbol_id, etc.) are additive — nullable columns
4. Migration script adds new columns to symbols table without data loss

**Acceptance Criteria:**

1. All existing MCP tools (code_search, code_symbols, code_context) work without modification
2. SQLite migration adds new columns as nullable (no breaking change)
3. Symbols extracted by tree-sitter pass same validation as regex-extracted symbols
4. Integration tests verify tool output format unchanged

---

#### STORY 5: Performance Requirements

> As a developer, I want parsing performance of 10ms per file or less so that indexing remains fast for large codebases.

**Requirement Details:**

1. Single file parse: 10ms or less for files under 1000 lines
2. Batch indexing: 60 files/sec or more (matching CodeGraph benchmark)
3. Memory usage: tree-sitter parser instances reused (not created per file)
4. Grammar loading: one-time cost per language, cached for session

**Acceptance Criteria:**

1. Benchmark test shows single file parse in 10ms or less (1000-line TypeScript file)
2. Batch indexing of 100 files completes in 2 seconds or less
3. Memory usage does not grow linearly with number of files parsed
4. Parser instances are pooled/reused across files of same language

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| tree-sitter npm package | External | N/A | Core parsing library (MIT license) |
| tree-sitter-typescript | External | KSA-146 | TypeScript/JavaScript grammar |
| tree-sitter-python | External | Future | Python grammar |
| SQLite schema migration | System | KSA-153 | Enhanced symbols table columns |
| Existing extractSymbols() | System | N/A | Must maintain fallback compatibility |
| Node.js >= 18 | Infrastructure | N/A | Required for tree-sitter native bindings |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve requirements, prioritize |
| Developer | Code Intelligence Team | Implement tree-sitter integration |
| QA | QA Team | Verify parsing accuracy and performance |
| Users | AI Agent developers | Consume enriched symbol data |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Tree-sitter native bindings fail on some platforms | High | Low | Provide WASM fallback option |
| Performance regression during migration | Medium | Medium | Benchmark before/after, keep regex fallback |
| Grammar packages have breaking updates | Medium | Low | Pin versions, test in CI |
| Large files (>10K lines) cause memory issues | Medium | Low | Implement file size limit with fallback |

### 5.2 Assumptions

- Tree-sitter npm package is stable and well-maintained (MIT, 10K+ GitHub stars)
- Node.js native addon compilation works in target environments
- Existing SQLite schema can be extended without full re-index
- Language-specific parsers will be implemented in subsequent tickets

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Single file parse 10ms or less | For files under 1000 lines |
| Performance | Batch indexing 60 files/sec or more | Matching CodeGraph benchmark |
| Reliability | Graceful fallback | If grammar unavailable, use regex extraction |
| Compatibility | Node.js 18+ | Required for native bindings |
| Maintainability | Plugin architecture | New languages added via config, not code |
| Memory | Parser instance reuse | Pool parsers per language |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-145 | [Tree-sitter] Core Integration | To Do | Task | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | To Do | Epic | Parent epic |
| KSA-146 | [Tree-sitter] TypeScript/JavaScript Parser | To Do | Task | Depends on KSA-145 |
| KSA-153 | [Graph] Data Model & Storage | To Do | Task | Related (schema changes) |
| KSA-154 | [Graph] Call Graph | To Do | Task | Depends on KSA-145 + KSA-153 |
| KSA-158 | [AI Context] get_ai_context | To Do | Task | Depends on graph engine |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Tree-sitter | Incremental parsing library that builds concrete syntax trees |
| AST | Abstract Syntax Tree — structured representation of source code |
| Grammar | Language-specific parsing rules for tree-sitter |
| Symbol | Named code entity (function, class, method, variable, etc.) |
| MCP | Model Context Protocol — communication protocol for AI tools |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| Tree-sitter documentation | https://tree-sitter.github.io/tree-sitter/ |
| tree-sitter npm package | https://www.npmjs.com/package/tree-sitter |
| Current extractSymbols() | src/indexer/extractor.ts |

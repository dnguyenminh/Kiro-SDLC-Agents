# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-178: [Python] Tree-sitter Core + Parsers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-178 |
| Title | [Python] Tree-sitter Core + Parsers |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Parent Epic | KSA-171 |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | BA Agent | Initiate document from Jira ticket KSA-178 |

---

## 1. Introduction

### 1.1 Scope

This document covers the Python implementation of tree-sitter parsing infrastructure — the foundational layer (Batch P1) of the Code Intelligence v2 Feature Parity Sync (Python track). This includes:

- Python bindings for tree-sitter via `py-tree-sitter` (ctypes/cffi-based)
- Parser initialization and management for 12 programming languages
- AST construction matching the nodejs v2 reference output exactly
- Symbol extraction (functions, classes, interfaces, methods, variables)
- Incremental parsing for efficient file change handling

This is the first batch in the Python track and serves as the foundation for all downstream Python-track features (Graph Engine, AI Context, Code Quality, Security Analysis, Similarity).

### 1.2 Out of Scope

- Graph engine construction (Python track — future ticket)
- AI context tools (Python track — future ticket)
- Code quality analysis (Python track — future ticket)
- Security analysis (Python track — future ticket)
- Similarity detection (Python track — future ticket)
- Kotlin track implementation (KSA-172 — separate track)
- UI/frontend components (KSA-170)
- Changes to the nodejs reference implementation (KSA-144)
- CI/CD pipeline setup for Python builds

### 1.3 Preliminary Requirements

| Prerequisite | Description | Status |
|-------------|-------------|--------|
| KSA-144 Batch 1 | nodejs v2 Foundation + Parsers must be complete | In Progress |
| py-tree-sitter | Python bindings for tree-sitter (ctypes/cffi) | Available (PyPI) |
| Python 3.11+ | Minimum Python runtime | Available |
| Poetry/pip | Package management | Available |
| Test fixtures | Shared test fixtures from nodejs v2 | Available from KSA-144 |
| KSA-172 | Kotlin track reference (parallel implementation) | In Progress |

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Tree-sitter Core + Parsers module provides the foundational parsing layer for the Python track:

1. **Initialization**: Load tree-sitter native libraries and language grammars via py-tree-sitter (ctypes/cffi)
2. **Parsing**: Convert source code files into Abstract Syntax Trees (ASTs)
3. **Symbol Extraction**: Extract code symbols (functions, classes, methods) from ASTs
4. **Incremental Updates**: Re-parse only changed portions of files for efficiency
5. **Output**: Provide AST and symbol data to downstream consumers (Graph Engine, etc.)

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a Python developer, I want to parse source files into ASTs using tree-sitter in Python so that downstream analysis tools have structured code data | MUST HAVE | KSA-178 |
| 2 | As a Python developer, I want support for 12 programming languages so that the tool works with polyglot projects | MUST HAVE | KSA-178 |
| 3 | As a Python developer, I want AST output matching the nodejs reference so that cross-platform consistency is maintained | MUST HAVE | KSA-178 |
| 4 | As a Python developer, I want incremental parsing so that file edits are processed efficiently without full re-parse | SHOULD HAVE | KSA-178 |
| 5 | As a Python developer, I want symbol extraction from ASTs so that I can query functions, classes, and methods | MUST HAVE | KSA-178 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer opens a project in an MCP-compatible IDE or invokes the Python Code Intelligence library

**Step 2:** The Python Code Intelligence library initializes, loading tree-sitter via py-tree-sitter bindings

**Step 3:** Language grammars are loaded for detected project languages

**Step 4:** Source files are parsed into ASTs on demand or in batch

**Step 5:** Symbols are extracted from ASTs and indexed for fast lookup

**Step 6:** When files change, incremental parsing updates only affected AST nodes

**Step 7:** Downstream tools (Graph Engine, AI Context) consume AST and symbol data

---

#### STORY 1: Parse Source Files into ASTs

> As a Python developer, I want to parse source files into ASTs using tree-sitter in Python so that downstream analysis tools have structured code data

**Requirement Details:**

1. Initialize tree-sitter runtime in Python via py-tree-sitter (ctypes/cffi bindings)
2. Load language grammar shared-library files for each supported language
3. Parse source code string or file into a tree-sitter Tree object
4. Convert tree-sitter Tree into a platform-agnostic AST representation (dict/dataclass)
5. Handle parse errors gracefully (partial AST with error nodes marked)
6. Support concurrent parsing of multiple files (thread-safe or multiprocessing)

**Acceptance Criteria:**

1. Parser initializes without errors on Python 3.11+
2. All 12 language grammars load successfully
3. Parsing a valid source file produces a complete AST with no error nodes
4. Parsing an invalid source file produces a partial AST with error nodes clearly marked
5. Concurrent parsing of 10 files simultaneously completes without data corruption
6. Performance: parsing a 10K LOC file completes in < 500ms

---

#### STORY 2: Support 12 Programming Languages

> As a Python developer, I want support for 12 programming languages so that the tool works with polyglot projects

**Requirement Details:**

1. TypeScript parser with JSX/TSX support
2. JavaScript parser with ES2024 syntax
3. Python parser (3.x syntax)
4. Java parser (17+ syntax)
5. Kotlin parser (1.9+ syntax)
6. Go parser (1.21+ syntax)
7. Rust parser (2021 edition)
8. C# parser (.NET 8 syntax)
9. Ruby parser (3.x syntax)
10. PHP parser (8.x syntax)
11. Swift parser (5.9+ syntax)
12. Scala parser (3.x syntax)

**Acceptance Criteria:**

1. Each language parser correctly parses its respective language's standard library samples
2. Language detection from file extension works correctly
3. Each parser handles language-specific edge cases (decorators, generics, macros)
4. Grammar versions are pinned and reproducible across builds

---

#### STORY 3: AST Output Matching nodejs Reference

> As a Python developer, I want AST output matching the nodejs reference so that cross-platform consistency is maintained

**Requirement Details:**

1. AST node types must match nodejs v2 naming conventions exactly
2. Tree traversal order (pre-order, post-order) must produce identical sequences
3. Node metadata (start/end positions, byte offsets) must be consistent
4. Named vs anonymous node classification must match
5. Field names on nodes must match the nodejs representation

**Acceptance Criteria:**

1. For each test fixture file, Python AST JSON output matches nodejs AST JSON output exactly
2. Node type names are identical (no renaming or aliasing)
3. Position information (row, column, byte offset) matches within tolerance of 0
4. Tree traversal produces identical node sequences
5. At least 50 test fixture files across all 12 languages pass comparison

---

#### STORY 4: Incremental Parsing

> As a Python developer, I want incremental parsing so that file edits are processed efficiently without full re-parse

**Requirement Details:**

1. Track file edit operations (insert, delete, replace) with byte ranges
2. Apply edits to existing tree-sitter Tree for incremental re-parse
3. Only re-parse affected subtrees, preserving unchanged portions
4. Detect when incremental parse is not possible and fall back to full parse
5. Maintain parse tree validity after incremental updates

**Acceptance Criteria:**

1. Single-character edit re-parses in < 10ms for files up to 10K LOC
2. Multi-line edit (< 50 lines) re-parses in < 50ms
3. Incremental parse produces identical AST to full re-parse of the edited file
4. Memory usage does not grow unboundedly with repeated incremental edits
5. Fallback to full parse triggers correctly when edit exceeds 30% of file

---

#### STORY 5: Symbol Extraction

> As a Python developer, I want symbol extraction from ASTs so that I can query functions, classes, and methods

**Requirement Details:**

1. Extract function declarations (name, parameters, return type, visibility)
2. Extract class declarations (name, superclasses, interfaces, visibility)
3. Extract interface/protocol declarations (name, methods, properties)
4. Extract method declarations (name, class, parameters, return type, visibility)
5. Extract variable/constant declarations (name, type, scope)
6. Extract import/export statements
7. Build symbol table with scope hierarchy (module -> class -> method -> block)
8. Support language-specific constructs (Python decorators, Kotlin extensions, etc.)

**Acceptance Criteria:**

1. Symbol extraction produces identical results to nodejs for same input files
2. All symbol types (function, class, interface, method, variable) are correctly classified
3. Scope hierarchy is correctly built (nested classes, inner functions)
4. Language-specific constructs are handled (Python `__init__`, decorators, `@property`)
5. Performance: symbol extraction for 1000-file project completes in < 3s

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| KSA-144 Batch 1 | System | KSA-144 | nodejs v2 parsers as reference implementation |
| KSA-171 | System | KSA-171 | Parent epic defining overall parity strategy |
| KSA-172 | System | KSA-172 | Kotlin track parallel implementation (reference) |
| py-tree-sitter | External | N/A | Python bindings for tree-sitter (PyPI package) |
| tree-sitter native | External | N/A | tree-sitter C library (bundled with py-tree-sitter) |
| Language grammars | External | N/A | tree-sitter grammar wheels for 12 languages (tree-sitter-languages) |
| Test fixtures | System | KSA-144 | Shared test fixture files from nodejs v2 |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Duc Nguyen Minh | Prioritize features, accept deliverables |
| Tech Lead | Duc Nguyen Minh | Architecture decisions, code review |
| Developer | Dev Team | Implementation of Python parsers |
| QA | QA Team | Testing and cross-platform verification |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| py-tree-sitter API instability between versions | High | Low | Pin version in pyproject.toml; test against specific version |
| GIL limiting true parallelism for parsing | Medium | High | Use multiprocessing for CPU-bound parsing; or release GIL in C extension |
| Grammar wheel availability for all platforms | Medium | Medium | Pre-build wheels for linux-x64, macos-arm64, windows-x64; fallback to source build |
| AST structure divergence from nodejs | High | Low | Strict test fixtures comparing output; automated CI comparison |
| Memory leaks in ctypes/cffi bindings | Medium | Medium | Explicit resource cleanup; context managers; weak references |
| Performance regression vs Kotlin/nodejs | Medium | Medium | Benchmark suite in CI; alert on > 10% regression |
| Python version compatibility (3.11 vs 3.12 vs 3.13) | Low | Medium | Test matrix across supported versions |

### 5.2 Assumptions

- KSA-144 Batch 1 nodejs implementation is the single source of truth for AST structure
- py-tree-sitter provides stable ctypes/cffi bindings for tree-sitter
- All 12 language grammars are available as pre-compiled wheels or shared libraries
- Python 3.11+ is the minimum supported runtime
- Poetry is the package manager (with pyproject.toml)
- pytest is the test framework
- Test fixtures from nodejs v2 are directly reusable (JSON comparison)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Parsing < 500ms per 10K LOC file | Single-file parse speed |
| Performance | Batch parsing 1000 files < 30s | Full project initial parse |
| Performance | Incremental parse < 10ms for single edit | Re-parse after character edit |
| Performance | Symbol extraction < 3s for 1000 files | Full project symbol index |
| Memory | < 2GB RSS for 1000-file project | AST + symbol table in memory |
| Compatibility | Python 3.11, 3.12, 3.13 supported | Minimum and latest versions |
| Compatibility | Linux x64, macOS arm64, Windows x64 | Native library platforms |
| Reliability | Graceful degradation on parse failure | Return partial AST with error markers |
| Accuracy | AST parity > 99% with nodejs reference | Measured by test fixture comparison |
| Thread Safety | Concurrent parsing without corruption | Via multiprocessing or GIL-aware design |
| Packaging | Distributable as PyPI wheel | pip install mcp-code-intelligence |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-178 | [Python] Tree-sitter Core + Parsers | Story | Main ticket |
| KSA-171 | Code Intelligence v2 — Feature Parity Sync | Epic | Parent epic |
| KSA-144 | mcp-code-intelligence-nodejs v2 | Epic | Reference implementation |
| KSA-172 | [Kotlin] Tree-sitter Core + Parsers | Story | Parallel track (Kotlin) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| AST | Abstract Syntax Tree — structured representation of parsed source code |
| py-tree-sitter | Python bindings for tree-sitter (uses ctypes/cffi internally) |
| ctypes/cffi | Python mechanisms for calling native C libraries |
| Tree-sitter | Incremental parsing library that builds concrete syntax trees |
| Grammar | Language-specific parsing rules for tree-sitter |
| Symbol | Named code entity (function, class, method, variable) |
| Incremental Parsing | Re-parsing only changed portions of a file |
| MCP | Model Context Protocol — interface for AI tool integration |
| GIL | Global Interpreter Lock — Python threading limitation |
| PyPI | Python Package Index — package distribution platform |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-172: [Kotlin] Tree-sitter Core + Parsers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-172 |
| Title | [Kotlin] Tree-sitter Core + Parsers |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Parent Epic | KSA-171 |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | BA Agent | Initiate document from Jira ticket KSA-172 |

---

## 1. Introduction

### 1.1 Scope

This document covers the Kotlin/JVM implementation of tree-sitter parsing infrastructure — the foundational layer (Batch K1) of the Code Intelligence v2 Feature Parity Sync. This includes:

- JVM bindings for tree-sitter (via JNI or tree-sitter-kotlin)
- Parser initialization and management for 12 programming languages
- AST construction matching the nodejs v2 reference output exactly
- Symbol extraction (functions, classes, interfaces, methods, variables)
- Incremental parsing for efficient file change handling

This is the first batch in the Kotlin track and serves as the foundation for all downstream features (Graph Engine, AI Context, Code Quality, Security Analysis, Similarity).

### 1.2 Out of Scope

- Graph engine construction (KSA-173)
- AI context tools (KSA-174)
- Code quality analysis (KSA-175)
- Security analysis (KSA-176)
- Similarity detection (KSA-177)
- Python track implementation (KSA-178)
- UI/frontend components (KSA-170)
- Changes to the nodejs reference implementation (KSA-144)
- CI/CD pipeline setup for Kotlin builds

### 1.3 Preliminary Requirements

| Prerequisite | Description | Status |
|-------------|-------------|--------|
| KSA-144 Batch 1 | nodejs v2 Foundation + Parsers must be complete | In Progress |
| tree-sitter JVM bindings | JNI wrapper or tree-sitter-kotlin library | Available |
| Kotlin/JVM toolchain | Kotlin 1.9+, JDK 17+ | Available |
| Gradle build system | Build configuration for multi-module project | Available |
| Test fixtures | Shared test fixtures from nodejs v2 | Available from KSA-144 |

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Tree-sitter Core + Parsers module provides the foundational parsing layer:

1. **Initialization**: Load tree-sitter native libraries and language grammars via JNI
2. **Parsing**: Convert source code files into Abstract Syntax Trees (ASTs)
3. **Symbol Extraction**: Extract code symbols (functions, classes, methods) from ASTs
4. **Incremental Updates**: Re-parse only changed portions of files for efficiency
5. **Output**: Provide AST and symbol data to downstream consumers (Graph Engine, etc.)

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a Kotlin developer, I want to parse source files into ASTs using tree-sitter on JVM so that downstream analysis tools have structured code data | MUST HAVE | KSA-172 |
| 2 | As a Kotlin developer, I want support for 12 programming languages so that the tool works with polyglot projects | MUST HAVE | KSA-172 |
| 3 | As a Kotlin developer, I want AST output matching the nodejs reference so that cross-platform consistency is maintained | MUST HAVE | KSA-172 |
| 4 | As a Kotlin developer, I want incremental parsing so that file edits are processed efficiently without full re-parse | SHOULD HAVE | KSA-172 |
| 5 | As a Kotlin developer, I want symbol extraction from ASTs so that I can query functions, classes, and methods | MUST HAVE | KSA-172 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer opens a project in an MCP-compatible IDE

**Step 2:** The Kotlin Code Intelligence library initializes, loading tree-sitter native bindings via JNI

**Step 3:** Language grammars are loaded for detected project languages

**Step 4:** Source files are parsed into ASTs on demand or in batch

**Step 5:** Symbols are extracted from ASTs and indexed for fast lookup

**Step 6:** When files change, incremental parsing updates only affected AST nodes

**Step 7:** Downstream tools (Graph Engine, AI Context) consume AST and symbol data

---

#### STORY 1: Parse Source Files into ASTs

> As a Kotlin developer, I want to parse source files into ASTs using tree-sitter on JVM so that downstream analysis tools have structured code data

**Requirement Details:**

1. Initialize tree-sitter runtime on JVM via JNI bindings
2. Load language grammar WASM/shared-library files for each supported language
3. Parse source code string or file into a tree-sitter Tree object
4. Convert tree-sitter Tree into a platform-agnostic AST representation
5. Handle parse errors gracefully (partial AST with error nodes marked)
6. Support concurrent parsing of multiple files (thread-safe parser instances)

**Acceptance Criteria:**

1. Parser initializes without errors on JVM 17+
2. All 12 language grammars load successfully
3. Parsing a valid source file produces a complete AST with no error nodes
4. Parsing an invalid source file produces a partial AST with error nodes clearly marked
5. Concurrent parsing of 10 files simultaneously completes without data corruption
6. Performance: parsing a 10K LOC file completes in < 500ms

---

#### STORY 2: Support 12 Programming Languages

> As a Kotlin developer, I want support for 12 programming languages so that the tool works with polyglot projects

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

> As a Kotlin developer, I want AST output matching the nodejs reference so that cross-platform consistency is maintained

**Requirement Details:**

1. AST node types must match nodejs v2 naming conventions exactly
2. Tree traversal order (pre-order, post-order) must produce identical sequences
3. Node metadata (start/end positions, byte offsets) must be consistent
4. Named vs anonymous node classification must match
5. Field names on nodes must match the nodejs representation

**Acceptance Criteria:**

1. For each test fixture file, Kotlin AST JSON output matches nodejs AST JSON output exactly
2. Node type names are identical (no renaming or aliasing)
3. Position information (row, column, byte offset) matches within tolerance of 0
4. Tree traversal produces identical node sequences
5. At least 50 test fixture files across all 12 languages pass comparison

---

#### STORY 4: Incremental Parsing

> As a Kotlin developer, I want incremental parsing so that file edits are processed efficiently without full re-parse

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

> As a Kotlin developer, I want symbol extraction from ASTs so that I can query functions, classes, and methods

**Requirement Details:**

1. Extract function declarations (name, parameters, return type, visibility)
2. Extract class declarations (name, superclasses, interfaces, visibility)
3. Extract interface declarations (name, methods, properties)
4. Extract method declarations (name, class, parameters, return type, visibility)
5. Extract variable/constant declarations (name, type, scope)
6. Extract import/export statements
7. Build symbol table with scope hierarchy (module → class → method → block)
8. Support language-specific constructs (Kotlin extensions, Python decorators, etc.)

**Acceptance Criteria:**

1. Symbol extraction produces identical results to nodejs for same input files
2. All symbol types (function, class, interface, method, variable) are correctly classified
3. Scope hierarchy is correctly built (nested classes, inner functions)
4. Language-specific constructs are handled (Kotlin companion objects, Python `__init__`)
5. Performance: symbol extraction for 1000-file project completes in < 3s

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| KSA-144 Batch 1 | System | KSA-144 | nodejs v2 parsers as reference implementation |
| KSA-171 | System | KSA-171 | Parent epic defining overall parity strategy |
| tree-sitter native | External | N/A | tree-sitter C library compiled for JVM targets |
| tree-sitter-kotlin (JNI) | External | N/A | JNI bindings for tree-sitter on JVM |
| Language grammars | External | N/A | tree-sitter grammar files for 12 languages |
| Test fixtures | System | KSA-144 | Shared test fixture files from nodejs v2 |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Duc Nguyen Minh | Prioritize features, accept deliverables |
| Tech Lead | Duc Nguyen Minh | Architecture decisions, code review |
| Developer | Dev Team | Implementation of Kotlin parsers |
| QA | QA Team | Testing and cross-platform verification |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| tree-sitter JNI binding instability | High | Medium | Use well-maintained JNI wrapper; fallback to subprocess-based parsing |
| Native library loading failures on different OS | Medium | Medium | Bundle platform-specific natives (linux-x64, macos-arm64, windows-x64) |
| AST structure divergence from nodejs | High | Low | Strict test fixtures comparing output; automated CI comparison |
| GC pressure from large AST allocations | Medium | Medium | Object pooling for AST nodes; lazy child node materialization |
| Grammar version incompatibility | Low | Low | Pin grammar versions in build config; version lock file |
| Performance regression on large files | Medium | Low | Benchmark suite in CI; alert on > 10% regression |

### 5.2 Assumptions

- KSA-144 Batch 1 nodejs implementation is the single source of truth for AST structure
- tree-sitter JNI bindings are stable enough for production use
- All 12 language grammars are available as pre-compiled shared libraries
- JDK 17+ is the minimum supported runtime
- Kotlin 1.9+ is the implementation language
- Gradle is the build system
- Test fixtures from nodejs v2 are directly reusable

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Parsing < 500ms per 10K LOC file | Single-file parse speed |
| Performance | Batch parsing 1000 files < 30s | Full project initial parse |
| Performance | Incremental parse < 10ms for single edit | Re-parse after character edit |
| Performance | Symbol extraction < 3s for 1000 files | Full project symbol index |
| Memory | < 2GB heap for 1000-file project | AST + symbol table in memory |
| Compatibility | JDK 17, 21 supported | Minimum and LTS versions |
| Compatibility | Linux x64, macOS arm64, Windows x64 | Native library platforms |
| Reliability | Graceful degradation on parse failure | Return partial AST with error markers |
| Accuracy | AST parity > 99% with nodejs reference | Measured by test fixture comparison |
| Thread Safety | Concurrent parsing without corruption | Multiple parser instances safe |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-172 | [Kotlin] Tree-sitter Core + Parsers | Story | Main ticket |
| KSA-171 | Code Intelligence v2 — Feature Parity Sync | Epic | Parent epic |
| KSA-144 | mcp-code-intelligence-nodejs v2 | Epic | Reference implementation |
| KSA-173 | [Kotlin] Graph Engine | Story | Downstream (depends on KSA-172) |
| KSA-174 | [Kotlin] AI Context Tools | Story | Downstream (depends on KSA-172) |
| KSA-175 | [Kotlin] Code Quality | Story | Downstream (depends on KSA-172) |
| KSA-176 | [Kotlin] Security Analysis | Story | Downstream (depends on KSA-172) |
| KSA-177 | [Kotlin] Similarity + Infrastructure | Story | Downstream (depends on KSA-172) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| AST | Abstract Syntax Tree — structured representation of parsed source code |
| JNI | Java Native Interface — mechanism for JVM to call native C/C++ code |
| Tree-sitter | Incremental parsing library that builds concrete syntax trees |
| Grammar | Language-specific parsing rules for tree-sitter |
| Symbol | Named code entity (function, class, method, variable) |
| Incremental Parsing | Re-parsing only changed portions of a file |
| MCP | Model Context Protocol — interface for AI tool integration |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

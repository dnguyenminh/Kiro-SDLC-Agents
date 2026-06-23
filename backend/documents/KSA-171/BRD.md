# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-171: Code Intelligence v2 — Feature Parity Sync (Kotlin + Python)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-171 |
| Title | Code Intelligence v2 — Feature Parity Sync (Kotlin + Python) |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | BA Agent | Initiate document — auto-generated from Jira Epic KSA-171 |

---

## 1. Introduction

### 1.1 Scope

This Epic covers the complete port of all Code Intelligence v2 features from the reference implementation (mcp-code-intelligence-nodejs, Epic KSA-144) to two target platforms:

1. **Kotlin/JVM** — for integration with JVM-based IDEs and server-side applications
2. **Python** — for integration with Python-based AI/ML toolchains and data science workflows

The port includes 6 feature batches per platform (12 total child tickets), covering:
- Tree-sitter parsing infrastructure
- Graph engine (call graph, dependency graph)
- AI context tools (context ranking, token budgeting)
- Code quality analysis (complexity, code smells)
- Security analysis (CFG/DFG, taint analysis, vulnerability detection)
- Similarity and infrastructure (duplicate detection, embeddings)

### 1.2 Out of Scope

- New features not present in the nodejs v2 reference implementation
- UI/frontend components (covered by KSA-170)
- Changes to the nodejs reference implementation itself
- Language support beyond what nodejs v2 already supports
- Deployment infrastructure (CI/CD pipelines for new platforms)

### 1.3 Preliminary Requirements

| Prerequisite | Description | Status |
|-------------|-------------|--------|
| KSA-144 Batch 1 | nodejs v2 Foundation + Parsers must be complete | In Progress |
| Tree-sitter bindings | JVM: tree-sitter-kotlin or JNI bindings; Python: py-tree-sitter | Available |
| Graph libraries | Kotlin: custom adjacency list; Python: NetworkX | Available |
| Token counting | Kotlin: jtokkit; Python: tiktoken | Available |
| Embedding inference | Kotlin: ONNX Runtime; Python: sentence-transformers | Available |

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Feature Parity Sync follows a cascading dependency model:

1. **Foundation Layer** (Batch 1): Tree-sitter parsers provide AST for all downstream features
2. **Graph Layer** (Batch 2): Graph engine builds call/dependency graphs from ASTs
3. **Analysis Layer** (Batches 3-5): AI Context, Code Quality, and Security Analysis consume graph data
4. **Infrastructure Layer** (Batch 6): Similarity detection and shared infrastructure depend on all above

Each platform (Kotlin, Python) follows this cascade independently. Cross-platform dependencies do NOT exist.

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a Kotlin developer, I want tree-sitter parsing for 12+ languages so that I can build ASTs on JVM | MUST HAVE | KSA-172 |
| 2 | As a Kotlin developer, I want a graph engine so that I can analyze call graphs and dependencies | MUST HAVE | KSA-173 |
| 3 | As a Kotlin developer, I want AI context tools so that I can provide ranked code context to LLMs | MUST HAVE | KSA-174 |
| 4 | As a Kotlin developer, I want code quality analysis so that I can detect complexity and code smells | SHOULD HAVE | KSA-175 |
| 5 | As a Kotlin developer, I want security analysis so that I can detect vulnerabilities via taint analysis | SHOULD HAVE | KSA-176 |
| 6 | As a Kotlin developer, I want similarity detection so that I can find duplicates and dead code | COULD HAVE | KSA-177 |
| 7 | As a Python developer, I want tree-sitter parsing for 12+ languages so that I can build ASTs in Python | MUST HAVE | KSA-178 |
| 8 | As a Python developer, I want a graph engine so that I can analyze call graphs and dependencies | MUST HAVE | KSA-179 |
| 9 | As a Python developer, I want AI context tools so that I can provide ranked code context to LLMs | MUST HAVE | KSA-180 |
| 10 | As a Python developer, I want code quality analysis so that I can detect complexity and code smells | SHOULD HAVE | KSA-181 |
| 11 | As a Python developer, I want security analysis so that I can detect vulnerabilities via taint analysis | SHOULD HAVE | KSA-182 |
| 12 | As a Python developer, I want similarity detection so that I can find duplicates and dead code | COULD HAVE | KSA-183 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer installs the Kotlin or Python Code Intelligence library

**Step 2:** Library initializes tree-sitter parsers for the target project's languages

**Step 3:** Library parses source files into ASTs

**Step 4:** Graph engine constructs call graphs and dependency graphs from ASTs

**Step 5:** Analysis tools (AI context, quality, security, similarity) consume graph data

**Step 6:** Results are exposed via MCP tool interface or programmatic API

---

#### STORY 1: [Kotlin] Tree-sitter Core + Parsers (KSA-172)

> As a Kotlin developer, I want tree-sitter parsing for 12+ languages so that I can build ASTs on JVM

**Requirement Details:**

1. Port tree-sitter WASM/native binding to JVM via JNI or tree-sitter-kotlin
2. Support all 12 languages: TypeScript, JavaScript, Python, Java, Kotlin, Go, Rust, C#, Ruby, PHP, Swift, Scala
3. AST output must match nodejs v2 structure exactly (same node types, same traversal order)
4. Incremental parsing support for file change detection
5. Symbol extraction (functions, classes, interfaces, methods, variables)

**Acceptance Criteria:**

1. All 12 language parsers load and parse without errors
2. AST structure matches nodejs reference output for test fixtures
3. Symbol extraction produces identical results to nodejs for same input
4. Incremental parsing correctly handles file edits
5. Performance: parsing 10K LOC file completes in < 500ms

---

#### STORY 2: [Kotlin] Graph Engine (KSA-173)

> As a Kotlin developer, I want a graph engine so that I can analyze call graphs and dependencies

**Requirement Details:**

1. Call graph construction from AST (function calls, method invocations)
2. Dependency graph (import/require relationships between modules)
3. Graph traversal: BFS, DFS, shortest path
4. Impact analysis: given a changed node, find all affected nodes
5. Cycle detection in dependency graphs
6. Custom adjacency list implementation (no external graph library)

**Acceptance Criteria:**

1. Call graph correctly identifies all function/method calls
2. Dependency graph matches nodejs output for same project
3. Impact analysis returns same affected set as nodejs
4. Cycle detection finds all circular dependencies
5. Performance: graph construction for 1000-file project < 5s

---

#### STORY 3: [Kotlin] AI Context Tools (KSA-174)

> As a Kotlin developer, I want AI context tools so that I can provide ranked code context to LLMs

**Requirement Details:**

1. `get_ai_context`: Retrieve ranked code snippets relevant to a query
2. `get_edit_context`: Get context optimized for code editing tasks
3. `get_curated_context`: Get manually curated context with annotations
4. Context ranking algorithm (TF-IDF + graph proximity + recency)
5. Token budget management using jtokkit
6. File relevance scoring based on graph distance and content similarity

**Acceptance Criteria:**

1. Context ranking produces same top-10 results as nodejs for identical queries
2. Token budget is respected (never exceeds specified limit)
3. All 3 context tools return valid, ranked results
4. Performance: context retrieval for 1000-file project < 2s

---

#### STORY 4: [Kotlin] Code Quality (KSA-175)

> As a Kotlin developer, I want code quality analysis so that I can detect complexity and code smells

**Requirement Details:**

1. Cyclomatic complexity calculation per function
2. Cognitive complexity calculation per function
3. Entry point detection (exported functions, API handlers)
4. Circular dependency detection with visualization data
5. Code smell detection (long methods, large classes, deep nesting)

**Acceptance Criteria:**

1. Complexity scores match nodejs reference for same input files
2. Entry points correctly identified for all supported languages
3. Code smells detected with same thresholds as nodejs
4. Results serializable to JSON matching nodejs schema

---

#### STORY 5: [Kotlin] Security Analysis (KSA-176)

> As a Kotlin developer, I want security analysis so that I can detect vulnerabilities via taint analysis

**Requirement Details:**

1. Control Flow Graph (CFG) construction from AST
2. Data Flow Graph (DFG) construction from AST
3. Taint analysis: track data from sources (user input) to sinks (dangerous operations)
4. Injection detection: SQL injection, XSS, command injection
5. SSRF detection: identify server-side request forgery patterns
6. IDOR detection: identify insecure direct object reference patterns
7. Security misconfiguration detection
8. Vulnerability severity scoring (CVSS-like)

**Acceptance Criteria:**

1. CFG/DFG construction produces correct graphs for all supported languages
2. Taint analysis detects all known vulnerabilities in test fixtures
3. False positive rate < 20% on benchmark suite
4. Detection results match nodejs output format
5. Performance: security scan of 500-file project < 30s

---

#### STORY 6: [Kotlin] Similarity + Infrastructure (KSA-177)

> As a Kotlin developer, I want similarity detection so that I can find duplicates and dead code

**Requirement Details:**

1. Code duplicate detection (exact and near-duplicate)
2. Dead code detection (unreachable functions, unused exports)
3. Code embeddings via ONNX Runtime
4. Similarity scoring between code fragments
5. Shared infrastructure: caching, configuration, logging

**Acceptance Criteria:**

1. Duplicate detection finds same duplicates as nodejs
2. Dead code detection identifies same unreachable code
3. Similarity scores within 5% of nodejs reference
4. ONNX model loads and produces embeddings correctly
5. Caching reduces repeated analysis time by > 80%

---

#### STORY 7-12: Python Track (KSA-178 to KSA-183)

The Python track mirrors the Kotlin track exactly in features and acceptance criteria, with platform-specific differences:

| Kotlin | Python Equivalent |
|--------|-------------------|
| JNI/tree-sitter-kotlin | py-tree-sitter |
| Custom adjacency list | NetworkX |
| jtokkit | tiktoken |
| ONNX Runtime (JVM) | sentence-transformers |
| Kotlin coroutines | asyncio |

All acceptance criteria from Stories 1-6 apply to the Python equivalents with the same thresholds.

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| KSA-144 (nodejs v2) | System | KSA-144 | Reference implementation must be complete per batch |
| Tree-sitter native libs | External | N/A | Platform-specific tree-sitter bindings |
| ONNX Runtime | External | N/A | For Kotlin embedding inference |
| sentence-transformers | External | N/A | For Python embedding inference |
| NetworkX | External | N/A | Python graph library |
| jtokkit | External | N/A | Kotlin token counting |
| tiktoken | External | N/A | Python token counting |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Duc Nguyen Minh | Prioritize features, accept deliverables |
| Tech Lead | Duc Nguyen Minh | Architecture decisions, code review |
| Developer | Dev Team | Implementation |
| QA | QA Team | Testing and verification |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Tree-sitter JVM binding instability | High | Medium | Use well-maintained JNI wrapper, fallback to subprocess |
| AST structure divergence between platforms | High | Low | Strict test fixtures comparing output across all 3 platforms |
| Performance degradation on JVM (GC pressure) | Medium | Medium | Object pooling, minimize allocations in hot paths |
| Python GIL limiting parallelism | Medium | High | Use multiprocessing for CPU-bound analysis, asyncio for I/O |
| ONNX model compatibility issues | Low | Low | Pin model versions, test on CI |
| KSA-144 delays blocking downstream | High | Medium | Start with available batches, parallelize where possible |

### 5.2 Assumptions

- KSA-144 nodejs v2 implementation is the single source of truth for feature behavior
- All platforms must produce identical analysis results for the same input
- Performance targets are per-platform (not cross-platform comparison)
- Each platform can use idiomatic libraries (NetworkX for Python, custom for Kotlin)
- Test fixtures from nodejs v2 are reusable across platforms

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Parsing < 500ms/10K LOC | Per-file parsing speed |
| Performance | Graph construction < 5s/1000 files | Full project graph build |
| Performance | Security scan < 30s/500 files | Full security analysis |
| Accuracy | Detection parity > 95% | Compared to nodejs reference |
| Accuracy | False positive rate < 20% | For security findings |
| Compatibility | 12 languages supported | Same as nodejs v2 |
| Reliability | Graceful degradation | Partial results on parser failure |
| Maintainability | Shared test fixtures | Cross-platform test suite |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-171 | Code Intelligence v2 — Feature Parity Sync | Epic | Main ticket |
| KSA-144 | mcp-code-intelligence-nodejs v2 | Epic | Source/reference implementation |
| KSA-172 | [Kotlin] Tree-sitter Core + Parsers | Story | Child (K1) |
| KSA-173 | [Kotlin] Graph Engine | Story | Child (K2) |
| KSA-174 | [Kotlin] AI Context Tools | Story | Child (K3) |
| KSA-175 | [Kotlin] Code Quality | Story | Child (K4) |
| KSA-176 | [Kotlin] Security Analysis | Story | Child (K5) |
| KSA-177 | [Kotlin] Similarity + Infrastructure | Story | Child (K6) |
| KSA-178 | [Python] Tree-sitter Core + Parsers | Story | Child (P1) |
| KSA-179 | [Python] Graph Engine | Story | Child (P2) |
| KSA-180 | [Python] AI Context Tools | Story | Child (P3) |
| KSA-181 | [Python] Code Quality | Story | Child (P4) |
| KSA-182 | [Python] Security Analysis | Story | Child (P5) |
| KSA-183 | [Python] Similarity + Infrastructure | Story | Child (P6) |

---

## 8. Appendix

### Execution Strategy

![Execution Strategy](diagrams/execution-strategy.png)

### Glossary

| Term | Definition |
|------|------------|
| AST | Abstract Syntax Tree — parsed representation of source code |
| CFG | Control Flow Graph — graph of execution paths |
| DFG | Data Flow Graph — graph of data dependencies |
| Taint Analysis | Tracking untrusted data from sources to sinks |
| Tree-sitter | Incremental parsing library for source code |
| MCP | Model Context Protocol — interface for AI tool integration |
| ONNX | Open Neural Network Exchange — model inference format |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Execution Strategy | [execution-strategy.png](diagrams/execution-strategy.png) | [execution-strategy.drawio](diagrams/execution-strategy.drawio) |
| 2 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 3 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

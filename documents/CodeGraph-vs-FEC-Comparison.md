# So sánh chi tiết: CodeGraph vs FEC CR Builder Code Intelligence

**Ngày phân tích:** 2026-05-25  
**Source:** https://github.com/codegraph-ai/CodeGraph (v0.16.5, Apache-2.0)  
**Target:** FEC CR Builder — mcp-code-intelligence-nodejs / python / kotlin

---

## 1. TỔNG QUAN KIẾN TRÚC

| Tiêu chí | CodeGraph | FEC CR Builder |
|-----------|-----------|----------------|
| Ngôn ngữ server | Rust (single binary) | Kotlin + Node.js + Python (3 variants) |
| Parsing engine | Tree-sitter (AST-based) | Regex pattern matching |
| Storage | RocksDB (persistent graph + embeddings) | SQLite WAL + FTS5 |
| Vector index | HNSW (in RocksDB) | sqlite-vec (ONNX) |
| Protocol | MCP (stdio) + LSP (VS Code) | MCP (stdio) only |
| Embedding models | BGE-small / Jina-code-v2 / Granite-97m (32K context) | all-MiniLM-L6-v2 / multilingual-MiniLM |
| Indexing speed | ~60 files/sec, FNV-1a hash | mtime + MD5 dedup |
| Query speed | Sub-100ms | FTS5 (fast) |
| Persistence | Instant startup (no re-parse) | Re-index on restart |
| Languages supported | 38 (tree-sitter grammars) | 6 chính + generic fallback |

---

## 2. PARSING & EXTRACTION — GAP LỚN NHẤT

### CodeGraph: Per-language Rust crate với tree-sitter

38 crates riêng biệt, mỗi ngôn ngữ có parser chuyên biệt:

| Ngôn ngữ | Entities extracted | Relationships | Complexity |
|-----------|-------------------|---------------|------------|
| Python | Functions, classes, methods, fields, decorators, type hints, async, abstract, match, protocols, ABC | Calls, imports, inheritance, implementations | AST-based CC, grading A-F |
| TypeScript/JS | Functions (regular, arrow, async, generator), classes, interfaces, imports/exports, JSX/TSX | Calls, imports, inheritance | CC + nesting depth |
| Kotlin | Classes, interfaces, objects, data/sealed/enum classes, suspend functions, packages | Calls, imports, inheritance, implementations | Yes |
| Java | Classes, interfaces, enums, methods, annotations | Calls, imports, inheritance | Yes |
| Go | Functions, structs, interfaces, methods (receiver) | Calls, imports | Yes |
| Rust | Functions, structs, traits, enums, modules, impls | Calls, imports, trait implementations | Yes |
| C/C++ | Functions, structs, classes, macros, templates | Calls, includes, inheritance | Yes |
| + 31 more | Similar depth | Similar | Yes |

**Performance:** Python: 1000 files < 10s, single file < 10ms

### FEC CR Builder: Regex patterns (1 file, ~150 lines)

| Ngôn ngữ | Entities extracted | Relationships | Complexity |
|-----------|-------------------|---------------|------------|
| Python | def name, class name (2 patterns) | NONE | NONE |
| TypeScript/JS | function, class, interface, type, enum, arrow fn (6 patterns) | NONE | NONE |
| Kotlin | fun, class, interface, object, enum class (5 patterns) | NONE | NONE |
| Java | method, class, interface, enum (4 patterns) | NONE | NONE |
| Go | func, struct, interface (3 patterns) | NONE | NONE |
| Rust | fn, struct, trait, enum, mod (5 patterns) | NONE | NONE |

**Thiếu hoàn toàn:** Parameters, return types, decorators, parent-child, calls, imports, inheritance, complexity

---

## 3. GRAPH ENGINE & NAVIGATION

| Feature | CodeGraph | FEC | Priority |
|---------|-----------|-----|----------|
| Call graph (callers/callees, transitive depth) | YES | NO | CRITICAL |
| Dependency graph (imports, direction + depth) | YES | NO | CRITICAL |
| Impact analysis (blast radius: modify/delete/rename) | YES | NO | CRITICAL |
| Symbol search (hybrid BM25 + semantic) | YES | YES (FTS5 + embedding) | Have |
| Entry point detection (main, HTTP handlers, CLI, events) | YES | NO | HIGH |
| Find by imports | YES | NO | HIGH |
| Find by signature (param count, return type) | YES | NO | HIGH |
| Find implementors | YES | NO | HIGH |
| Find related tests | YES | NO | HIGH |
| Traverse graph (custom edge/node filters) | YES | NO | HIGH |
| Get detailed symbol (source + callers + callees + complexity) | YES | Partial | HIGH |
| HTTP handler detection (7 frameworks) | YES | NO | HIGH |

---

## 4. AI CONTEXT TOOLS

| Feature | CodeGraph | FEC | Priority |
|---------|-----------|-----|----------|
| get_ai_context (intent-aware: explain/modify/debug/test + token budget) | YES | NO | CRITICAL |
| get_edit_context (source + callers + tests + memories + git history) | YES | NO | CRITICAL |
| get_curated_context (NL query cross-codebase) | YES | Partial (mem_search) | HIGH |

---

## 5. CODE ANALYSIS

| Feature | CodeGraph | FEC | Priority |
|---------|-----------|-----|----------|
| Cyclomatic complexity (AST, grading A-F, breakdown) | YES | NO | HIGH |
| Circular dependency detection | YES | NO | HIGH |
| Hot paths (most-called by transitive caller count) | YES | NO | MEDIUM |
| Dead imports (unused imports per file/workspace) | YES | NO | MEDIUM |
| Module summary (file count, functions, language breakdown) | YES | NO | MEDIUM |
| Search by pattern (regex across bodies/signatures/docstrings) | YES | Partial (FTS5) | MEDIUM |
| Search by error (throw/catch specific error types) | YES | NO | MEDIUM |
| Module coupling (instability scores) | YES (Pro) | NO | MEDIUM |

---

## 6. SECURITY TOOLS (22 tools thiếu)

### Tier 1: Core Security

| Feature | CodeGraph | FEC | Priority |
|---------|-----------|-----|----------|
| Control flow analysis (CFG blocks, edges, paths) | YES | NO | HIGH |
| Data flow / taint tracing (variable birth-death, taint sources) | YES | NO | HIGH |
| Injection detection (SQL/XSS/cmd/path/deser/template, 20 patterns) | YES | NO (LLM only) | HIGH |
| SBOM generation (CycloneDX, 8 lockfile formats) | YES | NO | MEDIUM |
| Dependency audit (OSV vulnerability DB) | YES | NO | MEDIUM |

### Tier 2: Heuristic Analyzers

| Feature | CodeGraph | FEC | Priority |
|---------|-----------|-----|----------|
| Unchecked returns (CWE-252/391/754) | YES | NO | MEDIUM |
| Resource leaks (CWE-401/772) | YES | NO | MEDIUM |
| Misconfiguration (debug, CORS, cookies, TLS — 20 sinks) | YES | NO | MEDIUM |
| Input validation (CWE-20/129) | YES | NO | MEDIUM |
| Error exposure (CWE-209/497) | YES | NO | MEDIUM |
| IaC scan (Docker/K8s/Terraform) | YES | NO | MEDIUM |
| Secrets entropy (Shannon entropy) | YES | NO | MEDIUM |
| License check (copyleft from lockfiles) | YES | NO | LOW |

### Tier 3: Advanced / Bounty-grade

| Feature | CodeGraph | FEC | Priority |
|---------|-----------|-----|----------|
| Crypto misuse (113 patterns, 12 CWEs, 8 languages) | YES | NO | MEDIUM |
| Integer overflow (CWE-190, 19 allocator APIs) | YES | NO | LOW |
| NULL deref (CWE-476, 56 allocators) | YES | NO | LOW |
| SSRF detection (CWE-918, trust-tier classification) | YES | NO | MEDIUM |
| IDOR detection (CWE-639/284, route-level authz) | YES | NO | MEDIUM |
| Fail-open verification (CWE-755/347) | YES | NO | LOW |
| REST handler missing auth (CWE-862) | YES | NO | HIGH |
| SARIF export (GitHub/GitLab integration) | YES | NO | MEDIUM |

### Cross-cutting Security Features

| Feature | CodeGraph | FEC |
|---------|-----------|-----|
| include_tests / treat_as_production filtering | YES | NO |
| check_compile_gates (#ifdef cross-reference) | YES | NO |
| 25-marker suppression honoring (nosec, NOLINT, etc.) | YES | NO |
| Telemetry blocks (path_filter, compile_gate) | YES | NO |
| Taint reachability annotation per finding | YES | NO |
| Trust-tier classification | YES | NO |

---

## 7. SIMILARITY & CODE QUALITY (Pro)

| Feature | CodeGraph | FEC | Priority |
|---------|-----------|-----|----------|
| Find duplicates (embedding near-duplicate) | YES | NO | MEDIUM |
| Find similar (semantically similar functions) | YES | NO | MEDIUM |
| Cluster symbols (group by embedding distance) | YES | NO | LOW |
| Compare symbols (side-by-side) | YES | NO | LOW |
| Dead code detection (confidence scoring) | YES | NO | MEDIUM |
| Cross-project search | YES | NO | LOW |

---

## 8. GIT HISTORY MINING (Pro)

| Feature | CodeGraph | FEC | Priority |
|---------|-----------|-----|----------|
| mine_git_history (semantic search over commits) | YES | NO | MEDIUM |
| mine_git_history_for_file (file-specific) | YES | NO | MEDIUM |
| search_git_history (NL search git log) | YES | NO | MEDIUM |

---

## 9. MEMORY LAYER — FEC WINS

| Feature | CodeGraph | FEC | Winner |
|---------|-----------|-----|--------|
| Store/Get/Search | BM25 + semantic | Hybrid RRF (BM25 + Vector + Graph) | FEC |
| Memory context (per file) | YES | YES | Tie |
| Memory invalidation | YES | YES (consolidate) | Tie |
| Multi-tier memory | NO | YES (observation/decision/lesson) | FEC |
| Knowledge graph | NO | YES (JGraphT + SQLite) | FEC |
| Agent handoff | NO | YES | FEC |
| Cross-agent context | NO | YES (multi-agent pipeline) | FEC |
| Document ingestion | NO | YES (mem_ingest_file) | FEC |

---

## 10. INDEXING & CONFIGURATION

| Feature | CodeGraph | FEC | Priority |
|---------|-----------|-----|----------|
| .codegraphignore (per-folder) | YES | NO (config.json only) | MEDIUM |
| Full-body embedding (function bodies) | YES | NO (signature only) | HIGH |
| Instant startup (persistent graph) | YES (RocksDB) | NO (re-index) | HIGH |
| Embedding model selection | 3 models | 2 models | Tie |
| Multi-workspace | YES | YES | Tie |
| Incremental re-index | YES (FNV-1a) | YES (mtime+MD5) | Tie |

---

## 11. FEATURES CẦN PORT — SUMMARY BY PRIORITY

### CRITICAL (11 tuần MVP)

| # | Feature | Effort |
|---|---------|--------|
| 1 | Tree-sitter parsing (6 ngôn ngữ) | 3w |
| 2 | Relationship extraction (calls, imports, inheritance) | 2w |
| 3 | Call graph + Dependency graph tools | 3w |
| 4 | Impact analysis tool | 1w |
| 5 | AI Context tools (intent-aware, edit context) | 2w |

### HIGH (10 tuần)

| # | Feature | Effort |
|---|---------|--------|
| 6 | Cyclomatic complexity + grading | 1w |
| 7 | Entry point + HTTP handler detection | 1w |
| 8 | Full-body embedding + Persistent graph | 2w |
| 9 | Control flow + Data flow analysis | 4w |
| 10 | REST handler missing auth detection | 1w |
| 11 | Find related tests | 0.5w |
| 12 | Circular dependency detection | 0.5w |

### MEDIUM (10 tuần)

| # | Feature | Effort |
|---|---------|--------|
| 13 | Hot paths + Dead imports + Module summary | 1w |
| 14 | Search by error | 0.5w |
| 15 | Injection detection (20 patterns) | 1w |
| 16 | SBOM + Dep audit | 1w |
| 17 | Secrets entropy + Misconfiguration | 1w |
| 18 | SSRF + IDOR detection | 2w |
| 19 | Find duplicates + Dead code | 1.5w |
| 20 | Git history mining | 1w |
| 21 | SARIF export | 0.5w |
| 22 | .codegraphignore | 0.5w |

---

## 12. ĐỀ XUẤT JIRA EPIC STRUCTURE

**Epic:** Code Intelligence v2 — Graph Engine + Static Analysis

| Sub-epic | Tickets | Total Effort |
|----------|---------|--------------|
| Tree-sitter Migration | Parsing + Extraction + Per-language grammars | 5w |
| Graph Engine | Call graph + Dep graph + Impact + Traversal | 4w |
| AI Context | Intent-aware context + Edit context + Curated | 2w |
| Code Quality | Complexity + Entry points + Dead imports + Hot paths | 2w |
| Security Static Analysis | CFG + DFG + Injection + SSRF + IDOR + Auth | 8w |
| Similarity & Mining | Duplicates + Dead code + Git mining + SARIF | 3w |
| Infrastructure | Persistent graph + Full-body embedding + .ignore | 3w |

**Total:** ~27 tuần full parity | **MVP (Critical):** ~11 tuần

---

## 13. ĐIỂM MẠNH FEC GIỮ NGUYÊN

- Multi-agent SDLC pipeline (BA/SA/DEV/QA/DevOps)
- Jira integration + ticket-driven development
- Multi-tier memory + Knowledge graph + Agent handoff
- Document lifecycle (BRD/FSD/TDD/STP/STC/DPG/RLN)
- Orchestrator pattern (find_tools/execute_dynamic_tool)
- Hooks + Steering system
- Multi-language server choice (Kotlin/Node.js/Python)

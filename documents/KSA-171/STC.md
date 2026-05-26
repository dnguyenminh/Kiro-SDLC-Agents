# Software Test Cases (STC)

## MCP Code Intelligence — KSA-171: Code Intelligence v2 — Feature Parity Sync

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-171 |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Related STP | STP-v1-KSA-171.docx |

---

## 1. Property-Based Tests (PBT)

| ID | Property | Generator | Invariant |
|----|----------|-----------|-----------|
| PBT-001 | Parse roundtrip | Random valid source code | AST.text == original source |
| PBT-002 | Graph acyclicity (tree) | Random tree structures | No cycles in tree subgraph |
| PBT-003 | Token budget respect | Random queries + budgets | total_tokens <= max_tokens |
| PBT-004 | Complexity non-negative | Random functions | cyclomatic >= 1 |
| PBT-005 | Taint monotonicity | Random taint paths | tainted set only grows (no spontaneous untaint) |
| PBT-006 | Similarity symmetry | Random code pairs | similarity(A,B) == similarity(B,A) |
| PBT-007 | Graph node uniqueness | Random file sets | No duplicate node IDs |
| PBT-008 | Parse determinism | Same input twice | AST1 == AST2 |
| PBT-009 | Embedding dimension | Random functions | embedding.length == MODEL_DIM |
| PBT-010 | Impact analysis subset | Random changes | affected ⊆ all_reachable |
| PBT-011 | Dead code subset | Random projects | dead_code ⊆ all_functions |
| PBT-012 | Severity ordering | Random vulnerabilities | critical > high > medium > low |

---

## 2. Unit Tests (UT)

### 2.1 Parser (K1/P1)

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-001 | Parse TypeScript file | `function hello() {}` | AST with function_declaration node | P0 |
| UT-002 | Parse JavaScript file | `const x = () => {}` | AST with arrow_function node | P0 |
| UT-003 | Parse Python file | `def hello(): pass` | AST with function_definition node | P0 |
| UT-004 | Parse Java file | `public void hello() {}` | AST with method_declaration node | P0 |
| UT-005 | Parse Kotlin file | `fun hello() {}` | AST with function_declaration node | P0 |
| UT-006 | Parse Go file | `func hello() {}` | AST with function_declaration node | P0 |
| UT-007 | Parse Rust file | `fn hello() {}` | AST with function_item node | P0 |
| UT-008 | Parse C# file | `void Hello() {}` | AST with method_declaration node | P0 |
| UT-009 | Parse Ruby file | `def hello; end` | AST with method node | P1 |
| UT-010 | Parse PHP file | `function hello() {}` | AST with function_definition node | P1 |
| UT-011 | Parse Swift file | `func hello() {}` | AST with function_declaration node | P1 |
| UT-012 | Parse Scala file | `def hello(): Unit = {}` | AST with function_definition node | P1 |
| UT-013 | Extract function symbols | Multi-function file | All functions in symbol table | P0 |
| UT-014 | Extract class symbols | Class with methods | Class + methods in symbol table | P0 |

### 2.2 Graph (K2/P2)

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-015 | Build call graph - direct | `a() calls b()` | Edge a→b | P0 |
| UT-016 | Build call graph - chain | `a→b→c` | Edges a→b, b→c | P0 |
| UT-017 | Build dependency graph | `import B from './b'` | Edge A→B | P0 |
| UT-018 | BFS traversal | Graph with 5 nodes | Correct BFS order | P0 |
| UT-019 | DFS traversal | Graph with 5 nodes | Correct DFS order | P0 |
| UT-020 | Cycle detection - simple | A→B→A | Cycle [A, B] detected | P0 |
| UT-021 | Cycle detection - none | A→B→C (no cycle) | Empty cycle list | P0 |
| UT-022 | Impact analysis - direct | Change A, A→B | B in affected set | P0 |
| UT-023 | Impact analysis - transitive | Change A, A→B→C | B,C in affected set | P1 |
| UT-024 | Shortest path | A→B→C, A→C | Path A→C (length 1) | P1 |

### 2.3 AI Context (K3/P3)

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-025 | TF-IDF scoring | Query "auth", file with "authenticate" | Score > 0.5 | P0 |
| UT-026 | Token counting | "hello world" | Correct token count | P0 |
| UT-027 | Budget enforcement | Budget=100, files need 200 | Result ≤ 100 tokens | P0 |
| UT-028 | Graph proximity boost | Neighbor file | 20% score boost | P0 |
| UT-029 | Empty query | "" | Return top files by recency | P1 |
| UT-030 | Single file project | 1 file | Return that file | P1 |

### 2.4 Quality (K4/P4)

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-031 | Cyclomatic - simple | `if (x) { } else { }` | Complexity = 2 | P0 |
| UT-032 | Cyclomatic - switch | 5-case switch | Complexity = 5 | P0 |
| UT-033 | Cognitive - nested | 3 nested ifs | Cognitive > cyclomatic | P0 |
| UT-034 | Entry point - export | `export function api()` | is_entry_point = true | P0 |
| UT-035 | Code smell - long method | 100-line function | "long_method" smell | P1 |
| UT-036 | Code smell - deep nesting | 5-level nesting | "deep_nesting" smell | P1 |

### 2.5 Security (K5/P5)

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-037 | CFG - linear | Sequential statements | Linear CFG | P0 |
| UT-038 | CFG - branch | if/else | Diamond CFG | P0 |
| UT-039 | CFG - loop | while loop | Back-edge in CFG | P0 |
| UT-040 | DFG - assignment | `x = input; y = x` | Edge input→x→y | P0 |
| UT-041 | Taint - SQL injection | `query(req.body.id)` | Vulnerability detected | P0 |
| UT-042 | Taint - sanitized | `query(escape(req.body.id))` | No vulnerability | P0 |
| UT-043 | Taint - XSS | `res.send(req.query.name)` | XSS detected | P0 |
| UT-044 | Taint - command injection | `exec(req.body.cmd)` | Command injection detected | P0 |
| UT-045 | SSRF detection | `fetch(req.body.url)` | SSRF detected | P1 |
| UT-046 | IDOR detection | `db.find(req.params.id)` without auth check | IDOR detected | P1 |
| UT-047 | Severity scoring | Critical vulnerability | severity = "critical" | P1 |
| UT-048 | Cross-file taint | Source in file A, sink in file B | Vulnerability with path A→B | P1 |

### 2.6 Similarity (K6/P6)

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-049 | Exact duplicate | Two identical functions | similarity = 1.0 | P0 |
| UT-050 | Near duplicate | Renamed variables | similarity > 0.8 | P0 |
| UT-051 | Different code | Unrelated functions | similarity < 0.3 | P0 |
| UT-052 | Dead code - unused | Function never called | In dead_code list | P0 |
| UT-053 | Dead code - used | Function called once | NOT in dead_code list | P0 |
| UT-054 | Embedding dimension | Any function | embedding.length == 384 | P1 |

---

## 3. Integration Tests (IT)

| ID | Test Case | Components | Expected | Priority |
|----|-----------|------------|----------|----------|
| IT-001 | Parse → Symbol extraction | Parser + SymbolExtractor | Symbols match expected | P0 |
| IT-002 | Parse → Graph build | Parser + GraphBuilder | Graph has correct edges | P0 |
| IT-003 | Graph → Impact analysis | GraphBuilder + ImpactAnalysis | Correct affected set | P0 |
| IT-004 | Parse → Security scan | Parser + CFG + DFG + Taint | Vulnerabilities found | P0 |
| IT-005 | Parse → Quality analysis | Parser + Complexity | Correct metrics | P0 |
| IT-006 | Graph → Context ranking | Graph + ContextRanker | Ranked results | P0 |
| IT-007 | Full pipeline - small project | All modules | All tools return results | P0 |
| IT-008 | Incremental update | Parser + Graph + Cache | Only changed parts updated | P1 |
| IT-009 | Cache hit | Cache + any module | Faster second call | P1 |
| IT-010 | Large project (1000 files) | All modules | Completes within NFR | P1 |

---

## 4. E2E API Tests (E2E-API)

| ID | Test Case | MCP Tool | Input | Expected | Priority |
|----|-----------|----------|-------|----------|----------|
| E2E-API-001 | Parse file via MCP | parse_file | TypeScript file path | AST JSON response | P0 |
| E2E-API-002 | Get call graph | get_call_graph | Project path | Graph JSON | P0 |
| E2E-API-003 | Get dependency graph | get_dependency_graph | Project path | Graph JSON | P0 |
| E2E-API-004 | Impact analysis | impact_analysis | Changed file list | Affected files | P0 |
| E2E-API-005 | Get AI context | get_ai_context | Query + budget | Ranked context | P0 |
| E2E-API-006 | Get edit context | get_edit_context | File + line | Edit context | P0 |
| E2E-API-007 | Analyze quality | analyze_quality | File path | Quality report | P0 |
| E2E-API-008 | Analyze security | analyze_security | Project path | Vulnerability report | P0 |
| E2E-API-009 | Find duplicates | find_duplicates | Project path | Duplicate groups | P0 |
| E2E-API-010 | Find dead code | find_dead_code | Project path | Dead code list | P0 |
| E2E-API-011 | Invalid path | Any tool | Non-existent path | Error E002 | P1 |
| E2E-API-012 | Unsupported language | parse_file | .xyz file | Error E001 | P1 |

---

## 5. System Integration Tests (SIT)

| ID | Test Case | Description | Automation | Priority |
|----|-----------|-------------|------------|----------|
| SIT-001 | Kotlin-nodejs parity (parsers) | Same input → same AST output | Automated | P0 |
| SIT-002 | Python-nodejs parity (parsers) | Same input → same AST output | Automated | P0 |
| SIT-003 | Kotlin-nodejs parity (graph) | Same project → same graph | Automated | P0 |
| SIT-004 | Python-nodejs parity (graph) | Same project → same graph | Automated | P0 |
| SIT-005 | Kotlin-nodejs parity (security) | Same project → same vulnerabilities | Automated | P0 |
| SIT-006 | Python-nodejs parity (security) | Same project → same vulnerabilities | Automated | P0 |
| SIT-007 | Performance - Kotlin parse | 10K LOC file < 500ms | Automated | P1 |
| SIT-008 | Performance - Python parse | 10K LOC file < 500ms | Automated | P1 |
| SIT-009 | Performance - Kotlin graph | 1000 files < 5s | Automated | P1 |
| SIT-010 | Performance - Python graph | 1000 files < 5s | Automated | P1 |
| SIT-011 | Performance - Kotlin security | 500 files < 30s | Automated | P1 |
| SIT-012 | Performance - Python security | 500 files < 30s | Automated | P1 |
| SIT-013 | Memory - Kotlin 1000 files | Peak RSS < 2GB | Automated | P2 |
| SIT-014 | Memory - Python 1000 files | Peak RSS < 2GB | Automated | P2 |
| SIT-015 | Stress - concurrent requests | 10 parallel MCP calls | All succeed | Automated | P2 |
| SIT-016 | Stress - large file | 50K LOC file | Completes (may be slow) | Automated | P2 |
| SIT-017 | Recovery - corrupt file | Binary file as input | Graceful error | Automated | P2 |
| SIT-018 | Visual inspection | Review parity report | Human reviews diff | Manual | P2 |

---

## 6. Test Data

### 6.1 Test Fixtures Location

```
test-fixtures/
├── languages/          # One file per supported language
│   ├── sample.ts
│   ├── sample.js
│   ├── sample.py
│   ├── sample.java
│   ├── sample.kt
│   ├── sample.go
│   ├── sample.rs
│   ├── sample.cs
│   ├── sample.rb
│   ├── sample.php
│   ├── sample.swift
│   └── sample.scala
├── projects/           # Multi-file test projects
│   ├── small/          # 10 files
│   ├── medium/         # 100 files
│   └── large/          # 1000 files
├── security/           # Known vulnerability samples
│   ├── sql-injection.ts
│   ├── xss.ts
│   ├── command-injection.ts
│   ├── ssrf.ts
│   └── idor.ts
├── expected/           # Expected outputs (JSON)
│   ├── ast/
│   ├── graph/
│   ├── quality/
│   ├── security/
│   └── similarity/
└── benchmarks/         # Performance test data
    └── large-file.ts   # 10K LOC
```

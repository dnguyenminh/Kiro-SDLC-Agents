# Software Test Cases (STC)

## MCP Code Intelligence — KSA-175: [Kotlin] Code Quality

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-175 |
| Title | [Kotlin] Code Quality — Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related STP | STP-v1-KSA-175.docx |

---

## 1. Property-Based Tests (PBT)

| ID | Property | Generator | Assertion |
|----|----------|-----------|-----------|
| PBT-01 | CC always >= 1 | Random AST with 0-100 decision points | `cc >= 1` |
| PBT-02 | Grade monotonically maps to CC ranges | Random CC values 1-200 | Grade boundaries respected |
| PBT-03 | CC = 1 + branches + loops + logical_ops + exceptions | Random DecisionPointCounts | Formula holds |

---

## 2. Unit Tests (UT) — Complexity

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-01 | Empty function body | No decision points | CC=1, Grade A | High |
| UT-02 | Single if statement | `if (x) { }` | CC=2, branches=1 | High |
| UT-03 | If-else chain | `if/else if/else if` (3 branches) | CC=4, branches=3 | High |
| UT-04 | For loop | `for (i in 1..10) { }` | CC=2, loops=1 | High |
| UT-05 | Nested if in loop | `for { if { } }` | CC=3, depth=2 | High |
| UT-06 | Logical AND/OR | `if (a && b \|\| c)` | CC=4, logical_ops=2 | High |
| UT-07 | Try-catch | `try { } catch { }` | CC=2, exceptions=1 | High |
| UT-08 | Kotlin when expression | `when { 5 branches }` | CC=6, branches=5 | High |
| UT-09 | Early return | `if (x) return; ...` | earlyReturns=1 | Medium |
| UT-10 | Grade boundary A/B | CC=5 vs CC=6 | Grade A vs Grade B | High |
| UT-11 | Grade boundary D/F | CC=50 vs CC=51 | Grade D vs Grade F | High |
| UT-12 | Unsupported language | language="rust" | Returns null | Medium |

---

## 3. Unit Tests (UT) — Entry Points

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-13 | Ktor GET route | `get("/users") { }` | HTTP_HANDLER, GET, /users | High |
| UT-14 | Spring @GetMapping | `@GetMapping("/api/v1/users")` | HTTP_HANDLER, GET, /api/v1/users | High |
| UT-15 | Express route | `app.post('/login', handler)` | HTTP_HANDLER, POST, /login | High |
| UT-16 | Main function | `fun main(args: Array<String>)` | MAIN entry type | High |
| UT-17 | Auth detection | Route with `authenticate { }` wrapper | has_auth = true | High |
| UT-18 | No auth | Route without auth middleware | has_auth = false | Medium |

---

## 4. Unit Tests (UT) — Graph Analysis

| ID | Test Case | Input | Expected | Priority |
|----|-----------|-------|----------|----------|
| UT-19 | Simple cycle A→B→A | 2-node graph with cycle | 1 SCC, length=2, severity=HIGH | High |
| UT-20 | Triangle cycle A→B→C→A | 3-node cycle | 1 SCC, length=3, severity=HIGH | High |
| UT-21 | No cycles (DAG) | A→B→C (no back edges) | Empty result | High |
| UT-22 | Multiple SCCs | Two separate cycles | 2 SCCs reported | Medium |
| UT-23 | Dead import (unused) | Import with no references | Reported as dead | High |
| UT-24 | Live import (used) | Import referenced in code | NOT reported | High |
| UT-25 | Re-export (not dead) | Import that is re-exported | NOT reported | Medium |
| UT-26 | Hot path (5 callers) | Function called by 5 others | directCallers=5 | High |
| UT-27 | Transitive callers | A→B→C, D→B→C | C has 2 transitive | High |
| UT-28 | Min callers filter | minCallers=3, function has 2 | NOT in results | Medium |
| UT-29 | Direct test found | Test directly calls target | depth=1, direct test | High |
| UT-30 | Indirect test found | Test→helper→target | depth=2, indirect test | High |
| UT-31 | Max depth respected | Test at depth 4, maxDepth=3 | NOT found | Medium |

---

## 5. Integration Tests (IT)

| ID | Test Case | Setup | Verification | Priority |
|----|-----------|-------|-------------|----------|
| IT-01 | Complexity stored in DB | Index file with 3 functions | 3 rows in complexity_results | High |
| IT-02 | Complexity query with filters | Store 10 results, query grade=F | Only F-grade results returned | High |
| IT-03 | Complexity upsert (re-index) | Index same file twice | Results updated, not duplicated | High |
| IT-04 | Complexity summary stats | Store results with mixed grades | Correct average + distribution | Medium |
| IT-05 | Entry points stored | Index Ktor route file | Entry points in DB | High |
| IT-06 | Entry point query by type | Store HTTP + MAIN entries | Filter by type works | High |
| IT-07 | Entry point auth summary | Store 3 with auth, 2 without | Summary: 3 with, 2 without | Medium |
| IT-08 | Circular deps from real graph | Insert edges forming cycle | Detected by tool | High |
| IT-09 | No false positive cycles | Insert DAG edges only | Empty result | High |
| IT-10 | Dead imports from DB | Insert import refs, some unused | Correct dead imports | High |
| IT-11 | Hot paths from real graph | Insert edges with hub node | Hub appears as hot path | High |
| IT-12 | Related tests from graph | Insert test→target edge | Test found for target | High |
| IT-13 | Module summary aggregation | Multiple modules with data | Correct per-module stats | Medium |

---

## 6. E2E-API Tests

| ID | Test Case | MCP Tool Call | Expected Response | Priority |
|----|-----------|-------------|-------------------|----------|
| E2E-01 | Complexity default query | `complexity_analysis {}` | Top 20 by CC, formatted text | High |
| E2E-02 | Complexity with grade filter | `complexity_analysis {grade_filter: "D,F"}` | Only D/F results | High |
| E2E-03 | Complexity no data | `complexity_analysis {}` (empty DB) | "No complexity data found..." | High |
| E2E-04 | Entry points default | `find_entry_points {}` | All entry points, summary | High |
| E2E-05 | Entry points by framework | `find_entry_points {framework: "ktor"}` | Only Ktor handlers | High |
| E2E-06 | Circular deps | `find_circular_deps {}` | Cycles with severity | High |
| E2E-07 | Dead imports | `find_dead_imports {limit: 10}` | Max 10 results | Medium |
| E2E-08 | Hot paths | `find_hot_paths {min_callers: 3}` | Functions with 3+ callers | Medium |
| E2E-09 | Related tests | `find_related_tests {symbol_name: "processRequest"}` | Direct + indirect tests | Medium |
| E2E-10 | Module summary | `module_summary {}` | All modules with stats | Medium |

---

## 7. System Integration Tests (SIT) — Parity

| ID | Test Case | Method | Expected | Priority |
|----|-----------|--------|----------|----------|
| SIT-01 | Complexity output format | Compare Kotlin vs Node.js output for same file | Identical text format | High |
| SIT-02 | Grade distribution match | Same codebase, both implementations | Same grade counts | High |
| SIT-03 | Entry point detection match | Same project, both implementations | Same entry points found | High |
| SIT-04 | Circular dep detection match | Same graph, both implementations | Same SCCs found | High |
| SIT-05 | Hot path ranking match | Same graph, both implementations | Same top-N ranking | Medium |
| SIT-06 | Dead import match | Same project, both implementations | Same dead imports | Medium |
| SIT-07 | Tool names and schemas | Compare tool definitions | Identical names + schemas | High |

---

## 8. Performance Tests

| ID | Test Case | Input Size | Target | Priority |
|----|-----------|-----------|--------|----------|
| PERF-01 | Complexity analysis throughput | 1000 functions | < 5 seconds | High |
| PERF-02 | Query response time | 10K stored results, filtered query | < 100ms | High |
| PERF-03 | Tarjan's SCC on large graph | 10K nodes, 50K edges | < 2 seconds | Medium |

---

## 9. Test Data Files

| File | Content | Used By |
|------|---------|---------|
| `testdata/complexity-simple.csv` | symbol_name, language, expected_cc, expected_grade | UT-01..09 |
| `testdata/complexity-complex.csv` | Complex function scenarios | UT-10..11 |
| `testdata/graphs-cycles.csv` | source_id, target_id (with cycles) | UT-19..22 |
| `testdata/graphs-dag.csv` | source_id, target_id (no cycles) | UT-21 |
| `testdata/frameworks/ktor-routes.kt` | Sample Ktor route definitions | UT-13, UT-17 |
| `testdata/frameworks/spring-controller.java` | Sample Spring controller | UT-14 |
| `testdata/frameworks/express-routes.ts` | Sample Express routes | UT-15 |

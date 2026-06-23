# Software Test Cases (STC)

## MCP Code Intelligence Python — KSA-179: [Python] Graph Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-179 |
| Title | [Python] Graph Engine — Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related STC | STC-v1-KSA-179.docx |

---

## 1. Property-Based Tests (PBT)

### PBT-001: Symbol Resolution Invariants

| Field | Value |
|-------|-------|
| ID | PBT-001 |
| Requirement | STORY 7 |
| Property | resolve() always returns list (never None/exception) |
| Generator | Random strings (ascii, unicode, empty, dots, colons) |
| Invariant | `isinstance(result, list)` and all items are `ResolvedSymbol` |

### PBT-002: Test Detector Consistency

| Field | Value |
|-------|-------|
| ID | PBT-002 |
| Requirement | STORY 8 |
| Property | is_test_file() is deterministic and handles all path formats |
| Generator | Random file paths with various extensions and directory structures |
| Invariant | Same input always produces same output; no exceptions |

### PBT-003: BFS Depth Invariant

| Field | Value |
|-------|-------|
| ID | PBT-003 |
| Requirement | NFR Performance |
| Property | All results have depth_level <= requested depth |
| Generator | Random depth (1-5), random graph structures |
| Invariant | `all(r.depth_level <= depth for r in results)` |

---

## 2. Unit Tests (UT)

### 2.1 SymbolResolver

| ID | Test Case | Input | Expected | Req |
|----|-----------|-------|----------|-----|
| UT-030 | Exact match found | `"processData"` (exists in DB) | List with matching symbol | STORY 7 |
| UT-031 | Exact match not found | `"nonExistent"` | Empty list | STORY 7 |
| UT-032 | Qualified match | `"DataService.processData"` | Method in DataService class | STORY 7 |
| UT-033 | File:symbol match | `"utils.py:helper"` | Symbol in utils.py | STORY 7 |
| UT-034 | Suggest similar | `"proc"` | List containing "processData" | STORY 7 |
| UT-035 | Empty input | `""` | Empty list | STORY 7 |

### 2.2 CallGraphService — find_callers

| ID | Test Case | Input | Expected | Req |
|----|-----------|-------|----------|-----|
| UT-001 | Direct callers (depth=1) | symbol with 3 callers, depth=1 | 3 results, all depth_level=1 | STORY 1 |
| UT-002 | Transitive callers (depth=3) | chain A→B→C→D, depth=3 | Results at depth 1,2,3 | STORY 1 |
| UT-003 | Symbol not found | non-existent symbol | Empty results, resolved_to=[] | STORY 1 |
| UT-004 | File filter applied | filter="src/handler*" | Only matching files in results | STORY 1 |
| UT-005 | Limit respected | 10 callers, limit=5 | Exactly 5 results, truncated=true | STORY 1 |

### 2.3 CallGraphService — find_callees

| ID | Test Case | Input | Expected | Req |
|----|-----------|-------|----------|-----|
| UT-006 | Direct callees | function calling 4 others | 4 results | STORY 2 |
| UT-007 | Include external | function calling external lib | External in results with "(external)" | STORY 2 |
| UT-008 | Exclude external | include_external=False | No external results | STORY 2 |
| UT-009 | Transitive callees | A calls B, B calls C, depth=2 | B at depth 1, C at depth 2 | STORY 2 |

### 2.4 DependencyGraphService

| ID | Test Case | Input | Expected | Req |
|----|-----------|-------|----------|-----|
| UT-010 | Outgoing deps | file importing 3 modules | 3 DependencyNodes | STORY 3 |
| UT-011 | Incoming deps | file imported by 2 others | 2 DependencyNodes | STORY 3 |
| UT-012 | Both directions | direction="both" | Merged outgoing + incoming | STORY 3 |
| UT-013 | External filtered | include_external=False | No external packages | STORY 3 |
| UT-014 | Imported symbols tracked | file importing {A, B} from module | importedSymbols=["A","B"] | STORY 3 |

### 2.5 Cycle Detection

| ID | Test Case | Input | Expected | Req |
|----|-----------|-------|----------|-----|
| UT-015 | Simple cycle A→B→A | A imports B, B imports A | cycles=[["A","B","A"]] | STORY 4 |
| UT-016 | Triangle cycle | A→B→C→A | cycles=[["A","B","C","A"]] | STORY 4 |
| UT-017 | No cycle | Linear A→B→C | cycles=[] | STORY 4 |

### 2.6 ImpactAnalysisService

| ID | Test Case | Input | Expected | Req |
|----|-----------|-------|----------|-----|
| UT-018 | Delete action severity | action="delete", depth-1 caller | severity="critical" | STORY 5 |
| UT-019 | Modify action severity | action="modify", depth-2 caller | severity="high" | STORY 5 |
| UT-020 | Rename action severity | action="rename", depth-1 caller | severity="high" | STORY 5 |
| UT-021 | Tests included | include_tests=True | affected_tests populated | STORY 5 |
| UT-022 | Severity threshold filter | threshold="high" | No medium/low in results | STORY 5 |
| UT-023 | Deduplication | Same symbol at same line | Only one entry | STORY 5 |
| UT-024 | Recommendations generated | action="delete", 5 callers | "Remove all 5 references..." | STORY 5 |

### 2.7 GraphTraverser

| ID | Test Case | Input | Expected | Req |
|----|-----------|-------|----------|-----|
| UT-025 | Edge type filter | edge_types=["calls"] | Only "calls" edges followed | STORY 6 |
| UT-026 | Node type filter | node_types=["function"] | Only functions in results | STORY 6 |
| UT-027 | Direction outgoing | direction="outgoing" | Only outgoing neighbors | STORY 6 |
| UT-028 | Direction incoming | direction="incoming" | Only incoming neighbors | STORY 6 |
| UT-029 | Include source | include_source=True | Source snippets in results | STORY 6 |

### 2.8 TestDetector

| ID | Test Case | Input | Expected | Req |
|----|-----------|-------|----------|-----|
| UT-036 | Python test file | `"tests/test_graph.py"` | is_test_file=True | STORY 8 |
| UT-037 | TypeScript test | `"src/__tests__/graph.test.ts"` | is_test_file=True | STORY 8 |
| UT-038 | Non-test file | `"src/graph/traverser.py"` | is_test_file=False | STORY 8 |
| UT-039 | Find related tests | symbol in processor.py | finds test_processor.py | STORY 8 |

---

## 3. Integration Tests (IT)

### IT-001: CallGraph End-to-End

| Field | Value |
|-------|-------|
| ID | IT-001 |
| Requirement | STORY 1, STORY 2 |
| Setup | In-memory SQLite with 10 symbols, 15 relationships |
| Steps | 1. Create DB with test graph 2. Instantiate services 3. Call find_callers 4. Verify results match expected |
| Expected | Correct callers returned with proper depth levels |
| Teardown | Connection closed |

### IT-002: DependencyGraph with Cycles

| Field | Value |
|-------|-------|
| ID | IT-002 |
| Requirement | STORY 3, STORY 4 |
| Setup | DB with circular import chain |
| Steps | 1. Create A→B→C→A cycle 2. Query from A 3. Verify cycle detected |
| Expected | results contain B,C; cycles contain [A,B,C,A] |

### IT-003: Impact Analysis Full Pipeline

| Field | Value |
|-------|-------|
| ID | IT-003 |
| Requirement | STORY 5 |
| Setup | DB with callers + deps + test files |
| Steps | 1. Create graph with tests 2. analyze_impact("target", "delete") 3. Verify all impact sources found |
| Expected | Callers + dependents + tests all in results |

### IT-004: Traverser with Filters

| Field | Value |
|-------|-------|
| ID | IT-004 |
| Requirement | STORY 6 |
| Setup | DB with mixed edge types (calls, implements, imports) |
| Steps | 1. Traverse with edge_types=["calls"] 2. Verify only call edges followed |
| Expected | No "implements" or "imports" edges in results |

### IT-005: Large Graph Performance

| Field | Value |
|-------|-------|
| ID | IT-005 |
| Requirement | NFR Performance |
| Setup | DB with 1000 symbols, 5000 relationships |
| Steps | 1. Run find_callers depth=5 2. Measure time |
| Expected | < 2000ms |

### IT-006: Service Factory Integration

| Field | Value |
|-------|-------|
| ID | IT-006 |
| Requirement | All |
| Setup | Real DB with indexed project |
| Steps | 1. create_graph_services() 2. Use each service 3. Verify no errors |
| Expected | All services work together correctly |

---

## 4. E2E-API Tests

### E2E-API-001: code_callers Tool

| Field | Value |
|-------|-------|
| ID | E2E-API-001 |
| Requirement | STORY 1 |
| Steps | 1. Start MCP server 2. Send code_callers request 3. Parse JSON response |
| Expected | Valid CallGraphResponse JSON with camelCase keys |

### E2E-API-002: code_callees Tool

| Field | Value |
|-------|-------|
| ID | E2E-API-002 |
| Requirement | STORY 2 |
| Steps | 1. Send code_callees request 2. Verify response schema |
| Expected | Valid response with results array |

### E2E-API-003: code_dependencies Tool

| Field | Value |
|-------|-------|
| ID | E2E-API-003 |
| Requirement | STORY 3 |
| Steps | 1. Send code_dependencies request 2. Verify cycles field exists |
| Expected | DependencyResult with cycles array |

### E2E-API-004: code_impact Tool

| Field | Value |
|-------|-------|
| ID | E2E-API-004 |
| Requirement | STORY 5 |
| Steps | 1. Send code_impact request 2. Verify blastRadius summary |
| Expected | ImpactResult with severity counts |

### E2E-API-005: code_traverse Tool

| Field | Value |
|-------|-------|
| ID | E2E-API-005 |
| Requirement | STORY 6 |
| Steps | 1. Send code_traverse request 2. Verify metadata |
| Expected | TraverseResponse with execution_time_ms |

---

## 5. System Integration Tests (SIT)

### SIT-001: Performance Under Load

| Field | Value |
|-------|-------|
| ID | SIT-001 |
| Requirement | NFR Performance |
| Steps | 1. Index real project (mcp-code-intelligence-python itself) 2. Run 100 queries 3. Measure p95 latency |
| Expected | p95 < 500ms for depth=1, p95 < 2000ms for depth=5 |

### SIT-002: API Compatibility with nodejs

| Field | Value |
|-------|-------|
| ID | SIT-002 |
| Requirement | NFR Compatibility |
| Steps | 1. Run same queries on nodejs and Python 2. Compare JSON output structure |
| Expected | Same keys, same nesting, same types (values may differ due to different DB) |

---

## 6. Test Data Files

| File | Description |
|------|-------------|
| `testdata/small_graph.sql` | 5 symbols, 8 relationships |
| `testdata/cyclic_graph.sql` | Graph with 3 cycles |
| `testdata/large_graph.sql` | 1000 symbols, 5000 relationships |
| `testdata/expected_callers.json` | Expected output for find_callers tests |
| `testdata/expected_impact.json` | Expected output for impact analysis tests |

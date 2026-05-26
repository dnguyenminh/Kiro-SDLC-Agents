# Software Test Plan (STP)

## MCP Code Intelligence — KSA-174: [Kotlin] AI Context Tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-174 |
| Title | [Kotlin] AI Context Tools — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-174.docx |
| Related FSD | FSD-v1-KSA-174.docx |
| Related TDD | TDD-v1-KSA-174.docx |

---

## 1. Test Strategy Overview

### 1.1 Scope

Test the complete AI Context Tools module ported from Node.js to Kotlin, covering:
- 3 MCP tools: `get_ai_context`, `get_edit_context`, `get_curated_context`
- Supporting components: TokenBudgetManager, IntentStrategies, RRFMerger, QueryAnalyzer, GitService
- Integration with KSA-173 (Graph Engine) and KSA-172 (Tree-sitter/DB)

### 1.2 Test Levels

| Level | Abbreviation | Scope | Automation |
|-------|-------------|-------|------------|
| Property-Based Testing | PBT | TokenBudgetManager, RRFMerger invariants | 100% automated |
| Unit Testing | UT | Individual classes/functions | 100% automated |
| Integration Testing | IT | Service + DB + Graph interactions | 100% automated |
| E2E API Testing | E2E-API | MCP tool calls end-to-end | 100% automated |
| E2E UI Testing | E2E-UI | N/A (no UI in this ticket) | N/A |
| System Integration Testing | SIT | Parity with Node.js implementation | 90% automated |

### 1.3 Test Environment

| Component | Technology |
|-----------|-----------|
| Test Framework | JUnit 5 + Kotest |
| Mocking | MockK |
| Database | In-memory SQLite (same driver as production) |
| Assertions | Kotest matchers |
| Property Testing | Kotest property testing |
| Coverage | JaCoCo (target: 85%) |

---

## 2. Requirements Traceability Matrix (RTM)

| BRD Story | FSD Use Case | Test Cases | Coverage |
|-----------|-------------|------------|----------|
| Story 1: get_ai_context | UC-01 | PBT-01, UT-01..UT-08, IT-01..IT-04, E2E-01..E2E-04 | Full |
| Story 2: get_edit_context | UC-02 | UT-09..UT-14, IT-05..IT-07, E2E-05..E2E-08 | Full |
| Story 3: get_curated_context | UC-03 | PBT-02, UT-15..UT-20, IT-08..IT-10, E2E-09..E2E-12 | Full |
| Story 4: Token Budget | FSD §5.2 | PBT-01, UT-01..UT-04 | Full |
| Story 5: Symbol Resolution | FSD §5.5 | UT-05..UT-08, IT-01 | Full |
| Story 6: Git History | FSD §6.1 | UT-13..UT-14, IT-06 | Full |
| Story 7: RRF Merger | FSD §5.3 | PBT-02, UT-15..UT-17 | Full |

---

## 3. Test Cases by Level

### 3.1 Property-Based Testing (PBT)

| ID | Property | Generator | Invariant |
|----|----------|-----------|-----------|
| PBT-01 | Budget never exceeded | Random sections (1-20), random budget (500-8000) | sum(included_tokens) <= budget |
| PBT-02 | RRF scores monotonically decrease | Random ranked lists (1-50 items each) | merged[i].score >= merged[i+1].score |
| PBT-03 | Token estimation is deterministic | Random strings (0-10000 chars) | estimateTokens(s) == estimateTokens(s) |
| PBT-04 | Assembly priority ordering | Random sections with priorities | included sections have lower priority numbers than excluded |

### 3.2 Unit Testing (UT)

| ID | Component | Test | Expected |
|----|-----------|------|----------|
| UT-01 | TokenBudgetManager | estimateTokens("hello") | 2 (5/4 ceil) |
| UT-02 | TokenBudgetManager | estimateTokens with 4000 char string | 1000 |
| UT-03 | TokenBudgetManager | assemble with budget=500, 3 sections | Only highest priority included |
| UT-04 | TokenBudgetManager | truncateArray with partial fit | Partial array returned |
| UT-05 | SymbolResolution | resolve("Class.method") | Finds method in class |
| UT-06 | SymbolResolution | resolve("file:symbol") | Finds symbol in file |
| UT-07 | SymbolResolution | resolve("plainName") | Finds best match |
| UT-08 | SymbolResolution | resolve("nonexistent") | Returns null |
| UT-09 | EditContextService | getContext with all flags true | All sections present |
| UT-10 | EditContextService | getContext with include_callers=false | No callers section |
| UT-11 | EditContextService | getContext with include_tests=false | No tests section |
| UT-12 | EditContextService | getContext with include_git=false | No git section |
| UT-13 | GitService | parseGitOutput valid | List of GitCommit |
| UT-14 | GitService | parseGitOutput empty | Empty list |
| UT-15 | RRFMerger | merge 2 lists, no overlap | Combined sorted by score |
| UT-16 | RRFMerger | merge 2 lists, with overlap | Deduplicated, scores summed |
| UT-17 | RRFMerger | merge with custom weights | Weighted source ranked higher |
| UT-18 | QueryAnalyzer | analyze("how does auth work") | Keywords: [auth, work], FTS: "auth OR work" |
| UT-19 | QueryAnalyzer | analyze("TokenBudgetManager") | symbolCandidates: ["TokenBudgetManager"] |
| UT-20 | IntentStrategies | getStrategy(MODIFY) | source(1), callers(2), callees(3)... |

### 3.3 Integration Testing (IT)

| ID | Scenario | Setup | Verification |
|----|----------|-------|-------------|
| IT-01 | get_ai_context with real DB | SQLite with 50 symbols + call graph | Returns correct sections |
| IT-02 | get_ai_context all intents | Same DB, 4 different intents | Different section orderings |
| IT-03 | Budget overflow handling | Large symbol (2000 tokens source) + budget=1000 | Only source returned |
| IT-04 | Caller depth traversal | 3-level call chain in DB | depth=2 returns 2 levels |
| IT-05 | get_edit_context full | DB + git repo | All sections populated |
| IT-06 | get_edit_context no git | DB only (no .git) | Git section empty, no error |
| IT-07 | get_edit_context file:line | Symbol at specific line | Correct symbol resolved |
| IT-08 | get_curated_context FTS | FTS5 populated with 100 symbols | Relevant results returned |
| IT-09 | get_curated_context RRF | Code + memory results | Merged correctly |
| IT-10 | get_curated_context graph expansion | Top results have graph neighbors | Graph section populated |

### 3.4 E2E API Testing (E2E-API)

| ID | Tool | Input | Expected Response |
|----|------|-------|-------------------|
| E2E-01 | get_ai_context | symbol="TestClass.method", intent="explain" | 200, sections include source |
| E2E-02 | get_ai_context | symbol="nonexistent" | 200, not_found response |
| E2E-03 | get_ai_context | intent="debug" | error_patterns section prioritized |
| E2E-04 | get_ai_context | token_budget=500 | Only source fits |
| E2E-05 | get_edit_context | symbol="realFunction" | Source + callers + tests |
| E2E-06 | get_edit_context | include_git=false | No git in response |
| E2E-07 | get_edit_context | caller_depth=3 | Multi-level callers |
| E2E-08 | get_edit_context | symbol="file.kt:functionName" | Resolves by file |
| E2E-09 | get_curated_context | query="database connection" | Code + memory results |
| E2E-10 | get_curated_context | include_memory=false | Only code results |
| E2E-11 | get_curated_context | source_weights={memory:2.0} | Memory ranked higher |
| E2E-12 | get_curated_context | max_tokens=500 | Fewer results, within budget |

### 3.5 System Integration Testing (SIT) — Parity Tests

| ID | Test | Method | Pass Criteria |
|----|------|--------|---------------|
| SIT-01 | Same symbol, same intent → same sections | Compare Kotlin vs Node.js output | Same section names included |
| SIT-02 | Token count within 10% | Compare token counts | abs(kotlin - nodejs) / nodejs < 0.1 |
| SIT-03 | RRF ranking order matches | Same inputs to both | Top 5 results in same order |
| SIT-04 | Symbol resolution parity | Same symbol formats | Same resolved symbol |
| SIT-05 | Error responses match | Same invalid inputs | Same error structure |

---

## 4. Test Data

### 4.1 Test Database Setup

```sql
-- 50 symbols across 5 files
INSERT INTO symbols (name, kind, file_path, start_line, end_line, signature, parent_name) VALUES
('AIContextService', 'class', 'src/context/AIContextService.kt', 1, 100, NULL, NULL),
('getContext', 'method', 'src/context/AIContextService.kt', 10, 50, 'suspend fun getContext(params)', 'AIContextService'),
('fetchSection', 'method', 'src/context/AIContextService.kt', 55, 80, 'private fun fetchSection(def, symbol, depth)', 'AIContextService'),
-- ... more symbols
```

### 4.2 Test Call Graph

```sql
-- getContext calls fetchSection
INSERT INTO call_graph_edges (caller_id, callee_id, edge_type) VALUES (2, 3, 'calls');
-- handleGetAIContext calls getContext
INSERT INTO call_graph_edges (caller_id, callee_id, edge_type) VALUES (10, 2, 'calls');
```

---

## 5. Entry/Exit Criteria

### 5.1 Entry Criteria

- KSA-172 (Tree-sitter) and KSA-173 (Graph Engine) implementations complete
- Code compiles without errors
- Database schema matches TDD specification

### 5.2 Exit Criteria

| Criteria | Target |
|----------|--------|
| All PBT properties hold | 100% (1000 iterations each) |
| UT pass rate | 100% |
| IT pass rate | 100% |
| E2E-API pass rate | 100% |
| SIT parity pass rate | 90% (allow minor formatting differences) |
| Code coverage (line) | >= 85% |
| No Critical/High bugs open | 0 |

---

## 6. Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| KSA-173 API changes | Tests break | Mock KSA-173 interfaces in UT; integration tests catch real issues |
| Git not available in CI | SIT-05 fails | Skip git tests in CI, run locally |
| FTS5 behavior differences | Parity tests fail | Document acceptable differences |

# Software Test Cases (STC)

## MCP Code Intelligence — KSA-174: [Kotlin] AI Context Tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-174 |
| Title | [Kotlin] AI Context Tools — Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related STP | STP-v1-KSA-174.docx |

---

## 1. Property-Based Tests (PBT)

### PBT-01: Budget Assembly Never Exceeds Budget

| Field | Value |
|-------|-------|
| Component | TokenBudgetManager |
| Property | Total tokens of included sections <= budget |
| Generator | sections: List(1..20) of random content (10-5000 chars), budget: Int(500..8000) |
| Iterations | 1000 |
| Shrinking | Yes |

```kotlin
@Test
fun `budget assembly never exceeds budget`() = forAll(
    Arb.list(Arb.string(10..5000), 1..20),
    Arb.int(500..8000)
) { contents, budget ->
    val sections = contents.mapIndexed { i, c -> "section_$i" to SectionContent(c, i) }.toMap()
    val manager = TokenBudgetManager(budget)
    val result = manager.assemble(sections, budget)
    result.tokenCount <= budget
}
```

### PBT-02: RRF Scores Monotonically Decrease

| Field | Value |
|-------|-------|
| Component | RRFMerger |
| Property | merged[i].score >= merged[i+1].score for all i |
| Generator | 3 lists of 1-50 items each |
| Iterations | 1000 |

```kotlin
@Test
fun `RRF scores are monotonically decreasing`() = forAll(
    Arb.list(Arb.string(3..20), 1..50),
    Arb.list(Arb.string(3..20), 1..50),
    Arb.list(Arb.string(3..20), 1..50)
) { codeItems, memItems, graphItems ->
    val sources = mapOf(
        "code" to SearchResults(codeItems.map { SearchItem(it, "function", null) }),
        "memory" to SearchResults(memItems.map { SearchItem(it, "memory", null) }),
        "graph" to SearchResults(graphItems.map { SearchItem(it, "class", null) })
    )
    val merged = RRFMerger().merge(sources)
    merged.zipWithNext().all { (a, b) -> a.score >= b.score }
}
```

### PBT-03: Token Estimation Deterministic

| Field | Value |
|-------|-------|
| Component | TokenBudgetManager |
| Property | estimateTokens(s) == estimateTokens(s) |
| Generator | Random strings 0-10000 chars |
| Iterations | 1000 |

### PBT-04: Assembly Priority Ordering

| Field | Value |
|-------|-------|
| Component | TokenBudgetManager |
| Property | All included sections have lower priority than all excluded sections |
| Generator | Random sections with unique priorities |
| Iterations | 1000 |

---

## 2. Unit Tests (UT)

### UT-01: Token Estimation Short String

| Field | Value |
|-------|-------|
| Component | TokenBudgetManager |
| Input | "hello" (5 chars) |
| Expected | 2 tokens (ceil(5/4)) |
| Steps | 1. Create manager. 2. Call estimateTokens("hello"). 3. Assert == 2 |

### UT-02: Token Estimation 4000 Chars

| Field | Value |
|-------|-------|
| Component | TokenBudgetManager |
| Input | String of 4000 chars |
| Expected | 1000 tokens |
| Steps | 1. Create manager. 2. Call estimateTokens(4000-char string). 3. Assert == 1000 |

### UT-03: Assembly Budget Overflow

| Field | Value |
|-------|-------|
| Component | TokenBudgetManager |
| Input | 3 sections (800, 600, 400 tokens), budget=1000 |
| Expected | Only section with priority 1 (800 tokens) included |
| Steps | 1. Create sections with priorities 1,2,3. 2. Assemble with budget=1000. 3. Assert only priority-1 included |

### UT-04: Array Truncation

| Field | Value |
|-------|-------|
| Component | TokenBudgetManager |
| Input | Array of 10 items (100 tokens each), remaining budget=350 |
| Expected | 3 items included (300 tokens) |
| Steps | 1. Create array section. 2. Assemble with limited budget. 3. Assert partial array |

### UT-05: Symbol Resolution Class.method

| Field | Value |
|-------|-------|
| Component | SymbolResolver |
| Input | "AIContextService.getContext" |
| Expected | ResolvedSymbol(name="getContext", parentName="AIContextService") |
| Setup | DB with method "getContext" having parent "AIContextService" |

### UT-06: Symbol Resolution file:symbol

| Field | Value |
|-------|-------|
| Component | SymbolResolver |
| Input | "src/context/Types.kt:CuratedContextParams" |
| Expected | ResolvedSymbol(name="CuratedContextParams", filePath="src/context/Types.kt") |

### UT-07: Symbol Resolution Plain Name

| Field | Value |
|-------|-------|
| Component | SymbolResolver |
| Input | "TokenBudgetManager" |
| Expected | ResolvedSymbol(name="TokenBudgetManager", kind=CLASS) |

### UT-08: Symbol Resolution Not Found

| Field | Value |
|-------|-------|
| Component | SymbolResolver |
| Input | "NonExistentSymbol12345" |
| Expected | null |

### UT-09: Edit Context All Flags True

| Field | Value |
|-------|-------|
| Component | EditContextService |
| Input | symbol="getContext", all include flags = true |
| Expected | Response has source, callers, tests, git, siblings |
| Setup | Mock resolver, callGraph, testDetector, gitService |

### UT-10: Edit Context No Callers

| Field | Value |
|-------|-------|
| Component | EditContextService |
| Input | symbol="getContext", include_callers=false |
| Expected | Response has source, tests, git, siblings (no callers) |

### UT-11: Edit Context No Tests

| Field | Value |
|-------|-------|
| Component | EditContextService |
| Input | symbol="getContext", include_tests=false |
| Expected | Response has source, callers, git, siblings (no tests) |

### UT-12: Edit Context No Git

| Field | Value |
|-------|-------|
| Component | EditContextService |
| Input | symbol="getContext", include_git=false |
| Expected | Response has source, callers, tests, siblings (no git) |

### UT-13: Git Service Parse Valid Output

| Field | Value |
|-------|-------|
| Component | GitService |
| Input | "a1b2c3d|John|2026-05-20|fix bug\ne4f5g6h|Jane|2026-05-19|add feature" |
| Expected | List of 2 GitCommit objects |

### UT-14: Git Service Parse Empty

| Field | Value |
|-------|-------|
| Component | GitService |
| Input | "" |
| Expected | emptyList() |

### UT-15: RRF Merge No Overlap

| Field | Value |
|-------|-------|
| Component | RRFMerger |
| Input | code=[A,B,C], memory=[D,E,F] |
| Expected | 6 results, sorted by RRF score |

### UT-16: RRF Merge With Overlap

| Field | Value |
|-------|-------|
| Component | RRFMerger |
| Input | code=[A,B,C], memory=[B,D,E] |
| Expected | 5 results (B deduplicated, score summed), B ranked higher |

### UT-17: RRF Custom Weights

| Field | Value |
|-------|-------|
| Component | RRFMerger |
| Input | code=[A], memory=[B], weights={code:0.5, memory:2.0} |
| Expected | B ranked higher than A |

### UT-18: Query Analyzer NL Query

| Field | Value |
|-------|-------|
| Component | QueryAnalyzer |
| Input | "how does authentication work" |
| Expected | keywords=["authentication", "work"], ftsQuery="authentication OR work" |

### UT-19: Query Analyzer Symbol Detection

| Field | Value |
|-------|-------|
| Component | QueryAnalyzer |
| Input | "TokenBudgetManager assemble method" |
| Expected | symbolCandidates=["TokenBudgetManager"], keywords=["assemble", "method"] |

### UT-20: Intent Strategy Modify

| Field | Value |
|-------|-------|
| Component | IntentStrategies |
| Input | ContextIntent.MODIFY |
| Expected | sections[0].name="source", sections[1].name="callers", sections[2].name="callees" |

---

## 3. Integration Tests (IT)

### IT-01: get_ai_context Real DB

| Field | Value |
|-------|-------|
| Setup | In-memory SQLite with 50 symbols, 30 call graph edges, FTS5 index |
| Input | symbol="getContext", intent="explain", budget=4000 |
| Expected | Response with source section, callers from DB, within budget |
| Teardown | Close DB connection |

### IT-02: All Intents Different Sections

| Field | Value |
|-------|-------|
| Setup | Same DB as IT-01 |
| Input | Same symbol, 4 different intents |
| Expected | Each intent produces different section ordering |
| Verification | explain has doc_comment at priority 2; modify has callers at priority 2 |

### IT-03: Budget Overflow

| Field | Value |
|-------|-------|
| Setup | DB with symbol having 2000-token source |
| Input | budget=1000 |
| Expected | Only source section (truncated to fit) |

### IT-04: Caller Depth Traversal

| Field | Value |
|-------|-------|
| Setup | Call chain: A→B→C→D in DB |
| Input | symbol="D", caller_depth=2 |
| Expected | Callers include B and C (2 levels up) |

### IT-05: Edit Context Full

| Field | Value |
|-------|-------|
| Setup | DB + test git repo with commits |
| Input | symbol="getContext", all flags true |
| Expected | All sections populated including git |

### IT-06: Edit Context No Git Repo

| Field | Value |
|-------|-------|
| Setup | DB only, no .git directory |
| Input | symbol="getContext", include_git=true |
| Expected | Git section empty, no error thrown |

### IT-07: Edit Context file:line Format

| Field | Value |
|-------|-------|
| Setup | DB with symbol at specific file:line |
| Input | symbol="src/context/AIContextService.kt:10" |
| Expected | Resolves to symbol at line 10 |

### IT-08: Curated Context FTS Search

| Field | Value |
|-------|-------|
| Setup | FTS5 table with 100 symbols |
| Input | query="budget manager token" |
| Expected | TokenBudgetManager in top results |

### IT-09: Curated Context RRF Merge

| Field | Value |
|-------|-------|
| Setup | Code results + memory results with overlap |
| Input | query="context service" |
| Expected | Overlapping results have higher score |

### IT-10: Curated Context Graph Expansion

| Field | Value |
|-------|-------|
| Setup | Code results + call graph edges |
| Input | query="budget", include_graph=true |
| Expected | Graph section has neighbors of top code results |

---

## 4. E2E API Tests (E2E-API)

### E2E-01: get_ai_context Happy Path

| Field | Value |
|-------|-------|
| Tool | get_ai_context |
| Input | {"symbol": "TestClass.testMethod", "intent": "explain"} |
| Expected | 200, sections.source is non-empty, metadata.tokens_used > 0 |

### E2E-02: get_ai_context Symbol Not Found

| Field | Value |
|-------|-------|
| Tool | get_ai_context |
| Input | {"symbol": "CompletelyFakeSymbol999"} |
| Expected | 200, symbol=null, metadata.error contains "not found" |

### E2E-03: get_ai_context Debug Intent

| Field | Value |
|-------|-------|
| Tool | get_ai_context |
| Input | {"symbol": "realSymbol", "intent": "debug"} |
| Expected | sections includes error_patterns (if available) |

### E2E-04: get_ai_context Minimal Budget

| Field | Value |
|-------|-------|
| Tool | get_ai_context |
| Input | {"symbol": "realSymbol", "token_budget": 500} |
| Expected | metadata.tokens_used <= 500 |

### E2E-05 to E2E-12: (Similar structure for edit_context and curated_context)

---

## 5. System Integration Tests (SIT) — Parity

### SIT-01: Section Names Match

| Field | Value |
|-------|-------|
| Method | Run same input on Kotlin and Node.js, compare section names |
| Input | symbol="TokenBudgetManager", intent="explain" |
| Pass | Same set of section names in response |

### SIT-02: Token Count Within 10%

| Field | Value |
|-------|-------|
| Method | Compare metadata.tokens_used |
| Input | Various symbols and intents |
| Pass | abs(kotlin_tokens - nodejs_tokens) / nodejs_tokens < 0.10 |

### SIT-03: RRF Ranking Order

| Field | Value |
|-------|-------|
| Method | Same curated query on both, compare top 5 |
| Input | query="how does indexing work" |
| Pass | Top 5 results in same order (by name) |

### SIT-04: Symbol Resolution Parity

| Field | Value |
|-------|-------|
| Method | Same symbol formats on both |
| Input | "Class.method", "file:symbol", "plainName" |
| Pass | Same resolved symbol (name, file, line) |

### SIT-05: Error Response Structure

| Field | Value |
|-------|-------|
| Method | Same invalid inputs on both |
| Input | nonexistent symbol, invalid intent |
| Pass | Same JSON structure in error response |

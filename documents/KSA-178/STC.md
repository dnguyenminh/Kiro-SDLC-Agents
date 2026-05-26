# Software Test Cases (STC)

## MCP Code Intelligence — KSA-178: [Python] Tree-sitter Core + Parsers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-178 |
| Title | [Python] Tree-sitter Core + Parsers |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related STP | STP-v1-KSA-178.docx |

---

## 1. Unit Tests (UT)

### TC-UT-001: Parser Initialization Success

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P0 |
| Requirement | STORY-1 |
| Automation | pytest |

**Steps:**
1. Import `TreeSitterParser` class
2. Call `parser.initialize()`
3. Assert no exception raised
4. Assert `parser.is_initialized` is True

**Expected:** Parser initializes successfully on Python 3.11+

---

### TC-UT-002: Parser Initialization Failure (Missing Library)

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P0 |
| Requirement | STORY-1 |
| Automation | pytest |

**Steps:**
1. Mock py-tree-sitter import to raise ImportError
2. Call `parser.initialize()`
3. Assert `ParserInitError` raised with install instructions

**Expected:** Clear error message with "pip install tree-sitter"

---

### TC-UT-003: Parse Valid Source (Python)

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P0 |
| Requirement | STORY-1 |
| Automation | pytest |

**Steps:**
1. Initialize parser with Python grammar
2. Parse `b"def hello():\n    return 42"`
3. Assert `result.has_errors` is False
4. Assert `result.ast.type` == "module"
5. Assert `result.ast.children[0].type` == "function_definition"

**Expected:** Complete AST with correct root and function node

---

### TC-UT-004: Parse Invalid Source (Syntax Error)

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P0 |
| Requirement | STORY-1 |
| Automation | pytest |

**Steps:**
1. Initialize parser with Python grammar
2. Parse `b"def hello(\n    return"`
3. Assert `result.has_errors` is True
4. Assert `result.error_count` > 0
5. Assert AST contains ERROR node

**Expected:** Partial AST with error nodes marked

---

### TC-UT-005: Parse Empty Source

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P1 |
| Requirement | STORY-1 |
| Automation | pytest |

**Steps:**
1. Initialize parser with Python grammar
2. Parse `b""`
3. Assert `result.has_errors` is False
4. Assert `result.ast.children` is empty list

**Expected:** Valid empty AST

---

### TC-UT-006: Language Detection from Extension

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P0 |
| Requirement | STORY-2 |
| Automation | pytest |

**Steps:**
1. Call `detect_language(".py")` → assert "python"
2. Call `detect_language(".ts")` → assert "typescript"
3. Call `detect_language(".kt")` → assert "kotlin"
4. Call `detect_language(".rs")` → assert "rust"
5. Call `detect_language(".unknown")` → assert None

**Expected:** All 12 extensions correctly mapped

---

### TC-UT-007: Grammar Load Success

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P0 |
| Requirement | STORY-2 |
| Automation | pytest |

**Steps:**
1. Create GrammarRegistry with valid grammar directory
2. Call `registry.load("python")`
3. Assert Language object returned
4. Assert `registry.is_loaded("python")` is True

**Expected:** Grammar loaded and cached

---

### TC-UT-008: Grammar Load Failure (Missing)

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P0 |
| Requirement | STORY-2 |
| Automation | pytest |

**Steps:**
1. Create GrammarRegistry with empty directory
2. Call `registry.load("python")`
3. Assert `GrammarNotFoundError` raised

**Expected:** Clear error with grammar path

---

### TC-UT-009: Incremental Parse Single Char Edit

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P1 |
| Requirement | STORY-4 |
| Automation | pytest |

**Steps:**
1. Parse `b"def hello(): pass"` → get tree
2. Edit: insert "x" at byte 4 → `b"def xhello(): pass"`
3. Call `incremental_parse(tree, edit, new_source)`
4. Assert result AST matches full re-parse of new source

**Expected:** Incremental result identical to full parse

---

### TC-UT-010: Incremental Parse Fallback (Large Edit)

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P1 |
| Requirement | STORY-4 |
| Automation | pytest |

**Steps:**
1. Parse small source (100 bytes)
2. Create edit replacing 50 bytes (50% > 30% threshold)
3. Call `incremental_parse()`
4. Assert full re-parse was triggered (via mock/spy)

**Expected:** Fallback to full parse when edit > 30%

---

### TC-UT-011: Incremental Parse No Previous Tree

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P1 |
| Requirement | STORY-4 |
| Automation | pytest |

**Steps:**
1. Call `incremental_parse()` for file not in cache
2. Assert full parse executed
3. Assert tree cached after parse

**Expected:** Graceful fallback to full parse

---

### TC-UT-012: Incremental Parse Cache Eviction

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P2 |
| Requirement | STORY-4 |
| Automation | pytest |

**Steps:**
1. Set MAX_CACHE_SIZE = 3
2. Parse 5 different files
3. Assert cache size <= 3
4. Assert oldest entries evicted

**Expected:** LRU eviction works correctly

---

### TC-UT-013: Symbol Extraction — Python Function

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P0 |
| Requirement | STORY-5 |
| Automation | pytest |

**Steps:**
1. Parse `b"def hello(name: str) -> int:\n    return 42"`
2. Extract symbols
3. Assert 1 symbol: name="hello", kind=FUNCTION, params=[Parameter("name", "str")]

**Expected:** Function with parameters extracted

---

### TC-UT-014: Symbol Extraction — Python Class

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P0 |
| Requirement | STORY-5 |
| Automation | pytest |

**Steps:**
1. Parse Python class with methods
2. Extract symbols
3. Assert class symbol + method symbols with correct scope

**Expected:** Class and methods with scope hierarchy

---

### TC-UT-015: Symbol Extraction — Nested Scopes

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P0 |
| Requirement | STORY-5 |
| Automation | pytest |

**Steps:**
1. Parse class with nested class and inner function
2. Extract symbols
3. Assert scope chain: module → OuterClass → InnerClass → method

**Expected:** Correct scope hierarchy

---

### TC-UT-016: Symbol Extraction — TypeScript

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P0 |
| Requirement | STORY-5 |
| Automation | pytest |

**Steps:**
1. Parse TypeScript interface + class + function
2. Extract symbols
3. Assert interface, class, function symbols with correct kinds

**Expected:** TypeScript-specific constructs handled

---

### TC-UT-017: Symbol Extraction — Kotlin

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P1 |
| Requirement | STORY-5 |
| Automation | pytest |

**Steps:**
1. Parse Kotlin data class + companion object + extension function
2. Extract symbols
3. Assert Kotlin-specific constructs (companion, extension)

**Expected:** Kotlin constructs handled

---

### TC-UT-018: Symbol Extraction — Visibility Modifiers

| Field | Value |
|-------|-------|
| Level | UT |
| Priority | P1 |
| Requirement | STORY-5 |
| Automation | pytest |

**Steps:**
1. Parse source with public/private/protected members
2. Extract symbols
3. Assert visibility correctly set on each symbol

**Expected:** Visibility modifiers extracted per language

---

## 2. Integration Tests (IT)

### TC-IT-001: Full Parse Pipeline (Python File)

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P0 |
| Requirement | STORY-1 |
| Automation | pytest |

**Steps:**
1. Write a real Python file to temp directory
2. Call `parser.parse_file(path)`
3. Assert ParseResult returned with valid AST
4. Assert parse_time_ms > 0
5. Assert language == "python"

**Expected:** End-to-end parse of real file works

---

### TC-IT-002: Full Parse Pipeline (All 12 Languages)

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P0 |
| Requirement | STORY-2 |
| Automation | pytest (parametrized) |

**Steps:**
1. For each of 12 languages, load a sample source file
2. Call `parser.parse_file(path)`
3. Assert no errors for valid files
4. Assert AST root node type is correct per language

**Expected:** All 12 languages parse successfully

---

### TC-IT-003: Concurrent Parsing (10 Files)

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P0 |
| Requirement | STORY-1 (AC-5) |
| Automation | pytest |

**Steps:**
1. Prepare 10 source files (mixed languages)
2. Parse all 10 concurrently via ParserPool
3. Assert all 10 results valid
4. Assert no data corruption (each result matches sequential parse)

**Expected:** Concurrent parsing produces correct results

---

### TC-IT-004: Grammar Loading All 12 Languages

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P0 |
| Requirement | STORY-2 |
| Automation | pytest |

**Steps:**
1. Create GrammarRegistry
2. Load all 12 grammars sequentially
3. Assert all loaded successfully
4. Parse empty string with each grammar (validation)

**Expected:** All grammars load and validate

---

### TC-IT-005: Grammar Lazy Loading

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P1 |
| Requirement | BR-03 |
| Automation | pytest |

**Steps:**
1. Create GrammarRegistry
2. Assert no grammars loaded initially
3. Parse a Python file
4. Assert only Python grammar loaded
5. Parse a TypeScript file
6. Assert Python + TypeScript loaded

**Expected:** Grammars loaded on demand only

---

### TC-IT-006: Grammar Caching (Thread Safety)

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P1 |
| Requirement | BR-02 |
| Automation | pytest |

**Steps:**
1. Create GrammarRegistry
2. Load "python" from 10 threads simultaneously
3. Assert grammar loaded exactly once (no duplicate loads)
4. Assert all threads got same Language object

**Expected:** Thread-safe grammar caching

---

### TC-IT-007: AST Parity — Node Types Match nodejs

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P0 |
| Requirement | STORY-3 |
| Automation | pytest |

**Steps:**
1. Parse test fixture file with Python parser
2. Load reference AST JSON from nodejs output
3. Compare node types at each position
4. Assert 100% match

**Expected:** Node types identical to nodejs

---

### TC-IT-008: AST Parity — Positions Match nodejs

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P0 |
| Requirement | STORY-3 |
| Automation | pytest |

**Steps:**
1. Parse test fixture file
2. Load reference AST JSON
3. Compare start_position, end_position, start_byte, end_byte
4. Assert all positions match within tolerance 0

**Expected:** Position information identical

---

### TC-IT-009: AST Parity — 50 Fixture Files

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P0 |
| Requirement | STORY-3 (AC-5) |
| Automation | pytest (parametrized) |

**Steps:**
1. For each of 50+ test fixture files (across 12 languages)
2. Parse with Python parser
3. Compare full AST JSON with nodejs reference
4. Assert match

**Expected:** >= 50 fixtures pass comparison

---

### TC-IT-010: Incremental Parse — Real File Edit

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P1 |
| Requirement | STORY-4 |
| Automation | pytest |

**Steps:**
1. Parse a real 1K LOC Python file
2. Simulate adding a new function (multi-line edit)
3. Call incremental_parse with edit
4. Assert result matches full re-parse of modified file

**Expected:** Incremental parse correct for real edits

---

### TC-IT-011: Incremental Parse — Performance (< 10ms)

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P1 |
| Requirement | STORY-4 (AC-1) |
| Automation | pytest-benchmark |

**Steps:**
1. Parse a 10K LOC file
2. Apply single-character edit
3. Measure incremental parse time
4. Assert < 10ms

**Expected:** Single-char incremental parse < 10ms

---

### TC-IT-012: Incremental Parse — Memory Stability

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P2 |
| Requirement | STORY-4 (AC-4) |
| Automation | pytest |

**Steps:**
1. Parse a file
2. Apply 1000 sequential single-char edits
3. Measure RSS after each 100 edits
4. Assert RSS growth < 50MB total

**Expected:** No unbounded memory growth

---

### TC-IT-013: Symbol Extraction — All Languages

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P0 |
| Requirement | STORY-5 |
| Automation | pytest (parametrized) |

**Steps:**
1. For each of 12 languages, parse a sample file with known symbols
2. Extract symbols
3. Compare with expected symbol list
4. Assert all symbols found with correct kind and scope

**Expected:** Symbol extraction works for all 12 languages

---

### TC-IT-014: Symbol Extraction — Parity with nodejs

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P0 |
| Requirement | STORY-5 (AC-1) |
| Automation | pytest |

**Steps:**
1. Parse test fixture files
2. Extract symbols with Python extractor
3. Load reference symbol list from nodejs
4. Compare (name, kind, scope, position)
5. Assert match

**Expected:** Symbol extraction matches nodejs output

---

### TC-IT-015: Symbol Extraction — Performance (1000 files < 3s)

| Field | Value |
|-------|-------|
| Level | IT |
| Priority | P1 |
| Requirement | STORY-5 (AC-5) |
| Automation | pytest-benchmark |

**Steps:**
1. Prepare 1000 source files (mixed languages)
2. Parse all files
3. Extract symbols from all ASTs
4. Measure total time
5. Assert < 3s

**Expected:** Batch symbol extraction within target

---

## 3. Property-Based Tests (PBT)

### TC-PBT-001: Any Valid Source Parses Without Crash

| Field | Value |
|-------|-------|
| Level | PBT |
| Priority | P0 |
| Requirement | STORY-1 |
| Automation | hypothesis |

**Strategy:** Generate random valid Python/JS source strings, assert parse never raises unhandled exception.

---

### TC-PBT-002: Incremental Parse == Full Re-parse

| Field | Value |
|-------|-------|
| Level | PBT |
| Priority | P1 |
| Requirement | STORY-4 |
| Automation | hypothesis |

**Strategy:** Generate random source, random edit position/content. Assert incremental parse AST == full re-parse AST.

---

### TC-PBT-003: Symbol Extraction Deterministic

| Field | Value |
|-------|-------|
| Level | PBT |
| Priority | P1 |
| Requirement | STORY-5 |
| Automation | hypothesis |

**Strategy:** Parse same source N times, extract symbols each time. Assert all N results identical.

---

### TC-PBT-004: AST Positions Monotonic

| Field | Value |
|-------|-------|
| Level | PBT |
| Priority | P1 |
| Requirement | STORY-3 |
| Automation | hypothesis |

**Strategy:** For any parsed AST, assert start_byte <= end_byte for all nodes, and parent spans contain children.

---

### TC-PBT-005: Concurrent Parse Results Independent

| Field | Value |
|-------|-------|
| Level | PBT |
| Priority | P1 |
| Requirement | STORY-1 |
| Automation | hypothesis |

**Strategy:** Parse same file in N processes simultaneously. Assert all results identical.

---

## 4. E2E API Tests

### TC-E2E-001: Parse File via Public API

| Field | Value |
|-------|-------|
| Level | E2E-API |
| Priority | P0 |
| Requirement | STORY-1 |
| Automation | pytest |

**Steps:**
1. Create TreeSitterParser instance
2. Call `parser.parse_file(Path("tests/fixtures/valid/sample.py"))`
3. Assert ParseResult with valid AST, language="python", no errors

---

### TC-E2E-002: Parse File — Unsupported Language

| Field | Value |
|-------|-------|
| Level | E2E-API |
| Priority | P0 |
| Requirement | STORY-1 |
| Automation | pytest |

**Steps:**
1. Call `parser.parse_file(Path("file.xyz"))`
2. Assert `UnsupportedLanguageError` raised

---

### TC-E2E-003: Parse All 12 Languages via API

| Field | Value |
|-------|-------|
| Level | E2E-API |
| Priority | P0 |
| Requirement | STORY-2 |
| Automation | pytest (parametrized) |

**Steps:**
1. For each language, parse a valid sample file
2. Assert successful parse with correct language detection

---

### TC-E2E-004: Supported Languages List

| Field | Value |
|-------|-------|
| Level | E2E-API |
| Priority | P1 |
| Requirement | STORY-2 |
| Automation | pytest |

**Steps:**
1. Call `parser.supported_languages()`
2. Assert returns list of 12 language IDs

---

### TC-E2E-005: AST JSON Output Matches nodejs

| Field | Value |
|-------|-------|
| Level | E2E-API |
| Priority | P0 |
| Requirement | STORY-3 |
| Automation | pytest |

**Steps:**
1. Parse fixture file
2. Serialize AST to JSON
3. Compare with nodejs reference JSON
4. Assert structural equality

---

### TC-E2E-006: AST Traversal Order Matches nodejs

| Field | Value |
|-------|-------|
| Level | E2E-API |
| Priority | P0 |
| Requirement | STORY-3 |
| Automation | pytest |

**Steps:**
1. Parse fixture file
2. Traverse AST pre-order, collect node types
3. Compare sequence with nodejs pre-order traversal
4. Assert identical sequence

---

### TC-E2E-007: Extract Symbols via API

| Field | Value |
|-------|-------|
| Level | E2E-API |
| Priority | P0 |
| Requirement | STORY-5 |
| Automation | pytest |

**Steps:**
1. Parse a Python file with known symbols
2. Call `parser.extract_symbols(ast, "python")`
3. Assert correct symbols returned with name, kind, scope

---

### TC-E2E-008: Extract Symbols — Filter by Kind

| Field | Value |
|-------|-------|
| Level | E2E-API |
| Priority | P1 |
| Requirement | STORY-5 |
| Automation | pytest |

**Steps:**
1. Parse file with functions, classes, variables
2. Filter symbols by kind=FUNCTION
3. Assert only function symbols returned

---

## 5. E2E UI Tests (MCP Tools)

### TC-E2E-UI-001: MCP parse_file Tool

| Field | Value |
|-------|-------|
| Level | E2E-UI |
| Priority | P0 |
| Requirement | STORY-1 |
| Automation | pytest (JSON-RPC client) |

**Steps:**
1. Start MCP server
2. Send `tools/call` with `parse_file` tool, file_path param
3. Assert response contains AST JSON

---

### TC-E2E-UI-002: MCP get_symbols Tool

| Field | Value |
|-------|-------|
| Level | E2E-UI |
| Priority | P0 |
| Requirement | STORY-5 |
| Automation | pytest (JSON-RPC client) |

**Steps:**
1. Send `tools/call` with `get_symbols` tool
2. Assert response contains symbol list

---

### TC-E2E-UI-003: MCP Tool Error Handling

| Field | Value |
|-------|-------|
| Level | E2E-UI |
| Priority | P1 |
| Automation | pytest |

**Steps:**
1. Send `parse_file` with non-existent path
2. Assert error response with appropriate code

---

### TC-E2E-UI-004: MCP Tool — Large File

| Field | Value |
|-------|-------|
| Level | E2E-UI |
| Priority | P1 |
| Automation | pytest |

**Steps:**
1. Send `parse_file` for 10K LOC file
2. Assert response within 5s timeout
3. Assert valid AST returned

---

### TC-E2E-UI-005: MCP Tool — Visual Verification (Manual)

| Field | Value |
|-------|-------|
| Level | E2E-UI |
| Priority | P2 |
| Automation | Manual |

**Steps:**
1. Connect MCP client (IDE) to server
2. Open a project with multiple languages
3. Verify parse results display correctly in IDE
4. Verify symbol navigation works

---

## 6. System Integration Tests (SIT)

### TC-SIT-001: Python vs nodejs AST Comparison (50 files)

| Field | Value |
|-------|-------|
| Level | SIT |
| Priority | P0 |
| Requirement | STORY-3 |
| Automation | pytest + subprocess |

**Steps:**
1. Run nodejs parser on 50 fixture files → save JSON
2. Run Python parser on same 50 files → save JSON
3. Deep-compare all JSON outputs
4. Assert >= 99% parity

---

### TC-SIT-002: Python vs Kotlin AST Comparison

| Field | Value |
|-------|-------|
| Level | SIT |
| Priority | P1 |
| Automation | pytest |

**Steps:**
1. Run Kotlin parser (KSA-172) on fixture files
2. Run Python parser on same files
3. Compare AST outputs
4. Assert structural match

---

### TC-SIT-003: Cross-Platform Consistency (Linux/macOS/Windows)

| Field | Value |
|-------|-------|
| Level | SIT |
| Priority | P1 |
| Automation | CI matrix |

**Steps:**
1. Run full test suite on Linux x64
2. Run full test suite on macOS arm64
3. Run full test suite on Windows x64
4. Assert all pass with identical results

---

### TC-SIT-004: Python Version Matrix (3.11, 3.12, 3.13)

| Field | Value |
|-------|-------|
| Level | SIT |
| Priority | P1 |
| Automation | CI matrix |

**Steps:**
1. Run full test suite on Python 3.11
2. Run full test suite on Python 3.12
3. Run full test suite on Python 3.13
4. Assert all pass

---

### TC-SIT-005: End-to-End MCP Integration (Manual)

| Field | Value |
|-------|-------|
| Level | SIT |
| Priority | P2 |
| Automation | Manual |

**Steps:**
1. Start Python MCP server
2. Connect from IDE (VS Code + MCP extension)
3. Open polyglot project
4. Verify all languages parse correctly
5. Verify symbol search works across languages

---

## 7. Performance Tests (PERF)

### TC-PERF-001: Parse 1K LOC File < 50ms

**Benchmark:** Parse a 1000-line Python file, assert median < 50ms over 100 iterations.

### TC-PERF-002: Parse 10K LOC File < 500ms

**Benchmark:** Parse a 10000-line TypeScript file, assert median < 500ms over 50 iterations.

### TC-PERF-003: Batch Parse 1000 Files < 30s

**Benchmark:** Parse 1000 mixed-language files via ParserPool, assert total < 30s.

### TC-PERF-004: Incremental Parse Single Char < 10ms

**Benchmark:** Single-character edit on 10K LOC file, assert median < 10ms over 1000 iterations.

### TC-PERF-005: Incremental Parse 50 Lines < 50ms

**Benchmark:** 50-line edit on 10K LOC file, assert median < 50ms over 100 iterations.

### TC-PERF-006: Symbol Extraction Single File < 20ms

**Benchmark:** Extract symbols from 1K LOC file, assert median < 20ms over 100 iterations.

### TC-PERF-007: Symbol Extraction 1000 Files < 3s

**Benchmark:** Extract symbols from 1000 files, assert total < 3s.

### TC-PERF-008: Grammar Load < 100ms

**Benchmark:** Cold-load a grammar, assert < 100ms per language.

---

## 8. Error Handling Tests (ERR)

### TC-ERR-001: FileNotFoundError

Parse non-existent file → assert FileNotFoundError raised.

### TC-ERR-002: UnsupportedLanguageError

Parse file with unknown extension → assert UnsupportedLanguageError.

### TC-ERR-003: GrammarNotFoundError

Load grammar for language with missing .so file → assert GrammarNotFoundError.

### TC-ERR-004: Parse Timeout

Parse extremely large/complex file (> 5s) → assert timeout with partial result.

### TC-ERR-005: Invalid Edit Range

Apply edit with start_byte > source length → assert InvalidEditError.

### TC-ERR-006: Memory Limit

Parse file > 50MB → assert appropriate error (not OOM crash).

### TC-ERR-007: Concurrent Error Isolation

One file fails in batch → assert other files still parse correctly.

---

## 9. Memory Tests (MEM)

### TC-MEM-001: 100-File Project < 256MB RSS

Parse 100 files, hold all ASTs in memory, assert RSS < 256MB.

### TC-MEM-002: 1000-File Project < 2GB RSS

Parse 1000 files, hold all ASTs + symbols, assert RSS < 2GB.

### TC-MEM-003: No Memory Leak (10K Parses)

Parse 10000 files sequentially (releasing each), assert RSS stable (< 10% growth).

---

## 10. Concurrency Tests (CONC)

### TC-CONC-001: 10 Concurrent Parses (Multiprocessing)

Parse 10 files in parallel via ProcessPoolExecutor, assert all results correct.

### TC-CONC-002: Grammar Registry Thread Safety

Load same grammar from 20 threads simultaneously, assert no race condition.

### TC-CONC-003: Tree Cache Concurrent Access

Read/write tree cache from multiple threads, assert no corruption.

### TC-CONC-004: Batch Parse 100 Files (Stress)

Parse 100 files via ParserPool with 4 workers, assert all complete within 30s.

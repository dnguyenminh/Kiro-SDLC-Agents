# Software Test Cases (STC)

## MCP Code Intelligence — KSA-172: [Kotlin] Tree-sitter Core + Parsers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-172 |
| Title | [Kotlin] Tree-sitter Core + Parsers |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related STP | STP-v1-KSA-172.docx |

---

## 1. Property-Based Tests (PBT)

### PBT-01: Parse Roundtrip Invariant

| Field | Value |
|-------|-------|
| ID | PBT-01 |
| Title | Any valid source code produces a non-null AST with root node |
| Level | PBT |
| Priority | Critical |
| Automation | jqwik |
| Requirement | STORY-1 |

**Property:** For any randomly generated valid source string S and supported language L, `parse(S, L)` returns a ParseResult where `ast.type == "program"` (or language-specific root) and `ast.children.isNotEmpty()`.

**Generator:** Random valid code snippets per language (function declarations, class declarations, expressions).

**Iterations:** 1000 per language.

---

### PBT-02: Incremental Parse Equivalence

| Field | Value |
|-------|-------|
| ID | PBT-02 |
| Title | Incremental parse produces same AST as full re-parse |
| Level | PBT |
| Priority | Critical |
| Automation | jqwik |
| Requirement | STORY-4 |

**Property:** For any source S, random edit E applied to S producing S', `incrementalParse(tree(S), E, S').ast == parse(S').ast`.

**Generator:** Random edits (insert char, delete line, replace word) at random positions.

**Iterations:** 500 per language.

---

### PBT-03: Symbol Extraction Determinism

| Field | Value |
|-------|-------|
| ID | PBT-03 |
| Title | Symbol extraction is deterministic — same input always produces same output |
| Level | PBT |
| Priority | High |
| Automation | jqwik |
| Requirement | STORY-5 |

**Property:** For any source S, `extractSymbols(parse(S).ast, L) == extractSymbols(parse(S).ast, L)` (repeated calls produce identical results).

**Iterations:** 500.

---

### PBT-04: Concurrent Parse Safety

| Field | Value |
|-------|-------|
| ID | PBT-04 |
| Title | Concurrent parsing never produces corrupted results |
| Level | PBT |
| Priority | Critical |
| Automation | jqwik + coroutines |
| Requirement | NFR-THREAD |

**Property:** Parsing N files concurrently (N = 2..20) produces the same results as parsing them sequentially.

**Iterations:** 100 (with varying N and file combinations).

---

## 2. Unit Tests (UT)

### UT-01: Parser Initialization Success

| Field | Value |
|-------|-------|
| ID | UT-01 |
| Precondition | Native library on classpath |
| Steps | 1. Call `parser.initialize()` |
| Expected | No exception thrown, parser ready |
| Requirement | STORY-1 |

### UT-02: Parser Initialization Failure — Missing Library

| Field | Value |
|-------|-------|
| ID | UT-02 |
| Precondition | Native library NOT on classpath |
| Steps | 1. Call `parser.initialize()` |
| Expected | `ParserInitializationException` thrown with platform details |
| Requirement | STORY-1, BR-10 |

### UT-03: Parse Valid Kotlin File

| Field | Value |
|-------|-------|
| ID | UT-03 |
| Precondition | Parser initialized, Kotlin grammar loaded |
| Steps | 1. Call `parse(kotlinSource, "kotlin")` |
| Expected | ParseResult with hasErrors=false, ast.type="source_file" |
| Requirement | STORY-1 |

### UT-04: Parse File with Syntax Errors

| Field | Value |
|-------|-------|
| ID | UT-04 |
| Precondition | Parser initialized |
| Steps | 1. Call `parse(invalidSource, "kotlin")` |
| Expected | ParseResult with hasErrors=true, errorCount > 0, partial AST returned |
| Requirement | STORY-1, BR-10 |

### UT-05: Parse Empty File

| Field | Value |
|-------|-------|
| ID | UT-05 |
| Precondition | Parser initialized |
| Steps | 1. Call `parse(emptyBytes, "kotlin")` |
| Expected | ParseResult with empty AST (root node, no children) |
| Requirement | STORY-1 |

### UT-06: Load All 12 Grammars

| Field | Value |
|-------|-------|
| ID | UT-06 |
| Precondition | Parser initialized, grammar files available |
| Steps | 1. For each of 12 languages, call `loadLanguage(lang)` |
| Expected | All return true |
| Requirement | STORY-2 |

### UT-07: Load Unknown Grammar

| Field | Value |
|-------|-------|
| ID | UT-07 |
| Precondition | Parser initialized |
| Steps | 1. Call `loadLanguage("brainfuck")` |
| Expected | `GrammarNotFoundException` thrown |
| Requirement | STORY-2, BR-01 |

### UT-08: Language Detection from Extension

| Field | Value |
|-------|-------|
| ID | UT-08 |
| Steps | 1. Call `detectFromExtension("file.kt")` → "kotlin" |
|  | 2. Call `detectFromExtension("file.tsx")` → "typescript" |
|  | 3. Call `detectFromExtension("file.unknown")` → null |
| Expected | Correct language IDs returned |
| Requirement | STORY-2, BR-01 |

### UT-09: Incremental Parse — Single Char Insert

| Field | Value |
|-------|-------|
| ID | UT-09 |
| Precondition | Existing parse tree for a file |
| Steps | 1. Insert one character at position 50 |
|  | 2. Call `incrementalParse(tree, edit, newSource)` |
| Expected | ParseResult returned in < 10ms, AST matches full re-parse |
| Requirement | STORY-4 |

### UT-10: Incremental Parse — Multi-line Edit

| Field | Value |
|-------|-------|
| ID | UT-10 |
| Precondition | Existing parse tree |
| Steps | 1. Replace 20 lines in middle of file |
|  | 2. Call `incrementalParse(tree, edit, newSource)` |
| Expected | ParseResult returned in < 50ms |
| Requirement | STORY-4 |

### UT-11: Incremental Parse — Fallback to Full Parse

| Field | Value |
|-------|-------|
| ID | UT-11 |
| Precondition | Existing parse tree for 100-line file |
| Steps | 1. Replace 40 lines (> 30% of file) |
|  | 2. Call `incrementalParse(tree, edit, newSource)` |
| Expected | Falls back to full parse (still returns correct result) |
| Requirement | STORY-4, BR-08 |

### UT-12: Incremental Parse — No Previous Tree

| Field | Value |
|-------|-------|
| ID | UT-12 |
| Precondition | No cached tree for file |
| Steps | 1. Call `incrementalParse` for uncached file |
| Expected | Falls back to full parse |
| Requirement | STORY-4 |

### UT-13: Extract Function Symbols

| Field | Value |
|-------|-------|
| ID | UT-13 |
| Precondition | Parsed Kotlin file with functions |
| Steps | 1. Call `extractSymbols(ast, "kotlin")` |
| Expected | All function declarations extracted with correct name, params, return type |
| Requirement | STORY-5 |

### UT-14: Extract Class Symbols

| Field | Value |
|-------|-------|
| ID | UT-14 |
| Precondition | Parsed file with classes |
| Steps | 1. Call `extractSymbols(ast, "kotlin")` |
| Expected | Classes extracted with name, superTypes, visibility |
| Requirement | STORY-5 |

### UT-15: Extract Interface Symbols

| Field | Value |
|-------|-------|
| ID | UT-15 |
| Precondition | Parsed file with interfaces |
| Steps | 1. Call `extractSymbols(ast, "kotlin")` |
| Expected | Interfaces extracted with methods and properties |
| Requirement | STORY-5 |

### UT-16: Extract Nested Scope Symbols

| Field | Value |
|-------|-------|
| ID | UT-16 |
| Precondition | Parsed file with nested classes/functions |
| Steps | 1. Call `extractSymbols(ast, "kotlin")` |
| Expected | Scope hierarchy correct (inner class scope = "OuterClass") |
| Requirement | STORY-5, BR-05 |

### UT-17: Extract Symbols — All Languages

| Field | Value |
|-------|-------|
| ID | UT-17 |
| Precondition | Parsed fixture files for all 12 languages |
| Steps | 1. For each language, extract symbols from fixture |
| Expected | Symbols match expected output for each language |
| Requirement | STORY-5, BR-07 |

### UT-18: Language Detection — All Extensions

| Field | Value |
|-------|-------|
| ID | UT-18 |
| Steps | Test all 20+ extensions map to correct language |
| Expected | All mappings correct per FSD table |
| Requirement | BR-01 |

### UT-19: Language Detection — Case Insensitive

| Field | Value |
|-------|-------|
| ID | UT-19 |
| Steps | 1. `detectFromExtension("FILE.KT")` |
| Expected | Returns "kotlin" (case insensitive) |
| Requirement | BR-01 |

### UT-20: Language Detection — Multiple Dots

| Field | Value |
|-------|-------|
| ID | UT-20 |
| Steps | 1. `detectFromExtension("my.test.spec.ts")` |
| Expected | Returns "typescript" (uses last extension) |
| Requirement | BR-01 |

### UT-21: Incremental Threshold Calculation

| Field | Value |
|-------|-------|
| ID | UT-21 |
| Steps | 1. Edit 29% of file → incremental |
|  | 2. Edit 31% of file → full parse |
| Expected | Threshold at 30% correctly triggers fallback |
| Requirement | BR-08 |

### UT-22: Parse Timeout

| Field | Value |
|-------|-------|
| ID | UT-22 |
| Steps | 1. Parse extremely large/complex file that exceeds 5s |
| Expected | ParseTimeoutException or partial result with timeout flag |
| Requirement | BR-09 |

### UT-23: Error Node Marking

| Field | Value |
|-------|-------|
| ID | UT-23 |
| Steps | 1. Parse file with syntax error at line 10 |
| Expected | AST contains ERROR node at correct position |
| Requirement | BR-10 |

### UT-24: Partial AST on Error

| Field | Value |
|-------|-------|
| ID | UT-24 |
| Steps | 1. Parse file with error in middle, valid code before/after |
| Expected | Valid portions have correct AST, error portion marked |
| Requirement | BR-10 |

---

## 3. Integration Tests (IT)

### IT-01: Full Parse Pipeline — Kotlin

| Field | Value |
|-------|-------|
| ID | IT-01 |
| Precondition | Real JNI library + Kotlin grammar loaded |
| Steps | 1. Parse real Kotlin file (500 LOC) |
| Expected | Complete AST, symbols extracted, no errors |
| Requirement | STORY-1, STORY-5 |

### IT-02: Full Parse Pipeline — TypeScript

| Field | Value |
|-------|-------|
| ID | IT-02 |
| Precondition | Real JNI library + TypeScript grammar |
| Steps | 1. Parse real TypeScript file with JSX |
| Expected | Complete AST including JSX nodes |
| Requirement | STORY-1, STORY-2 |

### IT-03: Full Parse Pipeline — All Languages

| Field | Value |
|-------|-------|
| ID | IT-03 |
| Precondition | All 12 grammars loaded |
| Steps | 1. Parse one fixture file per language |
| Expected | All 12 produce valid ASTs |
| Requirement | STORY-2 |

### IT-04: Grammar Hot-Loading

| Field | Value |
|-------|-------|
| ID | IT-04 |
| Steps | 1. Parse .kt file (loads Kotlin grammar lazily) |
|  | 2. Parse .py file (loads Python grammar lazily) |
| Expected | Both grammars loaded on demand, both parse correctly |
| Requirement | STORY-2, BR-03 |

### IT-05: Grammar Caching

| Field | Value |
|-------|-------|
| ID | IT-05 |
| Steps | 1. Load Kotlin grammar |
|  | 2. Load Kotlin grammar again |
| Expected | Second load returns cached pointer (no re-load) |
| Requirement | BR-02 |

### IT-06: Parse TypeScript with Decorators

| Field | Value |
|-------|-------|
| ID | IT-06 |
| Steps | 1. Parse TS file with `@Component` decorators |
| Expected | Decorator nodes present in AST |
| Requirement | STORY-2 |

### IT-07: AST Parity — Kotlin vs nodejs

| Field | Value |
|-------|-------|
| ID | IT-07 |
| Steps | 1. Parse fixture with Kotlin parser |
|  | 2. Compare JSON output with nodejs reference |
| Expected | Node types, positions, structure match exactly |
| Requirement | STORY-3 |

### IT-08: AST Parity — TypeScript vs nodejs

| Field | Value |
|-------|-------|
| ID | IT-08 |
| Steps | 1. Parse TS fixture with Kotlin parser |
|  | 2. Compare with nodejs reference |
| Expected | Exact match |
| Requirement | STORY-3 |

### IT-09: AST Parity — All Languages (50 fixtures)

| Field | Value |
|-------|-------|
| ID | IT-09 |
| Steps | 1. Parse all 50 fixture files |
|  | 2. Compare each with nodejs reference JSON |
| Expected | > 99% match rate (allow minor position differences) |
| Requirement | STORY-3 |

### IT-10: Incremental Parse — Real Edit Sequence

| Field | Value |
|-------|-------|
| ID | IT-10 |
| Steps | 1. Parse file |
|  | 2. Apply 10 sequential edits (typing simulation) |
|  | 3. After each edit, verify AST matches full re-parse |
| Expected | All 10 incremental results match full parse |
| Requirement | STORY-4 |

### IT-11: Incremental Parse — Delete Function

| Field | Value |
|-------|-------|
| ID | IT-11 |
| Steps | 1. Parse file with 5 functions |
|  | 2. Delete middle function (multi-line edit) |
|  | 3. Incremental parse |
| Expected | AST shows 4 functions, deleted function gone |
| Requirement | STORY-4 |

### IT-12: Incremental Parse — Add Import

| Field | Value |
|-------|-------|
| ID | IT-12 |
| Steps | 1. Parse file |
|  | 2. Add import statement at top |
|  | 3. Incremental parse |
| Expected | New import node in AST, rest unchanged |
| Requirement | STORY-4 |

### IT-13: Symbol Extraction — Real Kotlin Project

| Field | Value |
|-------|-------|
| ID | IT-13 |
| Steps | 1. Parse 50 Kotlin files from real project |
|  | 2. Extract symbols from all |
| Expected | All classes, functions, interfaces found |
| Requirement | STORY-5 |

### IT-14: Symbol Extraction — Kotlin Companion Object

| Field | Value |
|-------|-------|
| ID | IT-14 |
| Steps | 1. Parse Kotlin file with companion object |
| Expected | Companion object members extracted with correct scope |
| Requirement | STORY-5, BR-07 |

### IT-15: Symbol Extraction — Python Decorators

| Field | Value |
|-------|-------|
| ID | IT-15 |
| Steps | 1. Parse Python file with `@staticmethod`, `@property` |
| Expected | Decorated functions have correct modifiers |
| Requirement | STORY-5, BR-07 |

### IT-16: Incremental Threshold Boundary

| Field | Value |
|-------|-------|
| ID | IT-16 |
| Steps | 1. 100-line file, edit exactly 30 lines → incremental |
|  | 2. 100-line file, edit 31 lines → full parse |
| Expected | Threshold boundary works correctly |
| Requirement | BR-08 |

### IT-17: Parse Timeout with Large File

| Field | Value |
|-------|-------|
| ID | IT-17 |
| Steps | 1. Parse artificially complex file designed to be slow |
| Expected | Timeout after 5s, partial result or exception |
| Requirement | BR-09 |

### IT-18: Error Recovery — Multiple Errors

| Field | Value |
|-------|-------|
| ID | IT-18 |
| Steps | 1. Parse file with 5 syntax errors at different locations |
| Expected | Partial AST with 5 ERROR nodes, valid code between errors parsed correctly |
| Requirement | BR-10 |

### IT-19: Benchmark — Parse 10K LOC File

| Field | Value |
|-------|-------|
| ID | IT-19 |
| Steps | 1. Parse 10,000 LOC Kotlin file, measure time |
| Expected | < 500ms |
| Requirement | NFR-PERF |

### IT-20: Benchmark — Batch Parse 1000 Files

| Field | Value |
|-------|-------|
| ID | IT-20 |
| Steps | 1. Parse 1000 files sequentially, measure total time |
| Expected | < 30s |
| Requirement | NFR-PERF |

### IT-21: Benchmark — Incremental Single Char

| Field | Value |
|-------|-------|
| ID | IT-21 |
| Steps | 1. Insert one char, measure incremental parse time |
| Expected | < 10ms |
| Requirement | NFR-PERF |

### IT-22: Benchmark — Symbol Extraction 1000 Files

| Field | Value |
|-------|-------|
| ID | IT-22 |
| Steps | 1. Extract symbols from 1000 pre-parsed files |
| Expected | < 3s total |
| Requirement | NFR-PERF |

### IT-23: Benchmark — Grammar Load Time

| Field | Value |
|-------|-------|
| ID | IT-23 |
| Steps | 1. Load each grammar, measure time |
| Expected | < 100ms per grammar |
| Requirement | NFR-PERF |

### IT-24: Memory — 1000 File Project

| Field | Value |
|-------|-------|
| ID | IT-24 |
| Steps | 1. Parse 1000 files, keep all ASTs in memory |
|  | 2. Measure heap usage |
| Expected | < 2GB |
| Requirement | NFR-MEM |

### IT-25: Memory — Repeated Incremental Edits

| Field | Value |
|-------|-------|
| ID | IT-25 |
| Steps | 1. Apply 10,000 incremental edits to same file |
|  | 2. Monitor heap growth |
| Expected | Heap does not grow unboundedly (old trees freed) |
| Requirement | NFR-MEM |

### IT-26: Concurrent Parse — 10 Threads

| Field | Value |
|-------|-------|
| ID | IT-26 |
| Steps | 1. Parse 10 different files on 10 threads simultaneously |
| Expected | All produce correct results, no corruption |
| Requirement | NFR-THREAD |

### IT-27: Concurrent Parse — Pool Exhaustion

| Field | Value |
|-------|-------|
| ID | IT-27 |
| Steps | 1. Submit 20 parse requests with pool size 4 |
| Expected | Requests queue and complete (no deadlock), timeout for excess |
| Requirement | NFR-THREAD |

---

## 4. E2E API Tests (E2E-API)

### E2E-01: Parse Kotlin File via API

| Field | Value |
|-------|-------|
| ID | E2E-01 |
| Steps | 1. Call `parseFile(Path("src/main/kotlin/App.kt"))` |
| Expected | Full ParseResult with AST and symbols |
| Requirement | STORY-1 |

### E2E-02: Parse TypeScript File via API

| Field | Value |
|-------|-------|
| ID | E2E-02 |
| Steps | 1. Call `parseFile(Path("src/components/App.tsx"))` |
| Expected | Full ParseResult with JSX nodes |
| Requirement | STORY-1, STORY-2 |

### E2E-03: Parse Non-Existent File

| Field | Value |
|-------|-------|
| ID | E2E-03 |
| Steps | 1. Call `parseFile(Path("does/not/exist.kt"))` |
| Expected | FileNotFoundException |
| Requirement | STORY-1 |

### E2E-04: Parse All 12 Language Fixtures

| Field | Value |
|-------|-------|
| ID | E2E-04 |
| Steps | 1. For each language, parse a representative fixture file |
| Expected | All 12 produce valid ParseResults |
| Requirement | STORY-2 |

### E2E-05: Parse Unsupported Language

| Field | Value |
|-------|-------|
| ID | E2E-05 |
| Steps | 1. Call `parseFile(Path("file.brainfuck"))` |
| Expected | UnsupportedLanguageException |
| Requirement | STORY-2 |

### E2E-06: AST JSON Output Matches nodejs

| Field | Value |
|-------|-------|
| ID | E2E-06 |
| Steps | 1. Parse fixture, serialize AST to JSON |
|  | 2. Compare with nodejs reference JSON |
| Expected | Exact structural match |
| Requirement | STORY-3 |

### E2E-07: Node Positions Match nodejs

| Field | Value |
|-------|-------|
| ID | E2E-07 |
| Steps | 1. Parse fixture, extract all node positions |
|  | 2. Compare with nodejs positions |
| Expected | All positions match (row, column, byte offset) |
| Requirement | STORY-3 |

### E2E-08: Tree Traversal Order Matches nodejs

| Field | Value |
|-------|-------|
| ID | E2E-08 |
| Steps | 1. Pre-order traverse Kotlin AST, collect node types |
|  | 2. Compare sequence with nodejs |
| Expected | Identical sequence |
| Requirement | STORY-3 |

### E2E-09: Incremental Parse After Edit

| Field | Value |
|-------|-------|
| ID | E2E-09 |
| Steps | 1. Parse file |
|  | 2. Simulate typing "val x = 1" at line 5 |
|  | 3. Incremental parse |
| Expected | New variable declaration in AST at line 5 |
| Requirement | STORY-4 |

### E2E-10: Incremental Parse — Multiple Edits

| Field | Value |
|-------|-------|
| ID | E2E-10 |
| Steps | 1. Parse file |
|  | 2. Apply 5 sequential edits |
|  | 3. Verify final AST matches full re-parse |
| Expected | Final AST identical to fresh parse of edited file |
| Requirement | STORY-4 |

### E2E-11: Get Symbols — Functions Only

| Field | Value |
|-------|-------|
| ID | E2E-11 |
| Steps | 1. Parse file with mixed symbols |
|  | 2. Query symbols with `kinds = [FUNCTION]` |
| Expected | Only function symbols returned |
| Requirement | STORY-5 |

### E2E-12: Get Symbols — By Scope

| Field | Value |
|-------|-------|
| ID | E2E-12 |
| Steps | 1. Parse file with class containing methods |
|  | 2. Query symbols with `scope = "MyClass"` |
| Expected | Only symbols within MyClass scope returned |
| Requirement | STORY-5 |

### E2E-13: Get Symbols — Matches nodejs Output

| Field | Value |
|-------|-------|
| ID | E2E-13 |
| Steps | 1. Extract symbols from fixture |
|  | 2. Compare with nodejs symbol extraction output |
| Expected | Same symbols, same metadata |
| Requirement | STORY-5 |

### E2E-14: Parse File with Mixed Valid/Invalid Code

| Field | Value |
|-------|-------|
| ID | E2E-14 |
| Steps | 1. Parse file: valid function, then syntax error, then valid class |
| Expected | Function and class symbols extracted, error section marked |
| Requirement | BR-10 |

---

## 5. E2E UI Tests (E2E-UI)

### E2E-UI-01: MCP parse_file Tool Call

| Field | Value |
|-------|-------|
| ID | E2E-UI-01 |
| Steps | 1. Send JSON-RPC call: `{"method": "tools/call", "params": {"name": "parse_file", "arguments": {"file_path": "test.kt"}}}` |
| Expected | JSON-RPC response with AST data |
| Requirement | STORY-1 |

### E2E-UI-02: MCP get_symbols Tool Call

| Field | Value |
|-------|-------|
| ID | E2E-UI-02 |
| Steps | 1. Send JSON-RPC call: `{"method": "tools/call", "params": {"name": "get_symbols", "arguments": {"file_path": "test.kt"}}}` |
| Expected | JSON-RPC response with symbol list |
| Requirement | STORY-5 |

### E2E-UI-03: MCP Tool Error Response

| Field | Value |
|-------|-------|
| ID | E2E-UI-03 |
| Steps | 1. Send parse_file for non-existent file |
| Expected | JSON-RPC error response with appropriate error code |
| Requirement | BR-10 |

---

## 6. System Integration Tests (SIT)

### SIT-01: Cross-Platform Parity — Kotlin vs nodejs (50 files)

| Field | Value |
|-------|-------|
| ID | SIT-01 |
| Steps | 1. Parse 50 fixture files with both Kotlin and nodejs parsers |
|  | 2. Compare AST JSON output |
| Expected | > 99% structural match |
| Requirement | STORY-3 |
| Automation | Automated (CI job) |

### SIT-02: Cross-Platform Parity — Symbol Extraction

| Field | Value |
|-------|-------|
| ID | SIT-02 |
| Steps | 1. Extract symbols from 50 fixtures with both platforms |
|  | 2. Compare symbol lists |
| Expected | Identical symbol names, kinds, and scopes |
| Requirement | STORY-3, STORY-5 |
| Automation | Automated |

### SIT-03: Cross-Platform Parity — Incremental Parse

| Field | Value |
|-------|-------|
| ID | SIT-03 |
| Steps | 1. Apply same edit sequence on both platforms |
|  | 2. Compare final ASTs |
| Expected | Identical results |
| Requirement | STORY-3, STORY-4 |
| Automation | Automated |

### SIT-04: Multi-OS Compatibility

| Field | Value |
|-------|-------|
| ID | SIT-04 |
| Steps | 1. Run full test suite on Linux x64 |
|  | 2. Run on macOS arm64 |
|  | 3. Run on Windows x64 |
| Expected | All tests pass on all 3 platforms |
| Requirement | NFR-COMPAT |
| Automation | Automated (CI matrix) |

### SIT-05: Visual Inspection — AST Viewer

| Field | Value |
|-------|-------|
| ID | SIT-05 |
| Steps | 1. Parse complex file |
|  | 2. Visually inspect AST tree in debug viewer |
|  | 3. Verify structure makes sense |
| Expected | AST visually correct, no obvious structural issues |
| Requirement | STORY-1 |
| Automation | Manual |

---

## 7. Test Data Files

| File | Description | Used By |
|------|-------------|---------|
| testdata/kotlin-basic.kt | Simple Kotlin file (functions, classes) | UT-03, IT-01, E2E-01 |
| testdata/typescript-jsx.tsx | TypeScript with JSX | IT-02, E2E-02 |
| testdata/python-decorators.py | Python with decorators | IT-15 |
| testdata/kotlin-companion.kt | Kotlin companion objects | IT-14 |
| testdata/multi-error.kt | File with multiple syntax errors | IT-18, E2E-14 |
| testdata/large-10k.kt | 10,000 LOC Kotlin file | IT-19 |
| testdata/fixtures-50/ | 50 files across 12 languages | IT-09, SIT-01 |
| testdata/nodejs-reference/ | Expected JSON output from nodejs | IT-07..09, E2E-06..08 |

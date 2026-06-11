# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-172: [Kotlin] Tree-sitter Core + Parsers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-172 |
| Title | [Kotlin] Tree-sitter Core + Parsers |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-172.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | BA Agent | Initiate document from BRD |
| 1.0 | 2026-05-26 | TA Agent | Technical enrichment — API contracts, pseudocode, integration specs |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Kotlin Tree-sitter Core + Parsers module. It defines use cases, business rules, data specifications, API contracts, and integration requirements for implementing tree-sitter parsing on JVM.

### 1.2 Scope

- Tree-sitter JNI binding initialization and lifecycle management
- Parser creation and configuration for 12 languages
- AST construction and traversal APIs
- Symbol extraction pipeline
- Incremental parsing support
- Error handling and graceful degradation

### 1.3 References

| Document | Version | Location |
|----------|---------|----------|
| BRD | v1.0 | BRD-v1-KSA-172.docx |
| Parent Epic BRD | v1.0 | BRD-v1-KSA-171.docx |
| nodejs v2 Source | HEAD | mcp-code-intelligence-nodejs/src/parsers/ |

---

## 2. System Context

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

### 2.2 External Systems

| System | Interface | Description |
|--------|-----------|-------------|
| tree-sitter Native Library | JNI | C library providing parsing engine |
| Language Grammar Files | File System | .so/.dylib/.dll grammar files per language |
| Source Code Files | File System | Input files to parse |
| Downstream Consumers | Kotlin API | Graph Engine, AI Context, etc. |
| MCP Client | JSON-RPC | IDE requesting parse results |

---

## 3. Functional Requirements

### 3.1 Use Case: UC-01 — Initialize Parser Runtime

**Actor:** System (on startup)
**Precondition:** JNI native library available on classpath/library path
**Trigger:** Application startup or first parse request

#### Main Flow

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Load tree-sitter native library | JNI library loaded into JVM |
| 2 | System | Verify native library version | Version compatibility confirmed |
| 3 | System | Initialize parser pool | Thread-safe parser instances created |
| 4 | System | Report ready status | Runtime ready for parse requests |

#### Alternative Flow

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Native library not found | Log error, throw `ParserInitializationException` with platform details |
| AF-02 | Version mismatch | Log warning, attempt compatibility mode, fail if incompatible |

#### Exception Flow

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | JNI crash during init | Catch native exception, wrap in `NativeLibraryException`, report to caller |

---

### 3.2 Use Case: UC-02 — Load Language Grammar

**Actor:** System or Developer (via API)
**Precondition:** Parser runtime initialized
**Trigger:** Language detected in project or explicit grammar load request

#### Main Flow

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Detect language from file extension | Language identifier resolved |
| 2 | System | Locate grammar file for language | Grammar path resolved |
| 3 | System | Load grammar via JNI | Grammar loaded into parser |
| 4 | System | Validate grammar (parse empty string) | Grammar functional |
| 5 | System | Register grammar in language registry | Grammar available for parsing |

#### Alternative Flow

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Grammar file not found | Return `GrammarNotFoundException`, skip language |
| AF-02 | Grammar load failure | Log error, mark language as unavailable |
| AF-03 | Unknown file extension | Return null language, caller decides |

#### Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-01 | Language Detection | File extension to language mapping is deterministic and configurable |
| BR-02 | Grammar Caching | Once loaded, grammar remains in memory until explicit unload |
| BR-03 | Lazy Loading | Grammars are loaded on first use, not eagerly at startup |

---

### 3.3 Use Case: UC-03 — Parse Source File

**Actor:** Developer (via MCP tool or API)
**Precondition:** Grammar loaded for target language
**Trigger:** `parse_file` tool call or programmatic API call

#### Main Flow

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Developer | Request parse of file path or source string | Request received |
| 2 | System | Detect language from file extension | Language resolved |
| 3 | System | Acquire parser instance from pool | Thread-safe parser obtained |
| 4 | System | Set language grammar on parser | Parser configured |
| 5 | System | Parse source bytes into Tree | tree-sitter Tree created |
| 6 | System | Convert Tree to AST representation | Platform-agnostic AST built |
| 7 | System | Return parser to pool | Parser recycled |
| 8 | System | Return AST to caller | AST with metadata returned |

#### Alternative Flow

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | File not found | Return `FileNotFoundException` |
| AF-02 | Unsupported language | Return `UnsupportedLanguageException` |
| AF-03 | Parse timeout (> 5s) | Cancel parse, return partial result with timeout flag |

#### Exception Flow

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Source contains syntax errors | Return partial AST with ERROR nodes marked |
| EF-02 | Out of memory during parse | Release parser, throw `ParseMemoryException` |

---

### 3.4 Use Case: UC-04 — Incremental Parse

**Actor:** Developer (via file watcher or API)
**Precondition:** Previous parse tree exists for the file
**Trigger:** File edit detected

#### Main Flow

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Receive edit event (byte range + new content) | Edit recorded |
| 2 | System | Apply edit to existing Tree | Tree updated with edit info |
| 3 | System | Re-parse with existing tree as old_tree | Incremental parse executed |
| 4 | System | Compute changed ranges | Affected AST regions identified |
| 5 | System | Update AST representation | AST reflects new state |
| 6 | System | Notify downstream consumers of changes | Change event emitted |

#### Alternative Flow

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | No previous tree exists | Fall back to full parse (UC-03) |
| AF-02 | Edit exceeds 30% of file | Fall back to full parse for efficiency |

---

### 3.5 Use Case: UC-05 — Extract Symbols

**Actor:** Developer or downstream tool
**Precondition:** AST exists for the file
**Trigger:** Symbol query or post-parse extraction

#### Main Flow

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Traverse AST in pre-order | Nodes visited sequentially |
| 2 | System | Match node types to symbol patterns | Symbol candidates identified |
| 3 | System | Extract symbol metadata (name, type, scope, position) | Symbol records created |
| 4 | System | Build scope hierarchy | Parent-child relationships established |
| 5 | System | Index symbols by name and type | Symbol table populated |
| 6 | System | Return symbol list | Symbols available for query |

#### Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-04 | Symbol Types | function, class, interface, method, variable, constant, enum, type_alias, property, constructor |
| BR-05 | Scope Rules | Symbols inherit scope from enclosing declaration |
| BR-06 | Visibility | Extract visibility modifiers (public, private, protected, internal) |
| BR-07 | Language Mapping | Each language has specific node-type to symbol-type mapping |

---

## 4. API Contracts

### 4.1 Core Parser API

```kotlin
interface TreeSitterParser {
    fun initialize()
    fun loadLanguage(language: String): Boolean
    fun parse(source: ByteArray, language: String, oldTree: Tree? = null): ParseResult
    fun parseFile(filePath: Path): ParseResult
    fun incrementalParse(tree: Tree, edit: InputEdit, newSource: ByteArray): ParseResult
    fun extractSymbols(ast: AstNode, language: String): List<Symbol>
    fun supportedLanguages(): List<String>
    fun close()
}
```

### 4.2 Data Models

```kotlin
data class ParseResult(
    val tree: Tree,
    val ast: AstNode,
    val language: String,
    val parseTimeMs: Long,
    val hasErrors: Boolean,
    val errorCount: Int
)

data class AstNode(
    val type: String,
    val text: String?,
    val startPosition: Position,
    val endPosition: Position,
    val startByte: Int,
    val endByte: Int,
    val isNamed: Boolean,
    val fieldName: String?,
    val children: List<AstNode>,
    val isError: Boolean
)

data class Position(val row: Int, val column: Int)

data class InputEdit(
    val startByte: Int,
    val oldEndByte: Int,
    val newEndByte: Int,
    val startPosition: Position,
    val oldEndPosition: Position,
    val newEndPosition: Position
)

data class Symbol(
    val name: String,
    val kind: SymbolKind,
    val language: String,
    val filePath: String,
    val position: Position,
    val endPosition: Position,
    val visibility: Visibility,
    val scope: String?,
    val parameters: List<Parameter>?,
    val returnType: String?,
    val superTypes: List<String>?,
    val modifiers: Set<String>
)

enum class SymbolKind {
    FUNCTION, CLASS, INTERFACE, METHOD, VARIABLE,
    CONSTANT, ENUM, TYPE_ALIAS, PROPERTY, CONSTRUCTOR
}

enum class Visibility { PUBLIC, PRIVATE, PROTECTED, INTERNAL, DEFAULT }

data class Parameter(
    val name: String,
    val type: String?,
    val defaultValue: String?,
    val isVariadic: Boolean
)
```

### 4.3 Language Detection

| Extension(s) | Language ID |
|-------------|-------------|
| .ts, .tsx | typescript |
| .js, .jsx, .mjs, .cjs | javascript |
| .py, .pyi | python |
| .java | java |
| .kt, .kts | kotlin |
| .go | go |
| .rs | rust |
| .cs | csharp |
| .rb | ruby |
| .php | php |
| .swift | swift |
| .scala, .sc | scala |

### 4.4 MCP Tool Interface

```json
{
  "name": "parse_file",
  "description": "Parse a source file into an AST",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": { "type": "string", "description": "Path to source file" },
      "include_symbols": { "type": "boolean", "default": true }
    },
    "required": ["file_path"]
  }
}
```

```json
{
  "name": "get_symbols",
  "description": "Extract symbols from a source file",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": { "type": "string" },
      "kinds": { "type": "array", "items": { "type": "string" } },
      "scope": { "type": "string" }
    },
    "required": ["file_path"]
  }
}
```

---

## 5. Integration Requirements

### 5.1 JNI Integration

1. **Native Library Loading**: `System.loadLibrary("tree_sitter")` or explicit path
2. **Memory Management**: JNI objects explicitly freed (trees, parsers)
3. **Thread Safety**: Each thread gets its own parser instance (pool pattern)
4. **Error Propagation**: Native exceptions caught and wrapped in Kotlin exceptions

### 5.2 Downstream Integration

| Consumer | Interface | Data Format |
|----------|-----------|-------------|
| Graph Engine (KSA-173) | `ParseResult.ast` | AstNode tree |
| AI Context (KSA-174) | `Symbol` list | Symbol table |
| Code Quality (KSA-175) | `AstNode` + `Symbol` | AST + symbols |
| Security (KSA-176) | `AstNode` tree | Full AST for CFG/DFG |

---

## 6. Business Rules Summary

| ID | Rule | Category | Description |
|----|------|----------|-------------|
| BR-01 | Language Detection | Parsing | File extension to language mapping is deterministic |
| BR-02 | Grammar Caching | Performance | Grammars remain in memory once loaded |
| BR-03 | Lazy Loading | Performance | Grammars loaded on first use |
| BR-04 | Symbol Types | Extraction | 10 symbol kinds supported |
| BR-05 | Scope Rules | Extraction | Symbols inherit scope from enclosing declaration |
| BR-06 | Visibility | Extraction | Visibility modifiers extracted per language |
| BR-07 | Language Mapping | Extraction | Language-specific node to symbol mapping |
| BR-08 | Incremental Threshold | Parsing | Edits > 30% of file trigger full re-parse |
| BR-09 | Parse Timeout | Reliability | Parse operations timeout after 5 seconds |
| BR-10 | Error Tolerance | Reliability | Syntax errors produce partial AST, not failure |

---

## 7. Error Handling

| Error Code | Condition | Response | Status |
|------------|-----------|----------|--------|
| PARSER_INIT_FAILED | Native library load failure | ParserInitializationException | 500 |
| GRAMMAR_NOT_FOUND | Grammar file missing | GrammarNotFoundException | 404 |
| UNSUPPORTED_LANGUAGE | Unknown language requested | UnsupportedLanguageException | 400 |
| PARSE_TIMEOUT | Parse exceeds 5s | Partial result with timeout flag | 408 |
| PARSE_OOM | Out of memory during parse | ParseMemoryException | 500 |
| FILE_NOT_FOUND | Source file does not exist | FileNotFoundException | 404 |
| INVALID_EDIT | Edit range out of bounds | InvalidEditException | 400 |

---

## 8. Non-Functional Specifications

### 8.1 Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Grammar load | < 100ms per language | Cold load time |
| Single file parse (1K LOC) | < 50ms | Parse + AST construction |
| Single file parse (10K LOC) | < 500ms | Parse + AST construction |
| Incremental parse (1 char edit) | < 10ms | Edit + re-parse |
| Incremental parse (50 lines) | < 50ms | Edit + re-parse |
| Symbol extraction (single file) | < 20ms | AST traversal + extraction |
| Symbol extraction (1000 files) | < 3s | Batch extraction |
| Batch parse (1000 files) | < 30s | Full project parse |

### 8.2 Memory Targets

| Scenario | Max Heap | Details |
|----------|----------|---------|
| 100-file project | < 256MB | AST + symbols in memory |
| 1000-file project | < 2GB | AST + symbols in memory |
| Single large file (50K LOC) | < 100MB | One AST in memory |

### 8.3 Concurrency

- Parser pool size: configurable, default = CPU cores
- Thread safety: parser instances NOT shared between threads
- Grammar registry: read-only after initialization (thread-safe)
- AST nodes: immutable after construction (thread-safe)

---

## 9. Pseudocode — Key Algorithms

### 9.1 Parse File

```
function parseFile(filePath):
    language = detectLanguage(filePath.extension)
    if language == null: throw UnsupportedLanguageException
    
    if not grammarRegistry.has(language):
        loadGrammar(language)
    
    source = readFileBytes(filePath)
    parser = parserPool.acquire()
    try:
        parser.setLanguage(grammarRegistry.get(language))
        tree = parser.parse(source, oldTree=null)
        ast = convertToAstNode(tree.rootNode)
        return ParseResult(tree, ast, language, elapsed, tree.hasErrors)
    finally:
        parserPool.release(parser)
```

### 9.2 Incremental Parse

```
function incrementalParse(existingTree, edit, newSource):
    editedBytes = edit.newEndByte - edit.startByte
    totalBytes = newSource.length
    
    if editedBytes > totalBytes * 0.3:
        return fullParse(newSource)  // fallback
    
    existingTree.edit(edit)
    parser = parserPool.acquire()
    try:
        newTree = parser.parse(newSource, oldTree=existingTree)
        changedRanges = existingTree.getChangedRanges(newTree)
        ast = convertToAstNode(newTree.rootNode)
        return ParseResult(newTree, ast, changedRanges)
    finally:
        parserPool.release(parser)
```

### 9.3 Symbol Extraction

```
function extractSymbols(ast, language):
    symbols = []
    extractionRules = getLanguageRules(language)
    
    function visit(node, scopeStack):
        for rule in extractionRules:
            if rule.matches(node):
                symbol = Symbol(
                    name = rule.extractName(node),
                    kind = rule.symbolKind,
                    scope = scopeStack.current(),
                    position = node.startPosition,
                    ...
                )
                symbols.add(symbol)
                
                if rule.createsScope:
                    scopeStack.push(symbol.name)
        
        for child in node.children:
            visit(child, scopeStack)
        
        if rule.createsScope:
            scopeStack.pop()
    
    visit(ast.root, ScopeStack())
    return symbols
```

---

## 10. State Diagram

### 10.1 Parser Lifecycle

![Parser State](diagrams/parser-state.png)

States:
- **Uninitialized** → `initialize()` → **Ready**
- **Ready** → `parse()` → **Parsing** → complete → **Ready**
- **Ready** → `close()` → **Closed**
- **Parsing** → timeout → **Ready** (with partial result)
- **Parsing** → error → **Ready** (with error result)

---

## 11. Open Issues

| # | Issue | Impact | Owner | Status |
|---|-------|--------|-------|--------|
| 1 | tree-sitter-kotlin JNI vs tree-sitter-java choice | Architecture | Tech Lead | Open |
| 2 | Grammar file distribution (bundled vs downloaded) | Deployment | DevOps | Open |
| 3 | WASM vs native shared library for grammars | Performance | Tech Lead | Open |

---

## 12. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Parser State | [parser-state.png](diagrams/parser-state.png) | [parser-state.drawio](diagrams/parser-state.drawio) |
| 3 | Sequence — Parse File | [sequence-parse.png](diagrams/sequence-parse.png) | [sequence-parse.drawio](diagrams/sequence-parse.drawio) |

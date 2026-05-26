# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-178: [Python] Tree-sitter Core + Parsers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-178 |
| Title | [Python] Tree-sitter Core + Parsers |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-178.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | BA Agent | Initiate document from BRD |
| 1.0 | 2026-05-26 | TA Agent | Technical enrichment — API contracts, pseudocode, integration specs |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Python Tree-sitter Core + Parsers module. It defines use cases, business rules, data specifications, API contracts, and integration requirements for implementing tree-sitter parsing in Python.

### 1.2 Scope

- Tree-sitter binding initialization and lifecycle management via py-tree-sitter
- Parser creation and configuration for 12 languages
- AST construction and traversal APIs
- Symbol extraction pipeline
- Incremental parsing support
- Error handling and graceful degradation

### 1.3 References

| Document | Version | Location |
|----------|---------|----------|
| BRD | v1.0 | BRD-v1-KSA-178.docx |
| Parent Epic BRD | v1.0 | BRD-v1-KSA-171.docx |
| nodejs v2 Source | HEAD | mcp-code-intelligence-nodejs/src/parsers/ |
| Kotlin Track FSD | v1.0 | FSD-v1-KSA-172.docx |

---

## 2. System Context

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

### 2.2 External Systems

| System | Interface | Description |
|--------|-----------|-------------|
| tree-sitter Native Library | ctypes/cffi | C library providing parsing engine (bundled with py-tree-sitter) |
| Language Grammar Files | File System / Wheels | .so/.dylib/.dll grammar files per language |
| Source Code Files | File System | Input files to parse |
| Downstream Consumers | Python API | Graph Engine, AI Context, etc. |
| MCP Client | JSON-RPC | IDE requesting parse results |

---

## 3. Functional Requirements

### 3.1 Use Case: UC-01 — Initialize Parser Runtime

**Actor:** System (on startup)
**Precondition:** py-tree-sitter installed, native library available
**Trigger:** Application startup or first parse request

#### Main Flow

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Import tree_sitter module | py-tree-sitter loaded |
| 2 | System | Verify native library availability | Library accessible via ctypes |
| 3 | System | Initialize parser instance pool | Parser instances created |
| 4 | System | Report ready status | Runtime ready for parse requests |

#### Alternative Flow

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | py-tree-sitter not installed | Raise `ImportError` with install instructions |
| AF-02 | Native library version mismatch | Log warning, attempt compatibility mode |

#### Exception Flow

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Segfault in native library | Catch via signal handler, wrap in `ParserInitError` |

---

### 3.2 Use Case: UC-02 — Load Language Grammar

**Actor:** System or Developer (via API)
**Precondition:** Parser runtime initialized
**Trigger:** Language detected in project or explicit grammar load request

#### Main Flow

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Detect language from file extension | Language identifier resolved |
| 2 | System | Locate grammar shared library for language | Grammar path resolved |
| 3 | System | Load grammar via `Language(path, name)` | Grammar loaded |
| 4 | System | Validate grammar (parse empty string) | Grammar functional |
| 5 | System | Register grammar in language registry | Grammar available for parsing |

#### Alternative Flow

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Grammar file not found | Raise `GrammarNotFoundError`, skip language |
| AF-02 | Grammar load failure | Log error, mark language as unavailable |
| AF-03 | Unknown file extension | Return None, caller decides |

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
| 3 | System | Acquire parser instance | Parser obtained |
| 4 | System | Set language grammar on parser | Parser configured |
| 5 | System | Parse source bytes into Tree | tree-sitter Tree created |
| 6 | System | Convert Tree to AST representation | Platform-agnostic AST dict/dataclass built |
| 7 | System | Return AST to caller | AST with metadata returned |

#### Alternative Flow

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | File not found | Raise `FileNotFoundError` |
| AF-02 | Unsupported language | Raise `UnsupportedLanguageError` |
| AF-03 | Parse timeout (> 5s) | Cancel parse, return partial result with timeout flag |

#### Exception Flow

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Source contains syntax errors | Return partial AST with ERROR nodes marked |
| EF-02 | Out of memory during parse | Release parser, raise `MemoryError` |

---

### 3.4 Use Case: UC-04 — Incremental Parse

**Actor:** Developer (via file watcher or API)
**Precondition:** Previous parse tree exists for the file
**Trigger:** File edit detected

#### Main Flow

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Receive edit event (byte range + new content) | Edit recorded |
| 2 | System | Apply edit to existing Tree via `tree.edit()` | Tree updated with edit info |
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

### 4.1 Core Parser API (Python)

```python
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from enum import Enum

class TreeSitterParser:
    """Main parser interface for Python tree-sitter integration."""
    
    def initialize(self) -> None: ...
    def load_language(self, language: str) -> bool: ...
    def parse(self, source: bytes, language: str, old_tree: Optional['Tree'] = None) -> 'ParseResult': ...
    def parse_file(self, file_path: Path) -> 'ParseResult': ...
    def incremental_parse(self, tree: 'Tree', edit: 'InputEdit', new_source: bytes) -> 'ParseResult': ...
    def extract_symbols(self, ast: 'AstNode', language: str) -> list['Symbol']: ...
    def supported_languages(self) -> list[str]: ...
    def close(self) -> None: ...
```

### 4.2 Data Models

```python
@dataclass(frozen=True)
class Position:
    row: int
    column: int

@dataclass(frozen=True)
class AstNode:
    type: str
    text: Optional[str]
    start_position: Position
    end_position: Position
    start_byte: int
    end_byte: int
    is_named: bool
    field_name: Optional[str]
    children: list['AstNode'] = field(default_factory=list)
    is_error: bool = False

@dataclass(frozen=True)
class ParseResult:
    tree: object  # tree_sitter.Tree
    ast: AstNode
    language: str
    parse_time_ms: float
    has_errors: bool
    error_count: int

@dataclass(frozen=True)
class InputEdit:
    start_byte: int
    old_end_byte: int
    new_end_byte: int
    start_point: tuple[int, int]
    old_end_point: tuple[int, int]
    new_end_point: tuple[int, int]

class SymbolKind(Enum):
    FUNCTION = "function"
    CLASS = "class"
    INTERFACE = "interface"
    METHOD = "method"
    VARIABLE = "variable"
    CONSTANT = "constant"
    ENUM = "enum"
    TYPE_ALIAS = "type_alias"
    PROPERTY = "property"
    CONSTRUCTOR = "constructor"

class Visibility(Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    PROTECTED = "protected"
    INTERNAL = "internal"
    DEFAULT = "default"

@dataclass(frozen=True)
class Parameter:
    name: str
    type: Optional[str] = None
    default_value: Optional[str] = None
    is_variadic: bool = False

@dataclass(frozen=True)
class Symbol:
    name: str
    kind: SymbolKind
    language: str
    file_path: str
    position: Position
    end_position: Position
    visibility: Visibility
    scope: Optional[str] = None
    parameters: Optional[list[Parameter]] = None
    return_type: Optional[str] = None
    super_types: Optional[list[str]] = None
    modifiers: frozenset[str] = field(default_factory=frozenset)
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

### 5.1 py-tree-sitter Integration

1. **Native Library Loading**: Handled by py-tree-sitter internally (ctypes/cffi)
2. **Memory Management**: Python garbage collector + explicit `del` for tree objects; context managers for parser lifecycle
3. **Thread Safety**: Each thread/process gets its own parser instance; GIL protects shared state but limits parallelism
4. **Error Propagation**: Native exceptions caught by py-tree-sitter, re-raised as Python exceptions
5. **Concurrency Strategy**: `concurrent.futures.ProcessPoolExecutor` for CPU-bound batch parsing (bypasses GIL)

### 5.2 Downstream Integration

| Consumer | Interface | Data Format |
|----------|-----------|-------------|
| Graph Engine (Python track) | `ParseResult.ast` | AstNode dataclass tree |
| AI Context (Python track) | `Symbol` list | Symbol table |
| Code Quality (Python track) | `AstNode` + `Symbol` | AST + symbols |
| Security (Python track) | `AstNode` tree | Full AST for CFG/DFG |

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

| Error Code | Condition | Response | HTTP Status |
|------------|-----------|----------|-------------|
| PARSER_INIT_FAILED | py-tree-sitter import/init failure | ParserInitError | 500 |
| GRAMMAR_NOT_FOUND | Grammar file missing | GrammarNotFoundError | 404 |
| UNSUPPORTED_LANGUAGE | Unknown language requested | UnsupportedLanguageError | 400 |
| PARSE_TIMEOUT | Parse exceeds 5s | Partial result with timeout flag | 408 |
| PARSE_OOM | Out of memory during parse | MemoryError | 500 |
| FILE_NOT_FOUND | Source file does not exist | FileNotFoundError | 404 |
| INVALID_EDIT | Edit range out of bounds | InvalidEditError | 400 |

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

| Scenario | Max RSS | Details |
|----------|---------|---------|
| 100-file project | < 256MB | AST + symbols in memory |
| 1000-file project | < 2GB | AST + symbols in memory |
| Single large file (50K LOC) | < 100MB | One AST in memory |

### 8.3 Concurrency

- Parser pool: one parser per process (multiprocessing for parallelism)
- GIL consideration: tree-sitter C code releases GIL during parse (if using cffi)
- Grammar registry: thread-safe dict (GIL-protected reads)
- AST nodes: frozen dataclasses (immutable, safe to share)

---

## 9. Pseudocode — Key Algorithms

### 9.1 Parse File

```python
def parse_file(file_path: Path) -> ParseResult:
    language = detect_language(file_path.suffix)
    if language is None:
        raise UnsupportedLanguageError(f"Unknown extension: {file_path.suffix}")
    
    if language not in grammar_registry:
        load_grammar(language)
    
    source = file_path.read_bytes()
    parser = Parser()
    parser.set_language(grammar_registry[language])
    
    start = time.perf_counter_ns()
    tree = parser.parse(source)
    elapsed_ms = (time.perf_counter_ns() - start) / 1_000_000
    
    ast = convert_to_ast_node(tree.root_node, source)
    return ParseResult(tree, ast, language, elapsed_ms, tree.root_node.has_error, count_errors(ast))
```

### 9.2 Incremental Parse

```python
def incremental_parse(file_path: str, edit: InputEdit, new_source: bytes, language: str) -> ParseResult:
    cached = tree_cache.get(file_path)
    
    if cached is None:
        return full_parse(file_path, new_source, language)
    
    edit_ratio = (edit.new_end_byte - edit.start_byte) / len(new_source)
    if edit_ratio > 0.3:
        return full_parse(file_path, new_source, language)
    
    cached.tree.edit(
        start_byte=edit.start_byte,
        old_end_byte=edit.old_end_byte,
        new_end_byte=edit.new_end_byte,
        start_point=edit.start_point,
        old_end_point=edit.old_end_point,
        new_end_point=edit.new_end_point,
    )
    
    parser = Parser()
    parser.set_language(grammar_registry[language])
    new_tree = parser.parse(new_source, cached.tree)
    
    ast = convert_to_ast_node(new_tree.root_node, new_source)
    tree_cache[file_path] = CachedTree(new_tree)
    
    return ParseResult(new_tree, ast, language, elapsed, ...)
```

### 9.3 Symbol Extraction

```python
def extract_symbols(ast: AstNode, language: str, file_path: str) -> list[Symbol]:
    rules = language_extraction_rules[language]
    symbols: list[Symbol] = []
    scope_stack: list[str] = []
    
    def visit(node: AstNode):
        matched_rule = rules.match(node)
        pushed_scope = False
        
        if matched_rule:
            symbol = matched_rule.extract(node, scope_stack[-1] if scope_stack else None, file_path, language)
            symbols.append(symbol)
            
            if matched_rule.creates_scope:
                scope_stack.append(symbol.name)
                pushed_scope = True
        
        for child in node.children:
            if child.is_named:
                visit(child)
        
        if pushed_scope:
            scope_stack.pop()
    
    visit(ast)
    return symbols
```

---

## 10. State Diagram

### 10.1 Parser Lifecycle

![Parser State](diagrams/parser-state.png)

States:
- **Uninitialized** -> `initialize()` -> **Ready**
- **Ready** -> `parse()` -> **Parsing** -> complete -> **Ready**
- **Ready** -> `close()` -> **Closed**
- **Parsing** -> timeout -> **Ready** (with partial result)
- **Parsing** -> error -> **Ready** (with error result)

---

## 11. Open Issues

| # | Issue | Impact | Owner | Status |
|---|-------|--------|-------|--------|
| 1 | py-tree-sitter vs tree-sitter-languages package choice | Architecture | Tech Lead | Open |
| 2 | Grammar file distribution (bundled wheel vs separate download) | Deployment | DevOps | Open |
| 3 | GIL bypass strategy (cffi release_gil vs multiprocessing) | Performance | Tech Lead | Open |
| 4 | Python 3.13 free-threading support (PEP 703) | Future-proofing | Tech Lead | Open |

---

## 12. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Parser State | [parser-state.png](diagrams/parser-state.png) | [parser-state.drawio](diagrams/parser-state.drawio) |
| 3 | Sequence — Parse File | [sequence-parse.png](diagrams/sequence-parse.png) | [sequence-parse.drawio](diagrams/sequence-parse.drawio) |

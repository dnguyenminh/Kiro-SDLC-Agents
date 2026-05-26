# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-145: [Tree-sitter] Core Integration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-145 |
| Title | [Tree-sitter] Core Integration - tree-sitter bindings for Node.js |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-145.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-28 | BA + TA | Initial document |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the tree-sitter core integration into `mcp-code-intelligence-nodejs`. It defines the parser infrastructure, grammar loading mechanism, AST traversal utilities, and the interface contract that language-specific parsers must implement.

### 1.2 Scope

- Tree-sitter npm package integration
- Grammar registry and dynamic loading
- Base parser interface and AST utilities
- Symbol extraction pipeline (replacing regex)
- SQLite schema migration for enhanced symbol data
- Backward compatibility with existing MCP tools

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| AST | Abstract Syntax Tree |
| Grammar | Tree-sitter language definition (parsing rules) |
| Symbol | Named code entity (function, class, method, etc.) |
| MCP | Model Context Protocol |
| WAL | Write-Ahead Logging (SQLite mode) |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-145.docx |
| CodeGraph Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| Tree-sitter docs | https://tree-sitter.github.io/tree-sitter/ |

---

## 2. System Overview

### 2.1 System Context

The tree-sitter core integration sits between the file system watcher (indexer) and the SQLite database. It replaces the current regex-based `extractSymbols()` function.

**External Interfaces:**
- **Input**: Source code files from workspace
- **Output**: Enriched symbol data to SQLite database
- **Consumers**: MCP tools (code_search, code_symbols, code_context)

### 2.2 Component Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Indexer                            │
│  ┌──────────┐    ┌──────────────┐    ┌───────────┐ │
│  │ File     │───>│ Grammar      │───>│ Language   │ │
│  │ Watcher  │    │ Registry     │    │ Parser    │ │
│  └──────────┘    └──────────────┘    └─────┬─────┘ │
│                                            │        │
│                  ┌──────────────┐          │        │
│                  │ AST Utilities│<─────────┘        │
│                  └──────┬───────┘                   │
│                         │                           │
│                  ┌──────▼───────┐                   │
│                  │ Symbol       │                   │
│                  │ Extractor    │                   │
│                  └──────┬───────┘                   │
│                         │                           │
└─────────────────────────┼───────────────────────────┘
                          │
                   ┌──────▼───────┐
                   │   SQLite     │
                   │  (symbols)   │
                   └──────────────┘
```

---

## 3. Functional Requirements

### 3.1 Feature: Grammar Registry

**Source:** BRD Story 2 — Dynamic Grammar Loading

#### 3.1.1 Description

The Grammar Registry manages the mapping between file extensions and tree-sitter grammar packages. It handles lazy loading, caching, and fallback behavior.

#### 3.1.2 Use Case

**Use Case ID:** UC-01 — Load Grammar for File

| Field | Value |
|-------|-------|
| Actor | Indexer |
| Precondition | File detected for indexing |
| Trigger | `getParser(filePath)` called |

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Indexer | Calls `grammarRegistry.getParser(filePath)` | Extract file extension |
| 2 | System | Looks up extension in registry | Find matching language config |
| 3 | System | Check if parser already cached | If cached, return immediately |
| 4 | System | Load grammar package (require/import) | Initialize tree-sitter parser |
| 5 | System | Cache parser instance | Return parser |

**Alternative Flow — Unknown Extension:**

| Step | Action |
|------|--------|
| 2a | Extension not in registry |
| 2b | Log warning: "No grammar for extension .xyz" |
| 2c | Return null (caller falls back to regex) |

**Exception Flow — Grammar Load Failure:**

| Step | Action |
|------|--------|
| 4a | Grammar package not installed or fails to load |
| 4b | Log error with package name and error details |
| 4c | Mark language as "unavailable" in registry (don't retry) |
| 4d | Return null (caller falls back to regex) |

#### 3.1.3 Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-01 | Lazy Loading | Grammars loaded on first use, not at startup |
| BR-02 | Cache Forever | Once loaded, parser instance cached for process lifetime |
| BR-03 | Fail Once | If grammar fails to load, don't retry (mark unavailable) |
| BR-04 | Extension Priority | First match wins (e.g., `.tsx` matches TypeScript, not JavaScript) |

#### 3.1.4 Data Specification

**Grammar Configuration (grammar-config.json):**

```json
{
  "languages": [
    {
      "id": "typescript",
      "extensions": [".ts", ".tsx"],
      "grammar": "tree-sitter-typescript",
      "subpath": "typescript",
      "parserModule": "./parsers/typescript-parser"
    },
    {
      "id": "javascript",
      "extensions": [".js", ".jsx", ".mjs", ".cjs"],
      "grammar": "tree-sitter-javascript",
      "parserModule": "./parsers/javascript-parser"
    },
    {
      "id": "python",
      "extensions": [".py", ".pyi"],
      "grammar": "tree-sitter-python",
      "parserModule": "./parsers/python-parser"
    }
  ]
}
```

---

### 3.2 Feature: Base Parser Interface

**Source:** BRD Story 3 — AST Traversal Utilities

#### 3.2.1 Description

Define the `ILanguageParser` interface that all language-specific parsers must implement. This ensures consistent output format across languages.

#### 3.2.2 Interface Contract

```typescript
interface ILanguageParser {
  /** Language identifier */
  readonly languageId: string;
  
  /** Parse a file and extract symbols + relationships */
  parse(source: string, filePath: string): ParseResult;
  
  /** Get supported file extensions */
  getSupportedExtensions(): string[];
}

interface ParseResult {
  symbols: ExtractedSymbol[];
  relationships: ExtractedRelationship[];
  errors: ParseError[];
}

interface ExtractedSymbol {
  name: string;
  kind: SymbolKind;
  filePath: string;
  startLine: number;
  endLine: number;
  signature: string;
  parameters?: string;
  returnType?: string;
  modifiers?: string[];
  decorators?: string[];
  parentName?: string;
  isAsync?: boolean;
  isExported?: boolean;
  docComment?: string;
  complexity?: number;
}

interface ExtractedRelationship {
  sourceSymbol: string;
  targetSymbol: string;
  kind: RelationshipKind;
  line: number;
  metadata?: Record<string, unknown>;
}

type SymbolKind = 'function' | 'class' | 'method' | 'interface' | 'type' | 'enum' | 'variable' | 'namespace' | 'constructor' | 'property';

type RelationshipKind = 'calls' | 'imports' | 'inherits' | 'implements' | 'uses' | 'decorates';
```

#### 3.2.3 Use Case

**Use Case ID:** UC-02 — Parse File with Language Parser

| Field | Value |
|-------|-------|
| Actor | Indexer |
| Precondition | Grammar loaded, parser available |
| Trigger | File needs indexing |

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Indexer | Get parser from registry | Returns ILanguageParser |
| 2 | Indexer | Read file content | Source string |
| 3 | Indexer | Call `parser.parse(source, filePath)` | Parser creates AST |
| 4 | Parser | Walk AST extracting symbols | Populate symbols array |
| 5 | Parser | Walk AST extracting relationships | Populate relationships array |
| 6 | Parser | Return ParseResult | Symbols + relationships + errors |
| 7 | Indexer | Store symbols in SQLite | INSERT/UPDATE symbols table |
| 8 | Indexer | Store relationships in SQLite | INSERT relationships table |

---

### 3.3 Feature: AST Traversal Utilities

**Source:** BRD Story 3

#### 3.3.1 Description

Shared utility functions for working with tree-sitter AST nodes. These are used by all language parsers.

#### 3.3.2 API Specification

```typescript
/** Depth-first walk with visitor pattern */
function walkTree(node: SyntaxNode, visitor: NodeVisitor): void;

/** Find all descendant nodes of a given type */
function findNodes(node: SyntaxNode, type: string): SyntaxNode[];

/** Find first descendant node of a given type */
function findFirst(node: SyntaxNode, type: string): SyntaxNode | null;

/** Get source text for a node */
function getNodeText(node: SyntaxNode, source: string): string;

/** Get line range (1-based) for a node */
function getNodeRange(node: SyntaxNode): { startLine: number; endLine: number };

/** Walk up tree to find ancestor of specific type */
function getAncestorOfType(node: SyntaxNode, type: string): SyntaxNode | null;

/** Get all children of a specific type */
function getChildrenOfType(node: SyntaxNode, type: string): SyntaxNode[];

/** Check if node has a specific named child */
function hasChild(node: SyntaxNode, fieldName: string): boolean;

/** Get named child by field name */
function getChild(node: SyntaxNode, fieldName: string): SyntaxNode | null;

interface NodeVisitor {
  enter?(node: SyntaxNode): boolean | void; // return false to skip children
  leave?(node: SyntaxNode): void;
}
```

#### 3.3.3 Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-05 | Null Safety | All utilities handle null/undefined nodes gracefully |
| BR-06 | Performance | walkTree uses iterative approach (no stack overflow on deep trees) |
| BR-07 | Source Required | getNodeText requires original source string (tree-sitter doesn't store text) |

---

### 3.4 Feature: Symbol Extraction Pipeline

**Source:** BRD Story 1 — Full Metadata Symbol Extraction

#### 3.4.1 Description

The extraction pipeline orchestrates the full flow from file detection to database storage. It replaces the current `extractSymbols()` function.

#### 3.4.2 Use Case

**Use Case ID:** UC-03 — Index File with Tree-sitter

| Field | Value |
|-------|-------|
| Actor | File Watcher |
| Precondition | File changed (mtime or hash) |
| Trigger | File change detected |

**Main Flow:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Watcher | Detect file change | Emit file path |
| 2 | Indexer | Check file extension | Determine language |
| 3 | Indexer | Get parser from registry | ILanguageParser or null |
| 4 | Indexer | If parser: call parse() | ParseResult |
| 5 | Indexer | If no parser: call regexExtract() | Legacy symbols (fallback) |
| 6 | Indexer | Delete old symbols for file | SQL DELETE WHERE file_path = ? |
| 7 | Indexer | Delete old relationships for file | SQL DELETE WHERE file_path = ? |
| 8 | Indexer | Insert new symbols | SQL INSERT batch |
| 9 | Indexer | Insert new relationships | SQL INSERT batch |
| 10 | Indexer | Update file metadata (hash, mtime) | SQL UPDATE |

**Alternative Flow — Parse Error:**

| Step | Action |
|------|--------|
| 4a | Parser returns errors (partial parse) |
| 4b | Log warnings for parse errors |
| 4c | Store successfully extracted symbols (partial result) |
| 4d | Mark file as "partial" in metadata |

#### 3.4.3 Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-08 | Atomic Update | Delete + Insert in single transaction |
| BR-09 | Partial Success | Parse errors don't prevent storing valid symbols |
| BR-10 | Fallback | No parser available → use regex extraction |
| BR-11 | Idempotent | Re-indexing same file produces same result |

---

### 3.5 Feature: SQLite Schema Migration

**Source:** BRD Story 4 — Backward Compatibility

#### 3.5.1 Description

Add new columns to the `symbols` table and create the `relationships` table (shared with KSA-153).

#### 3.5.2 Migration SQL

```sql
-- Migration: Add enhanced symbol columns
ALTER TABLE symbols ADD COLUMN parameters TEXT;
ALTER TABLE symbols ADD COLUMN return_type TEXT;
ALTER TABLE symbols ADD COLUMN parent_symbol_id INTEGER REFERENCES symbols(id);
ALTER TABLE symbols ADD COLUMN decorators TEXT; -- JSON array
ALTER TABLE symbols ADD COLUMN complexity INTEGER;
ALTER TABLE symbols ADD COLUMN is_async INTEGER DEFAULT 0;
ALTER TABLE symbols ADD COLUMN is_exported INTEGER DEFAULT 0;
ALTER TABLE symbols ADD COLUMN doc_comment TEXT;
ALTER TABLE symbols ADD COLUMN start_line INTEGER;
ALTER TABLE symbols ADD COLUMN end_line INTEGER;
ALTER TABLE symbols ADD COLUMN modifiers TEXT; -- JSON array

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_symbols_parent ON symbols(parent_symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbols_exported ON symbols(is_exported) WHERE is_exported = 1;
```

#### 3.5.3 Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-12 | Additive Only | New columns are nullable, no existing data affected |
| BR-13 | Idempotent | Migration safe to run multiple times (IF NOT EXISTS) |
| BR-14 | No Re-index | Migration doesn't require full re-index |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Single file parse | ≤10ms | 1000-line TypeScript file |
| Grammar load (first time) | ≤200ms | Cold load of grammar package |
| Grammar load (cached) | ≤1ms | Return cached parser |
| Batch index (100 files) | ≤2s | Mixed file types |
| Memory per parser | ≤50MB | Per language grammar |

### 4.2 Reliability

| Requirement | Details |
|-------------|---------|
| Graceful degradation | If tree-sitter fails, fall back to regex |
| Partial parse | Extract what's possible even with syntax errors |
| No crash | Invalid input never crashes the process |

### 4.3 Compatibility

| Requirement | Details |
|-------------|---------|
| Node.js 18+ | Required for native bindings |
| Existing tools | code_search, code_symbols, code_context unchanged |
| SQLite schema | Backward compatible (additive columns) |

---

## 5. Error Handling

| Error | Handling | User Impact |
|-------|----------|-------------|
| Grammar package not installed | Log error, mark unavailable, use regex fallback | Degraded extraction (names only) |
| File read failure | Skip file, log error | File not indexed |
| Parse error (syntax error in source) | Partial extraction, log warning | Some symbols may be missed |
| SQLite write failure | Retry once, then skip file | File not indexed |
| Out of memory | Catch, skip large file, log | Large files use regex fallback |

---

## 6. API Contracts

### 6.1 Internal API: GrammarRegistry

```typescript
class GrammarRegistry {
  constructor(configPath: string);
  
  /** Get parser for a file path (by extension) */
  getParser(filePath: string): ILanguageParser | null;
  
  /** Check if a language is supported */
  isSupported(extension: string): boolean;
  
  /** Get all registered languages */
  getLanguages(): LanguageConfig[];
  
  /** Register a new language at runtime */
  register(config: LanguageConfig): void;
}
```

### 6.2 Internal API: TreeSitterIndexer

```typescript
class TreeSitterIndexer {
  constructor(registry: GrammarRegistry, db: Database);
  
  /** Index a single file */
  indexFile(filePath: string): Promise<IndexResult>;
  
  /** Index multiple files */
  indexBatch(filePaths: string[]): Promise<BatchIndexResult>;
  
  /** Check if file needs re-indexing */
  needsReindex(filePath: string): Promise<boolean>;
}

interface IndexResult {
  filePath: string;
  symbolCount: number;
  relationshipCount: number;
  parseErrors: number;
  duration: number; // ms
  method: 'tree-sitter' | 'regex-fallback';
}
```

---

## 7. Data Model

### 7.1 Enhanced Symbols Table

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | INTEGER | No | PK, auto-increment |
| name | TEXT | No | Symbol name |
| kind | TEXT | No | function/class/method/etc. |
| file_path | TEXT | No | Relative file path |
| line | INTEGER | No | Definition line (1-based) |
| signature | TEXT | Yes | Full signature text |
| parameters | TEXT | Yes | Parameter list with types |
| return_type | TEXT | Yes | Return type annotation |
| parent_symbol_id | INTEGER | Yes | FK to parent symbol |
| decorators | TEXT | Yes | JSON array of decorators |
| complexity | INTEGER | Yes | Cyclomatic complexity |
| is_async | INTEGER | Yes | 0 or 1 |
| is_exported | INTEGER | Yes | 0 or 1 |
| doc_comment | TEXT | Yes | Documentation comment |
| start_line | INTEGER | Yes | First line of body |
| end_line | INTEGER | Yes | Last line of body |
| modifiers | TEXT | Yes | JSON array of modifiers |

---

## 8. Open Issues

| # | Issue | Impact | Decision Needed By |
|---|-------|--------|-------------------|
| 1 | WASM vs native bindings for tree-sitter | Performance vs portability | Sprint planning |
| 2 | Max file size before fallback to regex | Memory usage | Implementation |
| 3 | Should we support tree-sitter-cli for grammar compilation? | Developer experience | Implementation |

---

## 9. Appendix

### 9.1 Supported Languages (Initial)

| Language | Grammar Package | Priority |
|----------|----------------|----------|
| TypeScript | tree-sitter-typescript | P0 (KSA-146) |
| JavaScript | tree-sitter-javascript | P0 (KSA-146) |
| Python | tree-sitter-python | P1 |
| Kotlin | tree-sitter-kotlin | P1 |
| Java | tree-sitter-java | P2 |
| Go | tree-sitter-go | P2 |

# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-145: [Tree-sitter] Core Integration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-145 |
| Title | [Tree-sitter] Core Integration - tree-sitter bindings for Node.js |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-145.docx |

---

## 1. Architecture Overview

### 1.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     mcp-code-intelligence-nodejs              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────────┐                  │
│  │  MCP Server  │     │   File Watcher   │                  │
│  │  (tools)     │     │   (chokidar)     │                  │
│  └──────┬───────┘     └────────┬─────────┘                  │
│         │                      │                             │
│         │              ┌───────▼──────────┐                  │
│         │              │  TreeSitterIndexer│                  │
│         │              │  (orchestrator)   │                  │
│         │              └───────┬──────────┘                  │
│         │                      │                             │
│         │         ┌────────────┼────────────┐                │
│         │         │            │            │                │
│         │  ┌──────▼─────┐ ┌───▼────┐ ┌────▼─────┐          │
│         │  │  Grammar   │ │  AST   │ │  Regex   │          │
│         │  │  Registry  │ │ Utils  │ │ Fallback │          │
│         │  └──────┬─────┘ └────────┘ └──────────┘          │
│         │         │                                          │
│         │  ┌──────▼─────────────────────────┐               │
│         │  │     Language Parsers            │               │
│         │  │  ┌────────┐ ┌────────┐ ┌─────┐ │               │
│         │  │  │   TS   │ │ Python │ │ ... │ │               │
│         │  │  └────────┘ └────────┘ └─────┘ │               │
│         │  └────────────────┬────────────────┘               │
│         │                   │                                │
│  ┌──────▼───────────────────▼──────────────────┐            │
│  │              SQLite Database                  │            │
│  │  ┌──────────┐  ┌───────────────┐  ┌───────┐ │            │
│  │  │ symbols  │  │ relationships │  │ files │ │            │
│  │  └──────────┘  └───────────────┘  └───────┘ │            │
│  └──────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | ≥18.0 | Server runtime |
| Parsing | tree-sitter | 0.21.x | AST parsing engine |
| Grammars | tree-sitter-* | Latest | Per-language grammars |
| Database | better-sqlite3 | 9.x | SQLite bindings |
| File watching | chokidar | 3.x | File change detection |
| Protocol | @modelcontextprotocol/sdk | 1.x | MCP server |

---

## 2. Detailed Design

### 2.1 Module: GrammarRegistry

**File:** `src/parsers/grammar-registry.ts`

```typescript
import Parser from 'tree-sitter';

interface LanguageConfig {
  id: string;
  extensions: string[];
  grammarPackage: string;
  subpath?: string;
  parserModule: string;
}

class GrammarRegistry {
  private config: LanguageConfig[];
  private parsers: Map<string, Parser> = new Map();        // languageId → Parser
  private languageParsers: Map<string, ILanguageParser> = new Map();
  private extensionMap: Map<string, string> = new Map();   // extension → languageId
  private unavailable: Set<string> = new Set();            // failed languages

  constructor(configPath: string) {
    this.config = JSON.parse(readFileSync(configPath, 'utf-8')).languages;
    this.buildExtensionMap();
  }

  getParser(filePath: string): ILanguageParser | null {
    const ext = path.extname(filePath);
    const langId = this.extensionMap.get(ext);
    
    if (!langId || this.unavailable.has(langId)) return null;
    
    if (this.languageParsers.has(langId)) {
      return this.languageParsers.get(langId)!;
    }
    
    return this.loadParser(langId);
  }

  private loadParser(langId: string): ILanguageParser | null {
    try {
      const config = this.config.find(c => c.id === langId)!;
      const grammar = require(config.grammarPackage);
      const language = config.subpath ? grammar[config.subpath] : grammar;
      
      const parser = new Parser();
      parser.setLanguage(language);
      this.parsers.set(langId, parser);
      
      const ParserClass = require(config.parserModule).default;
      const langParser = new ParserClass(parser, this.getUtils());
      this.languageParsers.set(langId, langParser);
      
      return langParser;
    } catch (error) {
      logger.error(`Failed to load grammar for ${langId}:`, error);
      this.unavailable.add(langId);
      return null;
    }
  }
}
```

### 2.2 Module: AST Utilities

**File:** `src/parsers/ast-utils.ts`

```typescript
import { SyntaxNode } from 'tree-sitter';

export function walkTree(node: SyntaxNode, visitor: NodeVisitor): void {
  const stack: SyntaxNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const shouldDescend = visitor.enter?.(current);
    if (shouldDescend !== false) {
      // Push children in reverse order so first child is processed first
      for (let i = current.childCount - 1; i >= 0; i--) {
        stack.push(current.child(i)!);
      }
    }
    visitor.leave?.(current);
  }
}

export function findNodes(node: SyntaxNode, type: string): SyntaxNode[] {
  const results: SyntaxNode[] = [];
  walkTree(node, {
    enter(n) {
      if (n.type === type) results.push(n);
    }
  });
  return results;
}

export function findFirst(node: SyntaxNode, type: string): SyntaxNode | null {
  let result: SyntaxNode | null = null;
  walkTree(node, {
    enter(n) {
      if (n.type === type) { result = n; return false; }
    }
  });
  return result;
}

export function getNodeText(node: SyntaxNode, source: string): string {
  return source.substring(node.startIndex, node.endIndex);
}

export function getNodeRange(node: SyntaxNode): { startLine: number; endLine: number } {
  return {
    startLine: node.startPosition.row + 1,  // 1-based
    endLine: node.endPosition.row + 1
  };
}

export function getAncestorOfType(node: SyntaxNode, type: string): SyntaxNode | null {
  let current = node.parent;
  while (current) {
    if (current.type === type) return current;
    current = current.parent;
  }
  return null;
}

export function getChildrenOfType(node: SyntaxNode, type: string): SyntaxNode[] {
  const results: SyntaxNode[] = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === type) results.push(child);
  }
  return results;
}
```

### 2.3 Module: TreeSitterIndexer

**File:** `src/parsers/tree-sitter-indexer.ts`

```typescript
class TreeSitterIndexer {
  private registry: GrammarRegistry;
  private db: Database;
  private regexFallback: RegexExtractor;

  async indexFile(filePath: string): Promise<IndexResult> {
    const startTime = Date.now();
    const source = await readFile(filePath, 'utf-8');
    const parser = this.registry.getParser(filePath);
    
    let result: ParseResult;
    let method: 'tree-sitter' | 'regex-fallback';
    
    if (parser) {
      result = parser.parse(source, filePath);
      method = 'tree-sitter';
    } else {
      result = this.regexFallback.extract(source, filePath);
      method = 'regex-fallback';
    }
    
    // Atomic database update
    this.db.transaction(() => {
      this.db.run('DELETE FROM relationships WHERE file_path = ?', filePath);
      this.db.run('DELETE FROM symbols WHERE file_path = ?', filePath);
      
      for (const symbol of result.symbols) {
        this.insertSymbol(symbol);
      }
      for (const rel of result.relationships) {
        this.insertRelationship(rel);
      }
    })();
    
    return {
      filePath,
      symbolCount: result.symbols.length,
      relationshipCount: result.relationships.length,
      parseErrors: result.errors.length,
      duration: Date.now() - startTime,
      method
    };
  }
}
```

### 2.4 Module: ILanguageParser Interface

**File:** `src/parsers/types.ts`

```typescript
export interface ILanguageParser {
  readonly languageId: string;
  parse(source: string, filePath: string): ParseResult;
  getSupportedExtensions(): string[];
}

export interface ParseResult {
  symbols: ExtractedSymbol[];
  relationships: ExtractedRelationship[];
  errors: ParseError[];
}

export interface ExtractedSymbol {
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

export interface ExtractedRelationship {
  sourceSymbol: string;
  targetSymbol: string;
  kind: RelationshipKind;
  line: number;
  metadata?: Record<string, unknown>;
}

export type SymbolKind = 'function' | 'class' | 'method' | 'interface' | 
  'type' | 'enum' | 'variable' | 'namespace' | 'constructor' | 'property';

export type RelationshipKind = 'calls' | 'imports' | 'inherits' | 
  'implements' | 'uses' | 'decorates';
```

---

## 3. Database Schema Changes

### 3.1 Migration Script

**File:** `src/database/migrations/002-tree-sitter-schema.sql`

```sql
-- Add enhanced columns to symbols table
ALTER TABLE symbols ADD COLUMN parameters TEXT;
ALTER TABLE symbols ADD COLUMN return_type TEXT;
ALTER TABLE symbols ADD COLUMN parent_symbol_id INTEGER REFERENCES symbols(id);
ALTER TABLE symbols ADD COLUMN decorators TEXT;
ALTER TABLE symbols ADD COLUMN complexity INTEGER;
ALTER TABLE symbols ADD COLUMN is_async INTEGER DEFAULT 0;
ALTER TABLE symbols ADD COLUMN is_exported INTEGER DEFAULT 0;
ALTER TABLE symbols ADD COLUMN doc_comment TEXT;
ALTER TABLE symbols ADD COLUMN start_line INTEGER;
ALTER TABLE symbols ADD COLUMN end_line INTEGER;
ALTER TABLE symbols ADD COLUMN modifiers TEXT;

-- Create relationships table
CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_symbol_id INTEGER NOT NULL,
    target_symbol TEXT NOT NULL,
    target_symbol_id INTEGER,
    kind TEXT NOT NULL,
    file_path TEXT NOT NULL,
    line INTEGER NOT NULL,
    metadata TEXT,
    FOREIGN KEY (source_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    FOREIGN KEY (target_symbol_id) REFERENCES symbols(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rel_source_kind ON relationships(source_symbol_id, kind);
CREATE INDEX IF NOT EXISTS idx_rel_target_kind ON relationships(target_symbol, kind);
CREATE INDEX IF NOT EXISTS idx_rel_target_id ON relationships(target_symbol_id);
CREATE INDEX IF NOT EXISTS idx_rel_file ON relationships(file_path);
CREATE INDEX IF NOT EXISTS idx_sym_parent ON symbols(parent_symbol_id);
CREATE INDEX IF NOT EXISTS idx_sym_file_kind ON symbols(file_path, kind);
```

---

## 4. File Structure

```
src/parsers/
├── types.ts                    # Interfaces (ILanguageParser, ParseResult, etc.)
├── grammar-registry.ts         # Grammar loading and caching
├── ast-utils.ts               # Shared AST traversal utilities
├── tree-sitter-indexer.ts     # Orchestrator (file → parse → store)
├── regex-fallback.ts          # Legacy regex extraction (fallback)
├── grammar-config.json        # Language → grammar mapping
└── languages/
    ├── typescript-parser.ts   # KSA-146
    ├── javascript-parser.ts   # KSA-146
    ├── python-parser.ts       # Future
    └── kotlin-parser.ts       # Future

src/database/
├── migrations/
│   ├── 001-initial-schema.sql
│   └── 002-tree-sitter-schema.sql
└── migrator.ts                # Schema migration runner
```

---

## 5. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Install tree-sitter + grammar packages | package.json | 0.5h |
| 2 | Create ILanguageParser interface | src/parsers/types.ts | 1h |
| 3 | Implement AST utilities | src/parsers/ast-utils.ts | 2h |
| 4 | Implement GrammarRegistry | src/parsers/grammar-registry.ts | 3h |
| 5 | Implement TreeSitterIndexer | src/parsers/tree-sitter-indexer.ts | 3h |
| 6 | Create migration script | src/database/migrations/002-*.sql | 1h |
| 7 | Implement migration runner | src/database/migrator.ts | 2h |
| 8 | Preserve regex fallback | src/parsers/regex-fallback.ts | 1h |
| 9 | Create grammar-config.json | src/parsers/grammar-config.json | 0.5h |
| 10 | Integration with existing indexer | src/indexer/index.ts | 2h |
| 11 | Unit tests for AST utilities | tests/parsers/ast-utils.test.ts | 2h |
| 12 | Integration tests | tests/parsers/indexer.test.ts | 3h |
| 13 | Performance benchmarks | tests/benchmarks/parse-perf.ts | 1h |

**Total estimated effort:** ~22 hours (3 days)

---

## 6. Error Handling

| Scenario | Strategy | Recovery |
|----------|----------|----------|
| Grammar package not installed | Catch require() error, mark unavailable | Regex fallback |
| Native binding compilation fails | Catch at startup, log error | Regex fallback for all |
| Parse error (invalid syntax) | tree-sitter returns partial AST | Extract what's possible |
| File too large (>1MB) | Skip tree-sitter, use regex | Log warning |
| Database locked | Retry with exponential backoff (3 attempts) | Skip file this cycle |
| Out of memory | Catch, skip file | Log, continue with next file |

---

## 7. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Grammar loading time | Lazy load + cache forever |
| Parser instance creation | One per language, reused |
| Large file parsing | tree-sitter is incremental, handles well |
| Batch indexing | Parallel file reads, sequential DB writes |
| Memory pressure | Parser instances are lightweight (~5MB each) |
| SQLite write contention | WAL mode + transaction batching |

---

## 8. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Malicious source files | tree-sitter has bounded parsing (no infinite loops) |
| Path traversal in file_path | Validate paths are within workspace |
| SQL injection | Parameterized queries only |
| Native addon security | tree-sitter is well-audited, MIT licensed |

---

## 9. Testing Strategy

| Level | Scope | Tools |
|-------|-------|-------|
| Unit | AST utilities, GrammarRegistry | Jest/Vitest |
| Integration | Full indexing pipeline | Real files + SQLite |
| Performance | Parse speed benchmarks | Custom benchmark harness |
| Regression | Existing tool output unchanged | Snapshot tests |

# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-153: [Graph] Data Model & Storage

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-153 |
| Title | [Graph] Data Model & Storage - relationships table |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-153.docx |

---

## 1. Architecture Overview

### 1.1 Storage Layer Design

The graph storage uses SQLite with WAL mode. Two tables form the graph: `symbols` (nodes) and `relationships` (edges). The design prioritizes:
- Fast single-hop queries (callers/callees)
- Atomic per-file updates
- Incremental indexing without full rebuild

### 1.2 Data Model (ER Diagram)

```
┌─────────────────────────┐         ┌─────────────────────────────┐
│       symbols           │         │       relationships          │
├─────────────────────────┤         ├─────────────────────────────┤
│ id (PK)                 │◄────────│ source_symbol_id (FK)       │
│ name                    │         │ id (PK)                     │
│ kind                    │    ┌───►│ target_symbol_id (FK, null) │
│ file_path               │    │    │ target_symbol (text)        │
│ line                    │    │    │ kind                        │
│ signature               │    │    │ file_path                   │
│ parameters (new)        │    │    │ line                        │
│ return_type (new)       │    │    │ metadata (JSON)             │
│ parent_symbol_id (FK)───┼────┘    └─────────────────────────────┘
│ decorators (new, JSON)  │
│ complexity (new)        │
│ is_async (new)          │
│ is_exported (new)       │
│ doc_comment (new)       │
│ start_line (new)        │
│ end_line (new)          │
│ modifiers (new, JSON)   │
└─────────────────────────┘
```

---

## 2. Detailed Design

### 2.1 Module: Schema Migration

**File:** `src/database/migrations/002-graph-schema.sql`

```sql
-- ============================================
-- Migration 002: Graph Data Model
-- Ticket: KSA-153
-- ============================================

-- 1. Enhanced symbols columns
ALTER TABLE symbols ADD COLUMN parameters TEXT;
ALTER TABLE symbols ADD COLUMN return_type TEXT;
ALTER TABLE symbols ADD COLUMN parent_symbol_id INTEGER;
ALTER TABLE symbols ADD COLUMN decorators TEXT;
ALTER TABLE symbols ADD COLUMN complexity INTEGER;
ALTER TABLE symbols ADD COLUMN is_async INTEGER DEFAULT 0;
ALTER TABLE symbols ADD COLUMN is_exported INTEGER DEFAULT 0;
ALTER TABLE symbols ADD COLUMN doc_comment TEXT;
ALTER TABLE symbols ADD COLUMN start_line INTEGER;
ALTER TABLE symbols ADD COLUMN end_line INTEGER;
ALTER TABLE symbols ADD COLUMN modifiers TEXT;

-- 2. Relationships table
CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_symbol_id INTEGER NOT NULL,
    target_symbol TEXT NOT NULL,
    target_symbol_id INTEGER,
    kind TEXT NOT NULL CHECK(kind IN ('calls','imports','inherits','implements','uses','decorates')),
    file_path TEXT NOT NULL,
    line INTEGER NOT NULL,
    metadata TEXT,
    FOREIGN KEY (source_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    FOREIGN KEY (target_symbol_id) REFERENCES symbols(id) ON DELETE SET NULL
);

-- 3. Indexes for graph traversal
CREATE INDEX IF NOT EXISTS idx_rel_source_kind ON relationships(source_symbol_id, kind);
CREATE INDEX IF NOT EXISTS idx_rel_target_kind ON relationships(target_symbol, kind);
CREATE INDEX IF NOT EXISTS idx_rel_target_id ON relationships(target_symbol_id) WHERE target_symbol_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rel_file ON relationships(file_path);
CREATE INDEX IF NOT EXISTS idx_sym_parent ON symbols(parent_symbol_id) WHERE parent_symbol_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sym_file_kind ON symbols(file_path, kind);
CREATE INDEX IF NOT EXISTS idx_sym_exported ON symbols(is_exported) WHERE is_exported = 1;

-- 4. Schema version
INSERT OR REPLACE INTO metadata (key, value) VALUES ('schema_version', '2');
```

### 2.2 Module: GraphRepository

**File:** `src/database/graph-repository.ts`

```typescript
class GraphRepository {
  private db: Database;
  
  // Prepared statements (cached)
  private stmts: {
    insertRelationship: Statement;
    deleteFileRelationships: Statement;
    findCallers: Statement;
    findCallees: Statement;
    findImports: Statement;
    resolveTarget: Statement;
  };

  constructor(db: Database) {
    this.db = db;
    this.prepareStatements();
  }

  /** Insert relationships for a file (within transaction) */
  insertRelationships(relationships: ExtractedRelationship[], fileSymbolIds: Map<string, number>): void {
    for (const rel of relationships) {
      const sourceId = fileSymbolIds.get(rel.sourceSymbol);
      if (!sourceId) continue; // Skip if source not found
      
      this.stmts.insertRelationship.run(
        sourceId,
        rel.targetSymbol,
        null, // target_symbol_id resolved later
        rel.kind,
        rel.filePath || '',
        rel.line,
        rel.metadata ? JSON.stringify(rel.metadata) : null
      );
    }
  }

  /** Delete all relationships originating from a file */
  deleteFileRelationships(filePath: string): void {
    this.stmts.deleteFileRelationships.run(filePath);
  }

  /** Find direct callers of a symbol */
  findCallers(symbolName: string, kind: string = 'calls', limit: number = 20): CallerResult[] {
    return this.stmts.findCallers.all(symbolName, kind, limit) as CallerResult[];
  }

  /** Find direct callees of a symbol */
  findCallees(symbolId: number, kind: string = 'calls', limit: number = 20): CalleeResult[] {
    return this.stmts.findCallees.all(symbolId, kind, limit) as CalleeResult[];
  }

  /** Resolve target_symbol_id for unresolved relationships */
  resolveTargets(): number {
    const unresolved = this.db.prepare(`
      SELECT r.id, r.target_symbol 
      FROM relationships r 
      WHERE r.target_symbol_id IS NULL
      LIMIT 1000
    `).all();
    
    let resolved = 0;
    for (const row of unresolved) {
      const target = this.db.prepare(
        'SELECT id FROM symbols WHERE name = ? LIMIT 1'
      ).get(row.target_symbol);
      
      if (target) {
        this.stmts.resolveTarget.run(target.id, row.id);
        resolved++;
      }
    }
    return resolved;
  }

  private prepareStatements(): void {
    this.stmts = {
      insertRelationship: this.db.prepare(`
        INSERT INTO relationships (source_symbol_id, target_symbol, target_symbol_id, kind, file_path, line, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      deleteFileRelationships: this.db.prepare(
        'DELETE FROM relationships WHERE file_path = ?'
      ),
      findCallers: this.db.prepare(`
        SELECT s.name, s.kind, s.file_path, s.line as def_line, r.line as call_line,
               s.parameters, s.is_async, s.id
        FROM relationships r
        JOIN symbols s ON s.id = r.source_symbol_id
        WHERE r.target_symbol = ? AND r.kind = ?
        ORDER BY s.file_path, r.line
        LIMIT ?
      `),
      findCallees: this.db.prepare(`
        SELECT r.target_symbol as name, r.line as call_line, r.metadata,
               ts.kind, ts.file_path, ts.line as def_line
        FROM relationships r
        LEFT JOIN symbols ts ON ts.id = r.target_symbol_id
        WHERE r.source_symbol_id = ? AND r.kind = ?
        ORDER BY r.line
        LIMIT ?
      `),
      resolveTarget: this.db.prepare(
        'UPDATE relationships SET target_symbol_id = ? WHERE id = ?'
      )
    };
  }
}
```

### 2.3 Module: File Indexing Transaction

**File:** `src/database/file-indexer.ts`

```typescript
class FileIndexer {
  private db: Database;
  private graphRepo: GraphRepository;

  /** Atomic re-index of a single file */
  reindexFile(filePath: string, parseResult: ParseResult): FileIndexResult {
    const transaction = this.db.transaction(() => {
      // 1. Delete old data
      this.graphRepo.deleteFileRelationships(filePath);
      this.db.prepare('DELETE FROM symbols WHERE file_path = ?').run(filePath);
      
      // 2. Insert new symbols, collect IDs
      const symbolIds = new Map<string, number>();
      for (const symbol of parseResult.symbols) {
        const result = this.insertSymbol(symbol);
        symbolIds.set(symbol.name, result.lastInsertRowid as number);
      }
      
      // 3. Resolve parent_symbol_id (within same file)
      this.resolveParents(parseResult.symbols, symbolIds);
      
      // 4. Insert relationships
      this.graphRepo.insertRelationships(parseResult.relationships, symbolIds);
      
      return { symbolCount: symbolIds.size, relCount: parseResult.relationships.length };
    });
    
    return transaction();
  }
}
```

---

## 3. Performance Design

### 3.1 Index Strategy Analysis

| Query Pattern | Index | Expected Performance |
|---------------|-------|---------------------|
| Find callers by name | idx_rel_target_kind | O(log n) + O(k) where k = result count |
| Find callees by ID | idx_rel_source_kind | O(log n) + O(k) |
| Delete file rels | idx_rel_file | O(log n) + O(m) where m = file rels |
| Find class methods | idx_sym_parent | O(log n) + O(k) |

### 3.2 Benchmarks (Target)

| Operation | 10K rels | 100K rels | 500K rels |
|-----------|----------|-----------|-----------|
| Find callers (1 symbol) | <5ms | <20ms | <50ms |
| Find callees (1 symbol) | <5ms | <20ms | <50ms |
| Delete file rels | <2ms | <5ms | <10ms |
| Insert 50 rels (batch) | <5ms | <5ms | <5ms |
| Full file re-index | <20ms | <30ms | <50ms |

### 3.3 WAL Mode Configuration

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;  -- 64MB cache
PRAGMA mmap_size = 268435456; -- 256MB mmap
```

---

## 4. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Create migration SQL | src/database/migrations/002-graph-schema.sql | 1h |
| 2 | Implement migration runner | src/database/migrator.ts | 2h |
| 3 | Implement GraphRepository | src/database/graph-repository.ts | 4h |
| 4 | Implement FileIndexer | src/database/file-indexer.ts | 3h |
| 5 | Add target resolution background job | src/database/resolve-targets.ts | 2h |
| 6 | Unit tests for GraphRepository | tests/database/graph-repo.test.ts | 3h |
| 7 | Performance benchmarks | tests/benchmarks/graph-perf.ts | 2h |
| 8 | Integration with existing indexer | src/indexer/index.ts | 2h |

**Total estimated effort:** ~19 hours (2.5 days)

---

## 5. Error Handling

| Error | Strategy | Recovery |
|-------|----------|----------|
| FK violation | Skip relationship, log warning | Continue indexing |
| Transaction failure | Rollback, retry once | Skip file if retry fails |
| Disk full | Catch SQLITE_FULL, stop indexing | Alert user |
| Corrupted index | Detect via PRAGMA integrity_check | Full re-index |
| Concurrent write | WAL handles this | No action needed |

---

## 6. Security

- All queries use parameterized statements (no SQL injection)
- File paths validated to be within workspace root
- JSON metadata size limited to 4KB per relationship
- No user-facing SQL (all queries internal)

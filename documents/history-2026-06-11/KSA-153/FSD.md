# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-153: [Graph] Data Model & Storage

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-153 |
| Title | [Graph] Data Model & Storage - relationships table |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-153.docx |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the graph data model design — the `relationships` table schema, enhanced `symbols` table columns, indexes, and CRUD operations for storing code relationships in SQLite.

### 1.2 Scope

- SQLite schema design for relationships table
- Enhanced symbols table columns
- Index strategy for graph traversal performance
- CRUD operations (insert, delete, query)
- Incremental update strategy (per-file re-index)
- Migration scripts

---

## 2. System Overview

### 2.1 Data Flow

```
Language Parser (KSA-146) 
    │
    ▼ ExtractedRelationship[]
Graph Storage Layer (this ticket)
    │
    ▼ SQL queries
Call Graph Tools (KSA-154)
    │
    ▼ JSON response
AI Agents (MCP clients)
```

### 2.2 Storage Architecture

- **Engine**: SQLite 3.x with WAL mode
- **Tables**: `symbols` (enhanced), `relationships` (new)
- **Indexes**: Composite indexes for graph traversal patterns
- **Transactions**: Per-file atomic updates (delete old + insert new)

---

## 3. Functional Requirements

### 3.1 Feature: Relationships Table

#### 3.1.1 Schema

```sql
CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_symbol_id INTEGER NOT NULL,
    target_symbol TEXT NOT NULL,
    target_symbol_id INTEGER,
    kind TEXT NOT NULL CHECK(kind IN ('calls','imports','inherits','implements','uses','decorates')),
    file_path TEXT NOT NULL,
    line INTEGER NOT NULL,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (source_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    FOREIGN KEY (target_symbol_id) REFERENCES symbols(id) ON DELETE SET NULL
);
```

#### 3.1.2 Use Case: Store Relationships

**Use Case ID:** UC-01 — Insert Relationships After Parse

| Step | Action | SQL |
|------|--------|-----|
| 1 | Begin transaction | `BEGIN TRANSACTION` |
| 2 | Delete existing relationships for file | `DELETE FROM relationships WHERE file_path = ?` |
| 3 | Insert new relationships (batch) | `INSERT INTO relationships (source_symbol_id, target_symbol, kind, file_path, line, metadata) VALUES (?, ?, ?, ?, ?, ?)` |
| 4 | Commit | `COMMIT` |

**Alternative Flow — Resolve target_symbol_id:**

| Step | Action |
|------|--------|
| 3a | After insert, attempt to resolve target_symbol to target_symbol_id |
| 3b | `UPDATE relationships SET target_symbol_id = (SELECT id FROM symbols WHERE name = ? AND file_path LIKE ?) WHERE target_symbol = ? AND target_symbol_id IS NULL` |
| 3c | Unresolved targets remain with target_symbol_id = NULL |

#### 3.1.3 Use Case: Query Callers

**Use Case ID:** UC-02 — Find Callers of Symbol

```sql
-- Direct callers (depth=1)
SELECT s.name, s.kind, s.file_path, s.line, r.line as call_line
FROM relationships r
JOIN symbols s ON s.id = r.source_symbol_id
WHERE r.target_symbol = ? AND r.kind = 'calls';

-- Or by target_symbol_id (faster if resolved)
SELECT s.name, s.kind, s.file_path, s.line, r.line as call_line
FROM relationships r
JOIN symbols s ON s.id = r.source_symbol_id
WHERE r.target_symbol_id = ? AND r.kind = 'calls';
```

#### 3.1.4 Use Case: Query Callees

**Use Case ID:** UC-03 — Find Callees of Symbol

```sql
SELECT r.target_symbol, r.line, r.metadata,
       ts.file_path as target_file, ts.kind as target_kind
FROM relationships r
LEFT JOIN symbols ts ON ts.id = r.target_symbol_id
WHERE r.source_symbol_id = ? AND r.kind = 'calls';
```

#### 3.1.5 Use Case: Query Imports

**Use Case ID:** UC-04 — Find Imports of File

```sql
SELECT r.target_symbol, r.line, r.metadata
FROM relationships r
WHERE r.file_path = ? AND r.kind = 'imports'
ORDER BY r.line;
```

#### 3.1.6 Use Case: Query Inheritance

**Use Case ID:** UC-05 — Find Class Hierarchy

```sql
-- Find what a class extends/implements
SELECT r.target_symbol, r.kind
FROM relationships r
WHERE r.source_symbol_id = ? AND r.kind IN ('inherits', 'implements');

-- Find implementors of an interface
SELECT s.name, s.file_path
FROM relationships r
JOIN symbols s ON s.id = r.source_symbol_id
WHERE r.target_symbol = ? AND r.kind = 'implements';
```

---

### 3.2 Feature: Enhanced Symbols Table

#### 3.2.1 Migration SQL

```sql
-- Idempotent migration (safe to run multiple times)
-- Check if columns exist before adding

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
```

#### 3.2.2 Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-01 | Nullable columns | All new columns nullable — no existing data affected |
| BR-02 | JSON arrays | decorators and modifiers stored as JSON arrays |
| BR-03 | Parent resolution | parent_symbol_id resolved during same-file indexing |
| BR-04 | Complexity range | 1-100 (null if not computed) |

---

### 3.3 Feature: Index Strategy

#### 3.3.1 Required Indexes

```sql
-- Relationships indexes
CREATE INDEX IF NOT EXISTS idx_rel_source_kind 
    ON relationships(source_symbol_id, kind);

CREATE INDEX IF NOT EXISTS idx_rel_target_kind 
    ON relationships(target_symbol, kind);

CREATE INDEX IF NOT EXISTS idx_rel_target_id 
    ON relationships(target_symbol_id) WHERE target_symbol_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rel_file 
    ON relationships(file_path);

-- Enhanced symbols indexes
CREATE INDEX IF NOT EXISTS idx_sym_parent 
    ON symbols(parent_symbol_id) WHERE parent_symbol_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sym_file_kind 
    ON symbols(file_path, kind);

CREATE INDEX IF NOT EXISTS idx_sym_exported 
    ON symbols(is_exported) WHERE is_exported = 1;
```

#### 3.3.2 Performance Targets

| Query Pattern | Target | Index Used |
|---------------|--------|-----------|
| Find callers of symbol | <50ms @ 100K rows | idx_rel_target_kind |
| Find callees of symbol | <50ms @ 100K rows | idx_rel_source_kind |
| Delete file relationships | <10ms | idx_rel_file |
| Find class methods | <10ms | idx_sym_parent |
| Find exported symbols | <20ms | idx_sym_exported |

---

### 3.4 Feature: Incremental Updates

#### 3.4.1 Use Case: Re-index Single File

**Use Case ID:** UC-06 — Incremental File Re-index

| Step | Action | SQL |
|------|--------|-----|
| 1 | Begin transaction | `BEGIN` |
| 2 | Get old symbol IDs for file | `SELECT id FROM symbols WHERE file_path = ?` |
| 3 | Delete relationships from file | `DELETE FROM relationships WHERE file_path = ?` |
| 4 | Delete symbols from file | `DELETE FROM symbols WHERE file_path = ?` |
| 5 | Insert new symbols | Batch INSERT |
| 6 | Insert new relationships | Batch INSERT |
| 7 | Attempt target resolution | UPDATE target_symbol_id where possible |
| 8 | Commit | `COMMIT` |

**Business Rules:**

| ID | Rule | Description |
|----|------|-------------|
| BR-05 | Atomic | All steps in single transaction |
| BR-06 | Cascade | Deleting symbols cascades to relationships (FK) |
| BR-07 | Stale refs | Other files' relationships pointing to deleted symbols get target_symbol_id = NULL |
| BR-08 | Lazy resolve | target_symbol_id re-resolved on next query or background job |

---

## 4. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | Single file re-index | <100ms |
| Performance | Bulk insert 1000 relationships | <500ms |
| Performance | Graph query (1-hop) | <50ms |
| Scalability | Max relationships | 1M+ rows |
| Scalability | Max symbols | 500K+ rows |
| Integrity | FK constraints | Enforced |
| Durability | WAL mode | Crash-safe |

---

## 5. Error Handling

| Error | Handling | Impact |
|-------|----------|--------|
| FK violation (source_symbol_id) | Skip relationship, log warning | Relationship not stored |
| Duplicate relationship | IGNORE or REPLACE | No error, idempotent |
| Transaction failure | Rollback, retry once | File not indexed this cycle |
| Disk full | Log critical, stop indexing | Indexing paused |
| Corrupted DB | Detect via integrity_check, rebuild | Full re-index needed |

---

## 6. Migration Strategy

### 6.1 Migration Steps

1. **Detect current schema version** (check if relationships table exists)
2. **Backup database** (copy .db file)
3. **Run ALTER TABLE** for new symbol columns
4. **CREATE TABLE** relationships
5. **CREATE INDEX** all indexes
6. **Update schema version** in metadata table
7. **No re-index required** — new columns populated on next file change

### 6.2 Rollback

- Drop relationships table
- New symbol columns remain (nullable, no harm)
- Or restore from backup

---

## 7. Open Issues

| # | Issue | Decision Needed |
|---|-------|-----------------|
| 1 | Should target_symbol use qualified name or simple name? | Qualified (module.Class.method) preferred |
| 2 | Max metadata JSON size? | 4KB limit recommended |
| 3 | Background job for target_symbol_id resolution? | Yes, run after batch index |

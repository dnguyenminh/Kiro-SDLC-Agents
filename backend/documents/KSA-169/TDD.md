# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-169: [Infra] Full-body Embedding + Persistent Graph + Ignore

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-169 |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Related FSD | FSD-v1-KSA-169.docx |

---

## 1. Architecture Overview

This ticket adds three infrastructure layers to the existing Code Intelligence system:

```
┌─────────────────────────────────────────────────────┐
│ MCP Tools (code_search, reindex)                     │
├─────────────────────────────────────────────────────┤
│ Search Engine (ENHANCED)                             │
│  ├── DualVectorSearch (sig + body embeddings)        │
│  └── ScoreCombiner (0.3 sig + 0.7 body)            │
├─────────────────────────────────────────────────────┤
│ Embedding Pipeline (ENHANCED)                        │
│  ├── BodyExtractor (tree-sitter AST → body text)    │
│  ├── Chunker (512 tokens, 128 overlap)              │
│  └── EmbeddingGenerator (ONNX MiniLM)              │
├─────────────────────────────────────────────────────┤
│ Persistent Graph (NEW)                               │
│  ├── GraphStore (SQLite WAL)                        │
│  ├── CheckpointManager (5-min interval)             │
│  ├── IncrementalUpdater (FNV-1a hash diff)          │
│  └── StartupLoader (< 500ms)                       │
├─────────────────────────────────────────────────────┤
│ Ignore System (NEW)                                  │
│  ├── IgnoreParser (gitignore syntax)                │
│  ├── PatternMatcher (glob + negation)               │
│  └── DefaultIgnores (built-in patterns)             │
├─────────────────────────────────────────────────────┤
│ Existing Infrastructure                              │
│  ├── Tree-sitter Parser (KSA-145)                   │
│  ├── SQLite + sqlite-vec                            │
│  └── ONNX Runtime                                   │
└─────────────────────────────────────────────────────┘
```

---

## 2. Module Design

### 2.1 File Structure

```
src/mcp_code_intel/
├── embedding/
│   ├── __init__.py
│   ├── body_extractor.py      # Extract function bodies from AST
│   ├── chunker.py             # Token-based chunking with overlap
│   ├── dual_vector_search.py  # Combined sig+body search
│   └── embedding_pipeline.py  # Orchestrates extraction → chunk → embed
├── persistence/
│   ├── __init__.py
│   ├── graph_store.py         # SQLite WAL persistent graph
│   ├── checkpoint_manager.py  # Periodic save + graceful shutdown
│   ├── incremental_updater.py # FNV-1a hash-based change detection
│   └── startup_loader.py      # Fast graph load on startup
├── ignore/
│   ├── __init__.py
│   ├── ignore_parser.py       # Parse .codeintelignore files
│   ├── pattern_matcher.py     # Glob pattern matching
│   └── default_ignores.py     # Built-in ignore patterns
└── tools/
    └── reindex_tool.py        # MCP tool for manual re-index
```

### 2.2 Class Design

#### BodyExtractor

```python
class BodyExtractor:
    """Extract function bodies from tree-sitter AST nodes."""
    
    def extract_body(self, node: TreeSitterNode, source: bytes) -> str:
        """Extract body text from function/method AST node."""
        
    def extract_all_bodies(self, file_path: str) -> list[FunctionBody]:
        """Extract all function bodies from a file."""

@dataclass
class FunctionBody:
    symbol_id: str
    name: str
    body_text: str
    token_count: int
    start_line: int
    end_line: int
```

#### Chunker

```python
class Chunker:
    """Split text into overlapping chunks for embedding."""
    
    def __init__(self, max_tokens: int = 512, overlap: int = 128):
        self.max_tokens = max_tokens
        self.overlap = overlap
    
    def chunk(self, text: str) -> list[Chunk]:
        """Split text into chunks. Returns single chunk if <= max_tokens."""

@dataclass
class Chunk:
    text: str
    index: int
    token_count: int
    start_offset: int
    end_offset: int
```

#### GraphStore

```python
class GraphStore:
    """Persistent graph storage using SQLite WAL."""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, isolation_level=None)
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")
    
    def load_graph(self) -> GraphData:
        """Load full graph from disk. Target: < 500ms."""
        
    def save_checkpoint(self) -> None:
        """Save current graph state to disk."""
        
    def update_file(self, file_path: str, nodes: list, edges: list) -> None:
        """Update graph for a single file (incremental)."""
        
    def remove_file(self, file_path: str) -> None:
        """Remove all nodes/edges for a deleted file."""
```

#### IncrementalUpdater

```python
class IncrementalUpdater:
    """Detect file changes using FNV-1a content hashing."""
    
    def scan_changes(self, workspace: str) -> ChangeSet:
        """Compare disk state against stored file_index."""

@dataclass
class ChangeSet:
    added: list[str]      # New files
    modified: list[str]   # Changed files
    deleted: list[str]    # Removed files
    unchanged: int        # Count of unchanged files
```

#### IgnoreParser

```python
class IgnoreParser:
    """Parse .codeintelignore files (gitignore syntax)."""
    
    def parse_file(self, path: str) -> list[IgnorePattern]:
        """Parse a .codeintelignore file."""
        
    def should_ignore(self, file_path: str, patterns: list[IgnorePattern]) -> bool:
        """Check if file matches any ignore pattern."""

@dataclass
class IgnorePattern:
    pattern: str
    is_negation: bool
    is_directory: bool
    source_file: str  # Which .codeintelignore defined this
```

---

## 3. Database Schema

### 3.1 New Tables

```sql
-- Embedding storage (extends existing)
CREATE TABLE IF NOT EXISTS body_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id INTEGER NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    embedding BLOB NOT NULL,  -- Float32[384]
    token_count INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(node_id, chunk_index)
);

-- File index for change detection
CREATE TABLE IF NOT EXISTS file_index (
    path TEXT PRIMARY KEY,
    mtime INTEGER NOT NULL,
    content_hash TEXT NOT NULL,  -- FNV-1a hex
    size_bytes INTEGER NOT NULL,
    last_indexed TEXT NOT NULL,
    symbol_count INTEGER DEFAULT 0
);

-- Graph metadata
CREATE TABLE IF NOT EXISTS graph_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_body_embeddings_node ON body_embeddings(node_id);
CREATE INDEX idx_file_index_hash ON file_index(content_hash);
```

### 3.2 Migration

```sql
-- Migration 003: Add persistence tables
-- Applied on first startup with new version

INSERT OR IGNORE INTO graph_meta (key, value) VALUES
    ('schema_version', '3'),
    ('last_checkpoint', ''),
    ('total_nodes', '0'),
    ('total_edges', '0');
```

---

## 4. Algorithm Details

### 4.1 FNV-1a Hash

```python
def fnv1a_hash(data: bytes) -> str:
    """FNV-1a 64-bit hash for fast content comparison."""
    FNV_OFFSET = 14695981039346656037
    FNV_PRIME = 1099511628211
    hash_value = FNV_OFFSET
    for byte in data:
        hash_value ^= byte
        hash_value = (hash_value * FNV_PRIME) & 0xFFFFFFFFFFFFFFFF
    return format(hash_value, '016x')
```

### 4.2 Dual-Vector Search

```python
def search(query: str, limit: int = 20) -> list[SearchResult]:
    query_embedding = embed(query)
    
    # Search signature embeddings
    sig_results = sqlite_vec_search(
        table="signature_embeddings",
        query=query_embedding,
        limit=limit * 3  # Over-fetch for re-ranking
    )
    
    # Search body embeddings (best chunk per function)
    body_results = sqlite_vec_search(
        table="body_embeddings",
        query=query_embedding,
        limit=limit * 3
    )
    
    # Combine scores
    combined = {}
    for r in sig_results:
        combined[r.node_id] = {"sig": r.score, "body": 0.0}
    for r in body_results:
        if r.node_id in combined:
            combined[r.node_id]["body"] = max(combined[r.node_id]["body"], r.score)
        else:
            combined[r.node_id] = {"sig": 0.0, "body": r.score}
    
    # Weighted combination
    ranked = []
    for node_id, scores in combined.items():
        final_score = 0.3 * scores["sig"] + 0.7 * scores["body"]
        ranked.append((node_id, final_score))
    
    ranked.sort(key=lambda x: x[1], reverse=True)
    return ranked[:limit]
```

### 4.3 Startup Sequence

```python
async def startup():
    t0 = time.monotonic()
    
    # 1. Open DB (< 10ms)
    db = GraphStore(DB_PATH)
    
    # 2. Load metadata (< 5ms)
    meta = db.load_meta()
    if meta.schema_version != CURRENT_VERSION:
        return cold_start()  # Incompatible, full re-index
    
    # 3. Load file index (< 50ms)
    file_index = db.load_file_index()
    
    # 4. Mark server ready (< 300ms total)
    elapsed = time.monotonic() - t0
    logger.info(f"Graph loaded in {elapsed*1000:.0f}ms ({meta.total_nodes} nodes)")
    
    # 5. Background: incremental update (non-blocking)
    asyncio.create_task(incremental_update(db, file_index))
```

---

## 5. Configuration

### 5.1 Default .codeintelignore

```
# Built-in defaults (always applied)
node_modules/
.git/
build/
dist/
target/
__pycache__/
.pytest_cache/
*.min.js
*.bundle.js
.gradle/
.idea/
.vscode/
*.pyc
*.class
*.o
*.so
```

### 5.2 Embedding Config

```python
EMBEDDING_CONFIG = {
    "model": "all-MiniLM-L6-v2",
    "dimensions": 384,
    "max_tokens": 512,
    "chunk_overlap": 128,
    "max_body_tokens": 10000,
    "min_body_lines": 3,
    "sig_weight": 0.3,
    "body_weight": 0.7,
    "batch_size": 32,
}
```

---

## 6. Performance Targets

| Operation | Target | Approach |
|-----------|--------|----------|
| Warm startup | < 500ms | SQLite mmap, lazy edge loading |
| Incremental (10 files) | < 2s | Hash-based skip, parallel embed |
| Full index (1000 files) | < 60s | Parallel parse + batch embed |
| Semantic search | < 200ms | sqlite-vec ANN |
| Checkpoint save | < 500ms | WAL mode, batch insert |

---

## 7. Error Handling

| Error | Recovery |
|-------|----------|
| Corrupt DB | Delete + full re-index |
| OOM during embedding | Reduce batch size, retry |
| File permission denied | Skip file, log warning |
| .codeintelignore syntax error | Use defaults, log error |
| Disk full | Abort checkpoint, keep memory state |

---

## 8. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | BodyExtractor class | embedding/body_extractor.py | 1d |
| 2 | Chunker class | embedding/chunker.py | 0.5d |
| 3 | DualVectorSearch | embedding/dual_vector_search.py | 1d |
| 4 | GraphStore (SQLite WAL) | persistence/graph_store.py | 2d |
| 5 | IncrementalUpdater | persistence/incremental_updater.py | 1d |
| 6 | StartupLoader | persistence/startup_loader.py | 1d |
| 7 | CheckpointManager | persistence/checkpoint_manager.py | 0.5d |
| 8 | IgnoreParser | ignore/ignore_parser.py | 1d |
| 9 | PatternMatcher | ignore/pattern_matcher.py | 0.5d |
| 10 | DefaultIgnores | ignore/default_ignores.py | 0.5d |
| 11 | DB migration | migrations/003_persistence.sql | 0.5d |
| 12 | Integration + tests | tests/ | 2d |

**Total estimate:** ~12 days (3 weeks with buffer)

---

## 9. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

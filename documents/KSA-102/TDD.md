# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-102: Adaptive Token Cache + Model Manager

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-102 |
| Title | Adaptive Token Cache + Model Manager for multilingual find_tools |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-21 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-102.docx |
| Related FSD | FSD-v1-KSA-102.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-21 | SA Agent | Initiate document from BRD + FSD |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical implementation of the Adaptive Token Cache and Model Manager for the MCP Code Intelligence Python server. It covers architecture, module design, data structures, and integration patterns.

### 1.2 Scope

- New module: `orchestration/cache/` — Adaptive Token Cache
- New module: `orchestration/models/` — Model Manager
- Modified: `orchestration/meta/find_tools.py` — integrate cache + embedding tiers
- Modified: `memory/embedding/model_downloader.py` — support multiple models

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | Python | 3.11+ |
| Runtime | ONNX Runtime | 1.16+ |
| Embedding Model | all-MiniLM-L6-v2 | latest |
| Storage | JSON files | N/A |
| Build Tool | pip / pyproject.toml | N/A |
| CI/CD | GitHub Actions | N/A |

### 1.4 Design Principles

- **Zero external deps** for cache module (stdlib only)
- **Graceful degradation** — system works without ONNX/model
- **Single Responsibility** — each file < 200 lines, each function < 20 lines
- **Lazy initialization** — model loaded only when needed
- **Non-blocking** — downloads and persistence never block find_tools

### 1.5 Constraints

- Max 200 lines per file (workspace code standard)
- Max 20 lines per function
- ONNX Runtime is optional dependency
- No network calls during search (only during model download)
- Must work on Windows, macOS, Linux

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-102.docx |
| FSD | FSD-v1-KSA-102.docx |

---

## 2. System Architecture

### 2.1 Architecture Overview

![Architecture Diagram](diagrams/architecture.png)

The feature adds two new subsystems to the existing orchestration layer:

1. **AdaptiveTokenCache** — in-memory cache with JSON persistence, sits between registry search and embedding search
2. **ModelManager** — MCP tool + model lifecycle management, wraps existing model_downloader
3. **EmbeddingSearcher** — adapter connecting find_tools to OnnxEmbeddingProvider with timeout

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| AdaptiveTokenCache | Store/lookup learned query→tool mappings | Python dict + JSON |
| CachePersistence | Debounced file I/O for cache | threading.Timer |
| ModelManager | MCP tool for model CRUD | MCP tool pattern |
| ModelRegistry | Track downloaded models | JSON file |
| EmbeddingSearcher | Compute embeddings + cosine similarity | numpy + ONNX |
| ToolEmbeddingIndex | Pre-computed embeddings for all tools | numpy array |

### 2.3 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| find_tools | AdaptiveTokenCache | In-process | Sync | Cache lookup/add |
| find_tools | EmbeddingSearcher | In-process | Sync (timeout) | Embedding search with 100ms timeout |
| ModelManager | ModelDownloader | In-process | Async (background) | Download model files |
| CachePersistence | Filesystem | File I/O | Async (debounced) | Write cache to disk |
| EmbeddingSearcher | OnnxProvider | In-process | Sync | ONNX inference |

---

## 3. API Design

### 3.1 API Overview

| # | Tool | Method | Description | Source |
|---|------|--------|-------------|--------|
| 1 | find_tools | execute | Enhanced with cache + embedding tiers | UC-1 |
| 2 | mem_model_manager | execute | Model lifecycle management | UC-2,3,4 |

### 3.2 Tool: mem_model_manager

**Implements:** UC-2, UC-3, UC-4

| Attribute | Value |
|-----------|-------|
| Tool Name | mem_model_manager |
| Registration | Registered in MCP server tool list |
| Auth | None (local tool) |

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["list", "download", "status", "switch"],
      "description": "Action to perform"
    },
    "model_name": {
      "type": "string",
      "description": "Model identifier (required for download/switch)"
    }
  },
  "required": ["action"]
}
```

**Response — action=list:**

```json
{
  "models": [
    {
      "name": "all-MiniLM-L6-v2",
      "display_name": "English (Small, Fast)",
      "size_mb": 90,
      "languages": ["en"],
      "vocab_size": 30522,
      "dimensions": 384,
      "downloaded": true,
      "active": true
    },
    {
      "name": "paraphrase-multilingual-MiniLM-L12-v2",
      "display_name": "Multilingual (50+ languages)",
      "size_mb": 470,
      "languages": ["en", "vi", "zh", "ja", "ko", "fr", "de", "es", "..."],
      "vocab_size": 250002,
      "dimensions": 384,
      "downloaded": false,
      "active": false
    }
  ]
}
```

**Response — action=status:**

```json
{
  "active_model": "all-MiniLM-L6-v2",
  "model_path": "/home/user/.code-intel/models/all-MiniLM-L6-v2",
  "dimensions": 384,
  "languages": ["en"],
  "cache_entries": 42,
  "cache_hit_rate": 0.73
}
```

**Error Responses:**

| Condition | Error Code | Message |
|-----------|------------|---------|
| Invalid action | INVALID_ACTION | "Invalid action. Use: list, download, status, switch" |
| Unknown model | MODEL_NOT_FOUND | "Unknown model: {name}. Use action='list'" |
| Download failed | DOWNLOAD_FAILED | "Download failed: {error}" |
| Switch without download | MODEL_NOT_DOWNLOADED | "Model not downloaded. Use action='download' first" |

---

## 4. Data Design

### 4.1 File: token-cache.json

**Location:** `{workspace}/.code-intel/token-cache.json`

```json
{
  "version": 1,
  "registry_hash": "a1b2c3d4",
  "entries": [
    {
      "tokens": ["issues", "jira", "search"],
      "tool_name": "jira_search",
      "score": 0.87,
      "timestamp": "2026-05-21T10:00:00Z",
      "hit_count": 15,
      "last_hit": "2026-05-21T14:30:00Z",
      "tool_version": "a1b2c3d4"
    }
  ]
}
```

**Size estimate:** ~500 bytes per entry × 10,000 max = ~5MB max

### 4.2 File: registry.json (Model Registry)

**Location:** `~/.code-intel/models/registry.json`

```json
{
  "active_model": "all-MiniLM-L6-v2",
  "models": {
    "all-MiniLM-L6-v2": {
      "path": "~/.code-intel/models/all-MiniLM-L6-v2",
      "downloaded_at": "2026-05-21T10:00:00Z",
      "size_bytes": 94000000,
      "vocab_size": 30522
    }
  },
  "last_updated": "2026-05-21T10:00:00Z"
}
```

---

## 5. Class / Module Design

### 5.1 Package Structure

```
mcp_code_intel/
├── orchestration/
│   ├── cache/
│   │   ├── __init__.py
│   │   ├── adaptive_cache.py      # AdaptiveTokenCache class
│   │   ├── cache_entry.py         # CacheEntry dataclass
│   │   ├── persistence.py         # DebouncedPersistence (file I/O)
│   │   └── invalidation.py        # Cache invalidation logic
│   ├── models/
│   │   ├── __init__.py
│   │   ├── model_manager.py       # ModelManager MCP tool
│   │   ├── model_catalog.py       # Known models catalog
│   │   └── model_registry.py      # Registry file management
│   ├── embedding/
│   │   ├── __init__.py
│   │   ├── embedding_searcher.py  # EmbeddingSearcher (find_tools adapter)
│   │   └── tool_index.py          # ToolEmbeddingIndex (pre-computed vectors)
│   └── meta/
│       └── find_tools.py          # MODIFIED: integrate cache + embedding
├── memory/
│   └── embedding/
│       ├── model_downloader.py    # MODIFIED: support multiple models
│       └── onnx_provider.py       # UNCHANGED
```

### 5.2 Key Interfaces

```python
# orchestration/cache/adaptive_cache.py
class AdaptiveTokenCache:
    """Self-learning token cache with fuzzy matching."""
    
    def find_fuzzy(self, tokens: set[str], threshold: float = 0.80) -> CacheEntry | None:
        """Find cache entry with ≥threshold token overlap."""
    
    def add(self, tokens: set[str], tool_name: str, score: float, registry_hash: str) -> None:
        """Add new cache entry from embedding result."""
    
    def invalidate_stale(self, current_hash: str) -> int:
        """Mark entries with mismatched registry_hash as stale. Returns count."""
    
    def load(self) -> None:
        """Load cache from disk (lazy, called on first access)."""
    
    @property
    def size(self) -> int:
        """Current number of active entries."""


# orchestration/embedding/embedding_searcher.py
class EmbeddingSearcher:
    """Adapter: find_tools → ONNX embedding search with timeout."""
    
    def search(self, query: str, timeout_ms: int = 100) -> tuple[str, float] | None:
        """Search tools by embedding similarity. Returns (tool_name, score) or None."""
    
    def rebuild_index(self) -> None:
        """Rebuild tool embedding index (after model switch or new tools)."""
    
    @property
    def is_available(self) -> bool:
        """True if ONNX model is loaded and ready."""


# orchestration/models/model_manager.py
class ModelManager:
    """MCP tool: mem_model_manager — model lifecycle management."""
    
    def execute(self, args: dict) -> str:
        """Handle action: list/download/status/switch."""
    
    def get_active_model(self) -> str:
        """Return current active model name."""
    
    def auto_download_if_needed(self) -> None:
        """Background download of default model on first need."""
```

### 5.3 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Strategy | EmbeddingSearcher (swappable model) | Support model switching without restart |
| Observer | CachePersistence (debounced write) | Decouple cache updates from file I/O |
| Lazy Init | AdaptiveTokenCache.load() | Don't read file until first cache access |
| Adapter | EmbeddingSearcher wraps OnnxProvider | Isolate find_tools from embedding internals |
| Singleton | ToolEmbeddingIndex (per server) | One index shared across all find_tools calls |

### 5.4 Error Handling

| Exception | Behavior | When Thrown |
|-----------|----------|------------|
| JSONDecodeError (cache load) | Log warning, start with empty cache | Corrupted token-cache.json |
| TimeoutError (embedding) | Return None, fall through | ONNX inference > 100ms |
| ImportError (onnxruntime) | Disable embedding tier | ONNX not installed |
| OSError (file write) | Log error, skip persist | Disk full or permissions |
| NetworkError (download) | Return error message | Model download fails |

---

## 6. Integration Design

### 6.1 Integration: find_tools Enhancement

The existing `find_tools.py` `execute()` function is modified to insert cache + embedding tiers:

```python
# MODIFIED find_tools.py execute() — new flow
def execute(engine, args):
    query = args.get("query")
    
    # Tier 1: Registry search (EXISTING — unchanged)
    registry_results = engine.get_registry().search(query)
    if registry_results:
        return json.dumps([t.definition for t in registry_results[:10]])
    
    # Tier 1.5: Retry failed servers (EXISTING — unchanged)
    recovered = _retry_failed_servers(engine)
    if recovered:
        registry_results = engine.get_registry().search(query)
        if registry_results:
            return json.dumps([t.definition for t in registry_results[:10]])
    
    # Tier 2: Adaptive Token Cache (NEW)
    cache = engine.get_token_cache()
    tokens = tokenize(query)
    cached = cache.find_fuzzy(tokens)
    if cached:
        tool = engine.get_registry().find(cached.tool_name)
        if tool:
            cached.hit_count += 1
            cache.schedule_persist()
            return json.dumps([tool.definition])
    
    # Tier 3: Embedding Search (NEW)
    searcher = engine.get_embedding_searcher()
    if searcher and searcher.is_available:
        result = searcher.search(query, timeout_ms=100)
        if result:
            tool_name, score = result
            tool = engine.get_registry().find(tool_name)
            if tool and score > 0.75:
                cache.add(tokens, tool_name, score, engine.get_registry().version_hash())
                cache.schedule_persist()
                # Check multilingual hint
                hint = _check_multilingual_hint(engine, query)
                definitions = [tool.definition]
                if hint:
                    definitions[0] = {**definitions[0], "_hint": hint}
                return json.dumps(definitions)
    elif not searcher or not searcher.is_available:
        # Trigger auto-download in background
        engine.get_model_manager().auto_download_if_needed()
    
    # Tier 4: Delegate to nested (EXISTING — unchanged)
    delegates = engine.get_find_tools_delegates()
    nested_results = _delegate_to_nested(engine, query) if delegates else []
    
    # Tier 5: KB fallback (EXISTING — unchanged)
    # ... existing code ...
```

### 6.2 Integration: OrchestrationEngine Extensions

New methods added to `OrchestrationEngine`:

```python
class OrchestrationEngine:
    # ... existing code ...
    
    def get_token_cache(self) -> AdaptiveTokenCache:
        """Lazy-init adaptive token cache."""
        if self._token_cache is None:
            cache_path = self._workspace / ".code-intel" / "token-cache.json"
            self._token_cache = AdaptiveTokenCache(cache_path)
        return self._token_cache
    
    def get_embedding_searcher(self) -> EmbeddingSearcher | None:
        """Get embedding searcher (None if ONNX unavailable)."""
        if self._embedding_searcher is None:
            try:
                self._embedding_searcher = EmbeddingSearcher(
                    model_manager=self.get_model_manager(),
                    registry=self.get_registry()
                )
            except ImportError:
                return None
        return self._embedding_searcher
    
    def get_model_manager(self) -> ModelManager:
        """Get model manager instance."""
        if self._model_manager is None:
            self._model_manager = ModelManager()
        return self._model_manager
```

---

## 7. Security Design

### 7.1 Authentication

No authentication — all tools are local, running on user's machine.

### 7.2 Data Protection

| Data Type | At Rest | In Transit | In Logs |
|-----------|---------|------------|---------|
| Token cache | Plain JSON (local file) | N/A (local) | Query tokens logged |
| Model files | Plain binary (local) | HTTPS (download) | Download URL logged |
| Registry | Plain JSON (local) | N/A | No sensitive data |

### 7.3 Input Validation

| Field | Validation | Sanitization |
|-------|-----------|--------------|
| query (find_tools) | Non-empty, max 500 chars | Strip whitespace |
| action (model_manager) | Must be in enum set | Lowercase |
| model_name | Must match catalog entry | Exact match only |

---

## 8. Performance & Scalability

### 8.1 Caching Strategy

| Cache | What | TTL | Eviction | Technology |
|-------|------|-----|----------|------------|
| Token Cache | query→tool mappings | No TTL (LRU) | LRU at 10K entries | Python dict |
| Tool Embedding Index | tool→vector mappings | Until registry change | Full rebuild | numpy array |
| Model (ONNX session) | Loaded model | Until switch | Replace on switch | onnxruntime |

### 8.2 Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Cache lookup (hit) | < 1ms | time.perf_counter |
| Cache lookup (miss) | < 1ms | time.perf_counter |
| Embedding search | < 100ms | Hard timeout |
| Cache persist (debounced) | < 50ms | Background, non-blocking |
| Model load (first use) | < 2s | One-time cost |
| find_tools total (cache hit) | < 2ms | End-to-end |
| find_tools total (embedding hit) | < 150ms | End-to-end |

### 8.3 Scalability

- Cache: O(n) scan for fuzzy match on 10K entries ≈ < 1ms (Python set operations)
- Tool index: O(n) cosine similarity on ~100 tools ≈ < 10ms (numpy vectorized)
- File I/O: Debounced to max 1 write/5s regardless of cache update frequency

---

## 9. Monitoring & Observability

### 9.1 Logging

| Log Event | Level | Fields | Destination |
|-----------|-------|--------|-------------|
| Cache hit | DEBUG | query, tool_name, hit_count | stderr |
| Cache miss → embedding | DEBUG | query | stderr |
| Embedding hit + learn | INFO | query, tool_name, score | stderr |
| Cache invalidation | INFO | stale_count, total_count | stderr |
| Model download start | INFO | model_name, size_mb | stderr |
| Model download complete | INFO | model_name, duration | stderr |
| Model switch | INFO | from_model, to_model | stderr |
| Cache persist | DEBUG | entry_count, file_size | stderr |
| Embedding timeout | WARN | query, elapsed_ms | stderr |
| Cache corrupted | WARN | file_path, error | stderr |

### 9.2 Metrics (in-memory counters)

| Metric | Type | Description |
|--------|------|-------------|
| cache_hits | Counter | Total cache hits |
| cache_misses | Counter | Total cache misses |
| embedding_searches | Counter | Total embedding searches |
| embedding_timeouts | Counter | Embedding searches that timed out |
| cache_size | Gauge | Current cache entry count |
| cache_hit_rate | Gauge | hits / (hits + misses) |

---

## 10. Deployment Considerations

### 10.1 Configuration

No environment-specific config needed. All paths are derived:
- Cache: `{workspace}/.code-intel/token-cache.json`
- Models: `~/.code-intel/models/`
- Registry: `~/.code-intel/models/registry.json`

### 10.2 Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| EMBEDDING_ENABLED | true | Enable/disable embedding search tier |
| CACHE_ENABLED | true | Enable/disable adaptive cache |
| AUTO_DOWNLOAD | true | Auto-download model on first need |
| CACHE_MAX_SIZE | 10000 | Maximum cache entries |
| EMBEDDING_TIMEOUT_MS | 100 | Embedding search timeout |
| CACHE_PERSIST_DEBOUNCE_S | 5 | Seconds between cache file writes |

### 10.3 Rollback Strategy

1. Set `EMBEDDING_ENABLED=false` and `CACHE_ENABLED=false` → reverts to original find_tools behavior
2. Delete `.code-intel/token-cache.json` → fresh cache start
3. No database migrations — all data is in JSON files that can be deleted safely

---

## 11. Implementation Checklist

### Files to Create

| # | File | Lines (est.) | Description |
|---|------|-------------|-------------|
| 1 | `orchestration/cache/__init__.py` | 5 | Package init |
| 2 | `orchestration/cache/adaptive_cache.py` | 120 | Main cache class |
| 3 | `orchestration/cache/cache_entry.py` | 40 | CacheEntry dataclass |
| 4 | `orchestration/cache/persistence.py` | 80 | Debounced file I/O |
| 5 | `orchestration/cache/invalidation.py` | 60 | Invalidation logic |
| 6 | `orchestration/models/__init__.py` | 5 | Package init |
| 7 | `orchestration/models/model_manager.py` | 150 | MCP tool implementation |
| 8 | `orchestration/models/model_catalog.py` | 50 | Known models list |
| 9 | `orchestration/models/model_registry.py` | 100 | Registry file management |
| 10 | `orchestration/embedding/__init__.py` | 5 | Package init |
| 11 | `orchestration/embedding/embedding_searcher.py` | 120 | Embedding search adapter |
| 12 | `orchestration/embedding/tool_index.py` | 100 | Pre-computed tool vectors |

### Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `orchestration/meta/find_tools.py` | Add Tier 2 (cache) + Tier 3 (embedding) |
| 2 | `orchestration/engine.py` | Add get_token_cache(), get_embedding_searcher(), get_model_manager() |
| 3 | `memory/embedding/model_downloader.py` | Support configurable model path + multiple models |

### Estimated Total: ~835 lines new code, ~50 lines modified

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
| 3 | Class Diagram | [class-diagram.png](diagrams/class-diagram.png) | [class-diagram.drawio](diagrams/class-diagram.drawio) |

### Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Should cache be shared across MCP server restarts within same session? | Resolved | Yes — persisted to file |
| 2 | Should tool embeddings be pre-computed at startup or lazy? | Resolved | Lazy — computed on first embedding search |
| 3 | What if two queries resolve to same tool with different scores? | Resolved | Keep highest score entry, merge tokens |

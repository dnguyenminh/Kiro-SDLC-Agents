# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-139: 2-Level Agent Tool Cache Registry

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-139 |
| Title | 2-Level Agent Tool Cache Registry — KB-based tool discovery cache |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-23 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-139.docx |
| Related FSD | FSD-v1-KSA-139.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-23 | SA Agent | Initiate document — technical design from FSD |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical implementation of the 2-Level Agent Tool Cache Registry
within the existing Python MCP orchestration layer. It covers architecture decisions,
module design, KB integration patterns, and deployment configuration.

### 1.2 Scope

- Cache interceptor module within `orchestration/` package
- KB integration for persistent cache storage
- Configuration extension in `orchestration.json`
- Injection engine for sub-agent prompt enrichment

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | Python | 3.11+ |
| Framework | FastMCP (MCP SDK) | Latest |
| Database | SQLite (via KB server) | 3.x |
| Async | asyncio + ThreadPoolExecutor | stdlib |
| Config | JSON (orchestration.json) | N/A |
| Testing | pytest + pytest-asyncio | Latest |

### 1.4 Design Principles

- **Transparent middleware** — cache layer is invisible to agents
- **Fail-open** — if cache fails, fall back to existing behavior
- **Async non-blocking** — cache writes never block tool execution
- **Single Responsibility** — each module handles one concern
- **Minimal coupling** — cache module depends only on KB client interface

### 1.5 Constraints

- Must integrate with existing `orchestration/meta/find_tools.py` and `execute_dynamic.py`
- Cannot modify KB server schema (use existing kb_ingest/kb_search interface)
- Must not increase tool execution latency by more than 50ms
- Python stdlib only (no new external dependencies)
- Max 200 lines per file (per code standards)

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-139.docx |
| FSD | FSD-v1-KSA-139.docx |
| Orchestration Architecture | .kiro/steering/orchestration.md |

---

## 2. System Architecture

### 2.1 Architecture Overview

The Tool Cache Registry is implemented as a new sub-package within the existing
`orchestration/` directory. It hooks into the `find_tools` and `execute_dynamic_tool`
flows via function composition (decorator pattern).

![Architecture Diagram](diagrams/architecture.png)

**Key architectural decisions:**
1. Cache is a **middleware layer** — wraps existing find_tools/execute logic
2. KB is the **single source of truth** — no in-memory cache duplication
3. **Async fire-and-forget** for writes — ingestion doesn't block responses
4. **Tag-based scoping** — KB tags provide L1/L2 separation without schema changes

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| CacheLookup | Search KB for cached tools (L2 → L1 cascade) | Python + kb_search |
| CacheWriter | Ingest/update/delete cache entries in KB | Python + kb_ingest |
| CacheInvalidator | Remove stale entries on execution failure | Python + kb_delete |
| InjectionEngine | Query top-N tools and format for prompt | Python + kb_search |
| ConfigReader | Read inject_count from orchestration.json | Python + json |
| ErrorClassifier | Classify errors as permanent vs transient | Python |

### 2.3 Integration Points

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| CacheLookup | KB Server | Internal function call | Sync | kb_search with tag filter |
| CacheWriter | KB Server | Internal function call | Async (fire-and-forget) | kb_ingest |
| CacheInvalidator | KB Server | Internal function call | Async | kb_delete by title |
| InjectionEngine | KB Server | Internal function call | Sync | kb_search top-N |
| ConfigReader | orchestration.json | File read | Sync (cached) | Read on startup + hot-reload |

---

## 3. Module Design

### 3.1 Package Structure

```
orchestration/
├── cache/                    # NEW — Tool Cache Registry
│   ├── __init__.py           # Package exports
│   ├── lookup.py             # CacheLookup — L2 → L1 cascade
│   ├── writer.py             # CacheWriter — ingest/update entries
│   ├── invalidator.py        # CacheInvalidator — delete stale entries
│   ├── injector.py           # InjectionEngine — top-N prompt injection
│   ├── classifier.py         # ErrorClassifier — permanent vs transient
│   ├── models.py             # Data models (ToolCacheEntry, CacheSource)
│   └── config.py             # Cache-specific config reader
├── meta/
│   ├── find_tools.py         # MODIFIED — add cache lookup before discovery
│   └── execute_dynamic.py    # MODIFIED — add cache write/invalidate hooks
└── ...
```

### 3.2 Key Interfaces

```python
# orchestration/cache/models.py
from dataclasses import dataclass
from enum import Enum
from typing import Optional
import json

class CacheSource(Enum):
    L2_CACHE = "l2_cache"      # Found in agent scope
    L1_CACHE = "l1_cache"      # Found in global scope
    DISCOVERED = "discovered"   # From find_tools

@dataclass
class ToolCacheEntry:
    tool_name: str
    server_name: str
    description: str
    input_schema: dict
    scope: str          # "global" or "agent:{name}"
    hits: int = 0
    last_used: str = ""
    
    @property
    def title(self) -> str:
        return f"tool-cache:{self.scope}:{self.tool_name}"
    
    @property
    def tags(self) -> str:
        base = "tool-cache"
        if self.scope == "global":
            return f"{base}, scope:global, server:{self.server_name}"
        return f"{base}, {self.scope}, server:{self.server_name}"
    
    def to_kb_content(self) -> str:
        return json.dumps({
            "tool_name": self.tool_name,
            "server_name": self.server_name,
            "description": self.description,
            "input_schema": self.input_schema,
            "hits": self.hits,
            "last_used": self.last_used
        }, indent=2)
```

```python
# orchestration/cache/lookup.py
from typing import Optional, Tuple

class CacheLookup:
    """Search KB for cached tools using L2 → L1 cascade."""
    
    async def find(self, query: str, agent_name: str) -> Optional[Tuple[ToolCacheEntry, CacheSource]]:
        """Lookup cascade: agent scope → global scope."""
        ...
    
    async def _search_scope(self, query: str, tags: str) -> Optional[ToolCacheEntry]:
        """Search KB with specific scope tags."""
        ...
```

```python
# orchestration/cache/writer.py
class CacheWriter:
    """Manage cache entry lifecycle in KB."""
    
    async def on_success(self, entry: ToolCacheEntry, agent_name: str, source: CacheSource) -> None:
        """Handle successful tool execution — ingest/update cache."""
        ...
    
    async def increment_hits(self, title: str) -> None:
        """Increment hit count for existing entry."""
        ...
```

```python
# orchestration/cache/invalidator.py
class CacheInvalidator:
    """Remove stale cache entries on failure."""
    
    async def on_failure(self, tool_name: str, agent_name: str, error_type: str) -> None:
        """Handle failed tool execution — invalidate if permanent error."""
        ...
    
    async def invalidate_server(self, server_name: str) -> None:
        """Bulk invalidate all entries for a disconnected server."""
        ...
```

```python
# orchestration/cache/injector.py
class InjectionEngine:
    """Query and format top-N tools for sub-agent prompt injection."""
    
    async def get_injection(self, agent_name: str, count: int = 5) -> str:
        """Get compact JSON of top-N tools for prompt injection."""
        ...
```

### 3.3 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Middleware/Decorator | find_tools, execute_dynamic | Non-invasive integration with existing code |
| Fire-and-forget | CacheWriter.on_success | Non-blocking writes |
| Strategy | ErrorClassifier | Extensible error classification |
| Repository | CacheLookup, CacheWriter | Abstract KB access behind clean interface |
| Singleton | ConfigReader | Single config instance, hot-reloadable |

### 3.4 Error Handling

| Exception | Behavior | When Thrown |
|-----------|----------|------------|
| KB unavailable | Log warning, skip cache operation | KB server not responding |
| KB search timeout | Abandon search, fall back to find_tools | Search exceeds 100ms |
| KB ingest failure | Log error, do not retry | Write fails |
| Invalid cache entry | Skip entry, log warning | Corrupted KB data |
| Config parse error | Use defaults | orchestration.json malformed |

---

## 4. Data Design

### 4.1 KB Entry Format

Each cached tool is stored as a KB entry with the following structure:

**Title format (dedup key):** `tool-cache:{scope}:{tool_name}`

**Content format (JSON):**
```json
{
  "tool_name": "jira_search",
  "server_name": "atlassian",
  "description": "Search Jira issues using JQL",
  "input_schema": {
    "type": "object",
    "required": ["jql"],
    "properties": {
      "jql": {"type": "string", "description": "JQL query string"}
    }
  },
  "hits": 15,
  "last_used": "2026-05-23T10:00:00Z"
}
```

**Tags:**
- Global: `tool-cache, scope:global, server:atlassian`
- Agent: `tool-cache, agent:ba-agent, server:atlassian`

### 4.2 Storage Estimates

| Metric | Estimate |
|--------|----------|
| Entry size (avg) | ~1.5 KB |
| Max entries (global) | ~100 tools |
| Max entries (per agent, 6 agents) | ~50 tools each = 300 |
| Total max entries | ~400 |
| Total storage | ~600 KB |

### 4.3 Query Patterns

| Operation | KB Function | Tags Filter | Performance |
|-----------|------------|-------------|-------------|
| L2 lookup | kb_search | `tool-cache, agent:{name}` | < 50ms |
| L1 lookup | kb_search | `tool-cache, scope:global` | < 80ms |
| Top-N injection | kb_search | `tool-cache, agent:{name}`, top_k=N | < 50ms |
| Ingest new | kb_ingest | (in content) | < 100ms |
| Delete stale | kb_search + delete | by title match | < 100ms |

---

## 5. Integration Design

### 5.1 Integration with find_tools

**Modified file:** `orchestration/meta/find_tools.py`

**Change:** Add cache lookup BEFORE existing discovery logic.

```python
# BEFORE (existing):
async def find_tools_handler(query: str) -> list:
    results = registry.search(query)
    if not results:
        results = await delegate_to_nested(query)
    return results

# AFTER (with cache):
async def find_tools_handler(query: str, agent_name: str = "default") -> list:
    # Step 1: Try cache first
    cached = await cache_lookup.find(query, agent_name)
    if cached:
        return [cached.to_tool_result()]
    
    # Step 2: Existing discovery (unchanged)
    results = registry.search(query)
    if not results:
        results = await delegate_to_nested(query)
    return results
```

### 5.2 Integration with execute_dynamic_tool

**Modified file:** `orchestration/meta/execute_dynamic.py`

**Change:** Add post-execution hooks for cache population/invalidation.

```python
# AFTER execution:
async def execute_handler(tool_name: str, arguments: dict, agent_name: str = "default") -> Any:
    try:
        result = await _execute(engine, tool_name, arguments)
        # Fire-and-forget: cache on success
        asyncio.create_task(cache_writer.on_success(tool_entry, agent_name, source))
        return result
    except PermanentToolError as e:
        # Invalidate cache on permanent failure
        asyncio.create_task(cache_invalidator.on_failure(tool_name, agent_name, str(e)))
        raise
    except TransientError:
        # Do NOT invalidate on transient errors
        raise
```

### 5.3 Integration with Sub-Agent Invocation

**New hook point:** When SM invokes a sub-agent, the injection engine prepends cached tools.

```python
# In agent invocation logic:
async def invoke_sub_agent(agent_name: str, prompt: str) -> str:
    injection = await injection_engine.get_injection(agent_name)
    if injection:
        enriched_prompt = f"## Cached Tools (use execute_dynamic_tool directly)\n{injection}\n\n{prompt}"
    else:
        enriched_prompt = prompt
    return await _invoke(agent_name, enriched_prompt)
```

---

## 6. Configuration Design

### 6.1 orchestration.json Extension

```json
{
  "settings": {
    "similarity_threshold": 0.7,
    "auto_log": true,
    "tool_cache": {
      "enabled": true,
      "inject_count": 5,
      "lookup_timeout_ms": 100,
      "max_entries_per_scope": 100
    }
  }
}
```

### 6.2 Configuration Parameters

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| tool_cache.enabled | bool | true | true/false | Enable/disable cache |
| tool_cache.inject_count | int | 5 | 0-20 | Tools to inject at startup |
| tool_cache.lookup_timeout_ms | int | 100 | 50-500 | Max KB search time |
| tool_cache.max_entries_per_scope | int | 100 | 10-500 | Max entries per scope |

### 6.3 Hot-Reload

Config is re-read on each operation (cached for 60s with file mtime check).
No server restart needed for config changes.

---

## 7. Security Design

### 7.1 Data Protection

| Data Type | At Rest | In Transit | In Logs |
|-----------|---------|------------|---------|
| Tool names | Plain (not sensitive) | N/A (local) | Included |
| Input schemas | Plain (API structure) | N/A (local) | Excluded (too large) |
| Hit counts | Plain | N/A (local) | Included |

### 7.2 Access Control

- Cache is workspace-scoped (SQLite DB per workspace)
- No cross-workspace data leakage
- No authentication needed (local process communication)

---

## 8. Performance & Scalability

### 8.1 Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| L2 cache lookup | < 50ms p95 | Time from query to result |
| L1 cache lookup | < 80ms p95 | Time from query to result |
| Full cascade (miss) | < 150ms overhead | Additional time vs. no cache |
| Cache write (async) | 0ms blocking | Fire-and-forget, no wait |
| Injection query | < 50ms | Time to get top-N tools |

### 8.2 Optimization Strategies

1. **Tag-based filtering** — KB search narrows scope before semantic matching
2. **Title-based dedup** — deterministic title format prevents duplicate entries
3. **Async writes** — `asyncio.create_task()` for non-blocking ingestion
4. **Config caching** — re-read config only when file mtime changes
5. **Early termination** — first cache hit stops cascade immediately

### 8.3 Scalability

| Dimension | Current | With Cache | Notes |
|-----------|---------|-----------|-------|
| Token usage per ticket | ~10,000 (discovery) | ~2,000 (injection only) | 80% reduction |
| find_tools calls per agent | 6-8 | 0-2 (cache misses only) | 75% reduction |
| KB entries | N/A | ~400 max | Bounded by max_entries_per_scope |

---

## 9. Monitoring & Observability

### 9.1 Logging

| Log Event | Level | Fields | Destination |
|-----------|-------|--------|-------------|
| Cache hit (L2) | DEBUG | tool_name, agent, hits | stdout |
| Cache hit (L1) | DEBUG | tool_name, agent, hits | stdout |
| Cache miss | DEBUG | query, agent | stdout |
| Cache write | DEBUG | tool_name, scope | stdout |
| Cache invalidation | INFO | tool_name, error_type | stdout |
| KB error | WARNING | operation, error_msg | stdout |
| Injection | DEBUG | agent, tools_count | stdout |

### 9.2 Metrics (Future)

| Metric | Type | Description |
|--------|------|-------------|
| cache_hit_rate | Gauge | L2 hits / total lookups |
| cache_miss_rate | Gauge | Misses / total lookups |
| token_savings | Counter | Estimated tokens saved |
| invalidation_count | Counter | Cache entries invalidated |

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Module | Test File | Key Tests |
|--------|-----------|-----------|
| CacheLookup | test_lookup.py | L2 hit, L1 hit, full miss, KB error |
| CacheWriter | test_writer.py | New tool ingest, hit increment, dedup |
| CacheInvalidator | test_invalidator.py | Permanent error, transient skip, bulk |
| InjectionEngine | test_injector.py | Top-N query, supplement from L1, empty |
| ErrorClassifier | test_classifier.py | Each error type classification |
| ConfigReader | test_config.py | Default values, hot-reload, invalid |

### 10.2 Integration Tests

| Test | Description | Dependencies |
|------|-------------|-------------|
| Full cascade | L2 miss → L1 miss → find_tools → cache write | KB server |
| Invalidation flow | Execute fail → delete → re-discover | KB server |
| Injection flow | Populate cache → invoke agent → verify injection | KB server |
| Persistence | Write → restart → read back | KB server (SQLite) |

### 10.3 Performance Tests

| Test | Target | Method |
|------|--------|--------|
| Lookup latency | < 100ms | Benchmark with 100 entries |
| Write throughput | Non-blocking | Verify no execution delay |
| Injection latency | < 50ms | Benchmark with N=5 |

---

## 11. Implementation Checklist

### Files to Create

| # | File | Lines (est.) | Priority |
|---|------|-------------|----------|
| 1 | `orchestration/cache/__init__.py` | 20 | P0 |
| 2 | `orchestration/cache/models.py` | 60 | P0 |
| 3 | `orchestration/cache/lookup.py` | 80 | P0 |
| 4 | `orchestration/cache/writer.py` | 100 | P0 |
| 5 | `orchestration/cache/invalidator.py` | 60 | P0 |
| 6 | `orchestration/cache/injector.py` | 80 | P0 |
| 7 | `orchestration/cache/classifier.py` | 40 | P0 |
| 8 | `orchestration/cache/config.py` | 50 | P1 |

### Files to Modify

| # | File | Change | Priority |
|---|------|--------|----------|
| 1 | `orchestration/meta/find_tools.py` | Add cache lookup before discovery | P0 |
| 2 | `orchestration/meta/execute_dynamic.py` | Add post-execution hooks | P0 |
| 3 | `.code-intel/orchestration.json` | Add tool_cache config section | P1 |

### Implementation Order

1. **Phase A:** Models + Config (foundation)
2. **Phase B:** CacheLookup + CacheWriter (core cache logic)
3. **Phase C:** Integration with find_tools + execute_dynamic (hook up)
4. **Phase D:** CacheInvalidator + ErrorClassifier (failure handling)
5. **Phase E:** InjectionEngine (startup optimization)
6. **Phase F:** Tests + Performance validation

---

## 12. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

### Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Should hit count have a decay mechanism? | Resolved | No — keep simple, add later if needed |
| 2 | Should cache entries have TTL? | Resolved | No — invalidation on failure is sufficient |
| 3 | How to handle tool schema changes? | Open | Schema mismatch → invalidate → re-discover |

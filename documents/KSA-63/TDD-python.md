# Technical Design Document — Python Orchestration Port

## KSA-63 Extension: Port Orchestration Module to Python

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-63 (Extension) |
| Title | Python Orchestration Module — Technical Design |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-07-15 |
| Status | Draft |
| Reference TDD | TDD-v1-KSA-63.docx (Kotlin) |
| Reference BRD | BRD-port-v1-KSA-63.docx |

---

## 1. Introduction

### 1.1 Purpose

Technical design for porting the Kotlin orchestration module to Python. Covers all 15 modules from BRD-port Section 2.1, mapped to Python asyncio patterns.

### 1.2 Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | Python 3.11+ |
| Async | asyncio (stdlib) |
| Process | asyncio.subprocess |
| File Watch | asyncio + stat polling |
| JSON | stdlib json |
| Typing | typing, dataclasses |

### 1.3 Constraints

- Max 200 lines per `.py` file
- Max 20 lines per function
- Zero new external dependencies
- snake_case naming throughout
- Same `orchestration.json` config format as Kotlin

---

## 2. Package Structure

```
mcp-code-intelligence-python/src/mcp_code_intel/orchestration/
├── __init__.py              ← Public API: OrchestrationEngine
├── config.py                ← OrchestrationConfig dataclass + loader
├── engine.py                ← OrchestrationEngine coordinator
├── registry/
│   ├── __init__.py
│   ├── tokenizer.py         ← Text tokenization (camelCase, stopwords)
│   ├── grouper.py           ← SemanticGrouper (Jaccard + chain building)
│   └── registry.py          ← UnifiedRegistry (search, toggles, hits)
├── routing/
│   ├── __init__.py
│   ├── table.py             ← RoutingTable (O(1) tool→server)
│   └── router.py            ← SmartRouter (timeout propagation)
├── local/
│   ├── __init__.py
│   ├── manager.py           ← LocalServerManager (start/stop/health)
│   ├── process.py           ← ServerProcess (spawn, init, state machine)
│   ├── rpc.py               ← StdioJsonRpc (JSON-RPC 2.0 over pipes)
│   └── watcher.py           ← ConfigWatcher (file polling)
├── meta/
│   ├── __init__.py
│   ├── dispatcher.py        ← MetaToolDispatcher (route meta-tool calls)
│   ├── find_tools.py        ← FindToolsTool (semantic search)
│   ├── execute_dynamic.py   ← ExecuteDynamicTool (fallback chain)
│   ├── toggle.py            ← ToggleToolTool
│   ├── reset.py             ← ResetToolsTool
│   ├── auto_approve.py      ← ManageAutoApproveTool
│   ├── status.py            ← OrchestrationStatusTool
│   └── agent_log.py         ← AgentLogTool
└── logging/
    ├── __init__.py
    └── auto_logger.py       ← AutoLogger (audit trail)
```

**Total: 22 files, each ≤ 200 lines.**

---

## 3. Data Models (config.py)

```python
@dataclass
class ServerEntry:
    command: str
    args: list[str] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)
    disabled: bool = False
    timeout: int = 30_000
    auto_approve: list[str] = field(default_factory=list)

@dataclass
class AutoLogSettings:
    enabled: bool = True
    exclude_tools: list[str] = field(default_factory=lambda: ["mem_audit"])
    max_arg_length: int = 200

@dataclass
class OrchestrationSettings:
    auto_log: AutoLogSettings = field(default_factory=AutoLogSettings)
    health_check_interval_ms: int = 30_000
    max_restart_retries: int = 3
    similarity_threshold: float = 0.7
    max_recursion_depth: int = 3
    discovery_timeout_ms: int = 10_000
    kb_search_timeout_ms: int = 2_000

@dataclass
class OrchestrationConfig:
    mcp_servers: dict[str, ServerEntry]
    settings: OrchestrationSettings = field(default_factory=OrchestrationSettings)
```

### 3.1 Config Loading

```python
def load_config(config_path: str) -> OrchestrationConfig | None:
    """Load orchestration.json, return None if invalid."""

def enabled_servers(config: OrchestrationConfig) -> dict[str, ServerEntry]:
    """Filter to non-disabled servers."""
```

---

## 4. Module Design

### 4.1 Tokenizer (registry/tokenizer.py, ~50 lines)

```python
STOPWORDS: set[str]  # Same 20 words as Kotlin
SPLIT_RE = re.compile(r"[^a-zA-Z0-9]+")
CAMEL_RE = re.compile(r"(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")

def tokenize(text: str) -> set[str]:
    """Split text into normalized, deduplicated, stopword-free tokens."""
    # Split on non-alphanumeric + camelCase boundaries
    # Lowercase, filter len > 1, remove stopwords
    # Return set
```

**Behavioral parity:** Identical output to Kotlin `Tokenizer.tokenize()` for same input.

### 4.2 SemanticGrouper (registry/grouper.py, ~100 lines)

```python
@dataclass
class RegisteredTool:
    name: str
    definition: dict
    source: str
    priority: int = 0
    name_tokens: set[str] = field(default_factory=set)
    desc_tokens: set[str] = field(default_factory=set)

@dataclass
class ChainEntry:
    server_name: str
    priority: int
    tool_name: str | None = None

@dataclass
class ToolChain:
    tool_name: str
    entries: list[ChainEntry]
    grouping_reason: str = "exact_name"
    similar_names: set[str] = field(default_factory=set)

class SemanticGrouper:
    def __init__(self, threshold: float = 0.7): ...
    def build_chains(self, tools: list[RegisteredTool]) -> dict[str, ToolChain]: ...
    def compute_similarity(self, a: RegisteredTool, b: RegisteredTool) -> float: ...
```

**Algorithm:**
1. `build_exact_name_chains()` — group tools with identical names
2. `build_semantic_chains()` — pairwise Jaccard on ungrouped tools
3. Similarity = `jaccard(tokensA ∪ descA, tokensB ∪ descB) + name_overlap * 0.1`, capped at 1.0

### 4.3 UnifiedRegistry (registry/registry.py, ~150 lines)

```python
class UnifiedRegistry:
    def __init__(self, similarity_threshold: float = 0.7): ...
    def set_server_order(self, order: list[str]) -> None: ...
    def set_child_tools(self, server_name: str, tools: list[dict]) -> None: ...
    def search(self, query: str) -> list[RegisteredTool]: ...
    def find(self, name: str) -> RegisteredTool | None: ...
    def get_chain(self, tool_name: str) -> ToolChain | None: ...
    def record_hit(self, tool_name: str) -> None: ...
    def toggle(self, tool_name: str, enabled: bool) -> None: ...
    def reset_toggles(self) -> None: ...
    def is_enabled(self, tool_name: str) -> bool: ...
```

**Search scoring:** `combined = relevance * 0.7 + normalized_hits * 0.3`
- Name token match = 2.0, desc partial match = 1.0
- Decay: when hits > 1000, subtract 500 from group, floor at -2000

### 4.4 RoutingTable (routing/table.py, ~60 lines)

```python
@dataclass
class RouteEntry:
    server_name: str
    is_native: bool = False

class RoutingTable:
    def rebuild(self, native_names: set[str], child_by_server: dict[str, list[str]]) -> None: ...
    def resolve(self, tool_name: str) -> RouteEntry | None: ...
```

### 4.5 SmartRouter (routing/router.py, ~80 lines)

```python
@dataclass
class ToolMetrics:
    call_count: int = 0
    error_count: int = 0
    total_latency_ms: int = 0
    last_call_at: float | None = None

class SmartRouter:
    def __init__(self, server_manager, routing_table): ...
    async def route(self, tool_name: str, args: dict, timeout_ms: int = 30_000) -> str: ...
    def get_metrics(self) -> dict[str, ToolMetrics]: ...
```

**Timeout propagation:** `remaining = original_timeout - elapsed`. If ≤ 0, raise error before routing.

### 4.6 StdioJsonRpc (local/rpc.py, ~120 lines)

```python
class StdioJsonRpc:
    def __init__(self): ...
    def attach(self, proc: asyncio.subprocess.Process) -> None: ...
    def detach(self) -> None: ...
    async def send_request(self, method: str, params: dict | None, timeout_ms: int) -> Any: ...
    def send_notification(self, method: str, params: dict | None) -> None: ...
```

**Protocol:** JSON-RPC 2.0 over stdin/stdout pipes. Line-delimited JSON. Concurrent requests via `asyncio.Future` keyed by request ID.

**Key implementation details:**
- `_reader_task`: asyncio task reading stdout line-by-line
- `_pending`: dict[int, asyncio.Future] for correlating responses
- `_next_id`: atomic counter (simple int, single-threaded asyncio)
- Write: `proc.stdin.write(json_bytes + b"\n"); await proc.stdin.drain()`
- Read: `line = await proc.stdout.readline()`

### 4.7 ServerProcess (local/process.py, ~150 lines)

```python
class ServerState(Enum):
    STARTING = "STARTING"
    READY = "READY"
    ACTIVE = "ACTIVE"
    CRASHED = "CRASHED"
    RESTARTING = "RESTARTING"
    STOPPING = "STOPPING"
    DEAD = "DEAD"
    FAILED = "FAILED"

class ServerProcess:
    def __init__(self, name: str, entry: ServerEntry): ...
    async def start(self) -> bool: ...
    def stop(self) -> None: ...
    async def restart(self, max_retries: int) -> bool: ...
    async def call_tool(self, tool_name: str, args: dict, timeout_ms: int) -> Any: ...
    async def health_check(self) -> bool: ...
    def is_alive(self) -> bool: ...
```

**Process spawning:**
```python
async def _spawn(self) -> asyncio.subprocess.Process | None:
    cmd = self._resolve_command(self.entry.command)
    args = self._build_args()
    env = {**os.environ, **self.entry.env}
    return await asyncio.create_subprocess_exec(
        *cmd, *args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env
    )
```

**Windows support:**
- `_resolve_command()`: wrap non-.exe commands with `cmd /c` on Windows
- `_destroy_process()`: use `taskkill /T /F /PID` on Windows for tree kill

**State machine:** STARTING → READY (after initialize) → ACTIVE (after tools/list) → CRASHED → RESTARTING → DEAD

**Restart:** Exponential backoff: `delay = min(1000 * retry_count, 10_000)` ms

### 4.8 LocalServerManager (local/manager.py, ~120 lines)

```python
class LocalServerManager:
    def __init__(self, config: OrchestrationConfig): ...
    async def start_all(self) -> int: ...
    def stop_all(self) -> None: ...
    async def call_tool(self, server_name: str, tool_name: str, args: dict, timeout_ms: int) -> Any: ...
    def find_server_for_tool(self, tool_name: str) -> str | None: ...
    def get_all_tools(self) -> list[tuple[str, dict]]: ...
    def get_status(self) -> dict[str, ServerState]: ...
```

**Health monitoring:** asyncio task running every `health_check_interval_ms`, calls `health_check()` on each active server. On failure → `restart(max_retries)`.

### 4.9 ConfigWatcher (local/watcher.py, ~60 lines)

```python
class ConfigWatcher:
    def __init__(self, config_path: str, on_reload: Callable): ...
    def start(self) -> None: ...
    def stop(self) -> None: ...
```

**Implementation:** asyncio task that polls file mtime every 2 seconds. On change → re-parse config → call `on_reload(new_config)`. If parse fails → log warning, keep current config.

### 4.10 OrchestrationEngine (engine.py, ~150 lines)

```python
class OrchestrationEngine:
    def __init__(self, config: OrchestrationConfig, memory_engine, app_config: dict): ...
    async def start(self) -> None: ...
    def stop(self) -> None: ...
    async def route(self, tool_name: str, args: dict) -> str: ...
    def get_registry(self) -> UnifiedRegistry: ...
    def get_memory_engine(self): ...
    def get_status(self) -> dict: ...
    def get_server_status(self) -> list[dict]: ...
    def get_metrics(self) -> dict[str, ToolMetrics]: ...
    async def call_child(self, server_name: str, tool_name: str, args: dict) -> str: ...
```

**Lifecycle:**
1. `start()` → `server_manager.start_all()` → `_build_routing_table()` → `_ingest_tools_to_kb()` → `_start_config_watcher()`
2. `stop()` → `config_watcher.stop()` → `server_manager.stop_all()`

**Hot-reload:** On config change → stop all → update config → start all → rebuild routing → re-ingest KB.

### 4.11 MetaToolDispatcher (meta/dispatcher.py, ~80 lines)

```python
META_TOOL_DEFINITIONS: list[dict]  # 7 meta-tool JSON schemas

class MetaToolDispatcher:
    def __init__(self, engine: OrchestrationEngine): ...
    def dispatch(self, tool_name: str, args: dict) -> str | None: ...
    def get_definitions(self) -> list[dict]: ...
```

Routes to: `find_tools`, `execute_dynamic_tool`, `toggle_tool`, `reset_tools`, `manage_auto_approve`, `orchestration_status`, `agent_log`.

### 4.12 FindToolsTool (meta/find_tools.py, ~60 lines)

```python
def execute(engine: OrchestrationEngine, args: dict) -> str:
    """Semantic search: registry + KB (best-effort)."""
    # 1. Search registry
    # 2. Search KB (2s timeout, graceful degradation)
    # 3. Merge, deduplicate, return top 10 as JSON array
```

### 4.13 ExecuteDynamicTool (meta/execute_dynamic.py, ~80 lines)

```python
async def execute(engine: OrchestrationEngine, args: dict) -> str:
    """Execute tool with fallback chain support."""
    # 1. Look up chain for tool_name
    # 2. If chain exists: try each server in priority order
    # 3. If no chain: route normally via SmartRouter
    # 4. Record hit on success
    # 5. Aggregate errors if all fail
```

### 4.14 AutoLogger (logging/auto_logger.py, ~50 lines)

```python
class AutoLogger:
    def __init__(self, memory_engine, settings: AutoLogSettings): ...
    def log_call(self, tool: str, args: str, result: str, latency_ms: int, source: str, is_error: bool = False) -> None: ...
```

Writes to memory audit trail. Respects `exclude_tools` and `max_arg_length`.

---

## 5. Integration with Existing Server

### 5.1 server.py Modifications

```python
# In McpServer.__init__:
self._orchestration: OrchestrationEngine | None = None

# In _handle_initialize (after memory init):
from .orchestration import OrchestrationEngine, load_orchestration_config
orch_config = load_orchestration_config(self._workspace)
if orch_config:
    self._orchestration = OrchestrationEngine(orch_config, mem_engine, self._config)
    await self._orchestration.start()

# In _handle_tools_list:
tools = TOOL_DEFINITIONS + MEMORY_TOOL_DEFINITIONS
if self._orchestration:
    tools += self._orchestration.meta_tool_dispatcher.get_definitions()
return {"tools": tools}

# In _dispatch_tool (BEFORE existing handlers):
if self._orchestration:
    meta_result = self._orchestration.meta_tool_dispatcher.dispatch(name, args)
    if meta_result is not None:
        return meta_result
```

### 5.2 Async Considerations

The existing `server.py` uses synchronous `for line in sys.stdin` loop. Orchestration requires asyncio. Two options:

**Option A (Recommended):** Convert server main loop to asyncio:
```python
async def run(self) -> None:
    reader = asyncio.StreamReader()
    await asyncio.get_event_loop().connect_read_pipe(
        lambda: asyncio.StreamReaderProtocol(reader), sys.stdin
    )
    while True:
        line = await reader.readline()
        ...
```

**Option B:** Run orchestration in background thread with its own event loop. More complex, not recommended.

---

## 6. Error Handling

| Error | Handling |
|-------|----------|
| Child process spawn fails | Log, mark FAILED, continue with other servers |
| Initialize handshake timeout | Mark FAILED, don't retry on startup |
| Health check fails | Attempt restart (max_retries with backoff) |
| All chain servers fail | Return aggregated error message |
| KB search timeout | Graceful degradation, return registry-only results |
| Config parse error | Keep current config, log warning |
| Process tree kill fails | Fall back to `proc.kill()` |

---

## 7. Testing Strategy

| Level | What | How |
|-------|------|-----|
| Unit | Tokenizer | pytest: same input/output as Kotlin |
| Unit | SemanticGrouper | pytest: verify chain building logic |
| Unit | UnifiedRegistry | pytest: search scoring, hits, decay |
| Integration | ServerProcess | Mock subprocess, verify state machine |
| Integration | StdioJsonRpc | Mock pipes, verify request/response correlation |
| E2E | Full orchestration | Start real child server, verify find_tools + execute |

---

## 8. Implementation Checklist

| # | File | Lines (est.) | Priority |
|---|------|-------------|----------|
| 1 | `orchestration/__init__.py` | 10 | P0 |
| 2 | `orchestration/config.py` | 80 | P0 |
| 3 | `orchestration/registry/__init__.py` | 5 | P0 |
| 4 | `orchestration/registry/tokenizer.py` | 50 | P0 |
| 5 | `orchestration/registry/grouper.py` | 100 | P0 |
| 6 | `orchestration/registry/registry.py` | 150 | P0 |
| 7 | `orchestration/routing/__init__.py` | 5 | P0 |
| 8 | `orchestration/routing/table.py` | 60 | P0 |
| 9 | `orchestration/routing/router.py` | 80 | P0 |
| 10 | `orchestration/local/__init__.py` | 5 | P0 |
| 11 | `orchestration/local/rpc.py` | 120 | P0 |
| 12 | `orchestration/local/process.py` | 150 | P0 |
| 13 | `orchestration/local/manager.py` | 120 | P0 |
| 14 | `orchestration/local/watcher.py` | 60 | P1 |
| 15 | `orchestration/engine.py` | 150 | P0 |
| 16 | `orchestration/meta/__init__.py` | 5 | P0 |
| 17 | `orchestration/meta/dispatcher.py` | 80 | P0 |
| 18 | `orchestration/meta/find_tools.py` | 60 | P0 |
| 19 | `orchestration/meta/execute_dynamic.py` | 80 | P0 |
| 20 | `orchestration/meta/toggle.py` | 30 | P1 |
| 21 | `orchestration/meta/reset.py` | 20 | P1 |
| 22 | `orchestration/meta/auto_approve.py` | 40 | P1 |
| 23 | `orchestration/meta/status.py` | 40 | P1 |
| 24 | `orchestration/meta/agent_log.py` | 40 | P1 |
| 25 | `orchestration/logging/__init__.py` | 5 | P1 |
| 26 | `orchestration/logging/auto_logger.py` | 50 | P1 |

**Implementation order:** config → tokenizer → grouper → registry → rpc → process → manager → table → router → engine → dispatcher → find_tools → execute_dynamic → remaining meta-tools → watcher → auto_logger

---

## 9. Behavioral Parity Verification

| Behavior | Kotlin Reference | Python Must Match |
|----------|-----------------|-------------------|
| Tokenize "camelCase" | `{"camel", "case"}` | ✅ Same |
| Tokenize "get_issue_details" | `{"get", "issue", "details"}` | ✅ Same |
| Similarity threshold | 0.7 default | ✅ Same |
| Search scoring formula | `relevance * 0.7 + hits * 0.3` | ✅ Same |
| Decay trigger | hits > 1000 → subtract 500 | ✅ Same |
| Chain priority | Config declaration order (index 0 = highest) | ✅ Same |
| Health check interval | 30s default | ✅ Same |
| Restart backoff | 1s, 2s, 3s... max 10s | ✅ Same |
| Windows cmd wrapper | `cmd /c` for non-exe | ✅ Same |
| Meta-tool filtering | 7 meta-tools excluded from child registration | ✅ Same |

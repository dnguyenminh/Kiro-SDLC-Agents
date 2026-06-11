# MCP Code Intelligence — Kotlin/JVM

<p align="center">
  <img src="https://img.shields.io/badge/version-0.7.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/JDK-21+-orange?style=for-the-badge" alt="JDK">
  <img src="https://img.shields.io/badge/transport-stdio-green?style=for-the-badge" alt="Transport">
  <img src="https://img.shields.io/badge/MCP_Tools-60+-teal?style=for-the-badge" alt="Tools">
</p>

Full-featured MCP server for code intelligence with SQLite FTS5, background indexing via coroutines, NIO file watcher, call graph analysis, and 30+ memory/KB tools.

---

## Architecture

```
+-----------------------------------------------------+
|  MCP Code Intelligence - Kotlin/JVM                  |
|                                                      |
|  +----------+  +----------+  +------------------+   |
|  | Indexer   |  | Query    |  | Memory Engine    |   |
|  | Coroutine |  | FTS5     |  | (30+ tools)      |   |
|  +-----+-----+  +-----+----+  +--------+---------+   |
|        |              |               |              |
|  +-----v--------------v---------------v----------+   |
|  |           SQLite (WAL mode)                    |   |
|  |  .code-intel/index.db                          |   |
|  +------------------------------------------------+   |
|                                                      |
|  +----------+  +----------+  +------------------+   |
|  | NIO Watch |  | Graph    |  | Orchestration    |   |
|  | Service   |  | Analysis |  | (find_tools,     |   |
|  |           |  | (KSA-171)|  |  dynamic exec)   |   |
|  +----------+  +----------+  +------------------+   |
|                                                      |
|  Transport: stdio (JSON-RPC 2.0)                     |
|  Packaging: Shadow JAR (sqlite-jdbc bundled)         |
+-----------------------------------------------------+
```

---

## Requirements

- JDK 21+
- Gradle 8.x (wrapper included)

## Build

```bash
./gradlew shadowJar
```

Output: `build/libs/mcp-code-intelligence-latest.jar`

## Run

```bash
java -jar build/libs/mcp-code-intelligence-latest.jar
```

Workspace is resolved from the MCP `initialize` request's `roots[0].uri` field.
No `--workspace` CLI argument needed.

---

## SQLite Note

This variant uses **JDBC `sqlite-jdbc`** which is bundled inside the shadow JAR. No separate native binary needed - the JDBC driver includes platform-specific SQLite binaries for all major OS/arch combinations.

The database schema is **cross-compatible** with the Node.js and Python variants. All three can share the same `.code-intel/index.db` file.

---

## MCP Tools

### Core Tools

| Tool | Description |
|------|-------------|
| `code_search` | Full-text search across symbols (FTS5 with porter stemming) |
| `code_symbols` | Find symbols by name prefix or list symbols in a file |
| `code_context` | Get source code context around a symbol or line range |
| `code_modules` | List discovered modules with file/symbol counts |
| `code_index_status` | Get indexing status, trigger re-index |
| `stream_write_file` | Write content directly to a file on disk |
| `code_kb_export` | Export code intelligence data as KB payloads |
| `drawio_auto_layout` | Auto-layout draw.io diagrams using graph algorithms |

### Graph & Analysis Tools (KSA-171)

| Tool | Description |
|------|-------------|
| `code_callers` | Find all callers of a function/method with transitive depth |
| `code_callees` | Find all callees with transitive depth |
| `code_traverse` | Generic graph traversal with edge/node type filters |
| `code_impact` | Predict blast radius of modifying/deleting/renaming a symbol |
| `code_dependencies` | Analyze file/module import dependencies |

### AI Context Tools (KSA-171)

| Tool | Description |
|------|-------------|
| `get_ai_context` | Intent-aware code context with token budgeting |
| `get_edit_context` | Everything needed before editing a symbol |
| `get_curated_context` | Natural language query across codebase |

### Similarity & Git Tools

| Tool | Description |
|------|-------------|
| `find_duplicates` | Find near-duplicate functions using embedding similarity |
| `find_dead_code` | Detect potentially dead/unreachable code |
| `git_search` | Semantic search over git commit history |

### Meta/Orchestration Tools

| Tool | Description |
|------|-------------|
| `find_tools` | Search for available tools by description (semantic + tokenized + cached) |
| `execute_dynamic_tool` | Execute a tool on an upstream MCP server |
| `toggle_tool` | Enable/disable a tool or server |
| `orchestration_status` | Show orchestration status |
| `agent_log` | Write execution log entry for agent tracking |

### Memory Tools (30+)

Full KB management: `mem_search`, `mem_ingest`, `mem_ingest_file`, `mem_pin`, `mem_map`, `mem_crud`, `mem_graph`, `mem_consolidate`, `mem_lifecycle`, `mem_templates`, `mem_attachments`, `mem_discover`, `mem_tags`, `mem_citations`, `mem_conversation`, `mem_scoring`, `mem_admin`.

**New in v1.16.0:** SSE real-time panel updates, Tree-sitter parsers (Kotlin + Python), Apex indexing fix (KSA-209, wasm + regex fallback).

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CODE_INTEL_WORKSPACE` | Workspace path override (takes priority over initialize roots) | Current directory |
| `CODE_INTEL_WATCH` | Enable file watcher | `true` |
| `CODE_INTEL_DEBOUNCE` | Watch debounce (ms) | `500` |
| `OLLAMA_URL` | Ollama base URL | None |
| `OLLAMA_MODEL` | Embedding model | `nomic-embed-text` |

### Config File

Place `.code-intel/config.json` in your workspace:

```json
{
  "watchEnabled": true,
  "watchDebounceMs": 500,
  "ollamaUrl": "http://localhost:11434",
  "ollamaModel": "nomic-embed-text",
  "excludePatterns": ["node_modules", ".git", "dist", "build"],
  "includeExtensions": [".ts", ".kt", ".java", ".py", ".go", ".rs"],
  "maxFileSize": 512000
}
```

---

## Kiro MCP Configuration

Add to `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "java",
      "args": ["-jar", "/path/to/mcp-code-intelligence-latest.jar"],
      "transportType": "stdio",
      "roots": ["${workspaceFolder}"]
    }
  }
}
```

---

## Database

SQLite database stored at `{workspace}/.code-intel/index.db` with WAL mode. Schema is cross-compatible with Node.js, Python, CMD, PowerShell, and Bash variants.

## Key Features

- **stdio transport** - JSON-RPC 2.0 over stdin/stdout
- **Coroutines** - Background indexing without blocking MCP requests
- **NIO WatchService** - Real-time file change detection
- **FTS5** - Porter stemming full-text search
- **Call Graph** - Transitive caller/callee analysis with impact prediction
- **AI Context** - Intent-aware code context with token budgeting
- **KB Auto-Linker** - Automatic relationship discovery between KB entries
- **Shadow JAR** - Single-file deployment (sqlite-jdbc bundled)

---


## Trademarks

- "Kiro" is a trademark of Amazon Web Services, Inc. This project is designed to work with the Kiro IDE but is not affiliated with, endorsed by, or sponsored by Amazon.
- All other trademarks are the property of their respective owners.

## License

MIT

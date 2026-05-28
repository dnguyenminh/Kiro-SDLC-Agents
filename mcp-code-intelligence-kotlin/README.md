# MCP Code Intelligence — Kotlin/JVM

Full-featured MCP server for code intelligence with SQLite FTS5, background indexing via coroutines, and NIO file watcher.

## Requirements

- JDK 21+
- Gradle 8.x (wrapper included)

## Build

```bash
./gradlew shadowJar
```

Output: `build/libs/mcp-code-intelligence-0.1.0.jar`

## Run

```bash
java -jar build/libs/mcp-code-intelligence-0.1.0.jar
```

Workspace is resolved from the MCP `initialize` request's `roots[0].uri` field.
No `--workspace` CLI argument needed.

## SQLite Note

This variant uses **JDBC `sqlite-jdbc`** which is bundled inside the shadow JAR. No separate native binary needed — the JDBC driver includes platform-specific SQLite binaries for all major OS/arch combinations.

The database schema is **cross-compatible** with the Node.js and Python variants. All three can share the same `.code-intel/index.db` file.

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
| `find_tools` | Search for available tools by description |
| `execute_dynamic_tool` | Execute a tool on an upstream MCP server |
| `toggle_tool` | Enable/disable a tool or server |
| `orchestration_status` | Show orchestration status |
| `agent_log` | Write execution log entry for agent tracking |

### Memory Tools (30+)

Full KB management: `mem_search`, `mem_ingest`, `mem_ingest_file`, `mem_pin`, `mem_map`, `mem_crud`, `mem_graph`, `mem_consolidate`, `mem_lifecycle`, `mem_templates`, `mem_attachments`, `mem_discover`, `mem_tags`, `mem_citations`, `mem_conversation`, `mem_scoring`, `mem_admin`.

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

## Kiro MCP Configuration

Add to `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "java",
      "args": ["-jar", "/path/to/mcp-code-intelligence-0.1.0.jar"],
      "transportType": "stdio",
      "roots": ["${workspaceFolder}"]
    }
  }
}
```

## Database

SQLite database stored at `{workspace}/.code-intel/index.db` with WAL mode. Schema is cross-compatible with Node.js, Python, CMD, PowerShell, and Bash variants.

## Architecture

- **stdio transport** — JSON-RPC 2.0 over stdin/stdout
- **Coroutines** — Background indexing without blocking MCP requests
- **NIO WatchService** — Real-time file change detection
- **FTS5** — Porter stemming full-text search
- **Shadow JAR** — Single-file deployment (sqlite-jdbc bundled, no external native binary needed)

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

## MCP Tools

| Tool | Description |
|------|-------------|
| `code_search` | Full-text search across symbols (FTS5 with porter stemming) |
| `code_symbols` | Find symbols by name prefix or list symbols in a file |
| `code_context` | Get source code context around a symbol or line range |
| `code_modules` | List discovered modules with file/symbol counts |
| `code_index_status` | Get indexing status, trigger re-index |

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
- **Shadow JAR** — Single-file deployment

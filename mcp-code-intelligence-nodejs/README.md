# MCP Code Intelligence

Standalone MCP server providing local code intelligence via SQLite FTS5 full-text search with optional Ollama semantic embeddings.

## Features

- **code_search** — Full-text search across indexed symbols (FTS5 + porter stemming)
- **code_symbols** — Lookup symbols by name, kind, or file
- **code_context** — Get source code context around symbols or line ranges
- **code_modules** — List discovered modules with file/symbol counts
- **code_index_status** — View indexing stats, trigger re-index

## Quick Start

```bash
cd mcp-code-intelligence
npm install
npm run build
node dist/index.js
```

Workspace is resolved from the MCP `initialize` request's `roots[0].uri` field.
No `--workspace` CLI argument needed.

## MCP Client Configuration

```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "node",
      "args": ["path/to/mcp-code-intelligence/dist/index.js"],
      "roots": ["/your/project"]
    }
  }
}
```

## Configuration

Config file: `{workspace}/.code-intel/config.json`

```json
{
  "watchEnabled": true,
  "watchDebounceMs": 500,
  "ollamaUrl": "http://localhost:11434",
  "ollamaModel": "nomic-embed-text",
  "excludePatterns": ["node_modules", ".git", "dist", "build"],
  "includeExtensions": [".ts", ".kt", ".py", ".go", ".rs", ".java"],
  "maxFileSize": 512000
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CODE_INTEL_WORKSPACE` | Workspace path override (takes priority over initialize roots) | `cwd()` |
| `CODE_INTEL_WATCH` | Enable file watcher | `true` |
| `CODE_INTEL_DEBOUNCE` | Debounce ms | `500` |
| `OLLAMA_URL` | Ollama API URL | `null` (disabled) |
| `OLLAMA_MODEL` | Embedding model | `nomic-embed-text` |

## Supported Languages

TypeScript, JavaScript, Kotlin, Java, Python, Go, Rust, C/C++, C#, Ruby, PHP, Swift, Scala, SQL, Bash, PowerShell

## Architecture

```
src/
├── index.ts              ← Entry point (stdio MCP server)
├── config.ts             ← Configuration loading
├── db/                   ← SQLite lifecycle + schema
├── scanner/              ← File traversal + symbol extraction
├── query/                ← FTS5 search + symbol lookup
├── indexer/              ← Full/incremental indexing + file watcher
├── ollama/               ← Optional embeddings integration
└── tools/                ← MCP tool handlers
```

## License

MIT

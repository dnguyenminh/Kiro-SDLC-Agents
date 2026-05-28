# MCP Code Intelligence — Node.js

Standalone MCP server providing local code intelligence via SQLite FTS5 full-text search with optional Ollama semantic embeddings.

## Features

- **code_search** — Full-text search across indexed symbols (FTS5 + porter stemming)
- **code_symbols** — Lookup symbols by name, kind, or file
- **code_context** — Get source code context around symbols or line ranges
- **code_modules** — List discovered modules with file/symbol counts
- **code_index_status** — View indexing stats, trigger re-index

## Quick Start

```bash
cd mcp-code-intelligence-nodejs
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
      "args": ["path/to/mcp-code-intelligence-nodejs/dist/index.js"],
      "roots": ["/your/project"]
    }
  }
}
```

## Native Dependencies

This server uses `better-sqlite3` which requires a platform-specific native binary (`.node` file).

### When used via the Kiro SDLC Agents extension

The extension **automatically downloads** the correct prebuilt binary for your platform. No action needed — it sets the `BETTER_SQLITE3_BINDING` environment variable pointing to the cached binary.

### When used standalone (without the extension)

Run `npm install` in this directory. This triggers `node-gyp` to compile `better-sqlite3` from source, which requires:
- Python 3.x
- C++ build tools (Visual Studio Build Tools on Windows, Xcode CLI on macOS, `build-essential` on Linux)

Alternatively, set `BETTER_SQLITE3_BINDING` to point to a prebuilt `.node` file if you have one.

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
| `BETTER_SQLITE3_BINDING` | Path to prebuilt `better_sqlite3.node` binary | `null` (uses npm-installed) |

## Supported Languages

TypeScript, JavaScript, Kotlin, Java, Python, Go, Rust, C/C++, C#, Ruby, PHP, Swift, Scala, SQL, Bash, PowerShell

## Database

SQLite database stored at `{workspace}/.code-intel/index.db` with WAL mode. Schema is cross-compatible with the Python and Kotlin variants — all three can read/write the same database.

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

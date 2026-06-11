# MCP Code Intelligence — Node.js

<p align="center">
  <img src="https://img.shields.io/badge/version-0.7.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge" alt="Node.js">
  <img src="https://img.shields.io/badge/transport-stdio-orange?style=for-the-badge" alt="Transport">
  <img src="https://img.shields.io/badge/MCP_Tools-60+-teal?style=for-the-badge" alt="Tools">
  <img src="https://img.shields.io/badge/Salesforce-compatible-00A1E0?style=for-the-badge" alt="Salesforce Compatible">
</p>

Standalone MCP server providing local code intelligence via SQLite FTS5 full-text search, ONNX embeddings, Tree-sitter AST parsing, call graph analysis, **Salesforce Intelligence** (Apex/Flow/Object/LWC), and 30+ memory/KB tools.

---

## Architecture

```
src/
+-- index.ts              <- Entry point (stdio MCP server)
+-- config.ts             <- Configuration loading
+-- db/                   <- SQLite lifecycle + schema + migrations
+-- scanner/              <- File traversal + symbol extraction
+-- query/                <- FTS5 search + symbol lookup
+-- indexer/              <- Full/incremental indexing + file watcher
+-- parsers/              <- Tree-sitter AST (TS, Kotlin, Python, Go, Rust)
+-- graph/                <- Call graph, dependency, impact analysis (KSA-171)
+-- context/              <- AI context, edit context, curated context (KSA-171)
+-- analyzers/            <- Similarity + security analysis
+-- memory/               <- Knowledge base engine (30+ tools, auto-linker)
+-- orchestration/        <- Child MCP server orchestration + meta-tools
+-- tools/                <- MCP tool handlers (core + graph + AI context)
+-- ollama/               <- Optional embeddings integration
+-- http/                 <- HTTP viewer server + API routes
+-- viewer/               <- Web dashboard (HTML/JS/CSS)
+-- git/                  <- Git history mining + semantic search
```

---

## Features

- **code_search** - Full-text search across indexed symbols (FTS5 + porter stemming)
- **code_symbols** - Lookup symbols by name, kind, or file
- **code_context** - Get source code context around symbols or line ranges
- **code_modules** - List discovered modules with file/symbol counts
- **code_index_status** - View indexing stats, trigger re-index
- **Call Graph** - `code_callers`, `code_callees`, `code_traverse`, `code_impact`, `code_dependencies`
- **AI Context** - `get_ai_context`, `get_edit_context`, `get_curated_context`
- **Similarity** - `find_duplicates`, `find_dead_code` with body extraction
- **Memory/KB** - 30+ tools for knowledge base management
- **Auto-Linker** - Automatic relationship discovery between KB entries
- **Orchestration** - `find_tools`, `execute_dynamic_tool`, `toggle_tool`
- **Salesforce Intelligence** - SFDX detection, Apex/Flow/Object/LWC parsing, SF dependency graph (KSA-191)

---

## Quick Start

```bash
cd mcp-code-intelligence-nodejs
npm install
npm run build
node dist/index.js
```

Workspace is resolved from the MCP `initialize` request's `roots[0].uri` field.
No `--workspace` CLI argument needed.

---

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

---

## Native Dependencies

This server uses `better-sqlite3` (v12.10.0) which requires a platform-specific native binary (`.node` file).

### When used via the Kiro SDLC Agents extension

The extension **automatically downloads** the correct prebuilt binary for your platform. No action needed - it sets the `BETTER_SQLITE3_BINDING` environment variable pointing to the cached binary.

### Supported Platforms

| Node Version | win32-x64 | darwin-x64 | darwin-arm64 | linux-x64 |
|:---:|:---:|:---:|:---:|:---:|
| 20 | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| 22 | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| 24 | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| 25 | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |

### When used standalone (without the extension)

Run `npm install` in this directory. This triggers `node-gyp` to compile `better-sqlite3` from source, which requires:
- Python 3.x
- C++ build tools (Visual Studio Build Tools on Windows, Xcode CLI on macOS, `build-essential` on Linux)

Alternatively, set `BETTER_SQLITE3_BINDING` to point to a prebuilt `.node` file if you have one.

---

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

---

## Supported Languages

TypeScript, JavaScript, Kotlin, Java, Python, Go, Rust, C/C++, C#, Ruby, PHP, Swift, Scala, SQL, Bash, PowerShell, **Apex** (Salesforce)

## Database

SQLite database stored at `{workspace}/.code-intel/index.db` with WAL mode. Schema is cross-compatible with the Python and Kotlin variants - all three can read/write the same database.

---


## Trademarks

- "Kiro" is a trademark of Amazon Web Services, Inc. This project is designed to work with the Kiro IDE but is not affiliated with, endorsed by, or sponsored by Amazon.
- "Salesforce" and "Apex" are trademarks of Salesforce, Inc.
- All other trademarks are the property of their respective owners.

## License

MIT

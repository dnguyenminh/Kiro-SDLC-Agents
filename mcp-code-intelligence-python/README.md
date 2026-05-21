# MCP Code Intelligence — Python

Standalone MCP server providing code search, symbols, and context via stdio transport.
Uses Python's built-in `sqlite3` module with FTS5 for full-text search.

## Requirements

- Python 3.11+ (stdlib only — zero external dependencies)
- Optional: `watchdog` for file watching

## Installation

```bash
# From the project directory
pip install -e .

# Or run directly
python -m mcp_code_intel
```

## Usage

Workspace is resolved from the MCP `initialize` request's `roots[0].uri` field.
No `--workspace` CLI argument needed.

```bash
# Basic usage (workspace comes from MCP client)
python -m mcp_code_intel

# Override workspace with environment variable
CODE_INTEL_WORKSPACE=/path/to/project python -m mcp_code_intel

# With Ollama embeddings
OLLAMA_URL=http://localhost:11434 python -m mcp_code_intel
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `code_search` | Full-text search across indexed symbols (FTS5 + porter stemming) |
| `code_symbols` | Find symbols by name prefix or list symbols in a file |
| `code_context` | Get source code context around a symbol or line range |
| `code_modules` | List discovered modules with file/symbol counts |
| `code_index_status` | Get indexing status, trigger re-index |

## Embedding Models (KSA-102)

`find_tools` supports semantic search via ONNX embedding models. On first use, the default English model is auto-downloaded in the background.

### Download Models

**Easiest way:** `Ctrl+Shift+P` → "Kiro SDLC: Download Embedding Model" (works without MCP server running)

**Via MCP tool** (when server is running):
```bash
mem_model_manager(action="download", model_name="paraphrase-multilingual-MiniLM-L12-v2")
mem_model_manager(action="switch", model_name="paraphrase-multilingual-MiniLM-L12-v2")
```

### Available Models

| Model | Size | Languages | Use Case |
|-------|------|-----------|----------|
| `all-MiniLM-L6-v2` | 90MB | English | Default, fast, good for English tool names |
| `paraphrase-multilingual-MiniLM-L12-v2` | 470MB | 50+ (en, vi, zh, ja, ko...) | Multilingual queries |

### Model Management

```bash
# List available models
mem_model_manager(action="list")

# Check current model status
mem_model_manager(action="status")

# Download multilingual model (for Vietnamese/Chinese/etc.)
mem_model_manager(action="download", model_name="paraphrase-multilingual-MiniLM-L12-v2")

# Switch to multilingual model
mem_model_manager(action="switch", model_name="paraphrase-multilingual-MiniLM-L12-v2")
```

### How It Works

1. `find_tools(query)` first tries tokenized search (instant)
2. If no match → checks learned cache (instant, self-improving)
3. If cache miss → embedding similarity search (< 100ms)
4. If embedding finds match → caches it for next time (self-learning)
5. Models stored globally at `~/.code-intel/models/`
6. Cache stored per-workspace at `.code-intel/token-cache.json`

## Kiro MCP Configuration

Add to `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "python",
      "args": ["-m", "mcp_code_intel"],
      "cwd": "/path/to/mcp-code-intelligence-python",
      "roots": ["${workspaceFolder}"]
    }
  }
}
```

Or with `uv`:

```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "uv",
      "args": ["run", "python", "-m", "mcp_code_intel"],
      "cwd": "/path/to/mcp-code-intelligence-python",
      "roots": ["${workspaceFolder}"]
    }
  }
}
```

## Configuration

Configuration is loaded from (priority: env > initialize roots > file > defaults):

1. Environment: `CODE_INTEL_WORKSPACE` (overrides initialize roots), `CODE_INTEL_WATCH`, `OLLAMA_URL`, `OLLAMA_MODEL`
2. MCP initialize: `params.roots[0].uri`
3. Config file: `{workspace}/.code-intel/config.json`
4. Fallback: `cwd()`

### Config file example

```json
{
  "watchEnabled": true,
  "watchDebounceMs": 500,
  "ollamaUrl": "http://localhost:11434",
  "ollamaModel": "nomic-embed-text",
  "excludePatterns": ["node_modules", ".git", "dist", "build"],
  "includeExtensions": [".ts", ".py", ".kt", ".java", ".go", ".rs"],
  "maxFileSize": 512000
}
```

## Database

SQLite database stored at `{workspace}/.code-intel/index.db`.
Schema is cross-compatible with the Node.js variant.

## Running Tests

```bash
python tests/test_extractor.py
```

## Architecture

```
src/mcp_code_intel/
├── __main__.py    — Entry point
├── server.py      — MCP server (stdio JSON-RPC)
├── config.py      — Configuration loading
├── db.py          — SQLite lifecycle + schema
├── scanner.py     — File scanner + language detection
├── extractor.py   — Signature extraction (regex)
├── indexer.py     — Full/incremental indexing
├── query.py       — FTS5 search + symbol lookup
├── tools.py       — 5 MCP tool handlers
└── ollama.py      — Optional Ollama client
```

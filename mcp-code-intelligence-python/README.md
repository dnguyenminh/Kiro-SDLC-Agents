# MCP Code Intelligence — Python

<p align="center">
  <img src="https://img.shields.io/badge/version-0.7.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Python-3.11+-yellow?style=for-the-badge" alt="Python">
  <img src="https://img.shields.io/badge/deps-zero_external-green?style=for-the-badge" alt="Dependencies">
  <img src="https://img.shields.io/badge/MCP_Tools-60+-teal?style=for-the-badge" alt="Tools">
</p>

Standalone MCP server providing code search, symbols, context, call graph analysis, and 30+ memory/KB tools via stdio transport. Uses Python's built-in `sqlite3` module with FTS5 — **zero external dependencies**.

---

## Architecture

```
src/mcp_code_intel/
+-- __main__.py       - Entry point
+-- server.py         - MCP server (stdio JSON-RPC)
+-- config.py         - Configuration loading
+-- db.py             - SQLite lifecycle + schema
+-- scanner.py        - File scanner + language detection
+-- extractor.py      - Signature extraction (regex)
+-- indexer.py        - Full/incremental indexing
+-- query.py          - FTS5 search + symbol lookup
+-- tools.py          - Core MCP tool handlers
+-- stream_write.py   - stream_write_file handler
+-- ollama.py         - Optional Ollama client
+-- graph/            - Call graph, dependency, impact, traversal (KSA-171)
+-- context/          - AI context, edit context, curated context (KSA-171)
+-- analyzers/        - Similarity + Security analysis
+-- parsers/          - Tree-sitter AST utilities + language parsers
+-- memory/           - Knowledge base engine (30+ tools, auto-linker)
+-- orchestration/    - Child MCP server orchestration + meta-tools
+-- drawio/           - Draw.io auto-layout tool
+-- git/              - Git history mining + semantic search
+-- http/             - HTTP viewer server + API routes
+-- viewer/           - Web dashboard (HTML/JS/CSS)
```

---

## Requirements

- Python 3.11+ (stdlib only - zero external dependencies)
- Optional: `watchdog` for file watching

## SQLite Note

This variant uses Python's **stdlib `sqlite3`** module. No native binary compilation needed - no `better-sqlite3`, no `node-gyp`, no C++ toolchain.

The database schema is **cross-compatible** with the Node.js and Kotlin variants. All three can share the same `.code-intel/index.db` file.

---

## Installation

```bash
# From the project directory
pip install -e .

# Or run directly
python -m mcp_code_intel
```

## Usage

```bash
# Basic usage (workspace comes from MCP client)
python -m mcp_code_intel

# Override workspace with environment variable
CODE_INTEL_WORKSPACE=/path/to/project python -m mcp_code_intel

# With Ollama embeddings
OLLAMA_URL=http://localhost:11434 python -m mcp_code_intel
```

---

## MCP Tools

### Core Tools

| Tool | Description |
|------|-------------|
| `code_search` | Full-text search across indexed symbols (FTS5 + porter stemming) |
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

**New in v1.15.0:** Salesforce Intelligence — Apex/Flow/Object/LWC parsing and SF dependency graph (KSA-191). KB Auto-Linker - automatic relationship discovery between entries using entity extraction and semantic similarity.

---

## Embedding Models (KSA-102)

`find_tools` supports semantic search via ONNX embedding models. On first use, the default English model is auto-downloaded in the background.

### Download Models

**Easiest way:** `Ctrl+Shift+P` -> "Kiro SDLC: Download Embedding Model" (works without MCP server running)

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

### How It Works

1. `find_tools(query)` first tries tokenized search (instant)
2. If no match -> checks learned cache (instant, self-improving)
3. If cache miss -> embedding similarity search (< 100ms)
4. If embedding finds match -> caches it for next time (self-learning)
5. Models stored globally at `~/.code-intel/models/`
6. Cache stored per-workspace at `.code-intel/token-cache.json`

---

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

---

## Configuration

Configuration is loaded from (priority: env > initialize roots > file > defaults):

1. Environment: `CODE_INTEL_WORKSPACE`, `CODE_INTEL_WATCH`, `OLLAMA_URL`, `OLLAMA_MODEL`
2. MCP initialize: `params.roots[0].uri`
3. Config file: `{workspace}/.code-intel/config.json`
4. Fallback: `cwd()`

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

---

## Database

SQLite database stored at `{workspace}/.code-intel/index.db`. Schema is cross-compatible with the Node.js and Kotlin variants - all three can share the same database file.

## Running Tests

```bash
python tests/test_extractor.py
```

---

## License

MIT

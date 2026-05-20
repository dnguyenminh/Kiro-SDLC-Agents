# Kiro SDLC Agents — VS Code Extension

Inject a complete multi-agent SDLC pipeline into any workspace with one command. Includes 9 AI agents, steering rules, hooks, document templates, and MCP-based code intelligence.

## Commands

| Command | Description |
|---------|-------------|
| `Kiro SDLC: Inject All Agents` | Inject all agents, steering, hooks, templates + MCP config |
| `Kiro SDLC: Inject (Select Components)` | Pick which components to inject |
| `Kiro SDLC: Update Agents` | Update to latest version (overwrites outdated files) |
| `Kiro SDLC: Show Status` | Check which components are present and their versions |
| `Kiro SDLC: Index Workspace (Code + Documents)` | Index source code + documents into Knowledge Base |

## What Gets Injected

```
your-workspace/
├── .kiro/
│   ├── agents/         ← 9 agents (SM, BA, TA, SA, QA, DEV, DevOps, UI, Security)
│   ├── steering/       ← Code standards, self-learning, drawio, jira-workflow
│   ├── hooks/          ← Code indexing triggers, drawio validation
│   └── settings/
│       └── mcp.json    ← Code Intelligence MCP server config (auto-added)
└── documents/
    └── templates/      ← BRD, FSD, TDD, STP, STC, DPG, RLN, UG templates
```

## MCP Code Intelligence

Starting in v1.2.0, code intelligence is powered by an MCP server instead of bundled indexer scripts. The extension injects a `code-intelligence` entry into `.kiro/settings/mcp.json` that points to your chosen MCP server variant.

### How It Works

1. During "Inject All" or "Inject Selective", you choose an MCP variant:
   - **Python** (recommended) — Python 3.11+, zero dependencies, uvx auto-downloads
   - **Node.js** (full-featured) — Node.js 20+, npx auto-downloads
   - **Kotlin/JVM** (enterprise) — JDK 11+, coroutines + NIO watcher
2. The extension writes the server config to `.kiro/settings/mcp.json`
3. Kiro automatically starts the MCP server and indexes your codebase

### Delivery Model

| Variant | Delivery | Install |
|---------|----------|---------|
| Python | `uvx` (PyPI) | Zero install — uvx auto-downloads |
| Node.js | `npx` (npm) | Zero install — npx auto-downloads |
| Kotlin | GitHub Release | Extension downloads JAR to `~/.kiro/mcp-servers/` |

### Generated MCP Config Examples

**Python (uvx):**
```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "uvx",
      "args": ["mcp-code-intel@latest", "--workspace", "${workspaceFolder}", "--config", "${workspaceFolder}/.code-intel/orchestration.json"],
      "cwd": "/absolute/path/to/workspace"
    }
  }
}
```

**Node.js (npx):**
```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "npx",
      "args": ["mcp-code-intelligence@latest", "--workspace", "${workspaceFolder}", "--config", "${workspaceFolder}/.code-intel/orchestration.json"],
      "cwd": "/absolute/path/to/workspace"
    }
  }
}
```

**Kotlin (downloaded JAR):**
```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "java",
      "args": ["-jar", "~/.kiro/mcp-servers/code-intelligence/mcp-code-intelligence.jar", "--workspace", "${workspaceFolder}", "--config", "${workspaceFolder}/.code-intel/orchestration.json"],
      "cwd": "/absolute/path/to/workspace"
    }
  }
}
```

> **Note:** The `cwd` field requires an absolute path — `${workspaceFolder}` is not supported here. The extension automatically sets this to your workspace root when injecting the MCP config.

### First-time Security Approval

When you first add the MCP config, Kiro will show a security prompt:

> 🔒 Your MCP configuration contains environment variables that have not been approved: workspaceFolder

Click **"Approve"** — this is safe. `${workspaceFolder}` simply resolves to your current workspace path (e.g., `/home/user/my-project`). You only need to approve once per workspace.

### Why `--workspace` is Required

Kiro does **not** currently send `roots` in the MCP `initialize` request. Without `--workspace`, the server falls back to `cwd()` which resolves to the Kiro installation folder — not your project. The `--workspace` CLI arg ensures the server always indexes the correct workspace.

**Priority resolution:**
1. `--workspace` CLI arg (highest — Kiro resolves `${workspaceFolder}`)
2. `CODE_INTEL_WORKSPACE` env var
3. `initialize.roots[0].uri` (for future Kiro versions)
4. `cwd()` (lowest fallback)

### Variant Selection

The variant picker appears during injection. You can change it later by re-running "Inject Selective" → "Code Intelligence MCP Server".

## Usage

1. Open any workspace in VS Code / Kiro
2. `Ctrl+Shift+P` → "Kiro SDLC: Inject All Agents"
3. Select your preferred MCP variant (Python / Node.js / Kotlin)
4. Done — agents, templates, and code intelligence are ready

## Status Check

Run "Show Status" to verify:
- Which agent/steering/hook files are present
- Whether `code-intelligence` key exists in `mcp.json`
- File version states (current / outdated / modified)

## Settings

No manual configuration needed. All settings are configured through the injection wizard:
- MCP variant → chosen during "Inject All" or "Inject Selective"
- Ollama → prompted after variant selection (optional)

## Optional: Semantic Search with Ollama

By default, code intelligence uses **FTS5 keyword search** (fast, zero setup). For **semantic search** (find code by meaning), the injection wizard offers Ollama integration.

### Wizard Flow

```
Step 1: Choose MCP variant (Python / Node.js / Kotlin)
Step 2: "Enable Ollama semantic search?" → Yes / No
Step 3: Enter Ollama URL (default: http://localhost:11434)
Step 4: Extension connects to Ollama → shows available models → you pick one
→ Done: config injected with OLLAMA_URL + OLLAMA_MODEL env vars
```

### Prerequisites

1. Install Ollama: https://ollama.com/download
2. Pull an embedding model: `ollama pull nomic-embed-text`
3. Ensure Ollama is running: `ollama serve`

### What changes

| Without Ollama | With Ollama |
|----------------|-------------|
| FTS5 keyword search only | FTS5 + vector similarity search |
| Exact/prefix matching | Semantic meaning matching |
| Zero setup | Requires Ollama running locally |

## Upgrading from v1.x

If you previously used v1.0.x or v1.1.x, the extension handles migration automatically on first activation after upgrade:

| What changes | Before (v1.x) | After (v1.2.0) |
|--------------|----------------|-----------------|
| Code indexing | Bundled scripts in `.analysis/code-intelligence/scripts/` | MCP server via `.kiro/settings/mcp.json` |
| Indexer command | `Kiro SDLC: Run Code Indexer` | Removed — MCP server indexes automatically |
| Settings | `kiroSdlc.preferredIndexer` | Removed — variant chosen during injection |

### Auto-migration behavior

1. Extension detects legacy `scripts/` folder in `.analysis/code-intelligence/`
2. Prompts you to confirm removal (or removes silently if no user modifications detected)
3. Injects MCP config into `mcp.json` with your chosen variant
4. Existing `.analysis/code-intelligence/project-structure.md` and `modules/` are preserved

### Manual cleanup (optional)

If auto-migration didn't trigger, you can safely delete:
```
.analysis/code-intelligence/scripts/   ← entire folder
```

## Indexing Your Project

After injection, the MCP server automatically indexes your **source code**. For **documents** (BRD, FSD, TDD), you can index them via command or chat.

### Quick Start: Index Workspace Command

`Ctrl+Shift+P` → **"Kiro SDLC: Index Workspace (Code + Documents)"**

This command lets you pick what to index:
- **Index Source Code** — triggers MCP server re-index (FTS5 full-text search)
- **Index Documents** — discovers all BRD/FSD/TDD in `documents/` folder
- **Sync Code → Memory** — links code symbols into knowledge graph

> 💡 After "Inject All" or "Inject (Select Components)", the extension automatically asks if you want to index.

### Deduplication (Auto-skip Unchanged Files)

The MCP server tracks every indexed file by **filename + timestamp + checksum**:
- If a file hasn't changed since last index → **automatically skipped**
- If only timestamp changed but content is identical → **skipped** (checksum match)
- Only truly modified files get re-indexed

No manual cache management needed — it's all handled server-side in the database.

### Check Index Status

In Kiro chat, ask the agent to run:
```
code_index_status
```

This shows: file count, symbol count, languages detected, and last indexed time.

### Index Project Documents

To make your BRD, FSD, TDD searchable by agents:

```
mem_ingest_file → path: "documents/YOUR-TICKET/BRD.md", type: "REQUIREMENT"
mem_ingest_file → path: "documents/YOUR-TICKET/FSD.md", type: "REQUIREMENT"
mem_ingest_file → path: "documents/YOUR-TICKET/TDD.md", type: "ARCHITECTURE"
```

Or simply ask the agent: *"Index all documents for KSA-14"*

> Unchanged files are auto-skipped — safe to re-run anytime without duplicating data.

### Sync Code Symbols to Memory

After indexing, sync code entities into the knowledge graph for cross-referencing:

```
mem_sync_code
```

### Search the Knowledge Base

```
mem_search → query: "authentication", detail: true
```

Filter by agent role: `role: "DEV"`, `role: "QA"`, `role: "SA"`

### Re-index After Major Changes

After large merges or restructuring:
```
code_index_status → reindex: true
mem_sync_code
```

### Document Type Reference

| Document | Type Parameter |
|----------|---------------|
| BRD, FSD | `REQUIREMENT` |
| TDD | `ARCHITECTURE` |
| STP, STC | `PROCEDURE` |
| DPG, RLN | `PROCEDURE` |
| Decision records | `DECISION` |
| Error patterns | `ERROR_PATTERN` |

> Full details: see `.kiro/steering/indexing-guide.md` after injection.

## Development

```bash
cd kiro-sdlc-agents
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

## Packaging

```bash
npm run package
# Creates kiro-sdlc-agents-1.2.0.vsix
```

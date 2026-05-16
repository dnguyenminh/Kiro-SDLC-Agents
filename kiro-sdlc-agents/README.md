# Kiro SDLC Agents — VS Code Extension

Inject a complete multi-agent SDLC pipeline into any workspace with one command. Includes 9 AI agents, steering rules, hooks, document templates, and MCP-based code intelligence.

## Commands

| Command | Description |
|---------|-------------|
| `Kiro SDLC: Inject All Agents` | Inject all agents, steering, hooks, templates + MCP config |
| `Kiro SDLC: Inject (Select Components)` | Pick which components to inject |
| `Kiro SDLC: Update Agents` | Update to latest version (overwrites outdated files) |
| `Kiro SDLC: Show Status` | Check which components are present and their versions |

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
      "args": ["mcp-code-intelligence@latest", "--workspace", "${workspaceFolder}"]
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
      "args": ["mcp-code-intelligence@latest", "--workspace", "${workspaceFolder}"]
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
      "args": ["-jar", "~/.kiro/mcp-servers/code-intelligence/mcp-code-intelligence.jar", "--workspace", "${workspaceFolder}"]
    }
  }
}
```

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

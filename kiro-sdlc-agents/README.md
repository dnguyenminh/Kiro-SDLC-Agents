<p align="center">
  <img src="resources/icon.png" alt="Kiro SDLC Agents" width="128" height="128">
</p>

<h1 align="center">Kiro SDLC Agents</h1>

> **📢 Migrated to Enterprise repo:** [SDLC-Agents-4-Enterprise/extension](https://github.com/dnguyenminh/SDLC-Agents-4-Enteprise/tree/main/extension)
> — Enterprise-focused extension for production deployment. This copy remains for development reference.

<p align="center">
  <strong>Your entire software team — in one extension.</strong><br>
  9 AI agents. Full SDLC pipeline. Knowledge Base UI. Thin client for Code Intelligence backend.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.1-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/agents-9-purple?style=for-the-badge" alt="Agents">
  <img src="https://img.shields.io/badge/KB_Panels-5-orange?style=for-the-badge" alt="KB Panels">
</p>

---

## Prerequisites: Backend Server Required

This extension is a **thin client** — it requires the **Code Intelligence Backend** server running on your machine.

### Setup Steps

1. **Download and start the backend server** (see [backend README](../backend/README.md)):

```bash
cd backend
npm ci
npm run build
npm start
# Server runs at http://localhost:48721
```

2. **Install this extension** (`.vsix` file):

```bash
# Build the extension
cd kiro-sdlc-agents
npm ci
npm run esbuild
npx vsce package --no-dependencies

# Install into Kiro
kiro --install-extension kiro-sdlc-agents-2.0.1.vsix

# Or VS Code
code --install-extension kiro-sdlc-agents-2.0.1.vsix
```

3. **Verify connection**: Command Palette → "Kiro SDLC: Settings" → Server Settings → Test Connection

> Without the backend server, agent tools, KB panels, and indexing features will not work.

---

## Quick Start

```
1. Ensure backend is running (http://localhost:48721/health → "healthy")
2. Open Command Palette: Ctrl+Shift+P → "Kiro SDLC: Inject All Agents"
3. Check sidebar: KIRO SDLC AGENTS → should show server connected
4. Give a Jira ticket to SM: @sm-agent KSA-14
```

---

## Features

### 9 SDLC Agents

| Agent | Role | What They Do |
|-------|------|-------------|
| SM | Scrum Master | Orchestrates pipeline, manages Jira, enforces quality gates |
| BA | Business Analyst | BRD, FSD, user stories, acceptance criteria |
| TA | Technical Analyst | API contracts, pseudocode, technical enrichment |
| SA | Solution Architect | TDD, architecture decisions, diagrams |
| QA | Quality Assurance | Test plans (STP), test cases (STC), test execution |
| DEV | Developer | Code implementation, user guides |
| DevOps | Deployment | Deployment guides, CI/CD, release notes |
| UI | UI Designer | Wireframes, design specs |
| Security | Security Review | Threat modeling, vulnerability assessment |

### Usage

```
@sm-agent KSA-14              → Full pipeline (SM orchestrates everything)
@ba-agent KSA-14              → Just create BRD + FSD
@sa-agent KSA-14              → Just create TDD
@dev-agent KSA-14             → Implement code from TDD
@qa-agent KSA-14              → Create test plan + cases
```

---

### Knowledge Base UI (5 Panels)

| Panel | Description |
|-------|-------------|
| Dashboard | Health score, metrics, trends, recommendations |
| Graph | 3D force-directed knowledge graph |
| Tags | Tag taxonomy, browse entries by tag |
| Quality | Score distribution, confidence stats |
| Analytics | Search trends, popular queries, knowledge gaps |

Open from sidebar → "Knowledge Base" section, or Command Palette → "KB".

---

### Chat Panel

Built-in chat interface with LLM integration. Supports multiple providers:

| Provider | Setup |
|----------|-------|
| Anthropic | API key in Settings |
| OpenAI | API key in Settings |
| Ollama | Local server URL |
| LM Studio | Local server URL |
| OpenRouter | API key + model selection |
| Kiro Gateway | Auto (uses IDE credentials) |

Configure: Command Palette → "Kiro SDLC: Settings" → LLM Provider tab.

---

### Code Intelligence

| Feature | Command |
|---------|---------|
| Symbol Search | `Kiro SDLC: Symbol Search` |
| Impact Analysis | `Kiro SDLC: Impact Analysis` |
| Security Panel | `Kiro SDLC: Security Panel` |
| AI Context | `Kiro SDLC: Get AI Context for Symbol` |
| Salesforce Index | `Kiro SDLC: Index Salesforce Project` |

---

## Commands

| Command | Description |
|---------|-------------|
| `Kiro SDLC: Inject All Agents` | Install agents, steering, hooks, templates |
| `Kiro SDLC: Inject (Select Components)` | Pick specific components to inject |
| `Kiro SDLC: Update Agents` | Update to latest bundled version |
| `Kiro SDLC: Show Status` | Check all components + server status |
| `Kiro SDLC: Settings` | Open settings panel (LLM + Server) |
| `Kiro SDLC: Reconnect to Backend` | Reconnect if connection dropped |
| `Kiro SDLC: Disconnect` | Disconnect from backend |
| `Kiro SDLC: Index Salesforce Project` | Index SFDX project metadata |
| `Kiro SDLC: Symbol Search` | Search symbols across codebase |
| `Kiro SDLC: Impact Analysis` | Blast radius for a symbol |
| `Kiro SDLC: Open KB in Browser` | Open web dashboard in browser |

---

## Settings

Configure in IDE settings (`Ctrl+,` → search "kiroSdlc") or via Settings panel:

| Setting | Default | Description |
|---------|---------|-------------|
| `kiroSdlc.backend.url` | `http://127.0.0.1:48721` | Backend server URL |
| `kiroSdlc.llmProvider` | `anthropic` | Active LLM provider |
| `kiroSdlc.llmModel` | (auto) | Override model for selected provider |
| `kiroSdlc.enableMcpServer` | `true` | Enable local MCP wrapper on startup |
| `kiroSdlc.mcpServerPort` | `9181` | Local MCP wrapper port |

---

## Architecture (v2.0)

```
┌─────────────────────────────────────────────────┐
│  Extension (thin client)                         │
│  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ Commands     │  │ Webview Panels           │  │
│  │ Chat Panel   │  │ (Graph, Dashboard, etc.) │  │
│  │ Tree View    │  │ Settings, Login          │  │
│  └──────┬───────┘  └──────────┬──────────────┘  │
│         │     HTTP :48721     │                  │
└─────────┼─────────────────────┼──────────────────┘
          │                     │
┌─────────▼─────────────────────▼──────────────────┐
│  Backend Server (separate process)                │
│  - 60+ MCP Tools                                 │
│  - SQLite + ONNX embeddings                      │
│  - Code indexing + AST parsing                   │
│  - Child MCP orchestration                       │
│  - Web admin portal                              │
└───────────────────────────────────────────────────┘
```

**Key difference from v1.x**: The extension no longer bundles its own MCP server. It connects to the standalone backend process via HTTP.

---

## Troubleshooting

### "Test Connection" loading forever

- Ensure backend is running: `curl http://localhost:48721/health`
- Check the URL in Settings matches the actual server address

### Extension shows "disconnected"

- Backend server may have crashed — restart it: `cd backend && npm start`
- Or reconnect: Command Palette → "Kiro SDLC: Reconnect to Backend"

### Panels show blank/empty

- Panels require backend connection
- Verify backend health, then close and reopen the panel

### Agent tools timeout

- Backend must be running and healthy
- Check backend logs for errors: look at terminal where `npm start` is running

---

## Salesforce Support

The extension can index SFDX projects:

1. Command Palette → "Kiro SDLC: Index Salesforce Project"
2. Extension detects `sfdx-project.json` in workspace
3. Counts and indexes: Apex classes, Triggers, Flows, Custom Objects, LWC components
4. All SF symbols become searchable via code intelligence tools

---

## License

MIT

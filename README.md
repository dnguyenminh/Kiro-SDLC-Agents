# Kiro SDLC Platform

<p align="center">
  <strong>Multi-agent SDLC pipeline with Code Intelligence backend and Kiro IDE extension.</strong><br>
  9 AI agents automate your workflow: BA → SA → DEV → QA → DevOps.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.1-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/agents-9-purple?style=for-the-badge" alt="Agents">
  <img src="https://img.shields.io/badge/MCP_Tools-60+-teal?style=for-the-badge" alt="MCP Tools">
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License">
</p>

---

## Overview

This platform consists of two main components that work together:

| Component | Description | Location |
|-----------|-------------|----------|
| **Backend Server** | Standalone HTTP server providing KB, code intelligence, orchestration, and MCP tools | [`backend/`](backend/) |
| **Kiro Extension** | IDE extension (VS Code / Kiro) — thin client connecting to backend, 9 SDLC agents, KB UI panels | [`kiro-sdlc-agents/`](kiro-sdlc-agents/) |

```
┌──────────────────────────────────────────────────────────┐
│  Kiro IDE                                                 │
│  ┌────────────────────────┐  ┌────────────────────────┐  │
│  │  Extension (thin client)│  │  KB UI Panels          │  │
│  │  - 9 SDLC Agents       │  │  - Graph, Dashboard    │  │
│  │  - Settings Panel       │  │  - Quality, Analytics  │  │
│  │  - Chat Panel           │  │  - Tags               │  │
│  └──────────┬─────────────┘  └────────────┬───────────┘  │
│             │          HTTP :48721         │              │
│  ┌──────────▼─────────────────────────────▼───────────┐  │
│  │  Backend Server (code-intel-backend)                 │  │
│  │  ├─ MCP Tools (60+ tools via JSON-RPC over HTTP)    │  │
│  │  ├─ Memory/KB (SQLite + ONNX embeddings)            │  │
│  │  ├─ Code Intelligence (AST, search, graph)          │  │
│  │  ├─ Orchestration (child MCP servers)               │  │
│  │  └─ Admin Portal (web UI on :48721)                 │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Step 1: Start the Backend Server

```bash
cd backend
npm ci
npm run build
npm start
```

Server starts at `http://localhost:48721`. Verify: `curl http://localhost:48721/health`

### Step 2: Install the Extension

```bash
cd kiro-sdlc-agents
npm ci
npm run esbuild
npx vsce package --no-dependencies
```

Then install the `.vsix` file:
- **Kiro IDE**: `kiro --install-extension kiro-sdlc-agents-2.0.1.vsix`
- **VS Code**: `code --install-extension kiro-sdlc-agents-2.0.1.vsix`

### Step 3: Configure & Connect

1. Open a workspace in Kiro/VS Code
2. The extension auto-connects to the backend at `http://localhost:48721`
3. Verify connection: Command Palette → "Kiro SDLC: Settings" → Server Settings → Test Connection
4. Inject agents: Command Palette → "Kiro SDLC: Inject All Agents"

### Step 4: Start Working

Give a Jira ticket to the Scrum Master agent:

```
@sm-agent KSA-14              → Full pipeline
@sm-agent KSA-14 tạo BRD     → Just create BRD
@sm-agent KSA-14 status      → Check progress
```

---

## Agent Pipeline

| Phase | Agent | Output |
|-------|-------|--------|
| 1. Requirements | BA | BRD.md |
| 2. Specification | BA + TA | FSD.md |
| 3. Design | SA | TDD.md |
| 4. Test Planning | QA | STP.md, STC.md |
| 5. Implementation | DEV | Source code |
| 5.5. User Guide | DEV + BA + QA | UG.md |
| 6. Testing | QA | Test results |
| 7. Deployment | DevOps | DPG.md, RLN.md |

---

## Project Structure

```
FEC_CR_Builder/
├── backend/                       ← Backend server (START THIS FIRST)
├── kiro-sdlc-agents/              ← Kiro/VS Code Extension
├── mcp-code-intelligence-kotlin/  ← MCP Server variant (Kotlin/JVM)
├── mcp-code-intelligence-nodejs/  ← MCP Server variant (Node.js)
├── mcp-code-intelligence-python/  ← MCP Server variant (Python)
├── mcp-salesforce-intelligence/   ← Salesforce parsing library
├── documents/                     ← Generated SDLC documents per ticket
├── .kiro/                         ← Agents, steering rules, hooks
└── .code-intel/                   ← Runtime data (DB, models, configs)
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Backend README](backend/README.md) | Server setup, configuration, API reference |
| [Extension README](kiro-sdlc-agents/README.md) | Extension features, commands, KB UI guide |
| [CHANGELOG](kiro-sdlc-agents/CHANGELOG.md) | Version history |

---

## License

MIT

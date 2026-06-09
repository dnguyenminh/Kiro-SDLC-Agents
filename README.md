# FEC CR Builder — Multi-Agent SDLC Platform

<p align="center">
  <img src="kiro-sdlc-agents/resources/docs/diagrams/architecture-overview.png" alt="Architecture Overview" width="800">
</p>

<p align="center">
  <strong>Nền tảng phát triển phần mềm đa agent, tích hợp Jira, Code Intelligence MCP, và Kiro IDE.</strong><br>
  Pipeline tự động: BA → SA → DEV → QA → DevOps.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.18.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/agents-9-purple?style=for-the-badge" alt="Agents">
  <img src="https://img.shields.io/badge/MCP_Servers-3-teal?style=for-the-badge" alt="MCP Servers">
  <img src="https://img.shields.io/badge/Salesforce-compatible-00A1E0?style=for-the-badge" alt="Salesforce Compatible">
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License">
</p>

---

## What's New in v1.18.0

- **📊 Context Usage Graph** (KSA-249) — Real-time visualization of token consumption per source (steering, code-intel, KB, user messages) with percentage breakdown
- **🪝 Full Hook System** — Lifecycle hooks for pre/post agent execution, tool calls, and streaming events (`hook-loader`, `hook-executor`, `hook-events`, `hook-commands`)
- **💬 Conversation Manager** — Multi-turn state management with context window limits and automatic compaction
- **🔢 Token Counter** — Accurate token estimation for messages, tool calls, and system prompts
- **🔄 Workflow Executor** — Multi-agent workflow orchestration with state transitions and hook integration
- **📈 Workflow Graph Visualization** — Interactive workflow state diagram in chat panel

<details>
<summary>Previous: v1.16.0</summary>

- **📡 SSE Real-time Panel Updates** — Tags, Quality, and Analytics panels now receive live updates via Server-Sent Events (no manual refresh needed)
- **🌳 Tree-sitter Parser Integration** — Kotlin and Python AST parsing via tree-sitter for accurate symbol extraction
- **🐛 Apex Indexing Fix (KSA-209)** — Wasm + regex fallback ensures reliable Apex parsing across all environments
- **21 tickets closed** — Full sprint completion across code intelligence, KB UI, and Salesforce modules
</details>

<details>
<summary>Previous: v1.15.0</summary>

- **🎉 Salesforce Intelligence** — Full SFDX project support: Apex, Flow, Custom Objects, LWC parsing and analysis (KSA-191)
- **SF Dependency Graph** — Trigger→Object, Flow→Apex, LWC→Apex relationship tracking
- **SF Impact Analysis** — Blast radius analysis across Salesforce metadata types
- **Index Salesforce Project** — New command to index entire SFDX projects into Code Intelligence
- **Shared Library** — `mcp-salesforce-intelligence` v2.1.0 provides reusable SF parsers and types
</details>

<details>
<summary>Previous: v1.14.0</summary>

- **KB Auto-Linker** — Automatic relationship discovery between KB entries using configurable linking strategies
- **KB Graph LOD** (Level of Detail) — Clustering + animation for large knowledge graphs (879+ nodes)
- **Incremental Prebuilt Binary Pipeline** — CI/CD auto-detects missing native binaries, builds only what's needed
- **Node.js 25 Support** — Precompiled native binaries for Node 20, 22, 24, 25
- **better-sqlite3 v12.10.0** — Latest SQLite bindings with verified SHA-256 checksums
- **Similarity Tools** — `find_duplicates` + `find_dead_code` wired into indexing pipeline
- **Body Extraction** — Full function body extraction for deeper code analysis
</details>

---

## Architecture

<p align="center">
  <img src="kiro-sdlc-agents/resources/docs/diagrams/mcp-orchestration.png" alt="MCP Orchestration" width="800">
</p>

```
FEC_CR_Builder/
├── kiro-sdlc-agents/              ← VS Code/Kiro Extension (9 agents + MCP + KB UI)
├── mcp-code-intelligence-kotlin/  ← MCP Server — Kotlin/JVM (enterprise, coroutines)
├── mcp-code-intelligence-nodejs/  ← MCP Server — Node.js (full-featured, ONNX embeddings)
├── mcp-code-intelligence-python/  ← MCP Server — Python (zero-dependency, stdlib sqlite3)
├── sdlc-memory/                   ← Shared memory/knowledge base engine (Ktor + JGraphT)
├── shared/                        ← Shared utilities (viewer, configs)
├── scripts/                       ← Build & automation scripts
├── documents/                     ← Project documents (BRD, FSD, TDD per ticket)
└── .kiro/                         ← Agents, steering, hooks, settings
```

## Modules

| Module | Description | Tech | Version |
|--------|-------------|------|---------|
| [`kiro-sdlc-agents`](kiro-sdlc-agents/) | VS Code extension — 9 agents, KB UI panels, native binary management | TypeScript | 1.16.0 |
| [`mcp-code-intelligence-kotlin`](mcp-code-intelligence-kotlin/) | MCP server — FTS5, coroutines, NIO watcher, call graph | Kotlin, JDK 21+ | 0.7.0 |
| [`mcp-code-intelligence-nodejs`](mcp-code-intelligence-nodejs/) | MCP server — FTS5, ONNX embeddings, Tree-sitter AST, Salesforce Intelligence | Node.js 20+ | 0.7.0 |
| [`mcp-code-intelligence-python`](mcp-code-intelligence-python/) | MCP server — FTS5, zero external deps, stdlib sqlite3 | Python 3.11+ | 0.7.0 |
| [`mcp-salesforce-intelligence`](mcp-salesforce-intelligence/) | Shared Salesforce library — SFDX detection, Apex/Flow/Object parsers, SF types | Node.js 20+ | 2.1.0 |
| [`sdlc-memory`](sdlc-memory/) | Knowledge base engine — hybrid search, graph, embeddings | Kotlin, Ktor | 0.1.0 |

---

## Quick Start

### 1. Install Extension

```bash
cd kiro-sdlc-agents
npm install && npm run package
# Install .vsix in Kiro/VS Code
```

### 2. Inject Agents

Open any workspace → `Ctrl+Shift+P` → **"Kiro SDLC: Inject All Agents"**

The extension auto-starts the MCP server. You'll see "Running Port 9181" in the sidebar.

### 3. Start Working

Provide a Jira ticket key (e.g., `KSA-14`) → Scrum Master agent orchestrates the full pipeline.

```
@sm-agent KSA-14              → Full pipeline (BRD → FSD → TDD → Code → Test → Deploy)
@sm-agent KSA-14 tạo BRD     → Just create BRD
@sm-agent KSA-14 status      → Check current progress
```

### 4. Download Embedding Model (Optional)

`Ctrl+Shift+P` → **"Kiro SDLC: Download Embedding Model"**

| Model | Size | Languages |
|-------|------|-----------|
| `all-MiniLM-L6-v2` | 90MB | English (default, auto-downloaded) |
| `paraphrase-multilingual-MiniLM-L12-v2` | 470MB | 50+ languages (vi, zh, ja, ko...) |

---

## Agent Pipeline

<p align="center">
  <img src="kiro-sdlc-agents/resources/docs/diagrams/agent-pipeline.png" alt="Agent Pipeline" width="800">
</p>

| Agent | Role | Output |
|-------|------|--------|
| 🎯 **SM** | Scrum Master — orchestrates pipeline, manages Jira | STATUS.json, transitions |
| 📋 **BA** | Business Analyst — requirements & specifications | BRD.md, FSD.md |
| 🔧 **TA** | Technical Analyst — API contracts, pseudocode | FSD enrichment |
| 🏗️ **SA** | Solution Architect — technical design | TDD.md |
| 🧪 **QA** | Quality Assurance — test planning & execution | STP.md, STC.md |
| 💻 **DEV** | Developer — implementation & user guide | Source code, UG.md |
| 🚀 **DevOps** | Deployment & release | DPG.md, RLN.md |
| 🎨 **UI** | UI Designer — wireframes & mockups | Wireframes |
| 🔒 **Security** | Threat modeling & vulnerability assessment | Security report |

---

## Document Pipeline

<p align="center">
  <img src="kiro-sdlc-agents/resources/docs/diagrams/document-pipeline.png" alt="Document Pipeline" width="800">
</p>

Each Jira ticket produces a full document set:

```
documents/{TICKET}/
├── BRD.md          ← Business Requirements (Phase 1)
├── FSD.md          ← Functional Specification (Phase 2)
├── TDD.md          ← Technical Design (Phase 3)
├── STP.md          ← Software Test Plan (Phase 4)
├── STC.md          ← Software Test Cases (Phase 4)
├── UG.md           ← User Guide (Phase 5.5)
├── DPG.md          ← Deployment Guide (Phase 7)
├── RLN.md          ← Release Notes (Phase 7)
├── STATUS.json     ← Pipeline progress tracker
└── diagrams/       ← draw.io + PNG diagrams
```

---

## Knowledge Base UI

The extension provides **5 interactive panels** accessible from the sidebar:

| Panel | Description |
|-------|-------------|
| 📊 **Dashboard** | Health score, metrics, trends, recommendations |
| 🕸️ **Graph** | 3D force-directed knowledge graph with LOD clustering |
| 🏷️ **Tags** | Tag taxonomy, browse entries by tag |
| ⭐ **Quality** | Score distribution, confidence stats, low-quality entries |
| 📈 **Analytics** | Search volume trends, popular queries, knowledge gaps |

<p align="center">
  <img src="kiro-sdlc-agents/resources/docs/screenshots/kb-graph.png" alt="KB Graph" width="400">
  <img src="kiro-sdlc-agents/resources/docs/screenshots/kb-dashboard.png" alt="KB Dashboard" width="400">
</p>

---

## MCP Tools (60+)

All three server variants share the same tool set:

| Category | Tools | Description |
|----------|-------|-------------|
| **Core** | `code_search`, `code_symbols`, `code_context`, `code_modules` | FTS5 search, symbol lookup, source context |
| **Graph** | `code_callers`, `code_callees`, `code_traverse`, `code_impact`, `code_dependencies` | Call graph, blast radius, dependency analysis |
| **AI Context** | `get_ai_context`, `get_edit_context`, `get_curated_context` | Intent-aware context with token budgeting |
| **Similarity** | `find_duplicates`, `find_dead_code` | Near-duplicate detection, dead code analysis |
| **Git** | `git_search` | Semantic search over commit history |
| **Memory** | 30+ tools | Full KB management (ingest, search, graph, consolidate, lifecycle) |
| **Orchestration** | `find_tools`, `execute_dynamic_tool`, `toggle_tool` | Multi-server orchestration |
| **Utility** | `stream_write_file`, `drawio_auto_layout`, `code_kb_export` | File I/O, diagram layout, export |

---

## Salesforce Intelligence (KSA-191)

<p align="center">
  <img src="documents/KSA-191/diagrams/architecture.png" alt="SF Intelligence Architecture" width="800">
</p>

Full Salesforce Development Experience (SFDX) support — parse, index, and analyze Apex classes, Triggers, Flows, Custom Objects, and LWC components directly within the Code Intelligence pipeline.

### How It Works

<p align="center">
  <img src="documents/KSA-191/diagrams/component.png" alt="SF Component Diagram" width="800">
</p>

1. **Detect SFDX Project** — Auto-detects `sfdx-project.json` in workspace
2. **Parse Metadata** — Apex (Tree-sitter AST), Flow XML, Object XML, LWC HTML/JS
3. **Build Graph** — SF-specific relationships: Trigger→Object, Flow→Apex, LWC→Apex
4. **Index & Search** — All SF symbols searchable via `code_search`, `code_symbols`
5. **Impact Analysis** — `code_impact` covers SF dependency chains

### Supported Metadata Types

| Type | File Pattern | What's Extracted |
|------|-------------|-----------------|
| Apex Class | `*.cls` | Classes, methods, properties, annotations |
| Apex Trigger | `*.trigger` | Trigger name, object, events (before/after) |
| Flow | `*.flow-meta.xml` | Flow name, type, variables, decisions, actions |
| Custom Object | `*.object-meta.xml` | Object name, fields, record types, validation rules |
| LWC | `*.js` + `*.html` | Component name, public properties, wire methods |

### Usage

```bash
# Via extension command
Ctrl+Shift+P → "Kiro SDLC: Index Salesforce Project"

# The indexer automatically detects SFDX projects during workspace indexing
# SF stats appear in code_index_status output
```

### Indexing Flow

<p align="center">
  <img src="documents/KSA-191/diagrams/sequence-index-project.png" alt="SF Indexing Sequence" width="800">
</p>

### Enhanced Existing Tools

These existing tools now understand Salesforce metadata:

| Tool | SF Enhancement |
|------|---------------|
| `code_index_status` | Shows SFDX indexing stats (Apex classes, triggers, flows, objects) |
| `code_search` | Searches across Apex/Flow/Object symbols |
| `code_symbols` | Extracts Apex class/method/trigger symbols |
| `code_dependencies` | Includes SF metadata dependencies |
| `code_impact` | SF-aware blast radius (trigger→object→flow chains) |
| `code_callers` / `code_callees` | SF call graph (Apex method calls, trigger invocations) |

---

## Development

### Build MCP Server (Kotlin)

```bash
cd mcp-code-intelligence-kotlin
./gradlew shadowJar
# Output: build/libs/mcp-code-intelligence-latest.jar
```

### Build MCP Server (Node.js)

```bash
cd mcp-code-intelligence-nodejs
npm install && npm run build
node dist/index.js
```

### Build Extension

```bash
cd kiro-sdlc-agents
npm install && npm run compile
# F5 to launch Extension Development Host
```

### Run Tests

```bash
cd mcp-code-intelligence-kotlin && ./gradlew test
cd mcp-code-intelligence-nodejs && npm test
cd mcp-code-intelligence-python && python tests/test_extractor.py
```

---

## CI/CD

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `ci.yml` | PR | Build + test all modules |
| `publish.yml` | Tag push | Publish npm, PyPI, GitHub Release |
| `build-native.yml` | Manual/CI | Build platform-specific native binaries |
| `build-onnxruntime.yml` | Manual/CI | Build ONNX Runtime native addons |
| `auto-release.yml` | New prebuilds | Auto bump version + tag |
| `scheduled-prebuild-scan.yml` | Weekly cron | Detect missing binaries, trigger builds |

---

## Release

```bash
# Bump versions → commit → tag → push
git tag v1.16.0 -m "Release v1.16.0"
git push origin main --tags
```

See [Release & Versioning Rules](.kiro/steering/release-versioning.md) for full process.

---

## Trademarks

- "Kiro" is a trademark of Amazon Web Services, Inc. This project is designed to work with the Kiro IDE but is not affiliated with, endorsed by, or sponsored by Amazon.
- "Salesforce", "Apex", "SFDX", and "Lightning Web Components" are trademarks of Salesforce, Inc.
- "Jira" and "Atlassian" are trademarks of Atlassian Pty Ltd.
- All other trademarks are the property of their respective owners.

## License

MIT

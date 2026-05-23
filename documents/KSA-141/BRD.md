# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-141: Upgrade kiro-sdlc-agents Extension + First-Call Interactive Setup cho 3 MCP Servers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-141 |
| Title | Upgrade kiro-sdlc-agents Extension + First-Call Interactive Setup cho 3 MCP Servers |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-23 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | Duc Nguyen Minh – Technical Lead | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-23 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-141 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request upgrades the **kiro-sdlc-agents** VS Code extension to become a superset that bundles the full code-intelligence logic (currently in mcp-code-intelligence-nodejs) for in-process execution within Kiro IDE. Simultaneously, it introduces a **First-Call Interactive Setup** mechanism for the 3 standalone MCP servers (Node.js, Python, Kotlin) so that any MCP client (Claude Desktop, Cursor, Windsurf, Kiro CLI) can self-configure on first use without manual setup.

Key areas:
- Extract shared core logic into a reusable package consumed by both extension and MCP servers
- Bundle compiled JS from mcp-code-intelligence-nodejs into the extension for in-process execution
- Implement text-based interactive setup wizard via MCP protocol (resource/prompt mechanism)
- Maintain backward compatibility for all 3 standalone MCP servers
- Design for extensibility — support future AI agents beyond Kiro

### 1.2 Out of Scope

- Rewriting MCP servers in a different language (each stays in its native language)
- Changing the SDLC pipeline workflow logic (agents, steering, hooks remain unchanged)
- Creating a new MCP server variant (only upgrading existing ones)
- UI redesign of the VS Code extension beyond the setup wizard
- Authentication/authorization between MCP clients and servers
- Cloud deployment of MCP servers (remains local-only)

### 1.3 Preliminary Requirement

- mcp-code-intelligence-nodejs v0.6.0+ stable and tested
- kiro-sdlc-agents extension v1.8.1+ with existing MCP variant picker wizard
- Understanding of MCP protocol specification (2024-11-05) — resources, prompts, tools
- Node.js ≥20.0.0 runtime for bundled execution
- VS Code API ≥1.85.0 for extension host capabilities

---

## 2. Business Requirements

### 2.1 High Level Process Map

The upgrade follows a layered architecture approach: extract shared core → bundle into extension → add first-call setup to MCP servers → validate both modes work independently.

![Business Flow](diagrams/business-flow.png)

![Use Case Diagram](diagrams/use-case.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a Kiro IDE user, I want code-intelligence to run in-process (no separate MCP server) so that setup is zero-config and latency is minimal | MUST HAVE | KSA-141 |
| 2 | As a Claude Desktop user, I want the MCP server to guide me through setup on first tool call so that I don't need to manually edit config files | MUST HAVE | KSA-141 |
| 3 | As a developer, I want shared core logic in one package so that bug fixes propagate to both extension and MCP servers | MUST HAVE | KSA-141 |
| 4 | As a Cursor/Windsurf user, I want the standalone MCP server to work without any Kiro-specific dependencies so that I can use it with any AI agent | MUST HAVE | KSA-141 |
| 5 | As a developer maintaining the codebase, I want clear separation between extension-specific code, MCP-specific code, and shared core so that each can evolve independently | SHOULD HAVE | KSA-141 |
| 6 | As a user upgrading from standalone MCP to extension mode, I want my existing data (SQLite DB, memory entries) to be preserved and accessible | SHOULD HAVE | KSA-141 |
| 7 | As a CI/CD pipeline, I want to build and publish extension and MCP servers independently from the same monorepo | COULD HAVE | KSA-141 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User installs kiro-sdlc-agents extension in Kiro IDE (or VS Code with Kiro)

**Step 2:** Extension activates → detects workspace → initializes code-intelligence engine in-process (SQLite, indexer, memory, tools — all bundled JS)

**Step 3:** Agent invocations use in-process tool dispatch (no stdio/JSON-RPC overhead)

**Step 4:** Alternatively, user configures standalone MCP server (Node.js/Python/Kotlin) for external AI clients

**Step 5:** On first tool call to unconfigured MCP server → server returns setup prompt via MCP protocol

**Step 6:** AI client presents setup questions to user → user answers → server writes config and initializes

**Step 7:** Subsequent tool calls proceed normally with full functionality

> **Note:** Both modes (in-process extension and standalone MCP) share the same core logic and produce identical results. The only difference is the transport layer (direct function call vs. stdio JSON-RPC).

---

#### STORY 1: In-Process Code Intelligence in Extension

> As a Kiro IDE user, I want code-intelligence to run in-process (no separate MCP server) so that setup is zero-config and latency is minimal

**Requirement Details:**

1. Extension MUST bundle compiled JS from mcp-code-intelligence-nodejs core modules (db, indexer, memory, tools, query)
2. On extension activation, initialize DatabaseManager, IndexingEngine, MemoryEngine directly in extension host process
3. Tool dispatch happens via direct function call (no JSON-RPC serialization/deserialization)
4. Extension MUST NOT spawn a child process for MCP server when running in Kiro IDE
5. SQLite database stored in workspace `.code-intel/` directory (same location as standalone)
6. Background indexing starts automatically after workspace detection
7. Memory/KB operations available immediately without MCP client configuration

**Current Architecture (Before):**

```
Kiro IDE → MCP Client → stdio → MCP Server (separate process)
                                    ↓
                              SQLite + Indexer + Memory
```

**Target Architecture (After):**

```
Kiro IDE → Extension Host (in-process)
                ↓
          SQLite + Indexer + Memory (bundled JS)
```

**Acceptance Criteria:**

1. Extension activates and initializes code-intelligence within 3 seconds
2. All 40+ tools available via in-process dispatch (same tool definitions as MCP server)
3. No separate Node.js process spawned for code-intelligence
4. SQLite DB compatible between extension mode and standalone MCP mode (same schema)
5. Background indexing runs without blocking extension UI
6. Memory search returns results within 100ms for typical queries

---

#### STORY 2: First-Call Interactive Setup via MCP Protocol

> As a Claude Desktop user, I want the MCP server to guide me through setup on first tool call so that I don't need to manually edit config files

**Requirement Details:**

1. When MCP server receives first `tools/call` and no valid config exists → return a structured setup response instead of an error
2. Setup response uses MCP protocol mechanisms:
   - Return tool result with `isError: false` but content is a setup wizard prompt
   - Include clear instructions for the AI client to ask user questions
   - Provide a special `setup_configure` tool that accepts setup answers
3. Setup wizard collects:
   - Workspace root path (auto-detected from MCP initialize roots[] if available)
   - Embedding model preference (ONNX local / Ollama / none)
   - Viewer server port (default: 3000)
   - Orchestration config path (optional)
4. After setup completes → server writes config → re-initializes → confirms ready
5. Subsequent tool calls work normally

**Setup Flow:**

| Step | Server Action | Client Sees |
|------|--------------|-------------|
| 1 | Detect missing config | "Welcome! Let me help you set up..." |
| 2 | Present questions | List of config options with defaults |
| 3 | Receive answers via `setup_configure` tool | User provides answers |
| 4 | Write config + initialize | "✅ Setup complete! Ready to use." |
| 5 | Normal operation | All tools available |

**Data Fields (Setup Configuration):**

| Field | Type | Required | Description | Default |
|-------|------|----------|-------------|---------|
| workspace | String | Yes | Absolute path to workspace root | From MCP roots[0].uri |
| embedding_provider | Enum | No | ONNX / Ollama / none | ONNX |
| ollama_model | String | No | Ollama model name (if provider=Ollama) | nomic-embed-text |
| viewer_port | Number | No | HTTP viewer server port | 3000 |
| orchestration_config | String | No | Path to orchestration.json | null |
| auto_index | Boolean | No | Start background indexing on init | true |

**Acceptance Criteria:**

1. First tool call to unconfigured server returns setup prompt (not an error)
2. Setup wizard works with Claude Desktop, Cursor, and any MCP-compliant client
3. Setup completes in ≤3 interactions (questions → answers → confirmation)
4. Config persisted to `.code-intel/config.json` in workspace
5. Server fully functional after setup without restart
6. If config already exists, server initializes normally (no setup prompt)

---

#### STORY 3: Shared Core Package

> As a developer, I want shared core logic in one package so that bug fixes propagate to both extension and MCP servers

**Requirement Details:**

1. Extract core modules from mcp-code-intelligence-nodejs into a shared package:
   - `db/` — DatabaseManager, schema, migrations
   - `indexer/` — IndexingEngine, file scanning, content hashing
   - `memory/` — MemoryEngine, vectors, graph, conversation, scoring
   - `query/` — Search engine (BM25 + vector + graph hybrid)
   - `tools/` — Tool definitions and dispatch logic
   - `config.ts` — Configuration loading and validation
2. Shared package published as internal npm package or workspace package
3. Extension imports shared package and calls functions directly
4. MCP servers import shared package and wrap with JSON-RPC transport
5. Shared package has NO dependency on:
   - VS Code API (`vscode` module)
   - MCP SDK (`@modelcontextprotocol/sdk`)
   - readline / stdio (transport-specific)

**Package Structure:**

```
packages/
  code-intelligence-core/     ← Shared core (pure logic)
    src/
      db/
      indexer/
      memory/
      query/
      tools/
      config.ts
    package.json

  mcp-server-nodejs/          ← MCP transport wrapper
    src/
      index.ts               ← stdio JSON-RPC + core
    package.json

  kiro-extension/             ← VS Code extension wrapper
    src/
      extension.ts           ← VS Code API + core
    package.json
```

**Acceptance Criteria:**

1. Shared core package compiles independently (no external transport dependencies)
2. Both extension and MCP server import from shared core
3. Bug fix in core automatically available to both consumers after rebuild
4. Core package has ≥90% of current mcp-code-intelligence-nodejs logic
5. Transport-specific code (stdio, VS Code API) stays in respective wrappers
6. Existing tests pass against shared core package

---

#### STORY 4: Standalone MCP Servers for External Clients

> As a Cursor/Windsurf user, I want the standalone MCP server to work without any Kiro-specific dependencies so that I can use it with any AI agent

**Requirement Details:**

1. All 3 MCP servers (Node.js, Python, Kotlin) MUST remain fully functional standalone
2. No dependency on kiro-sdlc-agents extension being installed
3. No dependency on Kiro IDE or VS Code
4. Standard MCP protocol compliance (2024-11-05 spec)
5. Each server provides identical tool surface (40+ tools)
6. Configuration via environment variables OR config file OR first-call setup

**Supported MCP Clients:**

| Client | Transport | Config Location |
|--------|-----------|-----------------|
| Claude Desktop | stdio | claude_desktop_config.json |
| Cursor | stdio | .cursor/mcp.json |
| Windsurf | stdio | windsurf mcp config |
| Kiro CLI | stdio | .kiro/mcp.json |
| Any MCP client | stdio | Client-specific |

**Acceptance Criteria:**

1. `npx mcp-code-intelligence` works without any Kiro/VS Code installation
2. Python server: `uvx mcp-code-intelligence-python` works standalone
3. Kotlin server: `java -jar mcp-code-intelligence.jar` works standalone
4. All 3 servers pass MCP protocol compliance tests
5. No Kiro-specific branding or dependencies in standalone mode
6. README documents setup for each supported client

---

#### STORY 5: Clean Separation of Concerns

> As a developer maintaining the codebase, I want clear separation between extension-specific code, MCP-specific code, and shared core so that each can evolve independently

**Requirement Details:**

1. Monorepo structure with clear package boundaries
2. Each package has its own `package.json` / `build.gradle.kts` / `pyproject.toml`
3. Dependency direction: Extension → Core ← MCP Server (core has no upward deps)
4. Extension-specific: VS Code API, QuickPick UI, status bar, commands
5. MCP-specific: stdio transport, JSON-RPC handling, MCP SDK
6. Core: SQLite, indexing, memory, search, tool logic

**Acceptance Criteria:**

1. Changing extension UI code does NOT require rebuilding MCP server
2. Changing MCP transport code does NOT require rebuilding extension
3. Changing core logic requires rebuilding both (expected — shared dependency)
4. Each package can be tested independently
5. Clear documentation of package boundaries and responsibilities

---

#### STORY 6: Data Migration Between Modes

> As a user upgrading from standalone MCP to extension mode, I want my existing data (SQLite DB, memory entries) to be preserved and accessible

**Requirement Details:**

1. SQLite database schema identical between extension mode and MCP mode
2. `.code-intel/index.db` location unchanged regardless of mode
3. Memory entries, conversation history, knowledge graph preserved
4. No data migration script needed — same DB file works in both modes
5. If user switches between modes (extension ↔ standalone), data persists

**Acceptance Criteria:**

1. User with existing MCP server data can switch to extension mode without data loss
2. User with extension mode data can connect standalone MCP server to same workspace
3. Concurrent access handled gracefully (SQLite WAL mode)
4. No schema version conflicts between modes

---

#### STORY 7: Independent Build and Publish

> As a CI/CD pipeline, I want to build and publish extension and MCP servers independently from the same monorepo

**Requirement Details:**

1. GitHub Actions workflow builds each package independently
2. Extension published to VS Code Marketplace / Open VSX
3. Node.js MCP published to npm registry
4. Python MCP published to PyPI
5. Kotlin MCP published as GitHub Release (JAR)
6. Version bumps can be independent (core version pinned by consumers)

**Acceptance Criteria:**

1. `npm run build` in each package succeeds independently
2. CI/CD publishes correct artifacts to correct registries
3. Version matrix documented (which core version each consumer uses)
4. Breaking changes in core trigger rebuild of all consumers

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| mcp-code-intelligence-nodejs v0.6.0 | System | N/A | Source of core logic to extract |
| kiro-sdlc-agents v1.8.1 | System | N/A | Extension to upgrade |
| MCP Protocol Spec 2024-11-05 | External | N/A | Protocol compliance for first-call setup |
| better-sqlite3 | System | N/A | SQLite binding (must work in extension host) |
| onnxruntime-node | System | N/A | Embedding model (optional, must work in extension host) |
| VS Code Extension Host | System | N/A | Must support native modules (better-sqlite3) in extension |
| Node.js ≥20.0.0 | Infrastructure | N/A | Runtime for both extension and MCP server |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter / Owner | Duc Nguyen Minh | Feature owner, architecture decisions | Jira reporter |
| Technical Lead | Duc Nguyen Minh | Architecture review, implementation oversight | Jira reporter |
| End Users | Kiro IDE users | Primary consumers of extension mode | Target audience |
| End Users | Claude/Cursor/Windsurf users | Primary consumers of standalone MCP mode | Target audience |
| AI Agents | SM, BA, SA, QA, DEV, DevOps | Consumers of code-intelligence tools | System users |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Native modules (better-sqlite3) may not load in VS Code extension host | High | Medium | Test early; fallback to WASM-based SQLite if needed |
| onnxruntime-node binary size too large for extension bundle | Medium | Medium | Make ONNX optional; use Ollama or BM25-only as fallback |
| First-call setup may not work with all MCP clients (protocol interpretation varies) | High | Medium | Test with Claude Desktop, Cursor, Windsurf; provide manual config fallback |
| Shared core extraction breaks existing MCP server functionality | High | Low | Comprehensive test suite; incremental extraction with regression tests |
| Concurrent access to SQLite from extension + standalone MCP | Medium | Low | SQLite WAL mode handles this; document single-writer recommendation |
| Extension bundle size exceeds VS Code Marketplace limits (50MB) | Medium | Medium | Tree-shake; exclude optional deps; lazy-load heavy modules |
| Python/Kotlin MCP servers diverge from Node.js core over time | Medium | High | Define core API contract; automated cross-server compatibility tests |

### 5.2 Assumptions

- VS Code extension host supports native Node.js modules (better-sqlite3 compiles for electron)
- MCP protocol allows returning structured setup prompts as tool results (not just errors)
- All target MCP clients (Claude Desktop, Cursor, Windsurf) support the standard MCP tools/call flow
- Monorepo tooling (npm workspaces or turborepo) can manage the package structure
- Users accept that extension mode and standalone mode are mutually exclusive per workspace (not concurrent)
- The 3 MCP servers (Node.js, Python, Kotlin) will eventually converge on the same tool surface

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Extension initialization ≤3 seconds | From activation to tools-ready |
| Performance | In-process tool dispatch ≤50ms overhead | Compared to direct function call |
| Performance | First-call setup completes in ≤3 interactions | Questions → answers → ready |
| Reliability | Zero data loss on mode switch | Extension ↔ standalone preserves all data |
| Reliability | Graceful degradation if ONNX unavailable | Falls back to BM25-only search |
| Scalability | Extension handles workspaces up to 100K files | Same as standalone MCP server |
| Maintainability | Single source of truth for core logic | Shared package, no duplication |
| Compatibility | MCP Protocol 2024-11-05 compliant | All 3 servers pass compliance tests |
| Compatibility | VS Code ≥1.85.0 | Extension minimum version |
| Compatibility | Node.js ≥20.0.0 | Runtime requirement |
| Security | No secrets in config files | Config contains paths and preferences only |
| Bundle Size | Extension VSIX ≤30MB | Excluding optional ONNX model |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-141 | Upgrade kiro-sdlc-agents Extension + First-Call Interactive Setup | In Progress | Task | Main ticket |
| KSA-102 | MCP Orchestration Engine | Done | Task | Related — orchestration logic in shared core |
| KSA-139 | 2-Level Agent Tool Cache Registry | To Do | Task | Related — tool discovery optimization |
| KSA-140 | Refactor Steering Files Token Optimization | To Do | Task | Related — extension loads steering files |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — standard for AI agent ↔ tool server communication |
| Extension Host | VS Code process that runs extensions (separate from renderer) |
| In-Process | Running code directly in the same process (no IPC/stdio) |
| First-Call Setup | Interactive configuration triggered on first tool invocation |
| Shared Core | Package containing business logic shared between extension and MCP servers |
| stdio Transport | Standard input/output communication (JSON-RPC over stdin/stdout) |
| ONNX | Open Neural Network Exchange — format for embedding models |
| WAL Mode | SQLite Write-Ahead Logging — enables concurrent readers |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| MCP Protocol Specification | https://modelcontextprotocol.io/specification |
| Extension Source | kiro-sdlc-agents/src/ |
| Node.js MCP Source | mcp-code-intelligence-nodejs/src/ |
| Python MCP Source | mcp-code-intelligence-python/src/ |
| Kotlin MCP Source | mcp-code-intelligence-kotlin/src/ |
| Current Extension package.json | kiro-sdlc-agents/package.json |
| Current MCP package.json | mcp-code-intelligence-nodejs/package.json |

### Current Architecture Inventory

| Component | Language | Entry Point | Key Dependencies |
|-----------|----------|-------------|------------------|
| kiro-sdlc-agents | TypeScript | src/extension.ts | vscode API |
| mcp-code-intelligence-nodejs | TypeScript | src/index.ts | better-sqlite3, @modelcontextprotocol/sdk, onnxruntime-node |
| mcp-code-intelligence-python | Python | src/ | FastMCP, sqlite3 |
| mcp-code-intelligence-kotlin | Kotlin | src/ | kotlinx-serialization, sqlite-jdbc |

### Extension Current Capabilities (v1.8.1)

| Capability | Status | Notes |
|------------|--------|-------|
| Agent injection (agents, steering, hooks) | ✅ Active | Core feature |
| MCP variant picker wizard (QuickPick UI) | ✅ Active | Selects Node.js/Python/Kotlin |
| Workspace indexing command | ✅ Active | Triggers external indexer |
| Model download command | ✅ Active | Downloads ONNX embedding model |
| Status bar indicator | ✅ Active | Shows injection status |
| In-process code-intelligence | ❌ Not yet | **This ticket** |
| First-call MCP setup | ❌ Not yet | **This ticket** |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

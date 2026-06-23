# Functional Specification Document (FSD)

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
| Related BRD | BRD-v1-KSA-141.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Technical Reviewer | TA Agent – Technical Analyst | Enrich technical sections |
| Peer Reviewer | Duc Nguyen Minh – Technical Lead | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-23 | BA Agent | Initiate document — auto-generated from BRD KSA-141 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this FSD as expected requirements |
| | ☐ I agree and confirm all criteria on this FSD as expected requirements |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the upgraded **kiro-sdlc-agents** VS Code extension and the **First-Call Interactive Setup** mechanism for the 3 standalone MCP servers (Node.js, Python, Kotlin). It translates the business requirements from BRD KSA-141 into implementable functional specifications including use cases, data flows, API contracts, and processing logic.

### 1.2 Scope

- **In Scope:** Shared core package extraction, in-process extension execution, first-call setup wizard via MCP protocol, data migration between modes, independent build/publish pipeline
- **Out of Scope:** Rewriting MCP servers in different languages, cloud deployment, authentication between clients/servers, UI redesign beyond setup wizard

### 1.3 Definitions & Acronyms

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
| JSON-RPC | JSON Remote Procedure Call — protocol for MCP communication |
| QuickPick | VS Code UI component for selection dialogs |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-141.docx |
| MCP Protocol Specification | https://modelcontextprotocol.io/specification |
| VS Code Extension API | https://code.visualstudio.com/api |
| Current Extension Source | kiro-sdlc-agents/src/ |
| Current MCP Server Source | mcp-code-intelligence-nodejs/src/ |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The system operates in two modes:

1. **Extension Mode (In-Process):** Kiro IDE loads the extension which initializes code-intelligence engine directly in the extension host process. No external MCP server needed.

2. **Standalone MCP Mode:** External AI clients (Claude Desktop, Cursor, Windsurf) communicate with standalone MCP servers via stdio JSON-RPC transport.

**External Actors:**
- Kiro IDE User — uses extension mode (zero-config)
- Claude Desktop User — uses Node.js/Python MCP server
- Cursor/Windsurf User — uses any MCP server variant
- CI/CD Pipeline — builds and publishes packages independently
- Ollama Server — provides embedding models (optional)
- npm/PyPI/GitHub — package registries for distribution

### 2.2 System Architecture

The system follows a **layered architecture** with clear separation:

```
┌─────────────────────────────────────────────────────────┐
│                    Consumer Layer                         │
├──────────────────────┬──────────────────────────────────┤
│  kiro-extension      │  mcp-server-nodejs/python/kotlin │
│  (VS Code API)       │  (stdio JSON-RPC transport)      │
├──────────────────────┴──────────────────────────────────┤
│                 Shared Core Layer                         │
│  code-intelligence-core                                  │
│  ┌─────┬─────────┬────────┬───────┬───────┬──────────┐ │
│  │ db/ │indexer/ │memory/ │query/ │tools/ │ config   │ │
│  └─────┴─────────┴────────┴───────┴───────┴──────────┘ │
├─────────────────────────────────────────────────────────┤
│                 Infrastructure Layer                      │
│  SQLite (WAL) │ ONNX Runtime │ File System │ Ollama    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Functional Requirements

### 3.1 Feature: In-Process Code Intelligence Engine

**Source:** BRD Story 1

#### 3.1.1 Description

The kiro-sdlc-agents extension bundles compiled JavaScript from the shared core package and initializes the code-intelligence engine directly in the VS Code extension host process. This eliminates the need for a separate MCP server process when running in Kiro IDE, providing zero-config setup and minimal latency.

#### 3.1.2 Use Case

**Use Case ID:** UC-01
**Actor:** Kiro IDE User
**Preconditions:**
- Kiro IDE (or VS Code) installed with kiro-sdlc-agents extension
- Workspace folder open
- Node.js ≥20.0.0 available in extension host

**Postconditions:**
- Code-intelligence engine running in-process
- All 40+ tools available via direct function dispatch
- SQLite database initialized at `.code-intel/index.db`
- Background indexing started

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User | | Opens workspace in Kiro IDE |
| 2 | | Extension | Extension activates (onStartupFinished) |
| 3 | | Extension | Detects workspace root from `workspaceFolders[0]` |
| 4 | | Extension | Checks if `.code-intel/index.db` exists |
| 5 | | Core Engine | Initializes DatabaseManager (SQLite WAL mode) |
| 6 | | Core Engine | Initializes IndexingEngine with workspace root |
| 7 | | Core Engine | Initializes MemoryEngine (vectors + graph) |
| 8 | | Core Engine | Registers all 40+ tool handlers |
| 9 | | Extension | Updates status bar: "$(check) SDLC Agents + CI" |
| 10 | | Core Engine | Starts background file indexing (non-blocking) |
| 11 | User | | Invokes agent tool (e.g., search, memory) |
| 12 | | Extension | Dispatches tool call directly to core handler (no JSON-RPC) |
| 13 | | Core Engine | Executes tool logic, returns result |
| 14 | | Extension | Returns result to agent |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | ONNX model not downloaded | Skip vector initialization; use BM25-only search; show notification "Download embedding model for semantic search" |
| AF-02 | Existing DB from standalone MCP mode | Reuse existing `.code-intel/index.db` without migration |
| AF-03 | Extension already has MCP server configured | Offer choice: "Use in-process (faster)" or "Keep external MCP server" |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | better-sqlite3 native module fails to load | Log error; fall back to sql.js (WASM); show warning "Performance degraded — native SQLite unavailable" |
| EF-02 | Workspace has no write permission | Show error "Cannot initialize code-intelligence: workspace not writable"; disable engine |
| EF-03 | Initialization exceeds 10s timeout | Cancel init; show error; offer retry button |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | Extension MUST NOT spawn child process for code-intelligence in Kiro IDE mode | Story 1, AC 3 |
| BR-02 | SQLite DB schema MUST be identical between extension mode and standalone MCP mode | Story 1, AC 4 |
| BR-03 | Background indexing MUST NOT block extension UI thread | Story 1, AC 5 |
| BR-04 | Extension initialization MUST complete within 3 seconds | Story 1, AC 1 |
| BR-05 | In-process tool dispatch overhead MUST be ≤50ms compared to direct function call | NFR |
| BR-06 | If ONNX unavailable, system MUST gracefully degrade to BM25-only search | NFR |

#### 3.1.4 Data Specifications

**Input Data (Extension Activation):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| workspaceRoot | string | Yes | Must be absolute path, directory must exist | Root path of opened workspace |
| extensionPath | string | Yes | Must be absolute path | Path to extension installation |

**Output Data (Initialization Result):**

| Field | Type | Description |
|-------|------|-------------|
| engineReady | boolean | Whether core engine initialized successfully |
| toolCount | number | Number of registered tool handlers |
| dbPath | string | Absolute path to SQLite database |
| indexingStarted | boolean | Whether background indexing was triggered |
| embeddingAvailable | boolean | Whether ONNX/Ollama embedding is available |
| degradedMode | boolean | Whether running in degraded mode (BM25-only) |

#### 3.1.5 API Contract (Functional View)

> **Note:** In-process mode uses direct function calls, not HTTP/JSON-RPC. The "API" here is the internal dispatch interface.

**Tool Dispatch Interface:**

```typescript
interface ToolDispatcher {
  dispatch(toolName: string, args: Record<string, unknown>): Promise<ToolResult>;
  listTools(): ToolDefinition[];
  isReady(): boolean;
}

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
}
```

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Engine not initialized | "Code intelligence is starting up, please wait..." | Tool called before init completes |
| Tool not found | "Unknown tool: {name}" | Invalid tool name in dispatch |
| DB locked | "Database temporarily unavailable, retrying..." | Concurrent write conflict |
| Workspace not indexed | "Workspace not yet indexed. Indexing in progress..." | Search called before first index |

---

### 3.2 Feature: First-Call Interactive Setup via MCP Protocol

**Source:** BRD Story 2

#### 3.2.1 Description

When a standalone MCP server receives its first `tools/call` request and no valid configuration exists, it returns a structured setup response (not an error) that guides the AI client through interactive configuration. The setup uses MCP protocol mechanisms (tool results + a special `setup_configure` tool) to collect configuration from the user.

#### 3.2.2 Use Case

**Use Case ID:** UC-02
**Actor:** Claude Desktop User (or any MCP client user)
**Preconditions:**
- MCP server binary/package available (installed via npx/uvx/java -jar)
- MCP client configured to connect to server (stdio transport)
- No valid `.code-intel/config.json` exists in workspace

**Postconditions:**
- Configuration written to `.code-intel/config.json`
- Server fully initialized and ready for tool calls
- All subsequent tool calls work normally

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | AI Client | | Sends `initialize` request to MCP server |
| 2 | | MCP Server | Responds with capabilities (tools, resources) including `setup_configure` tool |
| 3 | AI Client | | Sends `tools/call` for any tool (e.g., `search_code`) |
| 4 | | MCP Server | Detects no valid config → returns setup prompt as tool result |
| 5 | | MCP Server | Result content: "Welcome! I need to set up first. Please provide..." |
| 6 | AI Client | | Presents setup questions to user |
| 7 | User | | Provides answers (workspace path, embedding preference, etc.) |
| 8 | AI Client | | Calls `setup_configure` tool with user answers |
| 9 | | MCP Server | Validates answers |
| 10 | | MCP Server | Writes `.code-intel/config.json` |
| 11 | | MCP Server | Initializes core engine with new config |
| 12 | | MCP Server | Returns "✅ Setup complete! {N} tools ready." |
| 13 | AI Client | | Retries original tool call |
| 14 | | MCP Server | Executes tool normally, returns result |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-04 | MCP `initialize` includes `roots[]` with workspace URI | Auto-detect workspace path; skip asking user for it |
| AF-05 | Config exists but is invalid/corrupted | Treat as missing config; run setup; overwrite invalid config |
| AF-06 | User provides partial answers (only required fields) | Use defaults for optional fields; proceed with setup |
| AF-07 | Server already configured (config.json exists and valid) | Skip setup entirely; initialize normally; process tool call |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-04 | User provides invalid workspace path | Return error in `setup_configure` result: "Path does not exist: {path}"; ask to retry |
| EF-05 | Ollama URL provided but unreachable | Warn: "Ollama unreachable, falling back to BM25-only"; continue setup |
| EF-06 | Cannot write config file (permission denied) | Return error: "Cannot write config to {path}. Check permissions." |
| EF-07 | Setup interrupted (client disconnects mid-setup) | No config written; next connection restarts setup from beginning |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-07 | First tool call to unconfigured server MUST return setup prompt, NOT an error | Story 2, AC 1 |
| BR-08 | Setup MUST complete in ≤3 interactions (prompt → answers → confirmation) | Story 2, AC 3 |
| BR-09 | Config MUST be persisted to `.code-intel/config.json` | Story 2, AC 4 |
| BR-10 | Server MUST be fully functional after setup WITHOUT restart | Story 2, AC 5 |
| BR-11 | Setup wizard MUST work with any MCP-compliant client | Story 2, AC 2 |
| BR-12 | If config already exists and is valid, server MUST skip setup entirely | Story 2, AC 6 |
| BR-13 | `setup_configure` tool MUST validate all inputs before writing config | Derived |

#### 3.2.4 Data Specifications

**Input Data (setup_configure tool):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| workspace | string | Yes | Absolute path; directory must exist; must be writable | Workspace root path |
| embedding_provider | enum | No | One of: "onnx", "ollama", "none" | Embedding model provider |
| ollama_url | string | No | Valid URL format; required if provider=ollama | Ollama server URL |
| ollama_model | string | No | Non-empty string; required if provider=ollama | Ollama embedding model name |
| viewer_port | number | No | Integer 1024-65535; must not conflict with known ports | HTTP viewer server port |
| auto_index | boolean | No | true/false | Start background indexing on init |
| orchestration_config | string | No | Valid file path or null | Path to orchestration.json |

**Output Data (Setup Response):**

| Field | Type | Description |
|-------|------|-------------|
| status | enum | "setup_required" / "setup_complete" / "setup_error" |
| message | string | Human-readable message for AI client to present |
| config_path | string | Path where config was written (on success) |
| tools_available | number | Number of tools ready after setup |
| workspace | string | Confirmed workspace path |
| embedding_mode | string | Active embedding mode description |

**Config File Schema (`.code-intel/config.json`):**

```json
{
  "version": 1,
  "workspace": "/absolute/path/to/workspace",
  "embedding": {
    "provider": "onnx|ollama|none",
    "ollama_url": "http://localhost:11434",
    "ollama_model": "nomic-embed-text",
    "onnx_model_path": ".code-intel/models/model.onnx"
  },
  "viewer": {
    "port": 3000,
    "enabled": true
  },
  "indexing": {
    "auto_index": true,
    "exclude_patterns": ["node_modules", ".git", "dist", "build"]
  },
  "orchestration_config": null,
  "created_at": "2026-05-23T12:00:00Z",
  "created_by": "first-call-setup"
}
```

#### 3.2.5 Setup Prompt Content

**Initial Setup Prompt (returned as tool result):**

```
🔧 Welcome to MCP Code Intelligence!

I need a quick setup before we start. Here's what I need:

1. **Workspace Path** (required): The root directory of your project
   ${auto_detected ? `Detected: ${roots[0].uri}` : "Please provide the absolute path"}

2. **Embedding Model** (optional, default: ONNX local):
   - "onnx" — Local ONNX model (fast, no external deps, ~50MB download)
   - "ollama" — Ollama server (requires running Ollama instance)
   - "none" — Keyword search only (no semantic search)

3. **Viewer Port** (optional, default: 3000): HTTP port for the web viewer

Please call the `setup_configure` tool with your preferences.
Example: setup_configure({ workspace: "/path/to/project", embedding_provider: "onnx" })
```

#### 3.2.6 API Contract (Functional View)

**Tool: `setup_configure`**

**Purpose:** Accept user configuration answers and initialize the MCP server

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| workspace | string | Yes | BR-09 | Absolute path to workspace root |
| embedding_provider | string | No | BR-06 | "onnx" / "ollama" / "none" |
| ollama_url | string | No | — | Ollama server URL |
| ollama_model | string | No | — | Ollama model name |
| viewer_port | number | No | — | HTTP viewer port |
| auto_index | boolean | No | — | Auto-start indexing |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| content[0].text | string | Setup result message |
| isError | boolean | false on success, true on validation failure |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Invalid workspace path | "❌ Path does not exist: {path}. Please provide a valid directory." | Directory not found |
| Path not writable | "❌ Cannot write to {path}. Check file permissions." | Permission denied |
| Ollama unreachable | "⚠️ Ollama at {url} is unreachable. Falling back to keyword search." | Connection refused/timeout |
| Port in use | "⚠️ Port {port} is in use. Using {alt_port} instead." | Port conflict detected |
| Setup already complete | "ℹ️ Already configured. Use `setup_reset` to reconfigure." | Config exists and valid |

---

### 3.3 Feature: Shared Core Package Extraction

**Source:** BRD Story 3

#### 3.3.1 Description

Extract core business logic from mcp-code-intelligence-nodejs into a standalone package (`code-intelligence-core`) that has NO dependency on VS Code API or MCP SDK. Both the extension and MCP servers import this package and wrap it with their respective transport layers.

#### 3.3.2 Use Case

**Use Case ID:** UC-03
**Actor:** Developer (maintaining codebase)
**Preconditions:**
- Monorepo structure established
- Core modules identified and extracted
- Build tooling configured (npm workspaces or turborepo)

**Postconditions:**
- Shared core package compiles independently
- Extension imports core and wraps with VS Code API
- MCP server imports core and wraps with stdio transport
- Bug fix in core propagates to both consumers

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Makes bug fix in `packages/code-intelligence-core/src/memory/search.ts` |
| 2 | Developer | | Runs `npm run build` in core package |
| 3 | | Build System | Compiles core TypeScript to JavaScript |
| 4 | | Build System | Runs core unit tests |
| 5 | Developer | | Runs `npm run build` in extension package |
| 6 | | Build System | Bundles extension with updated core dependency |
| 7 | Developer | | Runs `npm run build` in MCP server package |
| 8 | | Build System | Bundles MCP server with updated core dependency |
| 9 | | CI/CD | Both artifacts contain the fix |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-08 | Change is extension-only (VS Code UI) | Only rebuild extension; core and MCP server unchanged |
| AF-09 | Change is MCP-transport-only (JSON-RPC handling) | Only rebuild MCP server; core and extension unchanged |
| AF-10 | Breaking change in core API | Rebuild all consumers; update version; run integration tests |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-08 | Core package has accidental VS Code dependency | Build fails with "Cannot find module 'vscode'"; developer removes dependency |
| EF-09 | Core package has accidental MCP SDK dependency | Build fails; developer moves MCP-specific code to server package |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-14 | Core package MUST NOT import `vscode` module | Story 3, Story 5 |
| BR-15 | Core package MUST NOT import `@modelcontextprotocol/sdk` | Story 3, Story 5 |
| BR-16 | Core package MUST NOT import `readline` or stdio-specific modules | Story 3 |
| BR-17 | Core package MUST contain ≥90% of current mcp-code-intelligence-nodejs logic | Story 3, AC 4 |
| BR-18 | Core package MUST compile independently without external transport deps | Story 3, AC 1 |
| BR-19 | Existing tests MUST pass against shared core package | Story 3, AC 6 |

#### 3.3.4 Data Specifications

**Package Boundary Definition:**

| Module | Package | Responsibility |
|--------|---------|----------------|
| `db/` | core | DatabaseManager, schema, migrations, SQLite operations |
| `indexer/` | core | File scanning, content hashing, AST parsing, indexing |
| `memory/` | core | MemoryEngine, vectors, graph, conversation, scoring, lifecycle |
| `query/` | core | BM25 + vector + graph hybrid search |
| `tools/` | core | Tool definitions, dispatch logic, tool handlers |
| `config.ts` | core | Configuration loading, validation, defaults |
| `extension.ts` | extension | VS Code commands, status bar, QuickPick UI, activation |
| `injector.ts` | extension | File injection, checksum, update logic |
| `index.ts` | mcp-server | stdio transport, JSON-RPC handling, MCP SDK integration |
| `setup.ts` | mcp-server | First-call setup wizard logic |

---

### 3.4 Feature: Standalone MCP Servers for External Clients

**Source:** BRD Story 4

#### 3.4.1 Description

All 3 MCP servers (Node.js, Python, Kotlin) remain fully functional as standalone processes, independent of the kiro-sdlc-agents extension. They provide identical tool surfaces and work with any MCP-compliant client via stdio transport.

#### 3.4.2 Use Case

**Use Case ID:** UC-04
**Actor:** Cursor/Windsurf User
**Preconditions:**
- MCP server installed (npx/uvx/java -jar)
- MCP client configured with server command in its config file
- Workspace directory exists

**Postconditions:**
- MCP server running and responding to tool calls
- All 40+ tools available
- No Kiro/VS Code dependency required

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User | | Adds MCP server config to client config file |
| 2 | User | | Opens AI client (Cursor/Windsurf) |
| 3 | | AI Client | Spawns MCP server process via configured command |
| 4 | | MCP Server | Receives `initialize` request |
| 5 | | MCP Server | Checks for existing config (`.code-intel/config.json`) |
| 6 | | MCP Server | If config exists → initializes core engine |
| 7 | | MCP Server | Responds with `ServerCapabilities` (tools, resources) |
| 8 | | AI Client | Sends `tools/list` request |
| 9 | | MCP Server | Returns list of 40+ available tools |
| 10 | User | | Asks AI to perform code analysis |
| 11 | | AI Client | Calls appropriate tool via `tools/call` |
| 12 | | MCP Server | Dispatches to core engine, returns result |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-11 | No config exists on first connection | Trigger First-Call Setup (UC-02) |
| AF-12 | Config provided via environment variables | Use env vars instead of config file; skip setup |
| AF-13 | Multiple workspaces configured | Use `roots[]` from initialize to determine active workspace |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-10 | Server binary not found | Client shows "Failed to start MCP server"; user checks installation |
| EF-11 | Port conflict (viewer server) | Disable viewer; log warning; continue with tools only |
| EF-12 | SQLite DB corrupted | Delete and recreate DB; re-index workspace; warn user |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-20 | MCP servers MUST work without VS Code or Kiro IDE installed | Story 4, AC 1-3 |
| BR-21 | All 3 servers MUST provide identical tool surface (same tool names, same parameters) | Story 4 |
| BR-22 | Servers MUST pass MCP protocol compliance tests (2024-11-05 spec) | Story 4, AC 4 |
| BR-23 | No Kiro-specific branding in standalone mode | Story 4, AC 5 |
| BR-24 | Configuration via env vars OR config file OR first-call setup (3 methods) | Story 4 |

#### 3.4.4 Data Specifications

**MCP Client Configuration (per client):**

| Client | Config File | Format |
|--------|-------------|--------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) / `%APPDATA%\Claude\claude_desktop_config.json` (Windows) | JSON |
| Cursor | `.cursor/mcp.json` (workspace) or global | JSON |
| Windsurf | Windsurf MCP settings | JSON |
| Kiro CLI | `.kiro/settings/mcp.json` (workspace) | JSON |

**Server Config Entry (Node.js example):**

```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "npx",
      "args": ["mcp-code-intelligence@latest"],
      "env": {
        "CODE_INTEL_WORKSPACE": "/path/to/workspace"
      }
    }
  }
}
```

**Environment Variable Configuration:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| CODE_INTEL_WORKSPACE | Yes* | From MCP roots[] | Workspace root path |
| CODE_INTEL_EMBEDDING | No | "onnx" | Embedding provider |
| OLLAMA_URL | No | "http://localhost:11434" | Ollama server URL |
| OLLAMA_MODEL | No | "nomic-embed-text" | Ollama model name |
| CODE_INTEL_VIEWER_PORT | No | "3000" | Viewer HTTP port |
| CODE_INTEL_AUTO_INDEX | No | "true" | Auto-start indexing |

*Required only if MCP `initialize` doesn't provide `roots[]`

---

### 3.5 Feature: Clean Separation of Concerns (Monorepo Structure)

**Source:** BRD Story 5

#### 3.5.1 Description

The codebase is organized as a monorepo with clear package boundaries. Each package has its own build configuration, dependencies, and test suite. The dependency direction is strictly: Extension → Core ← MCP Server (core has no upward dependencies).

#### 3.5.2 Use Case

**Use Case ID:** UC-05
**Actor:** Developer (maintaining codebase)
**Preconditions:**
- Monorepo initialized with npm workspaces
- Package boundaries defined
- CI/CD configured for independent builds

**Postconditions:**
- Each package builds independently
- Tests run in isolation per package
- Changes in one consumer don't affect the other

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Modifies extension UI code (QuickPick dialog) |
| 2 | Developer | | Runs `npm run build -w packages/kiro-extension` |
| 3 | | Build System | Compiles only extension package |
| 4 | | Build System | MCP server package NOT rebuilt |
| 5 | | Build System | Core package NOT rebuilt |
| 6 | Developer | | Runs `npm test -w packages/kiro-extension` |
| 7 | | Test Runner | Runs extension-specific tests only |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-14 | Developer changes core API signature | Must rebuild both extension and MCP server; CI enforces this |
| AF-15 | Developer adds new tool to core | Core rebuild → extension rebuild → MCP server rebuild |

#### 3.5.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-25 | Changing extension UI code MUST NOT require rebuilding MCP server | Story 5, AC 1 |
| BR-26 | Changing MCP transport code MUST NOT require rebuilding extension | Story 5, AC 2 |
| BR-27 | Each package MUST be testable independently | Story 5, AC 4 |
| BR-28 | Dependency direction: Extension → Core ← MCP Server (no circular deps) | Story 5 |

#### 3.5.4 Data Specifications

**Monorepo Package Structure:**

```
kiro-sdlc-agents/                    ← Monorepo root
├── package.json                     ← Workspace config
├── packages/
│   ├── code-intelligence-core/      ← Shared core (pure logic)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── db/
│   │   │   ├── indexer/
│   │   │   ├── memory/
│   │   │   ├── query/
│   │   │   ├── tools/
│   │   │   └── config.ts
│   │   └── tests/
│   ├── kiro-extension/              ← VS Code extension
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── extension.ts
│   │   │   ├── injector.ts
│   │   │   ├── mcp-injector.ts
│   │   │   └── engine-bridge.ts    ← Bridges core to VS Code
│   │   └── tests/
│   └── mcp-server-nodejs/           ← MCP transport wrapper
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts            ← Entry point (stdio)
│       │   ├── transport.ts        ← JSON-RPC handling
│       │   └── setup.ts            ← First-call setup
│       └── tests/
├── mcp-server-python/               ← Python MCP (separate build)
│   ├── pyproject.toml
│   └── src/
└── mcp-server-kotlin/               ← Kotlin MCP (separate build)
    ├── build.gradle.kts
    └── src/
```

---

### 3.6 Feature: Data Migration Between Modes

**Source:** BRD Story 6

#### 3.6.1 Description

Users can switch between extension mode (in-process) and standalone MCP mode without data loss. The SQLite database schema is identical in both modes, and the `.code-intel/index.db` file is shared.

#### 3.6.2 Use Case

**Use Case ID:** UC-06
**Actor:** User upgrading from standalone MCP to extension mode
**Preconditions:**
- User has existing data from standalone MCP server (`.code-intel/index.db` with memory entries, indexed files)
- User installs kiro-sdlc-agents extension in Kiro IDE

**Postconditions:**
- All existing data accessible in extension mode
- No data migration script needed
- Memory entries, conversation history, knowledge graph preserved

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User | | Installs kiro-sdlc-agents extension |
| 2 | User | | Opens workspace (same workspace used with standalone MCP) |
| 3 | | Extension | Activates and detects `.code-intel/index.db` |
| 4 | | Extension | Opens existing DB (no migration needed) |
| 5 | | Extension | Verifies schema version matches expected |
| 6 | | Extension | All existing data available immediately |
| 7 | User | | Uses memory search → finds existing entries |
| 8 | User | | Uses code search → finds existing index |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-16 | DB schema version is older than expected | Run forward migrations automatically; preserve all data |
| AF-17 | User switches back to standalone MCP | Standalone server opens same DB file; works immediately |
| AF-18 | Both extension and standalone running simultaneously | SQLite WAL mode handles concurrent reads; warn about concurrent writes |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-13 | DB schema version is newer (downgrade scenario) | Show error: "Database was created by a newer version. Please update extension." |
| EF-14 | DB file locked by another process | Retry with exponential backoff (3 attempts); if still locked, show error |
| EF-15 | DB file corrupted | Offer: "Database corrupted. Delete and re-index?" with confirmation |

#### 3.6.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-29 | SQLite DB schema MUST be identical between extension and MCP modes | Story 6, AC 1-2 |
| BR-30 | `.code-intel/index.db` location MUST NOT change regardless of mode | Story 6 |
| BR-31 | No data migration script needed — same DB file works in both modes | Story 6, AC 3 |
| BR-32 | Concurrent access MUST be handled via SQLite WAL mode | Story 6, AC 3 |
| BR-33 | Schema version MUST be tracked in DB for forward migration support | Derived |

---

### 3.7 Feature: Independent Build and Publish Pipeline

**Source:** BRD Story 7

#### 3.7.1 Description

Each package in the monorepo can be built and published independently via GitHub Actions. The extension goes to VS Code Marketplace, Node.js MCP to npm, Python MCP to PyPI, and Kotlin MCP as GitHub Release JAR.

#### 3.7.2 Use Case

**Use Case ID:** UC-07
**Actor:** CI/CD Pipeline (GitHub Actions)
**Preconditions:**
- Code merged to main branch
- Version bumped in respective package.json / pyproject.toml / build.gradle.kts
- CI secrets configured (npm token, VS Code Marketplace token, PyPI token)

**Postconditions:**
- Correct artifact published to correct registry
- Version tagged in git
- Release notes generated

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Merges PR to main with version bump |
| 2 | | GitHub Actions | Detects changed packages |
| 3 | | GitHub Actions | Builds core package first (dependency) |
| 4 | | GitHub Actions | Runs core tests |
| 5 | | GitHub Actions | Builds changed consumer packages in parallel |
| 6 | | GitHub Actions | Runs consumer-specific tests |
| 7 | | GitHub Actions | Publishes artifacts to respective registries |
| 8 | | GitHub Actions | Creates git tag for released version |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-19 | Only extension changed (no core change) | Build and publish extension only; skip MCP servers |
| AF-20 | Core changed (breaking) | Build and publish all packages; bump major version |
| AF-21 | Python/Kotlin MCP changed | Build and publish respective package only |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-16 | Publish to npm fails (network/auth) | Retry 3 times; if still fails, alert maintainer |
| EF-17 | Extension VSIX exceeds 50MB limit | Build fails; developer must reduce bundle size |
| EF-18 | Tests fail in CI | Block publish; notify developer |

#### 3.7.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-34 | Each package MUST build independently with `npm run build` | Story 7, AC 1 |
| BR-35 | CI/CD MUST publish correct artifacts to correct registries | Story 7, AC 2 |
| BR-36 | Version matrix MUST be documented (which core version each consumer uses) | Story 7, AC 3 |
| BR-37 | Breaking changes in core MUST trigger rebuild of all consumers | Story 7, AC 4 |
| BR-38 | Extension VSIX MUST be ≤30MB (excluding optional ONNX model) | NFR |

#### 3.7.4 Data Specifications

**Publish Matrix:**

| Package | Registry | Command | Artifact |
|---------|----------|---------|----------|
| code-intelligence-core | npm | `npm publish` | @kiro/code-intelligence-core |
| kiro-extension | VS Code Marketplace + Open VSX | `vsce publish` + `ovsx publish` | kiro-sdlc-agents.vsix |
| mcp-server-nodejs | npm | `npm publish` | mcp-code-intelligence |
| mcp-server-python | PyPI | `twine upload` | mcp-code-intelligence-python |
| mcp-server-kotlin | GitHub Releases | `gh release create` | mcp-code-intelligence-latest.jar |

---

## 4. Data Model

> **Note:** This section defines the logical data model (entities, relationships, business attributes). Physical implementation (DDL scripts, indexes, migration plans) is specified in the TDD §4.

### 4.1 Entity Relationship Diagram

![ER Diagram](diagrams/er-diagram.png)

### 4.2 Logical Entities

#### Entity: Configuration

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | UUID | Yes | — | Unique config identifier |
| version | integer | Yes | BR-33 | Schema version for migration |
| workspace | string | Yes | BR-09 | Absolute workspace root path |
| embedding_provider | enum | Yes | BR-06 | "onnx" / "ollama" / "none" |
| ollama_url | string | No | — | Ollama server URL |
| ollama_model | string | No | — | Ollama model name |
| viewer_port | integer | No | — | HTTP viewer port |
| auto_index | boolean | Yes | — | Auto-start indexing flag |
| created_at | datetime | Yes | — | Config creation timestamp |
| created_by | string | Yes | — | "first-call-setup" / "extension" / "env-vars" |

#### Entity: IndexedFile

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | integer | Yes | — | Auto-increment primary key |
| file_path | string | Yes | — | Relative path from workspace root |
| content_hash | string | Yes | — | SHA-256 hash of file content |
| language | string | No | — | Detected programming language |
| last_indexed | datetime | Yes | — | Last indexing timestamp |
| symbol_count | integer | No | — | Number of symbols extracted |

#### Entity: MemoryEntry

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | integer | Yes | — | Auto-increment primary key |
| content | text | Yes | — | Full entry content |
| summary | string | No | — | Brief summary |
| type | enum | Yes | — | DECISION / ERROR_PATTERN / ARCHITECTURE / etc. |
| tier | enum | Yes | — | WORKING / EPISODIC / SEMANTIC / PROCEDURAL |
| tags | string | No | — | Comma-separated tags |
| created_at | datetime | Yes | — | Creation timestamp |
| updated_at | datetime | Yes | — | Last update timestamp |
| embedding | blob | No | BR-06 | Vector embedding (if available) |

#### Entity: ToolDefinition

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| name | string | Yes | BR-21 | Unique tool name (e.g., "mem_search") |
| description | string | Yes | — | Tool description for AI clients |
| input_schema | JSON | Yes | — | JSON Schema for tool parameters |
| handler_module | string | Yes | — | Core module that handles this tool |
| category | string | No | — | Tool category (memory, search, code, admin) |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| Configuration | IndexedFile | 1:N | One config per workspace, many indexed files |
| Configuration | MemoryEntry | 1:N | One config per workspace, many memory entries |
| MemoryEntry | MemoryEntry | M:N | Knowledge graph edges between entries |
| ToolDefinition | — | — | Standalone; registered at initialization |

---

## 5. Integration Specifications

> **Note:** This section defines what external systems are involved and what data is exchanged (business view). Technical details (timeout, retry, circuit breaker) are specified in the TDD §6.

### 5.1 External System: VS Code Extension Host

| Attribute | Value |
|-----------|-------|
| Purpose | Host environment for in-process code-intelligence engine |
| Direction | Bidirectional |
| Data Format | Direct function calls (TypeScript) |
| Frequency | Real-time (on every tool invocation) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Tool results | Agent requests | Receive → Process → Send | BR-04 (≤3s init) |
| Status updates | Status bar API | Send | — |
| Commands | Command palette | Receive | — |

### 5.2 External System: MCP Client (Claude Desktop / Cursor / Windsurf)

| Attribute | Value |
|-----------|-------|
| Purpose | AI client that invokes tools via MCP protocol |
| Direction | Bidirectional (stdio) |
| Data Format | JSON-RPC 2.0 over stdin/stdout |
| Frequency | Real-time (on every tool invocation) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Tool results (JSON) | tools/call requests | Receive → Process → Send | BR-22 (MCP compliant) |
| Tool definitions | tools/list requests | Send | BR-21 (identical surface) |
| Setup prompt | First tool call (unconfigured) | Send | BR-07 |
| Server capabilities | initialize request | Send | — |

### 5.3 External System: Ollama Server

| Attribute | Value |
|-----------|-------|
| Purpose | Provides embedding vectors for semantic search |
| Direction | Outbound (HTTP) |
| Data Format | JSON (REST API) |
| Frequency | On-demand (when embedding text for search/ingest) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Text to embed | POST /api/embeddings | Send | BR-06 (graceful degradation) |
| Embedding vector | Response body | Receive | — |
| Model list | GET /api/tags | Receive | — |

### 5.4 External System: npm / PyPI / GitHub Releases

| Attribute | Value |
|-----------|-------|
| Purpose | Package distribution registries |
| Direction | Outbound (publish) |
| Data Format | Package archives (tgz, whl, jar) |
| Frequency | On release (CI/CD triggered) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Package artifact | Registry API | Send (publish) | BR-35 |
| Version metadata | Registry response | Receive (verify) | BR-36 |

### 5.5 External System: File System

| Attribute | Value |
|-----------|-------|
| Purpose | Workspace files for indexing; SQLite DB storage; config persistence |
| Direction | Bidirectional |
| Data Format | Files (source code, JSON, SQLite binary) |
| Frequency | Continuous (file watching for index updates) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Index updates | File change events | Receive → Process | BR-03 (non-blocking) |
| Config JSON | `.code-intel/config.json` | Read/Write | BR-09 |
| SQLite DB | `.code-intel/index.db` | Read/Write | BR-30 |

---

## 6. Processing Logic

### 6.1 Extension Activation & Engine Initialization

**Trigger:** VS Code extension activation event (onStartupFinished)
**Schedule:** Once per workspace session
**Input:** workspaceRoot, extensionPath
**Output:** Initialized engine with all tools registered

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Get workspace root from `workspaceFolders[0]` | If no workspace → show error, abort |
| 2 | Check `.code-intel/` directory exists | If not → create directory |
| 3 | Initialize DatabaseManager (open/create SQLite DB) | If native module fails → fall back to sql.js WASM |
| 4 | Run pending schema migrations | If migration fails → log error, abort init |
| 5 | Initialize IndexingEngine | If fails → continue without indexing |
| 6 | Check ONNX model availability | If not available → set degradedMode=true |
| 7 | Initialize MemoryEngine (with or without vectors) | If fails → abort init |
| 8 | Register all tool handlers from core | If any handler fails → skip that tool, log warning |
| 9 | Update status bar indicator | — |
| 10 | Start background file indexing (async) | If fails → log warning, continue |
| 11 | Emit "engine-ready" event | — |

**State Diagram:**

![Extension Lifecycle](diagrams/state-extension-lifecycle.png)

### 6.2 First-Call Setup Flow

**Trigger:** First `tools/call` request when no valid config exists
**Schedule:** Once per workspace (until config is written)
**Input:** MCP `tools/call` request
**Output:** Config file written + engine initialized

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Receive `tools/call` request | — |
| 2 | Check `isConfigured()` flag | If true → proceed to normal dispatch |
| 3 | Check `.code-intel/config.json` exists and valid | If exists → load config, set configured=true, retry step 2 |
| 4 | Build setup prompt message | — |
| 5 | Return setup prompt as tool result (isError: false) | — |
| 6 | Wait for `setup_configure` tool call | — |
| 7 | Validate all input fields | If invalid → return error result with specific message |
| 8 | Write config to `.code-intel/config.json` | If write fails → return permission error |
| 9 | Initialize core engine with new config | If init fails → delete config, return error |
| 10 | Set `isConfigured = true` | — |
| 11 | Return success message with tool count | — |

**Sequence Diagram:**

![First-Call Setup Sequence](diagrams/sequence-first-call-setup.png)

### 6.3 Tool Dispatch (In-Process vs MCP)

**Trigger:** Tool invocation from agent/client
**Input:** Tool name + arguments
**Output:** Tool result

**In-Process Dispatch (Extension Mode):**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Receive tool name + args from agent | — |
| 2 | Look up handler in tool registry | If not found → return "Unknown tool" error |
| 3 | Validate args against tool's input schema | If invalid → return validation error |
| 4 | Call handler function directly | If throws → catch, return error result |
| 5 | Return result to agent | — |

**MCP Dispatch (Standalone Mode):**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Receive JSON-RPC `tools/call` via stdin | If malformed → return JSON-RPC error |
| 2 | Parse tool name and arguments from request | — |
| 3 | Check `isConfigured()` | If false → return setup prompt |
| 4 | Look up handler in tool registry | If not found → return "Unknown tool" error |
| 5 | Validate args against tool's input schema | If invalid → return validation error |
| 6 | Call handler function | If throws → catch, return error result |
| 7 | Serialize result to JSON-RPC response | — |
| 8 | Write response to stdout | — |

### 6.4 Background Indexing

**Trigger:** Engine initialization OR file change event
**Schedule:** Continuous (file watcher) + initial full scan
**Input:** Workspace file system
**Output:** Updated index in SQLite DB

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Scan workspace for source files (respecting exclude patterns) | If scan fails → log error, skip |
| 2 | Compute content hash for each file | — |
| 3 | Compare with stored hash in DB | — |
| 4 | For changed/new files: parse AST, extract symbols | If parse fails → skip file, log warning |
| 5 | Update IndexedFile records in DB | If DB write fails → retry once |
| 6 | If embedding available: compute vectors for new content | If embedding fails → skip vectors |
| 7 | Update FTS5 full-text index | — |
| 8 | Emit "indexing-complete" event | — |

---

## 7. Security Requirements

> **Note:** This section defines business-level security requirements. Technical implementation (encryption algorithms, input validation rules) is specified in the TDD §7.

### 7.1 Authentication & Authorization

| Role | Permissions | Features |
|------|-------------|----------|
| Extension User | Full access to all tools | All code-intelligence features via in-process |
| MCP Client | Full access to all tools (after setup) | All tools via stdio transport |
| CI/CD Pipeline | Build + publish | Package compilation and registry publish |

> **Note:** No authentication between MCP client and server (local-only, same-machine communication via stdio). Security boundary is the OS process isolation.

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Source code (indexed) | Internal | Stays on local machine; never transmitted externally |
| SQLite database | Internal | Contains code index + memory; local storage only |
| Configuration (config.json) | Internal | Contains paths and preferences; no secrets |
| Embedding vectors | Internal | Derived from source code; local storage only |
| Memory entries | Internal | User-created knowledge; local storage only |
| npm/PyPI tokens (CI) | Restricted | Used only in CI; stored as GitHub Secrets |

### 7.3 Audit Trail

| Event | Logged Fields | Retention | Business Reason |
|-------|--------------|-----------|-----------------|
| Tool invocation | tool_name, timestamp, duration_ms | Session | Performance monitoring |
| Setup completion | workspace, provider, timestamp | Permanent (in config) | Configuration tracking |
| Indexing run | files_scanned, files_updated, duration | Session | Debugging |
| Error occurrence | error_type, message, stack_trace | Session | Troubleshooting |

---

## 8. Non-Functional Requirements

> **Note:** This section defines business-level NFR targets. Technical implementation is specified in the TDD §8–§9.

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Extension initializes quickly | Engine ready within 3 seconds of activation |
| Performance | Tool dispatch is fast | In-process dispatch ≤50ms overhead |
| Performance | Search is responsive | Memory search returns within 100ms for typical queries |
| Performance | Setup is quick | First-call setup completes in ≤3 interactions |
| Reliability | No data loss on mode switch | Extension ↔ standalone preserves all data |
| Reliability | Graceful degradation | If ONNX unavailable, falls back to BM25-only |
| Reliability | Crash recovery | DB in WAL mode; no corruption on unexpected exit |
| Scalability | Large workspaces | Handles workspaces up to 100K files |
| Scalability | Large memory stores | Handles up to 10K memory entries without degradation |
| Maintainability | Single source of truth | Core logic in one package; no duplication |
| Maintainability | Independent builds | Each package builds in ≤60 seconds |
| Compatibility | MCP Protocol | All 3 servers pass MCP 2024-11-05 compliance tests |
| Compatibility | VS Code version | Extension works on VS Code ≥1.85.0 |
| Compatibility | Node.js version | Runtime requires Node.js ≥20.0.0 |
| Compatibility | Cross-platform | Works on Windows, macOS, Linux |
| Bundle Size | Extension size | VSIX ≤30MB (excluding optional ONNX model) |
| Bundle Size | ONNX model | Optional download ~50MB (not bundled) |

---

## 9. Error Handling (User-Facing)

> **Note:** This section defines user-facing error scenarios. Technical logging specifications are in the TDD §9.

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Native SQLite module fails to load | Warning | "Using fallback SQLite (slower). Install native module for better performance." | Degrade to WASM; all features work |
| ONNX model not found | Info | "Semantic search unavailable. Download model for better results." | BM25-only search; offer download command |
| Workspace not writable | Critical | "Cannot initialize: workspace is read-only." | Disable engine; show error in status bar |
| DB locked by another process | Warning | "Database busy. Retrying..." | Retry 3 times with backoff; if fails, show error |
| Ollama server unreachable | Warning | "Ollama unreachable. Using keyword search only." | Fall back to BM25; continue normally |
| Extension init timeout (>10s) | Critical | "Code intelligence failed to start. Click to retry." | Show retry button in notification |
| MCP server crash | Critical | "MCP server stopped unexpectedly." | Client may auto-restart; log crash reason |
| Config file corrupted | Warning | "Configuration invalid. Running setup again..." | Delete invalid config; trigger first-call setup |
| Disk space insufficient | Critical | "Not enough disk space for database." | Abort init; show error |
| Port conflict (viewer) | Warning | "Port {N} in use. Viewer disabled." | Disable viewer; tools still work |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Engine ready | Extension user | Status bar update | Immediate |
| ONNX model missing | Extension user | VS Code notification | On first search |
| Setup complete | MCP client user | Tool result message | Immediate |
| Indexing complete | Extension user | Status bar update | After indexing |
| Upgrade available | Extension user | VS Code notification | On activation |
| Build failure | Developer | GitHub Actions notification | On CI failure |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Extension activates and initializes engine | Open workspace | Engine ready within 3s, status bar shows "✅" | High |
| TC-02 | In-process tool dispatch works | Call `mem_search` with query | Returns search results (no JSON-RPC overhead) | High |
| TC-03 | First-call setup returns prompt | Call any tool on unconfigured server | Setup prompt returned (not error) | High |
| TC-04 | setup_configure writes config | Valid workspace + preferences | Config written, engine initialized | High |
| TC-05 | Invalid workspace path rejected | Non-existent path | Error message with specific path | High |
| TC-06 | Standalone MCP works without VS Code | npx mcp-code-intelligence | Server starts, responds to tools/list | High |
| TC-07 | Data preserved on mode switch | Use standalone → switch to extension | All memory entries accessible | High |
| TC-08 | Core package builds independently | `npm run build` in core | Compiles without vscode/mcp deps | Medium |
| TC-09 | Extension builds independently | `npm run build` in extension | Compiles with core dependency | Medium |
| TC-10 | ONNX fallback to BM25 | Remove ONNX model file | Search still works (keyword only) | Medium |
| TC-11 | Concurrent DB access (WAL) | Extension + standalone same workspace | Both can read; no corruption | Medium |
| TC-12 | Background indexing non-blocking | Large workspace (10K files) | UI remains responsive during indexing | Medium |
| TC-13 | CI publishes extension to Marketplace | Push tag to main | VSIX published successfully | Low |
| TC-14 | CI publishes MCP to npm | Push tag to main | Package published to npm | Low |
| TC-15 | Extension VSIX ≤30MB | Build extension | VSIX file size check | Low |

---

## 11. State Diagrams

### 11.1 Extension Engine Lifecycle

![Extension Lifecycle State](diagrams/state-extension-lifecycle.png)

**States:**
- **Inactive** — Extension not yet activated
- **Initializing** — Engine starting up (DB, indexer, memory)
- **Ready** — All tools available, engine fully operational
- **Degraded** — Running without ONNX (BM25-only) or without native SQLite
- **Error** — Initialization failed; retry available
- **Disposed** — Extension deactivated (workspace closed)

**Transitions:**
- Inactive → Initializing: Extension activation event
- Initializing → Ready: All components initialized successfully
- Initializing → Degraded: Some components failed (ONNX, native SQLite)
- Initializing → Error: Critical failure (DB, workspace)
- Ready → Disposed: Extension deactivation
- Degraded → Disposed: Extension deactivation
- Error → Initializing: User clicks retry
- Ready → Degraded: Runtime failure (Ollama disconnects)
- Degraded → Ready: Missing component becomes available (model downloaded)

### 11.2 MCP Server Lifecycle

![MCP Server Lifecycle State](diagrams/state-mcp-server-lifecycle.png)

**States:**
- **Started** — Process spawned, waiting for initialize
- **Unconfigured** — No valid config; returns setup prompts
- **Configuring** — Setup in progress (received setup_configure)
- **Ready** — Fully configured and operational
- **Error** — Configuration or initialization failed

**Transitions:**
- Started → Unconfigured: No config.json found after initialize
- Started → Ready: Valid config.json found; engine initialized
- Unconfigured → Configuring: Received setup_configure call
- Configuring → Ready: Config validated, written, engine initialized
- Configuring → Unconfigured: Validation failed; user must retry
- Ready → Error: Runtime error (DB corruption, etc.)
- Error → Unconfigured: Config deleted; restart setup

---

## 12. Appendix

### 12.1 Diagrams

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence: First-Call Setup | [sequence-first-call-setup.png](diagrams/sequence-first-call-setup.png) | [sequence-first-call-setup.drawio](diagrams/sequence-first-call-setup.drawio) |
| 3 | State: Extension Lifecycle | [state-extension-lifecycle.png](diagrams/state-extension-lifecycle.png) | [state-extension-lifecycle.drawio](diagrams/state-extension-lifecycle.drawio) |
| 4 | State: MCP Server Lifecycle | [state-mcp-server-lifecycle.png](diagrams/state-mcp-server-lifecycle.png) | [state-mcp-server-lifecycle.drawio](diagrams/state-mcp-server-lifecycle.drawio) |
| 5 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |

### 12.2 Change Log from BRD

| Item | BRD Statement | FSD Clarification |
|------|---------------|-------------------|
| Setup interactions | "≤3 interactions" | Defined as: prompt → configure → confirmation (exactly 3 steps max) |
| Tool count | "40+ tools" | Exact count depends on core version; minimum 40 guaranteed |
| ONNX model size | "~50MB" | Not bundled in VSIX; separate download command |
| Concurrent access | "SQLite WAL mode" | Single-writer recommendation; concurrent reads safe |
| Python/Kotlin servers | "Same tool surface" | Tool names and schemas identical; implementation language differs |

### 12.3 Technical Enrichment (TA Review)

#### TA-1: Detailed API Contract — setup_configure Tool (MCP JSON-RPC)

**JSON-RPC Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "setup_configure",
    "arguments": {
      "workspace": "/home/user/my-project",
      "embedding_provider": "onnx",
      "viewer_port": 3000,
      "auto_index": true
    }
  }
}
```

**JSON-RPC Response (Success):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "✅ Setup complete!\n\nWorkspace: /home/user/my-project\nEmbedding: ONNX (local)\nViewer: http://localhost:3000\nTools: 42 available\n\nYou can now use any tool. Try: mem_search, code_search, code_symbols"
      }
    ],
    "isError": false
  }
}
```

**JSON-RPC Response (Validation Error):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "❌ Setup failed: Path '/invalid/path' does not exist.\n\nPlease call setup_configure again with a valid workspace path."
      }
    ],
    "isError": true
  }
}
```

#### TA-2: Pseudocode — Engine Initialization (Critical Path)

```typescript
async function initializeEngine(config: Config): Promise<EngineState> {
  const state: EngineState = { status: 'initializing', tools: [], degraded: false };
  
  // Step 1: Database (CRITICAL — must succeed)
  try {
    state.db = await DatabaseManager.open(config.workspace + '/.code-intel/index.db', {
      mode: 'wal',
      nativeModule: 'better-sqlite3'
    });
    await state.db.runMigrations();
  } catch (nativeError) {
    // Fallback to WASM
    try {
      state.db = await DatabaseManager.open(config.workspace + '/.code-intel/index.db', {
        mode: 'wal',
        nativeModule: 'sql.js'
      });
      await state.db.runMigrations();
      state.degraded = true;
      log.warn('Using WASM SQLite fallback — performance degraded');
    } catch (wasmError) {
      state.status = 'error';
      throw new InitializationError('Cannot open database', wasmError);
    }
  }
  
  // Step 2: Embedding (OPTIONAL — graceful degradation)
  if (config.embedding.provider === 'onnx') {
    try {
      state.embedder = await OnnxEmbedder.load(config.embedding.onnx_model_path);
    } catch {
      state.embedder = null;
      state.degraded = true;
      log.info('ONNX model not available — using BM25-only search');
    }
  } else if (config.embedding.provider === 'ollama') {
    try {
      state.embedder = await OllamaEmbedder.connect(config.embedding.ollama_url, config.embedding.ollama_model);
    } catch {
      state.embedder = null;
      state.degraded = true;
      log.warn('Ollama unreachable — using BM25-only search');
    }
  }
  
  // Step 3: Indexer (OPTIONAL — can start later)
  state.indexer = new IndexingEngine(state.db, config.workspace, {
    excludePatterns: config.indexing.exclude_patterns,
    embedder: state.embedder
  });
  
  // Step 4: Memory Engine (CRITICAL — must succeed)
  state.memory = new MemoryEngine(state.db, state.embedder);
  
  // Step 5: Register Tools
  state.tools = registerAllTools(state.db, state.indexer, state.memory);
  
  // Step 6: Background indexing (non-blocking)
  if (config.indexing.auto_index) {
    setImmediate(() => state.indexer.fullScan().catch(err => log.error('Indexing failed', err)));
  }
  
  state.status = state.degraded ? 'degraded' : 'ready';
  return state;
}
```

#### TA-3: Pseudocode — First-Call Setup Detection

```typescript
async function handleToolCall(request: ToolCallRequest): Promise<ToolCallResponse> {
  // Check if configured
  if (!this.isConfigured) {
    // Try loading config from disk
    const configPath = path.join(this.workspaceHint || '.', '.code-intel', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        validateConfig(config);
        await this.initialize(config);
        this.isConfigured = true;
        // Fall through to normal dispatch
      } catch {
        // Config invalid — treat as unconfigured
      }
    }
    
    if (!this.isConfigured) {
      // Return setup prompt
      if (request.params.name === 'setup_configure') {
        return this.handleSetupConfigure(request.params.arguments);
      }
      return {
        content: [{ type: 'text', text: this.buildSetupPrompt() }],
        isError: false
      };
    }
  }
  
  // Normal dispatch
  const handler = this.toolRegistry.get(request.params.name);
  if (!handler) {
    return { content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }], isError: true };
  }
  
  return handler.execute(request.params.arguments);
}
```

#### TA-4: Extension Bundle Strategy

**Problem:** Extension must bundle core logic without exceeding 30MB VSIX limit.

**Strategy:**

| Component | Size (est.) | Bundle Strategy |
|-----------|-------------|-----------------|
| Core JS (compiled) | ~2MB | Inline bundle (webpack/esbuild) |
| better-sqlite3 native | ~5MB per platform | Platform-specific optional dep |
| sql.js (WASM fallback) | ~3MB | Always bundled as fallback |
| ONNX runtime | ~40MB | NOT bundled; separate download command |
| ONNX model | ~50MB | NOT bundled; separate download command |
| Tool definitions | ~500KB | Inline bundle |
| Total VSIX | ~10-12MB | ✅ Under 30MB limit |

**Lazy Loading Strategy:**
- ONNX runtime: loaded only when user downloads model
- better-sqlite3: loaded at activation; if fails → sql.js loaded
- Tool handlers: registered at activation but executed on-demand

#### TA-5: Concurrent Access Design

**Scenario:** User has both extension (in-process) and standalone MCP server pointing to same workspace.

**SQLite WAL Mode Behavior:**
- Multiple readers: ✅ Supported (both can read simultaneously)
- Single writer: ⚠️ Only one writer at a time (SQLite handles via busy timeout)
- Recommendation: Document that concurrent write access may cause brief delays

**Implementation:**
```typescript
// Database open with WAL + busy timeout
const db = new Database(dbPath, {
  pragma: {
    journal_mode: 'WAL',
    busy_timeout: 5000,  // Wait up to 5s for lock
    wal_autocheckpoint: 1000
  }
});
```

#### TA-6: MCP Protocol Compliance Notes

**Required capabilities for first-call setup:**
- Server MUST declare `setup_configure` in `tools/list` response even when unconfigured
- Server MUST NOT return JSON-RPC error (-32000) for unconfigured state — use tool result instead
- Server MUST handle `initialize` before any tool call (per MCP spec)
- Server SHOULD use `roots[]` from initialize params for workspace auto-detection

**Cross-client compatibility concerns:**
- Claude Desktop: Handles tool results well; will present setup text to user
- Cursor: May not show long tool results; keep setup prompt concise
- Windsurf: Similar to Cursor; test with actual client

### 12.4 Open Issues

| # | Issue | Impact | Owner | Status |
|---|-------|--------|-------|--------|
| 1 | better-sqlite3 compatibility with Electron (VS Code extension host) | May need WASM fallback | SA | Open |
| 2 | Extension bundle size with all core modules | May exceed 30MB limit | SA | Open |
| 3 | MCP protocol interpretation varies across clients (setup prompt handling) | Setup may not work uniformly | BA | Open |
| 4 | Python/Kotlin servers maintaining feature parity with Node.js core | May diverge over time | SA | Open |
| 5 | ONNX runtime binary size for multiple platforms | Cross-platform builds complex | DevOps | Open |

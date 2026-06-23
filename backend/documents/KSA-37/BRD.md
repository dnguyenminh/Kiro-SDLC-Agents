# Business Requirements Document (BRD)

## SDLC Memory Engine — KSA-37: [Memory] Project Setup — Kotlin MCP Server skeleton with dual-transport (stdio + HTTP)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-37 |
| Title | [Memory] Project Setup — Kotlin MCP Server skeleton with dual-transport (stdio + HTTP) |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-01-20 |
| Status | Draft |
| Epic | KSA-36: SDLC Memory Engine — Persistent Multi-Agent Memory System with Knowledge Graph Viewer |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-20 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-37 |

---

## 1. Introduction

### 1.1 Scope

Tạo project skeleton cho SDLC Memory MCP Server — một Kotlin-based MCP server hỗ trợ dual-transport:
- **stdio JSON-RPC**: Giao tiếp với Kiro IDE qua Model Context Protocol
- **Ktor HTTP server**: Phục vụ Web Viewer cho Knowledge Graph visualization

Đây là foundation task cho toàn bộ SDLC Memory Engine (Epic KSA-36). Tất cả các tasks tiếp theo (KSA-38 đến KSA-51) phụ thuộc vào project skeleton này.

### 1.2 Out of Scope

- Memory storage logic (KSA-38, KSA-39)
- Knowledge Graph viewer UI (KSA-45 đến KSA-51)
- MCP tool implementations beyond basic handshake
- Authentication/Authorization
- Database schema và persistence layer

### 1.3 Preliminary Requirement

- JDK 11+ installed (runtime target)
- Gradle 8.x (build tool)
- Reference project `mcp-code-intelligence-kotlin` available for pattern reference

---

## 2. Business Requirements

### 2.1 High Level Process Map

SDLC Memory MCP Server là thành phần core của Memory Engine, cung cấp:
1. MCP protocol interface cho Kiro agents (stdio transport)
2. HTTP API cho Web Viewer (Ktor HTTP transport)
3. CLI-based configuration cho workspace và port settings

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a Kiro agent, I want to connect to the Memory MCP Server via stdio so that I can store/retrieve SDLC knowledge | MUST HAVE | KSA-37 |
| 2 | As a developer, I want to start the server with CLI args so that I can configure workspace and viewer port | MUST HAVE | KSA-37 |
| 3 | As a Web Viewer, I want to connect via HTTP so that I can display the Knowledge Graph | MUST HAVE | KSA-37 |
| 4 | As an ops engineer, I want a health endpoint so that I can monitor server status | MUST HAVE | KSA-37 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer starts the server: `java -jar sdlc-memory.jar --workspace . --viewer-port 3200`

**Step 2:** Server initializes dual transport — stdio listener + HTTP server on configured port

**Step 3:** Kiro agent connects via stdio, sends `initialize` request

**Step 4:** Server responds with capabilities (tools/list)

**Step 5:** Web Viewer connects via HTTP, calls `GET /api/health` to verify connectivity

**Step 6:** Server serves both transports concurrently using coroutines

---

#### STORY 1: MCP stdio Transport

> As a Kiro agent, I want to connect to the Memory MCP Server via stdio so that I can store/retrieve SDLC knowledge

**Requirement Details:**

1. Server reads JSON-RPC 2.0 messages from stdin (one JSON object per line)
2. Server writes JSON-RPC 2.0 responses to stdout
3. Server logs to stderr (keeps stdout clean for protocol)
4. Supports MCP protocol version 2024-11-05

**Acceptance Criteria:**

1. Server responds to `initialize` with protocolVersion, capabilities, and serverInfo
2. Server responds to `tools/list` with empty tools array (skeleton)
3. Server responds to `tools/call` with appropriate error for unknown tools
4. Server responds to `ping` with empty result
5. Invalid JSON returns parse error (-32700)
6. Unknown method returns method not found (-32601)

---

#### STORY 2: CLI Configuration

> As a developer, I want to start the server with CLI args so that I can configure workspace and viewer port

**Requirement Details:**

1. `--workspace <path>` — sets the workspace root directory (required)
2. `--viewer-port <port>` — sets HTTP server port (default: 3200)
3. Invalid args produce helpful error message and exit

**Acceptance Criteria:**

1. `java -jar sdlc-memory.jar --workspace . --viewer-port 3200` starts successfully
2. `--workspace` resolves to absolute path
3. `--viewer-port` defaults to 3200 if not specified
4. Missing `--workspace` prints usage and exits with code 1

---

#### STORY 3: HTTP Transport (Ktor)

> As a Web Viewer, I want to connect via HTTP so that I can display the Knowledge Graph

**Requirement Details:**

1. Ktor HTTP server with Netty engine
2. Listens on configured port (default 3200)
3. Serves JSON API responses
4. Runs concurrently with stdio transport

**Acceptance Criteria:**

1. HTTP server starts on configured port
2. Server accepts connections from any origin (CORS enabled for development)
3. Responds with proper JSON content-type headers

---

#### STORY 4: Health Endpoint

> As an ops engineer, I want a health endpoint so that I can monitor server status

**Requirement Details:**

1. `GET /api/health` returns server status
2. Response includes: status, version, uptime, workspace path

**Acceptance Criteria:**

1. `GET /api/health` returns HTTP 200
2. Response body: `{"status":"ok","version":"0.1.0","workspace":"<path>"}`
3. Content-Type: application/json

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| JDK 11+ | Infrastructure | N/A | Runtime environment |
| Gradle 8.x | Infrastructure | N/A | Build tool |
| Ktor (Netty) | Library | N/A | HTTP server framework |
| kotlinx.serialization | Library | N/A | JSON serialization |
| kotlinx.coroutines | Library | N/A | Async/concurrent processing |
| mcp-code-intelligence-kotlin | Reference | N/A | Pattern reference for MCP server implementation |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter | Duc Nguyen Minh | Product Owner, defines requirements | Jira reporter |
| Dev Team | SDLC Agents Team | Implementation | Project team |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Dual transport complexity | Medium | Low | Follow proven pattern from mcp-code-intelligence-kotlin |
| Port conflict on 3200 | Low | Medium | Make port configurable via CLI |
| Ktor version compatibility | Low | Low | Pin exact versions in libs.versions.toml |

### 5.2 Assumptions

- JDK 11+ is available on target machines
- stdio transport follows same pattern as mcp-code-intelligence-kotlin
- Web Viewer will be a separate frontend project connecting via HTTP
- No authentication needed for Phase 1 (local development only)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Server startup < 3 seconds | Cold start to ready state |
| Performance | MCP response latency < 50ms | For basic handshake operations |
| Code Quality | Max 200 lines per file | Per code-standards steering rule |
| Code Quality | Max 20 lines per function | Per code-standards steering rule |
| Maintainability | Single Responsibility Principle | Each file has one clear purpose |
| Portability | JVM 11+ compatible | Cross-platform support |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-37 | [Memory] Project Setup — Kotlin MCP Server skeleton | In Progress | Task | Main ticket |
| KSA-36 | SDLC Memory Engine — Persistent Multi-Agent Memory System | To Do | Epic | Parent epic |
| KSA-38 | [Memory] Storage Layer — SQLite + FTS5 | To Do | Task | Depends on KSA-37 |
| KSA-39 | [Memory] Knowledge Graph Data Model | To Do | Task | Depends on KSA-37 |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — standard protocol for AI tool communication |
| stdio | Standard input/output — process-level communication channel |
| JSON-RPC 2.0 | Remote procedure call protocol encoded in JSON |
| Ktor | Kotlin async web framework by JetBrains |
| Netty | High-performance async event-driven network framework |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| MCP Protocol Spec | https://modelcontextprotocol.io/ |
| Reference Implementation | mcp-code-intelligence-kotlin/ (local project) |
| Ktor Documentation | https://ktor.io/docs/ |

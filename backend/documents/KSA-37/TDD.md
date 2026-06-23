# Technical Design Document (TDD)

## SDLC Memory Engine — KSA-37: [Memory] Project Setup — Kotlin MCP Server skeleton with dual-transport (stdio + HTTP)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-37 |
| Title | [Memory] Project Setup — Kotlin MCP Server skeleton with dual-transport (stdio + HTTP) |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-01-20 |
| Status | Draft |
| Related BRD | documents/KSA-37/BRD.md |
| Related FSD | documents/KSA-37/FSD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-20 | SA Agent | Initiate document — auto-generated from BRD and FSD |

---

## 1. Introduction

### 1.1 Purpose

Technical design cho SDLC Memory MCP Server skeleton — Kotlin project với dual-transport architecture (stdio JSON-RPC + Ktor HTTP), following patterns established in `mcp-code-intelligence-kotlin`.

### 1.2 Scope

- Project structure và Gradle build configuration
- stdio JSON-RPC 2.0 transport implementation
- Ktor HTTP server with health endpoint
- CLI argument parsing
- Coroutine-based concurrent transport management

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | Kotlin | 2.0.21 |
| Build Tool | Gradle (Kotlin DSL) | 8.10 |
| HTTP Framework | Ktor (Netty) | 3.0.3 |
| Serialization | kotlinx.serialization | 1.7.3 |
| Concurrency | kotlinx.coroutines | 1.9.0 |
| JVM Target | JDK | 11 |
| Fat JAR | Shadow Plugin | 8.1.1 |

### 1.4 Design Principles

- **Single Responsibility**: Each file handles one concern (max 200 lines)
- **Separation of Transports**: stdio and HTTP are independent, share common dispatcher
- **Fail Fast**: Invalid config → immediate exit with clear error
- **Protocol Compliance**: Strict JSON-RPC 2.0 and MCP 2024-11-05 adherence
- **Pattern Reuse**: Follow mcp-code-intelligence-kotlin patterns where applicable

### 1.5 Constraints

- Max 200 lines per file (code-standards)
- Max 20 lines per function (code-standards)
- JVM 11 target for broad compatibility
- No external dependencies beyond Ktor + kotlinx ecosystem
- stdout reserved exclusively for JSON-RPC responses

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-37/BRD.md |
| FSD | documents/KSA-37/FSD.md |
| Reference Project | mcp-code-intelligence-kotlin/ |
| MCP Spec | https://modelcontextprotocol.io/ |

---

## 2. System Architecture

### 2.1 Architecture Overview

The server runs as a single JVM process with two concurrent communication channels:
1. **Main thread**: stdio read loop processing JSON-RPC messages
2. **Coroutine**: Ktor HTTP server on configurable port

Both transports share a common `RequestDispatcher` that routes to method handlers.

![Architecture Diagram](diagrams/architecture.png)

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| Main | Entry point, CLI parsing, orchestration | Kotlin stdlib |
| Config | CLI arg parsing, configuration model | Kotlin stdlib |
| McpServer | stdio transport, JSON-RPC read/write loop | kotlinx.serialization |
| HttpServer | Ktor HTTP server, REST endpoints | Ktor + Netty |
| RequestDispatcher | Route MCP methods to handlers | Kotlin |
| McpProtocol | JSON-RPC 2.0 message models | kotlinx.serialization |
| HealthHandler | Health check response builder | Kotlin |

### 2.3 Deployment Architecture

Single JAR deployment — no containers needed for Phase 1:

```
java -jar sdlc-memory.jar --workspace /path/to/project --viewer-port 3200
```

- Process communicates via stdin/stdout with parent (Kiro)
- HTTP server binds to 0.0.0.0:{port} for Web Viewer access
- No database in Phase 1 (added in KSA-38)

### 2.4 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| Kiro IDE | McpServer | stdio JSON-RPC 2.0 | Sync request/response | One JSON per line |
| Web Viewer | HttpServer | HTTP REST | Sync request/response | Standard HTTP |
| McpServer | RequestDispatcher | In-process | Direct call | Method routing |
| HttpServer | RequestDispatcher | In-process | Direct call | Shared dispatcher |

---

## 3. API Design

### 3.1 API Overview

| # | Endpoint/Method | Protocol | Description | Source |
|---|----------------|----------|-------------|--------|
| 1 | initialize | MCP/stdio | MCP handshake | UC-01 |
| 2 | tools/list | MCP/stdio | List available tools | UC-01 |
| 3 | tools/call | MCP/stdio | Execute a tool | UC-01 |
| 4 | ping | MCP/stdio | Heartbeat | UC-01 |
| 5 | GET /api/health | HTTP | Health check | UC-02 |

---

### 3.2 MCP Method: initialize

| Attribute | Value |
|-----------|-------|
| Method | initialize |
| Transport | stdio |
| Auth | None |

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "kiro", "version": "1.0.0" }
  }
}
```

**Response — Success:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": { "listChanged": false }
    },
    "serverInfo": {
      "name": "sdlc-memory",
      "version": "0.1.0"
    }
  }
}
```

---

### 3.3 MCP Method: tools/list

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": []
  }
}
```

---

### 3.4 MCP Method: tools/call

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "some_tool",
    "arguments": {}
  }
}
```

**Response (unknown tool):**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "Unknown tool: some_tool" }]
  }
}
```

---

### 3.5 HTTP: GET /api/health

| Attribute | Value |
|-----------|-------|
| Method | GET |
| Path | /api/health |
| Auth | None |
| Content-Type | application/json |

**Response — 200 OK:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "workspace": "/absolute/path/to/workspace"
}
```

---

## 4. Database Design

> Not applicable for KSA-37 (skeleton). Database will be introduced in KSA-38 (SQLite + FTS5).

---

## 5. Class / Module Design

### 5.1 Package Structure

```
sdlc-memory-server/
├── build.gradle.kts
├── settings.gradle.kts
├── gradle/
│   └── libs.versions.toml
├── src/main/kotlin/com/sdlcmemory/
│   ├── Main.kt                    # Entry point + CLI parsing
│   ├── Config.kt                  # Configuration data class
│   ├── mcp/
│   │   ├── McpServer.kt           # stdio transport read/write loop
│   │   ├── RequestDispatcher.kt   # Method routing
│   │   └── McpProtocol.kt         # JSON-RPC models + helpers
│   └── http/
│       ├── HttpServer.kt          # Ktor server setup + routing
│       └── HealthHandler.kt       # Health endpoint handler
└── src/test/kotlin/com/sdlcmemory/
    ├── ConfigTest.kt
    ├── mcp/
    │   ├── McpServerTest.kt
    │   └── RequestDispatcherTest.kt
    └── http/
        └── HealthHandlerTest.kt
```

### 5.2 Key Interfaces & Classes

```kotlin
// Config.kt — Configuration data class
data class Config(
    val workspace: String,      // Absolute path
    val viewerPort: Int = 3200  // HTTP server port
)

// mcp/RequestDispatcher.kt — Method routing
class RequestDispatcher(private val config: Config) {
    fun dispatch(method: String, params: JsonObject): JsonObject
}

// mcp/McpServer.kt — stdio transport
class McpServer(private val dispatcher: RequestDispatcher) {
    fun run()  // Main read loop (blocking)
}

// http/HttpServer.kt — Ktor HTTP server
class HttpServer(private val config: Config) {
    suspend fun start()  // Starts Ktor on config.viewerPort
    fun stop()           // Graceful shutdown
}

// http/HealthHandler.kt — Health endpoint
class HealthHandler(private val config: Config) {
    fun handle(): HealthResponse
}
```

### 5.3 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Dispatcher | RequestDispatcher | Central routing, easy to extend with new methods |
| Builder | JsonObject builders | kotlinx.serialization buildJsonObject pattern |
| Facade | HttpServer | Wraps Ktor complexity behind simple start/stop |

### 5.4 Error Handling

| Error Type | JSON-RPC Code | When |
|-----------|---------------|------|
| Parse error | -32700 | Invalid JSON on stdin |
| Invalid request | -32600 | Missing method field |
| Method not found | -32601 | Unknown method name |
| Internal error | -32603 | Handler throws exception |

---

## 6. Integration Design

### 6.1 Kiro IDE Integration (stdio)

| Attribute | Value |
|-----------|-------|
| Protocol | JSON-RPC 2.0 over stdin/stdout |
| Message Format | One JSON object per line (newline-delimited) |
| Encoding | UTF-8 |
| Timeout | None (persistent connection) |
| Error Recovery | Log to stderr, continue processing |

### 6.2 Web Viewer Integration (HTTP)

| Attribute | Value |
|-----------|-------|
| Protocol | HTTP/1.1 |
| Endpoint | http://localhost:{port}/api/* |
| Content-Type | application/json |
| CORS | Enabled (all origins for dev) |
| Timeout | 30s default |

---

## 7. Security Design

### 7.1 Authentication

None for Phase 1 — local development only. Both transports are unauthenticated.

### 7.2 Network Security

| Transport | Binding | Access |
|-----------|---------|--------|
| stdio | Process-level | Only parent process |
| HTTP | 0.0.0.0:{port} | Local network |

### 7.3 Input Validation

| Input | Validation | Action on Failure |
|-------|-----------|-------------------|
| JSON from stdin | Valid JSON parse | Return -32700 error |
| CLI --workspace | Path exists check | Exit with error |
| CLI --viewer-port | Integer 1024-65535 | Exit with error |

---

## 8. Performance & Scalability

### 8.1 Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Server startup | < 3s | Cold start to ready |
| MCP handshake | < 50ms | initialize + tools/list |
| Health endpoint | < 10ms | Simple JSON response |
| Memory footprint | < 100MB | Skeleton without data |

### 8.2 Concurrency Model

- Main thread: stdio read loop (blocking I/O)
- Coroutine scope: Ktor HTTP server (non-blocking)
- Shared dispatcher accessed from both (thread-safe via immutable config)

---

## 9. Monitoring & Observability

### 9.1 Logging

| Log Event | Level | Destination | Format |
|-----------|-------|-------------|--------|
| Server starting | INFO | stderr | `[sdlc-memory] Server starting...` |
| Workspace resolved | INFO | stderr | `[sdlc-memory] Workspace: {path}` |
| HTTP server ready | INFO | stderr | `[sdlc-memory] HTTP server on port {port}` |
| Request received | DEBUG | stderr | `[sdlc-memory] Method: {method}` |
| Error | ERROR | stderr | `[sdlc-memory] Error: {message}` |

### 9.2 Health Checks

| Endpoint | Checks | Response |
|----------|--------|----------|
| GET /api/health | Server running | 200 + status JSON |

---

## 10. Deployment Considerations

### 10.1 Build & Package

```bash
# Build fat JAR
./gradlew shadowJar

# Output: build/libs/sdlc-memory-0.1.0.jar
```

### 10.2 Runtime Configuration

| Property | Source | Default | Description |
|----------|--------|---------|-------------|
| workspace | CLI --workspace | (required) | Workspace root path |
| viewerPort | CLI --viewer-port | 3200 | HTTP server port |

### 10.3 Kiro MCP Configuration

```json
{
  "mcpServers": {
    "sdlc-memory": {
      "command": "java",
      "args": ["-jar", "path/to/sdlc-memory.jar", "--workspace", "${workspaceFolder}", "--viewer-port", "3200"]
    }
  }
}
```

---

## 11. Appendix

### Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol |
| JSON-RPC 2.0 | Remote procedure call protocol |
| Ktor | Kotlin async web framework |
| Shadow JAR | Fat JAR with all dependencies bundled |
| stdio | Standard input/output process streams |

### Implementation File Breakdown

| File | Lines (est.) | Responsibility |
|------|-------------|----------------|
| Main.kt | ~40 | Entry point, CLI parsing, launch |
| Config.kt | ~30 | Config data class + validation |
| mcp/McpServer.kt | ~80 | stdio read loop, JSON-RPC I/O |
| mcp/RequestDispatcher.kt | ~60 | Method routing + handlers |
| mcp/McpProtocol.kt | ~50 | JSON-RPC models + builders |
| http/HttpServer.kt | ~50 | Ktor setup + routing |
| http/HealthHandler.kt | ~25 | Health response builder |
| **Total** | **~335** | 7 files, all under 200 lines |

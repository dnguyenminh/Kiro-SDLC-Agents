# Technical Design Document (TDD)

## kiro-ts Chat Proxy — KSA-237: Integrate chat completions endpoint into MCP server

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-237 |
| Title | Integrate chat completions endpoint into MCP server (kiro-ts) |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-237.docx |
| Related FSD | FSD-v1-KSA-237.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | SA Agent | Initial TDD — based on FSD v1 and existing codebase |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical implementation of the kiro-ts chat completions proxy module, which integrates an Anthropic Messages API-compatible endpoint into the existing MCP Code Intelligence HTTP server.

### 1.2 Scope

- TypeScript source module: `src/http/kiro-ts/`
- Route handler integration into `http-entry.js`
- Credential resolution (AWS SSO, API key)
- SigV4 request signing
- SSE streaming proxy
- Health check endpoint
- Build and deployment within the kiro-sdlc-agents VSIX extension

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 20.x |
| HTTP | Node.js built-in http module | — |
| AWS Auth | @aws-sdk/signature-v4, @smithy/signature-v4 | latest |
| Crypto | Node.js built-in crypto | — |
| Build | tsc (TypeScript compiler) | 5.x |
| Package | VSIX (VS Code extension format) | — |
| Test | Jest / Vitest | latest |

### 1.4 Design Principles

- **Zero dependencies where possible** — use Node.js built-in modules (http, crypto, fs)
- **Minimal proxy overhead** — no unnecessary parsing or buffering (BR-04, BR-05)
- **Fail-safe isolation** — proxy failure must not crash MCP server (BR-06)
- **Credential security** — never log, never expose in errors (BR-07)
- **Anthropic API fidelity** — byte-for-byte compatible response format

### 1.5 Constraints

- Must integrate into existing `http-entry.js` without modifying MCP tool handling
- No Express/Koa/Fastify — raw Node.js HTTP only (matches existing codebase)
- Single-process (same Node.js process as MCP server)
- Max body size: 4MB (existing limit in http-entry.js)
- Must work on Windows, macOS, Linux

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-237.docx |
| FSD | FSD-v1-KSA-237.docx |
| Existing chat-routes.js | kiro-sdlc-agents/mcp-server/http/chat-routes.js |
| Anthropic Messages API | https://docs.anthropic.com/en/api/messages |

---

## 2. System Architecture

### 2.1 Architecture Overview

The kiro-ts module is a self-contained TypeScript module compiled to JS and loaded by `http-entry.js` at server startup. It handles two routes (`/v1/messages` and `/api/chat/completions`) independently from MCP JSON-RPC traffic.

![Architecture Diagram](diagrams/architecture.png)

**Key Architecture Decisions:**

1. **Inline module, not separate process** — avoids IPC overhead, shares event loop
2. **Lazy-loaded credentials** — credentials resolved on first request, cached until expiry
3. **Streaming-first** — default behavior is SSE streaming (matches Anthropic SDK behavior)
4. **Dual-mode auth** — API key (direct Anthropic) or Kiro credentials (SigV4 to Kiro API)

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| ChatRouter | Route matching, request/response lifecycle | Node.js http |
| RequestValidator | Validate Anthropic Messages API schema | Custom validation |
| AuthResolver | Resolve credentials (API key or Kiro SSO) | fs, env vars |
| SigV4Signer | Sign requests for Kiro AI API | crypto (HMAC-SHA256) |
| StreamProxy | Forward SSE stream with zero buffering | Node.js streams |
| ConversationStore | Per-session conversation history + tool ID tracking | In-memory Map |
| HealthChecker | Diagnostic checks (creds, connectivity, model) | http/https |

### 2.3 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| Chat Panel | ChatRouter | HTTP POST | Sync (SSE) | Client sends request, receives SSE stream |
| ChatRouter | AuthResolver | Internal call | Sync | Resolve auth before forwarding |
| ChatRouter | SigV4Signer | Internal call | Sync | Sign request (Kiro mode only) |
| StreamProxy | Kiro AI API | HTTPS POST | Streaming | Forward signed request, receive SSE |
| StreamProxy | Anthropic API | HTTPS POST | Streaming | Forward API-key request, receive SSE |
| AuthResolver | File System | fs.readFile | Async | Read credential files |

---

## 3. API Design

### 3.1 API Overview

| # | Endpoint | Method | Description | Source |
|---|----------|--------|-------------|--------|
| 1 | /v1/messages | POST | Chat completions (Anthropic Messages API) | UC-01, UC-03, UC-05 |
| 2 | /api/chat/completions | POST | Alias for /v1/messages | UC-01 |
| 3 | /v1/health | GET | Connection health check | UC-04 |

### 3.2 API: POST /v1/messages

**Implements:** UC-01, UC-03, UC-05, BR-01 through BR-22

| Attribute | Value |
|-----------|-------|
| Method | POST |
| Path | /v1/messages |
| Auth | x-api-key header (optional) OR Kiro credentials (auto-detect) |
| Rate Limit | None (proxy passthrough — rate limiting handled by upstream) |
| Max Body | 4MB |

**Request Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| Content-Type | Yes | application/json |
| x-api-key | No | Anthropic API key (enables direct Anthropic mode) |

**Request Body:**

```json
{
  "model": "claude-sonnet-4-20250514",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "max_tokens": 4096,
  "stream": true,
  "system": "You are a helpful assistant",
  "temperature": 0.7,
  "tools": [
    {
      "name": "get_file",
      "description": "Read a file",
      "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}}
    }
  ],
  "tool_choice": {"type": "auto"},
  "stop_sequences": [],
  "metadata": {},
  "sessionId": "default",
  "toolResult": {
    "toolUseId": "toolu_abc123",
    "content": "file contents here",
    "isError": false
  }
}
```

**Response — 200 OK (stream:true):**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: message_start
data: {"type":"message_start","message":{"id":"msg_01","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","usage":{"input_tokens":25}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":15}}

event: message_stop
data: {"type":"message_stop"}
```

**Response — 200 OK (stream:false):**

```json
{
  "id": "msg_01",
  "type": "message",
  "role": "assistant",
  "content": [{"type": "text", "text": "Hello!"}],
  "model": "claude-sonnet-4-20250514",
  "stop_reason": "end_turn",
  "usage": {"input_tokens": 25, "output_tokens": 15}
}
```

**Error Responses:**

| Status | Type | Message | Condition |
|--------|------|---------|-----------|
| 400 | invalid_request_error | "model is required" | Missing required field |
| 400 | tool_use_id_mismatch | "tool_use_id not found" | Invalid toolResult.toolUseId |
| 401 | authentication_error | "API key required..." | No auth available |
| 413 | invalid_request_error | "Request body too large" | Body > 4MB |
| 429 | rate_limit_error | "Rate limit exceeded" | Upstream 429 |
| 502 | api_error | "Failed to connect to AI service" | Upstream unreachable |
| 504 | api_error | "Upstream timeout" | No response within timeout |

### 3.3 API: GET /v1/health

**Implements:** UC-04, BR-10

| Attribute | Value |
|-----------|-------|
| Method | GET |
| Path | /v1/health |
| Auth | None |
| Timeout | 5 seconds total |

**Response — 200 OK:**

```json
{
  "status": "healthy",
  "credentials": {
    "status": "ok",
    "type": "kiro",
    "expires_in": "45m"
  },
  "api_connectivity": {
    "status": "ok",
    "latency_ms": 230
  },
  "model_available": {
    "status": "ok",
    "model": "claude-sonnet-4-20250514"
  },
  "timestamp": "2026-06-05T15:30:00Z"
}
```

---

## 4. Data Design

### 4.1 In-Memory Data Structures

No persistent database. All state is in-memory per process lifetime.

#### ConversationSession (Map)

```typescript
interface ConversationSession {
  sessionId: string;
  messages: AnthropicMessage[];
  toolUseIndex: Map<string, ToolUseEntry>;
  turnCounter: number;
  createdAt: number;
}

interface ToolUseEntry {
  id: string;
  name: string;
  input: unknown;
}
```

#### CredentialCache (singleton)

```typescript
interface CachedCredential {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
  expiration: Date;
  source: 'kiro' | 'aws_file' | 'env_var';
  cachedAt: number;
}
```

### 4.2 Session Lifecycle

- Sessions created on first request with a given sessionId
- Sessions have no TTL (persist until server restart)
- Max sessions not enforced (memory-bounded by Node.js heap)

---

## 5. Module Design

### 5.1 Source Structure

```
kiro-sdlc-agents/
├── src/
│   └── http/
│       └── kiro-ts/
│           ├── index.ts              # Re-exports handleChatRoute, handleHealthRoute
│           ├── chat-handler.ts       # Main request handler
│           ├── auth-resolver.ts      # Credential resolution logic
│           ├── sigv4-signer.ts       # AWS SigV4 signing
│           ├── stream-proxy.ts       # SSE streaming proxy
│           ├── conversation-store.ts # Per-session conversation management
│           ├── request-validator.ts  # Input validation
│           ├── health-checker.ts     # Health check logic
│           └── types.ts             # TypeScript interfaces
├── mcp-server/
│   └── http/
│       └── chat-routes.js           # Compiled output (existing)
```

### 5.2 Key Interfaces

```typescript
// auth-resolver.ts
interface AuthResult {
  mode: 'api_key' | 'kiro';
  apiKey?: string;           // When mode = 'api_key'
  credentials?: AWSCredentials; // When mode = 'kiro'
  region?: string;
}

interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

// stream-proxy.ts
interface ProxyOptions {
  targetUrl: string;
  headers: Record<string, string>;
  body: string;
  onEvent: (event: SSEEvent) => void;
  onError: (error: Error) => void;
  onEnd: () => void;
  signal?: AbortSignal;
}

// types.ts
interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  stream?: boolean;
  system?: string;
  temperature?: number;
  tools?: ToolDefinition[];
  tool_choice?: ToolChoice;
  stop_sequences?: string[];
  metadata?: Record<string, unknown>;
}
```

### 5.3 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Strategy | AuthResolver | Different credential sources (Kiro, AWS file, env vars) |
| Proxy | StreamProxy | Forward requests without modification |
| Observer | SSE event forwarding | Push events to client as they arrive |
| Singleton | CredentialCache | One credential cache per process |
| Chain of Responsibility | Auth resolution | Try sources in priority order |

### 5.4 Error Handling

| Exception/Error | HTTP Status | Error Type | When |
|----------------|-------------|------------|------|
| ValidationError | 400 | invalid_request_error | Missing/invalid fields |
| ToolIdMismatchError | 400 | tool_use_id_mismatch | toolUseId not in history |
| AuthenticationError | 401 | authentication_error | No credentials available |
| BodyTooLargeError | 413 | invalid_request_error | Body > 4MB |
| UpstreamError | 502 | api_error | Connection to API failed |
| TimeoutError | 504 | api_error | No response within timeout |

---

## 6. Integration Design

### 6.1 Kiro AI API Integration

| Attribute | Value |
|-----------|-------|
| Protocol | HTTPS |
| Endpoint | `https://kiro.api.{region}.amazonaws.com/v1/messages` |
| Authentication | AWS SigV4 (service: "kiro") |
| Timeout | 120 seconds (long for streaming) |
| Retry Policy | 0 retries for streaming; 1 retry for health check |
| Keep-Alive | Enabled (reuse connections) |

**SigV4 Signing Details:**

| Parameter | Value |
|-----------|-------|
| Service name | kiro |
| Region | From credential config (default: us-east-1) |
| Signed headers | host, content-type, x-amz-date |
| Additional headers | x-amz-security-token (when using session token) |
| Body signing | SHA-256 hash of request body |

### 6.2 Anthropic API Integration (Direct Mode)

| Attribute | Value |
|-----------|-------|
| Protocol | HTTPS |
| Endpoint | `https://api.anthropic.com/v1/messages` (or custom baseUrl) |
| Authentication | x-api-key header |
| Timeout | 120 seconds |
| Additional headers | anthropic-version: 2023-06-01 |

### 6.3 Credential File Integration

| Source | Path | Format | Priority |
|--------|------|--------|----------|
| Kiro internal | Platform-specific IDE credential store | JSON | 1 (highest) |
| AWS credentials | ~/.aws/credentials [kiro] profile | INI | 2 |
| Environment | AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN | env vars | 3 (lowest) |

---

## 7. Security Design

### 7.1 Authentication

Two modes:
1. **API Key mode:** Client provides `x-api-key` header → forwarded directly to Anthropic
2. **Kiro mode:** No API key → system resolves AWS credentials → signs with SigV4

### 7.2 Data Protection

| Data Type | At Rest | In Transit | In Logs | In Errors |
|-----------|---------|------------|---------|-----------|
| AWS credentials | File system (OS-protected) | Never transmitted to client | NEVER | NEVER |
| API key | In memory only | TLS to Anthropic | NEVER | Masked (last 4) |
| Chat messages | In memory (session) | TLS to upstream | NEVER | NEVER |
| Session tokens | In memory (cache) | TLS (SigV4 header) | NEVER | NEVER |

### 7.3 Network Security

- Server binds to `127.0.0.1` ONLY — not accessible from network
- All upstream connections use HTTPS/TLS
- No CORS for external origins (only localhost)

### 7.4 Input Validation

| Field | Validation | Sanitization |
|-------|-----------|--------------|
| model | Non-empty string, max 100 chars | None (passed through) |
| messages | Array, at least 1 element | None |
| max_tokens | Integer, 1-200000 | Clamp to range |
| temperature | Float, 0.0-1.0 | Clamp to range |
| sessionId | String, max 256 chars | Trim whitespace |
| body size | Max 4MB | Reject if exceeded |

---

## 8. Performance & Scalability

### 8.1 Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Request parsing + validation | < 5ms | Start of handler to upstream request |
| Credential resolution (cached) | < 1ms | Cache hit path |
| Credential resolution (file read) | < 50ms | File system read |
| SigV4 signing | < 10ms | HMAC computation |
| Total proxy overhead | < 100ms | Time_total - upstream_latency |
| Token-to-token streaming | < 50ms | Event received to event forwarded |
| Health check total | < 5000ms | Request to response |

### 8.2 Resource Usage

| Resource | Expected | Limit |
|----------|----------|-------|
| Memory per session | ~50KB | No hard limit |
| Concurrent SSE connections | 5 | Node.js event loop (no blocking) |
| File descriptors | 2 per active stream | OS limit |

### 8.3 Streaming Optimization

- **No buffering:** Use `res.write()` immediately on each upstream event
- **No JSON re-parsing:** Forward raw SSE data when possible
- **Backpressure:** If client is slow, Node.js TCP buffers handle it
- **AbortController:** Cancel upstream on client disconnect

---

## 9. Monitoring & Observability

### 9.1 Logging

| Log Event | Level | Fields | Destination |
|-----------|-------|--------|-------------|
| Request received | DEBUG | timestamp, model, sessionId, auth_mode | stderr |
| Auth resolved | DEBUG | mode, source (NOT credentials) | stderr |
| Upstream request sent | DEBUG | url, method, content_length | stderr |
| Upstream error | WARN | status_code, error_type | stderr |
| Stream complete | DEBUG | duration_ms, tokens_streamed | stderr |
| Health check result | INFO | status, components | stderr |

### 9.2 Health Endpoint

| Check | Method | Timeout |
|-------|--------|---------|
| Credentials available | Resolve without API call | 1s |
| API connectivity | HEAD or minimal POST | 3s |
| Model availability | Parse response | Included in API check |

---

## 10. Implementation Checklist

### Files to Create/Modify

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `src/http/kiro-ts/index.ts` | CREATE | Module entry point |
| 2 | `src/http/kiro-ts/chat-handler.ts` | CREATE | Main request handler |
| 3 | `src/http/kiro-ts/auth-resolver.ts` | CREATE | Credential resolution |
| 4 | `src/http/kiro-ts/sigv4-signer.ts` | CREATE | AWS SigV4 signing |
| 5 | `src/http/kiro-ts/stream-proxy.ts` | CREATE | SSE streaming proxy |
| 6 | `src/http/kiro-ts/conversation-store.ts` | CREATE | Session management |
| 7 | `src/http/kiro-ts/request-validator.ts` | CREATE | Input validation |
| 8 | `src/http/kiro-ts/health-checker.ts` | CREATE | Health check logic |
| 9 | `src/http/kiro-ts/types.ts` | CREATE | TypeScript interfaces |
| 10 | `mcp-server/http/chat-routes.js` | MODIFY | Update to use new module |
| 11 | `mcp-server/http-entry.js` | MODIFY | Add /v1/health route |
| 12 | `tsconfig.json` | MODIFY | Include src/http/kiro-ts |

### Build Steps

1. `tsc` — compile TypeScript to JavaScript
2. Output to `mcp-server/http/` (alongside existing compiled files)
3. VSIX rebuild: `vsce package` in extension root

---

## 11. Deployment Considerations

### 11.1 Environment Configuration

| Property | DEV | PROD |
|----------|-----|------|
| Upstream URL (Kiro) | kiro.api.us-east-1.amazonaws.com | kiro.api.{region}.amazonaws.com |
| Upstream URL (Anthropic) | api.anthropic.com | api.anthropic.com |
| Server bind | 127.0.0.1 | 127.0.0.1 |
| Log level | DEBUG | WARN |
| Request timeout | 120s | 120s |

### 11.2 Rollback Strategy

Since this is a VSIX extension:
1. Uninstall current version of kiro-sdlc-agents extension
2. Install previous VSIX version
3. Restart Kiro IDE
4. MCP server starts without new routes (graceful — 404 on /v1/messages)

---

## 12. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

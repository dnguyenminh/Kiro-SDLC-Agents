# Technical Design Document (TDD)

## Kiro SDLC Agents Extension — KSA-231: Tích hợp Kiro API Client (Node.js) vào Extension

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-231 |
| Title | Tích hợp Kiro API Client (Node.js) vào Extension — Thay thế kiro-rs Proxy |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-231.docx |
| Related FSD | FSD-v1-KSA-231.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | SA Agent – Solution Architect | Create document |
| Peer Reviewer | SM Agent – Scrum Master | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | SA Agent | Initial TDD — auto-generated from BRD and FSD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the technical design in this TDD |
| | ☐ I agree and confirm the technical design in this TDD |

---

## 1. Introduction

> **Scope Boundary:** This TDD specifies HOW to implement the requirements defined in the FSD. It does NOT repeat functional requirements, business rules, use cases, or UI specifications — refer to the FSD for those. This document focuses on: technology choices, architecture decisions, implementation patterns, and deployment concerns.

### 1.1 Purpose

This TDD defines the technical architecture and implementation design for the native Kiro API Client integrated directly into the `kiro-sdlc-agents` VS Code extension. It replaces the external `kiro-rs.exe` proxy with five TypeScript modules that handle credential management, token refresh, API communication, SSE streaming, and model registry.

### 1.2 Scope

- **TokenManager** — AWS SSO credential detection, in-memory storage, auto-refresh with mutex
- **KiroClient** — Main provider class implementing `LlmProvider` interface
- **AnthropicAdapter** — Request/response format adaptation (Kiro API to Anthropic Messages format)
- **StreamHandler** — SSE stream parsing, backpressure management, abort support
- **ModelRegistry** — Model list fetching, caching (1h TTL), Settings Panel integration
- **Provider Factory extension** — Registration of `"kiro"` provider type in existing factory

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x |
| Runtime | Node.js (VS Code extension host) | >= 18 (native fetch) |
| Framework | VS Code Extension API | >= 1.85 |
| HTTP Client | Native `fetch` API | Built-in (Node 18+) |
| Build Tool | webpack + ts-loader | 5.x |
| Package Manager | npm | 10.x |
| Test Framework | Mocha + sinon | Existing project setup |

### 1.4 Design Principles

- **Zero External Dependencies** — No new npm packages; use only Node.js built-in APIs (`fetch`, `fs`, `crypto`) and VS Code API (`FileSystemWatcher`, `workspace.getConfiguration`)
- **Lazy Initialization** — Defer credential scanning until first use or provider selection to keep activation time < 200ms
- **Memory-Only Secrets** — Access tokens, refresh tokens, and client secrets NEVER written to VS Code settings, logs, or telemetry
- **Interface Segregation** — Each module has a single responsibility; dependencies injected via constructor
- **Graceful Degradation** — Kiro provider failure does not affect Anthropic/OpenAI/Ollama providers
- **Existing Pattern Conformance** — Follow the established `AnthropicProvider` pattern for structure and naming

### 1.5 Constraints

- Must run within VS Code extension host (single-threaded event loop, no native addons)
- Cannot use `@aws-sdk/client-sso-oidc` — too heavy; raw `fetch` to SSO OIDC endpoint instead
- Must not impact extension activation time by more than 200ms
- Must maintain backward compatibility with existing `LlmProvider` interface and `LlmProviderType` union
- File system access limited to `~/.aws/sso/cache/` (read) and the same directory (write-back on refresh)
- Must work cross-platform (Windows, macOS, Linux) with different path conventions

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-231.docx |
| FSD | FSD-v1-KSA-231.docx |
| LlmProvider Interface | `src/langgraph/llm-provider.ts` |
| AnthropicProvider Reference | `src/langgraph/providers/anthropic-provider.ts` |
| Provider Factory | `src/langgraph/providers/index.ts` |
| AWS SSO OIDC API | https://docs.aws.amazon.com/singlesignon/latest/OIDCAPIReference/ |

---

## 2. System Architecture

### 2.1 Architecture Overview

The Kiro API Client is a set of 5 TypeScript modules integrated into the existing LLM provider layer. It follows the same architectural pattern as `AnthropicProvider` — constructor injection, lazy client initialization, and VS Code API integration.

![Architecture Diagram](diagrams/architecture.png)

**Key Design Decisions:**

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Native `fetch` instead of axios/got | Zero dependencies; Node 18+ guarantees availability |
| 2 | Mutex via simple Promise chain | No `async-mutex` package needed; single-threaded environment |
| 3 | `FileSystemWatcher` from VS Code API | Native file watching, cross-platform, already in extension host |
| 4 | In-memory credential cache | Security requirement BR-01; no SecretStorage (different from Anthropic key) |
| 5 | Adapter pattern for Kiro to Anthropic | Same response format enables zero-change integration with LangGraph |

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| KiroClient | Orchestrates auth + request + stream; implements `LlmProvider` | TypeScript class |
| TokenManager | Detects, stores, refreshes AWS SSO credentials | fetch + FileSystemWatcher |
| AnthropicAdapter | Transforms request/response between Kiro API and Anthropic format | Pure TypeScript mapping |
| StreamHandler | Parses SSE text/event-stream into token chunks | ReadableStream + TextDecoder |
| ModelRegistry | Fetches, caches, and serves model list | fetch + VS Code settings API |
| Provider Factory (modified) | Creates KiroClient when provider type = "kiro" | Existing factory extension |

### 2.3 Deployment Architecture

The Kiro Client runs entirely within the VS Code extension host process. No separate process, no network binding, no Docker container.

![Deployment Diagram](diagrams/deployment.png)

**Runtime Topology:**

| Layer | Where | What |
|-------|-------|------|
| Extension Host | VS Code Process | All 5 modules run here |
| File System | `~/.aws/sso/cache/` | Credential cache (read/write) |
| Network (outbound) | Internet/VPN | SSO OIDC endpoint + Kiro API |
| VS Code Storage | `settings.json` | Only `kiroSdlc.kiroModel` and `kiroSdlc.llmProvider` |

### 2.4 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| KiroClient | TokenManager | In-process call | Sync | Get current access token |
| KiroClient | AnthropicAdapter | In-process call | Sync | Format request body |
| KiroClient | Kiro API | HTTPS POST | Async (streaming) | Send chat request |
| KiroClient | StreamHandler | In-process | Async Generator | Parse SSE response |
| TokenManager | AWS SSO OIDC | HTTPS POST | Async | Refresh token |
| TokenManager | File System | fs.readFile/writeFile | Async | Read/write cache |
| TokenManager | VS Code API | FileSystemWatcher | Event-driven | Detect new credentials |
| ModelRegistry | Kiro API | HTTPS GET | Async | Fetch model list |
| ModelRegistry | VS Code Settings | getConfiguration | Sync | Read/persist model selection |

---

## 3. API Design

> **Prerequisite:** Functional API contracts (parameters, business errors, data flows) are defined in FSD section 5. This section specifies the technical implementation of the internal TypeScript APIs exposed by each module.

### 3.1 API Overview

These are internal TypeScript APIs (not REST endpoints). The extension does not expose any HTTP server.

| # | Module | Key Method | Description | Implements |
|---|--------|-----------|-------------|------------|
| 1 | KiroClient | `chat(messages, options)` | Non-streaming completion | `LlmProvider.chat` |
| 2 | KiroClient | `chatStream(messages, options)` | Streaming completion | `LlmProvider.chatStream` |
| 3 | KiroClient | `chatWithTools(messages, tools, options)` | Tool calling | `LlmProvider.chatWithTools` |
| 4 | KiroClient | `isAvailable()` | Check if credentials valid | `LlmProvider.isAvailable` |
| 5 | KiroClient | `dispose()` | Cleanup resources | `LlmProvider.dispose` |
| 6 | TokenManager | `getAccessToken()` | Get current valid token | Internal |
| 7 | TokenManager | `initialize()` | Scan cache, start watcher | Internal |
| 8 | TokenManager | `getStatus()` | Get credential status | Internal |
| 9 | ModelRegistry | `getModels(forceRefresh?)` | Get model list | Internal |
| 10 | ModelRegistry | `getSelectedModel()` | Get VS Code setting value | Internal |

### 3.2 KiroClient — LlmProvider Implementation

**Type Signature:**

```typescript
export class KiroClient implements LlmProvider {
  readonly type: LlmProviderType = "kiro";
  
  constructor(outputChannel: vscode.OutputChannel);
  
  chat(messages: LlmMessage[], options?: LlmOptions): Promise<string>;
  chatStream(messages: LlmMessage[], options?: LlmOptions): AsyncGenerator<string>;
  chatWithTools(
    messages: LlmMessage[],
    tools: McpToolDefinition[],
    options?: LlmOptions
  ): Promise<LlmResponse>;
  isAvailable(): Promise<boolean>;
  dispose(): void;
}
```

**Design Notes:**
- No `getApiKey` callback needed (unlike AnthropicProvider) — credentials from TokenManager
- No `baseUrl` constructor param — endpoint derived from credential region
- OutputChannel for structured logging (no secret values)

### 3.3 TokenManager — Credential Lifecycle

**Type Signature:**

```typescript
export type CredentialStatus =
  | "active"
  | "refreshing"
  | "expired"
  | "no_credentials"
  | "unavailable";

export interface KiroCredentials {
  accessToken: string;
  expiresAt: Date;
  region: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  authMethod?: string;
  status: CredentialStatus;
  sourceFile: string;
}

export class TokenManager implements vscode.Disposable {
  constructor(outputChannel: vscode.OutputChannel);
  
  initialize(): Promise<void>;
  getAccessToken(): Promise<string>;  // throws if unavailable
  getRegion(): string | undefined;
  getStatus(): CredentialStatus;
  onStatusChange: vscode.Event<CredentialStatus>;
  dispose(): void;
}
```

**Internal State Machine:**

| Current State | Trigger | Next State | Action |
|---------------|---------|------------|--------|
| (initial) | `initialize()` called | ACTIVE / NO_CREDENTIALS / EXPIRED | Scan cache |
| ACTIVE | Timer fires (expiresAt - 5min) | REFRESHING | Call SSO OIDC |
| REFRESHING | Refresh succeeds | ACTIVE | Store new token, reschedule |
| REFRESHING | Refresh fails 3x | EXPIRED | Show notification |
| EXPIRED | FileWatcher detects new file | ACTIVE | Re-scan, select best |
| NO_CREDENTIALS | FileWatcher detects new file | ACTIVE | Scan new file |

### 3.4 AnthropicAdapter — Format Mapping

**Type Signature:**

```typescript
export class AnthropicAdapter {
  buildRequestBody(
    messages: LlmMessage[],
    options?: LlmOptions,
    tools?: McpToolDefinition[]
  ): KiroRequestBody;
  
  buildRequestHeaders(
    accessToken: string,
    modelId: string
  ): Record<string, string>;
  
  parseNonStreamResponse(json: any): LlmResponse;
  
  getEndpointUrl(region: string): string;
}
```

**Request Mapping (LlmMessage[] to Kiro API body):**

| LlmMessage field | Kiro API field | Transformation |
|-----------------|----------------|----------------|
| messages with role="system" | `body.system` | Extract, concatenate, remove from messages array |
| messages with role="user"/"assistant" | `body.messages[]` | Direct map: `{role, content}` |
| messages with role="tool" | `body.messages[]` | Wrap in user message: `{role:"user", content:[{type:"tool_result",...}]}` |
| options.model | `body.model` | Pass through (or use default from ModelRegistry) |
| options.maxTokens | `body.max_tokens` | Pass through (default 4096) |
| options.temperature | `body.temperature` | Pass through (only if defined) |
| tools[] | `body.tools[]` | Map: `{name, description, input_schema}` |

### 3.5 StreamHandler — SSE Processing

**Type Signature:**

```typescript
export class StreamHandler {
  processStream(
    response: Response,
    signal?: AbortSignal
  ): AsyncGenerator<string>;
  
  processStreamWithToolUse(
    response: Response,
    signal?: AbortSignal
  ): AsyncGenerator<StreamEvent>;
}

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "message_stop"; usage?: { input_tokens: number; output_tokens: number } };
```

**Backpressure Strategy:**
- Yield after every text delta chunk
- Every 100 chunks, insert a microtask boundary (`await Promise.resolve()`) to prevent event loop starvation
- If AbortSignal fires, call `reader.cancel()` and return from generator

### 3.6 ModelRegistry — Dynamic Model List

**Type Signature:**

```typescript
export interface KiroModel {
  id: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  capabilities: { chat: boolean; code: boolean; vision: boolean };
  maxOutputTokens?: number;
}

export class ModelRegistry implements vscode.Disposable {
  constructor(
    tokenManager: TokenManager,
    outputChannel: vscode.OutputChannel
  );
  
  getModels(forceRefresh?: boolean): Promise<KiroModel[]>;
  getSelectedModel(): string;
  setSelectedModel(modelId: string): Promise<void>;
  onModelsChanged: vscode.Event<KiroModel[]>;
  dispose(): void;
}
```

**Caching Strategy:**

| Scenario | Action |
|----------|--------|
| Cache age < 5 min | Return cached immediately |
| Cache age 5min-1h | Return cached; background refresh |
| Cache age > 1h | Block on API refresh; return result |
| API fails, cache exists | Return cached with stale indicator |
| API fails, no cache | Return empty; fire error event |

---

## 4. Database Design

> **N/A** — This feature has no database. All state is in-memory (credentials, model cache) or file system (`~/.aws/sso/cache/`). VS Code settings persist only `kiroSdlc.kiroModel` (string).

---

## 5. Class / Module Design

### 5.1 Package Structure

```
src/langgraph/providers/
├── kiro-client.ts          # KiroClient — main LlmProvider implementation
├── token-manager.ts        # TokenManager — credential lifecycle
├── anthropic-adapter.ts    # AnthropicAdapter — request/response mapping  [NEW - kiro-specific]
├── stream-handler.ts       # StreamHandler — SSE parsing
├── model-registry.ts       # ModelRegistry — model list caching
├── index.ts                # (MODIFIED) Add "kiro" case to factory
└── (existing files unchanged)
    ├── anthropic-provider.ts
    ├── openai-provider.ts
    ├── ollama-provider.ts
    └── onnx-provider.ts

src/langgraph/
├── llm-provider.ts         # (MODIFIED) Add "kiro" to LlmProviderType union
└── (other files unchanged)
```

**Note:** The new `anthropic-adapter.ts` for Kiro is separate from the existing `anthropic-provider.ts`. Naming reflects its role (adapts Kiro API responses TO Anthropic format), not a conflict with the existing provider file.

### 5.2 Key Interfaces

**LlmProviderType Extension:**

```typescript
// llm-provider.ts — line change
export type LlmProviderType = "anthropic" | "openai" | "ollama" | "kiro";
```

**Provider Factory Extension:**

```typescript
// providers/index.ts — add case in createProviderByType switch
case "kiro": {
  const { KiroClient } = require("./kiro-client");
  const outputChannel = vscode.window.createOutputChannel("Kiro API Client");
  return new KiroClient(outputChannel);
}
```

**TokenManager Events:**

```typescript
// token-manager.ts
private _onStatusChange = new vscode.EventEmitter<CredentialStatus>();
readonly onStatusChange: vscode.Event<CredentialStatus> = this._onStatusChange.event;
```

### 5.3 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Adapter | AnthropicAdapter | Maps Kiro API format to existing LlmProvider contract |
| Singleton (per instance) | TokenManager.refreshMutex | Prevents concurrent token refreshes (BR-07) |
| Observer | TokenManager.onStatusChange, ModelRegistry.onModelsChanged | Decouple UI updates from credential/model changes |
| Strategy | Provider Factory switch-case | Select provider based on user setting |
| Lazy Initialization | KiroClient (defers TokenManager.initialize) | Meet < 200ms activation requirement |
| Template Method | StreamHandler.processStream | Common SSE parsing, specialized event handling |

### 5.4 Mutex Implementation

No external package. Simple Promise-based mutex for single-threaded Node.js:

```typescript
class Mutex {
  private locked = false;
  private queue: (() => void)[] = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>(resolve => this.queue.push(resolve));
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }

  isLocked(): boolean {
    return this.locked;
  }
}
```

### 5.5 Error Handling

| Error Class | Trigger | User Notification | Recovery |
|-------------|---------|-------------------|----------|
| `KiroCredentialError` | No cache dir / all expired / parse error | VS Code warning notification | Auto-retry on FileWatcher event |
| `KiroRefreshError` | SSO OIDC 400/network failure after 3 retries | "Cannot refresh token" notification | Retry button / auto-retry 30s |
| `KiroApiError` | HTTP 4xx/5xx from Kiro API | "Cannot reach Kiro API" notification | Auto-retry with backoff |
| `KiroStreamError` | Network drop mid-stream / malformed SSE | "Connection lost" notification | Preserve partial content |
| `KiroModelError` | Model not found / list empty | "Model not available" notification | Open Settings action |

**Error wrapping pattern:**

```typescript
try {
  // API call
} catch (err) {
  this.outputChannel.appendLine(`[ERROR] ${(err as Error).message}`);
  // NEVER log accessToken, refreshToken, clientSecret
  throw new KiroApiError(
    "Cannot reach Kiro API. Check network.",
    { cause: err }
  );
}
```

### 5.6 Security Design

| Concern | Implementation |
|---------|---------------|
| Credential storage | In-memory only — private fields, no getters that expose raw token |
| Logging safety | Custom `safeLog()` that replaces token patterns with `[REDACTED]` |
| Memory cleanup | `dispose()` sets all credential fields to empty string |
| Output Channel | Show only: status changes, error codes, request timing. NEVER token values |
| Telemetry | Extension telemetry events exclude all credential-related data |
| HTTPS enforcement | `getEndpointUrl()` always returns `https://` — no HTTP fallback |

---

## 6. Integration Design

> **Prerequisite:** Business integration requirements are defined in FSD section 5. This section specifies technical implementation details.

### 6.1 External System: AWS SSO OIDC — Token Refresh

| Attribute | Value |
|-----------|-------|
| Protocol | HTTPS POST |
| Endpoint | `https://oidc.{region}.amazonaws.com/token` |
| Authentication | None (clientId + clientSecret in body) |
| Timeout | 10,000ms |
| Retry Policy | 3 attempts, exponential backoff (1s, 2s, 4s) |
| Circuit Breaker | N/A (infrequent calls, approximately 1/hour) |

**Request Construction:**

```typescript
const response = await fetch(
  `https://oidc.${region}.amazonaws.com/token`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId,
      clientSecret,
      grantType: "refresh_token",
      refreshToken
    }),
    signal: AbortSignal.timeout(10_000)
  }
);
```

**Response Handling:**

| HTTP Status | Action |
|-------------|--------|
| 200 | Parse JSON; update credentials; write-back to cache file |
| 400 (invalid_grant) | Mark expired; show "re-login" notification; stop timer |
| 400 (other) | Log error; retry |
| 5xx | Retry with backoff |
| Network error | Retry with backoff |

### 6.2 External System: Kiro API — Chat Completions

| Attribute | Value |
|-----------|-------|
| Protocol | HTTPS POST (SSE response) |
| Endpoint | `https://kiro.api.{region}.amazonaws.com/v1/messages` |
| Authentication | Bearer token (Authorization header) |
| Timeout | 30,000ms (connect) / unlimited (stream) |
| Retry Policy | 401: refresh + retry once; 429: respect Retry-After; 5xx: 2 retries |
| Circuit Breaker | N/A (user-triggered, not automated) |

**Request Construction:**

```typescript
const response = await fetch(
  `https://kiro.api.${region}.amazonaws.com/v1/messages`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      "X-Model-Id": modelId,
      "Accept": "text/event-stream"
    },
    body: JSON.stringify(requestBody),
    signal  // user-provided AbortSignal
  }
);
```

**401 Retry Flow:**

```
1. Send request -> receive 401
2. Call tokenManager.refreshToken() (force)
3. Get new access token
4. Retry request with new token
5. If 401 again -> throw KiroApiError (do not loop)
```

### 6.3 External System: Kiro API — Model Listing

| Attribute | Value |
|-----------|-------|
| Protocol | HTTPS GET |
| Endpoint | `https://kiro.api.{region}.amazonaws.com/v1/models` |
| Authentication | Bearer token |
| Timeout | 10,000ms |
| Retry Policy | 1 retry on failure |
| Conditional Request | `If-None-Match: {etag}` returns 304 = use cache |

**ETag Caching:**

```typescript
// Store etag from response
const etag = response.headers.get("ETag");
if (etag) this.cachedEtag = etag;

// Next request includes it
headers["If-None-Match"] = this.cachedEtag;

// If 304 -> cache is still valid
if (response.status === 304) return this.cachedModels;
```

### 6.4 Internal Integration: Provider Factory

**Changes to `src/langgraph/providers/index.ts`:**

```typescript
// Add case in createProviderByType switch:
case "kiro": {
  const { KiroClient } = require("./kiro-client");
  const outputChannel = vscode.window.createOutputChannel("Kiro API Client");
  return new KiroClient(outputChannel);
}
```

**Changes to `src/langgraph/llm-provider.ts`:**

```typescript
export type LlmProviderType = "anthropic" | "openai" | "ollama" | "kiro";
```

### 6.5 Internal Integration: VS Code Settings

**New Settings (contributed via package.json):**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kiroSdlc.kiroModel` | string | `""` | Selected Kiro model ID (auto-populated from API) |
| `kiroSdlc.kiroRegion` | string | `""` | Override region (empty = auto-detect from credential) |

**Settings Panel Integration:**
- When `kiroSdlc.llmProvider = "kiro"`, show model dropdown
- Dropdown populated by `ModelRegistry.getModels()`
- Models grouped by `provider` field (section headers)
- Selection saved to `kiroSdlc.kiroModel`

---

## 7. Security Design

> **Prerequisite:** Business security requirements defined in FSD section 7. This section specifies technical implementation.

### 7.1 Authentication

The Kiro API uses Bearer token authentication. Tokens are AWS SSO OIDC access tokens — not API keys, not JWTs we validate ourselves.

Token lifecycle is fully managed by TokenManager — no user interaction required after initial AWS SSO login.

### 7.2 Authorization

| Role | Access | Controlled By |
|------|--------|---------------|
| Extension user | All models in their Kiro subscription | Kiro API server-side |
| TokenManager | SSO OIDC refresh endpoint | AWS IAM policies |

There are no local authorization checks. The Kiro API enforces model access based on the bearer token's associated account.

### 7.3 Data Protection

| Data Type | At Rest | In Transit | In Logs | In Memory |
|-----------|---------|------------|---------|-----------|
| accessToken | `~/.aws/sso/cache/` (OS manages) | TLS 1.2+ | NEVER | Yes (cleared on dispose) |
| refreshToken | `~/.aws/sso/cache/` (OS manages) | TLS 1.2+ | NEVER | Yes (cleared on dispose) |
| clientSecret | `~/.aws/sso/cache/` (OS manages) | TLS 1.2+ | NEVER | Yes (cleared on dispose) |
| Chat messages | Not persisted | TLS 1.2+ | NEVER | Transient during request |
| Model list | Not persisted (in-memory cache) | TLS 1.2+ | IDs only (safe) | Yes |
| Selected model ID | `settings.json` | N/A | Safe (public ID) | Yes |

### 7.4 Input Validation

| Input | Validation | On Failure |
|-------|-----------|------------|
| Cache file JSON | Try-catch parse; check required fields | Skip file, continue scanning |
| SSO OIDC response | HTTP status + JSON schema check | Retry or mark expired |
| Kiro API response | HTTP status check | Error notification |
| SSE chunk data | JSON.parse in try-catch | Skip malformed chunk |
| Model ID from settings | Check against cached model list | Use first available model |
| Region string | Regex: `/^[a-z]{2}-[a-z]+-\d+$/` | Show error; refuse to connect |

### 7.5 Threat Model

| Threat | Mitigation |
|--------|-----------|
| Token logged accidentally | `safeLog()` redacts patterns matching `/ao[ar][A-Z]+/` |
| Extension host memory dump | Cannot prevent (OS-level); tokens short-lived (about 1h) |
| Man-in-the-middle on OIDC | HTTPS enforced; Node.js validates TLS certs |
| Malicious cache file injection | Only read from `~/.aws/sso/cache/`; validate JSON schema |
| Token replay after dispose | All in-memory tokens zeroed in `dispose()` |

---

## 8. Performance and Scalability

### 8.1 Caching Strategy

| Cache | What | TTL | Eviction | Technology |
|-------|------|-----|----------|------------|
| Model cache | KiroModel[] array | 1 hour (BR-11) | TTL-based; force-refresh on Settings open if > 5min | In-memory (ModelRegistry.cache) |
| Credential cache | KiroCredentials object | Until expires (50-55 min) | Replaced on successful refresh | In-memory (TokenManager.credentials) |
| ETag | String from API response | Until next request | Overwritten on each response | In-memory (ModelRegistry.cachedEtag) |

### 8.2 Connection Management

| Resource | Strategy | Config |
|----------|----------|--------|
| HTTP connections | Node.js built-in HTTP agent (keep-alive) | Default pool; no custom agent |
| SSE streams | Single stream per `chatStream` call; closed on completion or abort | No pool |
| FileSystemWatcher | Single instance watching `~/.aws/sso/cache/` | Created on initialize; disposed with TokenManager |
| Timers | One `setTimeout` for token refresh | Cleared on dispose |

### 8.3 Performance Targets

| Operation | Target | How to Achieve |
|-----------|--------|----------------|
| Extension activation impact | < 200ms | Lazy init: do not scan cache until `isAvailable()` or first `chat()` call |
| Credential detection | < 2s | Read directory listing + parse JSON files in parallel |
| Token refresh | < 3s | Single HTTPS POST; 10s timeout |
| TTFT (client overhead) | < 1s | Pre-validate token; single fetch call; no request queue |
| Stream memory | Constant (no buffering) | AsyncGenerator yields immediately; no accumulator array |
| Model list fetch | < 2s | Conditional request (ETag); cached response |
| Abort response time | < 100ms | `reader.cancel()` on AbortSignal; no cleanup delay |

### 8.4 Memory Optimization for Long Streams

```typescript
// StreamHandler yields each chunk immediately — no accumulation
async *processStream(response: Response): AsyncGenerator<string> {
  // No: const allChunks: string[] = [];
  // Yes: yield each chunk as it arrives
  for await (const chunk of this.parseSSE(response)) {
    yield chunk.text;  // GC can collect previous chunks
  }
}
```

For the `chat()` (non-streaming) method, concatenation happens at the caller level (KiroClient), not in StreamHandler.

---

## 9. Monitoring and Observability

### 9.1 Logging (Output Channel)

| Log Event | Level | Fields | Example |
|-----------|-------|--------|---------|
| Credential detected | INFO | region, authMethod, expiresAt | `[INFO] Credential detected: region=ap-southeast-1, expires in 55min` |
| Token refresh start | INFO | attempt number | `[INFO] Refreshing token (attempt 1/3)` |
| Token refresh success | INFO | new expiry | `[INFO] Token refreshed. Expires at 2026-06-05T05:42:00Z` |
| Token refresh fail | WARN | HTTP status, attempt | `[WARN] Refresh failed: HTTP 400 (attempt 2/3)` |
| Chat request start | INFO | model, message count | `[INFO] Chat request: model=deepseek-r1, messages=5` |
| Stream complete | INFO | tokens count, duration | `[INFO] Stream complete: 1234 tokens in 8.5s` |
| API error | ERROR | HTTP status, endpoint | `[ERROR] Kiro API: HTTP 503 at /v1/messages` |
| Model list updated | INFO | count, new models | `[INFO] Models updated: 8 models (2 new)` |

**NEVER logged:** accessToken, refreshToken, clientSecret, clientId, message content.

### 9.2 Status Bar Indicator

| Credential Status | Status Bar Text | Icon |
|-------------------|----------------|------|
| active | `$(check) Kiro: Connected` | Green check |
| refreshing | `$(sync~spin) Kiro: Refreshing...` | Spinning sync |
| expired | `$(warning) Kiro: Expired` | Yellow warning |
| no_credentials | `$(x) Kiro: No credentials` | Red X |
| unavailable | `$(error) Kiro: Unavailable` | Red error |

### 9.3 Telemetry Events (safe data only)

| Event | Properties (no PII) |
|-------|---------------------|
| `kiro.provider.activated` | region (hashed), modelId |
| `kiro.chat.request` | model, stream (bool), tokenCount (input) |
| `kiro.chat.complete` | duration_ms, outputTokens |
| `kiro.chat.error` | errorType (credential/api/stream), httpStatus |
| `kiro.token.refresh` | success (bool), attempt |

---

## 10. Deployment Considerations

### 10.1 Package.json Changes

**New VS Code settings contributions:**

```json
{
  "kiroSdlc.llmProvider": {
    "type": "string",
    "enum": ["anthropic", "openai", "ollama", "kiro"],
    "default": "anthropic",
    "description": "LLM provider to use"
  },
  "kiroSdlc.kiroModel": {
    "type": "string",
    "default": "",
    "description": "Selected Kiro model ID"
  },
  "kiroSdlc.kiroRegion": {
    "type": "string",
    "default": "",
    "description": "AWS region for Kiro API (auto-detected if empty)"
  }
}
```

### 10.2 Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| N/A | — | No feature flags needed; provider selection via `kiroSdlc.llmProvider` acts as the toggle |

### 10.3 Rollback Strategy

1. User changes `kiroSdlc.llmProvider` back to `"anthropic"` (with kiro-rs baseUrl) — instant rollback
2. If code breaks extension: revert commit; publish previous VSIX version
3. No data migration needed (no persistent state beyond settings)

### 10.4 Migration Guide (kiro-rs to native)

| Step | Before (kiro-rs) | After (native) |
|------|------------------|----------------|
| 1 | Install kiro-rs.exe | No action needed |
| 2 | Start kiro-rs manually | No action needed |
| 3 | Set provider = "anthropic", baseUrl = "http://localhost:8990" | Set provider = "kiro" |
| 4 | kiro-rs manages tokens | Extension manages tokens automatically |
| 5 | Model hardcoded or limited | Full model list from API |

### 10.5 Backward Compatibility

- `kiro-rs` users can keep using `provider: "anthropic"` + `baseUrl: "http://localhost:8990"` — no change needed
- Native Kiro client is opt-in via `provider: "kiro"` setting change
- Existing Anthropic/OpenAI/Ollama providers completely unaffected
- `LlmProviderType` union extension is additive (no breaking change)

---

## 11. Implementation Checklist

### 11.1 Files to Create

| # | File | LOC (est.) | Priority | Dependencies |
|---|------|-----------|----------|--------------|
| 1 | `src/langgraph/providers/token-manager.ts` | ~250 | P0 | VS Code API, native fetch |
| 2 | `src/langgraph/providers/stream-handler.ts` | ~100 | P0 | None (pure TypeScript) |
| 3 | `src/langgraph/providers/anthropic-adapter.ts` | ~120 | P0 | LlmMessage types |
| 4 | `src/langgraph/providers/model-registry.ts` | ~150 | P1 | TokenManager, VS Code settings |
| 5 | `src/langgraph/providers/kiro-client.ts` | ~200 | P0 | All above modules |

### 11.2 Files to Modify

| # | File | Change | Impact |
|---|------|--------|--------|
| 1 | `src/langgraph/llm-provider.ts` | Add `"kiro"` to `LlmProviderType` union | Minimal — additive |
| 2 | `src/langgraph/providers/index.ts` | Add `case "kiro"` in factory switch | Minimal — new case |
| 3 | `package.json` | Add `kiroSdlc.kiroModel`, `kiroSdlc.kiroRegion` settings | Settings contribution |

### 11.3 Implementation Order

```
Phase 1 (Foundation):
  1. token-manager.ts — credential scanning + in-memory storage
  2. stream-handler.ts — SSE parsing (pure, no dependencies)
  3. anthropic-adapter.ts — request/response mapping (pure)

Phase 2 (Integration):
  4. model-registry.ts — requires TokenManager for auth
  5. kiro-client.ts — orchestrates all modules

Phase 3 (Wiring):
  6. Modify llm-provider.ts — add type
  7. Modify providers/index.ts — add factory case
  8. Modify package.json — add settings

Phase 4 (Polish):
  9. Status bar indicator
  10. Error notifications with action buttons
  11. Settings Panel model dropdown population
```

### 11.4 Test Strategy

| Module | Test Type | Key Scenarios |
|--------|-----------|---------------|
| TokenManager | Unit (mocked fs) | Multi-file selection, expired filtering, idc priority |
| TokenManager | Unit (mocked fetch) | Refresh success, retry, invalid_grant |
| StreamHandler | Unit (mocked stream) | Normal stream, abort, malformed data, [DONE] |
| AnthropicAdapter | Unit (pure) | Message mapping, system extraction, tool format |
| ModelRegistry | Unit (mocked fetch) | Cache hit, cache miss, conditional request, API failure |
| KiroClient | Integration | Full flow: token -> request -> stream -> response |

---

## 12. Appendix

### 12.1 Glossary

| Term | Definition |
|------|------------|
| SSO OIDC | AWS Single Sign-On OpenID Connect — token management protocol |
| SSE | Server-Sent Events — HTTP streaming protocol |
| TTFT | Time To First Token — latency metric |
| Mutex | Mutual exclusion lock preventing concurrent access |
| ETag | HTTP header for conditional requests (cache validation) |
| LlmProvider | Extension interface for LLM backends (KSA-210) |

### 12.2 Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Does Kiro API support tool_use for all models? | Open | Assume yes; degrade gracefully if not |
| 2 | Is there a rate limit per-account on Kiro API? | Open | Implement Retry-After handling regardless |
| 3 | Can multiple extensions share the same SSO cache file? | Resolved | Yes — file-level locking not needed; atomic read |

### 12.3 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
| 3 | Deployment Diagram | [deployment.png](diagrams/deployment.png) | [deployment.drawio](diagrams/deployment.drawio) |
| 4 | Class Diagram | [class-diagram.png](diagrams/class-diagram.png) | [class-diagram.drawio](diagrams/class-diagram.drawio) |

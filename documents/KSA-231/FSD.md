# Functional Specification Document (FSD)

## Kiro SDLC Agents Extension — KSA-231: Tích hợp Kiro API Client (Node.js) vào Extension — Thay thế kiro-rs Proxy

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-231 |
| Title | Tích hợp Kiro API Client (Node.js) vào Extension — Thay thế kiro-rs Proxy |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-231.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create FSD draft (Use Cases, Business Rules, Data Specs) |
| Reviewer | TA Agent – Technical Analyst | Enrich with API Contracts, Integration Specs, Pseudocode |
| Approver | SM Agent – Scrum Master | Review and approve document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | BA Agent + TA Agent | Initial FSD — BA draft + TA enrichment |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the native Kiro API Client integrated directly into the `kiro-sdlc-agents` VS Code extension. It replaces the external `kiro-rs.exe` proxy with five TypeScript modules: `kiro-client.ts`, `token-manager.ts`, `anthropic-adapter.ts`, `stream-handler.ts`, and `model-registry.ts`.

### 1.2 Scope

- Auto-detection and management of AWS SSO credentials from `~/.aws/sso/cache/`
- Token auto-refresh via AWS SSO OIDC `CreateToken` API
- Direct communication with Kiro API (chat completions + model listing)
- SSE stream processing and adaptation to existing `LlmProvider` interface
- Dynamic model registry populating Settings Panel
- Registration as a new `"kiro"` provider type in the LLM provider factory

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| SSO | Single Sign-On — AWS IAM Identity Center |
| OIDC | OpenID Connect — authentication protocol for token management |
| SSE | Server-Sent Events — HTTP streaming protocol |
| TTFT | Time To First Token — latency from request to first streamed chunk |
| kiro-rs | External Rust proxy being replaced (https://github.com/hank9999/kiro.rs) |
| LlmProvider | TypeScript interface from KSA-210 that all providers implement |
| Kiro API | AWS-hosted API providing LLM chat completions (Anthropic-compatible format) |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-231.docx |
| LlmProvider Interface | `src/langgraph/llm-provider.ts` |
| Existing AnthropicProvider | `src/langgraph/providers/anthropic-provider.ts` |
| Provider Factory | `src/langgraph/providers/index.ts` |
| kiro-rs Reference | https://github.com/hank9999/kiro.rs |
| AWS SSO OIDC API | https://docs.aws.amazon.com/singlesignon/latest/OIDCAPIReference/ |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

**External Actors:**
- **Developer** — uses VS Code Chat Panel to interact with AI models
- **AWS SSO OIDC** — token refresh endpoint (`sso-oidc.{region}.amazonaws.com`)
- **Kiro API** — chat completions and model listing endpoint
- **File System** — `~/.aws/sso/cache/` for credential storage

**System Boundary:**
- KiroClient (orchestrator) → TokenManager → AnthropicAdapter → StreamHandler → ModelRegistry
- All modules run within VS Code extension host process

### 2.2 System Architecture

The Kiro API Client consists of 5 modules integrated into the existing provider layer:

| Module | Responsibility | Dependencies |
|--------|---------------|--------------|
| KiroClient | Main provider class implementing `LlmProvider` interface | TokenManager, AnthropicAdapter, ModelRegistry |
| TokenManager | Credential detection, in-memory storage, auto-refresh | AWS SSO OIDC API, FileSystem |
| AnthropicAdapter | Transform Kiro API requests/responses to Anthropic format | Kiro API |
| StreamHandler | Parse SSE chunks, yield tokens, handle backpressure | HTTP response stream |
| ModelRegistry | Fetch/cache model list, integrate with Settings Panel | Kiro API, VS Code settings |

---

## 3. Functional Requirements

### 3.1 Feature: Credential Auto-Detection

**Source:** BRD Story 1

#### 3.1.1 Description

On extension activation (or on-demand), TokenManager scans `~/.aws/sso/cache/` for JSON files containing valid AWS SSO OIDC tokens. It selects the best candidate and stores credentials in memory.

#### 3.1.2 Use Case: UC-01 — Detect AWS SSO Credentials on Activation

**Use Case ID:** UC-01
**Actor:** Extension Host (automatic on activation)
**Preconditions:** Extension activates; `~/.aws/sso/cache/` directory exists
**Postconditions:** Valid token stored in memory; provider marked as available

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | TokenManager | Resolve cache path: `~/.aws/sso/cache/` (cross-platform) |
| 2 | | TokenManager | List all `.json` files in cache directory |
| 3 | | TokenManager | Parse each JSON file; filter for files containing `accessToken`, `expiresAt`, `refreshToken` |
| 4 | | TokenManager | Filter out expired tokens (`expiresAt < now`) |
| 5 | | TokenManager | Select best candidate: prefer `authMethod: "idc"`, then most recent `expiresAt` |
| 6 | | TokenManager | Store selected credentials in memory (never disk/settings) |
| 7 | | TokenManager | Start FileSystemWatcher on cache directory for live updates |
| 8 | | TokenManager | Schedule refresh timer for `expiresAt - 5 minutes` |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01a | Multiple valid tokens exist | Select by priority: `authMethod: "idc"` > most recent `expiresAt` > first found |
| AF-01b | Cache directory empty but exists | Set provider status = "no_credentials"; show info notification |
| AF-01c | New credential file appears (FileWatcher) | Re-run selection algorithm; update in-memory token if better |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01a | `~/.aws/sso/cache/` does not exist | Show notification: "AWS SSO cache not found. Please login via Kiro IDE."; provider status = "unavailable" |
| EF-01b | All tokens expired | Show notification: "Kiro session expired. Please re-login via Kiro IDE."; provider status = "expired" |
| EF-01c | JSON parse error on cache file | Log warning to Output Channel; skip file; continue scanning others |
| EF-01d | File locked by another process | Retry read once after 500ms; if still locked, skip file |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | Credentials MUST only exist in memory — never written to settings.json, telemetry, or logs | BRD §6 Security |
| BR-02 | Token selection priority: `authMethod: "idc"` > newest `expiresAt` | BRD Story 1 |
| BR-03 | Credential detection must complete within 2 seconds | BRD §6 Performance |
| BR-04 | FileSystemWatcher must detect new/updated files in cache directory | BRD Story 1 AC-5 |
| BR-05 | Cross-platform path resolution: `%USERPROFILE%\.aws\sso\cache\` (Windows), `~/.aws/sso/cache/` (macOS/Linux) | BRD Story 1 AC-4 |

#### 3.1.4 Data Specifications

**Input Data (SSO Cache File):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| accessToken | string | Yes | Non-empty, starts with "aoa" | AWS SSO OIDC access token |
| expiresAt | string (ISO 8601) | Yes | Valid date, parseable by `Date()` | Token expiration timestamp |
| region | string | Yes | AWS region format (e.g., "ap-southeast-1") | Region for API calls |
| clientId | string | Yes | Non-empty, base64-like | SSO OIDC client identifier |
| clientSecret | string | Yes | Non-empty, JWT format | SSO OIDC client secret |
| refreshToken | string | Yes | Non-empty, starts with "aor" | Token for refreshing access |
| authMethod | string | No | "idc" preferred | Authentication method identifier |

**Output Data (In-Memory Credential State):**

| Field | Type | Description |
|-------|------|-------------|
| accessToken | string | Current valid access token |
| expiresAt | Date | Parsed expiration timestamp |
| region | string | AWS region for Kiro API |
| refreshToken | string | For token refresh |
| clientId | string | For refresh API call |
| clientSecret | string | For refresh API call |
| status | CredentialStatus | "active" / "refreshing" / "expired" / "unavailable" |
| sourceFile | string | Path to source cache file (for write-back) |

---

### 3.2 Feature: Token Auto-Refresh

**Source:** BRD Story 2

#### 3.2.1 Description

TokenManager proactively refreshes the access token before expiry (5 minutes before `expiresAt`) using AWS SSO OIDC `CreateToken` API with `grant_type: "refresh_token"`.

#### 3.2.2 Use Case: UC-02 — Auto-Refresh Token Before Expiry

**Use Case ID:** UC-02
**Actor:** TokenManager (timer-driven, automatic)
**Preconditions:** Valid credentials in memory; refresh timer scheduled
**Postconditions:** New access token stored; refresh timer rescheduled

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | TokenManager | Timer fires at `expiresAt - 5 minutes` |
| 2 | | TokenManager | Acquire refresh mutex (prevent concurrent refreshes) |
| 3 | | TokenManager | Call SSO OIDC `CreateToken` API with `grant_type: "refresh_token"` |
| 4 | | TokenManager | Receive new `accessToken`, `refreshToken`, `expiresAt` |
| 5 | | TokenManager | Update in-memory credentials |
| 6 | | TokenManager | Write updated credentials back to source cache file |
| 7 | | TokenManager | Release refresh mutex |
| 8 | | TokenManager | Schedule new refresh timer for new `expiresAt - 5 minutes` |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-02a | In-flight API calls during refresh | Old token remains valid until expiry; calls continue uninterrupted |
| AF-02b | Network timeout on refresh | Retry 3 times with exponential backoff (1s, 2s, 4s) |
| AF-02c | Manual trigger (user action "Refresh Token") | Skip timer wait; execute refresh immediately |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-02a | Refresh token itself expired (HTTP 400: invalid_grant) | Set status = "expired"; show notification: "Kiro session expired. Please re-login."; stop timer |
| EF-02b | All 3 retries fail (network unreachable) | Show notification: "Cannot refresh token. Check network."; retry again in 30 seconds |
| EF-02c | Write-back to cache file fails (permission denied) | Log warning; keep refreshed token in memory (kiro-rs may desync) |
| EF-02d | Concurrent refresh attempt | Second attempt waits for mutex; uses result from first refresh |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-06 | Refresh MUST happen at most 5 minutes before expiry | BRD Story 2 AC-2 |
| BR-07 | Maximum 1 concurrent refresh operation (mutex) | BRD Story 2 AC-6 |
| BR-08 | Retry 3 times with exponential backoff (1s, 2s, 4s) on network failure | BRD §6 Reliability |
| BR-09 | Updated credentials written back to cache file (sync with kiro-rs) | BRD Story 2 AC-5 |
| BR-10 | In-flight API calls MUST NOT be interrupted during refresh | BRD Story 2 AC-3 |

#### 3.2.4 Data Specifications

**CreateToken Request:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clientId | string | Yes | From stored credentials |
| clientSecret | string | Yes | From stored credentials |
| grantType | string | Yes | Always "refresh_token" |
| refreshToken | string | Yes | Current refresh token |

**CreateToken Response:**

| Field | Type | Description |
|-------|------|-------------|
| accessToken | string | New access token |
| refreshToken | string | New refresh token (replaces old) |
| expiresIn | number | Seconds until expiry |
| tokenType | string | Always "Bearer" |

---

### 3.3 Feature: Model Registry

**Source:** BRD Story 3, Story 8

#### 3.3.1 Description

ModelRegistry fetches available models from Kiro API, caches them locally with 1-hour TTL, and populates the Settings Panel dropdown dynamically.

#### 3.3.2 Use Case: UC-03 — Load Available Models

**Use Case ID:** UC-03
**Actor:** Developer (opens Settings Panel or extension activates)
**Preconditions:** Valid access token available
**Postconditions:** Model list populated in Settings Panel dropdown

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Opens Settings Panel (or extension activates) |
| 2 | | ModelRegistry | Check in-memory cache age |
| 3 | | ModelRegistry | If cache < 1 hour old → use cached list (skip to step 7) |
| 4 | | ModelRegistry | Call Kiro API `/models` endpoint with Bearer token |
| 5 | | ModelRegistry | Parse response → array of `KiroModel` objects |
| 6 | | ModelRegistry | Store in cache with timestamp |
| 7 | | ModelRegistry | Return model list to Settings Panel |
| 8 | | Settings Panel | Populate dropdown grouped by provider |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-03a | Settings Panel opened and cache > 5 min old | Force-refresh from API (even if < 1 hour) |
| AF-03b | New models detected vs previous list | Show subtle notification: "New Kiro models available" |
| AF-03c | Currently selected model removed from API | Show warning: "Model {name} no longer available. Select another." |
| AF-03d | Background periodic refresh (every 1 hour) | Silent refresh; update cache; no notification unless new models |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-03a | API unreachable, cache exists | Use cached list; append "(cached)" indicator to dropdown |
| EF-03b | API unreachable, no cache | Show message in dropdown: "Cannot load models. Check connection." |
| EF-03c | API returns empty model list | Show warning; keep previous cache if available |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-11 | Model list cached with 1-hour TTL | BRD Story 3 |
| BR-12 | Force-refresh when Settings Panel opened and cache > 5 minutes | BRD Story 8 |
| BR-13 | Models grouped by provider in dropdown (DeepSeek section, Qwen section, etc.) | BRD Story 3 AC-2 |
| BR-14 | Default model: first model with `capabilities.chat = true` | BRD Story 3 |
| BR-15 | Selected model persisted in VS Code setting `kiroSdlc.kiroModel` | BRD Story 3 AC-6 |
| BR-16 | Use conditional requests (ETag/If-Modified-Since) for bandwidth efficiency | BRD Story 8 AC-3 |

#### 3.3.4 Data Specifications

**Kiro API Models Response:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| models | array | Yes | Array of model objects |
| models[].id | string | Yes | Model identifier (e.g., "deepseek-r1") |
| models[].displayName | string | Yes | Human-friendly name (e.g., "DeepSeek R1 (Reasoning)") |
| models[].provider | string | Yes | Vendor name (e.g., "deepseek", "qwen") |
| models[].contextWindow | number | Yes | Max context tokens |
| models[].capabilities | object | Yes | `{ chat: boolean, code: boolean, vision: boolean }` |
| models[].maxOutputTokens | number | No | Max response tokens |

---

### 3.4 Feature: Chat Completion (Streaming)

**Source:** BRD Story 4, Story 5

#### 3.4.1 Description

KiroClient implements `LlmProvider.chat()` and `LlmProvider.chatStream()` by sending requests to Kiro API via AnthropicAdapter, processing SSE responses through StreamHandler.

#### 3.4.2 Use Case: UC-04 — Streaming Chat Completion

**Use Case ID:** UC-04
**Actor:** Developer (sends prompt via Chat Panel)
**Preconditions:** Valid token; model selected; Kiro API reachable
**Postconditions:** Full response streamed to Chat Panel

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Types prompt in Chat Panel, presses send |
| 2 | | LangGraph | Calls `KiroClient.chatStream(messages, options)` |
| 3 | | KiroClient | Gets current access token from TokenManager |
| 4 | | AnthropicAdapter | Formats messages into Kiro API request body (Anthropic Messages format) |
| 5 | | KiroClient | Sends POST to Kiro API endpoint with `stream: true`, Bearer token |
| 6 | | StreamHandler | Receives HTTP response with `Content-Type: text/event-stream` |
| 7 | | StreamHandler | Parses SSE chunks (`data: {...}\n\n`) |
| 8 | | StreamHandler | Yields text deltas from `content_block_delta` events |
| 9 | | Chat Panel | Renders tokens incrementally as they arrive |
| 10 | | StreamHandler | Receives `[DONE]` or `message_stop` event → closes stream |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-04a | Non-streaming chat (`chat()` method) | Same flow but collect all chunks → return concatenated text |
| AF-04b | User cancels mid-stream (AbortSignal) | StreamHandler aborts fetch; closes connection within 100ms |
| AF-04c | Token expired during request (401 response) | TokenManager refreshes; retry request once with new token |
| AF-04d | Model supports tool_use | AnthropicAdapter includes tools in request; parses tool_use blocks in response |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-04a | Network interrupted mid-stream | Preserve received content; show error: "Connection lost. Partial response preserved." |
| EF-04b | Kiro API returns 429 (rate limited) | Retry after `Retry-After` header; if no header, backoff 5s, 10s, 30s |
| EF-04c | Kiro API returns 500/503 | Retry 2 times; show error: "Kiro API temporarily unavailable" |
| EF-04d | Malformed SSE data | Log parse error; skip chunk; continue processing |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-17 | TTFT (client overhead only) < 1 second | BRD §6 Performance |
| BR-18 | Support streams up to 100K tokens without memory issues | BRD Story 4 AC-2 |
| BR-19 | Abort closes connection within 100ms | BRD Story 4 AC-3 |
| BR-20 | No data loss — chunks delivered in order | BRD Story 4 AC-5 |
| BR-21 | Compatible with existing `LlmProvider.chatStream()` interface | BRD Story 4 AC-6 |
| BR-22 | Back-pressure: buffer up to 100 chunks then apply flow control | BRD Story 4 |

#### 3.4.4 Data Specifications

**Chat Request (Anthropic Messages Format):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| model | string | Yes | Kiro model ID (e.g., "deepseek-r1") |
| max_tokens | number | Yes | Max response tokens (default 4096) |
| messages | array | Yes | Array of `{role, content}` objects |
| system | string | No | System prompt (extracted from messages) |
| stream | boolean | No | `true` for streaming mode |
| temperature | number | No | 0.0-2.0 |
| tools | array | No | Tool definitions (if tool_use supported) |

**SSE Stream Chunk Format:**

| Event Type | Data | Description |
|------------|------|-------------|
| `message_start` | `{"type":"message_start","message":{...}}` | Message metadata (model, usage) |
| `content_block_start` | `{"type":"content_block_start","index":0,"content_block":{"type":"text"}}` | Content block begins |
| `content_block_delta` | `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}` | Text token chunk |
| `content_block_stop` | `{"type":"content_block_stop","index":0}` | Block complete |
| `message_delta` | `{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{...}}` | Stop reason + final usage |
| `message_stop` | `{"type":"message_stop"}` | Stream end marker |
| `[DONE]` | — | Legacy stream end marker |

---

### 3.5 Feature: Anthropic-Compatible Adapter

**Source:** BRD Story 6

#### 3.5.1 Description

AnthropicAdapter ensures the KiroClient exposes the same interface as `AnthropicProvider`, allowing seamless switching between direct Anthropic API, kiro-rs proxy, and native Kiro client.

#### 3.5.2 Use Case: UC-05 — Transparent Provider Switching

**Use Case ID:** UC-05
**Actor:** Developer (changes `kiroSdlc.llmProvider` setting)
**Preconditions:** Extension configured with any provider
**Postconditions:** Provider switch takes effect immediately

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Developer | | Changes `kiroSdlc.llmProvider` to `"kiro"` in Settings |
| 2 | | Provider Factory | Detects configuration change |
| 3 | | Provider Factory | Disposes old provider |
| 4 | | Provider Factory | Creates new `KiroClient` instance |
| 5 | | KiroClient | Initializes TokenManager → detects credentials |
| 6 | | KiroClient | Provider becomes available |
| 7 | Developer | | Uses Chat Panel normally — no behavior change |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-05a | Switch from kiro-rs (`anthropic` + `baseUrl: localhost:8990`) to native `kiro` | Zero code changes; same response format |
| AF-05b | Switch to `kiro` but no credentials | Provider marked unavailable; other providers still work |

#### 3.5.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-23 | Existing `AnthropicProvider` API (chat, chatStream, chatWithTools) fully supported | BRD Story 6 AC-1 |
| BR-24 | Response fields mapped: content blocks, usage, stop_reason | BRD Story 6 AC-2 |
| BR-25 | Tool calling (tool_use) supported if Kiro API supports it | BRD Story 6 AC-3 |
| BR-26 | Error responses wrapped in Anthropic-compatible format | BRD Story 6 AC-4 |

---

### 3.6 Feature: Error Notification System

**Source:** BRD Story 7

#### 3.6.1 Description

Every error scenario produces a user-visible notification with actionable guidance. Technical details go to Output Channel.

#### 3.6.2 Use Case: UC-06 — Display Actionable Error Notification

**Use Case ID:** UC-06
**Actor:** System (error occurs during any operation)
**Preconditions:** An error condition is detected
**Postconditions:** User sees notification with action button; error logged to Output Channel

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Any Module | Detects error condition |
| 2 | | KiroClient | Maps error to notification template |
| 3 | | KiroClient | Shows VS Code notification with message + action button |
| 4 | | KiroClient | Logs full error (with stack trace) to Output Channel |
| 5 | Developer | | Clicks action button (e.g., "Open Settings", "Retry") |

#### 3.6.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-27 | Every error → user notification (no silent failures) | BRD Story 7 AC-1 |
| BR-28 | Notifications are actionable (button to fix) | BRD Story 7 AC-2 |
| BR-29 | No stack traces shown to user | BRD Story 7 AC-4 |
| BR-30 | Errors must not crash extension — graceful degradation | BRD Story 7 AC-5 |

**Error Notification Map:**

| Error Condition | User Message | Action Button | Output Channel Detail |
|----------------|-------------|---------------|----------------------|
| `~/.aws/sso/cache/` not found | "AWS SSO cache not found. Please login via Kiro IDE." | "Open Kiro IDE" | Full path attempted |
| All tokens expired | "Kiro session expired. Please re-login via Kiro IDE." | "Open Kiro IDE" | Expiry details |
| Refresh failed (network) | "Cannot refresh token. Check network connection." | "Retry" | HTTP error code + response |
| API unreachable | "Cannot reach Kiro API. Check network or VPN." | "Retry" | Endpoint + timeout |
| Model not available | "Model {name} is not available. Select another in Settings." | "Open Settings" | API response |
| Rate limited (429) | "Kiro API rate limited. Retrying in {N} seconds." | — | Headers + retry count |

---

## 4. Data Model

### 4.1 Logical Entities

#### Entity: KiroCredentials

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| accessToken | string | Yes | BR-01 (memory only) | Current access token |
| expiresAt | Date | Yes | BR-06 (refresh timing) | Token expiration |
| region | string | Yes | — | AWS region for API calls |
| refreshToken | string | Yes | BR-09 (write-back) | For token refresh |
| clientId | string | Yes | — | SSO OIDC client ID |
| clientSecret | string | Yes | — | SSO OIDC client secret |
| authMethod | string | No | BR-02 (priority) | "idc" preferred |
| status | CredentialStatus | Yes | — | active/refreshing/expired/unavailable |
| sourceFile | string | Yes | BR-09 (write-back) | Path to original cache file |

#### Entity: KiroModel

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | string | Yes | — | API model identifier |
| displayName | string | Yes | BR-13 (grouping) | Human-readable name |
| provider | string | Yes | BR-13 (grouping) | Vendor (deepseek, qwen, etc.) |
| contextWindow | number | Yes | — | Max input tokens |
| capabilities | ModelCapabilities | Yes | BR-14 (default selection) | chat/code/vision flags |
| maxOutputTokens | number | No | — | Max response tokens |

#### Entity: ModelCache

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| models | KiroModel[] | Yes | — | Cached model list |
| fetchedAt | Date | Yes | BR-11 (1h TTL) | When list was fetched |
| etag | string | No | BR-16 (conditional requests) | Server ETag for If-Modified-Since |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| KiroClient | KiroCredentials | 1:1 | Client holds one active credential set |
| KiroClient | ModelCache | 1:1 | Client maintains one model cache |
| ModelCache | KiroModel | 1:N | Cache contains multiple models |

---

## 5. Integration Specifications

### 5.1 External System: AWS SSO OIDC

| Attribute | Value |
|-----------|-------|
| Purpose | Token refresh — exchange refresh_token for new access_token |
| Direction | Outbound |
| Data Format | JSON (HTTPS POST) |
| Frequency | On-demand (every ~55 minutes, 5 min before expiry) |
| Endpoint | `https://oidc.{region}.amazonaws.com/token` |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| clientId + clientSecret + refreshToken | accessToken + refreshToken + expiresIn | Send/Receive | BR-08 (retry), BR-07 (mutex) |

**API Contract:**

```
POST https://oidc.{region}.amazonaws.com/token
Content-Type: application/json

{
  "clientId": "{clientId}",
  "clientSecret": "{clientSecret}",
  "grantType": "refresh_token",
  "refreshToken": "{refreshToken}"
}

Response 200:
{
  "accessToken": "aoaAAAAA...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "refreshToken": "aorAAAAA..."
}

Response 400 (invalid_grant):
{
  "error": "invalid_grant",
  "error_description": "Token is not active"
}
```

### 5.2 External System: Kiro API — Chat Completions

| Attribute | Value |
|-----------|-------|
| Purpose | Send chat messages to LLM, receive streaming response |
| Direction | Outbound |
| Data Format | JSON (request), SSE text/event-stream (response) |
| Frequency | On-demand (per user prompt) |
| Endpoint | `https://kiro.api.{region}.amazonaws.com/v1/messages` |

**API Contract:**

```
POST https://kiro.api.{region}.amazonaws.com/v1/messages
Content-Type: application/json
Authorization: Bearer {accessToken}
X-Model-Id: {modelId}
Accept: text/event-stream

Request Body:
{
  "model": "deepseek-r1",
  "max_tokens": 4096,
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "system": "You are a helpful assistant.",
  "stream": true,
  "temperature": 0.7
}

Response (SSE stream):
event: message_start
data: {"type":"message_start","message":{"id":"msg_...","model":"deepseek-r1","usage":{"input_tokens":15}}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"! How"}}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":25}}

event: message_stop
data: {"type":"message_stop"}
```

**Error Responses:**

| HTTP Code | Meaning | Client Action |
|-----------|---------|---------------|
| 401 | Token expired/invalid | Refresh token → retry once |
| 403 | Insufficient permissions | Show error; suggest re-login |
| 429 | Rate limited | Wait `Retry-After` seconds; retry |
| 500 | Server error | Retry 2 times with backoff |
| 503 | Service unavailable | Retry 2 times with backoff |

### 5.3 External System: Kiro API — Model Listing

| Attribute | Value |
|-----------|-------|
| Purpose | Fetch available models for user selection |
| Direction | Outbound |
| Data Format | JSON |
| Frequency | On activation + every 1 hour + on Settings Panel open |
| Endpoint | `https://kiro.api.{region}.amazonaws.com/v1/models` |

**API Contract:**

```
GET https://kiro.api.{region}.amazonaws.com/v1/models
Authorization: Bearer {accessToken}
If-None-Match: {cached_etag}

Response 200:
{
  "models": [
    {
      "id": "deepseek-r1",
      "displayName": "DeepSeek R1 (Reasoning)",
      "provider": "deepseek",
      "contextWindow": 128000,
      "capabilities": { "chat": true, "code": true, "vision": false },
      "maxOutputTokens": 8192
    },
    {
      "id": "qwen-2.5-max",
      "displayName": "Qwen 2.5 Max",
      "provider": "qwen",
      "contextWindow": 131072,
      "capabilities": { "chat": true, "code": true, "vision": true },
      "maxOutputTokens": 8192
    }
  ]
}

Response 304 (Not Modified):
(empty body — use cached list)
```

### 5.4 Internal Integration: LlmProvider Interface

| Attribute | Value |
|-----------|-------|
| Purpose | Register KiroClient as a new provider type |
| Direction | Inbound (factory creates KiroClient) |
| Integration Point | `src/langgraph/providers/index.ts` — `createProviderByType()` |

**Changes Required:**

1. Add `"kiro"` to `LlmProviderType` union: `"anthropic" | "openai" | "ollama" | "kiro"`
2. Add `case "kiro"` in `createProviderByType()` switch
3. No secret key needed — credentials auto-detected from filesystem
4. Add VS Code setting: `kiroSdlc.kiroModel` (string, selected model ID)

### 5.5 Internal Integration: Settings Panel

| Attribute | Value |
|-----------|-------|
| Purpose | Dynamic model dropdown population |
| Direction | KiroClient → Settings Panel (provides model list) |
| Integration Point | Settings Panel reads from ModelRegistry |

**Behavior:**
- On Settings Panel open → call `ModelRegistry.getModels()`
- Populate dropdown with models grouped by `provider`
- Show "(cached)" suffix if data from cache and API unreachable
- Persist selection to `kiroSdlc.kiroModel` VS Code setting

---

## 6. Processing Logic

### 6.1 Token Refresh Process

**Trigger:** Timer fires at `expiresAt - 5 minutes`
**Schedule:** Dynamic — re-scheduled after each successful refresh
**Input:** Current refresh token + client credentials
**Output:** New access token + new refresh token

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Check if another refresh is in progress (mutex) | If locked, wait for existing refresh to complete |
| 2 | Acquire mutex lock | — |
| 3 | POST to SSO OIDC `/token` endpoint | Retry 3x on network error (1s, 2s, 4s backoff) |
| 4 | Parse response; extract new tokens | On 400/invalid_grant → mark expired, show notification |
| 5 | Update in-memory credentials atomically | — |
| 6 | Write back to source cache file | Log warning if write fails; continue |
| 7 | Release mutex | — |
| 8 | Schedule next refresh timer | — |

**Pseudocode:**

```typescript
async refreshToken(): Promise<void> {
  if (this.refreshMutex.isLocked()) {
    await this.refreshMutex.wait();
    return; // Another refresh completed while we waited
  }
  
  await this.refreshMutex.acquire();
  try {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(
          `https://oidc.${this.credentials.region}.amazonaws.com/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId: this.credentials.clientId,
              clientSecret: this.credentials.clientSecret,
              grantType: "refresh_token",
              refreshToken: this.credentials.refreshToken
            })
          }
        );
        
        if (response.status === 400) {
          const body = await response.json();
          if (body.error === "invalid_grant") {
            this.credentials.status = "expired";
            this.showNotification("Kiro session expired. Please re-login via Kiro IDE.");
            return;
          }
        }
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        this.credentials.accessToken = data.accessToken;
        this.credentials.refreshToken = data.refreshToken;
        this.credentials.expiresAt = new Date(Date.now() + data.expiresIn * 1000);
        this.credentials.status = "active";
        
        await this.writeBackToCache();
        this.scheduleNextRefresh();
        return;
        
      } catch (err) {
        lastError = err as Error;
        await sleep(Math.pow(2, attempt) * 1000); // 1s, 2s, 4s
      }
    }
    
    this.showNotification("Cannot refresh token. Check network connection.", "Retry");
    setTimeout(() => this.refreshToken(), 30_000);
    
  } finally {
    this.refreshMutex.release();
  }
}
```

### 6.2 SSE Stream Processing

**Trigger:** HTTP response received with `Content-Type: text/event-stream`
**Input:** ReadableStream from fetch response
**Output:** AsyncGenerator yielding text tokens

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Read response body as stream | On network error → yield error event |
| 2 | Split stream on `\n\n` boundaries | Handle partial chunks (buffer) |
| 3 | Parse `data:` prefix from each event | Skip empty lines, comments (`:`) |
| 4 | JSON parse the data payload | On malformed JSON → log, skip chunk |
| 5 | Switch on event type | — |
| 6 | For `content_block_delta` → extract `delta.text` | — |
| 7 | Yield text to consumer | Apply backpressure if buffer > 100 |
| 8 | On `message_stop` or `[DONE]` → close generator | — |

**Pseudocode:**

```typescript
async *processStream(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let chunkCount = 0;
  
  try {
    while (true) {
      if (signal?.aborted) break;
      
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      
      for (const event of events) {
        const dataLine = event
          .split("\n")
          .find(line => line.startsWith("data: "));
        if (!dataLine) continue;
        
        const data = dataLine.slice(6);
        if (data === "[DONE]") return;
        
        try {
          const parsed = JSON.parse(data);
          
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            chunkCount++;
            yield parsed.delta.text;
            
            if (chunkCount % 100 === 0) {
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
          
          if (parsed.type === "message_stop") return;
          
        } catch (parseErr) {
          console.warn("[StreamHandler] Malformed SSE data:", parseErr);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

### 6.3 Credential Selection Algorithm

**Trigger:** Extension activation or FileWatcher event
**Input:** Array of parsed cache file objects
**Output:** Single selected credential or null

**Pseudocode:**

```typescript
function selectBestCredential(
  candidates: CacheFileContent[]
): CacheFileContent | null {
  // Step 1: Filter expired tokens
  const valid = candidates.filter(
    c => new Date(c.expiresAt) > new Date()
  );
  
  if (valid.length === 0) return null;
  
  // Step 2: Prefer authMethod === "idc"
  const idcCandidates = valid.filter(c => c.authMethod === "idc");
  const pool = idcCandidates.length > 0 ? idcCandidates : valid;
  
  // Step 3: Pick the one with latest expiresAt
  pool.sort((a, b) =>
    new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime()
  );
  
  return pool[0];
}
```

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Features |
|------|-------------|----------|
| Developer (extension user) | Full access to all Kiro models | Chat, model selection, settings |
| AWS SSO | Token issuance and refresh | Used transparently by TokenManager |
| Kiro API | Model access per account subscription | Returns only models user has access to |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Access Token | Restricted | Memory-only; never logged/stored in settings |
| Refresh Token | Restricted | Memory-only; written back to cache file only |
| Client Secret | Restricted | Memory-only; used only for token refresh |
| Chat Messages | Internal | Sent over HTTPS; not cached by extension |
| Model List | Public | Can be cached; no sensitivity |
| API Responses | Internal | Displayed to user; not persisted |

### 7.3 Security Controls

| Control | Implementation | Business Rule |
|---------|---------------|---------------|
| No credential logging | Suppress tokens in Output Channel logs | BR-01 |
| Memory-only storage | No SecretStorage, no settings.json | BR-01 |
| HTTPS only | All API calls over TLS | — |
| Token cleanup on deactivate | Clear all credentials from memory | BRD §6 Security |
| No telemetry exposure | Credentials excluded from extension telemetry | BR-01 |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Credential detection fast | < 2 seconds on activation |
| Performance | Token refresh responsive | < 3 seconds per refresh call |
| Performance | Low streaming overhead | TTFT < 1s (client-side only) |
| Performance | Extension activation impact | < 200ms additional (lazy init) |
| Reliability | Auto-retry transient failures | 3 retries, exponential backoff |
| Reliability | Graceful degradation | Other providers work if Kiro unavailable |
| Reliability | Stream resilience | 100K token streams without OOM |
| Compatibility | Cross-platform | Windows, macOS, Linux |
| Compatibility | VS Code version | >= 1.85 |
| Scalability | Concurrent conversations | 50+ concurrent streams (event loop) |
| Maintainability | Module isolation | Each module independently testable |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| No SSO cache directory | Warning | "AWS SSO cache not found. Please login via Kiro IDE." | Extension continues; other providers available |
| All tokens expired | Warning | "Kiro session expired. Please re-login via Kiro IDE." | Extension continues; Kiro provider unavailable |
| Refresh failed (network) | Warning | "Cannot refresh token. Check network connection." | Auto-retry in 30s; user can click "Retry" |
| API unreachable | Error | "Cannot reach Kiro API. Check network or VPN." | Cached models shown; chat unavailable |
| Rate limited | Info | "Kiro API rate limited. Retrying in {N}s." | Auto-retry after wait period |
| Model removed | Warning | "Model {name} no longer available. Select another." | Open Settings Panel |
| Stream interrupted | Error | "Connection lost. Partial response preserved." | Last received content kept in Chat Panel |
| Extension deactivate | — | — | All credentials cleared from memory silently |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Credential detected | Developer | Status bar indicator | On activation |
| Token refresh failed | Developer | VS Code notification | On final retry failure |
| New models available | Developer | VS Code notification (subtle) | On background refresh |
| Session expired | Developer | VS Code notification (warning) | When detected |

---

## 10. State Diagrams

### 10.1 TokenManager State Machine

![Token State](diagrams/token-state.png)

**States:**

| State | Description | Transitions Out |
|-------|-------------|-----------------|
| INITIALIZING | Scanning cache directory | → ACTIVE / → NO_CREDENTIALS / → EXPIRED |
| ACTIVE | Valid token in memory | → REFRESHING (timer) / → EXPIRED (refresh fails) |
| REFRESHING | Token refresh in progress | → ACTIVE (success) / → EXPIRED (3x fail) |
| EXPIRED | Token invalid, needs re-login | → ACTIVE (new file detected) / → INITIALIZING (retry) |
| NO_CREDENTIALS | No cache directory or files | → INITIALIZING (watcher detects new file) |
| UNAVAILABLE | Fatal error | → INITIALIZING (extension restart) |

### 10.2 KiroClient Provider State

![Provider State](diagrams/provider-state.png)

**States:**

| State | Description |
|-------|-------------|
| CREATED | Instance created, not yet initialized |
| AVAILABLE | Token active, API reachable, ready for use |
| DEGRADED | Token active but API unreachable (cached models only) |
| UNAVAILABLE | No credentials or expired; cannot make API calls |
| DISPOSED | Extension deactivating; cleanup complete |

---

## 11. Sequence Diagrams

### 11.1 Startup Sequence

![Startup Sequence](diagrams/sequence-startup.png)

### 11.2 Chat Stream Sequence

![Chat Stream Sequence](diagrams/sequence-chat-stream.png)

### 11.3 Token Refresh Sequence

![Token Refresh Sequence](diagrams/sequence-token-refresh.png)

---

## 12. Testing Considerations

### 12.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Detect valid credentials on activation | Cache dir with 1 valid token file | TokenManager.status = "active" | High |
| TC-02 | Detect credentials with multiple files | 3 files: 1 expired, 1 idc, 1 other | Selects idc file | High |
| TC-03 | No cache directory | `~/.aws/sso/cache/` missing | Notification shown; status = "no_credentials" | High |
| TC-04 | Token refresh success | Token at expiry-4min | New token stored; timer rescheduled | High |
| TC-05 | Token refresh network failure + retry | 2 failures then success | Auto-retries; succeeds on 3rd attempt | High |
| TC-06 | Token refresh all retries fail | 3 network failures | Notification shown; retry in 30s | Medium |
| TC-07 | Streaming chat | Valid request | Tokens yielded incrementally | High |
| TC-08 | Stream cancellation | AbortSignal fires mid-stream | Connection closed within 100ms | High |
| TC-09 | Model list fetch | API returns 5 models | All 5 models in dropdown | High |
| TC-10 | Model list API down, cache exists | API 503, cache < 1h | Show cached list with "(cached)" | Medium |
| TC-11 | Provider switch to "kiro" | Change setting | KiroClient created; credentials detected | High |
| TC-12 | 401 during chat → refresh → retry | API returns 401 | Refresh token; retry request; success | High |
| TC-13 | Long stream (100K tokens) | Large response | No memory issues; all tokens delivered | Medium |
| TC-14 | FileWatcher detects new credentials | New file in cache dir | Credentials updated if better | Medium |
| TC-15 | Extension deactivate cleanup | Extension deactivates | All tokens cleared from memory | High |

---

## 13. Appendix

### 13.1 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Token State Machine | [token-state.png](diagrams/token-state.png) | [token-state.drawio](diagrams/token-state.drawio) |
| 3 | Provider State Machine | [provider-state.png](diagrams/provider-state.png) | [provider-state.drawio](diagrams/provider-state.drawio) |
| 4 | Startup Sequence | [sequence-startup.png](diagrams/sequence-startup.png) | [sequence-startup.drawio](diagrams/sequence-startup.drawio) |
| 5 | Chat Stream Sequence | [sequence-chat-stream.png](diagrams/sequence-chat-stream.png) | [sequence-chat-stream.drawio](diagrams/sequence-chat-stream.drawio) |
| 6 | Token Refresh Sequence | [sequence-token-refresh.png](diagrams/sequence-token-refresh.png) | [sequence-token-refresh.drawio](diagrams/sequence-token-refresh.drawio) |

### 13.2 Module File Mapping

| Module | File Path | Implements |
|--------|-----------|------------|
| KiroClient | `src/langgraph/providers/kiro-client.ts` | `LlmProvider` interface |
| TokenManager | `src/langgraph/providers/token-manager.ts` | Credential lifecycle |
| AnthropicAdapter | `src/langgraph/providers/anthropic-adapter.ts` | Request/response mapping |
| StreamHandler | `src/langgraph/providers/stream-handler.ts` | SSE parsing |
| ModelRegistry | `src/langgraph/providers/model-registry.ts` | Model caching + Settings |

### 13.3 Configuration Settings

| Setting Key | Type | Default | Description |
|-------------|------|---------|-------------|
| kiroSdlc.llmProvider | enum | "anthropic" | Add "kiro" option |
| kiroSdlc.kiroModel | string | "" | Selected Kiro model ID |
| kiroSdlc.kiroRegion | string | "" | Override region (auto-detected if empty) |

### 13.4 Change Log from BRD

- Clarified SSO OIDC endpoint format: `https://oidc.{region}.amazonaws.com/token`
- Specified Kiro API endpoint pattern: `https://kiro.api.{region}.amazonaws.com/v1/messages`
- Added model listing endpoint: `GET /v1/models`
- Clarified SSE event types based on Anthropic Messages API format
- Added provider state machine (not in BRD)
- Added FileWatcher behavior details for credential directory
- Specified `LlmProviderType` union extension needed

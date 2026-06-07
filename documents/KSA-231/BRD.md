# Business Requirements Document (BRD)

## Kiro SDLC Agents Extension — KSA-231: Tích hợp Kiro API Client (Node.js) vào Extension — Thay thế kiro-rs Proxy

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-231 |
| Title | Tích hợp Kiro API Client (Node.js) vào Extension — Thay thế kiro-rs Proxy |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SM Agent – Scrum Master | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-231 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Tích hợp một Kiro API Client viết bằng Node.js/TypeScript trực tiếp vào extension `kiro-sdlc-agents`, thay thế hoàn toàn binary proxy `kiro-rs.exe` hiện tại. Client mới sẽ:

- Auto-detect AWS SSO credentials từ `~/.aws/sso/cache/`
- Tự động refresh token khi hết hạn (AWS SSO OIDC flow)
- Lấy full danh sách models từ Kiro API (DeepSeek, MiniMax, GLM, Qwen...)
- Expose một Anthropic-compatible API endpoint cho LLM provider
- Hỗ trợ streaming (SSE — Server-Sent Events)
- Auto-populate Settings Panel với danh sách models thực tế

### 1.2 Out of Scope

- Thay đổi pipeline logic (LangGraph, MCP bridge, agent orchestration)
- Hỗ trợ non-AWS authentication methods (Google, GitHub OAuth)
- Thay đổi giao diện Chat Panel
- Backend API development (Kiro API side)
- Multi-region failover

### 1.3 Preliminary Requirement

- Extension `kiro-sdlc-agents` phiên bản ≥ 1.16.0 (có LLM provider interface từ KSA-210)
- Node.js ≥ 18 (native `fetch` support)
- User đã có AWS SSO credentials (đã đăng nhập qua Kiro IDE hoặc AWS CLI)
- Kiro API endpoint đang hoạt động

---

## 2. Business Requirements

### 2.1 High Level Process Map

Hiện tại, extension sử dụng `kiro-rs.exe` như một standalone proxy:
1. User khởi động kiro-rs.exe thủ công
2. kiro-rs đọc credentials và refresh token
3. Extension gọi kiro-rs qua Anthropic-compatible API trên localhost:8990
4. kiro-rs forward request đến Kiro API, stream response về

**Sau thay đổi**, toàn bộ logic trên được nhúng trực tiếp vào extension:
1. Extension tự động detect credentials từ ~/.aws/sso/cache/
2. Extension gọi Kiro API trực tiếp (không cần proxy)
3. Token auto-refresh transparent cho user
4. Model list lấy runtime từ API

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a developer, I want the extension to automatically detect my AWS SSO credentials so that I don't need to manually configure API keys | MUST HAVE | KSA-231 |
| 2 | As a developer, I want tokens to auto-refresh so that my session never expires during work | MUST HAVE | KSA-231 |
| 3 | As a developer, I want to see all available Kiro models in Settings Panel so that I can pick the best model for my task | MUST HAVE | KSA-231 |
| 4 | As a developer, I want streaming responses from Kiro API so that I see AI responses in real-time | MUST HAVE | KSA-231 |
| 5 | As a developer, I want the extension to work without kiro-rs.exe so that I have fewer external dependencies | MUST HAVE | KSA-231 |
| 6 | As a developer, I want an Anthropic-compatible local endpoint so that existing provider code works without changes | SHOULD HAVE | KSA-231 |
| 7 | As a developer, I want clear error messages when credentials are missing or expired so that I know how to fix it | SHOULD HAVE | KSA-231 |
| 8 | As a developer, I want the model list to update automatically when new models are available on Kiro API | COULD HAVE | KSA-231 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Extension activates → KiroClient initializes → TokenManager scans `~/.aws/sso/cache/` for valid credentials

**Step 2:** If valid token found → TokenManager stores in memory, schedules refresh timer

**Step 3:** If no valid token → Extension shows notification: "Kiro credentials not found. Please login via Kiro IDE or AWS CLI."

**Step 4:** User selects model in Settings Panel → ModelRegistry calls Kiro API `/models` endpoint → populates dropdown

**Step 5:** User sends prompt via Chat Panel → AnthropicAdapter formats request → KiroClient sends to Kiro API with Bearer token

**Step 6:** Kiro API responds with SSE stream → StreamHandler processes chunks → yields tokens to LLM provider → Chat Panel renders incrementally

**Step 7:** When token expires (< 5 min before `expiresAt`) → TokenManager calls SSO OIDC refresh → updates in-memory token → no user action required

---

#### STORY 1: Auto-detect AWS SSO Credentials

> As a developer, I want the extension to automatically detect my AWS SSO credentials so that I don't need to manually configure API keys

**Requirement Details:**

1. On activation, extension scans `~/.aws/sso/cache/` directory for JSON files containing valid tokens
2. Each cache file contains: `accessToken`, `expiresAt`, `region`, `clientId`, `clientSecret`, `refreshToken`
3. Extension picks the most recently modified file with a non-expired `accessToken`
4. If multiple valid tokens exist, prefer the one with `authMethod: "idc"` or the one matching configured region
5. Credentials are stored ONLY in memory (never written to VS Code settings or disk)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| accessToken | string | Yes | AWS SSO OIDC access token | `aoaAAAAAGoh1Tcq-...` |
| expiresAt | ISO 8601 | Yes | Token expiration timestamp | `2026-06-04T19:42:47.592Z` |
| region | string | Yes | AWS region for Kiro API | `ap-southeast-1` |
| clientId | string | Yes | SSO OIDC client ID | `fZR5TETKBjRjbx8B...` |
| clientSecret | string | Yes | SSO OIDC client secret (JWT) | `eyJraWQiOiJrZXkt...` |
| refreshToken | string | Yes | Token for refreshing access | `aorAAAAAGqXhqItP...` |
| authMethod | string | No | Authentication method identifier | `idc` |

**Acceptance Criteria:**

1. Extension detects credentials within 2 seconds of activation
2. If `~/.aws/sso/cache/` doesn't exist, extension gracefully shows info notification
3. If all tokens are expired, extension prompts user to re-login
4. Credential detection works on Windows (`%USERPROFILE%\.aws\sso\cache\`), macOS, and Linux
5. Extension watches `~/.aws/sso/cache/` for new/updated files (FileSystemWatcher)
6. No credentials are ever logged, stored in settings, or sent to telemetry

---

#### STORY 2: Token Auto-Refresh

> As a developer, I want tokens to auto-refresh so that my session never expires during work

**Requirement Details:**

1. TokenManager monitors token `expiresAt` — initiates refresh 5 minutes before expiry
2. Refresh uses AWS SSO OIDC `CreateToken` API with `grant_type: "refresh_token"`
3. On successful refresh, new `accessToken`, `refreshToken`, and `expiresAt` are stored in memory
4. Updated credentials are also written back to the cache file (matching kiro-rs behavior)
5. If refresh fails (network error, invalid refresh token), retry 3 times with exponential backoff
6. If all retries fail, show notification and mark provider as "unavailable" until user re-logins

**Acceptance Criteria:**

1. Token refreshes successfully without user intervention
2. Refresh happens at most 5 minutes before expiry (not too early, not too late)
3. During refresh, in-flight API calls continue using the old token (no interruption)
4. After refresh failure + retries, user sees actionable notification: "Kiro session expired. Please re-login."
5. Refresh writes back to cache file so kiro-rs (if still installed) stays in sync
6. No more than 1 concurrent refresh operation at any time (mutex/lock)

---

#### STORY 3: Full Model List from Kiro API

> As a developer, I want to see all available Kiro models in Settings Panel so that I can pick the best model for my task

**Requirement Details:**

1. ModelRegistry calls Kiro API endpoint to list available models on startup and periodically
2. Model list includes: DeepSeek (R1, V3), MiniMax, GLM-4, Qwen (Plus, Max, 2.5), Claude variants
3. Each model has: `id`, `displayName`, `provider`, `contextWindow`, `capabilities` (chat, code, vision)
4. Settings Panel dropdown populated from actual API response (not hardcoded)
5. Models cached locally with 1-hour TTL to avoid unnecessary API calls
6. Default model: first model in the response with `capabilities.chat = true`

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| id | string | Yes | Model identifier for API calls | `deepseek-r1` |
| displayName | string | Yes | Human-friendly model name | `DeepSeek R1 (Reasoning)` |
| provider | string | Yes | Model provider/vendor | `deepseek` |
| contextWindow | number | Yes | Max context tokens | `128000` |
| capabilities | object | Yes | What the model can do | `{ chat: true, code: true, vision: false }` |
| maxOutputTokens | number | No | Max response tokens | `8192` |

**Acceptance Criteria:**

1. Settings Panel shows all models returned by API (not hardcoded list)
2. Models grouped by provider in the dropdown (DeepSeek section, Qwen section, etc.)
3. If API unreachable, show cached models with "(cached)" indicator
4. If no cache and API unreachable, show helpful message: "Cannot load models. Check connection."
5. Model list refreshes when user opens Settings Panel
6. Selected model persisted in VS Code settings (`kiroSdlc.kiroModel`)

---

#### STORY 4: Streaming Responses (SSE)

> As a developer, I want streaming responses from Kiro API so that I see AI responses in real-time

**Requirement Details:**

1. StreamHandler processes Server-Sent Events from Kiro API response
2. Each SSE chunk parsed and yielded as string tokens to the LLM provider interface
3. Supports the standard SSE format: `data: {...}\n\n` with JSON payloads
4. Handle special events: `[DONE]` marker, error events, heartbeat/ping events
5. Back-pressure handling: if consumer is slow, buffer up to 100 chunks then apply flow control
6. Abort support: if user cancels (AbortSignal), close the HTTP connection immediately

**Acceptance Criteria:**

1. First token appears in Chat Panel within 500ms of request (TTFT — Time To First Token, network-dependent)
2. Streaming works for responses up to 100K tokens without memory issues
3. User can cancel mid-stream; connection closes within 100ms
4. Network interruption mid-stream shows error message with last received content preserved
5. No data loss — all chunks delivered in order
6. Compatible with existing `LlmProvider.chatStream()` interface

---

#### STORY 5: Eliminate kiro-rs Dependency

> As a developer, I want the extension to work without kiro-rs.exe so that I have fewer external dependencies

**Requirement Details:**

1. When `kiroSdlc.llmProvider` is set to `"kiro"`, extension uses native Node.js client (no external process)
2. No subprocess spawning, no port binding, no external binary required
3. Extension startup time not significantly impacted (< 200ms additional for credential detection)
4. All functionality previously provided by kiro-rs now handled by TypeScript modules:
   - Credential management → `token-manager.ts`
   - API communication → `kiro-client.ts`
   - Response adaptation → `anthropic-adapter.ts`
   - Stream processing → `stream-handler.ts`
   - Model listing → `model-registry.ts`

**Acceptance Criteria:**

1. Extension works without kiro-rs.exe installed anywhere
2. Existing kiro-rs users can switch to native client by changing provider to `"kiro"`
3. `kiro-rs` provider option remains available as fallback (points to localhost proxy)
4. Migration documentation provided for switching from kiro-rs to native
5. No filesystem artifacts left after uninstall (no temp files, no cache files outside ~/.aws/)

---

#### STORY 6: Anthropic-Compatible Local Endpoint

> As a developer, I want an Anthropic-compatible local endpoint so that existing provider code works without changes

**Requirement Details:**

1. `anthropic-adapter.ts` wraps Kiro API calls in Anthropic Messages API format
2. Existing `AnthropicProvider` can point to the Kiro adapter via `baseUrl` config
3. Request format: Anthropic Messages API (`/v1/messages`)
4. Response format: Anthropic Messages API response (content blocks, usage)
5. Supports both streaming (`"stream": true`) and non-streaming modes
6. Maps Kiro model IDs to Anthropic-compatible model names transparently

**Acceptance Criteria:**

1. Existing code using `AnthropicProvider` with `baseUrl: "http://localhost:8990"` (kiro-rs) can switch to native adapter with zero code changes
2. All Anthropic response fields properly mapped (content, usage, stop_reason)
3. Tool calling (tool_use) works through the adapter if Kiro API supports it
4. Error responses wrapped in Anthropic-compatible error format

---

#### STORY 7: Clear Error Messages

> As a developer, I want clear error messages when credentials are missing or expired so that I know how to fix it

**Requirement Details:**

1. Error scenarios mapped to user-friendly notifications:
   - No `~/.aws/sso/cache/` directory → "AWS SSO cache not found. Please login via Kiro IDE."
   - All tokens expired → "Kiro session expired. Please re-login via Kiro IDE."
   - Token refresh failed → "Cannot refresh token. Check network connection."
   - API unreachable → "Cannot reach Kiro API. Check network or VPN."
   - Model not available → "Model {name} is not available. Select another in Settings."
2. Each error notification has an actionable button (e.g., "Open Settings", "Retry")
3. Error details logged to Output Channel ("Kiro SDLC Agents") for debugging

**Acceptance Criteria:**

1. Every error scenario produces a user notification (not silent failure)
2. Error messages actionable — user knows exactly what to do
3. Technical details in Output Channel, user-friendly message in notification
4. No stack traces shown to user
5. Errors don't crash the extension — graceful degradation

---

#### STORY 8: Auto-Update Model List

> As a developer, I want the model list to update automatically when new models are available on Kiro API

**Requirement Details:**

1. ModelRegistry refreshes model list every 1 hour in background
2. On Settings Panel open, force-refresh if cache older than 5 minutes
3. If new models detected, show subtle notification: "🆕 New Kiro models available"
4. If current selected model removed from API, show warning and suggest alternative

**Acceptance Criteria:**

1. New models appear in Settings without extension restart
2. Refresh doesn't block UI or interrupt ongoing conversations
3. Background refresh uses minimal bandwidth (conditional request with ETag/If-Modified-Since)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| LLM Provider Interface | System | KSA-210 | `LlmProvider` interface must be implemented |
| AWS SSO OIDC | External | N/A | Token refresh requires AWS SSO OIDC CreateToken API access |
| Kiro API | External | N/A | Model listing and chat completion endpoints must be available |
| Settings Panel | System | KSA-210 | Model dropdown must support dynamic population |
| Node.js ≥ 18 | Infrastructure | N/A | Native `fetch` API required for HTTP calls |
| VS Code Extension Host | Infrastructure | N/A | Extension runs in VS Code extension host process |
| kiro-rs reference | External | N/A | Reference implementation at https://github.com/hank9999/kiro.rs |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Developer | Extension Team | Implement KiroClient modules | Ticket assignee |
| User | All extension users | Use Kiro API models for AI tasks | End user |
| Architecture | SA Agent | Review technical design | Reviewer |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AWS SSO cache format changes across OS/versions | High | Low | Abstract file parsing; add format versioning detection |
| Kiro API rate limiting | Medium | Medium | Implement retry with backoff; cache model list |
| Token refresh race condition during concurrent requests | High | Medium | Implement mutex lock on refresh; queue requests during refresh |
| Node.js fetch limitations vs Rust (performance) | Low | Low | Node.js fetch sufficient for LLM API calls; no need for Rust performance |
| Kiro API breaking changes | High | Low | Version API calls; adapter pattern isolates changes |
| Credentials file locked by other process | Medium | Low | Retry file read; use fs.copyFile to temp before parse |

### 5.2 Assumptions

- User has already authenticated via Kiro IDE (credentials exist in `~/.aws/sso/cache/`)
- Kiro API endpoint format is stable (Anthropic-compatible messages API)
- AWS SSO OIDC refresh token has sufficient lifetime for a work session (typically 8-12 hours)
- Extension host has network access to Kiro API endpoints
- Model list API returns all available models in a single response (no pagination needed)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Credential detection < 2s | Scan SSO cache directory, parse JSON files |
| Performance | Token refresh < 3s | Network call to SSO OIDC endpoint |
| Performance | TTFT < 1s (excl. model latency) | Time from request to first streamed token (client-side overhead only) |
| Performance | Extension activation impact < 200ms | Lazy initialization, defer credential scan |
| Security | Credentials in-memory only | Never in settings.json, never logged, never in telemetry |
| Security | Secure token storage | Access tokens cleared on extension deactivate |
| Reliability | Auto-retry on transient failures | 3 retries with exponential backoff (1s, 2s, 4s) |
| Reliability | Graceful degradation | Extension functional (other providers) if Kiro unavailable |
| Scalability | Support 50+ concurrent streams | Node.js event loop handles multiple active conversations |
| Compatibility | Cross-platform | Windows, macOS, Linux — path resolution per OS |
| Compatibility | VS Code ≥ 1.85 | Minimum VS Code version for extension host compatibility |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-231 | Tích hợp Kiro API Client (Node.js) vào Extension | To Do | Story | Main ticket |
| KSA-210 | LLM Provider Abstraction | Done | Story | Dependency — provides LlmProvider interface |

---

## 8. Appendix

### Module Architecture Overview

| Module | File | Responsibility |
|--------|------|----------------|
| KiroClient | `src/langgraph/providers/kiro-client.ts` | Main orchestrator — coordinates token, API calls, model registry |
| TokenManager | `src/langgraph/providers/token-manager.ts` | Credential detection, storage, auto-refresh |
| AnthropicAdapter | `src/langgraph/providers/anthropic-adapter.ts` | Maps Kiro API ↔ Anthropic Messages format |
| StreamHandler | `src/langgraph/providers/stream-handler.ts` | SSE parsing, chunk assembly, backpressure |
| ModelRegistry | `src/langgraph/providers/model-registry.ts` | Model list fetching, caching, Settings integration |

### Glossary

| Term | Definition |
|------|------------|
| SSO | Single Sign-On — AWS IAM Identity Center |
| OIDC | OpenID Connect — authentication protocol used by AWS SSO |
| SSE | Server-Sent Events — HTTP streaming protocol for real-time data |
| TTFT | Time To First Token — latency metric for streaming LLM responses |
| kiro-rs | Rust-based proxy (to be replaced) — reference: https://github.com/hank9999/kiro.rs |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| kiro-rs source code | https://github.com/hank9999/kiro.rs |
| Existing LLM Provider interface | `src/langgraph/llm-provider.ts` (KSA-210) |
| Existing Anthropic Provider | `src/langgraph/providers/anthropic-provider.ts` |
| Settings Panel | `src/panels/settings-panel.ts` |
| AWS SSO OIDC API docs | https://docs.aws.amazon.com/singlesignon/latest/OIDCAPIReference/ |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

# Functional Specification Document (FSD)

## Kiro AI Proxy Server (kiro-ts) — KSA-237: Integrate chat completions endpoint into MCP server

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-237 |
| Title | Integrate chat completions endpoint into MCP server (kiro-ts) |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-237.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | BA Agent | Initial FSD — auto-generated from BRD and existing codebase analysis |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the kiro-ts chat completions proxy integrated into the MCP Code Intelligence HTTP server. It defines use cases, API contracts, data flows, business rules, and error handling for the Anthropic-compatible chat endpoint.

### 1.2 Scope

The system extends the existing MCP server (`http-entry.js`, port 9181) with:
- `POST /v1/messages` — Anthropic Messages API proxy (Kiro credentials OR API key)
- `POST /api/chat/completions` — alias endpoint (same handler)
- `GET /v1/health` — connection diagnostics endpoint
- Credential management (AWS SSO auto-detect + API key fallback)
- SSE streaming for real-time responses

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| kiro-ts | TypeScript chat proxy module integrated in MCP server |
| SSE | Server-Sent Events — streaming protocol |
| SigV4 | AWS Signature Version 4 authentication |
| ReAct | Reasoning + Acting agent loop pattern |
| MCP | Model Context Protocol |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-237.docx |
| Anthropic Messages API | https://docs.anthropic.com/en/api/messages |
| AWS SigV4 | https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html |
| Existing chat-routes.js | kiro-sdlc-agents/mcp-server/http/chat-routes.js |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The kiro-ts proxy sits within the MCP server process, receiving requests from the Chat Panel extension and forwarding them to either the Kiro AI API (via SigV4) or directly to Anthropic API (via API key).

### 2.2 System Architecture

The system operates in two authentication modes:

1. **Kiro Mode (zero-config):** Auto-detects AWS SSO credentials → signs request with SigV4 → forwards to Kiro AI API
2. **Anthropic Mode (API key):** Uses provided API key → forwards directly to Anthropic API

Both modes produce identical Anthropic Messages API responses to the client.

---

## 3. Functional Requirements

### 3.1 Feature: Chat Message Processing

**Source:** BRD Story 1 + Story 2

#### 3.1.1 Description

The proxy receives Anthropic Messages API requests, authenticates them, forwards to the appropriate AI backend, and returns responses (streaming or non-streaming) to the client.

#### 3.1.2 Use Case: UC-01 — Send Chat Message (Streaming)

**Use Case ID:** UC-01
**Actor:** Developer (via Chat Panel)
**Preconditions:** MCP server running on port 9181; valid credentials available
**Postconditions:** AI response streamed to client; conversation history updated

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Sends POST /v1/messages with stream:true | | Developer types message in Chat Panel |
| 2 | | Validates request body schema | Parse JSON, check required fields |
| 3 | | Resolves authentication mode | Check x-api-key header; if present use Anthropic mode; else use Kiro credentials |
| 4 | | Constructs upstream request | Map to target API format |
| 5 | | Signs request (if Kiro mode) | Apply SigV4 with resolved credentials |
| 6 | | Opens connection to upstream API | HTTP POST with stream:true |
| 7 | | Streams SSE events to client | Forward each token as content_block_delta |
| 8 | Receives real-time tokens | | Chat Panel renders response progressively |
| 9 | | Sends message_stop event | Close SSE stream |
| 10 | | Updates conversation history | Store assistant response with tool_use IDs |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | stream:false or omitted | Steps 1-5 same; Step 6: wait for complete response; Step 7: return single JSON body |
| AF-02 | API key provided in header | Skip credential resolution (Step 3); use API key directly for Anthropic API |
| AF-03 | Tool use in response | Step 7 includes content_block_start with type:tool_use, input_json_delta events |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | No credentials and no API key | Return HTTP 401 with authentication_error |
| EF-02 | Credentials expired, refresh fails | Return HTTP 401 with authentication_error + re-login instruction |
| EF-03 | Upstream API returns error | Forward error status code with Anthropic-format error body |
| EF-04 | Upstream connection drops mid-stream | Send SSE error event, close connection |
| EF-05 | Request body exceeds 4MB | Return HTTP 413 with invalid_request_error |
| EF-06 | Invalid JSON body | Return HTTP 400 with parse_error |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | Authentication priority: x-api-key header > Kiro credentials > environment variables | BRD Story 3 |
| BR-02 | Tool use IDs from upstream MUST be passed through unchanged to client | BRD Story 2 |
| BR-03 | Conversation history is per-session (sessionId parameter) | Existing implementation |
| BR-04 | Proxy overhead must not exceed 100ms (excluding AI processing time) | BRD NFR |
| BR-05 | Token-to-token streaming delay must be under 50ms | BRD NFR |
| BR-06 | Proxy binds to 127.0.0.1 only — no network access | BRD NFR |
| BR-07 | Credentials must never appear in error messages or logs | BRD NFR |
| BR-08 | If Kiro mode fails, DO NOT fallback to Anthropic mode silently — report error | BRD Story 3 |
| BR-09 | Max concurrent sessions: 5 without degradation | BRD NFR |
| BR-10 | Health check must complete within 5 seconds | BRD Story 4 |

#### 3.1.4 Data Specifications

**Input Data (POST /v1/messages body):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| model | string | Yes | Non-empty, starts with "claude-" | Claude model identifier |
| messages | array | Yes | At least 1 element, last must be role:"user" or contain tool_result | Conversation messages |
| max_tokens | integer | Yes | 1–200000 | Maximum response tokens |
| stream | boolean | No | Default: true | Enable SSE streaming |
| system | string | No | Max 100000 chars | System prompt |
| temperature | float | No | 0.0–1.0 | Sampling temperature |
| tools | array | No | Each has name, description, input_schema | Tool definitions |
| tool_choice | object | No | type: "auto" or "any" or "tool" | Tool selection strategy |
| stop_sequences | array | No | Max 10 strings | Custom stop sequences |
| metadata | object | No | JSON object | Request metadata |

**Input Data (headers):**

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| x-api-key | string | No | Anthropic API key (bypasses Kiro credentials) |
| Content-Type | string | Yes | Must be application/json |

**Output Data (non-streaming response):**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Message ID (from upstream) |
| type | string | Always "message" |
| role | string | Always "assistant" |
| content | array | Content blocks (text, tool_use) |
| model | string | Model used |
| stop_reason | string | "end_turn" or "tool_use" or "max_tokens" |
| usage | object | {input_tokens, output_tokens} |

**Output Data (streaming SSE events):**

| Event | Data Type | Description |
|-------|-----------|-------------|
| message_start | object | Message metadata + model + usage estimate |
| content_block_start | object | {type, index, content_block: {type: "text" or "tool_use", ...}} |
| content_block_delta | object | {type, index, delta: {type: "text_delta" or "input_json_delta", ...}} |
| content_block_stop | object | {type, index} |
| message_delta | object | {type, delta: {stop_reason}, usage: {output_tokens}} |
| message_stop | object | {type: "message_stop"} |
| error | object | {type: "error", error: {type, message}} |

#### 3.1.5 API Contract (Functional View)

**Endpoint:** `POST /v1/messages`
**Purpose:** Send chat message to AI, receive response (streaming or complete)

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| model | string | Yes | BR-01 | Claude model to use |
| messages | array | Yes | BR-02, BR-03 | Conversation with tool_use IDs preserved |
| max_tokens | integer | Yes | — | Response length limit |
| stream | boolean | No | BR-05 | True = SSE, False = JSON |
| tools | array | No | BR-02 | Tool definitions for function calling |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| content | array | Text blocks and tool_use blocks |
| stop_reason | string | Why generation stopped |
| usage | object | Token counts |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| No credentials | "API key required. Set it in SDLC Pipeline Settings, or log in via Kiro IDE." | No x-api-key header AND no Kiro credentials found |
| Expired credentials | "Credentials expired. Please re-authenticate via Kiro IDE." | Kiro token expired AND refresh failed |
| Invalid model | "Model not supported" | model not in allowed list |
| Rate limited | "Rate limit exceeded. Please wait." | Upstream returns HTTP 429 |
| Service unavailable | "AI service temporarily unavailable" | Upstream returns HTTP 503 |

---

**Endpoint:** `GET /v1/health`
**Purpose:** Verify connectivity chain: credentials, API connectivity, model availability

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| status | string | "healthy" or "degraded" or "unhealthy" |
| credentials | object | {status: "ok" or "failed" or "not_configured", type: "kiro" or "api_key", expires_in?: string} |
| api_connectivity | object | {status: "ok" or "failed", latency_ms?: number, error?: string} |
| model_available | object | {status: "ok" or "failed", model?: string} |
| timestamp | string | ISO 8601 |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Health check timeout | {status: "unhealthy", error: "Health check timed out"} | Any check takes more than 5s |
| Partial failure | {status: "degraded"} | One component down |

---

### 3.2 Feature: Credential Management

**Source:** BRD Story 3

#### 3.2.1 Description

The system auto-detects and manages credentials for authenticating with the Kiro AI API. Supports multiple credential sources with defined priority.

#### 3.2.2 Use Case: UC-02 — Resolve Credentials

**Use Case ID:** UC-02
**Actor:** System (internal)
**Preconditions:** Request received requiring Kiro authentication
**Postconditions:** Valid credentials resolved or error returned

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Check Kiro credential store | Read from IDE-managed location |
| 2 | | Validate token expiration | Check expiration timestamp |
| 3 | | If valid, return credentials | Ready for SigV4 signing |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Kiro store not found | Check ~/.aws/credentials with kiro profile |
| AF-02 | AWS file not found | Check environment variables |
| AF-03 | Token about to expire (less than 5 min) | Attempt refresh before returning |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | No credential source found | Return error: "Kiro credentials not found" |
| EF-02 | Token expired + refresh fails | Return error: "Credentials expired" |
| EF-03 | File permission denied | Return error: "Cannot read credential file" |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-11 | Credential priority: Kiro internal store > AWS credentials file > environment vars | BRD Story 3 |
| BR-12 | Proactive refresh: if token expires within 5 minutes, refresh before use | BRD Story 3 |
| BR-13 | Region auto-detection from credential configuration | BRD Story 3 |
| BR-14 | Credentials cached in memory, re-read only on expiration or error | Performance |
| BR-15 | Credential file path: platform-specific (Windows: %USERPROFILE%/.aws, macOS/Linux: ~/.aws) | Cross-platform |

#### 3.2.4 Data Specifications

**Credential Object (internal):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| accessKeyId | string | Yes | Starts with "ASIA" (temp) or "AKIA" (long-term) | AWS Access Key ID |
| secretAccessKey | string | Yes | Non-empty | AWS Secret Access Key |
| sessionToken | string | Yes (for SSO) | Non-empty | Temporary session token |
| region | string | Yes | Valid AWS region format | API endpoint region |
| expiration | Date | Yes (for SSO) | Future timestamp | Token expiry |

---

### 3.3 Feature: Tool Calling (ReAct Loop)

**Source:** BRD Story 2

#### 3.3.1 Description

The proxy supports multi-turn tool-calling conversations where the AI requests tool execution and the client provides results. The proxy maintains conversation state with tool_use_id tracking.

#### 3.3.2 Use Case: UC-03 — Tool Use Cycle

**Use Case ID:** UC-03
**Actor:** Developer (via Chat Panel agent)
**Preconditions:** Active session with tool definitions; AI has returned tool_use block
**Postconditions:** Tool result incorporated; AI continues reasoning

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Sends request with toolResult | | Client executed tool, sending result back |
| 2 | | Validate toolResult.toolUseId exists in history | Check conversation state |
| 3 | | Add tool_result to conversation history | Append as user message with type:tool_result |
| 4 | | Forward updated conversation to AI | Include full history with tool results |
| 5 | | AI responds (may request more tools or give final answer) | Stream response back |
| 6 | | Update history with new assistant response | Track any new tool_use IDs |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | AI requests multiple tools | Response contains multiple tool_use blocks; client executes each and sends results |
| AF-02 | AI gives final answer after tool use | Response is text only; stop_reason = "end_turn" |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | toolUseId not found in history | Return HTTP 400 with tool_use_id_mismatch error, list available IDs |
| EF-02 | Tool execution reported error | is_error:true passed to AI; AI may retry or explain |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-02 | Tool use IDs from upstream passed through unchanged | BRD Story 2 |
| BR-16 | tool_use_id validation: must exist in current session history | Existing implementation |
| BR-17 | tool_result content can be string or array of content blocks | Anthropic API spec |
| BR-18 | Session isolation: tool IDs from session A not accessible in session B | Security |

---

### 3.4 Feature: Connection Health Check

**Source:** BRD Story 4

#### 3.4.1 Description

A diagnostic endpoint that verifies the entire chain: credential availability, API connectivity, and model responsiveness.

#### 3.4.2 Use Case: UC-04 — Health Check

**Use Case ID:** UC-04
**Actor:** Developer (via Settings UI or curl)
**Preconditions:** MCP server running
**Postconditions:** Health status returned with component details

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Sends GET /v1/health | | User clicks "Test Connection" |
| 2 | | Check credential availability | Resolve credentials without making API call |
| 3 | | Test API connectivity | Send minimal request to API endpoint |
| 4 | | Verify model availability | Check response indicates model accessible |
| 5 | | Return aggregated status | JSON with per-component status |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Only API key configured (no Kiro creds) | Step 2 reports type:"api_key"; Step 3 uses API key for connectivity test |
| AF-02 | Partial failure | status:"degraded"; failed component shows error details |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | All checks fail | status:"unhealthy"; all components show "failed" |
| EF-02 | Check times out (more than 5s) | Return immediately with timeout status for pending checks |

---

### 3.5 Feature: Streaming Response

**Source:** BRD Story 5

#### 3.5.1 Description

When stream:true, the proxy establishes an SSE connection and forwards tokens from the upstream API to the client in real-time, maintaining Anthropic event format compatibility.

#### 3.5.2 Use Case: UC-05 — Stream SSE Response

**Use Case ID:** UC-05
**Actor:** Developer (via Chat Panel)
**Preconditions:** Valid request with stream:true
**Postconditions:** Complete response streamed; connection closed

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Set response headers (text/event-stream) | Establish SSE connection |
| 2 | | Send message_start event | Message metadata |
| 3 | | For each content block from upstream | Forward events |
| 4 | | Send content_block_start | Block type and index |
| 5 | | Send content_block_delta (repeated) | Incremental text/JSON |
| 6 | | Send content_block_stop | Block complete |
| 7 | | Send message_delta | Stop reason + usage |
| 8 | | Send message_stop | Stream complete |
| 9 | | Close connection | End response |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Upstream returns non-streaming response | Convert to SSE event sequence (emulate streaming) |
| AF-02 | Multiple content blocks (text + tool_use) | Iterate blocks, each gets start/delta/stop cycle |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Client disconnects mid-stream | Detect via req.on('close'); abort upstream request |
| EF-02 | Upstream drops mid-stream | Send error SSE event; close connection |
| EF-03 | Upstream timeout | Send error event with "Upstream timeout" message |

#### 3.5.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-05 | Token-to-token forwarding delay under 50ms | BRD NFR |
| BR-19 | SSE format: `event: {type}\ndata: {json}\n\n` | Anthropic spec |
| BR-20 | No response buffering — forward immediately on receipt | BRD Story 5 |
| BR-21 | Client disconnect MUST trigger upstream abort (prevent resource leak) | BRD Story 5 |
| BR-22 | Events must be in correct order: start, deltas, stop | Anthropic spec |

---

## 4. Data Model

### 4.1 Logical Entities

#### Entity: ConversationSession

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| sessionId | string | Yes | BR-03 | Unique session identifier |
| messages | array | Yes | — | Ordered conversation messages |
| toolUseIndex | Map | Yes | BR-02 | Map of tool_use_id to tool metadata |
| turnCounter | integer | Yes | — | Number of turns in conversation |
| createdAt | Date | Yes | — | Session creation time |

#### Entity: Credential

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| accessKeyId | string | Yes | BR-11 | AWS access key |
| secretAccessKey | string | Yes | BR-07 | AWS secret key (never logged) |
| sessionToken | string | Yes | BR-12 | Temporary session token |
| region | string | Yes | BR-13 | AWS region for endpoint |
| expiration | Date | Yes | BR-12 | Token expiry time |
| source | string | Yes | BR-11 | "kiro" or "aws_file" or "env_var" |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| ConversationSession | Message | 1:N | Session contains ordered messages |
| Message | ContentBlock | 1:N | Message contains content blocks |

---

## 5. Integration Specifications

### 5.1 External System: Kiro AI API

| Attribute | Value |
|-----------|-------|
| Purpose | AI inference backend (chat completions) |
| Direction | Outbound |
| Data Format | JSON (Anthropic Messages API compatible) |
| Frequency | Real-time (per user request) |
| Endpoint | `https://kiro.api.{region}.amazonaws.com/v1/messages` |
| Auth | AWS SigV4 (service: "kiro") |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| messages, model, max_tokens, tools | AI-generated response | Send/Receive | BR-02 (ID passthrough) |
| SigV4 signed headers | Authentication validation | Send | BR-11 |

### 5.2 External System: Anthropic API (Direct)

| Attribute | Value |
|-----------|-------|
| Purpose | Direct Anthropic API access (API key mode) |
| Direction | Outbound |
| Data Format | JSON (Anthropic Messages API) |
| Frequency | Real-time (per user request) |
| Endpoint | `https://api.anthropic.com/v1/messages` |
| Auth | x-api-key header |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| messages, model, max_tokens, tools | AI-generated response | Send/Receive | BR-02 |
| x-api-key header | Authentication validation | Send | BR-01 |

### 5.3 External System: AWS Credential Store

| Attribute | Value |
|-----------|-------|
| Purpose | Read Kiro/AWS SSO credentials |
| Direction | Inbound (read-only) |
| Data Format | INI file (~/.aws/credentials) or JSON (Kiro internal) |
| Frequency | On-demand (per credential resolution) |

---

## 6. Processing Logic

### 6.1 Request Processing Pipeline

**Trigger:** POST /v1/messages received
**Input:** HTTP request with JSON body
**Output:** SSE stream or JSON response

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Parse request body | Return 400 if invalid JSON |
| 2 | Validate required fields (model, messages, max_tokens) | Return 400 with field-level errors |
| 3 | Resolve authentication (see UC-02) | Return 401 if no auth available |
| 4 | Check tool_result continuation (if toolResult present) | Return 400 if tool_use_id mismatch |
| 5 | Build upstream request body | — |
| 6 | Sign request (Kiro mode) or add API key header (Anthropic mode) | Return 500 if signing fails |
| 7 | Send request to upstream API | Return 502 if connection fails |
| 8 | Stream response to client (if stream:true) or return JSON | Send error event on stream failure |
| 9 | Update conversation history | — |

### 6.2 Credential Resolution Algorithm

**Trigger:** Authentication needed for request
**Input:** Request headers, environment
**Output:** Resolved credentials or error

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Check x-api-key header — if present, use Anthropic mode | — |
| 2 | Check cached credentials — if valid (not expired), return | — |
| 3 | Read Kiro credential store file | If not found, go to step 4 |
| 4 | Read ~/.aws/credentials [kiro] profile | If not found, go to step 5 |
| 5 | Check AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY env vars | If not found, return error |
| 6 | Validate expiration (if token has expiration) | If expired, attempt refresh |
| 7 | Cache credentials in memory | — |
| 8 | Extract region from credential config | Default: us-east-1 |

### 6.3 SigV4 Signing Process

**Trigger:** Kiro mode request ready to send
**Input:** Request body, credentials, region
**Output:** Signed HTTP headers

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Create canonical request (method, path, query, headers, body hash) | — |
| 2 | Create string to sign (algorithm, datetime, scope, canonical hash) | — |
| 3 | Calculate signing key (date + region + service + "aws4_request") | — |
| 4 | Calculate signature (HMAC-SHA256) | — |
| 5 | Construct Authorization header | — |
| 6 | Add x-amz-date, x-amz-security-token headers | — |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Screens/Features |
|------|-------------|-------------------|
| Developer (local) | Full access to /v1/messages, /v1/health | Chat Panel, Settings |
| Extension code | POST /v1/messages, POST /api/chat/completions | Programmatic access |
| External network | BLOCKED — 127.0.0.1 only | No access |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| AWS credentials (accessKeyId, secretAccessKey, sessionToken) | Restricted | Never log, never expose in errors (BR-07) |
| API key | Restricted | Never log, mask in UI (show last 4 chars only) |
| Chat messages (user content) | Internal | Local only, not persisted beyond session memory |
| AI responses | Internal | Local only, streamed to client |

### 7.3 Audit Trail

| Event | Logged Fields | Retention | Business Reason |
|-------|--------------|-----------|-----------------|
| Request received | timestamp, model, sessionId, auth_mode | Session lifetime | Debugging |
| Upstream error | timestamp, status_code, error_type (NOT body) | Session lifetime | Troubleshooting |
| Credential refresh | timestamp, source, success/fail | Session lifetime | Auth debugging |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Proxy adds minimal overhead | Less than 100ms added latency (measured: time_total - time_upstream) |
| Performance | Real-time streaming | Token-to-token delay under 50ms |
| Performance | Fast startup | Route registration under 200ms |
| Availability | No impact on MCP server | Proxy failure isolated; MCP tools/resources unaffected |
| Availability | Health check responsive | /v1/health returns within 5 seconds |
| Scalability | Concurrent sessions | 5 or more concurrent sessions without degradation |
| Compatibility | Cross-platform | Windows, macOS, Linux (Node.js 20.x) |
| Compatibility | Anthropic API spec | Response format indistinguishable from direct API |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| No API key or credentials | Critical | "API key required. Set it in SDLC Pipeline Settings, or log in via Kiro IDE." | Settings screen opens |
| Credentials expired | Critical | "Credentials expired. Please re-authenticate via Kiro IDE." | User re-logins |
| API unreachable | Warning | "AI service temporarily unavailable. Retrying..." | Auto-retry once after 2s |
| Rate limited | Warning | "Rate limit exceeded. Please wait." | Show countdown |
| Invalid request | Info | "Invalid request: {field} is required" | Highlight field |
| Stream interrupted | Warning | "Connection lost. Partial response shown." | Show what was received |
| Tool ID mismatch | Info | "Tool execution failed: ID not found in conversation" | Detailed error with available IDs |

### 9.2 Error Response Format

All errors follow Anthropic error format:

```json
{
  "type": "error",
  "error": {
    "type": "authentication_error|invalid_request_error|api_error|rate_limit_error",
    "message": "Human-readable description"
  }
}
```

---

## 10. State Machine

### 10.1 Request State Diagram

![Request State Diagram](diagrams/state-request.png)

**States:**

| State | Description |
|-------|-------------|
| RECEIVED | Request parsed and validated |
| AUTHENTICATING | Resolving credentials |
| FORWARDING | Sending to upstream API |
| STREAMING | Actively streaming response to client |
| COMPLETE | Response fully delivered |
| ERROR | Terminal error state |

**Transitions:**

| From | To | Trigger |
|------|-----|---------|
| RECEIVED | AUTHENTICATING | Valid request body |
| RECEIVED | ERROR | Invalid request |
| AUTHENTICATING | FORWARDING | Credentials resolved |
| AUTHENTICATING | ERROR | Auth failed |
| FORWARDING | STREAMING | Upstream connection established (stream:true) |
| FORWARDING | COMPLETE | Full response received (stream:false) |
| FORWARDING | ERROR | Upstream error |
| STREAMING | COMPLETE | message_stop received |
| STREAMING | ERROR | Connection dropped |

### 10.2 Credential State Diagram

![Credential State Diagram](diagrams/state-credential.png)

**States:**

| State | Description |
|-------|-------------|
| NOT_CONFIGURED | No credential source found |
| VALID | Credentials loaded and not expired |
| EXPIRING_SOON | Credentials valid but expire within 5 minutes |
| EXPIRED | Credentials past expiration |
| REFRESHING | Attempting token refresh |

---

## 11. Sequence Diagrams

### 11.1 Chat Message Flow (Kiro Mode)

![Sequence — Kiro Mode](diagrams/sequence-kiro-mode.png)

### 11.2 Chat Message Flow (API Key Mode)

![Sequence — API Key Mode](diagrams/sequence-apikey-mode.png)

### 11.3 Tool Use Cycle

![Sequence — Tool Use](diagrams/sequence-tool-use.png)

---

## 12. Testing Considerations

### 12.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Valid streaming request with API key | POST /v1/messages, x-api-key header, stream:true | SSE events with message_stop | High |
| TC-02 | Non-streaming request | POST /v1/messages, stream:false | Single JSON response | High |
| TC-03 | Missing credentials | POST /v1/messages, no auth | HTTP 401 with auth_error | High |
| TC-04 | Tool use then tool result then AI continues | Multi-turn with toolResult | Correct continuation | High |
| TC-05 | Tool ID mismatch | Invalid toolUseId | HTTP 400 with mismatch error | Medium |
| TC-06 | Health check all healthy | GET /v1/health (valid credentials) | {status: "healthy"} | Medium |
| TC-07 | Health check degraded | GET /v1/health (API unreachable) | {status: "degraded"} | Medium |
| TC-08 | Client disconnect mid-stream | Close connection during streaming | Upstream request aborted | High |
| TC-09 | Large request body (more than 4MB) | Oversized POST body | HTTP 413 | Low |
| TC-10 | Concurrent sessions | 5 parallel requests | All complete within SLA | Medium |

---

## 13. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Request State Machine | [state-request.png](diagrams/state-request.png) | [state-request.drawio](diagrams/state-request.drawio) |
| 3 | Credential State Machine | [state-credential.png](diagrams/state-credential.png) | [state-credential.drawio](diagrams/state-credential.drawio) |
| 4 | Sequence — Kiro Mode | [sequence-kiro-mode.png](diagrams/sequence-kiro-mode.png) | [sequence-kiro-mode.drawio](diagrams/sequence-kiro-mode.drawio) |
| 5 | Sequence — API Key Mode | [sequence-apikey-mode.png](diagrams/sequence-apikey-mode.png) | [sequence-apikey-mode.drawio](diagrams/sequence-apikey-mode.drawio) |
| 6 | Sequence — Tool Use | [sequence-tool-use.png](diagrams/sequence-tool-use.png) | [sequence-tool-use.drawio](diagrams/sequence-tool-use.drawio) |

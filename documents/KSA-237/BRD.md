# Business Requirements Document (BRD)

## Kiro AI Proxy Server (kiro-ts) — KSA-237: Integrate chat completions endpoint into MCP server (kiro-ts)

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

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | TBD – Technical Lead | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-237 and stakeholder inputs |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request covers the integration of an Anthropic-compatible chat completions endpoint into the existing MCP Code Intelligence server (`mcp-code-intelligence-nodejs`). The implementation, referred to as **kiro-ts**, will act as a proxy server written in TypeScript that:

1. Reads credentials from the Kiro IDE login (AWS SSO) — zero-config for developers
2. Connects to the Kiro AI API using AWS SigV4 authentication
3. Exposes a `POST /v1/messages` endpoint that is fully Anthropic Messages API-compatible
4. Supports streaming responses via Server-Sent Events (SSE)
5. Integrates into the existing `http-entry.js` entry point of the MCP server (port 9181)
6. Enables the Chat Panel extension (webview) and other Anthropic-compatible clients to communicate with Kiro AI without needing a separate API key

This is analogous to `kiro-rs` (Rust implementation) but implemented in TypeScript within the MCP server runtime.

### 1.2 Out of Scope

- Modifications to the Kiro AI API backend service
- Changes to the AWS SSO authentication flow itself
- Development of new AI models or fine-tuning
- Mobile or web standalone client implementations
- kiro-rs Rust implementation changes
- MCP tool/resource endpoint modifications (existing MCP functionality unchanged)

### 1.3 Preliminary Requirement

- MCP Code Intelligence server (`mcp-code-intelligence-nodejs`) must be running on port 9181
- Kiro IDE must be installed with valid AWS SSO credentials configured
- Access to Kiro AI API endpoint (`https://kiro.api.{region}.amazonaws.com/v1/messages`)
- Node.js runtime environment (as part of MCP server)
- `kiro-sdlc-agents` VS Code/Kiro extension installed (for Chat Panel integration)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The following diagram illustrates the high-level business flow for the kiro-ts proxy integration:

![Business Flow](diagrams/business-flow.png)
*[Edit in draw.io](diagrams/business-flow.drawio)*

![Use Case Diagram](diagrams/use-case.png)
*[Edit in draw.io](diagrams/use-case.drawio)*

**High-Level Flow:**

1. Developer opens Kiro IDE → Chat Panel extension activates
2. Chat Panel sends request to `http://127.0.0.1:9181/v1/messages` (Anthropic format)
3. kiro-ts proxy receives request on MCP server
4. Proxy auto-detects Kiro credentials (AWS SSO credential file)
5. Proxy signs request with AWS SigV4
6. Proxy forwards to Kiro AI API (`https://kiro.api.{region}.amazonaws.com/v1/messages`)
7. Kiro AI API returns response (streaming SSE or single JSON)
8. Proxy streams response back to Chat Panel in Anthropic format
9. Developer sees AI output in real-time

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want to use Chat Panel with Kiro AI so that I don't need a separate Anthropic API key | MUST HAVE | KSA-237 |
| 2 | As a developer, I want the proxy to be Anthropic-compatible so that existing tool-calling (ReAct loop) works seamlessly | MUST HAVE | KSA-237 |
| 3 | As a developer, I want auto-detection of Kiro credentials so that setup is zero-config | MUST HAVE | KSA-237 |
| 4 | As a developer, I want a connection test feature so that I can verify the setup works | SHOULD HAVE | KSA-237 |
| 5 | As a developer, I want streaming responses so that I see AI output in real-time | MUST HAVE | KSA-237 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer launches Kiro IDE. The MCP Code Intelligence server starts on port 9181 with the kiro-ts proxy endpoint registered.

**Step 2:** Developer opens Chat Panel (webview extension). The extension detects the local proxy at `http://127.0.0.1:9181/v1/messages`.

**Step 3:** Developer types a message in Chat Panel. The extension constructs an Anthropic Messages API request and sends it to the proxy.

**Step 4:** kiro-ts proxy receives the request. It validates the request format (Anthropic Messages API schema).

**Step 5:** Proxy reads Kiro credentials from the local credential store (`~/.aws/credentials` or Kiro internal credential store).

**Step 6:** Proxy signs the outgoing request using AWS SigV4 with the retrieved credentials.

**Step 7:** Proxy forwards the signed request to the Kiro AI API endpoint.

**Step 8:** Kiro AI API processes the request and returns a response (streaming via SSE or complete JSON).

**Step 9:** Proxy translates the Kiro AI response back into Anthropic Messages API format and streams it to the client.

**Step 10:** Chat Panel renders the AI response in real-time (token by token for streaming).

> **Note:** If credentials are expired or missing, the proxy returns a clear error message instructing the developer to re-authenticate via Kiro IDE login.

---

#### STORY 1: Chat Panel Integration with Kiro AI

> As a developer, I want to use Chat Panel with Kiro AI so that I don't need a separate Anthropic API key.

**Requirement Details:**

1. The Chat Panel extension (webview) must connect to the local kiro-ts proxy at `http://127.0.0.1:9181/v1/messages`
2. The proxy must handle Anthropic Messages API format requests natively
3. No manual API key configuration should be required for Kiro AI usage
4. The Settings screen shows an API Key field for Anthropic-native client compatibility, but this is optional when using Kiro credentials
5. The Chat Panel must work immediately after Kiro IDE login without additional setup

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| model | string | Yes | Model identifier (Claude family) | `claude-sonnet-4-20250514` |
| messages | array | Yes | Conversation messages array | `[{"role": "user", "content": "Hello"}]` |
| max_tokens | integer | Yes | Maximum tokens in response | `4096` |
| stream | boolean | No | Enable streaming response | `true` |
| system | string | No | System prompt | `"You are a helpful assistant"` |
| temperature | float | No | Sampling temperature | `0.7` |

**Acceptance Criteria:**

1. GIVEN a developer has logged into Kiro IDE, WHEN they open Chat Panel and send a message, THEN the message is processed by Kiro AI via the local proxy without requiring any API key setup
2. GIVEN the MCP server is running on port 9181, WHEN Chat Panel sends a POST to `/v1/messages`, THEN the proxy responds with a valid Anthropic Messages API response
3. GIVEN the proxy is running, WHEN a request is received in Anthropic format, THEN it is transparently forwarded to Kiro AI API with proper authentication
4. GIVEN valid Kiro credentials exist, WHEN the proxy starts, THEN it automatically detects and uses those credentials

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Chat Input | TextArea | Yes | Text field for user message input | Multi-line, supports markdown |
| 2 | Send Button | Button | Yes | Sends message to proxy | Disabled while waiting for response |
| 3 | Response Area | Container | Yes | Displays AI response with streaming | Supports code blocks, markdown |
| 4 | API Key Field | Input | No | Optional API key for Anthropic-native clients | In Settings screen |
| 5 | Connection Status | Indicator | Yes | Shows proxy connection status | Green=connected, Red=disconnected |

**Validation Rules:**

- `messages` array must contain at least one message with role "user"
- `model` must be a valid Claude model identifier supported by Kiro AI
- `max_tokens` must be a positive integer (1–200000)
- `temperature` must be between 0.0 and 1.0 if provided

**Error Handling:**

- Missing/invalid request body: Return HTTP 400 with Anthropic-format error `{"type": "error", "error": {"type": "invalid_request_error", "message": "..."}}`
- Kiro AI API unavailable: Return HTTP 502 with descriptive error message
- Rate limiting: Forward Kiro AI rate limit response with HTTP 429

---

#### STORY 2: Anthropic API Compatibility

> As a developer, I want the proxy to be Anthropic-compatible so that existing tool-calling (ReAct loop) works seamlessly.

**Requirement Details:**

1. The proxy must implement the full Anthropic Messages API specification at `POST /v1/messages`
2. Tool use (function calling) must be fully supported — tool definitions in request, tool_use content blocks in response, tool_result messages from client
3. The ReAct loop (Reasoning + Acting) pattern used by agents must work without modification
4. All Anthropic message content types must be supported: text, image, tool_use, tool_result
5. Response format must be identical to Anthropic API — clients cannot distinguish between direct Anthropic and kiro-ts proxy

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| tools | array | No | Tool definitions for function calling | `[{"name": "get_file", "description": "...", "input_schema": {...}}]` |
| tool_choice | object | No | Tool selection strategy | `{"type": "auto"}` |
| stop_sequences | array | No | Custom stop sequences | `["\n\nHuman:"]` |
| metadata | object | No | Request metadata | `{"user_id": "dev-123"}` |

**Acceptance Criteria:**

1. GIVEN a request with `tools` array defined, WHEN the AI decides to call a tool, THEN the response contains `tool_use` content blocks with correct tool name and input
2. GIVEN a `tool_result` message in the conversation, WHEN the proxy forwards it, THEN the AI can use the tool result to continue reasoning
3. GIVEN any valid Anthropic Messages API request, WHEN processed by the proxy, THEN the response format is byte-for-byte compatible with direct Anthropic API response format
4. GIVEN the existing ReAct loop implementation in kiro-sdlc-agents, WHEN pointed to the kiro-ts proxy, THEN it works without code changes

**Validation Rules:**

- Tool definitions must include `name`, `description`, and `input_schema` (JSON Schema)
- `tool_choice` type must be one of: `auto`, `any`, `tool`
- Content blocks must have valid `type` field

**Error Handling:**

- Invalid tool definition schema: Return HTTP 400 with `invalid_request_error`
- Tool execution timeout on AI side: Forward timeout error from Kiro AI
- Malformed tool_result: Return HTTP 400 with details about which field is invalid

---

#### STORY 3: Auto-Detection of Kiro Credentials

> As a developer, I want auto-detection of Kiro credentials so that setup is zero-config.

**Requirement Details:**

1. The proxy must automatically locate and read Kiro credentials without user intervention
2. Credential sources (in priority order):
   a. Kiro internal credential store (IDE-managed)
   b. AWS credentials file (`~/.aws/credentials`) with Kiro-specific profile
   c. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`)
3. Credentials must be refreshed automatically when they expire (AWS SSO token refresh)
4. The proxy must detect the AWS region from the credential configuration
5. If no credentials are found, the proxy must return a clear error with instructions

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| access_key_id | string | Yes | AWS Access Key ID | `ASIA...` |
| secret_access_key | string | Yes | AWS Secret Access Key | `wJalr...` |
| session_token | string | Yes | AWS Session Token (temporary) | `FwoGZX...` |
| region | string | Yes | AWS Region for API endpoint | `us-east-1` |
| expiration | datetime | Yes | Token expiration time | `2026-06-05T16:00:00Z` |

**Acceptance Criteria:**

1. GIVEN a developer has logged into Kiro IDE (AWS SSO), WHEN the proxy starts, THEN it automatically reads credentials from the credential store without any manual configuration
2. GIVEN credentials exist in multiple sources, WHEN the proxy resolves credentials, THEN it follows the priority order: Kiro internal > AWS file > environment variables
3. GIVEN credentials are about to expire (within 5 minutes), WHEN a request arrives, THEN the proxy refreshes credentials before forwarding the request
4. GIVEN no valid credentials are found, WHEN a request arrives, THEN the proxy returns HTTP 401 with error message: "Kiro credentials not found. Please log in via Kiro IDE."
5. GIVEN the credential file contains a region setting, WHEN the proxy constructs the API URL, THEN it uses the correct regional endpoint

**Validation Rules:**

- Credential file must be readable by the current user
- Session token must not be expired at time of use
- Region must be a valid AWS region string

**Error Handling:**

- Credential file not found: Return HTTP 401 with `{"type": "error", "error": {"type": "authentication_error", "message": "Kiro credentials not found. Please log in via Kiro IDE."}}`
- Credentials expired and refresh fails: Return HTTP 401 with `{"type": "error", "error": {"type": "authentication_error", "message": "Credentials expired. Please re-authenticate."}}`
- Invalid region: Return HTTP 500 with `{"type": "error", "error": {"type": "api_error", "message": "Invalid AWS region configuration."}}`

---

#### STORY 4: Connection Test Feature

> As a developer, I want a connection test feature so that I can verify the setup works.

**Requirement Details:**

1. Provide a health check endpoint at `GET /v1/health` that verifies the full chain: credential availability → API connectivity → response validity
2. The test should be invocable from Chat Panel settings UI with a "Test Connection" button
3. The test result should clearly indicate which component failed (if any)
4. Response time of the health check should be under 5 seconds

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| status | string | Yes | Overall health status | `healthy` / `degraded` / `unhealthy` |
| credentials | object | Yes | Credential check result | `{"status": "ok", "expires_in": "45m"}` |
| api_connectivity | object | Yes | API reachability result | `{"status": "ok", "latency_ms": 230}` |
| model_available | object | Yes | Model availability check | `{"status": "ok", "model": "claude-sonnet-4-20250514"}` |
| timestamp | string | Yes | Check timestamp | `2026-06-05T15:30:00Z` |

**Acceptance Criteria:**

1. GIVEN the proxy is running, WHEN a GET request is sent to `/v1/health`, THEN it returns a JSON response with status of each component
2. GIVEN all components are healthy, WHEN health check is performed, THEN status is `healthy` and all sub-checks show `ok`
3. GIVEN credentials are missing, WHEN health check is performed, THEN status is `unhealthy` and `credentials.status` is `failed` with descriptive message
4. GIVEN Kiro AI API is unreachable, WHEN health check is performed, THEN status is `degraded` and `api_connectivity.status` is `failed`
5. GIVEN the Chat Panel settings, WHEN user clicks "Test Connection", THEN it calls `/v1/health` and displays the result in a user-friendly format

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Test Connection Button | Button | Yes | Triggers health check | In Settings screen |
| 2 | Status Badge | Badge | Yes | Shows overall status | Green/Yellow/Red based on health |
| 3 | Details Accordion | Collapsible | No | Shows detailed check results | Expandable per component |
| 4 | Latency Display | Label | No | Shows API response time | In milliseconds |

**Error Handling:**

- Health check timeout (>5s): Return `{"status": "unhealthy", "error": "Health check timed out"}`
- Partial failure: Return `degraded` status with failed components identified

---

#### STORY 5: Streaming Responses (SSE)

> As a developer, I want streaming responses so that I see AI output in real-time.

**Requirement Details:**

1. When `stream: true` is set in the request, the proxy must return Server-Sent Events (SSE)
2. The SSE format must be fully Anthropic-compatible:
   - `message_start` event with message metadata
   - `content_block_start` events for each content block
   - `content_block_delta` events with incremental text
   - `content_block_stop` events
   - `message_delta` event with stop reason and usage
   - `message_stop` event
3. The proxy must stream data as soon as it arrives from Kiro AI — no buffering
4. If the upstream connection drops mid-stream, the proxy must send an error event and close the connection

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| event | string | Yes | SSE event type | `content_block_delta` |
| data | object | Yes | Event payload | `{"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello"}}` |

**Acceptance Criteria:**

1. GIVEN a request with `stream: true`, WHEN the proxy receives it, THEN it responds with `Content-Type: text/event-stream` and streams events
2. GIVEN streaming is active, WHEN Kiro AI sends a token, THEN the proxy forwards it to the client within 50ms (no buffering delay)
3. GIVEN a streaming response, WHEN all tokens are sent, THEN the final events are `message_delta` (with usage stats) followed by `message_stop`
4. GIVEN a stream in progress, WHEN the upstream connection drops, THEN the proxy sends an error SSE event and closes the client connection gracefully
5. GIVEN a request with `stream: false` or `stream` omitted, WHEN the proxy receives it, THEN it returns a single complete JSON response (non-streaming)

**Validation Rules:**

- SSE events must follow the format: `event: {type}\ndata: {json}\n\n`
- Each data payload must be valid JSON
- Events must be sent in the correct order as defined by Anthropic API spec

**Error Handling:**

- Upstream timeout during stream: Send `event: error\ndata: {"type": "error", "error": {"type": "api_error", "message": "Upstream timeout"}}\n\n` then close
- Client disconnects mid-stream: Proxy must detect and close upstream connection to avoid resource leak
- Malformed SSE from upstream: Log error, send error event to client, close connection

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| MCP Code Intelligence Server | System | N/A | Must be running on port 9181; kiro-ts integrates into http-entry.js |
| Kiro IDE Login (AWS SSO) | Infrastructure | N/A | Must provide valid credentials in local credential store |
| Kiro AI API | External | N/A | Backend AI service at `https://kiro.api.{region}.amazonaws.com/v1/messages` |
| kiro-sdlc-agents Extension | System | N/A | Chat Panel webview that consumes the proxy endpoint |
| AWS SigV4 Signing Library | System | N/A | Node.js library for signing requests (e.g., @aws-sdk/signature-v4) |
| Node.js HTTP Module | System | N/A | Built-in HTTP server (no Express) for request handling |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Developer (User) | All Kiro IDE Users | End user of Chat Panel AI integration | KSA-237 requirement |
| Technical Lead | TBD | Architecture review and approval | KSA-237 assignee |
| Product Owner | TBD | Feature acceptance and priority | KSA-237 reporter |
| Platform Team | Kiro AI API Team | Provide stable API endpoint | External dependency |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AWS SSO token refresh may fail silently | High | Medium | Implement explicit refresh with retry and clear error reporting |
| Kiro AI API latency may exceed user expectations | Medium | Medium | Implement streaming to show partial results immediately |
| Port 9181 conflict with other local services | Low | Low | Make port configurable via environment variable |
| Breaking changes in Anthropic API spec | Medium | Low | Version the proxy endpoint; maintain compatibility layer |
| Credential file permissions may block access | Medium | Medium | Check file permissions on startup; report clear error |

### 5.2 Assumptions

- Kiro IDE login already manages AWS SSO credential lifecycle (issue, refresh, store)
- The Kiro AI API accepts and returns data in a format that can be mapped to Anthropic Messages API
- The MCP server's `http-entry.js` can be extended to handle additional routes without affecting existing MCP functionality
- Network connectivity to AWS endpoints is available from the developer's machine
- Claude model family is the only model family supported via Kiro AI

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Response latency | Proxy overhead must add less than 100ms to end-to-end request time (excluding AI processing) |
| Performance | Streaming latency | Token-to-token forwarding delay must be under 50ms |
| Performance | Startup time | Proxy route registration must not add more than 200ms to MCP server startup |
| Security | Credential handling | Credentials must never be logged or exposed in error messages |
| Security | Transport | All communication to Kiro AI API must use HTTPS/TLS |
| Security | Local only | Proxy endpoint must only bind to 127.0.0.1 (localhost) — not accessible from network |
| Scalability | Concurrent requests | Must handle at least 5 concurrent chat sessions without degradation |
| Availability | Graceful degradation | If proxy fails, MCP server's existing functionality must not be affected |
| Availability | Health monitoring | Health endpoint must respond within 5 seconds |
| Compatibility | Node.js version | Must work with Node.js version bundled with Kiro IDE |
| Compatibility | OS support | Must work on Windows, macOS, and Linux |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-237 | Integrate chat completions endpoint into MCP server (kiro-ts) | To Do | Task | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| kiro-ts | TypeScript implementation of Anthropic-compatible proxy in MCP server |
| kiro-rs | Rust implementation of similar proxy (reference implementation) |
| MCP | Model Context Protocol — protocol for AI tool integration |
| SSE | Server-Sent Events — HTTP streaming protocol for real-time data |
| SigV4 | AWS Signature Version 4 — authentication protocol for AWS API calls |
| AWS SSO | AWS Single Sign-On — centralized access management |
| ReAct Loop | Reasoning + Acting pattern for AI agent tool use |
| Messages API | Anthropic's API specification for chat completions |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Anthropic Messages API Spec | https://docs.anthropic.com/en/api/messages |
| AWS SigV4 Documentation | https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html |
| MCP Specification | https://modelcontextprotocol.io/specification |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
| 2 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |

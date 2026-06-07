# User Guide (UG)

## kiro-ts Chat Proxy — KSA-237: Integrate chat completions endpoint into MCP server

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-237 |
| Title | Integrate chat completions endpoint into MCP server (kiro-ts) |
| Author | DEV Agent |
| Reviewer | BA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-237.docx |
| Related FSD | FSD-v1-KSA-237.docx |
| Related TDD | TDD-v1-KSA-237.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | DEV Agent | Initial document |

---

## 1. Introduction

### 1.1 Purpose

The kiro-ts module is an Anthropic Messages API-compatible chat proxy integrated into the MCP Code Intelligence HTTP server. It allows developers to use the Chat Panel in Kiro IDE to communicate with Kiro AI without needing a separate Anthropic API key — credentials are automatically resolved from Kiro IDE's AWS SSO login.

This guide covers installation, configuration, usage, and troubleshooting for end users (developers using Kiro IDE) and system administrators.

### 1.2 Audience

| Audience | What They Need |
|----------|---------------|
| Developer (End User) | How to use Chat Panel with Kiro AI via the proxy |
| System Administrator | How to configure credential resolution and networking |
| Extension Developer | How to integrate with the proxy API from custom clients |

### 1.3 Prerequisites

| Prerequisite | Version | Required |
|-------------|---------|----------|
| Kiro IDE | Latest | Yes |
| kiro-sdlc-agents Extension | ≥1.16.0 | Yes |
| Node.js (bundled with Kiro) | 20.x | Yes (auto-included) |
| Valid Kiro IDE login (AWS SSO) | — | Yes (for Kiro AI mode) |
| Anthropic API Key | — | No (optional, for direct Anthropic mode) |

---

## 2. Getting Started

### 2.1 Quick Start

The kiro-ts proxy is bundled inside the `kiro-sdlc-agents` VS Code/Kiro extension. No separate installation is needed.

```bash
# Step 1: Install the extension (if not already)
# Download kiro-sdlc-agents-1.16.0.vsix from releases
code --install-extension kiro-sdlc-agents-1.16.0.vsix

# Step 2: Log in to Kiro IDE
# Use the Kiro IDE login command (Command Palette → "Kiro: Sign In")
# This creates credentials at ~/.aws/sso/cache/kiro-auth-token.json

# Step 3: The MCP server starts automatically on port 9181
# kiro-ts proxy is available at http://127.0.0.1:9181/v1/messages

# Step 4: Verify — open Chat Panel in the IDE
# Or run health check manually:
curl http://127.0.0.1:9181/v1/health
```

**Expected health check output (healthy):**

```json
{
  "status": "healthy",
  "credentials": { "status": "ok", "type": "kiro", "expires_in": "45m" },
  "api_connectivity": { "status": "ok", "latency_ms": 230 },
  "model_available": { "status": "ok", "model": "claude-sonnet-4-20250514" },
  "timestamp": "2026-06-05T15:30:00Z"
}
```

### 2.2 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Kiro IDE / VS Code | 1.85+ | Latest |
| RAM | 512MB (for MCP server) | 1GB |
| Disk | 50MB (extension) | 100MB |
| OS | Windows 10+, macOS 12+, Linux (x64) | Any supported |
| Network | Internet access to AWS endpoints | Low-latency connection |

### 2.3 Distribution Format

| Format | How to Get | Use Case |
|--------|-----------|----------|
| VSIX Extension | GitHub Releases / VS Code Marketplace | Standard installation |

The kiro-ts proxy is compiled into the extension's `mcp-server/http/kiro-ts/` directory and loaded automatically when the MCP server starts.

### 2.4 Authentication Modes

The proxy supports two authentication modes:

| Mode | How It Works | When to Use |
|------|-------------|-------------|
| **Kiro Mode** (default, zero-config) | Reads AWS SSO token from `~/.aws/sso/cache/kiro-auth-token.json` | When logged into Kiro IDE |
| **API Key Mode** | Client provides `x-api-key` header with Anthropic API key | For direct Anthropic API access |

**Priority order:** If Kiro credentials are available, Kiro mode is used by default. If an external API key is provided in the request header (different from the internal private key), it overrides Kiro mode.

### 2.5 Verify Setup

After installation and login:

1. **Check server is running:** The MCP server starts on port 9181 when Kiro IDE opens a workspace.
2. **Check credentials:** Run `curl http://127.0.0.1:9181/v1/health` — `credentials.status` should be `"ok"`.
3. **Check API connectivity:** In the health response, `api_connectivity.status` should be `"ok"`.
4. **Test Chat Panel:** Open Chat Panel in IDE → send a message → you should receive a response.

**Common startup issues:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| Health returns `credentials.status: "failed"` | Not logged in to Kiro IDE | Run "Kiro: Sign In" from Command Palette |
| Port 9181 not listening | Extension not activated | Open a workspace folder; extension activates on workspace open |
| `api_connectivity.status: "failed"` | Network/firewall blocking AWS | Check internet access to `kiro.api.us-east-1.amazonaws.com` |

---

## 3. Configuration

### 3.1 Zero-Config Operation

In most cases, **no configuration is needed**. The proxy automatically:
- Detects Kiro credentials from the IDE login
- Binds to `127.0.0.1:9181` (localhost only)
- Uses the correct AWS region from the credential file

### 3.2 Credential File

**Location:** `~/.aws/sso/cache/kiro-auth-token.json`

This file is managed by Kiro IDE automatically when you sign in. You should NOT edit this file manually.

**Format:**

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "...",
  "expiresAt": "2026-06-05T16:00:00Z",
  "region": "us-east-1",
  "clientIdHash": "...",
  "authMethod": "sso",
  "provider": "kiro"
}
```

| Field | Description |
|-------|-------------|
| `accessToken` | Bearer token for Kiro AI API |
| `expiresAt` | Token expiration time (ISO 8601) |
| `region` | AWS region for API endpoint |

### 3.3 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key (fallback auth) | No | — |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (fallback auth) | No | — |
| `AWS_SESSION_TOKEN` | AWS session token (fallback auth) | No | — |

These environment variables are the lowest-priority credential source. They are only used if:
1. No Kiro SSO token is available
2. No API key is provided in the request

### 3.4 Chat Panel Settings

In the Chat Panel extension settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Base URL | string | `http://127.0.0.1:9181` | Proxy server URL |
| API Key | string | (auto-generated) | Internal private key (auto-filled) |
| Model | string | `claude-sonnet-4-20250514` | Default model to use |

The Chat Panel automatically configures itself to use the local proxy. The "API Key" field in settings shows the auto-generated private key that authenticates the Chat Panel to the local proxy (this is NOT your Anthropic API key).

### 3.5 Configuration Examples

#### Using Kiro Mode (Default — No Config Needed)

```
1. Sign in to Kiro IDE
2. Open workspace
3. Open Chat Panel → start chatting
```

#### Using Direct Anthropic Mode (Optional)

If you want to bypass Kiro and use your own Anthropic API key:

```bash
# Send request with x-api-key header
curl -X POST http://127.0.0.1:9181/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ant-your-anthropic-key" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 1024,
    "stream": false
  }'
```

---

## 4. Usage

### 4.1 Chat Panel (Primary Use Case)

**Description:** Use the Chat Panel in Kiro IDE to chat with Claude AI through the local proxy.

**How to use:**

1. Open Kiro IDE with a workspace folder
2. Click the Chat Panel icon in the activity bar (or `Ctrl+Shift+P` → "Open Chat Panel")
3. Type your message in the input area
4. Press Enter or click Send
5. The AI response streams in real-time

**Features available through Chat Panel:**
- Multi-turn conversations (history maintained per session)
- Tool calling (file reading, code search, etc.)
- Streaming responses (token by token)
- System prompt customization
- Model selection

### 4.2 API: POST /v1/messages (Chat Completions)

**Description:** Send a chat completion request programmatically. Fully Anthropic Messages API compatible.

**Endpoint:** `POST http://127.0.0.1:9181/v1/messages`

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| Content-Type | Yes | `application/json` |
| x-api-key | No | Anthropic API key (for direct Anthropic mode) |

**Request body:**

```json
{
  "model": "claude-sonnet-4-20250514",
  "messages": [
    {"role": "user", "content": "What is the capital of France?"}
  ],
  "max_tokens": 1024,
  "stream": true,
  "system": "You are a helpful assistant.",
  "temperature": 0.7
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| model | string | Yes | — | Claude model identifier |
| messages | array | Yes | — | Conversation messages |
| max_tokens | integer | Yes | — | Maximum response tokens (1–200000) |
| stream | boolean | No | `true` | Enable SSE streaming |
| system | string | No | — | System prompt |
| temperature | float | No | — | Sampling temperature (0.0–1.0) |
| tools | array | No | — | Tool definitions for function calling |
| tool_choice | object | No | — | Tool selection strategy |
| stop_sequences | array | No | — | Custom stop sequences |
| sessionId | string | No | `"default"` | Conversation session identifier |
| toolResult | object | No | — | Tool execution result (for ReAct loop) |

**Example — Streaming response:**

```bash
curl -X POST http://127.0.0.1:9181/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 1024,
    "stream": true
  }'
```

**Response (SSE stream):**

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_01","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","usage":{"input_tokens":10}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"! How can I help?"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":8}}

event: message_stop
data: {"type":"message_stop"}
```

**Example — Non-streaming response:**

```bash
curl -X POST http://127.0.0.1:9181/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 1024,
    "stream": false
  }'
```

**Response (JSON):**

```json
{
  "id": "msg_01",
  "type": "message",
  "role": "assistant",
  "content": [{"type": "text", "text": "Hello! How can I help you today?"}],
  "model": "claude-sonnet-4-20250514",
  "stop_reason": "end_turn",
  "usage": {"input_tokens": 10, "output_tokens": 12}
}
```

### 4.3 API: POST /v1/messages with Tool Calling

**Description:** Use function calling (tools) for AI agent workflows (ReAct loop).

**Request with tools:**

```json
{
  "model": "claude-sonnet-4-20250514",
  "messages": [{"role": "user", "content": "Read the file src/index.ts"}],
  "max_tokens": 4096,
  "stream": true,
  "tools": [
    {
      "name": "read_file",
      "description": "Read contents of a file",
      "input_schema": {
        "type": "object",
        "properties": {
          "path": {"type": "string", "description": "File path to read"}
        },
        "required": ["path"]
      }
    }
  ],
  "tool_choice": {"type": "auto"},
  "sessionId": "my-agent-session"
}
```

**When AI calls a tool, the response contains a `tool_use` content block:**

```json
{
  "type": "message",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_abc123",
      "name": "read_file",
      "input": {"path": "src/index.ts"}
    }
  ],
  "stop_reason": "tool_use"
}
```

**Send tool result back:**

```json
{
  "model": "claude-sonnet-4-20250514",
  "messages": [],
  "max_tokens": 4096,
  "stream": true,
  "sessionId": "my-agent-session",
  "toolResult": {
    "toolUseId": "toolu_abc123",
    "content": "export function main() { console.log('hello'); }",
    "isError": false
  }
}
```

The AI will then use the tool result to continue its response.

### 4.4 API: GET /v1/health (Health Check)

**Description:** Verify that credentials, API connectivity, and model availability are working.

**Endpoint:** `GET http://127.0.0.1:9181/v1/health`

**Example:**

```bash
curl http://127.0.0.1:9181/v1/health
```

**Response:**

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

**Health status values:**

| Status | Meaning |
|--------|---------|
| `healthy` | All components working |
| `degraded` | Credentials OK but API unreachable (network issue) |
| `unhealthy` | Credentials missing or invalid |

### 4.5 Conversation Sessions

The proxy maintains conversation history per session. Sessions are identified by the `sessionId` parameter.

**Key behaviors:**
- Default session ID is `"default"` if not specified
- Each session maintains full message history (user + assistant + tool results)
- Sessions persist until MCP server restart
- Tool use IDs are tracked per session for validation

**Using sessions:**

```json
{
  "model": "claude-sonnet-4-20250514",
  "messages": [{"role": "user", "content": "Remember: my name is Alice"}],
  "max_tokens": 1024,
  "sessionId": "session-alice"
}
```

Subsequent requests with the same `sessionId` will have access to the full conversation history.

---

## 5. User Interface Guide

### 5.1 Chat Panel

The Chat Panel is the primary UI for interacting with the kiro-ts proxy.

**Key Elements:**

| # | Element | Type | Description |
|---|---------|------|-------------|
| 1 | Message Input | TextArea | Type your message (supports multi-line) |
| 2 | Send Button | Button | Send message (or press Enter) |
| 3 | Response Area | Container | Displays AI responses with code blocks and markdown |
| 4 | Connection Status | Indicator | Green = connected, Red = disconnected |
| 5 | Model Selector | Dropdown | Choose Claude model |

### 5.2 Settings Panel

Access via Command Palette → "Chat Panel: Settings" or the gear icon in Chat Panel.

| # | Element | Description |
|---|---------|-------------|
| 1 | Base URL | Proxy endpoint (default: `http://127.0.0.1:9181`) |
| 2 | API Key | Auto-generated private key (do NOT change unless using external Anthropic key) |
| 3 | Model | Default model for new conversations |
| 4 | Test Connection | Button to run health check and display results |

### 5.3 Test Connection

Click "Test Connection" in Settings to verify the setup:
- ✅ Green badge = all checks passed
- ⚠️ Yellow badge = degraded (credentials OK, API issue)
- ❌ Red badge = unhealthy (credentials missing)

---

## 6. Administration

### 6.1 Token Refresh

Kiro SSO tokens expire periodically. When a token expires:

1. The proxy detects expiration (within 5 minutes of expiry)
2. The health endpoint reports credential status
3. **Action:** Re-login to Kiro IDE via "Kiro: Sign In" command

No manual token refresh is needed — the IDE handles this through the AWS SSO flow.

### 6.2 Monitoring Health

**Automated monitoring:**
```bash
# Check health every 60 seconds
watch -n 60 'curl -s http://127.0.0.1:9181/v1/health | jq .status'
```

**Key metrics to watch:**
- `credentials.expires_in` — re-login when under 10 minutes
- `api_connectivity.latency_ms` — should be under 500ms for good experience
- `status` — any non-"healthy" status needs attention

### 6.3 Restarting the Proxy

The proxy runs inside the MCP server process. To restart:

1. **Soft restart:** Close and reopen your workspace in Kiro IDE
2. **Hard restart:** Run Command Palette → "Developer: Reload Window"
3. **Extension restart:** Disable then re-enable `kiro-sdlc-agents` extension

---

## 7. Troubleshooting

### 7.1 Common Issues

| # | Symptom | Cause | Solution |
|---|---------|-------|----------|
| 1 | Chat Panel shows "Disconnected" | MCP server not running | Open a workspace folder; wait 5 seconds for server to start |
| 2 | "Kiro credentials not found" | Not logged in to Kiro IDE | Command Palette → "Kiro: Sign In" |
| 3 | "Kiro SSO token expired" | Token expired | Re-login: Command Palette → "Kiro: Sign In" |
| 4 | HTTP 502 "Failed to connect to AI service" | Network issue or Kiro API down | Check internet; try again in a few minutes |
| 5 | HTTP 429 "Rate limit exceeded" | Too many requests | Wait 30-60 seconds, then retry |
| 6 | HTTP 413 "Request body too large" | Message exceeds 4MB | Reduce message/context size |
| 7 | Slow responses (>5s latency) | Network or API congestion | Check health endpoint latency; ensure stable connection |
| 8 | Tool calling not working | Invalid tool definition | Verify tools have `name`, `description`, and `input_schema` |
| 9 | "tool_use_id_mismatch" error | Invalid toolResult.toolUseId | Ensure the tool_use_id matches one from the previous assistant response |
| 10 | Health check times out | Firewall blocking outbound HTTPS | Allow outbound on port 443 to `kiro.api.*.amazonaws.com` |

### 7.2 Error Codes

| HTTP Status | Error Type | Message | Action |
|-------------|-----------|---------|--------|
| 400 | `invalid_request_error` | "model is required" | Add `model` field to request body |
| 400 | `invalid_request_error` | "messages must be a non-empty array" | Provide at least one message |
| 400 | `invalid_request_error` | "max_tokens is required" | Add `max_tokens` field |
| 400 | `invalid_request_error` | "Invalid JSON: ..." | Fix JSON syntax in request body |
| 400 | `tool_use_id_mismatch` | "tool_use_id not found..." | Use correct tool_use_id from assistant response |
| 401 | `authentication_error` | "Kiro credentials not found..." | Log in to Kiro IDE |
| 401 | `authentication_error` | "Credentials expired..." | Re-authenticate via Kiro IDE |
| 413 | `invalid_request_error` | "Request body too large (max 4MB)" | Reduce request payload size |
| 429 | `rate_limit_error` | "Rate limit exceeded" | Wait and retry |
| 502 | `api_error` | "Failed to connect to AI service" | Check network; verify API is reachable |
| 504 | `api_error` | "Upstream timeout" | Retry; API may be under heavy load |

### 7.3 Logs

| Log Location | Content | Useful For |
|-------------|---------|------------|
| Kiro IDE Output Panel → "MCP Server" | Server startup, route registration | Verifying server started |
| stderr (within MCP process) | `[kiro-ts]` prefixed messages: auth resolution, errors | Debugging credential issues |
| Health endpoint response | Real-time diagnostic data | Connectivity troubleshooting |

**Viewing logs:**
1. Open Output panel in IDE (`Ctrl+Shift+U`)
2. Select "MCP Server" from the dropdown
3. Look for `[kiro-ts]` prefixed lines

### 7.4 FAQ

**Q: Do I need an Anthropic API key?**
A: No. If you're logged into Kiro IDE, the proxy automatically uses your Kiro credentials. An Anthropic API key is only needed if you want to bypass Kiro and use Anthropic directly.

**Q: Is my chat data stored anywhere?**
A: Conversation history is stored in-memory only (RAM). It is lost when the MCP server restarts. No data is persisted to disk.

**Q: Can other people on my network access the proxy?**
A: No. The proxy binds exclusively to `127.0.0.1` (localhost). It is not accessible from other machines on the network.

**Q: What happens if my token expires mid-conversation?**
A: The proxy will return a 401 error on the next request. Re-login to Kiro IDE, then continue chatting. Your conversation history (in-memory) is preserved.

**Q: Which Claude models are supported?**
A: Any model available through Kiro AI API, typically `claude-sonnet-4-20250514` and other Claude family models.

**Q: Can I use this proxy with other Anthropic-compatible clients (e.g., Continue, Cursor)?**
A: Yes. Any client that supports the Anthropic Messages API can connect to `http://127.0.0.1:9181/v1/messages`. You may need to configure the client's base URL and provide the auto-generated private API key (visible in Chat Panel settings).

**Q: What's the maximum message size?**
A: 4MB per request body. This includes all messages, system prompt, and tool definitions.

---

## 8. API Reference

### 8.1 POST /v1/messages

| Attribute | Value |
|-----------|-------|
| Method | POST |
| Path | `/v1/messages` (or `/api/chat/completions`) |
| Auth | x-api-key header (optional) or Kiro auto-detect |
| Max Body | 4MB |
| Timeout | 120 seconds |

**Input Schema:**

```json
{
  "type": "object",
  "required": ["model", "messages", "max_tokens"],
  "properties": {
    "model": { "type": "string", "description": "Claude model ID" },
    "messages": { "type": "array", "items": { "type": "object" }, "minItems": 1 },
    "max_tokens": { "type": "integer", "minimum": 1, "maximum": 200000 },
    "stream": { "type": "boolean", "default": true },
    "system": { "type": "string" },
    "temperature": { "type": "number", "minimum": 0, "maximum": 1 },
    "tools": { "type": "array" },
    "tool_choice": { "type": "object" },
    "stop_sequences": { "type": "array", "items": { "type": "string" } },
    "metadata": { "type": "object" },
    "sessionId": { "type": "string", "default": "default" },
    "toolResult": {
      "type": "object",
      "properties": {
        "toolUseId": { "type": "string" },
        "content": { "type": "string" },
        "isError": { "type": "boolean", "default": false }
      }
    }
  }
}
```

### 8.2 GET /v1/health

| Attribute | Value |
|-----------|-------|
| Method | GET |
| Path | `/v1/health` |
| Auth | None |
| Timeout | 5 seconds |

**Response Schema:**

```json
{
  "type": "object",
  "properties": {
    "status": { "type": "string", "enum": ["healthy", "degraded", "unhealthy"] },
    "credentials": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "enum": ["ok", "failed", "not_configured"] },
        "type": { "type": "string", "enum": ["kiro", "api_key"] },
        "expires_in": { "type": "string" },
        "error": { "type": "string" }
      }
    },
    "api_connectivity": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "enum": ["ok", "failed"] },
        "latency_ms": { "type": "integer" },
        "error": { "type": "string" }
      }
    },
    "model_available": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "enum": ["ok", "failed"] },
        "model": { "type": "string" },
        "error": { "type": "string" }
      }
    },
    "timestamp": { "type": "string", "format": "date-time" }
  }
}
```

---

## 9. Appendix

### 9.1 Glossary

| Term | Definition |
|------|------------|
| kiro-ts | TypeScript implementation of the Anthropic-compatible proxy in MCP server |
| MCP | Model Context Protocol — protocol for AI tool integration |
| SSE | Server-Sent Events — HTTP streaming protocol for real-time data |
| SigV4 | AWS Signature Version 4 — authentication protocol for AWS APIs |
| AWS SSO | AWS Single Sign-On — centralized access management |
| ReAct Loop | Reasoning + Acting pattern for AI agent tool use |
| Messages API | Anthropic's chat completions API specification |
| Chat Panel | VS Code webview extension for AI chat interface |

### 9.2 Related Documents

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-237.docx |
| FSD | FSD-v1-KSA-237.docx |
| TDD | TDD-v1-KSA-237.docx |

### 9.3 Version Compatibility

| Extension Version | kiro-ts Version | Breaking Changes |
|-------------------|----------------|-----------------|
| 1.16.0 | 1.0 | Initial release — chat proxy integration |

### 9.4 Supported Models

| Model ID | Description |
|----------|-------------|
| `claude-sonnet-4-20250514` | Claude Sonnet 4 (recommended) |
| Other Claude models | As available through Kiro AI API |

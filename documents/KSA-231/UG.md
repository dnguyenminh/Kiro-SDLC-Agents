# User Guide (UG)

## Kiro SDLC Agents — KSA-231: Kiro API Client Integration

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-231 |
| Title | Kiro API Client — User Guide |
| Author | DEV Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |

---

## 1. Overview

The Kiro API Client provides native integration with the Kiro LLM API directly within the VS Code extension, eliminating the need for the external kiro-rs proxy. It supports credential auto-detection, streaming responses, and model selection.

---

## 2. Quick Start

### 2.1 Prerequisites

- VS Code 1.85+ or Kiro IDE
- Active AWS SSO session (for credential detection)
- kiro-sdlc-agents extension installed

### 2.2 Setup

1. Ensure you have an active AWS SSO session:
   `ash
   aws sso login --profile your-profile
   `
2. Open VS Code Settings (Ctrl+,)
3. Search for "Kiro SDLC: LLM Provider"
4. Select "kiro" from the dropdown

The extension automatically detects your SSO credentials from ~/.aws/sso/cache/.

---

## 3. Configuration

### 3.1 Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `kiroSdlc.llmProvider` | `"anthropic"` | Active LLM provider ("kiro", "anthropic", "openai") |
| `kiroSdlc.kiro.modelId` | `"claude-sonnet-4-20250514"` | Model to use for Kiro API |
| `kiroSdlc.kiro.maxTokens` | `4096` | Max tokens per response |
| `kiroSdlc.kiro.temperature` | `0.7` | Temperature for generation |

### 3.2 Credential Detection

The client automatically scans:
1. `~/.aws/sso/cache/*.json` — AWS SSO token cache
2. Looks for non-expired tokens with valid accessToken field
3. Refreshes automatically when token expires

No manual credential configuration needed.

---

## 4. Usage

### 4.1 Switching to Kiro Provider

1. Open Command Palette (Ctrl+Shift+P)
2. Type "Kiro SDLC: Switch Provider"
3. Select "kiro"
4. Or: change kiroSdlc.llmProvider in settings.json

### 4.2 Model Selection

1. Open the Settings Panel in Chat
2. Model dropdown shows available models (fetched from Kiro API)
3. Models are cached for 1 hour
4. Click refresh icon to force re-fetch

### 4.3 Sending Messages

Once Kiro provider is active, all chat interactions use the Kiro API:
- Regular chat messages
- Agent invocations (BA, SA, DEV, QA, etc.)
- Code generation and analysis

Streaming responses appear progressively in the chat panel.

### 4.4 Cancelling a Request

- Click the "Stop" button in the chat panel
- Or press Escape while streaming
- The stream is aborted cleanly and partial response is preserved

---

## 5. Troubleshooting

### 5.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "No credentials found" | AWS SSO session expired | Run `aws sso login` |
| "Token refresh failed" | Network issue or SSO revoked | Re-login with `aws sso login` |
| "Request timeout" | Kiro API slow/unreachable | Check network, retry |
| "Model not available" | Model ID invalid or deprecated | Refresh model list in settings |
| Streaming stops mid-response | Network interruption | Retry the message |

### 5.2 Logs

Enable debug logging:
1. Open Output panel (Ctrl+Shift+U)
2. Select "Kiro SDLC Agents" from dropdown
3. Look for [KiroClient] prefixed messages

### 5.3 Resetting Provider

If the Kiro provider is stuck:
1. Switch to another provider (e.g., "anthropic")
2. Wait 2 seconds
3. Switch back to "kiro"
4. This resets the client and re-detects credentials

---

## 6. Architecture Notes (for developers)

| Module | File | Purpose |
|--------|------|---------|
| TokenManager | `src/langgraph/providers/token-manager.ts` | AWS SSO credential detection and refresh |
| KiroClient | `src/langgraph/providers/kiro-client.ts` | Main provider implementing LlmProvider |
| AnthropicAdapter | `src/langgraph/providers/anthropic-adapter.ts` | Format conversion Kiro↔Anthropic |
| StreamHandler | `src/langgraph/providers/stream-handler.ts` | SSE parsing with backpressure |
| ModelRegistry | `src/langgraph/providers/model-registry.ts` | Model list fetching and caching |

---

## 7. FAQ

**Q: Do I still need kiro-rs.exe?**
A: No. The native client replaces kiro-rs entirely. You can remove kiro-rs from your system.

**Q: Does it work offline?**
A: No. The Kiro API requires network access to the Kiro service endpoint.

**Q: Can I use multiple providers simultaneously?**
A: No. Only one provider is active at a time. Switch via settings.

**Q: What if my SSO session expires during a long chat?**
A: The TokenManager auto-refreshes. If refresh fails, you'll see an error and need to re-login.

# Release Notes (RLN)

## kiro-ts — KSA-237: Integrate chat completions endpoint into MCP server

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | MINOR (new feature) |
| Release Date | 2026-06-06 |
| Jira Ticket | KSA-237 |
| Branch | KSA-237 |
| Author | DevOps Agent |

---

## 1. Summary

Added Anthropic Messages API-compatible gateway wrapper to kiro-ts, enabling external AI agents (Cline, Cursor, Continue, etc.) to use Kiro backend models through a local proxy at `http://127.0.0.1:9181/anthropic`.

---

## 2. New Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | `/v1/messages` endpoint | Anthropic-compatible chat completions with SSE streaming |
| 2 | `/v1/models` endpoint | Returns real Kiro model list (14 models) |
| 3 | Auto SSO discovery | Discovers Kiro SSO credentials from `~/.aws/sso/cache/` |
| 4 | Token auto-refresh | Automatically refreshes expired SSO tokens |
| 5 | SigV4 request signing | Signs requests to Kiro Q API using AWS SigV4 |
| 6 | Adapter pattern | Translates between Anthropic format and Kiro internal format |

---

## 3. Technical Changes

### 3.1 New Files

| File | Purpose |
|------|---------|
| `src/http/kiro-ts/index.ts` | Module entry, route registration |
| `src/http/kiro-ts/credential-resolver.ts` | AWS SSO credential discovery |
| `src/http/kiro-ts/sigv4-signer.ts` | SigV4 signing implementation |
| `src/http/kiro-ts/sse-proxy.ts` | SSE streaming proxy |
| `src/http/kiro-ts/model-mapper.ts` | Model list mapping |

### 3.2 Modified Files

| File | Change |
|------|--------|
| `src/http/http-entry.ts` | Added route registration for chat proxy |

---

## 4. Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| KIRO_TS_PORT | 9181 | Gateway listen port |
| KIRO_Q_REGION | us-east-1 | AWS region for signing |

---

## 5. Testing

| Test Suite | Count | Result |
|-----------|-------|--------|
| kiro-ts unit tests | 78 | PASS |
| Extension tests | 48 | PASS |
| **Total** | **126** | **ALL PASS** |

---

## 6. Known Limitations

- Requires active AWS SSO session (must `aws sso login` first time)
- Only supports Anthropic Messages API format (not OpenAI format)
- Streaming only (non-streaming not supported)

---

## 7. Upgrade Instructions

1. Update kiro-sdlc-agents extension to latest version
2. Restart VS Code / Kiro IDE
3. Configure external agent Base URL: `http://127.0.0.1:9181/anthropic`
4. No API key needed (uses SSO)

---

## 8. Rollback

Revert to previous extension version. No data migration needed.

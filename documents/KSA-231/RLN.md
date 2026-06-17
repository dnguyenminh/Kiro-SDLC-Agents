# Release Notes (RLN)

## Kiro SDLC Agents — KSA-231: Kiro API Client Integration

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | MINOR (new feature) |
| Release Date | 2026-06-17 |
| Jira Ticket | KSA-231 |
| Branch | KSA-231 |
| Author | DevOps Agent |

---

## 1. Summary

Replaced the external kiro-rs.exe proxy with a native TypeScript Kiro API Client. The extension now communicates directly with the Kiro LLM API using native Node.js fetch, with automatic AWS SSO credential detection, token refresh, SSE streaming, and model registry caching.

---

## 2. New Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | Native Kiro API Client | Direct API communication without proxy |
| 2 | Auto credential detection | Reads AWS SSO tokens from ~/.aws/sso/cache |
| 3 | Auto token refresh | Mutex-protected concurrent-safe refresh |
| 4 | SSE streaming | Real-time streaming with backpressure |
| 5 | Model registry | API-fetched model list with 1h cache TTL |
| 6 | Provider switch | Seamless switch between kiro/anthropic/openai |

---

## 3. Technical Changes

### New Files (5 modules)

| File | Purpose |
|------|---------|
| `src/langgraph/providers/token-manager.ts` | Credential management |
| `src/langgraph/providers/kiro-client.ts` | API provider |
| `src/langgraph/providers/anthropic-adapter.ts` | Format conversion |
| `src/langgraph/providers/stream-handler.ts` | SSE parsing |
| `src/langgraph/providers/model-registry.ts` | Model caching |

### Modified Files

| File | Change |
|------|--------|
| `src/langgraph/llm-provider.ts` | Added "kiro" provider type |
| `src/langgraph/providers/index.ts` | Export new modules |
| `package.json` | New settings schema |

### Removed

| Item | Reason |
|------|--------|
| kiro-rs.exe dependency | Replaced entirely |

---

## 4. Breaking Changes

- kiro-rs.exe is NO LONGER used. Can be removed from system.
- No API changes for consumers (LlmProvider interface unchanged)

---

## 5. Testing

| Test Type | Cases | Result |
|-----------|-------|--------|
| PBT | 4 properties | PASS |
| Unit Tests | 22 | PASS |
| Integration | 4 | PASS |
| **Total** | **30** | **100% pass** |

---

## 6. Known Limitations

- Requires active AWS SSO session (no offline mode)
- Token refresh adds ~100ms latency on first request after expiry
- Model registry cache not persisted across extension restarts

---

## 7. Upgrade Instructions

1. Update extension to latest version
2. Remove kiro-rs.exe from PATH (optional, no longer used)
3. Ensure AWS SSO session active: `aws sso login`
4. Set provider: Settings > kiroSdlc.llmProvider = "kiro"
5. Restart IDE

---

## 8. Rollback

Revert to previous version. Will require kiro-rs.exe on PATH again.

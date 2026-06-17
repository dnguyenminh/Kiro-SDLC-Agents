# Software Test Cases (STC)

## Kiro SDLC Agents — KSA-231: Tích hợp Kiro API Client (Node.js) vào Extension

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-231 |
| Title | Tích hợp Kiro API Client (Node.js) vào Extension |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |
| Related STP | STP-v1-KSA-231.docx |

---

## 1. PBT — Property-Based Tests

| ID | Property | Generator | Assertions |
|----|----------|-----------|------------|
| PBT-01 | Token refresh never produces expired token | Random expiry timestamps | refreshed token.expiresAt > now |
| PBT-02 | SSE parser handles arbitrary chunk boundaries | Random split points in valid SSE stream | All events reconstructed correctly |
| PBT-03 | Concurrent refresh requests resolve to same token | Random concurrent count (2-20) | All promises resolve to identical token |
| PBT-04 | Cache TTL respects expiry | Random timestamps | stale items not returned after TTL |

---

## 2. UT — Unit Tests

| ID | Component | Test | Expected |
|----|-----------|------|----------|
| TC-01 | TokenManager | Detect SSO token from ~/.aws/sso/cache | Token parsed correctly |
| TC-02 | TokenManager | No SSO token available | Throws CredentialNotFound |
| TC-03 | TokenManager | Expired token detected | Auto-triggers refresh |
| TC-04 | TokenManager | Concurrent refresh (mutex) | Only one refresh call made |
| TC-05 | TokenManager | Refresh failure with retry | Retries 3x then throws |
| TC-06 | KiroClient | Sign request with token | Authorization header correct |
| TC-07 | KiroClient | Request timeout (5s) | AbortError thrown |
| TC-08 | StreamHandler | Parse single SSE event | Event object with type + data |
| TC-09 | StreamHandler | Parse multi-line data field | Data concatenated correctly |
| TC-10 | StreamHandler | Handle incomplete chunk | Buffers until newline pair |
| TC-11 | StreamHandler | Abort signal cancels stream | Stream reader cancelled, cleanup |
| TC-12 | StreamHandler | Backpressure (slow consumer) | Buffer doesn't exceed limit |
| TC-13 | ModelRegistry | Fetch models from API | Model list returned |
| TC-14 | ModelRegistry | Cache hit (within TTL) | No API call, cached list returned |
| TC-15 | ModelRegistry | Cache miss (expired TTL) | New API call, cache updated |
| TC-16 | AnthropicAdapter | Convert messages format | Kiro format → Anthropic format |
| TC-17 | AnthropicAdapter | Handle system message | System message extracted separately |
| TC-18 | AnthropicAdapter | Convert streaming response | SSE events → Anthropic delta objects |
| TC-19 | ProviderFactory | Register "kiro" provider | Factory.create("kiro") returns KiroClient |
| TC-20 | ProviderFactory | Switch provider at runtime | Active provider changes, old disposed |
| TC-21 | Dependencies | package.json check | No new dependencies added |
| TC-22 | Activation | Measure activation time | < 200ms (lazy init verified) |

---

## 3. IT — Integration Tests

| ID | Scenario | Setup | Steps | Expected |
|----|----------|-------|-------|----------|
| TC-23 | Full request flow | Mock HTTP server | 1. TokenManager gets token 2. KiroClient signs request 3. Server responds 4. AnthropicAdapter converts | Complete response in Anthropic format |
| TC-24 | Streaming flow | Mock SSE server | 1. KiroClient initiates stream 2. StreamHandler parses 3. Events emitted | All events received in order |
| TC-25 | Token refresh mid-stream | Mock server + expiring token | 1. Start stream 2. Token expires 3. Verify behavior | Stream continues after refresh (or clean error) |
| TC-26 | Model registry integration | Mock model API | 1. First call fetches 2. Second call uses cache 3. After TTL, re-fetches | Cache behavior correct |

---

## 4. E2E-UI — Manual Tests

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| E2E-01 | Select Kiro provider | Settings > Provider > Kiro | Provider switches, credentials detected |
| E2E-02 | Send chat with Kiro | Type message, send | Streaming response appears |
| E2E-03 | Model selection | Settings > Model dropdown | Available models from registry |
| E2E-04 | Cancel mid-stream | Click stop button | Stream aborts cleanly |
| E2E-05 | No credentials error | Remove AWS SSO cache | User-friendly error message |

---

## 5. SIT — Manual

| ID | Scenario | Type |
|----|----------|------|
| SIT-01 | Provider switch Anthropic → Kiro → back | Integration |
| SIT-02 | Long conversation (>100 messages) | Performance |
| SIT-03 | Network interruption during stream | Resilience |
| SIT-04 | Multiple extensions using same credentials | Concurrency |

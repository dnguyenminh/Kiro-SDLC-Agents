# Software Test Cases (STC)

## KSA-237: Integrate chat completions endpoint into MCP server (kiro-ts)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-237 |
| Version | 1.0 |
| Date | 2026-06-05 |
| Related STP | STP-v1-KSA-237.docx |

---

## Level 1: Property-Based Testing (PBT)

### PBT-01: Request Validator Fuzzing

| Attribute | Value |
|-----------|-------|
| ID | PBT-01 |
| Title | Request body validation handles arbitrary JSON inputs |
| Level | PBT |
| UC | UC-01 |
| Automation | vitest + fast-check |

**Properties to verify:**
1. Valid requests (model=string, messages=[{role:"user",content:string}], max_tokens=int>0) always pass validation
2. Missing required fields always produce 400 error with correct field name in message
3. Invalid types (model=number, messages=string) always produce 400 error
4. Temperature outside 0-1 is rejected
5. max_tokens outside 1-200000 is rejected

---

### PBT-02: SSE Event Format Compliance

| Attribute | Value |
|-----------|-------|
| ID | PBT-02 |
| Title | All generated SSE events match Anthropic format specification |
| Level | PBT |
| UC | UC-05 |

**Properties:**
1. Every event string matches pattern: event: {type}\ndata: {valid_json}\n\n
2. Data payload always has type field
3. content_block_delta always has index and delta fields
4. Event sequence: message_start first, message_stop last

---

### PBT-03: Credential Data Never Leaks

| Attribute | Value |
|-----------|-------|
| ID | PBT-03 |
| Title | Error responses never contain credential substrings |
| Level | PBT |
| UC | UC-02, BR-07 |

**Properties:**
1. For any credential, error messages never contain those strings
2. Log output never contains credential substrings

---

### PBT-04: Max Tokens Boundary

| Attribute | Value |
|-----------|-------|
| ID | PBT-04 |
| Title | max_tokens validation covers full boundary space |
| Level | PBT |
| UC | UC-01 |

**Properties:**
1. max_tokens in [1, 200000] always accepted
2. max_tokens <= 0 always rejected
3. max_tokens > 200000 always rejected

---

## Level 2: Unit Testing (UT)

### UT-01 through UT-10

(See STP.md for full descriptions of each unit test case)

| ID | Title | Module |
|----|-------|--------|
| UT-01 | validateRequest accepts well-formed requests | request-validator.ts |
| UT-02 | validateRequest returns Anthropic-format errors | request-validator.ts |
| UT-03 | resolveAuth follows priority chain | auth-resolver.ts |
| UT-04 | Auth errors never expose credentials | auth-resolver.ts |
| UT-05 | ConversationStore indexes tool_use IDs | conversation-store.ts |
| UT-06 | Tool ID mismatch produces descriptive error | conversation-store.ts |
| UT-07 | Health check aggregates statuses | health-checker.ts |
| UT-08 | formatSSEEvent produces valid strings | stream-proxy.ts |
| UT-09 | buildErrorResponse Anthropic format | chat-handler.ts |
| UT-10 | SigV4 canonical request and signature | sigv4-signer.ts |

---

## Level 3: Integration Testing (IT)

| ID | Title | Technique |
|----|-------|-----------|
| IT-01 | Full request pipeline with mock upstream | Local HTTP mock |
| IT-02 | Credential resolution from file system | Temp credential files |
| IT-03 | Tool calling cycle multi-turn | Mock upstream + real store |
| IT-04 | Health check with real credentials | Temp files + mock API |
| IT-05 | Streaming latency zero buffering | Timed mock |
| IT-06 | Proxy overhead under 100ms | Timing measurement |

---

## Level 4: E2E-API

| ID | Title |
|----|-------|
| E2E-API-01 | Full chat flow streaming |
| E2E-API-02 | Auth mode selection |
| E2E-API-03 | Tool use cycle E2E |
| E2E-API-04 | Health check E2E |

---

## Level 5: E2E-UI (Manual)

| ID | Title |
|----|-------|
| E2E-UI-01 | Chat Panel send message |
| E2E-UI-02 | Tool calling in Chat Panel |

---

## Level 6: SIT (Manual)

| ID | Title |
|----|-------|
| SIT-01 | Visual verification Chat Panel UI |
| SIT-02 | Extension lifecycle |

---

## Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 4 | 4 | 0 |
| UT | 10 | 10 | 0 |
| IT | 6 | 6 | 0 |
| E2E-API | 4 | 4 | 0 |
| E2E-UI | 2 | 0 | 2 |
| SIT | 2 | 0 | 2 |
| TOTAL | 28 | 24 (86%) | 4 (14%) |

# Software Test Plan (STP)

## Kiro SDLC Agents — KSA-231: Tích hợp Kiro API Client (Node.js) vào Extension

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-231 |
| Title | Tích hợp Kiro API Client (Node.js) vào Extension — Thay thế kiro-rs Proxy |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |
| Related BRD | BRD-v1-KSA-231.docx |
| Related FSD | FSD-v1-KSA-231.docx |
| Related TDD | TDD-v1-KSA-231.docx |

---

## 1. Introduction

### 1.1 Purpose

Test plan for the native Kiro API Client that replaces the external kiro-rs.exe proxy. Covers 5 modules: TokenManager, KiroClient, AnthropicAdapter, StreamHandler, ModelRegistry.

### 1.2 Scope

- Token credential management (AWS SSO detection, refresh, mutex)
- API communication (native fetch, request signing)
- SSE streaming (parse, backpressure, abort)
- Model registry (fetch, cache, TTL)
- Provider factory registration

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|-----------|-------|
| PBT | Token expiry calculations, stream chunk parsing | 100% | fast-check |
| UT | Each module independently (TokenManager, AnthropicAdapter, etc.) | 100% | Vitest/Mocha |
| IT | Module integration (Client + TokenManager + StreamHandler) | 100% | Vitest + mock server |
| E2E-API | Real Kiro API call (staging) | Manual | curl/httpie |
| E2E-UI | Settings panel model selection | Manual | VS Code Extension Host |
| SIT | Full provider switch and chat flow | Manual | Manual |

### 2.2 Entry/Exit Criteria

**Entry:** All modules compile, mock server available
**Exit:** All automated tests pass, streaming verified with real endpoint

---

## 3. Requirements Traceability Matrix (RTM)

| Requirement ID | Requirement | Test Case IDs |
|----------------|-------------|---------------|
| REQ-01 | Auto-detect AWS SSO credentials | TC-01, TC-02, TC-03 |
| REQ-02 | Token refresh with mutex (no race) | PBT-01, TC-04, TC-05 |
| REQ-03 | API request signing | TC-06, TC-07 |
| REQ-04 | SSE stream parsing | PBT-02, TC-08, TC-09, TC-10 |
| REQ-05 | Abort/cancel streaming | TC-11, TC-12 |
| REQ-06 | Model registry with 1h TTL cache | TC-13, TC-14, TC-15 |
| REQ-07 | Anthropic format adaptation | TC-16, TC-17, TC-18 |
| REQ-08 | Provider factory registration | TC-19, TC-20 |
| REQ-09 | Zero external dependencies | TC-21 |
| REQ-10 | Activation time < 200ms | TC-22 |

---

## 4. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AWS SSO token format changes | High | Version-specific parsing with fallback |
| Kiro API rate limiting | Medium | Exponential backoff in tests |
| SSE parser edge cases | Medium | PBT with random chunk boundaries |
| Token mutex deadlock | High | Timeout on mutex acquire |

---

## 5. Test Environment

| Component | Specification |
|-----------|--------------|
| Runtime | Node.js 20.x |
| Framework | Vitest or Mocha (existing) |
| Mock Server | Localhost HTTP server for API simulation |
| PBT | fast-check 3.23 |

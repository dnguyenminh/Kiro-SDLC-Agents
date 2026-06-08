# Software Test Plan (STP)

## KSA-244: Context Compression Module

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-244 |
| Title | Context Compression Module — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-244.docx |
| Related FSD | FSD-v1-KSA-244.docx |
| Related TDD | TDD-v1-KSA-244.docx |

---

## 1. Introduction

### 1.1 Purpose

This Software Test Plan defines the testing strategy, scope, and approach for the Context Compression Module (KSA-244). It ensures all functional and non-functional requirements are verified across 6 test levels.

### 1.2 Scope

Testing covers:
- ContentRouter (content type detection accuracy)
- SmartCrusher (JSON array compression ratios, strategies)
- CCR Store (SQLite persistence, TTL, LRU eviction)
- CacheAligner (date extraction from system prompts)
- CompressionCache (two-tier LRU, hit/miss behavior)
- CircuitBreaker (state transitions, failsafe behavior)
- CompressionPipeline (end-to-end orchestration)
- Integration with chat-routes.ts
- Performance (< 10ms budget)

### 1.3 Test Environment

| Component | Details |
|-----------|---------|
| Runtime | Node.js 20+ |
| Test Framework | Vitest |
| PBT | fast-check |
| Database | SQLite (in-memory for tests) |
| OS | Windows 11 / Linux (CI) |

---

## 2. Test Strategy

### 2.1 Test Levels Overview

| Level | ID Prefix | Purpose | Tools | Automation |
|-------|-----------|---------|-------|------------|
| Property-Based Testing (PBT) | PBT- | Verify invariants hold for arbitrary inputs | fast-check + Vitest | 100% automated |
| Unit Testing (UT) | UT- | Verify individual component logic | Vitest | 100% automated |
| Integration Testing (IT) | IT- | Verify component interactions with real SQLite | Vitest + better-sqlite3 | 100% automated |
| E2E-API Testing | E2E-API- | Verify compression in HTTP request lifecycle | Vitest + HTTP client | 100% automated |
| E2E-UI Testing | E2E-UI- | N/A (no UI in this module) | — | — |
| System Integration Testing (SIT) | SIT- | Verify with real Anthropic API calls | Manual + scripted | 50% automated |

### 2.2 Test Level Details

#### PBT (Property-Based Testing)
- **Focus:** SmartCrusher compression invariants, ContentRouter classification correctness
- **Properties to verify:**
  - Compressed output is always smaller than or equal to original
  - Compression ratio is between 0 and 1
  - Decompressed items are a valid subset of original items
  - ContentRouter always returns a valid ContentType
  - Cache never exceeds max capacity

#### Unit Testing (UT)
- **Focus:** Individual class methods, edge cases, business rules
- **Coverage target:** ≥ 90% for compression module

#### Integration Testing (IT)
- **Focus:** CCR Store with real SQLite, CompressionPipeline with all components wired
- **Technique:** In-memory SQLite database (`:memory:` or temp file)

#### E2E-API Testing
- **Focus:** Full HTTP request through chat-routes.ts with compression enabled
- **Technique:** HTTP client hitting local server with test messages

#### SIT (System Integration Testing)
- **Focus:** Verify compressed messages produce valid LLM responses
- **Limitation:** Requires Anthropic API key, run manually or in staging

---

## 3. Test Coverage Matrix

### 3.1 Requirements Traceability Matrix (RTM)

| Req ID | Requirement | PBT | UT | IT | E2E-API | SIT |
|--------|-------------|-----|----|----|---------|-----|
| BR-01 | JSON array detection (starts with `[`, valid parse) | PBT-01 | UT-01, UT-02 | IT-01 | E2E-API-01 | — |
| BR-02 | Code heuristic (syntax patterns in first 500 chars) | — | UT-03 | — | — | — |
| BR-03 | Log heuristic (>50% timestamp lines) | — | UT-04 | — | — | — |
| BR-04 | Minimum 100 chars for compression | PBT-02 | UT-05 | — | — | — |
| BR-05 | Default classification "text" | — | UT-06 | — | — | — |
| BR-10 | Min array size 5 items | PBT-03 | UT-10 | — | — | — |
| BR-11 | Default target ratio 0.3 | — | UT-11 | — | — | — |
| BR-12 | Low entropy threshold < 0.2 | PBT-04 | UT-12 | — | — | — |
| BR-13 | preserveFields always kept | PBT-05 | UT-13 | — | — | — |
| BR-14 | Summary header format | — | UT-14 | — | E2E-API-02 | — |
| BR-15 | Skip if compressed >= original | PBT-06 | UT-15 | — | — | — |
| BR-16 | Max 10ms for 1000 items | — | UT-16 | IT-02 | — | — |
| BR-20 | CCR TTL 3600s | — | UT-20 | IT-03 | — | — |
| BR-21 | CCR max 1000 entries | — | UT-21 | IT-04 | — | — |
| BR-22 | CCR LRU eviction | — | UT-22 | IT-05 | — | — |
| BR-23 | CCR key = UUID | — | UT-23 | IT-06 | — | — |
| BR-24 | Lazy cleanup every 100 stores | — | — | IT-07 | — | — |
| BR-30 | CacheAligner date patterns | — | UT-30, UT-31 | — | — | — |
| BR-31 | Only modify system prompts | — | UT-32 | IT-08 | — | — |
| BR-32 | Skip ambiguous dates | — | UT-33 | — | — | — |
| BR-33 | Placeholder format stable | PBT-07 | UT-34 | — | — | — |
| BR-40 | Skip Set max 10,000 | — | UT-40 | — | — | — |
| BR-41 | Result Cache max 500 | — | UT-41 | — | — | — |
| BR-42 | SHA-256 truncated hash | — | UT-42 | — | — | — |
| BR-43 | Cache hit < 0.1ms | — | UT-43 | — | — | — |
| BR-44 | In-memory only | — | UT-44 | — | — | — |
| BR-50 | Circuit breaker 5 failures | — | UT-50 | IT-09 | — | — |
| BR-51 | Open duration 60s | — | UT-51 | — | — | — |
| BR-52 | Any exception = failure | — | UT-52 | — | — | — |
| BR-53 | Timeout > 10ms = failure | — | UT-53 | IT-10 | — | — |
| BR-54 | Log state transitions | — | UT-54 | — | — | — |
| BR-60 | Only compress user/assistant string | — | UT-60 | IT-11 | E2E-API-03 | — |
| BR-61 | Never compress tool_use/tool_result | — | UT-61 | — | E2E-API-04 | — |
| BR-62 | System prompt: CacheAligner only | — | UT-62 | IT-12 | — | — |
| BR-63 | Failsafe pass-through on error | PBT-08 | UT-63 | IT-13 | E2E-API-05 | — |
| NFR-1 | < 10ms per message (p99) | — | UT-16 | IT-02 | E2E-API-06 | SIT-01 |
| NFR-2 | Cache hit < 0.1ms | — | UT-43 | — | — | — |
| NFR-3 | Zero new dependencies | — | UT-70 | — | — | — |
| Story-3 | ccr_retrieve MCP tool works | — | UT-23 | IT-06 | E2E-API-07 | SIT-02 |

---

## 4. Test Execution Strategy

### 4.1 Execution Order

1. **PBT** → verify invariants (fast, catches unexpected edge cases)
2. **UT** → verify all business rules in isolation
3. **IT** → verify SQLite persistence + full pipeline wiring
4. **E2E-API** → verify HTTP integration works end-to-end
5. **SIT** → verify real LLM accepts compressed messages

### 4.2 Entry Criteria

| Level | Criteria |
|-------|----------|
| PBT | types.ts compiles, fast-check installed |
| UT | All compression module files compile |
| IT | better-sqlite3 available, module instantiable |
| E2E-API | Server starts, chat-routes.ts accessible |
| SIT | Valid Anthropic API key, server deployed |

### 4.3 Exit Criteria

| Level | Criteria |
|-------|----------|
| PBT | All properties hold for 1000+ runs |
| UT | ≥ 90% code coverage, all cases PASS |
| IT | All integration scenarios PASS |
| E2E-API | All HTTP scenarios PASS, performance budget met |
| SIT | LLM produces coherent responses with compressed input |

---

## 5. Performance Testing

### 5.1 Benchmarks

| Test | Input | Target | Measurement |
|------|-------|--------|-------------|
| PERF-01 | 100-item JSON array (50KB) | < 10ms (p99) | performance.now() delta |
| PERF-02 | 1000-item JSON array (500KB) | < 50ms (p99) | performance.now() delta |
| PERF-03 | Cache hit (repeated content) | < 0.1ms | performance.now() delta |
| PERF-04 | ContentRouter detection | < 0.5ms | performance.now() delta |
| PERF-05 | CCR Store write | < 2ms | performance.now() delta |

### 5.2 Performance Test Approach

- Run each benchmark 100 times
- Calculate p50, p95, p99
- Compare against budget
- Run in CI for regression detection

---

## 6. Risk-Based Testing

| Risk | Test Focus | Priority |
|------|-----------|----------|
| Compression loses semantic info | PBT properties on data preservation | High |
| Performance exceeds 10ms | Benchmarks in IT and E2E | High |
| CCR grows unbounded | IT tests for eviction and cleanup | Medium |
| Circuit breaker doesn't recover | UT + IT for state transitions | Medium |
| Cache hash collisions | PBT with diverse inputs | Low |

---

## 7. Test Data Strategy

- **PBT:** Generated by fast-check (arbitrary JSON arrays, strings)
- **UT:** Hardcoded fixtures per business rule
- **IT:** SQLite in-memory database, seeded test data
- **E2E-API:** HTTP request payloads with realistic chat messages
- **SIT:** Real conversation messages captured from production-like usage

Test data files at: `documents/KSA-244/testdata/`

---

## 8. Defect Management

| Severity | Response | SLA |
|----------|----------|-----|
| Critical | Block release, immediate fix | Same day |
| High | Must fix before deployment | 1-2 days |
| Medium | Fix in current sprint | Sprint end |
| Low | Backlog, fix when convenient | — |

---

## 9. Summary

| Metric | Value |
|--------|-------|
| Total test cases | 78 |
| PBT properties | 8 |
| Unit tests | 42 |
| Integration tests | 13 |
| E2E-API tests | 7 |
| SIT tests | 2 |
| Automation rate | 97% (SIT partially manual) |
| RTM coverage | 100% (all BRs mapped) |


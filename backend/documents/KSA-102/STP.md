# Software Test Plan (STP)

## KSA-102: Adaptive Token Cache + Model Manager for multilingual find_tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-102 |
| Title | Adaptive Token Cache + Model Manager — Test Plan |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-21 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-102.docx |
| Related FSD | FSD-v1-KSA-102.docx |
| Related TDD | TDD-v1-KSA-102.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-21 | QA Agent | Initial test plan |

---

## 1. Introduction

### 1.1 Purpose

This document defines the test strategy, scope, and approach for verifying the Adaptive Token Cache and Model Manager features of the MCP Code Intelligence platform (KSA-102).

### 1.2 Scope

Testing covers:
- Adaptive Token Cache (self-learning cache for find_tools)
- Model Manager MCP tool (list, download, status, switch)
- Integration of cache + embedding tiers into find_tools pipeline
- Cache persistence, invalidation, and LRU eviction
- Graceful degradation when ONNX/model unavailable

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-102/BRD.md |
| FSD | documents/KSA-102/FSD.md |
| TDD | documents/KSA-102/TDD.md |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| PBT | Token normalization, fuzzy matching correctness | Automated | pytest + hypothesis |
| UT | Unit logic: cache lookup, LRU eviction, invalidation | Automated | pytest |
| IT | Integration: find_tools pipeline with cache + embedding | Automated | pytest + mock ONNX |
| E2E-API | MCP tool calls (find_tools, mem_model_manager) via protocol | Automated | MCP client + pytest |
| SIT | Manual exploratory: model download, multilingual hint | Manual | MCP client (CLI) |

### 2.2 Test Approach

- **PBT**: Verify token normalization properties (idempotent, order-independent) and fuzzy match threshold correctness with random inputs.
- **UT**: Test each module in isolation — AdaptiveTokenCache, CachePersistence, ModelManager, EmbeddingSearcher.
- **IT**: Test find_tools end-to-end with mocked ONNX provider to verify tier fallthrough logic.
- **E2E-API**: Call MCP tools via protocol client, verify JSON responses match FSD contracts.
- **SIT**: Manual verification of model download from HuggingFace, multilingual hint display.

### 2.3 Entry/Exit Criteria

| Level | Entry Criteria | Exit Criteria |
|-------|---------------|---------------|
| UT | Code compiles, modules created | 100% UT pass, >90% branch coverage |
| IT | UT pass | All integration flows pass |
| E2E-API | IT pass, server starts | All API contracts verified |
| SIT | E2E-API pass | All manual scenarios executed |

---

## 3. Test Scope

### 3.1 In Scope

| # | Feature | Priority | Source |
|---|---------|----------|--------|
| 1 | Adaptive Token Cache — fuzzy lookup | High | UC-1, BR-1, BR-2 |
| 2 | Cache learning from embedding results | High | UC-1 AF-2 |
| 3 | Cache persistence (debounced JSON) | High | BR-6, Story 6 |
| 4 | Cache invalidation on registry change | High | BR-5, Story 7 |
| 5 | LRU eviction at 10K entries | Medium | BR-3, BR-4 |
| 6 | Model Manager — list/status | Medium | UC-2 |
| 7 | Model Manager — download | Medium | UC-3 |
| 8 | Model Manager — switch + cache clear | High | UC-4, BR-13 |
| 9 | Embedding search with timeout | High | BR-7, EF-2 |
| 10 | Graceful degradation (no model) | High | EF-1 |
| 11 | Auto-download on first use | Medium | Story 4, BR-10 |
| 12 | Multilingual model reminder | Low | Story 5, BR-12 |
| 13 | Corrupted cache recovery | High | FSD 9.1 |

### 3.2 Out of Scope

- Training custom models
- Cloud-hosted inference
- UI/frontend testing (no UI exists)
- Node.js and Kotlin module parity (separate tickets)
- Performance benchmarking under production load

---

## 4. Test Environment

### 4.1 Environment Requirements

| Component | Requirement |
|-----------|-------------|
| OS | Windows 10+, macOS 12+, Linux (Ubuntu 22.04) |
| Python | 3.11+ |
| ONNX Runtime | 1.16+ (optional dep) |
| Disk Space | 600MB (both models) |
| Network | Required for model download tests only |

### 4.2 Test Data

- Pre-built token cache files (valid, corrupted, empty, max-size)
- Mock ONNX model returning deterministic embeddings
- Mock tool registry with known tool names and descriptions

### 4.3 External Dependencies

| Dependency | Strategy |
|------------|----------|
| HuggingFace Hub | Mock for UT/IT; real for SIT download test |
| ONNX Runtime | Mock for UT; real for IT/E2E |
| Filesystem | tmpdir fixtures for cache/registry files |

---

## 5. Test Schedule

| Phase | Duration | Activities |
|-------|----------|------------|
| UT + PBT | 1 day | Unit tests + property tests |
| IT | 1 day | Integration tests with mock ONNX |
| E2E-API | 0.5 day | MCP protocol-level tests |
| SIT | 0.5 day | Manual model download + multilingual |

---

## 6. Resources & Responsibilities

| Role | Responsibility |
|------|---------------|
| QA Agent | Test plan, test cases, execution |
| Dev Team | Bug fixes, test environment setup |
| SA Agent | Review test coverage vs architecture |

---

## 7. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| ONNX Runtime not available in CI | High | Mock ONNX for UT/IT; separate E2E job with ONNX |
| Model download flaky in CI | Medium | Mock HuggingFace for automated tests |
| Cache file race conditions | Low | Use atomic writes (tmp + rename) |
| Embedding timeout hard to reproduce | Medium | Use mock with configurable delay |

---

## 8. Defect Management

| Severity | Description | SLA |
|----------|-------------|-----|
| Critical | find_tools crashes, data loss | Fix within 4h |
| Major | Cache not learning, wrong tool returned | Fix within 1 day |
| Minor | Hint not shown, log message wrong | Fix within 3 days |
| Trivial | Typo in error message | Next sprint |

---

## 9. Test Metrics

| Metric | Target |
|--------|--------|
| Test case pass rate | ≥ 95% |
| Code coverage (cache module) | ≥ 90% |
| Code coverage (model manager) | ≥ 85% |
| Defect density | < 2 major per 1K LOC |
| Requirements coverage (RTM) | 100% |

---

## 10. Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 4 | 4 | 0 |
| UT | 14 | 14 | 0 |
| IT | 8 | 8 | 0 |
| E2E-API | 6 | 6 | 0 |
| SIT | 4 | 0 | 4 |
| **Total** | **36** | **32 (89%)** | **4 (11%)** |

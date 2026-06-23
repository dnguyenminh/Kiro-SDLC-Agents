# Software Test Plan (STP)

## mcp-code-intelligence-nodejs — KSA-191: Salesforce Language Support (v2 — Extend Existing Tools)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-191 |
| Title | Salesforce Language Support — Extend Existing Tools |
| Author | QA Agent |
| Version | 2.0 |
| Date | 2026-06-02 |
| Status | Draft |
| Related BRD | BRD-v2-KSA-191.docx |
| Related FSD | FSD-v2-KSA-191.docx |
| Related TDD | TDD-v2-KSA-191.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document |
| Peer Reviewer | SM Agent – Scrum Master | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-27 | QA Agent | Initial (v1 approach — 3 MCP servers) — SUPERSEDED |
| 2.0 | 2026-06-02 | QA Agent | Complete rewrite for v2 approach — extend existing tools |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the testing strategy for verifying the Salesforce code intelligence integration into the **existing** `mcp-code-intelligence-nodejs` server. The v2 approach extends 7 existing tools with SF results, adds a shared library (`mcp-salesforce-intelligence/`), and adds an extension command.

### 1.2 Test Objectives

- Verify 7 enhanced existing tools include SF results correctly (UC-01 through UC-09)
- Validate all 39 business rules (BR-01 through BR-39) are enforced
- Ensure backward compatibility — non-SF projects have ZERO behavior change
- Verify SFDX project auto-detection and incremental indexing
- Validate SF relationship types stored and traversed correctly
- Verify Extension command "Index Salesforce Project" works
- Verify shared library `mcp-salesforce-intelligence/` functions independently
- Ensure performance NFRs: indexing < 30s, parse < 500ms, query < 200ms

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v2-KSA-191.docx |
| FSD | FSD-v2-KSA-191.docx |
| TDD | TDD-v2-KSA-191.docx |
| salesforce-ast | https://github.com/dnguyenminh/apex-ast |
| Existing Server | mcp-code-intelligence-nodejs/ |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| PBT | Property-based tests for parsers (grammar correctness, relationship invariants) | Automated | Vitest + fast-check |
| UT | Unit tests for parsers, shared library utilities, detector logic | Automated | Vitest |
| IT | Integration tests — parser → indexer → SQLite → graph services | Automated | Vitest + better-sqlite3 |
| E2E-API | End-to-end MCP tool calls via JSON-RPC over stdio (real server) | Automated | Node.js child_process + MCP client |
| E2E-UI | Extension command registration, progress notification, error handling | Automated | VS Code Extension Test Framework |
| SIT | Manual exploratory testing — visual verification, UX edge cases | Manual | Kiro IDE |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify 7 enhanced tools return SF results | Yes |
| Regression Testing | Ensure non-SF projects unaffected (backward compat) | Yes |
| Performance Testing | Indexing < 30s, parse < 500ms, query < 200ms | Yes |
| Security Testing | No network exposure, input validation, XXE prevention | Yes |
| Compatibility Testing | Cross-platform (Windows, macOS, Linux), Node.js 20+ | Yes |
| Usability Testing | Extension command UX | Yes |

### 2.3 Test Approach

- **Risk-based prioritization**: Backward compatibility + enhanced tools tested first
- **Automated-first**: All levels automated except SIT (manual visual verification only)
- **Fixture-based**: Sample SFDX project in `tests/fixtures/sfdx-sample/` for reproducible testing
- **Contract testing**: Ensure existing tool response schemas are additive-only (no breaking changes)
- **Error-path emphasis**: Graceful degradation for malformed Apex/XML — partial results, never crash

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| PBT | Parser implementations compilable, fast-check installed |
| UT | Code compiles, salesforce-ast installed, test fixtures available |
| IT | SQLite database accessible, indexing engine operational |
| E2E-API | MCP server starts, stdio communication works, SFDX fixture ready |
| E2E-UI | Kiro extension builds, command registered in package.json |
| SIT | All E2E tests pass, extension installable in Kiro IDE |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| PBT | All properties hold for 1000+ random inputs, 0 shrunk failures |
| UT | 100% test cases pass, code coverage ≥ 80% for new code |
| IT | Parser → DB → Graph pipeline verified, incremental indexing works |
| E2E-API | All 7 enhanced tools return correct SF results + backward compat verified |
| E2E-UI | Extension command works in Kiro IDE |
| SIT | All manual scenarios executed, 0 Critical/Major defects open |

### 2.6 E2E Classification

| Scenario Type | Classify As | Rationale |
|--------------|-------------|-----------|
| Enhanced tool calls (7 tools) | E2E-API | MCP JSON-RPC over stdio |
| Backward compat (non-SF project) | E2E-API | Same protocol, verify no regression |
| SF relationship traversal | E2E-API | Graph queries via tool interface |
| SFDX auto-detection | IT | Internal engine behavior |
| Incremental indexing (hash) | IT | File-system + DB behavior |
| Extension command registration | E2E-UI | VS Code extension framework |
| Progress notification display | SIT (manual) | Visual timing verification |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | SFDX Project Auto-Detection | High | UC-01, BR-01–BR-04, Story 1 | IT, E2E-API |
| 2 | Apex Symbols in `code_symbols` | High | UC-02, BR-05–BR-08, Story 2 | UT, IT, E2E-API |
| 3 | SF Symbols in `code_search` | High | UC-03, BR-09–BR-12, Story 3 | IT, E2E-API |
| 4 | SF Dependencies in `code_dependencies` | High | UC-04, BR-13–BR-19, Story 4 | IT, E2E-API |
| 5 | SF Impact Analysis in `code_impact` | High | UC-05, BR-20–BR-23, Story 5 | IT, E2E-API |
| 6 | SF Call Graph in `code_callers`/`code_callees` | High | UC-06, BR-24–BR-27, Story 6 | IT, E2E-API |
| 7 | SF File Support in `mem_ingest_file` | Medium | UC-07, BR-28–BR-31, Story 7 | UT, E2E-API |
| 8 | Extension Command "Index Salesforce Project" | High | UC-08, BR-32–BR-35, Story 8 | E2E-UI, SIT |
| 9 | SFDX Stats in `code_index_status` | Medium | UC-09, BR-36–BR-39, Story 9 | E2E-API |
| 10 | Shared Library (mcp-salesforce-intelligence/) | High | TDD §5 | PBT, UT |
| 11 | Backward Compatibility (non-SF projects) | Critical | BRD NFR | E2E-API |
| 12 | Performance NFRs | Medium | BRD §6 | Performance |
| 13 | Graceful Error Handling | High | TDD §5.6 | UT, IT, E2E-API |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | salesforce-ast internal parsing logic | External dependency, tested independently |
| 2 | Salesforce org authentication | BRD Out of Scope |
| 3 | Real-time file watching | Future enhancement |
| 4 | Existing mcp-code-intelligence-nodejs core logic | Tested separately (regression only) |
| 5 | kotlin/python server extensions | Future |
| 6 | Salesforce deployment/CI/CD | Not in scope |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | Configuration | Purpose |
|-------------|--------------|---------|
| Dev/UT | Local machine, Node.js 20+, Vitest, fast-check | Unit + PBT testing |
| IT | Local machine, SQLite in-memory, test fixtures | Integration testing |
| E2E-API | Local machine, full MCP server process via stdio | End-to-end API testing |
| E2E-UI | Kiro IDE with extension loaded | Extension command testing |
| SIT | Kiro IDE with real SFDX project | Manual exploratory testing |

### 4.2 Platform Requirements

| Platform | Version | Required |
|----------|---------|----------|
| Node.js | 20+ | Yes |
| Windows | 10/11 | Yes |
| macOS | 13+ | Yes |
| Linux | Ubuntu 22.04+ | Yes |
| Kiro IDE | Latest | Yes (E2E-UI/SIT) |

### 4.3 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Sample SFDX project | Valid project with Apex, Flow, Object, LWC | tests/fixtures/sfdx-sample/ | Pre-created fixture |
| Non-SFDX project | Standard TypeScript project (no sfdx-project.json) | tests/fixtures/non-sfdx/ | Pre-created fixture |
| Malformed Apex files | Files with syntax errors | tests/fixtures/malformed/ | Pre-created fixture |
| Large SFDX project | 500+ Apex files for performance | Generated | Script to generate |
| Apex class fixtures | AccountService.cls, AccountTrigger.trigger, etc. | tests/fixtures/apex/ | Pre-created |
| Flow fixtures | Account_Update.flow-meta.xml, Screen flows | tests/fixtures/flows/ | Pre-created |
| Object fixtures | Account.object-meta.xml with fields | tests/fixtures/objects/ | Pre-created |
| LWC fixtures | accountList/ with @wire, @api | tests/fixtures/lwc/ | Pre-created |

### 4.4 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| salesforce-ast npm | Tree-sitter Apex grammar (.wasm) | No — use real library |
| better-sqlite3 | SQLite database | In-memory DB for tests |
| Filesystem | SFDX project files | Fixture files in tests/ |
| web-tree-sitter | Parser runtime | Real (no mock) |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | Day 1 | Day 1 | 1 day | STP + STC approved |
| Test Data Preparation | Day 1 | Day 2 | 1 day | Fixtures ready |
| PBT + UT Execution | Day 2 | Day 4 | 2 days | Unit tests pass |
| IT Execution | Day 4 | Day 6 | 2 days | Integration pass |
| E2E-API Execution | Day 6 | Day 8 | 2 days | All 7 tools verified |
| E2E-UI Execution | Day 8 | Day 9 | 1 day | Extension verified |
| SIT Execution | Day 9 | Day 10 | 1 day | Manual scenarios done |
| Defect Fix & Retest | Day 10 | Day 12 | 2 days | All Critical/Major fixed |
| Sign-off | Day 12 | Day 12 | 0.5 day | Test completion report |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, defect reporting |
| BA | BA Agent | Acceptance criteria clarification |
| Developer | Dev Agent | Bug fixing, unit test implementation |
| Architect | SA Agent | Technical design review |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Apex .wasm grammar incompatible with web-tree-sitter version | High | Low | Pin compatible versions, test grammar loading first |
| 2 | Large SFDX projects slowing non-SF indexing | Medium | Medium | Verify non-SF performance unchanged in regression tests |
| 3 | New relationship types breaking existing graph queries | High | Low | Additive-only changes, backward compat tests |
| 4 | salesforce-meta-parser regex fragile for XML edge cases | Medium | Medium | PBT with random XML inputs, graceful degradation |
| 5 | Cross-platform path handling (Windows backslash) | Medium | Medium | Test on all 3 platforms, normalize paths |
| 6 | Extension command conflicts with existing "Index Workspace" | Low | Low | Separate command IDs, coexistence test |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Server crash, data corruption, infinite loop | Server hangs parsing circular Apex |
| Major | Tool returns wrong result, feature broken | code_symbols misses Apex methods |
| Minor | Incorrect output format, minor issue | Wrong annotation name in symbol |
| Trivial | Typo, minor formatting | Log message typo |

### 8.2 Priority Levels

| Priority | Definition | SLA (Fix Time) |
|----------|-----------|----------------|
| P1 | Blocks testing | 4 hours |
| P2 | Must fix before release | 1 business day |
| P3 | Should fix if time permits | 3 business days |
| P4 | Nice to fix, can defer | Next release |

---

## 9. Test Metrics & Reporting

### 9.1 Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Test Execution Rate | Executed / Total × 100% | 100% |
| Pass Rate | Passed / Executed × 100% | ≥ 95% |
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical Defect Count | Count of Critical severity | 0 |
| Code Coverage (UT) | Lines covered / Total lines | ≥ 80% |
| Automation Rate | Automated / Total × 100% | ≥ 90% |
| Backward Compat Pass | Non-SF tests pass / Non-SF tests total | 100% |

---

## 10. Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 8 | 8 | 0 |
| UT | 24 | 24 | 0 |
| IT | 18 | 18 | 0 |
| E2E-API | 28 | 28 | 0 |
| E2E-UI | 4 | 4 | 0 |
| SIT | 5 | 0 | 5 |
| **Total** | **87** | **82 (94%)** | **5 (6%)** |

---

## 11. Appendix

### 11.1 Glossary

| Term | Definition |
|------|------------|
| SFDX | Salesforce DX — developer experience platform |
| Apex | Salesforce proprietary programming language |
| LWC | Lightning Web Components |
| MCP | Model Context Protocol |
| PBT | Property-Based Testing |
| SIT | System Integration Testing |
| E2E | End-to-End |
| NFR | Non-Functional Requirement |

### 11.2 Assumptions

- salesforce-ast npm package provides compatible Tree-Sitter Apex .wasm grammar
- Node.js 20+ available on all test environments
- Test fixtures represent realistic SFDX project structures
- Existing SQLite schema handles new relationship kinds without migration
- Extension can be tested in Kiro IDE test framework

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |

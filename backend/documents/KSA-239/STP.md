# Software Test Plan (STP)

## Kiro SDLC Agents — KSA-239: Multi-format Document Indexing

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-239 |
| Title | Multi-format document indexing — support docx/xlsx/pdf/image in Index Documents |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-239.docx |
| Related FSD | FSD-v1-KSA-239.docx |
| Related TDD | TDD-v1-KSA-239.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | QA Agent | Initial test plan |

---

## 1. Introduction

### 1.1 Purpose

This document defines the test strategy, scope, and approach for verifying the multi-format document indexing feature of the Kiro SDLC Agents VS Code extension (KSA-239). The feature expands the "Index Documents" command to support Office documents, PDFs, images, and text-based formats beyond Markdown.

### 1.2 Test Objectives

- Verify all supported file formats are discovered and converted correctly
- Validate error isolation (single file failure does not abort batch)
- Ensure size limits, timeout, and exclusion rules are enforced
- Verify KB ingestion pipeline works with converted content
- Confirm progress notification accuracy and UX correctness
- Validate idempotency (re-indexing unchanged files produces no duplicates)

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-239.docx |
| FSD | FSD-v1-KSA-239.docx |
| TDD | TDD-v1-KSA-239.docx |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| PBT | File extension classification, type mapping, idempotency properties | Automated | Jest + fast-check |
| UT | converter.ts functions, size checks, text wrapping, timeout logic | Automated | Jest + ts-jest |
| IT | Conversion pipeline with real filetomarkdown, file I/O | Automated | Jest + real sample files |
| E2E-API | Full indexing flow: discover to convert to ingest via HTTP | Automated | Jest + nock (HTTP mock) |
| E2E-UI | VS Code extension command execution with progress | Automated | @vscode/test-electron |
| SIT | Manual exploratory: real documents, visual progress verification | Manual | VS Code dev instance |

### 2.2 Test Approach

- **PBT**: Property-based testing for file classification logic. Random extensions always map to correct format/type. Idempotency properties verified (same input yields same output).
- **UT**: Unit test each function in converter.ts and modified indexer.ts logic in isolation. Mock filetomarkdown and fs modules.
- **IT**: Integration tests using real sample files (.docx, .pdf, .xlsx, .png, .txt) with actual filetomarkdown conversion. Verify output markdown quality.
- **E2E-API**: Full pipeline test from discoverDocuments() through ingestDocumentsViaHttp(). Mock MCP server HTTP endpoint with nock.
- **E2E-UI**: VS Code extension integration test. Trigger command, verify progress notification and output channel messages.
- **SIT**: Manual verification of edge cases (corrupt files, large files, password-protected), visual inspection of progress UX.

### 2.3 Entry/Exit Criteria

| Level | Entry Criteria | Exit Criteria |
|-------|---------------|---------------|
| PBT | Type definitions exist | All properties hold for 1000+ random inputs |
| UT | converter.ts and indexer.ts implemented | 100% UT pass, 90%+ branch coverage |
| IT | filetomarkdown installed, sample files ready | All format conversions produce non-empty markdown |
| E2E-API | HTTP endpoint mockable | Full pipeline returns correct IndexStats |
| E2E-UI | Extension builds and loads in test host | Command executes, progress shows, completion toast appears |
| SIT | Extension packaged, dev environment ready | All manual scenarios pass, no Critical defects |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Multi-format file discovery | High | UC-01, BR-01 to BR-06 | UT, PBT, IT |
| 2 | Office document conversion (.docx, .xlsx, .pptx) | High | UC-02, BR-07 | IT, E2E-API |
| 3 | PDF conversion | High | UC-02, BR-08 | IT, E2E-API |
| 4 | Image conversion (.png, .jpg) | Medium | UC-02, BR-09 | IT, E2E-API |
| 5 | Text-based format direct read | High | UC-02, AF-02b, BR-10 | UT, IT |
| 6 | Size limit enforcement | High | BR-08, BR-09 | UT, IT |
| 7 | Conversion timeout (30s) | High | BR-11 | UT, IT |
| 8 | Error isolation (batch continues) | High | BR-07 | IT, E2E-API |
| 9 | KB ingestion via HTTP | High | UC-03, BR-12 to BR-14 | E2E-API |
| 10 | Progress notification | Medium | UC-04, BR-15 to BR-17 | E2E-UI, SIT |
| 11 | Directory exclusions (diagrams/, testdata/) | High | BR-01, BR-02 | UT, IT |
| 12 | Unknown type to CONTEXT classification | Medium | BR-04, BR-05 | UT, PBT |
| 13 | Updated UI label | Medium | BR-17 | E2E-UI, SIT |
| 14 | Idempotency (re-index no duplicates) | High | BR-12 | E2E-API |
| 15 | Lazy loading of filetomarkdown | Medium | TDD 3.2 | UT |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | KB search/retrieval quality | KB backend not modified |
| 2 | MCP server API changes | API unchanged |
| 3 | Code indexing feature | Separate feature, not affected |
| 4 | OCR quality tuning | Depends on filetomarkdown internals |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | Setup | Purpose |
|-------------|-------|---------|
| Dev | VS Code with extension loaded from source | Unit + Integration testing |
| CI | GitHub Actions with Node.js 18+ | Automated test execution |
| Extension Test | @vscode/test-electron headless | E2E-UI testing |
| Manual | VS Code dev instance with sample docs | SIT + exploratory |

### 4.2 System Requirements

| Requirement | Value |
|-------------|-------|
| Node.js | 18+ (VS Code bundled) |
| VS Code | 1.85+ |
| OS | Windows 10+, macOS 12+, Ubuntu 22+ |
| RAM | 8GB minimum |
| Disk | 500MB for sample test files |

### 4.3 Test Data Requirements

| Data Type | Description | Files | Preparation |
|-----------|-------------|-------|-------------|
| Sample .docx | Word document with headings, tables, lists | 3 files (small/medium/large) | Create manually |
| Sample .xlsx | Excel with data tables | 2 files | Create manually |
| Sample .pdf | Text-based + scanned PDF | 3 files | Source from real docs |
| Sample images | PNG/JPG with text content | 3 files | Screenshots/diagrams |
| Text files | .txt, .csv, .json, .xml, .yaml | 5 files | Create with varied content |
| Edge cases | Corrupt .docx, password-protected .pdf, 60MB PDF, 25MB image | 4 files | Create specifically |
| Nested structure | Ticket folders with subdirectories | 1 folder tree | Create with mixed formats |

### 4.4 External Dependencies

| System | Dependency | Mock Available |
|--------|-----------|----------------|
| filetomarkdown npm | Conversion library | Yes (Jest mock for UT; real for IT) |
| MCP Server HTTP | KB ingestion endpoint | Yes (nock HTTP mock) |
| VS Code API | Extension host APIs | Yes (@vscode/test-electron) |
| File System | Read access to documents/ | Yes (tmp directories for tests) |

---

## 5. Test Schedule

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Test Planning (STP + STC) | 1 day | STP + STC approved |
| Test Data Preparation | 0.5 day | Sample files created |
| UT + PBT Development | 1 day | All unit tests green |
| IT Development | 1 day | Integration tests with real files |
| E2E-API Development | 0.5 day | Pipeline tests green |
| E2E-UI Development | 0.5 day | VS Code command tests |
| SIT Execution | 0.5 day | Manual scenarios verified |
| Defect Fix and Retest | 1 day | All Critical/Major fixed |

---

## 6. Resources and Responsibilities

| Role | Responsibility |
|------|---------------|
| QA Engineer | Test case design, automation, execution, reporting |
| Developer | Bug fixing, unit test coverage, IT support |
| BA | Acceptance criteria clarification |
| SM | Test plan review, coordination |

---

## 7. Risk and Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | filetomarkdown produces different output across OS | Medium | Medium | Run IT on all 3 OS in CI |
| 2 | Large file tests slow down CI | Low | High | Separate slow tests, skip in PR builds |
| 3 | VS Code test-electron flaky | Medium | Medium | Retry mechanism, headless mode |
| 4 | filetomarkdown native deps break in CI | High | Medium | Docker-based CI, pre-built binaries |
| 5 | Sample test files not representative | Medium | Low | Use real project documents as samples |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Indexing crashes extension, data loss | Batch abort on single file failure |
| Major | Format not converted, content lost | .docx conversion returns empty silently |
| Minor | Progress notification inaccurate | Wrong count displayed |
| Trivial | Typo in output channel message | Minor text issue |

### 8.2 Priority Levels

| Priority | Definition | SLA |
|----------|-----------|-----|
| P1 | Blocks all indexing | Fix same day |
| P2 | Single format broken | Fix before release |
| P3 | Minor UX issue | Fix if time permits |
| P4 | Cosmetic | Next release |

---

## 9. Test Metrics and Reporting

### 9.1 Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Test Execution Rate | Executed / Total x 100% | 100% |
| Pass Rate | Passed / Executed x 100% | >= 95% |
| Code Coverage (UT) | Lines covered / Total x 100% | >= 90% |
| Defect Density | Defects / Test Cases | <= 0.05 |
| Critical Defect Count | Count of Critical | 0 |
| Format Coverage | Formats tested / Total formats | 100% |

### 9.2 Reporting

| Report | Frequency | Audience |
|--------|-----------|----------|
| Test Run Results | Per CI build | Dev team |
| Coverage Report | Per PR | Dev + QA |
| Final Test Report | End of SIT | All stakeholders |

---

## 10. Test Case Distribution

### 10.1 By Level

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 4 | 4 | 0 |
| UT | 18 | 18 | 0 |
| IT | 12 | 12 | 0 |
| E2E-API | 8 | 8 | 0 |
| E2E-UI | 4 | 4 | 0 |
| SIT | 5 | 0 | 5 |
| **Total** | **51** | **46** | **5** |

### 10.2 By Feature

| Feature | PBT | UT | IT | E2E-API | E2E-UI | SIT | Total |
|---------|-----|----|----|---------|--------|-----|-------|
| File Discovery | 2 | 4 | 2 | 1 | 0 | 1 | 10 |
| Office Conversion | 0 | 3 | 3 | 2 | 0 | 1 | 9 |
| PDF Conversion | 0 | 2 | 2 | 1 | 0 | 1 | 6 |
| Image Conversion | 0 | 2 | 2 | 1 | 0 | 0 | 5 |
| Text Direct Read | 0 | 3 | 1 | 1 | 0 | 0 | 5 |
| Error Handling | 0 | 2 | 2 | 1 | 0 | 1 | 6 |
| Progress/UX | 0 | 0 | 0 | 0 | 4 | 1 | 5 |
| Idempotency | 2 | 2 | 0 | 1 | 0 | 0 | 5 |
| **Total** | **4** | **18** | **12** | **8** | **4** | **5** | **51** |

---

## 11. Appendix

### Glossary

| Term | Definition |
|------|------------|
| KB | Knowledge Base (semantic search database) |
| MCP | Model Context Protocol |
| PBT | Property-Based Testing |
| UT | Unit Testing |
| IT | Integration Testing |
| SIT | System Integration Testing |
| E2E | End-to-End |
| filetomarkdown | npm package for file-to-markdown conversion |

### Assumptions

- filetomarkdown npm package is functional and supports all claimed formats
- MCP server HTTP API /api/memory/ingest-file is stable and unchanged
- VS Code extension host provides Node.js 18+ runtime
- CI environment has sufficient resources for running extension tests
- Sample test files adequately represent real-world documents

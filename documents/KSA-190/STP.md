# Software Test Plan (STP)

## KSA-190: Auto-Linking Logic on KB Ingest

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-190 |
| Title | Auto-Linking Logic on KB Ingest |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-31 |
| Related BRD | BRD-v1-KSA-190.docx |
| Related FSD | FSD-v1-KSA-190.docx |
| Related TDD | TDD-v1-KSA-190.docx |

---

## 1. Test Strategy

### 1.1 Test Levels

| Level | Scope | Automation | Tool |
|-------|-------|-----------|------|
| PBT (Property-Based) | Mathematical properties of cosine similarity, Jaccard | 100% automated | fast-check |
| UT (Unit Test) | Individual strategies, config validation, dedup logic | 100% automated | vitest |
| IT (Integration Test) | AutoLinker with real SQLite DB, full pipeline | 100% automated | vitest + better-sqlite3 |
| E2E-API | MCP tool calls (mem_ingest, mem_graph auto_link) | 100% automated | vitest + MCP client |
| E2E-UI | N/A (no UI) | N/A | N/A |
| SIT (System Integration) | Full server with real embedding model | Manual verification | Manual |

### 1.2 Test Coverage Targets

| Level | Target Coverage | Rationale |
|-------|----------------|-----------|
| PBT | Mathematical correctness | Cosine similarity, Jaccard must be mathematically correct |
| UT | 90% line coverage | All strategy logic, config, dedup |
| IT | 80% branch coverage | Real DB interactions, edge cases |
| E2E-API | All 4 use cases | Verify MCP tool interface |

### 1.3 Requirements Traceability Matrix (RTM)

| BRD Story | FSD Use Case | Test Cases |
|-----------|-------------|------------|
| STORY-1 (Semantic) | UC-01 | PBT-01, UT-01..03, IT-01..02, E2E-01 |
| STORY-2 (Entity) | UC-01 | UT-04..06, IT-03, E2E-01 |
| STORY-3 (Tag) | UC-01 | UT-07..09, IT-04, E2E-01 |
| STORY-4 (FTS) | UC-01 | UT-10..11, IT-05, E2E-01 |
| STORY-5 (Config) | UC-04 | UT-12..14, IT-06 |
| STORY-6 (Dedup) | UC-01 | UT-15..17, IT-07 |
| STORY-7 (Response) | UC-01 | E2E-02 |
| STORY-8 (Backfill) | UC-03 | UT-18, IT-08, E2E-03 |

---

## 2. Test Environment

### 2.1 Dependencies

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | >= 18 | Runtime |
| vitest | latest | Test framework |
| better-sqlite3 | latest | In-memory SQLite for tests |
| fast-check | latest | Property-based testing |

### 2.2 Test Database Setup

Each test suite creates an in-memory SQLite database with the full schema (knowledge_entries, knowledge_vectors, knowledge_graph_edges, entity_index, knowledge_fts).

---

## 3. Test Schedule

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| PBT + UT implementation | 3h | tests/memory/linking-strategies/*.test.ts |
| IT implementation | 2h | tests/memory/auto-linker.integration.test.ts |
| E2E-API implementation | 2h | tests/e2e/auto-link-e2e.test.ts |
| Execution + bug fixes | 2h | Test report |

---

## 4. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Flaky tests due to floating-point precision | Medium | Use tolerance (epsilon) in assertions |
| Slow tests due to vector computation | Low | Use small vectors (dim=4) in tests |
| FTS5 not available in test SQLite | Medium | Ensure test DB has FTS5 extension |

---

## 5. Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |

# Software Test Plan (STP)

## KSA-143: KB Graph — Level of Detail (LOD) / Semantic Zoom

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-143 |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Related BRD | BRD-v1-KSA-143.docx |
| Related FSD | FSD-v1-KSA-143.docx |
| Related TDD | TDD-v1-KSA-143.docx |

---

## 1. Test Strategy

### 1.1 Test Levels

| Level | Scope | Automation | Tool |
|-------|-------|-----------|------|
| PBT (Property-Based) | ClusteringAlgorithm invariants | 100% | fast-check |
| UT (Unit Test) | Individual components | 100% | Jest/Vitest |
| IT (Integration Test) | Component interactions | 100% | Jest + Three.js mocks |
| E2E-API | LODManager public API | 100% | Jest + jsdom |
| E2E-UI | Visual behavior in webview | 80% auto / 20% manual | Playwright |
| SIT (System Integration) | Full extension with real graph | Manual | VS Code + real data |

### 1.2 Test Coverage Targets

| Level | Target Coverage | Rationale |
|-------|----------------|-----------|
| PBT | Key invariants | Clustering determinism, budget never exceeded |
| UT | 90% line coverage | All components individually |
| IT | 80% branch coverage | Component interaction paths |
| E2E-API | All public methods | LODManager contract |
| E2E-UI | All user stories | BRD acceptance criteria |
| SIT | Critical paths | Performance + visual correctness |

### 1.3 Entry/Exit Criteria

**Entry:**
- Code compiles without errors
- All unit tests pass
- TDD implementation checklist complete

**Exit:**
- All Critical/High test cases pass
- No Critical bugs open
- Performance benchmarks met (30fps, clustering < 2s)
- Code coverage meets targets

---

## 2. Test Scope

### 2.1 In Scope

| Feature | Test Focus |
|---------|-----------|
| Clustering Algorithm | Correctness, determinism, size constraints, performance |
| Distance Checker | Threshold logic, hysteresis, boundary conditions |
| Budget Manager | Count tracking, auto-collapse, priority |
| Animation Controller | Timing, cancellation, state transitions |
| Orbital Layout | Position calculation, ring distribution |
| Super Node Factory | Mesh creation, badge, label |
| LODManager | Full pipeline, event emission, configuration |

### 2.2 Out of Scope

- Three.js internal rendering (tested by Three.js team)
- VS Code extension host APIs (mocked)
- WebGL driver behavior (hardware-dependent)

---

## 3. Requirements Traceability Matrix (RTM)

| BRD Req | FSD UC | Test Cases | Level |
|---------|--------|-----------|-------|
| Story 1: Cluster nodes | UC-01 | TC-UT-01 to TC-UT-06, TC-PBT-01 | UT, PBT |
| Story 2: Zoom expand | UC-02 | TC-UT-07 to TC-UT-10, TC-IT-01 to TC-IT-03 | UT, IT |
| Story 3: Child count | UC-05 | TC-UT-11, TC-E2E-UI-03 | UT, E2E-UI |
| Story 4: Budget < 100 | UC-04 | TC-UT-12 to TC-UT-14, TC-PBT-02 | UT, PBT |
| Story 5: Collapse | UC-03 | TC-UT-15 to TC-UT-17, TC-IT-04 | UT, IT |
| Story 6: Connectivity | UC-01 | TC-UT-01, TC-PBT-01 | UT, PBT |
| NFR-01: Clustering < 2s | — | TC-PERF-01 | Performance |
| NFR-02: 30+ FPS | — | TC-PERF-02 | Performance |
| NFR-03: Distance < 2ms | — | TC-PERF-03 | Performance |

---

## 4. Test Environment

### 4.1 Hardware

| Component | Specification |
|-----------|--------------|
| CPU | Intel i5 or equivalent |
| RAM | 16GB |
| GPU | Intel Iris or NVIDIA MX series |
| Display | 1920x1080 |

### 4.2 Software

| Component | Version |
|-----------|---------|
| Node.js | 18+ |
| VS Code | Latest stable |
| OS | Windows 10/11, macOS 12+ |
| Browser (webview) | Chromium (VS Code embedded) |

### 4.3 Test Data

| Dataset | Nodes | Edges | Purpose |
|---------|-------|-------|---------|
| Small | 50 | 100 | Below LOD threshold (no clustering) |
| Medium | 500 | 2000 | Normal operation |
| Large | 5000 | 20000 | Performance testing |
| Max | 10000 | 50000 | Stress testing |
| Edge cases | Various | Various | Empty, single node, fully connected |

---

## 5. Test Schedule

| Phase | Duration | Activities |
|-------|----------|-----------|
| Phase 1 | 2 days | UT + PBT for core algorithms |
| Phase 2 | 2 days | IT for component interactions |
| Phase 3 | 1 day | E2E-API for LODManager |
| Phase 4 | 2 days | E2E-UI for visual behavior |
| Phase 5 | 1 day | Performance benchmarks |
| Phase 6 | 1 day | SIT with real data |

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Three.js mocking complexity | Test reliability | Use minimal mocks, test real behavior where possible |
| Performance varies by hardware | False failures | Set generous thresholds, test on reference hardware |
| Animation timing non-deterministic | Flaky tests | Use fake timers in unit tests |
| WebGL not available in CI | Cannot run visual tests | Use headless GL or skip visual in CI |

---

## 7. Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |

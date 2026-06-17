# Improvement Plan — Q1 2025

**Generated**: 2025-01-08  
**Project**: KSA (Kiro SDLC Agents)  
**Scope**: Code quality, architecture, documentation improvements post v1.17.0 review

---

## 📊 Executive Summary

Based on comprehensive project review, identified **4 Epic areas** với **16 improvement stories** để nâng cấp chất lượng code, documentation, và security trước khi scale production.

**Timeline**: 6 weeks (3 sprints × 2 weeks)  
**Team allocation**: 
- Sprint 1: Cleanup & Organization (5 stories)
- Sprint 2: Quality Gates & Testing (5 stories)
- Sprint 3: Documentation & Security (6 stories)

**Success Metrics**:
- Code indexing time giảm 30% (từ cleanup)
- Test coverage ≥80% (với badges trong README)
- Zero critical security gaps
- ADR coverage cho top 10 architecture decisions

---

## 🎯 Epic 1: Code Organization & Cleanup

**Priority**: P0 (Critical)  
**Impact**: Developer productivity, code indexing performance  
**Timeline**: Sprint 1 (Week 1-2)

### Stories

#### KSA-250: Reorganize Root-Level Scripts
**Description**: Consolidate 20+ root-level scripts vào `scripts/` với clear structure.

**Acceptance Criteria**:
- [ ] Create `scripts/fsd/`, `scripts/temp/`, `scripts/archive/`
- [ ] Move `gen_fsd{2-5}.py` → `scripts/archive/`
- [ ] Consolidate `gen_fsd.py`, `check_fsd.py`, `verify_fsd.py`, `write_fsd.py` → `scripts/fsd/generator.py`
- [ ] Move all `tmp-*.ps1`, `tmp-*.json`, `tmp-*.js` → `scripts/temp/`
- [ ] Move `_fix_*.ps1` → `scripts/archive/`
- [ ] Move `test_api.py` → `scripts/tests/`
- [ ] Update README.md references

**Estimate**: 3 story points  
**Assignee**: DEV  

---

#### KSA-251: Add Code Intelligence Ignore Rules
**Description**: Giảm noise trong code indexing bằng `.code-intel/ignore` file.

**Acceptance Criteria**:
- [ ] Create `.code-intel/ignore` với patterns:
  ```
  tmp-*
  _fix_*
  *.lock
  package-lock.json
  node_modules/
  dist/
  out/
  build/
  .gradle/
  .vscode/
  ```
- [ ] Re-index workspace, verify module count giảm từ 50 → ~30
- [ ] Measure indexing time improvement (target: -30%)
- [ ] Document ignore syntax trong `mcp-code-intelligence-nodejs/README.md`

**Estimate**: 2 story points  
**Assignee**: DEV  

---

#### KSA-252: Cleanup Duplicate Modules
**Description**: Remove/archive duplicate và orphan modules.

**Acceptance Criteria**:
- [ ] Delete `tmp-grammars/`, `tmp-grammars2/`, `tmp-ort-package/` (nếu không còn dùng)
- [ ] Move `kiro-gateway/` ra ngoài workspace nếu không relate (hoặc add to ignore)
- [ ] Verify `history/` module — delete nếu orphan
- [ ] Verify `dist/` và `anthropic/` — nếu build artifacts → add to ignore
- [ ] Document active modules trong `PROJECT-STRUCTURE.md`

**Estimate**: 2 story points  
**Assignee**: DEV  

---

#### KSA-253: Consolidate FSD Generation Scripts
**Description**: Merge 5 FSD generation variants thành single script với versioning.

**Acceptance Criteria**:
- [ ] Analyze differences giữa `gen_fsd.py`, `gen_fsd2.py`, ..., `gen_fsd5.py`
- [ ] Extract common logic → `scripts/fsd/core.py`
- [ ] Create `scripts/fsd/generator.py` với `--version` flag: `--version=1|2|3|4|5`
- [ ] Default version = latest (v5)
- [ ] Archive old scripts → `scripts/archive/fsd/`
- [ ] Update BA agent prompt nếu cần

**Estimate**: 5 story points  
**Assignee**: DEV  

---

#### KSA-254: Dependency Audit & Version Lock
**Description**: Lock MCP server version trong extension, audit native binary dependencies.

**Acceptance Criteria**:
- [ ] Lock `mcp-code-intelligence-nodejs` version trong `kiro-sdlc-agents/package.json`
- [ ] Lock `mcp-salesforce-intelligence` version
- [ ] Document version matrix: Extension 1.17.0 → MCP 0.7.0 → Node [20,22,24,25]
- [ ] CI test matrix: Extension × MCP × Node versions (12 combinations)
- [ ] Add `DEPENDENCY-MATRIX.md` trong docs

**Estimate**: 3 story points  
**Assignee**: DevOps  

---

## 🧪 Epic 2: Quality Gates & Testing

**Priority**: P0 (Critical)  
**Impact**: Confidence trong releases, regression prevention  
**Timeline**: Sprint 2 (Week 3-4)

### Stories

#### KSA-255: Add Coverage Reports (Kotlin)
**Description**: Jacoco coverage cho mcp-code-intelligence-kotlin với badge trong README.

**Acceptance Criteria**:
- [ ] Add Jacoco plugin trong `build.gradle.kts`
- [ ] Configure coverage thresholds: line ≥80%, branch ≥70%
- [ ] Generate HTML reports trong `build/reports/jacoco/`
- [ ] CI job upload reports → Codecov/Coveralls
- [ ] Add badge trong README: `![Coverage](https://codecov.io/gh/.../badge.svg)`
- [ ] Fail build nếu coverage < threshold

**Estimate**: 3 story points  
**Assignee**: DEV  

---

#### KSA-256: Add Coverage Reports (Node.js)
**Description**: nyc coverage cho mcp-code-intelligence-nodejs.

**Acceptance Criteria**:
- [ ] Add nyc dependency
- [ ] Configure `nyc` trong `package.json`: lines ≥80%, branches ≥70%
- [ ] Run `npm test` with coverage
- [ ] CI job upload → Codecov
- [ ] Add badge trong README
- [ ] Exclude generated files: `dist/`, `node_modules/`

**Estimate**: 3 story points  
**Assignee**: DEV  

---

#### KSA-257: Add Coverage Reports (Python)
**Description**: coverage.py cho mcp-code-intelligence-python.

**Acceptance Criteria**:
- [ ] Add `coverage` package (zero external deps → use stdlib only)
- [ ] **Alternative**: Use pytest-cov (acceptable external dep for testing)
- [ ] Configure `.coveragerc`: lines ≥80%
- [ ] Run tests with coverage: `coverage run -m pytest`
- [ ] Generate report: `coverage report`, `coverage html`
- [ ] CI job upload → Codecov
- [ ] Add badge trong README

**Estimate**: 2 story points  
**Assignee**: DEV  

---

#### KSA-258: Integration Tests — Agent Pipeline
**Description**: E2E test cho agent orchestration (SM → BA → SA → DEV).

**Acceptance Criteria**:
- [ ] Mock Jira API (return fake ticket data)
- [ ] Mock MCP code intelligence (return fake symbols)
- [ ] Test case 1: SM receives `KSA-TEST` → invokes BA → verifies BRD.md created
- [ ] Test case 2: SM continues → invokes SA → verifies TDD.md created
- [ ] Test case 3: Discrepancy loop → BA fixes FSD → SA re-verifies
- [ ] Test case 4: Quality gate failure → SM retries → max 2 attempts
- [ ] Run trong CI pipeline: `npm run test:integration`
- [ ] Test time < 2 minutes

**Estimate**: 8 story points  
**Assignee**: QA + DEV  

---

#### KSA-259: E2E Tests — KB UI Panels
**Description**: Automated tests cho 5 KB UI panels (Dashboard, Graph, Tags, Quality, Analytics).

**Acceptance Criteria**:
- [ ] Setup Playwright/Puppeteer trong `kiro-sdlc-agents/`
- [ ] Test Dashboard: load metrics, verify chart rendering
- [ ] Test Graph: load 100 nodes, verify LOD clustering triggers
- [ ] Test Tags: click tag → verify entries filtered
- [ ] Test Quality: verify score distribution chart
- [ ] Test Analytics: verify search trends chart
- [ ] SSE test: mock server sends update → verify panel refreshes
- [ ] Run trong CI: `npm run test:e2e`
- [ ] Headless mode cho CI, headed mode cho debug

**Estimate**: 8 story points  
**Assignee**: QA + UI  

---

## 📚 Epic 3: Documentation & ADRs

**Priority**: P1 (High)  
**Impact**: Onboarding, architecture clarity, future decisions  
**Timeline**: Sprint 3 (Week 5-6)

### Stories

#### KSA-260: Architecture Decision Records (ADRs)
**Description**: Document top 10 architecture decisions với context và rationale.

**Acceptance Criteria**:
- [ ] Create `documents/architecture/` directory
- [ ] ADR-001: Multi-MCP Variants (Kotlin + Node.js + Python) — why 3 implementations?
- [ ] ADR-002: Tree-sitter AST Parser — why not built-in parsers?
- [ ] ADR-003: Feedback Loop Limit (max 5 iterations) — why 5?
- [ ] ADR-004: SSE vs WebSocket for KB UI — why SSE?
- [ ] ADR-005: Steering Files in .kiro/ — why not config DB?
- [ ] ADR-006: 9 Agents Architecture — why not monolithic AI?
- [ ] ADR-007: Draw.io Diagrams (not Mermaid) — why?
- [ ] ADR-008: DOCX Export (not PDF) — why?
- [ ] ADR-009: Jira Integration (not GitHub Issues) — why?
- [ ] ADR-010: Prebuilt Binaries (not compile on install) — why?
- [ ] Template: [MADR format](https://adr.github.io/madr/)

**Estimate**: 5 story points  
**Assignee**: SA + SM  

---

#### KSA-261: Steering File Versioning
**Description**: Add versioning, changelog, migration guide cho steering files.

**Acceptance Criteria**:
- [ ] Create `.kiro/steering/VERSION` file: `1.0.0`
- [ ] Create `.kiro/steering/CHANGELOG.md`:
  ```markdown
  ## [1.0.0] - 2025-01-08
  - Initial steering rules
  - 14 files: sm-core.md, phase-*.md, shared-*.md, patterns/*.md
  ```
- [ ] Create `.kiro/steering/migrations/` directory
- [ ] Migration guide template: `v1-to-v2.md`
- [ ] SM agent reads VERSION on startup, warns if mismatch
- [ ] Document versioning process trong `STEERING-VERSIONING.md`

**Estimate**: 3 story points  
**Assignee**: SM + DEV  

---

#### KSA-262: Project Structure Documentation
**Description**: Document active modules, purpose, dependencies.

**Acceptance Criteria**:
- [ ] Create `PROJECT-STRUCTURE.md`:
  - Module list với description
  - Dependency graph (text or mermaid)
  - Tech stack per module
  - Build commands per module
- [ ] Remove noise modules từ document (tmp-*, orphans)
- [ ] Clarify purpose của mỗi module:
  - `kiro-sdlc-agents` — VS Code extension
  - `mcp-code-intelligence-*` — MCP servers
  - `sdlc-memory` — KB engine
  - `shared/` — shared utilities
  - `scripts/` — build automation
- [ ] Link từ README.md

**Estimate**: 3 story points  
**Assignee**: BA + TA  

---

#### KSA-263: Dependency Matrix Documentation
**Description**: Clear version compatibility matrix cho all components.

**Acceptance Criteria**:
- [ ] Create `DEPENDENCY-MATRIX.md`:
  ```markdown
  | Extension | MCP Server | Node.js | ONNX Runtime | better-sqlite3 |
  |-----------|-----------|---------|--------------|----------------|
  | 1.17.0    | 0.7.0     | 20,22,24,25 | 1.18.0  | 12.10.0        |
  ```
- [ ] Document breaking changes per version
- [ ] Document upgrade path: 1.16.0 → 1.17.0
- [ ] Link từ README.md và CHANGELOG.md

**Estimate**: 2 story points  
**Assignee**: DevOps + TA  

---

## 🔒 Epic 4: Security & Compliance

**Priority**: P1 (High)  
**Impact**: Production readiness, compliance  
**Timeline**: Sprint 3 (Week 5-6)

### Stories

#### KSA-264: Security Review Checklist
**Description**: Comprehensive security review cho all components.

**Acceptance Criteria**:
- [ ] Credentials storage review:
  - Jira credentials — encrypted at rest?
  - MCP API keys — secure generation?
  - KB data — access control?
- [ ] Agent prompt injection review:
  - User input sanitization
  - Context isolation giữa agents
  - Steering file integrity checks
- [ ] MCP server authentication:
  - API key requirement
  - Request validation
  - Rate limiting
- [ ] KB data isolation:
  - Multi-tenant support?
  - RBAC implementation?
- [ ] Document findings trong `SECURITY-REVIEW.md`
- [ ] Create tickets cho vulnerabilities found

**Estimate**: 8 story points  
**Assignee**: Security + SA  

---

#### KSA-265: Add SECURITY.md
**Description**: Vulnerability reporting process và security policy.

**Acceptance Criteria**:
- [ ] Create `SECURITY.md` với sections:
  - Supported Versions (1.17.0 = current)
  - Reporting a Vulnerability (email, PGP key)
  - Security Update Policy (patch within 7 days for critical)
  - Known Security Considerations (agent context limits, etc.)
- [ ] Link từ README.md
- [ ] Setup security email alias
- [ ] Generate PGP key cho security reports

**Estimate**: 2 story points  
**Assignee**: Security + SM  

---

#### KSA-266: Dependency Security Audit
**Description**: Audit all dependencies cho known vulnerabilities.

**Acceptance Criteria**:
- [ ] Run `npm audit` trong all Node.js projects
- [ ] Run `./gradlew dependencyCheckAnalyze` (OWASP) cho Kotlin
- [ ] Run `pip-audit` cho Python (nếu có deps)
- [ ] Fix all HIGH and CRITICAL vulnerabilities
- [ ] Document MEDIUM vulnerabilities với mitigation plan
- [ ] CI job: weekly dependency audit
- [ ] Fail build nếu new HIGH/CRITICAL vulnerabilities

**Estimate**: 5 story points  
**Assignee**: DevOps + Security  

---

## 📅 Sprint Planning

### Sprint 1: Cleanup & Organization (Week 1-2)
**Goal**: Giảm noise, improve developer productivity

| Story | Priority | Estimate | Assignee |
|-------|----------|----------|----------|
| KSA-250 | P0 | 3 | DEV |
| KSA-251 | P0 | 2 | DEV |
| KSA-252 | P0 | 2 | DEV |
| KSA-253 | P0 | 5 | DEV |
| KSA-254 | P0 | 3 | DevOps |
| **Total** | | **15 SP** | |

**Velocity**: Assuming team velocity 15-20 SP/sprint → achievable.

---

### Sprint 2: Quality Gates & Testing (Week 3-4)
**Goal**: 80% test coverage, automated testing pipeline

| Story | Priority | Estimate | Assignee |
|-------|----------|----------|----------|
| KSA-255 | P0 | 3 | DEV |
| KSA-256 | P0 | 3 | DEV |
| KSA-257 | P0 | 2 | DEV |
| KSA-258 | P0 | 8 | QA + DEV |
| KSA-259 | P1 | 8 | QA + UI |
| **Total** | | **24 SP** | |

**Note**: Over-capacity → prioritize coverage reports + agent pipeline test. KB UI test có thể move sang Sprint 3 nếu cần.

---

### Sprint 3: Documentation & Security (Week 5-6)
**Goal**: Production-ready documentation, security compliance

| Story | Priority | Estimate | Assignee |
|-------|----------|----------|----------|
| KSA-260 | P1 | 5 | SA + SM |
| KSA-261 | P1 | 3 | SM + DEV |
| KSA-262 | P1 | 3 | BA + TA |
| KSA-263 | P1 | 2 | DevOps + TA |
| KSA-264 | P1 | 8 | Security + SA |
| KSA-265 | P1 | 2 | Security + SM |
| KSA-266 | P1 | 5 | DevOps + Security |
| KSA-259* | P1 | 8 | QA + UI (rollover) |
| **Total** | | **36 SP** | |

**Note**: Over-capacity → prioritize security stories (264-266) + ADRs (260). Docs có thể extend sang week 7 nếu cần.

---

## 🎯 Success Criteria

### Sprint 1 Done When:
- [ ] Root directory có ≤5 script files (rest moved)
- [ ] Code indexing module count: 50 → ~30
- [ ] Indexing time improvement: ≥30%
- [ ] Dependency matrix documented

### Sprint 2 Done When:
- [ ] Test coverage badges trong all READMEs
- [ ] Kotlin: ≥80% line coverage
- [ ] Node.js: ≥80% line coverage
- [ ] Python: ≥80% line coverage
- [ ] Agent pipeline integration test passing in CI

### Sprint 3 Done When:
- [ ] 10 ADRs published
- [ ] Steering files versioned (v1.0.0)
- [ ] SECURITY.md published
- [ ] Zero HIGH/CRITICAL vulnerabilities
- [ ] PROJECT-STRUCTURE.md complete

---

## 📊 Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Native binary compatibility breaks | Medium | High | Test matrix in CI before merge |
| Coverage target too aggressive (80%) | Medium | Medium | Start with 70%, increase gradually |
| Security audit finds critical issues | Low | High | Allocate buffer time in Sprint 3 |
| Team velocity lower than estimated | Medium | Medium | Prioritize P0 stories, defer P1 |
| ADR writing takes longer (no template) | Medium | Low | Use MADR template, SM reviews |

---

## 📈 Metrics to Track

### Weekly
- [ ] Stories completed vs planned
- [ ] Blockers count
- [ ] PR review time (target: <24h)

### End of Sprint
- [ ] Velocity (actual vs planned)
- [ ] Test coverage % (trend)
- [ ] Code indexing time (trend)
- [ ] Vulnerabilities count (trend: should decrease)

### End of Q1
- [ ] All 16 stories completed?
- [ ] Coverage ≥80%?
- [ ] Zero HIGH/CRITICAL vulnerabilities?
- [ ] ADR coverage complete?

---

## 🚀 Post-Q1 Roadmap (Q2 Preview)

After completing Q1 improvements, consider:

1. **Plugin Architecture** — Custom agent support (KSA-270)
2. **Agent Marketplace** — Share agents across teams (KSA-271)
3. **Multi-project Orchestration** — Monorepo với multiple Jira projects (KSA-272)
4. **Agent Performance Metrics** — Token usage, latency dashboard (KSA-273)
5. **Advanced KB Features** — Vector similarity, auto-consolidation (KSA-274)

---

## 📝 Notes for SM

- **Daily standups**: Focus on blockers, dependencies giữa stories
- **Sprint review**: Demo coverage badges, ADRs, security checklist
- **Retrospective**: What went well, what to improve cho Q2
- **Communication**: Update stakeholders weekly với metrics snapshot

---

**Document version**: 1.0  
**Last updated**: 2025-01-08  
**Owner**: SM Agent  
**Reviewers**: SA, QA, Security, DevOps

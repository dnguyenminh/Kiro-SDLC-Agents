# Jira Ticket Creation Script — Q1 2025 Improvements

## Epic Tickets

### KSA-249: [EPIC] Code Organization & Cleanup
**Type**: Epic  
**Priority**: P0 (Critical)  
**Summary**: Reorganize codebase, remove noise, improve indexing performance  
**Description**:
```
Consolidate 20+ root-level scripts, add code intelligence ignore rules, cleanup duplicate modules.

**Impact**: 
- Developer productivity +30%
- Code indexing time -30%
- Module count: 50 → 30

**Timeline**: Sprint 1 (Week 1-2)
**Stories**: KSA-250, KSA-251, KSA-252, KSA-253, KSA-254
```

---

### KSA-248: [EPIC] Quality Gates & Testing
**Type**: Epic  
**Priority**: P0 (Critical)  
**Summary**: Add test coverage reports, integration tests, E2E tests  
**Description**:
```
Achieve 80% test coverage across Kotlin, Node.js, Python modules with CI badges.
Add agent pipeline integration tests and KB UI E2E tests.

**Impact**:
- Confidence in releases
- Regression prevention
- Automated quality validation

**Timeline**: Sprint 2 (Week 3-4)
**Stories**: KSA-255, KSA-256, KSA-257, KSA-258, KSA-259
```

---

### KSA-247: [EPIC] Documentation & ADRs
**Type**: Epic  
**Priority**: P1 (High)  
**Summary**: Document architecture decisions, add versioning to steering files  
**Description**:
```
Create 10 ADRs for key architecture decisions.
Add versioning system for steering files.
Document project structure and dependency matrix.

**Impact**:
- Onboarding time -50%
- Architecture clarity
- Future decision making

**Timeline**: Sprint 3 (Week 5-6)
**Stories**: KSA-260, KSA-261, KSA-262, KSA-263
```

---

### KSA-246: [EPIC] Security & Compliance
**Type**: Epic  
**Priority**: P1 (High)  
**Summary**: Security review, vulnerability reporting process, dependency audit  
**Description**:
```
Comprehensive security review of all components.
Add SECURITY.md with vulnerability reporting process.
Audit dependencies for known vulnerabilities.

**Impact**:
- Production readiness
- Compliance requirements
- Zero critical vulnerabilities

**Timeline**: Sprint 3 (Week 5-6)
**Stories**: KSA-264, KSA-265, KSA-266
```

---

## Story Tickets (Sprint 1)

### KSA-250: Reorganize Root-Level Scripts
**Type**: Story  
**Epic**: KSA-249  
**Priority**: P0  
**Estimate**: 3 SP  
**Assignee**: DEV  
**Sprint**: Sprint 1

**Summary**: Consolidate 20+ root-level scripts into `scripts/` with clear structure

**Description**:
```markdown
## Context
Project root có 20+ script files (gen_fsd*.py, _fix_*.ps1, tmp-*.ps1) gây khó navigate.

## Tasks
- [ ] Create `scripts/fsd/`, `scripts/temp/`, `scripts/archive/`
- [ ] Move `gen_fsd{2-5}.py` → `scripts/archive/`
- [ ] Consolidate FSD scripts → `scripts/fsd/`
- [ ] Move all `tmp-*` files → `scripts/temp/`
- [ ] Move `_fix_*.ps1` → `scripts/archive/`
- [ ] Move `test_api.py` → `scripts/tests/`
- [ ] Update README.md references

## Acceptance Criteria
- Root directory có ≤5 script files
- All scripts trong `scripts/` với organized subdirectories
- README updated với new paths

## Definition of Done
- [ ] Code moved
- [ ] README updated
- [ ] No broken references
- [ ] Verified scripts still work from new locations
```

---

### KSA-251: Add Code Intelligence Ignore Rules
**Type**: Story  
**Epic**: KSA-249  
**Priority**: P0  
**Estimate**: 2 SP  
**Assignee**: DEV  
**Sprint**: Sprint 1

**Summary**: Giảm noise trong code indexing bằng `.code-intel/ignore` file

**Description**:
```markdown
## Context
Code intelligence đang index 50 modules, 15+ là temp files và build artifacts.

## Tasks
- [ ] Create `.code-intel/ignore` với patterns (tmp-*, *.lock, node_modules/, dist/, out/, build/)
- [ ] Re-index workspace
- [ ] Measure module count (target: 50 → 30)
- [ ] Measure indexing time improvement (target: -30%)
- [ ] Document ignore syntax

## Acceptance Criteria
- Module count giảm từ 50 → ~30
- Indexing time giảm ≥30%
- Documentation added to MCP README

## Metrics
- Before: 50 modules, X seconds indexing
- After: 30 modules, Y seconds indexing (Y < 0.7X)
```

---

### KSA-252: Cleanup Duplicate Modules
**Type**: Story  
**Epic**: KSA-249  
**Priority**: P0  
**Estimate**: 2 SP  
**Assignee**: DEV  
**Sprint**: Sprint 1

**Summary**: Remove/archive duplicate and orphan modules

**Description**:
```markdown
## Context
Nhiều modules không còn active: tmp-grammars, tmp-ort-package, history, kiro-gateway.

## Tasks
- [ ] Audit modules: tmp-grammars/, tmp-grammars2/, tmp-ort-package/
- [ ] Verify kiro-gateway/ — move out hoặc add to ignore
- [ ] Verify history/ — delete nếu orphan
- [ ] Verify dist/ và anthropic/ — add to ignore nếu build artifacts
- [ ] Document active modules trong PROJECT-STRUCTURE.md

## Acceptance Criteria
- Duplicate/orphan modules removed hoặc ignored
- Active modules documented
- No false positives trong code search
```

---

### KSA-253: Consolidate FSD Generation Scripts
**Type**: Story  
**Epic**: KSA-249  
**Priority**: P0  
**Estimate**: 5 SP  
**Assignee**: DEV  
**Sprint**: Sprint 1

**Summary**: Merge 5 FSD generation variants thành single script với versioning

**Description**:
```markdown
## Context
Có 5 variants: gen_fsd.py, gen_fsd2.py, ..., gen_fsd5.py. Unclear which is current.

## Tasks
- [ ] Analyze differences giữa 5 variants
- [ ] Extract common logic → `scripts/fsd/core.py`
- [ ] Create `scripts/fsd/generator.py` với `--version` flag
- [ ] Support versions 1-5, default = latest (v5)
- [ ] Archive old scripts
- [ ] Update BA agent prompt nếu cần

## Acceptance Criteria
- Single generator.py với --version flag
- All 5 versions supported
- Old scripts archived
- BA agent updated (nếu cần)

## Testing
- Run generator.py --version=1 → output matches old gen_fsd.py
- Run generator.py --version=5 → output matches old gen_fsd5.py
```

---

### KSA-254: Dependency Audit & Version Lock
**Type**: Story  
**Epic**: KSA-249  
**Priority**: P0  
**Estimate**: 3 SP  
**Assignee**: DevOps  
**Sprint**: Sprint 1

**Summary**: Lock MCP server version trong extension, audit native binary dependencies

**Description**:
```markdown
## Context
Extension 1.17.0 spawns MCP server 0.7.0, nhưng không có version locking.
Native binaries (better-sqlite3, onnxruntime-node) có compatibility matrix phức tạp.

## Tasks
- [ ] Lock mcp-code-intelligence-nodejs version trong kiro-sdlc-agents/package.json
- [ ] Lock mcp-salesforce-intelligence version
- [ ] Document version matrix: Extension → MCP → Node versions
- [ ] CI test matrix: Extension × MCP × Node [20,22,24,25]
- [ ] Create DEPENDENCY-MATRIX.md

## Acceptance Criteria
- Version locked trong package.json
- CI test matrix passing (12 combinations)
- DEPENDENCY-MATRIX.md published

## Risk
- Native binary mismatch → CI test matrix catches this
```

---

## Story Tickets (Sprint 2)

### KSA-255: Add Coverage Reports (Kotlin)
**Type**: Story  
**Epic**: KSA-248  
**Priority**: P0  
**Estimate**: 3 SP  
**Assignee**: DEV  
**Sprint**: Sprint 2

**Summary**: Jacoco coverage cho mcp-code-intelligence-kotlin với badge trong README

**Description**:
```markdown
## Tasks
- [ ] Add Jacoco plugin trong build.gradle.kts
- [ ] Configure thresholds: line ≥80%, branch ≥70%
- [ ] Generate HTML reports
- [ ] CI job upload → Codecov
- [ ] Add badge trong README
- [ ] Fail build nếu coverage < threshold

## Acceptance Criteria
- Jacoco configured
- Coverage ≥80% line, ≥70% branch
- Badge visible trong README
- CI enforces threshold

## Metrics
- Current coverage: unknown
- Target: ≥80% line coverage
```

---

### KSA-256: Add Coverage Reports (Node.js)
**Type**: Story  
**Epic**: KSA-248  
**Priority**: P0  
**Estimate**: 3 SP  
**Assignee**: DEV  
**Sprint**: Sprint 2

**Summary**: nyc coverage cho mcp-code-intelligence-nodejs

**Description**:
```markdown
## Tasks
- [ ] Add nyc dependency
- [ ] Configure nyc: lines ≥80%, branches ≥70%
- [ ] npm test with coverage
- [ ] CI upload → Codecov
- [ ] Badge trong README
- [ ] Exclude dist/, node_modules/

## Acceptance Criteria
- nyc configured
- Coverage ≥80%
- Badge visible
- CI enforces threshold
```

---

### KSA-257: Add Coverage Reports (Python)
**Type**: Story  
**Epic**: KSA-248  
**Priority**: P0  
**Estimate**: 2 SP  
**Assignee**: DEV  
**Sprint**: Sprint 2

**Summary**: coverage.py cho mcp-code-intelligence-python

**Description**:
```markdown
## Tasks
- [ ] Add pytest-cov (acceptable testing dep)
- [ ] Configure .coveragerc: lines ≥80%
- [ ] coverage run -m pytest
- [ ] Generate html report
- [ ] CI upload → Codecov
- [ ] Badge trong README

## Acceptance Criteria
- Coverage ≥80%
- Badge visible
- CI enforces
```

---

### KSA-258: Integration Tests — Agent Pipeline
**Type**: Story  
**Epic**: KSA-248  
**Priority**: P0  
**Estimate**: 8 SP  
**Assignee**: QA + DEV  
**Sprint**: Sprint 2

**Summary**: E2E test cho agent orchestration (SM → BA → SA → DEV)

**Description**:
```markdown
## Context
Hiện tại không có automated test cho agent pipeline. Cần verify SM orchestration logic.

## Test Cases
1. SM receives KSA-TEST → invokes BA → BRD.md created
2. SM continues → SA → TDD.md created
3. Discrepancy loop → BA fixes FSD → SA re-verifies
4. Quality gate failure → SM retries → max 2 attempts

## Tasks
- [ ] Mock Jira API
- [ ] Mock MCP code intelligence
- [ ] Implement 4 test cases
- [ ] npm run test:integration
- [ ] CI pipeline integration
- [ ] Test time < 2 minutes

## Acceptance Criteria
- 4 test cases passing
- CI integration
- Test time < 2 min
```

---

### KSA-259: E2E Tests — KB UI Panels
**Type**: Story  
**Epic**: KSA-248  
**Priority**: P1  
**Estimate**: 8 SP  
**Assignee**: QA + UI  
**Sprint**: Sprint 2 (hoặc Sprint 3 rollover)

**Summary**: Automated tests cho 5 KB UI panels

**Description**:
```markdown
## Test Cases
- Dashboard: load metrics, verify charts
- Graph: 100 nodes, verify LOD clustering
- Tags: click tag → entries filtered
- Quality: score distribution chart
- Analytics: search trends chart
- SSE: mock update → panel refreshes

## Tasks
- [ ] Setup Playwright
- [ ] Implement 6 test scenarios
- [ ] npm run test:e2e
- [ ] CI integration (headless)

## Acceptance Criteria
- 6 scenarios passing
- CI integration
- Headless + headed modes
```

---

## Story Tickets (Sprint 3)

### KSA-260: Architecture Decision Records (ADRs)
**Type**: Story  
**Epic**: KSA-247  
**Priority**: P1  
**Estimate**: 5 SP  
**Assignee**: SA + SM  
**Sprint**: Sprint 3

**Summary**: Document top 10 architecture decisions

**Description**:
```markdown
## ADRs to Create
1. Multi-MCP Variants (Kotlin + Node + Python)
2. Tree-sitter AST Parser
3. Feedback Loop Limit (max 5)
4. SSE vs WebSocket
5. Steering Files in .kiro/
6. 9 Agents Architecture
7. Draw.io Diagrams (not Mermaid)
8. DOCX Export (not PDF)
9. Jira Integration
10. Prebuilt Binaries

## Template
Use MADR format: https://adr.github.io/madr/

## Acceptance Criteria
- 10 ADRs published trong documents/architecture/
- Each ADR has: Context, Decision, Consequences
- Linked from README
```

---

### KSA-261: Steering File Versioning
**Type**: Story  
**Epic**: KSA-247  
**Priority**: P1  
**Estimate**: 3 SP  
**Assignee**: SM + DEV  
**Sprint**: Sprint 3

**Summary**: Add versioning, changelog, migration guide

**Description**:
```markdown
## Tasks
- [ ] Create .kiro/steering/VERSION (1.0.0)
- [ ] Create CHANGELOG.md
- [ ] Create migrations/ directory
- [ ] SM reads VERSION on startup
- [ ] Document versioning process

## Acceptance Criteria
- VERSION file exists
- CHANGELOG.md initialized
- SM validates version
- Versioning process documented
```

---

### KSA-262: Project Structure Documentation
**Type**: Story  
**Epic**: KSA-247  
**Priority**: P1  
**Estimate**: 3 SP  
**Assignee**: BA + TA  
**Sprint**: Sprint 3

**Summary**: Document active modules, purpose, dependencies

**Description**:
```markdown
## Content
- Module list với descriptions
- Dependency graph
- Tech stack per module
- Build commands

## Acceptance Criteria
- PROJECT-STRUCTURE.md created
- All active modules documented
- Linked from README
```

---

### KSA-263: Dependency Matrix Documentation
**Type**: Story  
**Epic**: KSA-247  
**Priority**: P1  
**Estimate**: 2 SP  
**Assignee**: DevOps + TA  
**Sprint**: Sprint 3

**Summary**: Version compatibility matrix

**Description**:
```markdown
## Content
| Extension | MCP | Node.js | ONNX | better-sqlite3 |
|-----------|-----|---------|------|----------------|
| 1.17.0    | 0.7.0 | 20,22,24,25 | 1.18.0 | 12.10.0 |

## Acceptance Criteria
- DEPENDENCY-MATRIX.md created
- Breaking changes documented
- Upgrade paths documented
```

---

### KSA-264: Security Review Checklist
**Type**: Story  
**Epic**: KSA-246  
**Priority**: P1  
**Estimate**: 8 SP  
**Assignee**: Security + SA  
**Sprint**: Sprint 3

**Summary**: Comprehensive security review

**Description**:
```markdown
## Review Areas
- Credentials storage (Jira, MCP keys)
- Agent prompt injection
- MCP authentication
- KB data isolation

## Deliverables
- SECURITY-REVIEW.md
- Tickets for vulnerabilities found

## Acceptance Criteria
- All areas reviewed
- Findings documented
- Remediation tickets created
```

---

### KSA-265: Add SECURITY.md
**Type**: Story  
**Epic**: KSA-246  
**Priority**: P1  
**Estimate**: 2 SP  
**Assignee**: Security + SM  
**Sprint**: Sprint 3

**Summary**: Vulnerability reporting process

**Description**:
```markdown
## Sections
- Supported Versions
- Reporting a Vulnerability
- Security Update Policy
- Known Security Considerations

## Tasks
- [ ] Create SECURITY.md
- [ ] Setup security email
- [ ] Generate PGP key
- [ ] Link from README

## Acceptance Criteria
- SECURITY.md published
- Email setup
- PGP key available
```

---

### KSA-266: Dependency Security Audit
**Type**: Story  
**Epic**: KSA-246  
**Priority**: P1  
**Estimate**: 5 SP  
**Assignee**: DevOps + Security  
**Sprint**: Sprint 3

**Summary**: Audit dependencies for vulnerabilities

**Description**:
```markdown
## Tasks
- [ ] npm audit (all Node.js projects)
- [ ] OWASP dependency check (Kotlin)
- [ ] pip-audit (Python)
- [ ] Fix HIGH/CRITICAL
- [ ] Document MEDIUM with mitigation
- [ ] CI weekly audit job

## Acceptance Criteria
- Zero HIGH/CRITICAL vulnerabilities
- MEDIUM documented
- CI job configured
```

---

## How to Use This Script

1. **Create Epics first** (KSA-246 to KSA-249)
2. **Create Stories** and link to Epic
3. **Assign to Sprint** trong Jira
4. **Track progress** với burndown charts

## Jira CLI Commands (if using jira-cli)

```bash
# Create Epic
jira issue create --project KSA --type Epic --summary "[EPIC] Code Organization & Cleanup" --priority P0

# Create Story
jira issue create --project KSA --type Story --summary "Reorganize Root-Level Scripts" --epic KSA-249 --priority P0 --estimate 3 --sprint "Sprint 1"

# Link Story to Epic
jira issue link KSA-250 KSA-249

# Bulk import
jira import issues.csv
```

---

**Created**: 2025-01-08  
**Owner**: SM Agent  
**Reviewed by**: SA, QA, DevOps

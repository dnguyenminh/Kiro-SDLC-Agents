# Q1 2025 Improvement Tickets — Batch Creation

**Project**: KSA  
**Created**: 2025-01-08  
**Total**: 4 Epics + 16 Stories

---

## Epic 1: KSA-249 — Code Organization & Cleanup

```json
{
  "project": "KSA",
  "issueType": "Epic",
  "summary": "[EPIC] Code Organization & Cleanup",
  "priority": "Highest",
  "description": "Consolidate 20+ root-level scripts, add code intelligence ignore rules, cleanup duplicate modules.\n\n**Impact**:\n- Developer productivity +30%\n- Code indexing time -30%\n- Module count: 50 → 30\n\n**Timeline**: Sprint 1 (Week 1-2)\n**Stories**: KSA-250, KSA-251, KSA-252, KSA-253, KSA-254",
  "labels": ["improvement", "q1-2025", "cleanup"]
}
```

---

## Epic 2: KSA-248 — Quality Gates & Testing

```json
{
  "project": "KSA",
  "issueType": "Epic",
  "summary": "[EPIC] Quality Gates & Testing",
  "priority": "Highest",
  "description": "Achieve 80% test coverage across Kotlin, Node.js, Python modules with CI badges. Add agent pipeline integration tests and KB UI E2E tests.\n\n**Impact**:\n- Confidence in releases\n- Regression prevention\n- Automated quality validation\n\n**Timeline**: Sprint 2 (Week 3-4)\n**Stories**: KSA-255, KSA-256, KSA-257, KSA-258, KSA-259",
  "labels": ["improvement", "q1-2025", "testing"]
}
```

---

## Epic 3: KSA-247 — Documentation & ADRs

```json
{
  "project": "KSA",
  "issueType": "Epic",
  "summary": "[EPIC] Documentation & ADRs",
  "priority": "High",
  "description": "Create 10 ADRs for key architecture decisions. Add versioning system for steering files. Document project structure and dependency matrix.\n\n**Impact**:\n- Onboarding time -50%\n- Architecture clarity\n- Future decision making\n\n**Timeline**: Sprint 3 (Week 5-6)\n**Stories**: KSA-260, KSA-261, KSA-262, KSA-263",
  "labels": ["improvement", "q1-2025", "documentation"]
}
```

---

## Epic 4: KSA-246 — Security & Compliance

```json
{
  "project": "KSA",
  "issueType": "Epic",
  "summary": "[EPIC] Security & Compliance",
  "priority": "High",
  "description": "Comprehensive security review of all components. Add SECURITY.md with vulnerability reporting process. Audit dependencies for known vulnerabilities.\n\n**Impact**:\n- Production readiness\n- Compliance requirements\n- Zero critical vulnerabilities\n\n**Timeline**: Sprint 3 (Week 5-6)\n**Stories**: KSA-264, KSA-265, KSA-266",
  "labels": ["improvement", "q1-2025", "security"]
}
```

---

## Story 1: KSA-250 — Reorganize Root-Level Scripts

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Reorganize Root-Level Scripts",
  "priority": "Highest",
  "epicLink": "KSA-249",
  "storyPoints": 3,
  "sprint": "Sprint 1",
  "assignee": "DEV-1",
  "description": "## Context\nProject root có 20+ script files (gen_fsd*.py, _fix_*.ps1, tmp-*.ps1) gây khó navigate.\n\n## Tasks\n- [ ] Create scripts/fsd/, scripts/temp/, scripts/archive/\n- [ ] Move gen_fsd{2-5}.py → scripts/archive/\n- [ ] Consolidate FSD scripts → scripts/fsd/\n- [ ] Move all tmp-* files → scripts/temp/\n- [ ] Move _fix_*.ps1 → scripts/archive/\n- [ ] Move test_api.py → scripts/tests/\n- [ ] Update README.md references\n\n## Acceptance Criteria\n- Root directory có ≤5 script files\n- All scripts trong scripts/ với organized subdirectories\n- README updated với new paths\n\n## Definition of Done\n- [ ] Code moved\n- [ ] README updated\n- [ ] No broken references\n- [ ] Verified scripts still work from new locations",
  "labels": ["improvement", "cleanup", "sprint-1"]
}
```

---

## Story 2: KSA-251 — Add Code Intelligence Ignore Rules

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Add Code Intelligence Ignore Rules",
  "priority": "Highest",
  "epicLink": "KSA-249",
  "storyPoints": 2,
  "sprint": "Sprint 1",
  "assignee": "DEV-1",
  "description": "## Context\nCode intelligence đang index 50 modules, 15+ là temp files và build artifacts.\n\n## Tasks\n- [ ] Create .code-intel/ignore với patterns (tmp-*, *.lock, node_modules/, dist/, out/, build/)\n- [ ] Re-index workspace\n- [ ] Measure module count (target: 50 → 30)\n- [ ] Measure indexing time improvement (target: -30%)\n- [ ] Document ignore syntax\n\n## Acceptance Criteria\n- Module count giảm từ 50 → ~30\n- Indexing time giảm ≥30%\n- Documentation added to MCP README\n\n## Metrics\n- Before: 50 modules, X seconds indexing\n- After: 30 modules, Y seconds indexing (Y < 0.7X)",
  "labels": ["improvement", "performance", "sprint-1"]
}
```

---

## Story 3: KSA-252 — Cleanup Duplicate Modules

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Cleanup Duplicate Modules",
  "priority": "Highest",
  "epicLink": "KSA-249",
  "storyPoints": 2,
  "sprint": "Sprint 1",
  "assignee": "DEV-2",
  "description": "## Context\nNhiều modules không còn active: tmp-grammars, tmp-ort-package, history, kiro-gateway.\n\n## Tasks\n- [ ] Audit modules: tmp-grammars/, tmp-grammars2/, tmp-ort-package/\n- [ ] Verify kiro-gateway/ — move out hoặc add to ignore\n- [ ] Verify history/ — delete nếu orphan\n- [ ] Verify dist/ và anthropic/ — add to ignore nếu build artifacts\n- [ ] Document active modules trong PROJECT-STRUCTURE.md\n\n## Acceptance Criteria\n- Duplicate/orphan modules removed hoặc ignored\n- Active modules documented\n- No false positives trong code search",
  "labels": ["improvement", "cleanup", "sprint-1"]
}
```

---

## Story 4: KSA-253 — Consolidate FSD Generation Scripts

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Consolidate FSD Generation Scripts",
  "priority": "Highest",
  "epicLink": "KSA-249",
  "storyPoints": 5,
  "sprint": "Sprint 1",
  "assignee": "DEV-2",
  "description": "## Context\nCó 5 variants: gen_fsd.py, gen_fsd2.py, ..., gen_fsd5.py. Unclear which is current.\n\n## Tasks\n- [ ] Analyze differences giữa 5 variants\n- [ ] Extract common logic → scripts/fsd/core.py\n- [ ] Create scripts/fsd/generator.py với --version flag\n- [ ] Support versions 1-5, default = latest (v5)\n- [ ] Archive old scripts\n- [ ] Update BA agent prompt nếu cần\n\n## Acceptance Criteria\n- Single generator.py với --version flag\n- All 5 versions supported\n- Old scripts archived\n- BA agent updated (nếu cần)\n\n## Testing\n- Run generator.py --version=1 → output matches old gen_fsd.py\n- Run generator.py --version=5 → output matches old gen_fsd5.py",
  "labels": ["improvement", "consolidation", "sprint-1"]
}
```

---

## Story 5: KSA-254 — Dependency Audit & Version Lock

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Dependency Audit & Version Lock",
  "priority": "Highest",
  "epicLink": "KSA-249",
  "storyPoints": 3,
  "sprint": "Sprint 1",
  "assignee": "DevOps",
  "description": "## Context\nExtension 1.17.0 spawns MCP server 0.7.0, nhưng không có version locking. Native binaries (better-sqlite3, onnxruntime-node) có compatibility matrix phức tạp.\n\n## Tasks\n- [ ] Lock mcp-code-intelligence-nodejs version trong kiro-sdlc-agents/package.json\n- [ ] Lock mcp-salesforce-intelligence version\n- [ ] Document version matrix: Extension → MCP → Node versions\n- [ ] CI test matrix: Extension × MCP × Node [20,22,24,25]\n- [ ] Create DEPENDENCY-MATRIX.md\n\n## Acceptance Criteria\n- Version locked trong package.json\n- CI test matrix passing (12 combinations)\n- DEPENDENCY-MATRIX.md published\n\n## Risk\n- Native binary mismatch → CI test matrix catches this",
  "labels": ["improvement", "dependencies", "sprint-1"]
}
```

---

## Story 6: KSA-255 — Add Coverage Reports (Kotlin)

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Add Coverage Reports (Kotlin)",
  "priority": "Highest",
  "epicLink": "KSA-248",
  "storyPoints": 3,
  "sprint": "Sprint 2",
  "assignee": "DEV-1",
  "description": "## Tasks\n- [ ] Add Jacoco plugin trong build.gradle.kts\n- [ ] Configure thresholds: line ≥80%, branch ≥70%\n- [ ] Generate HTML reports\n- [ ] CI job upload → Codecov\n- [ ] Add badge trong README\n- [ ] Fail build nếu coverage < threshold\n\n## Acceptance Criteria\n- Jacoco configured\n- Coverage ≥80% line, ≥70% branch\n- Badge visible trong README\n- CI enforces threshold\n\n## Metrics\n- Current coverage: unknown\n- Target: ≥80% line coverage",
  "labels": ["improvement", "testing", "sprint-2"]
}
```

---

## Story 7: KSA-256 — Add Coverage Reports (Node.js)

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Add Coverage Reports (Node.js)",
  "priority": "Highest",
  "epicLink": "KSA-248",
  "storyPoints": 3,
  "sprint": "Sprint 2",
  "assignee": "DEV-2",
  "description": "## Tasks\n- [ ] Add nyc dependency\n- [ ] Configure nyc: lines ≥80%, branches ≥70%\n- [ ] npm test with coverage\n- [ ] CI upload → Codecov\n- [ ] Badge trong README\n- [ ] Exclude dist/, node_modules/\n\n## Acceptance Criteria\n- nyc configured\n- Coverage ≥80%\n- Badge visible\n- CI enforces threshold",
  "labels": ["improvement", "testing", "sprint-2"]
}
```

---

## Story 8: KSA-257 — Add Coverage Reports (Python)

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Add Coverage Reports (Python)",
  "priority": "Highest",
  "epicLink": "KSA-248",
  "storyPoints": 2,
  "sprint": "Sprint 2",
  "assignee": "DEV-1",
  "description": "## Tasks\n- [ ] Add pytest-cov (acceptable testing dep)\n- [ ] Configure .coveragerc: lines ≥80%\n- [ ] coverage run -m pytest\n- [ ] Generate html report\n- [ ] CI upload → Codecov\n- [ ] Badge trong README\n\n## Acceptance Criteria\n- Coverage ≥80%\n- Badge visible\n- CI enforces",
  "labels": ["improvement", "testing", "sprint-2"]
}
```

---

## Story 9: KSA-258 — Integration Tests: Agent Pipeline

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Integration Tests — Agent Pipeline",
  "priority": "Highest",
  "epicLink": "KSA-248",
  "storyPoints": 8,
  "sprint": "Sprint 2",
  "assignee": "QA, DEV-2",
  "description": "## Context\nHiện tại không có automated test cho agent pipeline. Cần verify SM orchestration logic.\n\n## Test Cases\n1. SM receives KSA-TEST → invokes BA → BRD.md created\n2. SM continues → SA → TDD.md created\n3. Discrepancy loop → BA fixes FSD → SA re-verifies\n4. Quality gate failure → SM retries → max 2 attempts\n\n## Tasks\n- [ ] Mock Jira API\n- [ ] Mock MCP code intelligence\n- [ ] Implement 4 test cases\n- [ ] npm run test:integration\n- [ ] CI pipeline integration\n- [ ] Test time < 2 minutes\n\n## Acceptance Criteria\n- 4 test cases passing\n- CI integration\n- Test time < 2 min",
  "labels": ["improvement", "testing", "integration", "sprint-2"]
}
```

---

## Story 10: KSA-259 — E2E Tests: KB UI Panels

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "E2E Tests — KB UI Panels",
  "priority": "High",
  "epicLink": "KSA-248",
  "storyPoints": 8,
  "sprint": "Sprint 2",
  "assignee": "QA, UI",
  "description": "## Test Cases\n- Dashboard: load metrics, verify charts\n- Graph: 100 nodes, verify LOD clustering\n- Tags: click tag → entries filtered\n- Quality: score distribution chart\n- Analytics: search trends chart\n- SSE: mock update → panel refreshes\n\n## Tasks\n- [ ] Setup Playwright\n- [ ] Implement 6 test scenarios\n- [ ] npm run test:e2e\n- [ ] CI integration (headless)\n\n## Acceptance Criteria\n- 6 scenarios passing\n- CI integration\n- Headless + headed modes\n\n**Note**: Stretch goal, có thể rollover sang Sprint 3",
  "labels": ["improvement", "testing", "e2e", "sprint-2", "stretch-goal"]
}
```

---

## Story 11: KSA-260 — Architecture Decision Records (ADRs)

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Architecture Decision Records (ADRs)",
  "priority": "High",
  "epicLink": "KSA-247",
  "storyPoints": 5,
  "sprint": "Sprint 3",
  "assignee": "SA, SM",
  "description": "## ADRs to Create\n1. Multi-MCP Variants (Kotlin + Node + Python)\n2. Tree-sitter AST Parser\n3. Feedback Loop Limit (max 5)\n4. SSE vs WebSocket\n5. Steering Files in .kiro/\n6. 9 Agents Architecture\n7. Draw.io Diagrams (not Mermaid)\n8. DOCX Export (not PDF)\n9. Jira Integration\n10. Prebuilt Binaries\n\n## Template\nUse MADR format: https://adr.github.io/madr/\n\n## Acceptance Criteria\n- 10 ADRs published trong documents/architecture/\n- Each ADR has: Context, Decision, Consequences\n- Linked from README",
  "labels": ["improvement", "documentation", "sprint-3"]
}
```

---

## Story 12: KSA-261 — Steering File Versioning

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Steering File Versioning",
  "priority": "High",
  "epicLink": "KSA-247",
  "storyPoints": 3,
  "sprint": "Sprint 3",
  "assignee": "SM, DEV-1",
  "description": "## Tasks\n- [ ] Create .kiro/steering/VERSION (1.0.0)\n- [ ] Create CHANGELOG.md\n- [ ] Create migrations/ directory\n- [ ] SM reads VERSION on startup\n- [ ] Document versioning process\n\n## Acceptance Criteria\n- VERSION file exists\n- CHANGELOG.md initialized\n- SM validates version\n- Versioning process documented",
  "labels": ["improvement", "documentation", "sprint-3"]
}
```

---

## Story 13: KSA-262 — Project Structure Documentation

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Project Structure Documentation",
  "priority": "High",
  "epicLink": "KSA-247",
  "storyPoints": 3,
  "sprint": "Sprint 3",
  "assignee": "BA, TA",
  "description": "## Content\n- Module list với descriptions\n- Dependency graph\n- Tech stack per module\n- Build commands\n\n## Acceptance Criteria\n- PROJECT-STRUCTURE.md created\n- All active modules documented\n- Linked from README",
  "labels": ["improvement", "documentation", "sprint-3"]
}
```

---

## Story 14: KSA-263 — Dependency Matrix Documentation

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Dependency Matrix Documentation",
  "priority": "High",
  "epicLink": "KSA-247",
  "storyPoints": 2,
  "sprint": "Sprint 3",
  "assignee": "DevOps, TA",
  "description": "## Content\n| Extension | MCP | Node.js | ONNX | better-sqlite3 |\n|-----------|-----|---------|------|----------------|\n| 1.17.0    | 0.7.0 | 20,22,24,25 | 1.18.0 | 12.10.0 |\n\n## Acceptance Criteria\n- DEPENDENCY-MATRIX.md created\n- Breaking changes documented\n- Upgrade paths documented",
  "labels": ["improvement", "documentation", "sprint-3"]
}
```

---

## Story 15: KSA-264 — Security Review Checklist

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Security Review Checklist",
  "priority": "High",
  "epicLink": "KSA-246",
  "storyPoints": 8,
  "sprint": "Sprint 3",
  "assignee": "Security, SA",
  "description": "## Review Areas\n- Credentials storage (Jira, MCP keys)\n- Agent prompt injection\n- MCP authentication\n- KB data isolation\n\n## Deliverables\n- SECURITY-REVIEW.md\n- Tickets for vulnerabilities found\n\n## Acceptance Criteria\n- All areas reviewed\n- Findings documented\n- Remediation tickets created",
  "labels": ["improvement", "security", "sprint-3"]
}
```

---

## Story 16: KSA-265 — Add SECURITY.md

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Add SECURITY.md",
  "priority": "High",
  "epicLink": "KSA-246",
  "storyPoints": 2,
  "sprint": "Sprint 3",
  "assignee": "Security, SM",
  "description": "## Sections\n- Supported Versions\n- Reporting a Vulnerability\n- Security Update Policy\n- Known Security Considerations\n\n## Tasks\n- [ ] Create SECURITY.md\n- [ ] Setup security email\n- [ ] Generate PGP key\n- [ ] Link from README\n\n## Acceptance Criteria\n- SECURITY.md published\n- Email setup\n- PGP key available",
  "labels": ["improvement", "security", "sprint-3"]
}
```

---

## Story 17: KSA-266 — Dependency Security Audit

```json
{
  "project": "KSA",
  "issueType": "Story",
  "summary": "Dependency Security Audit",
  "priority": "High",
  "epicLink": "KSA-246",
  "storyPoints": 5,
  "sprint": "Sprint 3",
  "assignee": "DevOps, Security",
  "description": "## Tasks\n- [ ] npm audit (all Node.js projects)\n- [ ] OWASP dependency check (Kotlin)\n- [ ] pip-audit (Python)\n- [ ] Fix HIGH/CRITICAL\n- [ ] Document MEDIUM with mitigation\n- [ ] CI weekly audit job\n\n## Acceptance Criteria\n- Zero HIGH/CRITICAL vulnerabilities\n- MEDIUM documented\n- CI job configured",
  "labels": ["improvement", "security", "sprint-3"]
}
```

---

## Summary

**Total Tickets**: 20  
- 4 Epics (KSA-246, KSA-247, KSA-248, KSA-249)
- 16 Stories (KSA-250 to KSA-266)

**Story Points**: 63 SP total
- Sprint 1: 15 SP
- Sprint 2: 24 SP  
- Sprint 3: 24 SP

**Timeline**: 6 weeks (Jan 8 - Feb 18, 2025)

---

**Created**: 2025-01-08  
**Ready for**: Jira import or manual creation

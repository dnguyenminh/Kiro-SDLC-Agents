# Sprint Board — Q1 2025 Improvements

**Project**: KSA (Kiro SDLC Agents)  
**Timeline**: 6 weeks (3 sprints × 2 weeks)  
**Team**: DEV (2), QA (1), DevOps (1), SA (1), Security (1), BA (1), UI (1)

---

## 📊 Sprint 1: Cleanup & Organization (Week 1-2)

**Goal**: Giảm noise, improve developer productivity  
**Capacity**: 15 story points  
**Start**: 2025-01-08 | **End**: 2025-01-21

### Backlog

| Ticket | Summary | Assignee | Estimate | Status |
|--------|---------|----------|----------|--------|
| KSA-250 | Reorganize Root-Level Scripts | DEV-1 | 3 SP | 🔵 To Do |
| KSA-251 | Add Code Intelligence Ignore Rules | DEV-1 | 2 SP | 🔵 To Do |
| KSA-252 | Cleanup Duplicate Modules | DEV-2 | 2 SP | 🔵 To Do |
| KSA-253 | Consolidate FSD Generation Scripts | DEV-2 | 5 SP | 🔵 To Do |
| KSA-254 | Dependency Audit & Version Lock | DevOps | 3 SP | 🔵 To Do |

### Daily Standup Questions

**What did you do yesterday?**
- DEV-1: ...
- DEV-2: ...
- DevOps: ...

**What will you do today?**
- DEV-1: ...
- DEV-2: ...
- DevOps: ...

**Any blockers?**
- None / [list blockers]

### Sprint 1 Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Root scripts moved | ≤5 remaining | ___ |
| Module count | 50 → 30 | ___ |
| Indexing time improvement | -30% | ___% |
| Dependency matrix documented | ✅ | ___ |

---

## 📊 Sprint 2: Quality Gates & Testing (Week 3-4)

**Goal**: 80% test coverage, automated testing pipeline  
**Capacity**: 20 story points (defer KSA-259 nếu over-capacity)  
**Start**: 2025-01-22 | **End**: 2025-02-04

### Backlog

| Ticket | Summary | Assignee | Estimate | Status |
|--------|---------|----------|----------|--------|
| KSA-255 | Add Coverage Reports (Kotlin) | DEV-1 | 3 SP | ⚪ Planned |
| KSA-256 | Add Coverage Reports (Node.js) | DEV-2 | 3 SP | ⚪ Planned |
| KSA-257 | Add Coverage Reports (Python) | DEV-1 | 2 SP | ⚪ Planned |
| KSA-258 | Integration Tests — Agent Pipeline | QA + DEV-2 | 8 SP | ⚪ Planned |
| KSA-259 | E2E Tests — KB UI Panels | QA + UI | 8 SP | ⚪ Stretch Goal |

**Note**: KSA-259 có thể rollover sang Sprint 3 nếu capacity không đủ.

### Sprint 2 Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Coverage badges in README | 3/3 (K, N, P) | ___ |
| Kotlin coverage | ≥80% line | ___% |
| Node.js coverage | ≥80% line | ___% |
| Python coverage | ≥80% line | ___% |
| Agent pipeline tests | Passing in CI | ___ |

---

## 📊 Sprint 3: Documentation & Security (Week 5-6)

**Goal**: Production-ready documentation, security compliance  
**Capacity**: 28 story points (prioritize security stories)  
**Start**: 2025-02-05 | **End**: 2025-02-18

### Backlog

| Ticket | Summary | Assignee | Estimate | Status |
|--------|---------|----------|----------|--------|
| KSA-260 | Architecture Decision Records | SA + SM | 5 SP | ⚪ Planned |
| KSA-261 | Steering File Versioning | SM + DEV-1 | 3 SP | ⚪ Planned |
| KSA-262 | Project Structure Documentation | BA + TA | 3 SP | ⚪ Planned |
| KSA-263 | Dependency Matrix Documentation | DevOps + TA | 2 SP | ⚪ Planned |
| KSA-264 | Security Review Checklist | Security + SA | 8 SP | ⚪ Planned |
| KSA-265 | Add SECURITY.md | Security + SM | 2 SP | ⚪ Planned |
| KSA-266 | Dependency Security Audit | DevOps + Security | 5 SP | ⚪ Planned |
| KSA-259* | E2E Tests — KB UI Panels (rollover) | QA + UI | 8 SP | ⚪ Optional |

**Priority**: Security stories (264-266) > ADRs (260) > Docs (261-263).

### Sprint 3 Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| ADRs published | 10 | ___ |
| Steering version | 1.0.0 | ___ |
| SECURITY.md published | ✅ | ___ |
| HIGH/CRITICAL vulnerabilities | 0 | ___ |
| PROJECT-STRUCTURE.md complete | ✅ | ___ |

---

## 📈 Cumulative Progress Tracking

### Burndown Chart (Manual Update)

**Sprint 1** (15 SP capacity):
```
Day  | Remaining SP | Notes
-----|-------------|-------
D1   | 15          | Sprint starts
D2   | 15          | Planning
D3   | 13          | KSA-251 done (2 SP)
D4   | 13          | -
D5   | 11          | KSA-252 done (2 SP)
D6-7 | Weekend     | -
D8   | 11          | -
D9   | 8           | KSA-250 done (3 SP)
D10  | 3           | KSA-254 done (5 SP)
D11  | 3           | Work continues on KSA-253
D12  | 0           | KSA-253 done (3 SP) ✅ Sprint complete
```

### Velocity Tracking

| Sprint | Planned SP | Completed SP | Velocity | Notes |
|--------|-----------|--------------|----------|-------|
| Sprint 1 | 15 | ___ | ___% | Target: 100% |
| Sprint 2 | 20 | ___ | ___% | Stretch: +KSA-259 |
| Sprint 3 | 28 | ___ | ___% | Focus: Security |
| **Total** | **63** | ___ | ___% | |

---

## 🎯 Risk Register

| Risk | Sprint | Owner | Status | Mitigation |
|------|--------|-------|--------|------------|
| Native binary compatibility breaks | 1 | DevOps | 🟡 Medium | CI test matrix before merge |
| Coverage target too aggressive (80%) | 2 | DEV-1 | 🟡 Medium | Start 70%, increase gradually |
| Security audit finds critical issues | 3 | Security | 🟢 Low | Buffer time allocated |
| Team velocity lower than estimated | All | SM | 🟡 Medium | Prioritize P0, defer P1 |
| ADR writing takes longer | 3 | SA | 🟢 Low | Use MADR template |

**Status legend**: 🟢 Low | 🟡 Medium | 🔴 High

---

## 📋 Sprint Ceremonies

### Sprint Planning (Every 2 weeks, Monday 9:00 AM)

**Agenda**:
1. Review previous sprint results (15 min)
2. Present new sprint backlog (15 min)
3. Team estimates stories (30 min)
4. Commit to sprint goal (10 min)
5. Assign stories (10 min)

**Attendees**: Entire team (8 people)  
**Duration**: 90 minutes  
**Output**: Sprint backlog committed

---

### Daily Standup (Every day, 9:30 AM)

**Format**: Round-robin, 2 min per person  
**Questions**:
1. What did you do yesterday?
2. What will you do today?
3. Any blockers?

**Attendees**: Entire team  
**Duration**: 15 minutes max  
**SM role**: Track blockers, update board

---

### Sprint Review (Every 2 weeks, Friday 3:00 PM)

**Agenda**:
1. Demo completed stories (30 min)
   - Show coverage badges
   - Demo integration tests
   - Walk through ADRs
2. Metrics review (15 min)
   - Burndown chart
   - Velocity
   - Quality metrics
3. Stakeholder feedback (15 min)

**Attendees**: Team + stakeholders  
**Duration**: 60 minutes  
**Output**: Acceptance/feedback

---

### Sprint Retrospective (Every 2 weeks, Friday 4:00 PM)

**Agenda**:
1. What went well? (15 min)
2. What didn't go well? (15 min)
3. Action items for next sprint (10 min)

**Format**: Start/Stop/Continue  
**Attendees**: Team only (no stakeholders)  
**Duration**: 40 minutes  
**Output**: Action items for next sprint

---

## 📞 Communication Plan

### Daily
- **Standup**: 9:30 AM (15 min)
- **Slack updates**: Blockers immediately
- **PR reviews**: Within 24h

### Weekly
- **Monday**: Sprint planning (if new sprint)
- **Wednesday**: Mid-sprint check-in (async Slack post)
- **Friday**: Sprint review + retro (if sprint end)

### Ad-hoc
- **Blockers**: Tag @SM in Slack immediately
- **Dependencies**: Coordinate directly with assignee
- **Questions**: Use team channel, not DMs

---

## 🛠️ Tools & Access

| Tool | Purpose | Access |
|------|---------|--------|
| **Jira** | Ticket tracking | All team members |
| **GitHub** | Code, PRs, CI | All developers |
| **Slack** | Communication | #ksa-improvements channel |
| **Codecov** | Coverage reports | DevOps, DEV leads |
| **Confluence** | Documentation | All team members |

---

## 📊 Definition of Done (DoD)

### Story Level

- [ ] Code written and reviewed (2 approvals)
- [ ] Tests written (unit + integration if applicable)
- [ ] Coverage ≥80% (for code changes)
- [ ] Documentation updated (README, CHANGELOG)
- [ ] CI passing (build + tests)
- [ ] Deployed to dev environment (if applicable)
- [ ] Acceptance criteria met
- [ ] SM verified output

### Sprint Level

- [ ] All committed stories done (or moved to next sprint with justification)
- [ ] Sprint goal achieved
- [ ] No HIGH/CRITICAL bugs introduced
- [ ] Metrics targets met (see sprint success metrics)
- [ ] Documentation updated
- [ ] Demo prepared for review

---

## 📈 Weekly Status Report Template

**Week of**: [Date]  
**Sprint**: Sprint 1/2/3  
**SM**: [Your Name]

### Highlights
- ✅ Completed: [list tickets]
- 🚧 In Progress: [list tickets]
- ⚠️ Blocked: [list blockers]

### Metrics
- **Velocity**: X SP completed / Y SP planned = Z%
- **Burndown**: [on track / behind / ahead]
- **Quality**: [coverage %, vulnerabilities count]

### Risks & Issues
- [List any new risks or unresolved issues]

### Next Week Focus
- [Key priorities for next week]

---

## 🎯 Q1 2025 North Star Metrics

| Metric | Baseline | Target | Actual |
|--------|----------|--------|--------|
| Code indexing time | X sec | -30% | ___ |
| Module count | 50 | 30 | ___ |
| Test coverage (Kotlin) | Unknown | ≥80% | ___% |
| Test coverage (Node.js) | Unknown | ≥80% | ___% |
| Test coverage (Python) | Unknown | ≥80% | ___% |
| ADRs published | 0 | 10 | ___ |
| HIGH/CRITICAL vulnerabilities | Unknown | 0 | ___ |
| Steering file version | None | 1.0.0 | ___ |

**Dashboard**: Update weekly trong team standup.

---

**Created**: 2025-01-08  
**Owner**: SM Agent  
**Last Updated**: 2025-01-08  
**Next Review**: Sprint 1 Retrospective

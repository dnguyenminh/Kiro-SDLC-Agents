# Sprint Board Template — Q1 2025 Improvements

## Sprint 1: Cleanup & Organization (Week 1-2)

### Sprint Goal
🎯 **Giảm noise trong codebase, improve developer productivity +30%, code indexing time -30%**

### Sprint Backlog

| ID | Story | Assignee | Estimate | Status | Blocker |
|----|-------|----------|----------|--------|---------|
| KSA-250 | Reorganize Root-Level Scripts | DEV | 3 SP | 🔵 To Do | - |
| KSA-251 | Add Code Intelligence Ignore Rules | DEV | 2 SP | 🔵 To Do | - |
| KSA-252 | Cleanup Duplicate Modules | DEV | 2 SP | 🔵 To Do | - |
| KSA-253 | Consolidate FSD Generation Scripts | DEV | 5 SP | 🔵 To Do | - |
| KSA-254 | Dependency Audit & Version Lock | DevOps | 3 SP | 🔵 To Do | - |
| **Total** | | | **15 SP** | | |

### Daily Standup Template

**What I did yesterday:**
- ...

**What I'm doing today:**
- ...

**Blockers:**
- ...

**Dependencies:**
- KSA-251 depends on KSA-250 (paths changed)
- KSA-253 depends on KSA-250 (scripts moved)

---

### Sprint Ceremonies

#### Sprint Planning (Day 1 - Monday Week 1)
- **Time**: 10:00 AM - 12:00 PM (2 hours)
- **Attendees**: SM, DEV, DevOps, SA, QA
- **Agenda**:
  1. Review Sprint Goal (15 min)
  2. Review stories (30 min)
  3. Break down tasks (45 min)
  4. Commitment (15 min)
  5. Dependencies discussion (15 min)

#### Daily Standup (Every day 9:00 AM)
- **Time**: 15 minutes max
- **Format**: What/What/Blockers
- **SM tracks**: Blockers, dependencies

#### Sprint Review (Day 10 - Friday Week 2)
- **Time**: 2:00 PM - 3:00 PM (1 hour)
- **Attendees**: SM, Team, Stakeholders
- **Agenda**:
  1. Demo: New directory structure (5 min)
  2. Demo: Indexing performance (before/after) (10 min)
  3. Demo: .code-intel/ignore file (5 min)
  4. Demo: Consolidated FSD generator (10 min)
  5. Demo: Dependency matrix (5 min)
  6. Metrics review (10 min)
  7. Q&A (15 min)

#### Sprint Retrospective (Day 10 - Friday Week 2)
- **Time**: 3:30 PM - 4:30 PM (1 hour)
- **Attendees**: SM, Team (no stakeholders)
- **Agenda**:
  1. What went well? (15 min)
  2. What didn't go well? (15 min)
  3. Action items for Sprint 2 (20 min)
  4. Appreciation round (10 min)

---

### Definition of Done (Sprint 1)

#### Story Level
- [ ] Code changes committed
- [ ] README/docs updated
- [ ] No broken references
- [ ] Peer reviewed (1 approval minimum)
- [ ] Verified functionality still works

#### Sprint Level
- [ ] All P0 stories completed
- [ ] Root directory có ≤5 script files
- [ ] Module count: 50 → ~30 (-40%)
- [ ] Indexing time improvement ≥30%
- [ ] Dependency matrix documented
- [ ] Sprint Review completed
- [ ] Retrospective action items logged

---

### Sprint Metrics Dashboard

#### Burndown Chart (Update Daily)
```
15 SP ┤ ●
      │  ╲
      │   ●
      │    ╲
      │     ●
      │      ╲
      │       ●
      │        ╲___
 0 SP └──────────────●
      D1  D3  D5  D7  D10
```

#### Velocity Tracking
- **Planned**: 15 SP
- **Committed**: 15 SP
- **Completed**: ___ SP (update at end)
- **Velocity**: ___ SP/sprint

#### Quality Metrics
- **PR Review Time**: Target <24h
  - Day 1-5 average: ___ hours
  - Day 6-10 average: ___ hours
- **Build Success Rate**: Target 100%
  - Current: ___ %
- **Blockers**: Target 0
  - Current: ___ blockers

---

## Sprint 2: Quality Gates & Testing (Week 3-4)

### Sprint Goal
🎯 **Achieve 80% test coverage với automated CI badges, agent pipeline integration tests passing**

### Sprint Backlog

| ID | Story | Assignee | Estimate | Status | Blocker |
|----|-------|----------|----------|--------|---------|
| KSA-255 | Coverage Reports (Kotlin) | DEV | 3 SP | 🔵 To Do | - |
| KSA-256 | Coverage Reports (Node.js) | DEV | 3 SP | 🔵 To Do | - |
| KSA-257 | Coverage Reports (Python) | DEV | 2 SP | 🔵 To Do | - |
| KSA-258 | Integration Tests — Agent Pipeline | QA + DEV | 8 SP | 🔵 To Do | - |
| KSA-259 | E2E Tests — KB UI Panels | QA + UI | 8 SP | 🔵 To Do | (Rollover to Sprint 3 if needed) |
| **Total** | | | **24 SP** | | |

### Capacity Planning

**Issue**: 24 SP > typical 15-20 SP velocity

**Mitigation**:
1. **Prioritize P0**: KSA-255, KSA-256, KSA-257, KSA-258 = 16 SP
2. **KSA-259 (8 SP)** can rollover to Sprint 3
3. **Parallel work**: DEV on coverage, QA on tests simultaneously

### Dependencies
- KSA-258 needs KSA-255/256/257 setup (test infrastructure)
- KSA-259 independent, can be done parallel

---

### Definition of Done (Sprint 2)

#### Story Level
- [ ] Coverage threshold configured (80%)
- [ ] Badge added to README
- [ ] CI job passing
- [ ] Tests written and passing
- [ ] Code reviewed

#### Sprint Level
- [ ] Kotlin coverage ≥80%
- [ ] Node.js coverage ≥80%
- [ ] Python coverage ≥80%
- [ ] Agent pipeline tests passing in CI
- [ ] All coverage badges visible in READMEs

---

## Sprint 3: Documentation & Security (Week 5-6)

### Sprint Goal
🎯 **Production-ready documentation (10 ADRs), zero HIGH/CRITICAL vulnerabilities**

### Sprint Backlog

| ID | Story | Assignee | Estimate | Status | Blocker |
|----|-------|----------|----------|--------|---------|
| KSA-260 | Architecture Decision Records | SA + SM | 5 SP | 🔵 To Do | - |
| KSA-261 | Steering File Versioning | SM + DEV | 3 SP | 🔵 To Do | - |
| KSA-262 | Project Structure Docs | BA + TA | 3 SP | 🔵 To Do | - |
| KSA-263 | Dependency Matrix Docs | DevOps + TA | 2 SP | 🔵 To Do | - |
| KSA-264 | Security Review Checklist | Security + SA | 8 SP | 🔵 To Do | - |
| KSA-265 | Add SECURITY.md | Security + SM | 2 SP | 🔵 To Do | Depends on KSA-264 |
| KSA-266 | Dependency Security Audit | DevOps + Security | 5 SP | 🔵 To Do | - |
| KSA-259* | E2E Tests — KB UI (Rollover) | QA + UI | 8 SP | 🔵 To Do | (From Sprint 2) |
| **Total** | | | **36 SP** | | |

### Capacity Planning

**Issue**: 36 SP >> typical velocity

**Mitigation**:
1. **Critical Path**: KSA-264 → KSA-265 (security)
2. **Parallel streams**:
   - Stream 1 (Docs): KSA-260, KSA-261, KSA-262, KSA-263 = 13 SP
   - Stream 2 (Security): KSA-264, KSA-265, KSA-266 = 15 SP
   - Stream 3 (Testing): KSA-259 = 8 SP
3. **Extend to Week 7 if needed** for docs completion

### Dependencies
- KSA-265 depends on KSA-264 (security review findings)
- Others independent

---

### Definition of Done (Sprint 3)

#### Story Level
- [ ] Documentation published
- [ ] Security issues addressed
- [ ] Vulnerability count = 0 (HIGH/CRITICAL)
- [ ] Code reviewed
- [ ] Stakeholder approval (for security docs)

#### Sprint Level
- [ ] 10 ADRs published
- [ ] Steering files versioned (v1.0.0)
- [ ] SECURITY.md published
- [ ] Zero HIGH/CRITICAL vulnerabilities
- [ ] PROJECT-STRUCTURE.md complete
- [ ] DEPENDENCY-MATRIX.md complete

---

## Cross-Sprint Tracking

### Epic Progress

| Epic | Total SP | Sprint 1 | Sprint 2 | Sprint 3 | Status |
|------|----------|----------|----------|----------|--------|
| KSA-249: Cleanup | 15 SP | 15 SP | - | - | 🔵 To Do |
| KSA-248: Quality | 24 SP | - | 24 SP | - | 🔵 To Do |
| KSA-247: Docs | 13 SP | - | - | 13 SP | 🔵 To Do |
| KSA-246: Security | 15 SP | - | - | 15 SP | 🔵 To Do |
| **Total** | **67 SP** | 15 SP | 24 SP | 28 SP | |

*(Note: Sprint 3 excludes KSA-259 rollover)*

---

## Communication Plan

### Daily Communication

#### Standup (9:00 AM Daily)
- **Platform**: Slack #ksa-standup or Zoom
- **Duration**: 15 minutes strict
- **Format**: Round-robin, each person:
  1. What I did yesterday (30 sec)
  2. What I'm doing today (30 sec)
  3. Blockers (30 sec)
- **SM logs**: Blockers → track in Jira

#### Blockers Resolution
- **If blocker raised**: SM creates separate meeting within 2 hours
- **Participants**: Only people involved in blocker
- **Duration**: 30 min max
- **Outcome**: Action items logged

---

### Weekly Communication

#### Progress Update (Friday 4:00 PM)
- **Platform**: Email + Slack #ksa-updates
- **Recipients**: Team + Stakeholders
- **Format**:
  ```
  📊 KSA Project Update — Week X/Y
  
  ✅ Completed this week:
  - KSA-250: Reorganized scripts (DONE)
  - KSA-251: Code intel ignore rules (DONE)
  
  🔄 In Progress:
  - KSA-253: FSD consolidation (70% done, on track)
  
  ⚠️ Blockers:
  - KSA-254: Waiting for DevOps env setup (2 days delay)
  
  📈 Metrics:
  - Velocity: 8/15 SP completed
  - Coverage: Kotlin 75% (target 80%)
  
  🎯 Next week:
  - Complete Sprint 1 stories
  - Start Sprint 2 planning
  ```

---

### Sprint Ceremonies Communication

#### Sprint Planning Prep (Friday before sprint)
- **SM sends**: 
  - Sprint goal draft
  - Story list với acceptance criteria
  - Dependencies diagram
- **Team reviews**: Before Monday planning meeting

#### Sprint Review Invite (3 days before)
- **Calendar invite**: Review + Demo
- **Attachments**: 
  - Sprint metrics snapshot
  - Demo script
  - Feature preview video (if applicable)

#### Retrospective
- **Anonymous feedback**: Google Form sent 1 day before
- **Topics**: What went well, what to improve, action items
- **SM prepares**: Summary of feedback for discussion

---

## Risk Communication

### Escalation Path

| Level | When to Escalate | Who | Response Time |
|-------|------------------|-----|---------------|
| 🟢 **L1**: Minor blocker | Story delayed <1 day | SM | Same day |
| 🟡 **L2**: Sprint risk | Story delayed 2-3 days | SM + SA | Within 4 hours |
| 🔴 **L3**: Epic risk | Sprint goal at risk | SM + Stakeholders | Within 2 hours |
| ⚫ **L4**: Project risk | Multiple epics blocked | SM + Leadership | Immediate |

### Example Escalations

**L1**: "KSA-251 blocked — waiting for code intel docs. SM to ping doc owner."

**L2**: "KSA-253 taking longer than estimated (3 SP → 5 SP). Risk to Sprint 1 completion. Need SA review tomorrow."

**L3**: "Sprint 2 velocity 10 SP after Week 1 (target 24 SP). Agent pipeline tests more complex than estimated. Need to descope KSA-259 to Sprint 3."

**L4**: "Security audit (KSA-264) found CRITICAL vulnerability. All feature work paused. Emergency patch required. Leadership approval needed for timeline shift."

---

## Tools & Artifacts

### Jira Board Setup

**Columns**:
1. 🔵 **To Do** — Sprint backlog
2. 🟡 **In Progress** — Active work (WIP limit: 3 per person)
3. 🟣 **In Review** — PR open, waiting approval
4. 🟢 **Done** — Merged, DoD met

**Swim Lanes**:
- By Epic (KSA-249, KSA-248, KSA-247, KSA-246)
- Or by Assignee (DEV, QA, DevOps, SA, Security)

### Labels
- `P0-critical`, `P1-high`, `P2-medium`
- `blocked`, `needs-review`, `tech-debt`
- `sprint-1`, `sprint-2`, `sprint-3`

---

### Slack Channels

- `#ksa-standup` — Daily standups
- `#ksa-updates` — Weekly progress, announcements
- `#ksa-dev` — Technical discussions
- `#ksa-blockers` — Urgent blockers only
- `#ksa-random` — Team bonding, non-work chat

---

### Documentation

**Confluence/Wiki Structure**:
```
KSA Project Home
├── Q1 2025 Improvement Plan
├── Sprint Boards
│   ├── Sprint 1 Board
│   ├── Sprint 2 Board
│   └── Sprint 3 Board
├── ADRs (Architecture Decision Records)
├── Meeting Notes
│   ├── Sprint Planning Notes
│   ├── Sprint Review Notes
│   └── Retrospective Notes
└── Metrics Dashboard
```

---

## Success Tracking

### Weekly Review Questions

1. **Velocity**: Are we on track? (Actual SP vs Planned SP)
2. **Quality**: Are tests passing? Coverage increasing?
3. **Blockers**: Any unresolved blockers >24h?
4. **Morale**: Team sentiment (😊 😐 😞)?
5. **Scope**: Any scope creep? Stories added mid-sprint?

### Sprint Health Score

**Formula**: 
```
Health Score = (Velocity % × 0.4) + (Quality % × 0.3) + (Blocker Resolve % × 0.2) + (Morale × 0.1)
```

**Example**:
- Velocity: 80% (12/15 SP) → 0.8 × 0.4 = 0.32
- Quality: 90% (coverage, tests) → 0.9 × 0.3 = 0.27
- Blockers: 100% (0 blockers) → 1.0 × 0.2 = 0.20
- Morale: 80% (team survey) → 0.8 × 0.1 = 0.08
- **Total Health Score**: 0.87 (87%) ✅ Healthy

**Thresholds**:
- **≥80%**: 🟢 Healthy
- **60-79%**: 🟡 At Risk
- **<60%**: 🔴 Critical

---

## Retrospective Action Items Template

### Sprint 1 Retrospective (Example)

**What went well**:
- ✅ Clear story definitions
- ✅ Fast PR reviews (<12h average)
- ✅ Good collaboration between DEV and DevOps

**What didn't go well**:
- ⚠️ KSA-253 underestimated (3 SP → 5 SP actual)
- ⚠️ Dependency on external docs caused 1-day delay

**Action items for Sprint 2**:
- [ ] Add buffer (+20%) to estimates for complex refactoring
- [ ] Pre-verify all external dependencies before sprint start
- [ ] Pair programming for complex stories

**Appreciation**:
- 👏 DEV for fast turnaround on KSA-250
- 👏 DevOps for setting up CI pipeline ahead of schedule

---

**Document version**: 1.0  
**Last updated**: 2025-01-08  
**Owner**: SM Agent  
**Team**: DEV, QA, DevOps, SA, Security, UI, BA, TA

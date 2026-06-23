# Software Test Cases (STC)

## FEC CR Builder — KSA-254: Chat Panel: Slash Command Menu

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-254 |
| Title | Chat Panel: Slash Command Menu (Agents + Steering Rules) |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-15 |
| Status | Draft |
| Related STP | STP-v1-KSA-254.docx |
| Related FSD | FSD-v1-KSA-254.docx |

---

## Test Case Summary

| Level | ID Range | Count |
|-------|----------|-------|
| PBT (Property-Based) | PBT-01..PBT-12 | 12 |
| UT (Unit) | UT-01..UT-30 | 30 |
| IT (Integration) | IT-01..IT-15 | 15 |
| E2E-UI | E2E-01..E2E-06 | 6 |
| SIT | SIT-01..SIT-04 | 4 |
| **Total** | | **67** |

---

## 1. Property-Based Tests (PBT)

| ID | Property | Requirement | Generator | Runs |
|----|----------|-------------|-----------|------|
| PBT-01 | Additional chars only narrow results (subset) | BR-12 | string x2 | 500 |
| PBT-02 | Empty query returns all items | BR-12 | N/A | 1 |
| PBT-03 | Filter is case-insensitive | BR-13 | alpha string | 300 |
| PBT-04 | Filtered count never exceeds total | BR-12 | any string | 500 |
| PBT-05 | Filter completes in < 16ms | NFR | any string | 200 |
| PBT-06 | DISMISS from OPEN/FILTERING -> CLOSED | BR-22 | states | 1 |
| PBT-07 | Random trigger sequences -> valid state | Safety | trigger array | 1000 |
| PBT-08 | Undefined transitions stable (no-op) | Safety | all combos | 1 |
| PBT-09 | CLOSED reachable from every state via DISMISS | BR-22 | states | 1 |
| PBT-10 | Position 0 always valid trigger | BR-01 | any text | 200 |
| PBT-11 | After whitespace always valid | BR-01 | prefix + ws | 300 |
| PBT-12 | After non-whitespace always invalid | BR-05 | alphanum | 300 |

**File:** `src/webview/__tests__/slash-menu.pbt.test.ts`

---

## 2. Unit Tests (UT)

| ID | Test | Requirement | Expected Result |
|----|------|-------------|-----------------|
| UT-01 | 6 agents defined | BR-07 | SLASH_AGENTS.length === 6 |
| UT-02 | Each agent has required fields | BR-07 | id, icon, label, agentName, description |
| UT-03 | Agents sorted alphabetically | BR-07 | qa < sa < security < sm < ta < ui |
| UT-04 | agentsToMenuItems maps correctly | TDD 2.1 | itemType=agent, id=agent-{x} |
| UT-05 | parseSteeringRules creates structure | BR-09 | icon=compass, name, file |
| UT-06 | steeringToMenuItems converts | BR-09 | itemType=steering, id=steering-{name} |
| UT-07 | Empty rules returns empty | BR-10 | length === 0 |
| UT-08 | Empty filter returns all | BR-12 | agents=6, steering=3 |
| UT-09 | "qa" matches QA Agent only | BR-12 | agents=1, steering=0 |
| UT-10 | "s" matches SA,SM,Security + sm-core | BR-12 | agents>=3, steering>=1 |
| UT-11 | "draw" matches drawio | BR-12 | agents=0, steering=1 |
| UT-12 | "agent" matches all 6 | BR-12 | agents=6 |
| UT-13 | "xyz" matches nothing | BR-15 | agents=0, steering=0 |
| UT-14 | Case-insensitive | BR-13 | "QA"==="qa" counts |
| UT-15 | Matches agentName field | BR-12 | "security-agent" -> 1 |
| UT-16 | CLOSED->OPEN on SLASH_TYPED | State | OPEN |
| UT-17 | OPEN->FILTERING on CHAR_TYPED | State | FILTERING |
| UT-18 | OPEN->CLOSED on DISMISS | BR-22 | CLOSED |
| UT-19 | OPEN->CLOSED on AGENT_SELECTED | BR-24 | CLOSED |
| UT-20 | OPEN->CLOSED on STEERING_SELECTED | BR-28 | CLOSED |
| UT-21 | FILTERING->OPEN on FILTER_CLEARED | BR-17 | OPEN |
| UT-22 | FILTERING->CLOSED on DISMISS | BR-22 | CLOSED |
| UT-23 | Undefined transitions no-op | Safety | same state |
| UT-24 | "/" at position 0 valid | BR-01 | true |
| UT-25 | "/" after space valid | BR-01 | true |
| UT-26 | "/" after tab valid | BR-01 | true |
| UT-27 | "/" after newline valid | BR-01 | true |
| UT-28 | "/" mid-word invalid | BR-05 | false |
| UT-29 | "/" after letter invalid | BR-05 | false |
| UT-30 | "/" after number invalid | BR-05 | false |

**File:** `src/webview/__tests__/slash-menu.unit.test.ts`

---

## 3. Integration Tests (IT)

**Technique:** vitest + jsdom. Real Controller+View with DOM manipulation.

| ID | Test | Requirement | Technique | Expected |
|----|------|-------------|-----------|----------|
| IT-01 | open() creates #slash-command-popup | UC-01 | jsdom DOM check | element in container |
| IT-02 | close() removes DOM, state=CLOSED | BR-22 | jsdom | no popup, state CLOSED |
| IT-03 | Agents section header + 6 items | BR-06,07 | jsdom query | header + 6 items |
| IT-04 | Steering section header + N items | BR-09 | jsdom query | header + N items |
| IT-05 | ARIA attributes correct | NFR | jsdom attr check | role=listbox,option |
| IT-06 | filter("qa") -> 1 agent in DOM | BR-12 | jsdom | 1 item visible |
| IT-07 | filter("xyz") -> empty state | BR-15 | jsdom | .context-menu-empty |
| IT-08 | filter("") restores all | BR-12 | jsdom | all items back |
| IT-09 | ArrowDown crosses section boundary | BR-18,20 | keyboard event | highlight moves |
| IT-10 | ArrowUp wraps first->last | BR-19 | keyboard event | highlight=last |
| IT-11 | ArrowDown wraps last->first | BR-18 | keyboard event | highlight=0 |
| IT-12 | Enter on agent -> onAgentSelect | BR-24 | callback spy | called with name |
| IT-13 | After agent select state=CLOSED | BR-24 | state check | CLOSED, DOM clean |
| IT-14 | Enter on steering -> onSteeringSelect | BR-28 | callback spy | called with rule |
| IT-15 | After steering select state=CLOSED | BR-28 | state check | CLOSED, DOM clean |

**File:** `src/webview/__tests__/slash-menu.integration.test.ts`

---

## 4. E2E-UI Tests (Manual)

| ID | Scenario | Steps | Expected | Priority |
|----|----------|-------|----------|----------|
| E2E-01 | Trigger detection | Type "/" at pos 0, after space, mid-word | Popup shows/hides correctly | High |
| E2E-02 | Two-section display | Type "/" see both sections | AGENTS + STEERING visible | High |
| E2E-03 | Type-ahead filter | "/qa", "/draw", "/xyz" | Correct filtering | High |
| E2E-04 | Keyboard navigation | ArrowUp/Down/Enter/Escape | Navigate, select, dismiss | High |
| E2E-05 | Agent selection | Select SA Agent | "/sa-agent " in textarea | High |
| E2E-06 | Steering selection | Select drawio | Chip "drawio" added | High |

---

## 5. SIT Tests (Manual)

| ID | Scenario | Steps | Expected | Priority |
|----|----------|-------|----------|----------|
| SIT-01 | Visual across themes | Light/Dark/HC | Proper contrast, readable | Medium |
| SIT-02 | Keyboard-only flow | No mouse, full workflow | All operations accessible | High |
| SIT-03 | Screen reader | NVDA/JAWS announcements | Items announced correctly | Medium |
| SIT-04 | axe audit | Run axe on open popup | 0 Critical violations | Medium |

---

## 6. Test Data

### Agents (static, built-in)

| agentName | Used In |
|-----------|---------|
| qa-agent | UT-09, IT-06, E2E-03 |
| sa-agent | E2E-05 |
| security-agent | UT-15 |
| sm-agent | UT-10 |
| ta-agent | General |
| ui-agent | General |

### Steering Rules (mock fixtures)

| Name | File | Used In |
|------|------|---------|
| drawio | drawio.md | UT-11, E2E-03, E2E-06 |
| sm-core | sm-core.md | UT-10 |
| concise-responses | concise-responses.md | UT fixture |
| phase-1-requirements | phase-1-requirements.md | PBT fixture |

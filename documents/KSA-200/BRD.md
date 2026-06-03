# Business Requirements Document (BRD)

## Kiro SDLC Agents — KSA-200: Agent Pipeline Architecture Upgrade - Harness-inspired Patterns

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-200 |
| Title | Agent Pipeline Architecture Upgrade - Harness-inspired Patterns |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SM Agent – Scrum Master | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | BA Agent | Initiate document — auto-generated from Jira Epic KSA-200 and child tasks KSA-201, KSA-202, KSA-204, KSA-205 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Nâng cấp kiến trúc agent pipeline của hệ thống Kiro SDLC Agents, lấy cảm hứng từ project [revfactory/harness](https://github.com/revfactory/harness). Mục tiêu chính:

1. **Modularize SM Agent Prompt** — Tách monolithic SM agent prompt (~2000+ lines) thành các steering files nhỏ, có thể load theo context (giảm token consumption)
2. **Parallel Execution (Fan-out Pattern)** — Cho phép các SDLC phases độc lập chạy song song thay vì tuần tự
3. **Architecture Pattern Selection** — Thêm khả năng SM agent tự chọn architecture pattern phù hợp cho từng project/ticket
4. **Progressive Disclosure** — Agent prompts chỉ load thông tin cần thiết cho phase hiện tại, không load toàn bộ pipeline

### 1.2 Out of Scope

- Thay đổi core logic của từng sub-agent (BA, SA, QA, DEV, DevOps)
- Migration sang platform khác (vẫn dùng Kiro IDE)
- Thay đổi Jira integration workflow
- Thay đổi document templates (BRD, FSD, TDD format giữ nguyên)
- Performance optimization của KB (Knowledge Base) tools

### 1.3 Preliminary Requirement

- Hệ thống Kiro SDLC Agents hiện tại đang hoạt động ổn định
- SM agent prompt hiện tại đã được document đầy đủ
- Kiro IDE hỗ trợ steering files (.kiro/steering/)
- Kiro IDE hỗ trợ sub-agent invocation (invokeSubAgent)
- Access vào revfactory/harness repository để reference patterns

---

## 2. Business Requirements

### 2.1 High Level Process Map

Hiện tại SM agent sử dụng 1 monolithic prompt (~2000+ lines) chứa toàn bộ SDLC pipeline logic. Mỗi lần invoke, toàn bộ prompt được load vào context window, gây:
- Token waste (load Phase 7 info khi đang ở Phase 1)
- Context window pressure (giảm space cho actual work)
- Khó maintain và update (1 file lớn)
- Không thể parallel execution (sequential by design)

**Target Architecture:**
- SM prompt tách thành core orchestrator + phase-specific steering files
- Independent phases có thể fan-out (parallel execution)
- SM tự chọn architecture pattern dựa trên project characteristics
- Mỗi agent chỉ nhận thông tin cần thiết cho task hiện tại

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case / Epic | Priority | Source Ticket |
|---|-------------------------|----------|---------------|
| 1 | As a SM agent, I want my prompt split into modular steering files so that I consume fewer tokens per invocation | MUST HAVE | KSA-201 |
| 2 | As a SM agent, I want to execute independent SDLC phases in parallel so that pipeline completion time is reduced | SHOULD HAVE | KSA-202 |
| 3 | As a SM agent, I want to select architecture patterns based on project type so that I can apply the most appropriate workflow | SHOULD HAVE | KSA-204 |
| 4 | As a SM agent, I want progressive disclosure in prompts so that each agent only receives context relevant to its current task | MUST HAVE | KSA-205 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User invokes SM agent với ticket key (e.g., `KSA-200 tạo BRD`)

**Step 2:** SM core orchestrator loads — chỉ chứa routing logic, status management, và phase detection

**Step 3:** SM xác định current phase cần thực hiện (e.g., Phase 1 - Requirements)

**Step 4:** SM loads phase-specific steering file (e.g., `phase-1-requirements.md`) — chỉ load khi cần

**Step 5:** SM kiểm tra có phases nào có thể chạy parallel không (fan-out check)

**Step 6:** Nếu có parallel opportunities → fan-out execution; nếu không → sequential execution

**Step 7:** SM chọn architecture pattern phù hợp (nếu chưa chọn) dựa trên project characteristics

**Step 8:** SM invoke sub-agent với progressive disclosure — chỉ truyền context cần thiết cho task

**Step 9:** Sub-agent hoàn thành → SM collect results → fan-in (nếu parallel) → advance pipeline

> **Note:** Fan-out chỉ áp dụng cho phases thực sự independent. Ví dụ: Phase 4 (Test Planning) có thể chạy parallel với Phase 5 (Implementation) vì QA không cần code để viết test plan.

---

#### STORY 1: Modularize SM Agent Prompt into Steering Files

> As a SM agent, I want my prompt split into modular steering files so that I consume fewer tokens per invocation

**Requirement Details:**

1. Tách SM agent prompt hiện tại (~2000+ lines) thành các steering files riêng biệt
2. Core orchestrator file chỉ chứa: routing logic, status management, phase detection, quality gates
3. Mỗi phase có steering file riêng: `phase-{N}-{name}.md`
4. Shared utilities (error handling, Jira transitions, document attachment) thành separate files
5. SM chỉ load steering file cần thiết cho current phase (lazy loading)
6. Tổng token consumption giảm ≥40% so với monolithic prompt

**File Structure (Target):**

| File | Content | Load Condition |
|------|---------|----------------|
| `sm-core.md` | Routing, status, phase detection | Always |
| `phase-1-requirements.md` | BRD creation workflow | Phase 1 active |
| `phase-2-specification.md` | FSD creation workflow (BA+TA) | Phase 2 active |
| `phase-3-design.md` | TDD creation, feedback loop | Phase 3 active |
| `phase-4-test-planning.md` | STP/STC creation, SM review | Phase 4 active |
| `phase-5-implementation.md` | DEV workflow, git, code review | Phase 5 active |
| `phase-6-testing.md` | QA execution, test quality review | Phase 6 active |
| `phase-7-deployment.md` | DevOps, release process | Phase 7 active |
| `shared-jira.md` | Jira transitions, comments, attachments | When Jira interaction needed |
| `shared-quality-gates.md` | Document verification checklists | After each phase |
| `shared-diagrams.md` | Diagram requirements per document | When creating documents |

**Acceptance Criteria:**

1. SM agent hoạt động đúng như hiện tại (no regression) sau khi tách modular
2. Token consumption giảm ≥40% cho single-phase operations
3. Mỗi steering file ≤500 lines (manageable size)
4. Core orchestrator ≤300 lines
5. Tất cả existing test cases vẫn pass
6. Steering files có thể update independently mà không ảnh hưởng phases khác

---

#### STORY 2: Implement Parallel Execution for Independent SDLC Phases (Fan-out Pattern)

> As a SM agent, I want to execute independent SDLC phases in parallel so that pipeline completion time is reduced

**Requirement Details:**

1. Identify phases có thể chạy parallel (dependency analysis)
2. Implement fan-out pattern: SM dispatch multiple sub-agents simultaneously
3. Implement fan-in pattern: SM collect results từ parallel agents, merge, validate
4. Error handling: nếu 1 parallel branch fails, không block các branches khác
5. Status tracking: STATUS.json support parallel phase states

**Parallel Opportunities Identified:**

| Parallel Group | Phases | Condition |
|---------------|--------|-----------|
| Group A | Phase 4 (Test Planning) ∥ Phase 5 (Implementation) | Both depend on TDD, independent of each other |
| Group B | Phase 5.5 (User Guide) ∥ Phase 6 (Testing) | UG depends on code, Testing depends on code — but independent of each other |
| Group C | BRD diagrams ∥ BRD text | Within Phase 1, diagram generation independent of text |

**Fan-out/Fan-in Pattern:**

```
SM detects parallel opportunity
  → Fan-out: invoke agent-A, invoke agent-B simultaneously
  → Wait: both complete (or timeout)
  → Fan-in: collect results, validate consistency
  → Advance: next phase
```

**Acceptance Criteria:**

1. SM correctly identifies parallel opportunities based on dependency graph
2. Fan-out execution reduces total pipeline time by ≥25% (for applicable phases)
3. Fan-in correctly merges results and detects conflicts
4. If one parallel branch fails, other branches continue (graceful degradation)
5. STATUS.json correctly tracks parallel phase states
6. No data corruption when multiple agents write to same ticket folder simultaneously
7. Rollback mechanism: if fan-in detects inconsistency, can re-run individual branch

---

#### STORY 3: Add Architecture Pattern Selection to SM Agent

> As a SM agent, I want to select architecture patterns based on project type so that I can apply the most appropriate workflow

**Requirement Details:**

1. Define architecture pattern catalog (inspired by Harness patterns)
2. SM analyzes project/ticket characteristics to select appropriate pattern
3. Pattern selection influences: agent prompts, quality gates, document depth, diagram types
4. Patterns can be overridden by user preference

**Architecture Pattern Catalog:**

| Pattern | When to Use | Pipeline Adjustments |
|---------|-------------|---------------------|
| `microservice` | Distributed system, multiple services | Extra: API contract review, service interaction diagrams |
| `monolith` | Single deployable unit | Simplified: fewer integration diagrams |
| `library` | Reusable package/SDK | Focus: API design, versioning, backward compatibility |
| `cli-tool` | Command-line application | Focus: UX flow, argument parsing, output format |
| `plugin` | Extension/plugin for existing system | Focus: Integration points, host system constraints |
| `data-pipeline` | ETL, data processing | Focus: Data flow, error recovery, idempotency |
| `ai-agent` | AI/ML agent system | Focus: Prompt engineering, tool integration, context management |

**Acceptance Criteria:**

1. SM can auto-detect pattern from project structure and ticket description
2. User can override pattern selection: `KSA-200 tạo BRD pattern:ai-agent`
3. Pattern selection is stored in STATUS.json and persists across sessions
4. Each pattern has documented pipeline adjustments (what changes)
5. Pattern catalog is extensible (add new patterns without code changes)
6. Default pattern = `monolith` if auto-detection inconclusive

---

#### STORY 4: Implement Progressive Disclosure for Agent Prompts

> As a SM agent, I want progressive disclosure in prompts so that each agent only receives context relevant to its current task

**Requirement Details:**

1. Mỗi sub-agent chỉ nhận context cần thiết cho task hiện tại (không nhận full pipeline context)
2. Context được build dynamically dựa trên: current phase, ticket type, architecture pattern
3. Reduce prompt size cho sub-agents ≥50% so với hiện tại
4. Implement context layers: L0 (essential), L1 (helpful), L2 (reference only)

**Context Layers:**

| Layer | Content | When Included |
|-------|---------|---------------|
| L0 — Essential | Task instruction, output format, quality criteria | Always |
| L1 — Helpful | Related documents summary, code intelligence highlights | When available |
| L2 — Reference | Full document content, complete code analysis | Only on-demand (agent requests) |

**Progressive Disclosure Flow:**

```
SM prepares sub-agent invocation:
  1. Build L0 context (always included)
  2. Check if L1 data available → include summary
  3. L2 = NOT included by default
  4. Sub-agent can request L2 via KB search if needed
  5. Total prompt size = L0 + L1 (target: ≤1000 tokens overhead)
```

**Acceptance Criteria:**

1. Sub-agent prompts reduced ≥50% in token count vs current approach
2. Sub-agents still produce same quality output (no regression)
3. L0 context always sufficient for agent to understand task
4. L1 context improves output quality when available
5. L2 accessible via KB — agents can self-serve additional context
6. Context building is automated (SM doesn't manually craft each prompt)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Kiro IDE Steering Files | System | N/A | Kiro must support .kiro/steering/ directory with conditional loading |
| Kiro Sub-agent Invocation | System | N/A | invokeSubAgent must support parallel calls |
| Knowledge Base (KB) | System | N/A | KB must be available for L2 context retrieval |
| Current SM Prompt | Internal | N/A | Must be fully documented before modularization |
| revfactory/harness | External Reference | N/A | Reference architecture patterns and fan-out/fan-in implementation |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | User | Define requirements, approve architecture decisions | Ticket reporter |
| Architect | SA Agent | Design modular architecture, validate patterns | Pipeline |
| Developer | DEV Agent | Implement steering files, parallel execution | Pipeline |
| QA | QA Agent | Verify no regression, test parallel scenarios | Pipeline |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Modularization breaks existing pipeline | High | Medium | Comprehensive regression testing before/after |
| Parallel execution causes race conditions | High | Medium | File locking, separate output directories per agent |
| Token savings less than expected | Medium | Low | Measure baseline first, iterate on splitting strategy |
| Kiro IDE doesn't support conditional steering file loading | High | Low | Verify IDE capabilities before implementation |
| Progressive disclosure reduces output quality | Medium | Medium | A/B testing: compare output with full vs progressive context |

### 5.2 Assumptions

- Kiro IDE supports multiple steering files loaded conditionally
- invokeSubAgent can be called multiple times in parallel (non-blocking)
- KB search is fast enough for L2 context retrieval during agent execution
- Current SM prompt logic is correct and complete (no hidden bugs to carry over)
- revfactory/harness patterns are applicable to our agent pipeline architecture

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Token reduction ≥40% per invocation | Measured by comparing token count before/after modularization |
| Performance | Pipeline time reduction ≥25% with parallel execution | Measured end-to-end for applicable phase combinations |
| Reliability | Zero regression in document quality | All existing test cases must pass unchanged |
| Maintainability | Each steering file ≤500 lines | Ensures files remain manageable and reviewable |
| Extensibility | New patterns addable without code changes | Pattern catalog stored as configuration, not hardcoded |
| Compatibility | Backward compatible with existing tickets | All STATUS.json from previous tickets still readable |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-200 | Agent Pipeline Architecture Upgrade - Harness-inspired Patterns | To Do | Epic | Main ticket |
| KSA-201 | Modularize SM Agent Prompt into Steering Files | To Do | Task | Child of KSA-200 |
| KSA-202 | Implement Parallel Execution for Independent SDLC Phases (Fan-out Pattern) | To Do | Task | Child of KSA-200 |
| KSA-204 | Add Architecture Pattern Selection to SM Agent | To Do | Task | Child of KSA-200 |
| KSA-205 | Implement Progressive Disclosure for Agent Prompts | To Do | Task | Child of KSA-200 |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Steering File | Markdown file trong .kiro/steering/ chứa instructions cho agent, loaded conditionally |
| Fan-out | Pattern dispatch multiple parallel tasks từ single orchestrator |
| Fan-in | Pattern collect results từ multiple parallel tasks vào single point |
| Progressive Disclosure | UI/UX pattern chỉ hiển thị thông tin cần thiết, ẩn complexity |
| Context Window | Giới hạn token mà LLM có thể xử lý trong 1 lần gọi |
| Harness | Reference project (revfactory/harness) chứa agent pipeline patterns |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| revfactory/harness | https://github.com/revfactory/harness |
| Current SM Agent Prompt | .kiro/agents/sm-agent.md |
| Kiro Steering Files | .kiro/steering/ |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow — Pipeline Architecture Upgrade | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case — SM Agent Modular Architecture | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

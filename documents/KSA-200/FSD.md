# Functional Specification Document (FSD)

## Kiro SDLC Agents — KSA-200: Agent Pipeline Architecture Upgrade - Harness-inspired Patterns

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-200 |
| Title | Agent Pipeline Architecture Upgrade - Harness-inspired Patterns |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-200.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent - Business Analyst | Create FSD draft (business sections) |
| Technical Reviewer | TA Agent - Technical Analyst | Enrich with API contracts, pseudocode |
| Peer Reviewer | SM Agent - Scrum Master | Review and approve |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | BA Agent + TA Agent | Initial FSD derived from BRD v1 |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Agent Pipeline Architecture Upgrade for the Kiro SDLC Agents system. It details how the SM agent prompt will be modularized, how parallel execution will work, how architecture pattern selection operates, and how progressive disclosure reduces token consumption.

### 1.2 Scope

- Modularization of SM agent prompt (~69KB monolithic) into steering files
- Fan-out/fan-in parallel execution for independent SDLC phases
- Architecture pattern catalog and auto-selection mechanism
- Progressive disclosure context layers (L0/L1/L2) for sub-agent invocations

### 1.3 Definitions and Acronyms

| Term | Definition |
|------|------------|
| SM | Scrum Master agent - orchestrates the SDLC pipeline |
| Steering File | Markdown file in .kiro/steering/ loaded conditionally by Kiro IDE |
| Fan-out | Dispatching multiple parallel tasks from single orchestrator |
| Fan-in | Collecting results from multiple parallel tasks into single point |
| Progressive Disclosure | Only loading context needed for current task |
| Context Window | Token limit for LLM processing per invocation |
| L0/L1/L2 | Context layers: Essential / Helpful / Reference-only |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-200.docx |
| Current SM Agent Prompt | .kiro/agents/sm-agent.md (69KB) |
| Harness Reference | https://github.com/revfactory/harness |
| Kiro Steering Files | .kiro/steering/ directory |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The system consists of:
- **SM Core Orchestrator** - minimal routing/status logic (always loaded)
- **Phase Steering Files** - phase-specific instructions (loaded on demand)
- **Shared Utilities** - Jira, diagrams, quality gates (loaded when needed)
- **Sub-agents** (BA, TA, SA, QA, DEV, DevOps) - receive progressive context
- **Kiro IDE** - provides steering file loading and sub-agent invocation
- **Jira** - ticket management and workflow transitions
- **Knowledge Base (KB)** - document storage and retrieval

### 2.2 Current vs Target Architecture

**Current State:**
- Single sm-agent.md file: 69KB, ~2000+ lines
- Every invocation loads entire file into context window
- Sequential-only execution (no parallelism)
- Full context passed to every sub-agent

**Target State:**
- sm-core.md: ~300 lines (always loaded)
- 7 phase files + 3 shared files: each <=500 lines (loaded on demand)
- Parallel execution for independent phases
- Progressive disclosure: L0+L1 only, L2 via KB on-demand

---

## 3. Functional Requirements

### 3.1 Feature: Modularize SM Agent Prompt (UC-01)

**Source:** BRD Story 1 (KSA-201)

#### 3.1.1 Description

Split the monolithic SM agent prompt into modular steering files that are loaded conditionally based on the current pipeline phase.

#### 3.1.2 Use Case: UC-01 - Load Phase-Specific Steering

**Use Case ID:** UC-01
**Actor:** SM Agent (via Kiro IDE)
**Precondition:** User invokes SM agent with a ticket key
**Trigger:** SM agent starts execution

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | User | Provides ticket key (e.g., KSA-200) | SM core orchestrator loads |
| 2 | SM | Reads STATUS.json | Determines current phase |
| 3 | SM | Requests phase steering file | Kiro IDE loads phase-{N}-{name}.md |
| 4 | SM | Checks if shared utilities needed | Loads shared-jira.md / shared-quality-gates.md as needed |
| 5 | SM | Executes phase logic | Invokes appropriate sub-agent |

**Alternative Flows:**

| Alt | Condition | Action |
|-----|-----------|--------|
| 2a | STATUS.json missing | Scan files to rebuild status, then continue |
| 3a | Phase file not found | Fall back to sm-core.md inline logic (degraded mode) |
| 4a | Jira unavailable | Skip Jira transitions, manage via STATUS.json only |

**Exception Flows:**

| Exc | Condition | Action |
|-----|-----------|--------|
| E1 | Kiro IDE doesn't support conditional loading | Abort with error, suggest manual loading |
| E2 | Steering file corrupted/invalid | Log error, skip file, use defaults |

**Postcondition:** Only relevant steering content is in context window

#### 3.1.3 Business Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-01 | sm-core.md MUST be <=300 lines | Ensures minimal base token consumption |
| BR-02 | Each phase file MUST be <=500 lines | Keeps files manageable and reviewable |
| BR-03 | Total loaded content per invocation MUST be <=40% of monolithic size | Achieves token reduction target |
| BR-04 | Shared files loaded only when their functionality is needed | Minimizes unnecessary context |
| BR-05 | All existing pipeline behavior MUST be preserved (no regression) | Zero functional regression |

#### 3.1.4 Data Specifications

**File Structure:**

| File | Max Lines | Load Condition | Content |
|------|-----------|----------------|---------|
| sm-core.md | 300 | Always | Routing, status mgmt, phase detection, quality gates summary |
| phase-1-requirements.md | 500 | currentPhase = requirements | BRD creation workflow, BA invocation |
| phase-2-specification.md | 500 | currentPhase = specification | FSD workflow (BA+TA), enrichment |
| phase-3-design.md | 500 | currentPhase = design | TDD creation, feedback loop |
| phase-4-test-planning.md | 500 | currentPhase = test_planning | STP/STC, SM review criteria |
| phase-5-implementation.md | 500 | currentPhase = implementation | DEV workflow, git, code review |
| phase-6-testing.md | 500 | currentPhase = testing | QA execution, test quality |
| phase-7-deployment.md | 500 | currentPhase = deployment | DevOps, release process |
| shared-jira.md | 300 | Jira interaction needed | Transitions, comments, attachments |
| shared-quality-gates.md | 400 | After phase completion | Verification checklists per document |
| shared-diagrams.md | 200 | Document creation | Diagram requirements, draw.io rules |

---

### 3.2 Feature: Parallel Execution - Fan-out Pattern (UC-02)

**Source:** BRD Story 2 (KSA-202)

#### 3.2.1 Description

Enable SM agent to dispatch multiple independent sub-agents simultaneously and collect their results (fan-in) when all complete.

#### 3.2.2 Use Case: UC-02 - Execute Phases in Parallel

**Use Case ID:** UC-02
**Actor:** SM Agent
**Precondition:** Pipeline reaches a point where independent phases can run simultaneously
**Trigger:** SM detects parallel opportunity in dependency graph

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | SM | Evaluates dependency graph | Identifies parallel-eligible phases |
| 2 | SM | Validates prerequisites for all parallel phases | All prerequisites met |
| 3 | SM | Fan-out: invokes multiple sub-agents | Agents execute concurrently |
| 4 | SM | Waits for all agents to complete (or timeout) | Collects results |
| 5 | SM | Fan-in: validates results consistency | No conflicts detected |
| 6 | SM | Updates STATUS.json for all completed phases | Pipeline advances |

**Alternative Flows:**

| Alt | Condition | Action |
|-----|-----------|--------|
| 3a | One agent fails during execution | Other agents continue; failed agent result marked as error |
| 5a | Fan-in detects inconsistency between results | Re-run conflicting branch with additional context |
| 5b | Timeout reached for one agent | Mark as incomplete, continue with available results |

**Exception Flows:**

| Exc | Condition | Action |
|-----|-----------|--------|
| E1 | Kiro IDE doesn't support parallel invokeSubAgent | Fall back to sequential execution |
| E2 | File write conflict (two agents write same file) | Last-write-wins with conflict log |

**Postcondition:** All parallel phases completed, STATUS.json updated

#### 3.2.3 Business Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-06 | Only phases with NO data dependency can run in parallel | Prevents inconsistent outputs |
| BR-07 | Fan-out timeout = 5 minutes per agent | Prevents infinite waits |
| BR-08 | If fan-in detects conflict, max 2 retry attempts | Prevents infinite retry loops |
| BR-09 | Parallel execution MUST NOT corrupt STATUS.json | Atomic updates required |
| BR-10 | Each parallel agent writes to separate output files | No file write conflicts |

#### 3.2.4 Parallel Dependency Graph

| Phase | Depends On | Can Parallel With |
|-------|-----------|-------------------|
| Phase 1 (BRD) | Jira ticket | None (first phase) |
| Phase 2 (FSD) | BRD | None (sequential after Phase 1) |
| Phase 3 (TDD) | FSD | None (sequential after Phase 2) |
| Phase 4 (STP/STC) | BRD + FSD + TDD | Phase 5 (both depend on TDD, independent of each other) |
| Phase 5 (Code) | TDD | Phase 4 (both depend on TDD, independent of each other) |
| Phase 5.5 (UG) | Code | Phase 6 (both depend on code) |
| Phase 6 (Testing) | Code + STP/STC | Phase 5.5 (both depend on code) |
| Phase 7 (Deploy) | All tests pass | None (final phase) |

**Parallel Groups:**

| Group | Phases | Trigger Condition |
|-------|--------|-------------------|
| Group A | Phase 4 + Phase 5 | TDD completed (design.status = done) |
| Group B | Phase 5.5 + Phase 6 | Code exists AND STP/STC exist |

---

### 3.3 Feature: Architecture Pattern Selection (UC-03)

**Source:** BRD Story 3 (KSA-204)

#### 3.3.1 Description

SM agent auto-detects or allows user to specify an architecture pattern that influences pipeline behavior, document depth, and quality gates.

#### 3.3.2 Use Case: UC-03 - Select Architecture Pattern

**Use Case ID:** UC-03
**Actor:** SM Agent / User
**Precondition:** Ticket exists, pipeline starting or pattern not yet selected
**Trigger:** First pipeline invocation for a ticket OR user specifies pattern override

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | SM | Reads project structure (build files, source dirs) | Collects project signals |
| 2 | SM | Reads ticket description and type | Collects business signals |
| 3 | SM | Evaluates signals against pattern catalog | Selects best-match pattern |
| 4 | SM | Stores pattern in STATUS.json | Pattern persists across sessions |
| 5 | SM | Applies pattern adjustments to pipeline | Modified quality gates, diagram types |

**Alternative Flows:**

| Alt | Condition | Action |
|-----|-----------|--------|
| 1a | User provides pattern override (e.g., pattern:ai-agent) | Skip auto-detection, use specified pattern |
| 3a | Auto-detection inconclusive (no clear match) | Default to 'monolith' pattern |
| 3b | Multiple patterns match equally | Present options to user, ask for selection |

#### 3.3.3 Architecture Pattern Catalog

| Pattern ID | Pattern | Detection Signals | Pipeline Adjustments |
|-----------|---------|-------------------|---------------------|
| PAT-01 | microservice | Multiple build.gradle/pom.xml, docker-compose, service directories | Extra: API contract review, service interaction diagrams, integration test emphasis |
| PAT-02 | monolith | Single build file, single deployable | Simplified: fewer integration diagrams, standard flow |
| PAT-03 | library | No main class, published artifact, version in build file | Focus: API design doc, versioning strategy, backward compat checks |
| PAT-04 | cli-tool | Main with arg parsing, no web server | Focus: UX flow diagrams, argument spec, output format spec |
| PAT-05 | plugin | Host system reference, extension points | Focus: Integration point spec, host constraints, lifecycle hooks |
| PAT-06 | data-pipeline | ETL patterns, scheduler configs, data source connections | Focus: Data flow diagrams, error recovery, idempotency rules |
| PAT-07 | ai-agent | Prompt files, tool definitions, context management | Focus: Prompt engineering spec, tool integration, context budget |

#### 3.3.4 Pattern Influence Matrix

| Aspect | microservice | monolith | library | cli-tool | ai-agent |
|--------|-------------|----------|---------|----------|----------|
| BRD depth | Standard | Standard | API-focused | UX-focused | Prompt-focused |
| FSD diagrams | +Service interaction | Standard | +API surface | +CLI flow | +Context flow |
| TDD emphasis | Integration | Standard | Versioning | Parsing | Token mgmt |
| Test focus | Contract tests | Unit+E2E | API compat | CLI scenarios | Prompt regression |
| Deploy complexity | High (multi-service) | Medium | Publish | Package | Config |

#### 3.3.5 Business Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-11 | Pattern stored in STATUS.json field "architecturePattern" | Persists across sessions |
| BR-12 | User override always takes precedence over auto-detection | User knows best |
| BR-13 | Default pattern = "monolith" if detection inconclusive | Safe default |
| BR-14 | Pattern catalog stored as config file, not hardcoded | Extensibility |
| BR-15 | Pattern selection happens ONCE per ticket (first invocation) | Consistency |

---

### 3.4 Feature: Progressive Disclosure for Agent Prompts (UC-04)

**Source:** BRD Story 4 (KSA-205)

#### 3.4.1 Description

Sub-agents receive only the context they need (L0 essential + L1 helpful), with L2 reference available on-demand via KB search.

#### 3.4.2 Use Case: UC-04 - Build Progressive Context for Sub-agent

**Use Case ID:** UC-04
**Actor:** SM Agent
**Precondition:** SM about to invoke a sub-agent
**Trigger:** Sub-agent invocation preparation

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | SM | Determines target agent and task | Identifies context requirements |
| 2 | SM | Builds L0 context (task instruction, output format, quality criteria) | L0 assembled (~200 tokens) |
| 3 | SM | Checks KB for L1 data (related doc summaries, code highlights) | L1 assembled (~500 tokens) |
| 4 | SM | Constructs final prompt = L0 + L1 | Total ~700 tokens overhead |
| 5 | SM | Invokes sub-agent with constructed prompt | Agent executes with minimal context |
| 6 | Sub-agent | If needs more context, searches KB (L2) | Self-serves additional detail |

**Alternative Flows:**

| Alt | Condition | Action |
|-----|-----------|--------|
| 3a | KB unavailable | Skip L1, use L0 only (degraded but functional) |
| 6a | Sub-agent KB search returns no results | Agent works with L0+L1 only |
| 6b | Sub-agent needs specific file content | Reads file directly (fallback) |

#### 3.4.3 Context Layer Specifications

**L0 - Essential (Always Included):**

| Component | Content | Max Tokens |
|-----------|---------|------------|
| Task instruction | What to do, which document to create | 100 |
| Output format | File path, template reference, section requirements | 50 |
| Quality criteria | Must-have sections, diagram requirements | 50 |
| Ticket context | Ticket key, summary, type | 30 |

**L1 - Helpful (Included When Available):**

| Component | Content | Max Tokens |
|-----------|---------|------------|
| Related doc summary | Key points from prerequisite documents | 200 |
| Code intelligence highlights | Relevant modules, tech stack, patterns | 200 |
| Architecture pattern adjustments | Pattern-specific instructions | 100 |

**L2 - Reference (On-demand via KB):**

| Component | Content | Access Method |
|-----------|---------|---------------|
| Full BRD content | Complete BRD text | mem_search(ticket + "BRD") |
| Full FSD content | Complete FSD text | mem_search(ticket + "FSD") |
| Full code analysis | Module details, dependencies | mem_search(ticket + "code") |
| Previous discrepancy reports | Historical feedback | mem_search(ticket + "DISCREPANCY") |

#### 3.4.4 Business Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR-16 | L0 context MUST be sufficient for agent to understand task | No agent should fail due to missing L0 |
| BR-17 | L0 + L1 total overhead <= 1000 tokens | Minimal context window consumption |
| BR-18 | L2 retrieval via KB search, not file inclusion | Keeps prompt size small |
| BR-19 | Sub-agent output quality MUST NOT degrade vs full-context approach | No regression |
| BR-20 | Context building is automated based on phase + pattern | SM doesn't manually craft |

---

## 4. Non-Functional Requirements

| Category | Requirement | Metric | Target |
|----------|-------------|--------|--------|
| Performance | Token reduction per invocation | Token count comparison | >= 40% reduction |
| Performance | Pipeline time with parallel execution | End-to-end time | >= 25% reduction |
| Reliability | Zero regression in document quality | Existing test pass rate | 100% |
| Maintainability | Steering file size | Lines per file | <= 500 lines |
| Maintainability | Core orchestrator size | Lines | <= 300 lines |
| Extensibility | Add new pattern | Config change only | No code changes |
| Compatibility | Existing STATUS.json | Read old format | 100% backward compatible |
| Availability | Degraded mode when components unavailable | Fallback behavior | Graceful degradation |

---

## 5. State Diagrams

### 5.1 Pipeline Phase State Machine

![Pipeline State](diagrams/pipeline-state.png)

**States:**
- NOT_STARTED - Phase has not begun
- IN_PROGRESS - Phase actively executing
- DONE - Phase completed successfully
- NEEDS_REVISION - Phase output needs update (feedback loop)
- BLOCKED - Phase cannot proceed (missing prerequisite)
- PARALLEL_RUNNING - Phase running as part of fan-out group

**Transitions:**
- NOT_STARTED -> IN_PROGRESS: Prerequisites met, SM starts phase
- IN_PROGRESS -> DONE: Agent completes, verification passes
- IN_PROGRESS -> NEEDS_REVISION: Feedback loop detects issues
- NEEDS_REVISION -> IN_PROGRESS: Agent starts revision
- NOT_STARTED -> BLOCKED: Prerequisite missing
- BLOCKED -> NOT_STARTED: Prerequisite fulfilled
- NOT_STARTED -> PARALLEL_RUNNING: Fan-out dispatch
- PARALLEL_RUNNING -> DONE: Agent completes in parallel group
- PARALLEL_RUNNING -> IN_PROGRESS: Parallel timeout, falls back to sequential

### 5.2 Steering File Loading State

![Steering Load State](diagrams/steering-load-state.png)

**States:**
- UNLOADED - File not in context
- LOADING - File being read
- ACTIVE - File content in context window
- EXPIRED - File no longer needed (phase changed)

---

## 6. Sequence Diagrams

### 6.1 Modular Loading Sequence

![Modular Loading](diagrams/sequence-modular-loading.png)

`
User -> SM Core: "KSA-200 tao FSD"
SM Core -> STATUS.json: Read current phase
STATUS.json -> SM Core: currentPhase = "specification"
SM Core -> Kiro IDE: Load phase-2-specification.md
Kiro IDE -> SM Core: Phase 2 steering content
SM Core -> Kiro IDE: Load shared-jira.md (needed for transition)
Kiro IDE -> SM Core: Jira steering content
SM Core -> BA Agent: Invoke with L0+L1 context
BA Agent -> KB: mem_search("KSA-200 BRD") [L2 on-demand]
KB -> BA Agent: BRD content
BA Agent -> SM Core: FSD.md created
SM Core -> STATUS.json: Update specification.status = "done"
`

### 6.2 Fan-out/Fan-in Sequence

![Fan-out Fan-in](diagrams/sequence-fanout.png)

`
SM Core -> Dependency Graph: Check parallel opportunities
Dependency Graph -> SM Core: Group A eligible (Phase 4 + Phase 5)
SM Core -> QA Agent: Fan-out: Create STP/STC (Phase 4)
SM Core -> DEV Agent: Fan-out: Implement code (Phase 5)
Note: Both agents execute concurrently
QA Agent -> SM Core: STP.md + STC.md created
DEV Agent -> SM Core: Code implemented
SM Core -> SM Core: Fan-in: Validate consistency
SM Core -> STATUS.json: Update both phases = "done"
`

### 6.3 Pattern Selection Sequence

![Pattern Selection](diagrams/sequence-pattern-selection.png)

`
SM Core -> Project Structure: Scan build files, source dirs
Project Structure -> SM Core: Signals (multiple .kiro/agents/, steering files, prompt engineering)
SM Core -> Ticket: Read description
Ticket -> SM Core: "Agent Pipeline Architecture Upgrade"
SM Core -> Pattern Catalog: Match signals to patterns
Pattern Catalog -> SM Core: Best match = "ai-agent"
SM Core -> STATUS.json: Store architecturePattern = "ai-agent"
SM Core -> Phase Steering: Apply pattern adjustments
`

---

## 7. Error Handling

| Error Code | Condition | Handling | Recovery |
|------------|-----------|----------|----------|
| ERR-01 | Steering file not found | Log warning, use inline defaults | Continue with degraded functionality |
| ERR-02 | Parallel agent timeout (>5min) | Cancel timed-out agent | Fall back to sequential for that phase |
| ERR-03 | Fan-in conflict detected | Log conflict details | Re-run conflicting branch (max 2 retries) |
| ERR-04 | KB unavailable for L1/L2 | Skip KB context | Agent works with L0 only |
| ERR-05 | STATUS.json write conflict | Retry with lock | Max 3 retries, then report error |
| ERR-06 | Pattern detection fails | Default to "monolith" | Log detection failure for debugging |
| ERR-07 | Steering file exceeds 500 lines | Warn at load time | Still load, but flag for refactoring |

---

## 8. Integration Requirements

### 8.1 Kiro IDE Integration

| Integration Point | Current | Target | API/Mechanism |
|-------------------|---------|--------|---------------|
| Steering file loading | Load all .kiro/steering/*.md | Conditional loading based on context | Kiro IDE contextFiles parameter |
| Sub-agent invocation | Sequential invokeSubAgent | Parallel invokeSubAgent (non-blocking) | Kiro IDE invokeSubAgent API |
| Context passing | Full prompt in agent .md file | Dynamic prompt construction | contextFiles + inline prompt |

### 8.2 KB Integration

| Operation | Purpose | Tool | Frequency |
|-----------|---------|------|-----------|
| mem_search | L2 context retrieval by sub-agents | mem_search | Per sub-agent invocation (on-demand) |
| mem_ingest | Store document summaries for L1 | mem_ingest | After each phase completion |
| mem_search | Pattern detection (project analysis) | mem_search | Once per ticket (first invocation) |

### 8.3 File System Integration

| Path | Purpose | Access Pattern |
|------|---------|----------------|
| .kiro/steering/sm-core.md | Core orchestrator | Read always |
| .kiro/steering/phase-{N}-*.md | Phase-specific logic | Read on-demand |
| .kiro/steering/shared-*.md | Shared utilities | Read on-demand |
| .kiro/steering/patterns/*.md | Pattern catalog | Read once per ticket |
| documents/{TICKET}/STATUS.json | Pipeline state | Read/Write every invocation |

---

## 9. Open Issues

| # | Issue | Impact | Decision Needed By |
|---|-------|--------|-------------------|
| 1 | Does Kiro IDE support conditional steering file loading natively? | If not, need workaround via contextFiles | Before implementation |
| 2 | Can invokeSubAgent be called in parallel (non-blocking)? | If not, fan-out pattern needs alternative approach | Before Phase 5 |
| 3 | What is the actual token count of current SM prompt? | Needed for accurate 40% reduction measurement | Before implementation |
| 4 | Should pattern catalog be YAML, JSON, or Markdown? | Affects extensibility mechanism | Design phase |
| 5 | How to handle steering file versioning when multiple tickets in progress? | Concurrent pipeline runs may need different versions | Design phase |

---

## 10. Appendix

### 10.1 Glossary

| Term | Definition |
|------|------------|
| Fan-out | Dispatching multiple parallel tasks from single orchestrator |
| Fan-in | Collecting and merging results from parallel tasks |
| Steering File | Conditional instruction file for Kiro IDE agents |
| Progressive Disclosure | Loading only necessary context per task |
| Context Layer | Categorization of context by importance (L0/L1/L2) |
| Pattern Catalog | Configuration defining available architecture patterns |

### 10.2 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Pipeline State Machine | [pipeline-state.png](diagrams/pipeline-state.png) | [pipeline-state.drawio](diagrams/pipeline-state.drawio) |
| 3 | Steering Load State | [steering-load-state.png](diagrams/steering-load-state.png) | [steering-load-state.drawio](diagrams/steering-load-state.drawio) |
| 4 | Sequence - Modular Loading | [sequence-modular-loading.png](diagrams/sequence-modular-loading.png) | [sequence-modular-loading.drawio](diagrams/sequence-modular-loading.drawio) |
| 5 | Sequence - Fan-out/Fan-in | [sequence-fanout.png](diagrams/sequence-fanout.png) | [sequence-fanout.drawio](diagrams/sequence-fanout.drawio) |
| 6 | Sequence - Pattern Selection | [sequence-pattern-selection.png](diagrams/sequence-pattern-selection.png) | [sequence-pattern-selection.drawio](diagrams/sequence-pattern-selection.drawio) |

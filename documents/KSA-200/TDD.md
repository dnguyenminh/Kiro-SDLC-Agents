# Technical Design Document (TDD)

## Kiro SDLC Agents — KSA-200: Agent Pipeline Architecture Upgrade - Harness-inspired Patterns

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-200 |
| Title | Agent Pipeline Architecture Upgrade - Harness-inspired Patterns |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-200.docx |
| Related FSD | FSD-v1-KSA-200.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | SA Agent - Solution Architect | Create TDD |
| Peer Reviewer | SM Agent - Scrum Master | Review and approve |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | SA Agent | Initial TDD derived from FSD v1 |

---

## 1. Architecture Overview

### 1.1 Current Architecture

The current SM agent uses a monolithic prompt file (`sm-agent.md`, 69KB, ~2000+ lines) that is loaded entirely into the context window on every invocation. This creates:

- **Token waste**: Loading Phase 7 info when executing Phase 1
- **Context pressure**: Reduced space for actual work output
- **Maintenance burden**: Single large file difficult to review/update
- **No parallelism**: Sequential-only execution by design

### 1.2 Target Architecture

![Architecture Overview](diagrams/architecture-overview.png)

**Layered Architecture:**

| Layer | Components | Responsibility |
|-------|-----------|----------------|
| **Orchestration** | sm-core.md | Routing, status management, phase detection |
| **Phase Logic** | phase-1..7.md | Phase-specific workflows and agent invocations |
| **Shared Services** | shared-*.md | Cross-cutting concerns (Jira, quality gates, diagrams) |
| **Pattern Config** | patterns/*.md | Architecture pattern definitions and adjustments |
| **Context Builder** | Progressive disclosure logic | L0/L1/L2 context assembly |
| **Execution Engine** | Fan-out/fan-in controller | Parallel dispatch and result collection |

### 1.3 Design Principles

1. **Single Responsibility**: Each file handles one phase or one concern
2. **Lazy Loading**: Only load what's needed for current phase
3. **Fail-Safe Defaults**: If a file is missing, degrade gracefully
4. **Immutable State**: STATUS.json is the single source of truth
5. **Idempotent Operations**: Re-running a phase produces same result

---

## 2. Component Design

### 2.1 SM Core Orchestrator (sm-core.md)

**Purpose:** Minimal always-loaded component that routes to appropriate phase logic.

**Responsibilities:**
- Parse user input (ticket key, action, template)
- Read STATUS.json to determine current phase
- Load appropriate phase steering file via contextFiles
- Manage phase transitions and quality gates
- Report status to user

**Size Target:** <=300 lines

**Pseudocode:**

```
function main(userInput):
    ticket = parseTicketKey(userInput)
    action = parseAction(userInput)
    status = readStatusJson(ticket)
    
    if action == "status":
        reportStatus(status)
        return
    
    currentPhase = determinePhase(status, action)
    
    // Load phase-specific steering
    contextFiles = [
        "phase-{currentPhase.number}-{currentPhase.name}.md"
    ]
    
    // Load shared utilities if needed
    if currentPhase.needsJira:
        contextFiles.append("shared-jira.md")
    if currentPhase.isCompleting:
        contextFiles.append("shared-quality-gates.md")
    
    // Check parallel opportunities
    parallelGroup = checkParallelOpportunities(status)
    if parallelGroup:
        executeFanOut(parallelGroup)
    else:
        executePhase(currentPhase, contextFiles)
```

### 2.2 Phase Steering Files

Each phase file contains the complete workflow for that SDLC phase.

**Structure per file:**

```
# Phase {N}: {Name}

## Prerequisites
- List of required files/states

## Workflow Steps
1. Step-by-step execution logic
2. Sub-agent invocation details
3. Verification checklist

## Agent Invocation Template
- L0 context template for this phase
- L1 context sources

## Quality Gate
- What to verify after completion
- Pass/fail criteria
```

**File Mapping:**

| File | Phase | Sub-agent | Key Logic |
|------|-------|-----------|-----------|
| phase-1-requirements.md | Requirements | BA | BRD creation, diagram verification |
| phase-2-specification.md | Specification | BA + TA | FSD draft + enrichment |
| phase-3-design.md | Design | SA | TDD creation, feedback loop trigger |
| phase-4-test-planning.md | Test Planning | QA | STP/STC creation, SM review |
| phase-5-implementation.md | Implementation | DEV | Code, git, PR |
| phase-6-testing.md | Testing | QA | Test execution, quality review |
| phase-7-deployment.md | Deployment | DevOps | DPG, RLN, release process |

### 2.3 Shared Utility Files

| File | Purpose | Loaded When |
|------|---------|-------------|
| shared-jira.md | Jira transitions, comments, attachments, workflow rules | Any Jira interaction |
| shared-quality-gates.md | Document verification checklists (BRD/FSD/TDD/STP) | After phase completion |
| shared-diagrams.md | Draw.io requirements, export rules, diagram index | Document creation |

### 2.4 Pattern Catalog

**Location:** `.kiro/steering/patterns/`

**Structure:**

```
patterns/
  catalog.md          # Pattern list + detection rules
  microservice.md     # Microservice pattern adjustments
  monolith.md         # Monolith pattern (default)
  library.md          # Library/SDK pattern
  cli-tool.md         # CLI tool pattern
  ai-agent.md         # AI agent pattern
  data-pipeline.md    # Data pipeline pattern
  plugin.md           # Plugin/extension pattern
```

**catalog.md format:**

```yaml
patterns:
  - id: microservice
    signals:
      - multiple_build_files: true
      - docker_compose_exists: true
      - service_directories: ["services/", "apps/"]
    weight: 0.8
  - id: ai-agent
    signals:
      - prompt_files: [".kiro/agents/*.md"]
      - tool_definitions: true
      - context_management: true
    weight: 0.9
```

### 2.5 Progressive Disclosure Context Builder

**Purpose:** Assembles minimal context for sub-agent invocations.

**Algorithm:**

```
function buildContext(targetAgent, phase, ticket, pattern):
    // L0 - Essential (always included)
    l0 = {
        task: getTaskInstruction(phase, targetAgent),
        outputFormat: getOutputSpec(phase),
        qualityCriteria: getQualityCriteria(phase, pattern),
        ticketContext: { key: ticket.key, summary: ticket.summary, type: ticket.type }
    }
    
    // L1 - Helpful (included when available)
    l1 = {}
    prerequisiteDocs = getPrerequisites(phase)
    for doc in prerequisiteDocs:
        summary = kb.search(ticket.key + " " + doc.name + " summary")
        if summary:
            l1[doc.name] = summary.first(200_tokens)
    
    codeIntel = kb.search(ticket.key + " code intelligence highlights")
    if codeIntel:
        l1["codeIntel"] = codeIntel.first(200_tokens)
    
    patternAdjustments = loadPatternAdjustments(pattern, phase)
    if patternAdjustments:
        l1["patternNotes"] = patternAdjustments
    
    // L2 - NOT included (agent self-serves via KB)
    // Agent can call: kb.search(ticket + " BRD full"), kb.search(ticket + " FSD full")
    
    return formatPrompt(l0, l1)
```

**Token Budget:**

| Layer | Max Tokens | Content |
|-------|-----------|---------|
| L0 | 230 | Task + output + quality + ticket |
| L1 | 500 | Doc summaries + code intel + pattern |
| Total overhead | 730 | Well under 1000 target |

### 2.6 Fan-out/Fan-in Execution Engine

**Purpose:** Manages parallel execution of independent phases.

**Design:**

```
function executeFanOut(parallelGroup):
    // Validate all prerequisites
    for phase in parallelGroup.phases:
        if not checkPrerequisites(phase):
            throw PrerequisiteError(phase)
    
    // Dispatch all agents
    results = {}
    errors = {}
    for phase in parallelGroup.phases:
        context = buildContext(phase.agent, phase, ticket, pattern)
        results[phase] = invokeSubAgent(
            name: phase.agent,
            prompt: context,
            async: true  // Non-blocking
        )
    
    // Wait for all (with timeout)
    timeout = 5 * 60 * 1000  // 5 minutes
    completed = waitAll(results, timeout)
    
    // Fan-in: collect and validate
    for phase, result in completed:
        if result.success:
            verifyOutput(phase)
            updateStatus(phase, "done")
        else:
            errors[phase] = result.error
            updateStatus(phase, "in_progress")  // Fall back to sequential
    
    // Handle errors
    if errors:
        for phase, error in errors:
            log("Parallel execution failed for {phase}: {error}")
            // Will be retried sequentially
    
    return { completed: completed, errors: errors }
```

**Conflict Resolution:**

| Conflict Type | Detection | Resolution |
|--------------|-----------|------------|
| File write conflict | Two agents write same path | Last-write-wins + conflict log |
| STATUS.json race | Concurrent updates | Atomic read-modify-write with retry |
| KB ingest conflict | Same document key | Version-based (higher version wins) |

---

## 3. Data Design

### 3.1 STATUS.json Schema (Extended)

```json
{
  "ticket": "KSA-200",
  "currentPhase": "design",
  "architecturePattern": "ai-agent",
  "patternDetectedAt": "2025-01-27T10:00:00Z",
  "phases": {
    "requirements": {
      "status": "done",
      "file": "BRD.md",
      "version": 1,
      "completedAt": "2025-01-27T10:30:00Z",
      "executionMode": "sequential"
    },
    "specification": {
      "status": "done",
      "file": "FSD.md",
      "version": 1,
      "completedAt": "2025-01-27T11:00:00Z",
      "executionMode": "sequential"
    },
    "design": {
      "status": "in_progress",
      "startedAt": "2025-01-27T11:30:00Z",
      "executionMode": "sequential"
    },
    "test_planning": {
      "status": "not_started",
      "executionMode": "parallel",
      "parallelGroup": "A"
    },
    "implementation": {
      "status": "not_started",
      "executionMode": "parallel",
      "parallelGroup": "A"
    }
  },
  "parallelGroups": {
    "A": {
      "phases": ["test_planning", "implementation"],
      "status": "not_started",
      "startedAt": null,
      "completedAt": null
    }
  },
  "contextLayers": {
    "lastL1Update": "2025-01-27T11:00:00Z",
    "kbDocuments": ["BRD", "FSD"]
  },
  "lastUpdated": "2025-01-27T11:30:00Z"
}
```

### 3.2 Pattern Catalog Schema

```json
{
  "patterns": [
    {
      "id": "ai-agent",
      "name": "AI Agent System",
      "signals": {
        "filePatterns": [".kiro/agents/*.md", ".kiro/steering/*.md"],
        "keywords": ["prompt", "agent", "context", "tool"],
        "buildFiles": ["package.json", "build.gradle.kts"],
        "directoryPatterns": ["agents/", "prompts/", "steering/"]
      },
      "weight": 0.9,
      "adjustments": {
        "brd": { "emphasis": ["prompt-engineering", "context-management"] },
        "fsd": { "extraDiagrams": ["context-flow", "tool-interaction"] },
        "tdd": { "emphasis": ["token-optimization", "prompt-versioning"] },
        "testing": { "focus": ["prompt-regression", "context-budget"] }
      }
    }
  ]
}
```

---

## 4. File Structure

### 4.1 Target Directory Layout

```
.kiro/
  agents/
    sm-agent.md          # Minimal bootstrap (points to steering)
    sm-agent.json        # Agent config
  steering/
    sm-core.md           # Core orchestrator (<=300 lines)
    phase-1-requirements.md
    phase-2-specification.md
    phase-3-design.md
    phase-4-test-planning.md
    phase-5-implementation.md
    phase-6-testing.md
    phase-7-deployment.md
    shared-jira.md
    shared-quality-gates.md
    shared-diagrams.md
    patterns/
      catalog.md
      microservice.md
      monolith.md
      library.md
      cli-tool.md
      ai-agent.md
      data-pipeline.md
      plugin.md
```

### 4.2 Migration Strategy

| Step | Action | Risk | Rollback |
|------|--------|------|----------|
| 1 | Create all steering files (empty stubs) | None | Delete files |
| 2 | Extract sm-core.md from monolithic prompt | Low | Restore backup |
| 3 | Extract phase files one by one | Medium | Restore backup |
| 4 | Extract shared utilities | Low | Restore backup |
| 5 | Create pattern catalog | None | Delete files |
| 6 | Update sm-agent.md to bootstrap from sm-core.md | High | Restore backup |
| 7 | Test full pipeline with modular setup | High | Restore backup |
| 8 | Remove monolithic content from sm-agent.md | High | Restore backup |

**Rollback Plan:** Keep backup of original sm-agent.md at `.kiro/agents/sm-agent.md.bak`

---

## 5. Implementation Checklist

### 5.1 Files to Create

| # | File | Lines | Priority | Depends On |
|---|------|-------|----------|------------|
| 1 | .kiro/steering/sm-core.md | <=300 | P0 | None |
| 2 | .kiro/steering/phase-1-requirements.md | <=500 | P0 | sm-core.md |
| 3 | .kiro/steering/phase-2-specification.md | <=500 | P0 | sm-core.md |
| 4 | .kiro/steering/phase-3-design.md | <=500 | P0 | sm-core.md |
| 5 | .kiro/steering/phase-4-test-planning.md | <=500 | P1 | sm-core.md |
| 6 | .kiro/steering/phase-5-implementation.md | <=500 | P1 | sm-core.md |
| 7 | .kiro/steering/phase-6-testing.md | <=500 | P1 | sm-core.md |
| 8 | .kiro/steering/phase-7-deployment.md | <=500 | P1 | sm-core.md |
| 9 | .kiro/steering/shared-jira.md | <=300 | P0 | None |
| 10 | .kiro/steering/shared-quality-gates.md | <=400 | P0 | None |
| 11 | .kiro/steering/shared-diagrams.md | <=200 | P1 | None |
| 12 | .kiro/steering/patterns/catalog.md | <=200 | P2 | None |
| 13 | .kiro/steering/patterns/ai-agent.md | <=100 | P2 | catalog.md |
| 14 | .kiro/steering/patterns/monolith.md | <=100 | P2 | catalog.md |

### 5.2 Files to Modify

| # | File | Change | Priority |
|---|------|--------|----------|
| 1 | .kiro/agents/sm-agent.md | Replace monolithic content with bootstrap to sm-core.md | P0 |
| 2 | .kiro/agents/sm-agent.json | Update contextFiles to include sm-core.md | P0 |

### 5.3 Files to Delete (after migration verified)

| # | File | Condition |
|---|------|-----------|
| 1 | .kiro/agents/sm-agent.md.bak | After 1 week of stable operation |

---

## 6. Error Handling

| Error | Component | Handling | Fallback |
|-------|-----------|----------|----------|
| Steering file not found | sm-core.md | Log warning | Use inline defaults in sm-core.md |
| Phase file parse error | Phase loader | Log error, skip malformed sections | Execute with available content |
| Parallel timeout | Fan-out engine | Cancel timed-out agent after 5min | Fall back to sequential |
| Fan-in conflict | Fan-in validator | Log conflict, retry conflicting branch | Max 2 retries, then manual |
| KB unavailable | Context builder | Skip L1 context | Agent works with L0 only |
| STATUS.json corrupted | Status manager | Delete and rebuild from file scan | Scan documents/ directory |
| Pattern detection fails | Pattern selector | Default to "monolith" | Log for debugging |

---

## 7. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Steering files contain sensitive workflow logic | Files are local (.kiro/steering/), not exposed externally |
| Pattern catalog could be manipulated | Read-only during execution, only SM can modify |
| Parallel execution could expose race conditions | Atomic STATUS.json updates, separate output directories |
| KB contains full document content | KB access controlled by MCP server authentication |

---

## 8. Testing Strategy

| Test Type | Scope | Approach |
|-----------|-------|----------|
| Unit | Individual steering file loading | Verify each file loads correctly in isolation |
| Integration | Phase execution with modular setup | Run full phase with steering files |
| Regression | Full pipeline comparison | Compare output of modular vs monolithic for same ticket |
| Performance | Token measurement | Measure token count before/after modularization |
| Parallel | Fan-out/fan-in | Test concurrent agent execution with mock agents |
| Failover | Missing file scenarios | Remove steering files, verify graceful degradation |

---

## 9. Appendix

### 9.1 Token Estimation

| Component | Current (monolithic) | Target (modular) | Reduction |
|-----------|---------------------|-------------------|-----------|
| SM prompt base | ~15,000 tokens | ~3,000 tokens (sm-core.md) | 80% |
| Phase-specific | (included in base) | ~5,000 tokens (1 phase file) | N/A |
| Shared utilities | (included in base) | ~2,000 tokens (loaded on demand) | N/A |
| **Total per invocation** | **~15,000 tokens** | **~8,000 tokens** | **47%** |

### 9.2 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture-overview.png](diagrams/architecture-overview.png) | [architecture-overview.drawio](diagrams/architecture-overview.drawio) |
| 2 | Component Diagram | [component-diagram.png](diagrams/component-diagram.png) | [component-diagram.drawio](diagrams/component-diagram.drawio) |

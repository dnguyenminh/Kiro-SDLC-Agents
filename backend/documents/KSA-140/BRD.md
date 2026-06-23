# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-140: Refactor Steering Files để Tối Ưu Token Usage

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-140 |
| Title | Refactor Steering Files để Tối Ưu Token Usage |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-23 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | Duc Nguyen Minh – Technical Lead | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-23 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-140 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request refactors the `.kiro/steering/` and `.kiro/agents/` files to optimize token consumption when agents are invoked. Currently, steering files are loaded into agent context on every invocation, consuming significant tokens even when the content is irrelevant to the current task. The refactoring restructures these files using conditional inclusion (`inclusion: manual`), file splitting, deduplication, and content compression to minimize token waste.

Key areas:
- Consolidate overlapping steering rules across multiple files
- Add `inclusion: manual` frontmatter to context-heavy files that are only needed in specific scenarios
- Split large agent prompt files into modular sections
- Remove redundant/duplicate content between steering files and agent prompts
- Establish a token budget framework for steering file management

### 1.2 Out of Scope

- Changing agent behavior or capabilities (only restructuring how instructions are delivered)
- Modifying the Kiro platform's steering file loading mechanism
- Creating new agents or removing existing agents
- Changing the SDLC pipeline workflow logic

### 1.3 Preliminary Requirement

- Understanding of current token consumption per agent invocation (baseline measurement)
- Knowledge of which steering files are loaded by default vs. manually included
- Kiro platform support for `inclusion: manual` frontmatter in steering files

---

## 2. Business Requirements

### 2.1 High Level Process Map

The refactoring follows a systematic approach: audit current steering files → measure token usage → identify optimization opportunities → restructure files → validate token savings → document new conventions.

![Business Flow](diagrams/business-flow.png)

![Use Case Diagram](diagrams/use-case.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As an AI agent, I want only relevant steering content loaded into my context so that I have more token budget for actual work | MUST HAVE | KSA-140 |
| 2 | As a developer, I want steering files organized by concern with clear inclusion rules so that I can maintain them efficiently | MUST HAVE | KSA-140 |
| 3 | As the SM agent, I want large reference sections (workflow details, quality gates) available on-demand rather than always-loaded so that my base context is smaller | MUST HAVE | KSA-140 |
| 4 | As any agent, I want shared rules (code standards, file writing) deduplicated into single-source files so that updates propagate consistently | SHOULD HAVE | KSA-140 |
| 5 | As a developer, I want a token budget guideline for steering files so that new additions don't regress token usage | SHOULD HAVE | KSA-140 |
| 6 | As the system, I want agent prompts to reference steering files via inclusion rather than duplicating content so that maintenance is simplified | SHOULD HAVE | KSA-140 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Audit all files in `.kiro/steering/` and `.kiro/agents/prompts/` — measure character count and token estimate per file

**Step 2:** Categorize each file by usage frequency: always-needed (default inclusion) vs. scenario-specific (manual inclusion)

**Step 3:** Identify content duplication between steering files and agent prompt files

**Step 4:** Restructure files:
- Add `inclusion: manual` to scenario-specific files
- Merge overlapping files into consolidated versions
- Extract shared rules into reusable steering files
- Compress verbose instructions into concise directives

**Step 5:** Update agent `.md` files to reference restructured steering files

**Step 6:** Validate: invoke each agent and verify correct behavior with reduced token load

**Step 7:** Document conventions for future steering file additions

> **Note:** The refactoring must NOT change agent behavior — only reduce token consumption while maintaining identical functionality.

---

#### STORY 1: Conditional Loading of Steering Content

> As an AI agent, I want only relevant steering content loaded into my context so that I have more token budget for actual work

**Requirement Details:**

1. Steering files that are only needed in specific scenarios MUST have `inclusion: manual` frontmatter
2. Files with `inclusion: manual` are NOT loaded by default — only when explicitly referenced via `contextFiles` in agent invocation
3. Files without `inclusion` frontmatter (or with `inclusion: auto`) are loaded for every agent invocation
4. The categorization must be based on actual usage patterns across the SDLC pipeline

**Current State (Before):**

| File | Chars | Est. Tokens | Loaded | Actually Needed |
|------|-------|-------------|--------|-----------------|
| orchestration.md | ~8,000 | ~2,000 | Always | Only when debugging orchestration |
| drawio.md | ~12,000 | ~3,000 | Always | Only when creating diagrams |
| indexing-guide.md | ~6,000 | ~1,500 | Always | Only when indexing code |
| jira-workflow.md | ~4,000 | ~1,000 | Always | Only when transitioning tickets |
| code-standards.md | ~3,000 | ~750 | Always | Only for DEV/SA agents |
| concise-responses.md | ~500 | ~125 | Always | Always (keep default) |
| sm-default-agent.md | ~800 | ~200 | Always | Always (keep default) |

**Target State (After):**

| File | Inclusion | Loaded When |
|------|-----------|-------------|
| orchestration.md | manual | Debugging orchestration issues |
| drawio.md | manual | Agent needs to create diagrams |
| indexing-guide.md | manual | Code indexing requested |
| jira-workflow.md | manual | Jira transitions needed |
| code-standards.md | manual | DEV/SA writing code |
| concise-responses.md | auto (default) | Always |
| sm-default-agent.md | auto (default) | Always |
| file-writing.md | auto (default) | Always |

**Acceptance Criteria:**

1. Files marked `inclusion: manual` are NOT loaded into agent context by default
2. Agent behavior remains identical when manual files are explicitly included
3. Base token consumption per agent invocation reduced by ≥40%
4. No regression in agent capabilities (all SDLC phases still work correctly)

---

#### STORY 2: Organized File Structure with Clear Conventions

> As a developer, I want steering files organized by concern with clear inclusion rules so that I can maintain them efficiently

**Requirement Details:**

1. Each steering file MUST have a frontmatter block with `inclusion` and `description` fields
2. File naming convention: `{concern}.md` (e.g., `drawio.md`, `code-standards.md`)
3. Files should be single-concern — one file should not mix unrelated rules
4. A README or manifest file should document all steering files and their inclusion rules

**Data Fields (Frontmatter):**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| inclusion | String | Yes | Loading strategy: `auto` or `manual` | `manual` |
| description | String | Yes | When/why this file should be included | `Draw.io diagram creation rules. Activate when agent needs to create .drawio files.` |

**Acceptance Criteria:**

1. All steering files have consistent frontmatter with `inclusion` and `description`
2. File naming follows `{concern}.md` convention
3. No file mixes unrelated concerns (single responsibility)
4. `.kiro/.sdlc-manifest.json` or equivalent documents all files and their roles

---

#### STORY 3: SM Agent Context Optimization

> As the SM agent, I want large reference sections (workflow details, quality gates) available on-demand rather than always-loaded so that my base context is smaller

**Requirement Details:**

1. The SM agent prompt (`sm-agent.md`) is the largest agent file (~15,000+ tokens)
2. Sections that are only needed during specific phases should be extractable:
   - Detailed quality gate checklists → only needed during verification
   - Jira transition rules → only needed when transitioning
   - Feedback loop logic → only needed during Phase 3.5
   - Document attachment rules → only needed after phase completion
3. Core SM logic (phase detection, status management, user interaction) stays in main prompt
4. Phase-specific details are loaded via `contextFiles` when that phase is active

**Acceptance Criteria:**

1. SM base prompt reduced by ≥30% in token count
2. Phase-specific content available via contextFiles when needed
3. SM still correctly identifies current phase and proposes next steps
4. No loss of quality gate enforcement

---

#### STORY 4: Deduplication of Shared Rules

> As any agent, I want shared rules (code standards, file writing) deduplicated into single-source files so that updates propagate consistently

**Requirement Details:**

1. Identify rules that appear in multiple agent prompts (e.g., "use fs_write not echo", "Vietnamese communication")
2. Extract shared rules into dedicated steering files
3. Agent prompts reference shared files instead of duplicating content
4. When a shared rule changes, all agents automatically get the update

**Acceptance Criteria:**

1. No rule appears in more than one file (single source of truth)
2. Shared rules are in `.kiro/steering/` (not duplicated in agent prompts)
3. Updating a shared rule in one place affects all agents that use it

---

#### STORY 5: Token Budget Guidelines

> As a developer, I want a token budget guideline for steering files so that new additions don't regress token usage

**Requirement Details:**

1. Establish maximum token budgets per category:
   - Always-loaded steering files: total ≤ 2,000 tokens
   - Agent base prompt: ≤ 8,000 tokens (excluding contextFiles)
   - Manual steering files: no hard limit (loaded on-demand)
2. Document the budget in a steering file or README
3. Provide a script or command to measure current token usage

**Acceptance Criteria:**

1. Token budget documented and accessible to developers
2. Current state meets the defined budgets after refactoring
3. Measurement tool/script available to check compliance

---

#### STORY 6: Reference-Based Agent Prompts

> As the system, I want agent prompts to reference steering files via inclusion rather than duplicating content so that maintenance is simplified

**Requirement Details:**

1. Agent prompt files (`.kiro/agents/prompts/*.md`) should contain only agent-specific logic
2. Common patterns (diagram creation, file writing, Jira interaction) should be in steering files
3. Agent JSON config (`.kiro/agents/*.json`) specifies which steering files to include
4. Kiro platform's `contextFiles` mechanism is used for dynamic inclusion

**Acceptance Criteria:**

1. Agent prompts contain only role-specific instructions
2. Common patterns live in steering files (single source)
3. Agent behavior unchanged after restructuring

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Kiro Platform | System | N/A | Must support `inclusion: manual` frontmatter and `contextFiles` in agent invocation |
| Existing Steering Files | System | N/A | All current `.kiro/steering/*.md` files are input to this refactoring |
| Agent Prompt Files | System | N/A | All `.kiro/agents/prompts/*.md` files may be restructured |
| SDLC Pipeline | System | N/A | Pipeline must continue working after refactoring (regression test) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter | Duc Nguyen Minh | Feature owner, requirements validation | Jira reporter |
| Technical Lead | Duc Nguyen Minh | Architecture review, token measurement | Jira reporter |
| AI Agents | SM, BA, SA, QA, DEV, DevOps, TA, UI | Affected by steering changes | System users |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Agent behavior regression after removing always-loaded content | High | Medium | Thorough testing of each agent after refactoring; rollback plan |
| Manual inclusion forgotten during agent invocation → missing context | Medium | Medium | Document which files each phase needs; SM orchestration handles inclusion |
| Over-optimization removes content that's needed more often than expected | Medium | Low | Start conservative — only mark clearly scenario-specific files as manual |
| Token measurement inaccuracy (char-to-token ratio varies) | Low | Medium | Use actual tokenizer for measurement, not estimates |
| Kiro platform changes steering loading behavior in future updates | Medium | Low | Document assumptions about platform behavior; test after updates |

### 5.2 Assumptions

- Kiro platform correctly respects `inclusion: manual` frontmatter (files are not loaded unless explicitly referenced)
- Token savings from reduced context directly translate to more available budget for agent work
- Agent prompts can reference steering files via `contextFiles` without additional platform changes
- The current steering file structure has significant redundancy (estimated 30-50% duplicate/unnecessary content)
- All agents are invoked through the SM pipeline (SM controls contextFiles for sub-agents)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | ≥40% reduction in base token consumption | Measured as total tokens loaded before agent starts working |
| Performance | No increase in agent invocation latency | File loading should not be slower with manual inclusion |
| Maintainability | Single source of truth for all rules | No duplicated content across files |
| Maintainability | Clear documentation of file purposes | Every file has frontmatter explaining when to include |
| Reliability | Zero regression in agent capabilities | All SDLC phases produce identical quality output |
| Scalability | Token budget framework prevents future bloat | New steering additions must fit within budget |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-140 | Refactor Steering Files để Tối Ưu Token Usage | Done | Task | Main ticket |
| KSA-139 | 2-Level Agent Tool Cache Registry | To Do | Task | Related — both optimize token usage |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Steering File | Markdown file in `.kiro/steering/` that provides rules/guidelines loaded into agent context |
| Token | Unit of text processing in LLM context — roughly 4 characters per token |
| Inclusion Mode | Whether a steering file is loaded automatically (`auto`) or on-demand (`manual`) |
| Context Budget | Maximum number of tokens available for agent instructions before actual work begins |
| Frontmatter | YAML metadata block at the top of a markdown file (between `---` delimiters) |
| contextFiles | Kiro mechanism to explicitly include additional files in agent context during invocation |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Agent Token-Optimized Workflows | documents/agent-token-optimized-workflows.md |
| Current Steering Files | .kiro/steering/*.md |
| Agent Prompts | .kiro/agents/prompts/*.md |
| SM Agent Configuration | .kiro/agents/sm-agent.json |

### Current Steering File Inventory

| # | File | Est. Tokens | Current Inclusion | Recommended |
|---|------|-------------|-------------------|-------------|
| 1 | agent-self-learning.md | ~500 | auto | manual |
| 2 | backend-structure.md | ~800 | auto | manual |
| 3 | code-intelligence.md | ~1,000 | auto | manual |
| 4 | code-standards.md | ~750 | auto | manual |
| 5 | concise-responses.md | ~125 | auto | auto (keep) |
| 6 | drawio.md | ~3,000 | auto | manual |
| 7 | file-writing.md | ~300 | auto | auto (keep) |
| 8 | frontend-structure.md | ~600 | auto | manual |
| 9 | indexing-guide.md | ~1,500 | auto | manual |
| 10 | jira-rules.md | ~400 | auto | manual |
| 11 | jira-workflow.md | ~1,000 | auto | manual |
| 12 | kotlin-code-standards.md | ~800 | auto | manual |
| 13 | manual-web-test.md | ~500 | auto | manual |
| 14 | no-workaround-rule.md | ~200 | auto | auto (keep) |
| 15 | orchestration.md | ~2,000 | manual | manual (keep) |
| 16 | release-versioning.md | ~400 | auto | manual |
| 17 | sm-default-agent.md | ~200 | auto | auto (keep) |
| 18 | ui-relative-paths.md | ~300 | auto | manual |

**Estimated savings:** ~11,000 tokens moved from always-loaded to on-demand = ~40-50% reduction in base context.

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |

# Functional Specification Document (FSD)

## Kiro SDLC Agents — KSA-233: LangGraph Self-Correction Patterns: Auto-Retry, Verify Node, Strategy Switch

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-233 |
| Title | LangGraph Self-Correction Patterns: Auto-Retry, Verify Node, Strategy Switch |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-233.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | BA Agent | Initiate document from BRD KSA-233 |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Self-Correction Patterns for the LangGraph SDLC pipeline. It defines how Auto-Retry with Backoff, Verification Nodes, and Strategy Switch mechanisms operate within the existing pipeline infrastructure provided by KSA-210.

### 1.2 Scope

- **Auto-Retry with Backoff**: Automatic re-execution of failed nodes with exponential delay (1s, 2s)
- **Verification Nodes**: Dedicated graph nodes that validate agent output quality before proceeding
- **Strategy Switch**: Alternate prompt/approach when repeated verification failures occur
- **Pipeline Pause**: Human intervention flow when all automated strategies are exhausted
- **Stream Events**: Real-time UI notifications for all self-correction actions

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Auto-Retry | Automatic re-execution of a failed node without human intervention |
| Backoff | Increasing delay between retry attempts (exponential: 1s, 2s) |
| Verify Node | A dedicated graph node that validates the output of the preceding agent node |
| Strategy Switch | Changing to an alternate prompt/approach after repeated verification failures |
| Human Intervention | Pipeline pause requiring a human operator to provide guidance before resuming |
| Quality Gate | Existing approval checkpoints (separate from verify nodes — QG requires human approval, verify is automatic) |
| BaseNode | Abstract class in `base-node.ts` providing timeout, error handling, and MCP tool call wrappers |
| PipelineState | Typed state channels for the SDLC pipeline StateGraph defined in `state.ts` |
| StreamHandler | Service emitting real-time events to the Chat Panel UI |
| NODE_TIMEOUT_MS | Maximum node execution time: 300,000ms (300s) |
| TOOL_CALL_TIMEOUT_MS | Per-tool call timeout: 60,000ms (60s) |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-233/BRD.md |
| BaseNode Source | kiro-sdlc-agents/src/langgraph/nodes/base-node.ts |
| PipelineState Source | kiro-sdlc-agents/src/langgraph/state.ts |
| Edges Source | kiro-sdlc-agents/src/langgraph/edges.ts |
| SDLC Graph Source | kiro-sdlc-agents/src/langgraph/graphs/sdlc-graph.ts |
| LangGraph Pipeline TDD | documents/KSA-210/TDD.md |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

*[Edit in draw.io](diagrams/system-context.drawio)*

The self-correction patterns operate within the LangGraph SDLC Pipeline. External actors and systems:

- **Pipeline Operator (Human)**: Invokes pipeline, receives stream events, provides intervention when paused
- **Chat Panel UI**: Displays retry/verify/strategy events in real-time via StreamHandler
- **LLM Provider**: Provides chat completions for agent nodes and verify nodes
- **MCP Bridge**: Tool call interface for agent nodes (file operations, Jira, KB)
- **WorkspaceCheckpointer**: Persists pipeline state across pauses for resume capability
- **Agent Nodes (BA, SA, DEV, QA)**: Existing nodes wrapped by self-correction layer

### 2.2 System Architecture

The self-correction patterns add three layers around existing agent node execution:

1. **Retry Layer** (in `BaseNode.run()`): Catches errors from `execute()` and retries with exponential backoff
2. **Verify Layer** (new `VerifyNode` class): Placed after each agent node in the graph to validate output quality
3. **Strategy Layer** (in routing edges): Switches to alternate prompts after repeated verify failures, or pauses for human intervention

The existing graph structure (conditional edges in `edges.ts`) is extended with verify node routing. The existing `PipelineState` (in `state.ts`) is extended with verify/strategy fields.

---

## 3. Functional Requirements

### 3.1 Feature: Auto-Retry with Exponential Backoff

**Source:** BRD Story 1

#### 3.1.1 Description

When any agent node's `execute()` method throws an error, the `run()` wrapper in `BaseNode` automatically retries the execution with exponential backoff delays. This handles transient failures (LLM timeouts, network issues, temporary MCP tool unavailability) without halting the entire pipeline.

#### 3.1.2 Use Case: UC-1 — Agent Node Auto-Retry on Error

**Use Case ID:** UC-1
**Actor:** Pipeline Operator (indirect — system acts automatically)
**Preconditions:**
- Pipeline is running (`pipelineStatus: "running"`)
- An agent node is executing via `BaseNode.run()`
**Postconditions:**
- Node succeeds after retry → pipeline continues normally
- All retries exhausted → node marked as failed, `pipelineStatus: "failed"`

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | BaseNode.run() | Calls `this.execute(state)` wrapped in `withTimeout()` |
| 2 | | execute() | Throws an Error (any subclass) |
| 3 | | Retry Handler | Catches error, checks retryCount < maxRetries (2) |
| 4 | | StreamHandler | Emits `retry` event: {nodeId, attempt: 1, maxAttempts: 2, delayMs: 1000} |
| 5 | | Delay | Waits 1000ms (exponential backoff: 2^0 * 1000) |
| 6 | | BaseNode.run() | Re-calls `this.execute(state)` |
| 7 | | execute() | Succeeds — returns Partial<PipelineState> |
| 8 | | StreamHandler | Emits `complete` event with duration |
| 9 | | Return | Returns result with `lastUpdatedAt` updated |

**Alternative Flow AF-1: Second Retry Required**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Step 6 execute() throws again | Emit retry event (attempt: 2, delayMs: 2000), wait 2000ms, re-execute |

**Alternative Flow AF-2: Immediate Success (No Retry)**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-2 | Step 1 execute() succeeds on first try | Skip retry logic entirely, emit complete, return result |

**Exception Flow EF-1: All Retries Exhausted**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | execute() fails on all 3 attempts (initial + 2 retries) | Create PipelineError with `recoverable: false`, emit error event, return `{pipelineStatus: "failed", errors: [...]}` |

**Exception Flow EF-2: Non-Recoverable Error**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-2 | Error is instance of `NonRecoverableError` (missing config, invalid state) | Skip retry, immediately return `{pipelineStatus: "failed"}` with error details |

**Exception Flow EF-3: Timeout During Retry**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-3 | `withTimeout()` fires during retry attempt | Count as failed attempt, increment retryCount, proceed to next retry or exhaust |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-1 | Maximum retry attempts per node per execution = 2 (total attempts = 3 including initial) | BRD Story 1 |
| BR-2 | Backoff strategy: exponential — delay = 2^(attempt-1) * 1000ms (1s, 2s) | BRD Story 1 |
| BR-3 | Retry counter tracked in `state.retryCount[nodeId]` | BRD Story 1 |
| BR-4 | Total retry overhead (1s + 2s = 3s) must not exceed NODE_TIMEOUT_MS (300s) | BRD NFR |
| BR-5 | Retry counter resets when pipeline is re-invoked with a new threadId | BRD Story 1 |
| BR-6 | Non-recoverable errors (missing configuration, invalid state) bypass retry entirely | BRD Story 1 |
| BR-7 | Each retry attempt uses the same input state (no partial state from failed attempts persisted) | BRD NFR |

#### 3.1.4 Data Specifications

**Input Data (State Fields Read):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| retryCount | Record<string, number> | Yes | Non-negative integers | Current retry count per node |
| pipelineStatus | PipelineStatus | Yes | Must be "running" | Pipeline must be active |
| currentStreamId | string or null | No | UUID format if present | Stream channel for events |

**Output Data (State Fields Written):**

| Field | Type | Description |
|-------|------|-------------|
| retryCount | Record<string, number> | Incremented for the current nodeId |
| pipelineStatus | PipelineStatus | "failed" if all retries exhausted |
| errors | PipelineError[] | Appended with error details on failure |
| lastUpdatedAt | string | ISO timestamp of last state change |

**Stream Event: `retry`**

| Field | Type | Description |
|-------|------|-------------|
| type | "retry" | Event type identifier |
| nodeId | string | Which node is retrying |
| attempt | number | Current attempt number (1 or 2) |
| maxAttempts | number | Maximum retry attempts (2) |
| delayMs | number | Backoff delay before this retry (1000 or 2000) |
| error | string | Error message from failed attempt |
| timestamp | string | ISO timestamp |

---

### 3.2 Feature: Verification Nodes

**Source:** BRD Stories 2, 3

#### 3.2.1 Description

After each agent node completes successfully (passes retry layer), its output is routed to a dedicated Verification Node. The VerifyNode evaluates output quality against configurable criteria and either approves (continue) or rejects (send feedback back to agent for retry).

#### 3.2.2 Use Case: UC-2 — Output Verification After Agent Execution

**Use Case ID:** UC-2
**Actor:** System (automatic — no human interaction)
**Preconditions:**
- Agent node has completed successfully (output in `state.agentOutputs`)
- VerifyNode is registered in the graph after the agent node
- Verify criteria configured for the agent's phase
**Postconditions:**
- Verification passes → pipeline continues to next node (Quality Gate or next agent)
- Verification fails → agent re-executes with feedback incorporated

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | VerifyNode | Receives state after agent node completion |
| 2 | | VerifyNode | Extracts last entry from `state.agentOutputs` |
| 3 | | VerifyNode | Loads verification criteria for current phase |
| 4 | | VerifyNode | Evaluates output against criteria (LLM call or rule-based) |
| 5 | | VerifyNode | Output meets all criteria → set `verifyPassed: true` |
| 6 | | StreamHandler | Emits `verify` event: {nodeId, passed: true} |
| 7 | | Edge Router | Routes to next node (quality gate or subsequent phase) |

**Alternative Flow AF-3: Verification Fails — Agent Retries**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-3 | Step 4: output fails one or more criteria | Set `verifyPassed: false`, set `verifyFeedback: "specific feedback"`, emit verify event with feedback, increment `verifyAttempts[nodeId]`, route back to agent node |

**Alternative Flow AF-4: Second Verify Failure — Continue to Agent**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-4 | AF-3 occurs and `verifyAttempts[nodeId] < maxVerifyAttempts (2)` | Agent re-executes with feedback in state, output re-verified |

**Exception Flow EF-4: VerifyNode Itself Errors**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-4 | VerifyNode.execute() throws an error | Treat as verification pass (don't block pipeline on verify infrastructure failure), log warning, continue |

**Exception Flow EF-5: Agent Output Empty/Null**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-5 | `state.agentOutputs` last entry is empty or null | Automatic verify fail with feedback "No output produced by agent node" |

**Exception Flow EF-6: No Criteria Configured**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-6 | Verification criteria not defined for this phase | Skip verification, pass through (treat as verify pass) |

#### 3.2.3 Use Case: UC-3 — Strategy Switch After Repeated Verify Failures

**Use Case ID:** UC-3
**Actor:** System (automatic) → Pipeline Operator (for human intervention)
**Preconditions:**
- `verifyAttempts[nodeId] >= maxVerifyAttempts (2)`
- Primary strategy has failed twice
**Postconditions:**
- Alternate strategy attempted → if passes, pipeline continues
- Alternate strategy also fails → pipeline pauses for human intervention

**Main Flow (Strategy Switch):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Edge Router | Detects `verifyAttempts[nodeId] >= 2` after verify failure |
| 2 | | Strategy Manager | Sets `activeStrategy[nodeId] = "alternate"` |
| 3 | | StreamHandler | Emits `strategy_switch` event: {nodeId, from: "primary", to: "alternate"} |
| 4 | | Agent Node | Re-executes with alternate strategy flag in state |
| 5 | | VerifyNode | Verifies output from alternate strategy |
| 6 | | VerifyNode | Verification passes → continue normally |

**Alternative Flow AF-5: Alternate Strategy Also Fails**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-5 | Step 5: alternate strategy output fails verification | Set `pipelineStatus: "paused"`, set `approvalRequired: true`, emit `human_intervention_required` event with full context, save checkpoint |

**Exception Flow EF-7: No Alternate Strategy Defined**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-7 | Alternate strategy not configured for this node | Skip strategy switch, go directly to human intervention (AF-5 path) |

#### 3.2.4 Use Case: UC-4 — Human Intervention and Pipeline Resume

**Use Case ID:** UC-4
**Actor:** Pipeline Operator
**Preconditions:**
- `pipelineStatus: "paused"`
- `approvalRequired: true`
- Checkpoint persisted via WorkspaceCheckpointer
**Postconditions:**
- Human provides feedback → pipeline resumes at failed node with guidance
- Human rejects → pipeline terminates

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | StreamHandler | Emits `human_intervention_required`: {nodeId, failedStrategies, verifyHistory} |
| 2 | Operator reviews context | | Views which node failed, what was tried, all verify feedback |
| 3 | Operator provides feedback | | Sets `userFeedback` and `approvalDecision: "revise"` |
| 4 | | Pipeline | Resumes from checkpoint with `userFeedback` in state |
| 5 | | Agent Node | Re-executes with human feedback incorporated |
| 6 | | VerifyNode | Verifies output |
| 7 | | Pipeline | Continues normally if passes |

**Alternative Flow AF-6: Operator Rejects**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-6 | Step 3: Operator sets `approvalDecision: "reject"` | Pipeline terminates, `pipelineStatus: "failed"` |

#### 3.2.5 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-8 | Maximum verify attempts before strategy switch = 2 | BRD Story 2 |
| BR-9 | Verify criteria are configurable per phase (not hardcoded) | BRD Story 2 |
| BR-10 | VerifyNode must complete within NODE_TIMEOUT_MS (300s) | BRD NFR |
| BR-11 | Verify feedback must be non-empty string when `verifyPassed: false` | BRD Story 2 |
| BR-12 | VerifyNode error → treat as pass (fail-open for infrastructure issues) | BRD Story 2 |
| BR-13 | Strategy switch triggers after exactly 2 verify failures (not 1, not 3) | BRD Story 3 |
| BR-14 | If alternate strategy not defined → skip directly to human intervention | BRD Story 3 |
| BR-15 | Pipeline pause sets `pipelineStatus: "paused"` AND `approvalRequired: true` | BRD Story 4 |
| BR-16 | Pipeline remains paused indefinitely until human responds (no auto-timeout) | BRD Story 4 |
| BR-17 | Human feedback stored in `state.userFeedback`, pipeline resumes with original strategy + guidance | BRD Story 4 |
| BR-18 | Checkpoint persisted on pause — pipeline survives process restart | BRD Story 4 |

#### 3.2.6 Data Specifications

**New State Fields (added to PipelineState):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| verifyPassed | boolean | Yes | true/false | Whether last verification succeeded |
| verifyFeedback | string or null | No | Non-empty when verifyPassed=false | Specific feedback for agent retry |
| verifyAttempts | Record<string, number> | Yes | Non-negative integers | Verify retry count per node |
| maxVerifyAttempts | number | Yes | Positive integer, default: 2 | Max verify retries before strategy switch |
| activeStrategy | Record<string, string> | Yes | "primary" or "alternate" | Current strategy per node |
| strategyHistory | Array<StrategyEvent> | No | Valid StrategyEvent objects | History of strategy switches |

**StrategyEvent Type:**

| Field | Type | Description |
|-------|------|-------------|
| nodeId | string | Which node switched strategy |
| strategy | string | Strategy name ("primary" or "alternate") |
| timestamp | string | ISO timestamp of switch |
| reason | string | Why the switch occurred |

**Stream Event: `verify`**

| Field | Type | Description |
|-------|------|-------------|
| type | "verify" | Event type identifier |
| nodeId | string | Which verify node ran |
| passed | boolean | Verification result |
| feedback | string or null | Feedback if failed |
| attempt | number | Current verify attempt |
| timestamp | string | ISO timestamp |

**Stream Event: `strategy_switch`**

| Field | Type | Description |
|-------|------|-------------|
| type | "strategy_switch" | Event type identifier |
| nodeId | string | Which node is switching strategy |
| fromStrategy | string | Previous strategy ("primary") |
| toStrategy | string | New strategy ("alternate") |
| reason | string | Trigger reason |
| timestamp | string | ISO timestamp |

**Stream Event: `human_intervention_required`**

| Field | Type | Description |
|-------|------|-------------|
| type | "human_intervention_required" | Event type identifier |
| nodeId | string | Which node requires intervention |
| failedStrategies | string[] | List of strategies that failed |
| verifyHistory | Array<{attempt, feedback}> | All verify feedback messages |
| context | string | Summary of what was tried |
| timestamp | string | ISO timestamp |

#### 3.2.7 Sequence Diagram: Self-Correction Full Cycle

![Sequence - Auto-Retry](diagrams/sequence-auto-retry.png)

*[Edit in draw.io](diagrams/sequence-auto-retry.drawio)*

![Sequence - Verify and Strategy Switch](diagrams/sequence-verify-strategy.png)

*[Edit in draw.io](diagrams/sequence-verify-strategy.drawio)*

---

### 3.3 Feature: Stream Events for Self-Correction UI

**Source:** BRD Story 5

#### 3.3.1 Description

The existing StreamHandler is extended with four new event types (`retry`, `verify`, `strategy_switch`, `human_intervention_required`) enabling the Chat Panel to display self-correction progress in real-time.

#### 3.3.2 Use Case: UC-5 — Real-Time Self-Correction Event Display

**Use Case ID:** UC-5
**Actor:** Pipeline Operator (via Chat Panel UI)
**Preconditions:** Pipeline is running, `currentStreamId` is set
**Postconditions:** All self-correction events are visible in Chat Panel

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | StreamHandler | Emits event with type + metadata to `currentStreamId` channel |
| 2 | | Chat Panel | Receives SSE/WebSocket event |
| 3 | Operator views | | Sees retry badge, verify status, strategy switch notification |

**UI Elements:**

| No. | Element | Type | Required | Behavior | Validation |
|-----|---------|------|----------|----------|------------|
| 1 | Retry Badge | Badge/Label | Yes | Shows "Retry 1/2" with countdown timer | Updates on each retry event |
| 2 | Verify Status | Icon + Label | Yes | Shows check or X after each verify | Green check for pass, red X for fail |
| 3 | Verify Feedback | Expandable Panel | No | Shows feedback text when verify fails | Only visible on verify failure |
| 4 | Strategy Switch Banner | Banner | No | "Switching to alternate strategy..." | Disappears after 5s |
| 5 | Human Intervention Modal | Modal Dialog | No | "Pipeline paused — intervention needed" with context | Blocks UI until response |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-19 | Events emitted in real-time (no batching/buffering) | BRD Story 5 |
| BR-20 | Events follow existing StreamHandler event format (type + nodeId + metadata) | BRD Story 5 |
| BR-21 | All events include nodeId and timestamp | BRD Story 5 |

---

## 4. Data Model

### 4.1 State Model (PipelineState Extensions)

The following fields are added to the existing `PipelineAnnotation` in `state.ts`:

| Attribute | Type | Required | Default | Business Rule | Description |
|-----------|------|----------|---------|---------------|-------------|
| verifyPassed | boolean | Yes | true | BR-11 | Last verification result |
| verifyFeedback | string or null | No | null | BR-11 | Specific feedback when verify fails |
| verifyAttempts | Record<string, number> | Yes | {} | BR-8 | Verify retry count per node |
| maxVerifyAttempts | number | Yes | 2 | BR-8 | Max verify retries before strategy switch |
| activeStrategy | Record<string, string> | Yes | {} | BR-13, BR-14 | Current strategy per node ("primary"/"alternate") |
| strategyHistory | StrategyEvent[] | No | [] | BR-13 | History log of strategy switches |

### 4.2 Verification Criteria Configuration

Verify criteria are stored as configuration objects (not hardcoded). Each phase defines its criteria:

| Phase | Criteria Key | Description | Example Check |
|-------|-------------|-------------|---------------|
| requirements | brd_completeness | BRD has minimum user stories | agentOutput contains >= 3 "As a" patterns |
| specification | fsd_use_cases | FSD has use cases with flows | agentOutput contains "Main Flow" + "Alternative" |
| design | tdd_architecture | TDD has architecture section | agentOutput contains "Architecture" + code blocks |
| test_planning | stp_coverage | STP covers all BRD stories | RTM present with all story IDs |
| implementation | code_compiles | Code passes lint/compile | No errors in build output |
| user_guide | ug_sections | UG has required sections | Contains "Installation" + "Configuration" + "Usage" |

### 4.3 Entity Relationships

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| PipelineState | PipelineError[] | 1:N | Each pipeline run can have multiple errors from retries |
| PipelineState | AgentOutput[] | 1:N | Each agent produces output for verify nodes to check |
| PipelineState | StrategyEvent[] | 1:N | Strategy switches are logged chronologically |
| VerifyNode | VerifyCriteria | N:1 | Each verify node uses criteria for its phase |
| BaseNode (agent) | VerifyNode | 1:1 | Each agent node has a corresponding verify node |

---

## 5. Integration Specifications

### 5.1 External System: LLM Provider

| Attribute | Value |
|-----------|-------|
| Purpose | Powers agent execution and verify node evaluation |
| Direction | Outbound |
| Data Format | JSON (OpenAI-compatible chat completion) |
| Frequency | Real-time (per agent/verify execution) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| System prompt + user prompt | Chat completion response | Send/Receive | BR-10: must complete within 300s |
| Verify criteria + agent output | Pass/fail + feedback | Send/Receive | BR-11: feedback non-empty on fail |

### 5.2 External System: WorkspaceCheckpointer

| Attribute | Value |
|-----------|-------|
| Purpose | Persists pipeline state for resume after pause/crash |
| Direction | Bidirectional |
| Data Format | JSON-serializable PipelineState |
| Frequency | On every state transition and on pause |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Full PipelineState snapshot | Persisted checkpoint | Send | BR-18: must persist on pause |
| threadId | Restored PipelineState | Receive | Resume from exact pause point |

### 5.3 External System: StreamHandler (Chat Panel)

| Attribute | Value |
|-----------|-------|
| Purpose | Real-time event delivery to user interface |
| Direction | Outbound |
| Data Format | Structured event objects (JSON) |
| Frequency | Real-time per self-correction action |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| retry/verify/strategy_switch/human_intervention events | UI renders event | Send | BR-19: no batching |

---

## 6. Processing Logic

### 6.1 Auto-Retry Processing

**Trigger:** `BaseNode.run()` catches an error from `execute()`
**Input:** Current PipelineState, Error object
**Output:** Updated PipelineState (success or failure)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Check if error is NonRecoverableError | If yes → skip retry, return failed state immediately |
| 2 | Read current `retryCount[nodeId]` from state | If field missing → initialize to 0 |
| 3 | Check retryCount < maxRetries (2) | If no → all retries exhausted, return failed state |
| 4 | Calculate delay: `2^retryCount * 1000` ms | Validate delay + elapsed < NODE_TIMEOUT_MS |
| 5 | Emit `retry` stream event | If StreamHandler unavailable → log warning, continue |
| 6 | Wait (delay) using `setTimeout` / `sleep` | If interrupted → treat as failed attempt |
| 7 | Re-invoke `this.execute(state)` with `withTimeout()` | If throws → increment retryCount, go to Step 3 |
| 8 | On success → emit complete, return result | — |

### 6.2 Verification Processing

**Trigger:** Agent node completes successfully, graph routes to VerifyNode
**Input:** PipelineState with agent output in `agentOutputs`
**Output:** Updated PipelineState with verify result

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Extract last entry from `state.agentOutputs` | If empty/null → auto-fail with "No output produced" |
| 2 | Load verify criteria for `state.currentPhase` | If not configured → pass through (skip verify) |
| 3 | Evaluate output against criteria | If VerifyNode itself errors → treat as pass (BR-12) |
| 4 | If pass: set `verifyPassed: true`, emit verify event | — |
| 5 | If fail: set `verifyPassed: false`, set `verifyFeedback` | Feedback must be non-empty (BR-11) |
| 6 | Increment `verifyAttempts[nodeId]` | — |
| 7 | Check `verifyAttempts >= maxVerifyAttempts` | If yes → route to strategy switch (6.3) |
| 8 | Route back to agent with feedback in state | Agent reads `verifyFeedback` to improve output |

### 6.3 Strategy Switch Processing

**Trigger:** `verifyAttempts[nodeId] >= maxVerifyAttempts (2)` after verify failure
**Input:** PipelineState with verify failure context
**Output:** Updated state with alternate strategy active OR pipeline paused

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Check if alternate strategy is defined for nodeId | If not defined → go directly to Step 5 (pause) |
| 2 | Set `activeStrategy[nodeId] = "alternate"` | — |
| 3 | Append to `strategyHistory` | — |
| 4 | Emit `strategy_switch` event, route to agent | Agent checks `activeStrategy` flag |
| 5 | If alternate also fails OR no alternate defined: set `pipelineStatus: "paused"`, `approvalRequired: true` | — |
| 6 | Emit `human_intervention_required` event | Include full context: nodeId, strategies tried, all feedback |
| 7 | Persist checkpoint via WorkspaceCheckpointer | If checkpoint fails → log critical error |

### 6.4 Pipeline Resume Processing

**Trigger:** Human sets `approvalDecision` and `userFeedback` in state
**Input:** Restored PipelineState from checkpoint
**Output:** Pipeline re-enters at failed node with human guidance

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Restore state from WorkspaceCheckpointer | If checkpoint corrupted → pipeline fails |
| 2 | Read `approvalDecision` | If "reject" → terminate pipeline |
| 3 | Read `userFeedback` | Store in state for agent access |
| 4 | Reset `verifyAttempts[nodeId]` to 0 | Fresh start with human guidance |
| 5 | Reset `activeStrategy[nodeId]` to "primary" | Human feedback enhances primary strategy |
| 6 | Set `pipelineStatus: "running"` | — |
| 7 | Route to failed agent node | Agent incorporates userFeedback |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Features |
|------|-------------|----------|
| Pipeline Operator | Read/Write | Start pipeline, view events, provide intervention |
| System (Auto) | Execute | Retry, verify, switch strategies (no human needed) |
| Admin | Admin | Configure verify criteria, set maxRetries, define alternate strategies |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Pipeline State | Internal | Contains execution context, not user PII |
| LLM Prompts/Responses | Internal | May contain code snippets and document content |
| User Feedback | Internal | Human operator guidance text |
| Strategy Configuration | Internal | Prompt templates and approach definitions |
| Stream Events | Internal | Operational telemetry for UI display |

### 7.3 Audit Trail

| Event | Logged Fields | Retention | Business Reason |
|-------|--------------|-----------|-----------------|
| Retry Attempt | nodeId, attempt, error, timestamp | 30 days | Debugging transient failures |
| Verify Result | nodeId, passed, feedback, attempt | 30 days | Quality tracking |
| Strategy Switch | nodeId, from, to, reason, timestamp | 90 days | Pattern analysis |
| Human Intervention | nodeId, feedback, decision, timestamp | 90 days | Audit trail for manual decisions |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Retry backoff overhead minimal | Total retry overhead 3s max (1s + 2s), well within 300s timeout |
| Performance | Verify node fast evaluation | VerifyNode completes within 30s (LLM call or rule-based) |
| Reliability | No data corruption from retries | Each retry starts fresh — no partial state persisted |
| Reliability | Pipeline survives process restart | Checkpoint persists all state on pause |
| Observability | All actions visible in UI | Every retry/verify/switch emits stream event |
| Scalability | Patterns apply to all nodes | BaseNode retry is inherited; VerifyNode is generic |
| Maintainability | Criteria configurable without code changes | Verify criteria and strategies in config files |
| Testability | Full path coverage | 100% coverage for retry/verify/switch logic |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Transient LLM timeout | Warning | "Agent retrying (attempt 1/2)..." | Auto-retry, user sees retry badge |
| All retries exhausted | Critical | "Node {nodeId} failed after 3 attempts" | Pipeline stops, error details in Chat Panel |
| Verification failed | Warning | "Output quality check failed: {feedback}" | Agent retries with feedback |
| Strategy switched | Info | "Trying alternate approach..." | UI shows strategy switch banner |
| Human intervention needed | Critical | "Pipeline paused — your input needed" | Modal with context and input field |
| Resume successful | Info | "Pipeline resumed with your guidance" | Continues normally |
| Checkpoint save failed | Critical | "Unable to save pipeline state" | Log error, attempt in-memory fallback |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Retry attempts | Pipeline Operator | Chat Panel (stream event) | Real-time |
| Verify failures | Pipeline Operator | Chat Panel (stream event) | Real-time |
| Strategy switch | Pipeline Operator | Chat Panel (banner) | Real-time |
| Human intervention required | Pipeline Operator | Chat Panel (modal) + optional webhook | Immediate |
| Pipeline failure (retries exhausted) | Pipeline Operator | Chat Panel (error panel) | Immediate |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-1 | Auto-retry succeeds on first retry | execute() fails once then succeeds | Pipeline continues, retryCount=1 | High |
| TC-2 | Auto-retry succeeds on second retry | execute() fails twice then succeeds | Pipeline continues, retryCount=2 | High |
| TC-3 | All retries exhausted | execute() fails 3 times | pipelineStatus="failed", error emitted | High |
| TC-4 | Non-recoverable error skips retry | NonRecoverableError thrown | Immediate failure, retryCount=0 | High |
| TC-5 | Verify passes on first check | Output meets all criteria | verifyPassed=true, continue | High |
| TC-6 | Verify fails, agent retries with feedback | Output misses criteria | verifyFeedback set, agent re-invoked | High |
| TC-7 | Strategy switch after 2 verify failures | 2 consecutive verify failures | activeStrategy="alternate" | High |
| TC-8 | Alternate strategy succeeds | Alternate output passes verify | Pipeline continues normally | High |
| TC-9 | Human intervention after all strategies fail | Alternate also fails verify | pipelineStatus="paused", event emitted | High |
| TC-10 | Pipeline resume with human feedback | Operator provides feedback | Pipeline resumes at failed node | High |
| TC-11 | VerifyNode itself errors — treated as pass | VerifyNode throws exception | Pipeline continues (fail-open) | Medium |
| TC-12 | No verify criteria configured — skip verify | Phase has no criteria | Pass through, no verify check | Medium |
| TC-13 | Backoff timing correct | Retry events emitted | Delay 1000ms then 2000ms | Medium |
| TC-14 | Stream events emitted correctly | Any self-correction action | Correct event type + metadata | High |
| TC-15 | Checkpoint persisted on pause | Human intervention triggered | State recoverable after restart | High |
| TC-16 | Timeout during retry counts as failure | execute() hangs beyond timeout | Counted as failed attempt | Medium |

---

## 11. State Diagram: Pipeline Self-Correction States

![State - Pipeline Self-Correction](diagrams/state-pipeline.png)

*[Edit in draw.io](diagrams/state-pipeline.drawio)*

The pipeline node execution follows these state transitions:

- **Executing** → (success) → **Verifying**
- **Executing** → (error) → **Retrying**
- **Retrying** → (success) → **Verifying**
- **Retrying** → (max retries) → **Failed**
- **Verifying** → (pass) → **Completed**
- **Verifying** → (fail, attempts < max) → **Executing** (with feedback)
- **Verifying** → (fail, attempts >= max) → **Switching Strategy**
- **Switching Strategy** → (alternate defined) → **Executing** (alternate)
- **Switching Strategy** → (no alternate) → **Paused**
- **Executing (alternate)** → **Verifying**
- **Verifying (alternate)** → (pass) → **Completed**
- **Verifying (alternate)** → (fail) → **Paused**
- **Paused** → (human approve+feedback) → **Executing** (with guidance)
- **Paused** → (human reject) → **Failed**

---

## 12. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence - Auto-Retry | [sequence-auto-retry.png](diagrams/sequence-auto-retry.png) | [sequence-auto-retry.drawio](diagrams/sequence-auto-retry.drawio) |
| 3 | Sequence - Verify & Strategy | [sequence-verify-strategy.png](diagrams/sequence-verify-strategy.png) | [sequence-verify-strategy.drawio](diagrams/sequence-verify-strategy.drawio) |
| 4 | State - Pipeline Self-Correction | [state-pipeline.png](diagrams/state-pipeline.png) | [state-pipeline.drawio](diagrams/state-pipeline.drawio) |

### Change Log from BRD

- BRD Story 6 (Unit Tests) is addressed in Section 10 (Testing Considerations) as test scenarios
- Verification criteria details (per-phase) expanded beyond BRD scope based on code intelligence analysis
- Stream event schemas defined with specific field types (not in BRD)
- NonRecoverableError concept added as EF-2 (implied by BRD error handling section but not explicit)
- Strategy configuration model defined (BRD states "configuration files" but no schema)


# Technical Design Document (TDD)

## Kiro SDLC Agents — KSA-233: LangGraph Self-Correction Patterns: Auto-Retry, Verify Node, Strategy Switch

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-233 |
| Title | LangGraph Self-Correction Patterns: Auto-Retry, Verify Node, Strategy Switch |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-233.docx |
| Related FSD | FSD-v1-KSA-233.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | SA Agent - Solution Architect | Create document |
| Peer Reviewer | Dev Team - Developer | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | SA Agent | Initiate document from BRD and FSD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | [ ] I agree and confirm the technical design in this TDD |
| | [ ] I agree and confirm the technical design in this TDD |

---
## 1. Introduction

> **Scope Boundary:** This TDD specifies HOW to implement the self-correction patterns defined in FSD KSA-233. It does NOT repeat functional requirements, business rules, or use cases. This document focuses on: architecture decisions, class design, implementation patterns, and integration into the existing LangGraph pipeline.

### 1.1 Purpose

This TDD defines the technical design for adding self-correction capabilities to the existing LangGraph SDLC pipeline:

1. **Auto-Retry with Exponential Backoff** — Modifying BaseNode.run() to catch errors and retry with 1s/2s delays
2. **Verification Nodes** — A new VerifyNode class inserted after each agent node in the graph
3. **Strategy Switch** — Routing logic that activates alternate prompts after repeated verify failures, with human intervention as final fallback

### 1.2 Scope

- Modification of BaseNode.run() in base-node.ts
- New VerifyNode class in nodes/verify-node.ts
- New NonRecoverableError class in errors/non-recoverable-error.ts
- New verify criteria configuration in config/verify-criteria.ts
- New alternate strategy configuration in config/alternate-strategies.ts
- Extension of PipelineAnnotation in state.ts
- New routing functions in edges.ts
- Graph registration changes in sdlc-graph.ts
- Extension of StreamHandler with 4 new event types

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 20.x |
| Framework | LangGraph (@langchain/langgraph) | 0.2.x |
| Build Tool | npm / esbuild | latest |
| Testing | Vitest + vi.fn() mocks | 1.x |
| CI/CD | GitHub Actions | N/A |

### 1.4 Design Principles

- **Non-invasive extension** — Retry logic lives in the existing BaseNode.run() wrapper; subclasses do NOT change
- **Fail-open for verification** — If VerifyNode itself errors, pipeline continues (BR-12)
- **Configuration over code** — Verify criteria and alternate strategies are injected, not hardcoded
- **Existing pattern conformance** — All new state fields follow PipelineAnnotation reducer patterns
- **Single Responsibility** — Retry is in BaseNode, verification is a separate node class, routing is in edges

### 1.5 Constraints

- NODE_TIMEOUT_MS = 300,000ms remains unchanged; retry overhead (3s max) is negligible
- retryCount field already exists in PipelineState — reuse it (no migration)
- VerifyNode must use the same BaseNode infrastructure (timeout, streaming, MCP bridge)
- Existing graph edges are additive — no existing edge routing functions are modified
- Existing quality gates remain unchanged — verify nodes are a separate layer before quality gates

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-233.docx |
| FSD | FSD-v1-KSA-233.docx |
| LangGraph Pipeline TDD (KSA-210) | documents/KSA-210/TDD.md |
| BaseNode Source | kiro-sdlc-agents/src/langgraph/nodes/base-node.ts |
| PipelineState Source | kiro-sdlc-agents/src/langgraph/state.ts |
| Edges Source | kiro-sdlc-agents/src/langgraph/edges.ts |
| SDLC Graph Source | kiro-sdlc-agents/src/langgraph/graphs/sdlc-graph.ts |
| StreamHandler Source | kiro-sdlc-agents/src/langgraph/stream-handler.ts |

---

## 2. System Architecture

### 2.1 Architecture Overview

The self-correction patterns integrate as three layers around the existing agent execution:

![Architecture Diagram](diagrams/architecture.png)

*[Edit in draw.io](diagrams/architecture.drawio)*

**Layer Integration Model:**

The architecture preserves the existing pattern:
- BaseNode.run() wraps execute() — now with retry loop inside the wrapper
- VerifyNode is a new graph node class (extends BaseNode) placed between agent and quality gate
- Strategy switch lives in conditional edge routing functions (same pattern as existing routeAfterQualityGate)

Three concentric layers:
1. **Retry Layer** (innermost): Inside BaseNode.run(), wraps execute() with try/catch + exponential backoff
2. **Verify Layer** (middle): Separate VerifyNode graph node after each agent, evaluates output quality
3. **Strategy Layer** (outermost): Edge routing logic that switches approaches or pauses pipeline

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

*[Edit in draw.io](diagrams/component.drawio)*

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| BaseNode (modified) | Retry loop with exponential backoff on execute() errors | TypeScript class |
| VerifyNode (new) | Evaluates agent output quality against configurable criteria | TypeScript class extending BaseNode |
| NonRecoverableError (new) | Error subclass that bypasses retry logic | TypeScript Error subclass |
| VerifyCriteria config (new) | Per-phase verification criteria definitions | TypeScript config module |
| AlternateStrategyConfig (new) | Per-node alternate prompt/approach definitions | TypeScript config module |
| Edge routing (extended) | routeAfterVerify, strategy switch routing, pause routing | TypeScript functions |
| PipelineAnnotation (extended) | New state channels for verify/strategy tracking | LangGraph Annotation |
| StreamHandler (extended) | 4 new event types: retry, verify, strategy_switch, human_intervention | TypeScript methods |

### 2.3 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| BaseNode.run() | execute() | Direct call | Sync (retry loop) | Calls execute(), catches errors, retries |
| Agent Node | Verify Node | Graph edge | LangGraph routing | Output flows via state to verify node |
| Verify Node | Agent Node | Graph edge | Conditional routing | Routes back with verifyFeedback in state |
| Verify Node | Strategy Switch | Edge function | Conditional routing | When verifyAttempts >= max |
| Strategy Switch | Agent Node | Edge function | Conditional routing | Re-routes with alternate strategy flag |
| All nodes | StreamHandler | Direct call | Fire-and-forget | Emits events to Chat Panel |
| Pipeline | WorkspaceCheckpointer | StateGraph built-in | Sync | Persists checkpoint on every transition |

---

## 3. Class / Module Design

### 3.1 Package Structure

```
kiro-sdlc-agents/src/langgraph/
+-- nodes/
|   +-- base-node.ts              # MODIFIED - add retry loop to run()
|   +-- verify-node.ts            # NEW - VerifyNode class
|   +-- sm-node.ts                # Unchanged
|   +-- ba-node.ts                # Unchanged
|   +-- sa-node.ts                # Unchanged
|   +-- dev-node.ts               # Unchanged
|   +-- qa-node.ts                # Unchanged
|   +-- devops-node.ts            # Unchanged
|   +-- security-node.ts          # Unchanged
|   +-- feedback-node.ts          # Unchanged
|   +-- approval-node.ts          # Unchanged
+-- errors/
|   +-- non-recoverable-error.ts  # NEW - NonRecoverableError class
+-- config/
|   +-- verify-criteria.ts        # NEW - per-phase verification criteria
|   +-- alternate-strategies.ts   # NEW - per-node alternate strategy config
+-- state.ts                      # MODIFIED - new PipelineAnnotation fields
+-- edges.ts                      # MODIFIED - new routing functions
+-- graphs/
|   +-- sdlc-graph.ts             # MODIFIED - register verify nodes + edges
+-- stream-handler.ts             # MODIFIED - new emit methods
+-- mcp-bridge.ts                 # Unchanged
+-- checkpointer.ts               # Unchanged
+-- llm-provider.ts               # Unchanged
```

### 3.2 NonRecoverableError Class

**File:** `errors/non-recoverable-error.ts`

```typescript
/**
 * NonRecoverableError - KSA-233
 * Thrown when an error should NOT be retried (missing config, invalid state).
 * BaseNode.run() checks instanceof to skip retry logic.
 */
export class NonRecoverableError extends Error {
  readonly recoverable = false;

  constructor(message: string, public readonly code: string = "NON_RECOVERABLE") {
    super(message);
    this.name = "NonRecoverableError";
  }
}
```

### 3.3 Modified BaseNode.run() — Full Implementation Design

**File:** `nodes/base-node.ts` (modification)

The existing run() method is refactored to include a retry loop. Key design decisions:
- Retry logic is INSIDE run(), not in a separate wrapper — keeps the same node function signature
- retryCount is tracked locally during execution AND written back to state
- NonRecoverableError bypasses retry entirely
- Backoff delay uses setTimeout wrapped in a Promise
- Each retry re-calls this.execute(state) with the SAME input state (BR-7)

```typescript
/** Maximum retry attempts (configurable per node, default 2) */
private static readonly MAX_RETRIES = 2;

/**
 * Wraps execute() with timeout, retry loop, status streaming, and error handling.
 * This is the method registered as the LangGraph node function.
 *
 * Retry flow (implements UC-1):
 *   1. Call execute() with timeout
 *   2. If NonRecoverableError -> fail immediately (EF-2)
 *   3. If error and retryCount < MAX_RETRIES -> emit retry event, wait backoff, re-execute
 *   4. If all retries exhausted -> emit error, return failed state (EF-1)
 *   5. If success -> emit complete, return result
 */
async run(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();
  const maxRetries = BaseNode.MAX_RETRIES;
  let currentRetryCount = state.retryCount?.[this.nodeId] ?? 0;

  this.streamHandler.emitStatus(this.nodeId, "active", state.currentStreamId);

  // Initial attempt + retry loop
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await this.withTimeout(this.execute(state), NODE_TIMEOUT_MS);
      const duration = Date.now() - startTime;
      this.streamHandler.emitComplete(this.nodeId, duration, state.currentStreamId);

      return {
        ...result,
        retryCount: { ...state.retryCount, [this.nodeId]: currentRetryCount },
        lastUpdatedAt: new Date().toISOString(),
      };
    } catch (error) {
      const err = error as Error;

      // EF-2: Non-recoverable errors bypass retry entirely
      if (err instanceof NonRecoverableError) {
        return this.buildFailureState(state, err, currentRetryCount);
      }

      // Check if more retries available
      if (attempt < maxRetries) {
        currentRetryCount++;
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s

        // Emit retry event (BR-19: real-time)
        this.streamHandler.emitRetry(
          this.nodeId, attempt + 1, maxRetries, delayMs,
          err.message, state.currentStreamId
        );

        // Exponential backoff delay
        await this.sleep(delayMs);
        // Continue loop -> re-execute
      } else {
        // EF-1: All retries exhausted
        currentRetryCount++;
        return this.buildFailureState(state, err, currentRetryCount);
      }
    }
  }

  // Should never reach here, but TypeScript needs it
  return { pipelineStatus: "failed", lastUpdatedAt: new Date().toISOString() };
}

/** Build failure state after retries exhausted or non-recoverable error */
private buildFailureState(
  state: PipelineState, error: Error, retryCount: number
): Partial<PipelineState> {
  const pipelineError: PipelineError = {
    nodeId: this.nodeId,
    code: error.name || "NODE_FAILED",
    message: error.message,
    timestamp: new Date().toISOString(),
    recoverable: !(error instanceof NonRecoverableError),
  };

  this.streamHandler.emitError(this.nodeId, error.message, state.currentStreamId);

  return {
    errors: [...(state.errors || []), pipelineError],
    retryCount: { ...state.retryCount, [this.nodeId]: retryCount },
    pipelineStatus: "failed",
    lastUpdatedAt: new Date().toISOString(),
  };
}

/** Async sleep utility for backoff delay */
private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Key changes from existing run():**
1. Added retry for-loop wrapping the try/catch
2. Added NonRecoverableError instanceof check
3. Added sleep() utility for backoff
4. Replaced handleError() with buildFailureState() that includes retry context
5. Added emitRetry() call (new StreamHandler method)
6. The existing handleError() private method is removed (replaced by buildFailureState)

---

### 3.4 VerifyNode Class

**File:** `nodes/verify-node.ts`

```typescript
/**
 * VerifyNode - KSA-233
 * Dedicated graph node that validates agent output quality against
 * configurable criteria. Placed after each agent node in the graph.
 *
 * Implements: UC-2 (Output Verification), BR-8 through BR-12
 */

import { BaseNode } from "./base-node";
import { McpBridge } from "../mcp-bridge";
import { StreamHandler } from "../stream-handler";
import { PipelineState, AgentOutput } from "../state";
import { VerifyCriteria, getVerifyCriteria } from "../config/verify-criteria";
import { NonRecoverableError } from "../errors/non-recoverable-error";
import type { LlmProvider } from "../llm-provider";

export class VerifyNode extends BaseNode {
  /** The agent nodeId whose output this verify node evaluates */
  private readonly targetNodeId: string;

  constructor(
    nodeId: string,
    targetNodeId: string,
    mcpBridge: McpBridge,
    streamHandler: StreamHandler,
    llmProvider?: LlmProvider
  ) {
    super(nodeId, mcpBridge, streamHandler, llmProvider);
    this.targetNodeId = targetNodeId;
  }

  /**
   * Evaluate the last agent output against verification criteria.
   *
   * Processing (FSD 6.2):
   * 1. Extract last agentOutput for targetNodeId
   * 2. Load criteria for currentPhase
   * 3. Evaluate via LLM or rule-based check
   * 4. Return verify result in state
   */
  async execute(state: PipelineState): Promise<Partial<PipelineState>> {
    try {
      // Step 1: Extract agent output (EF-5: handle empty)
      const lastOutput = this.getLastAgentOutput(state);
      if (!lastOutput || !lastOutput.content) {
        return this.buildVerifyFailure(state, "No output produced by agent node");
      }

      // Step 2: Load criteria (EF-6: skip if not configured)
      const criteria = getVerifyCriteria(state.currentPhase);
      if (!criteria) {
        return this.buildVerifyPass(state);
      }

      // Step 3: Evaluate output against criteria
      const evaluation = await this.evaluateOutput(lastOutput, criteria, state);

      // Step 4-5: Return result
      if (evaluation.passed) {
        return this.buildVerifyPass(state);
      } else {
        return this.buildVerifyFailure(state, evaluation.feedback);
      }
    } catch (error) {
      // EF-4: VerifyNode itself errors -> treat as pass (BR-12: fail-open)
      console.warn(`VerifyNode '${this.nodeId}' error, treating as pass:`, error);
      return this.buildVerifyPass(state);
    }
  }

  /** Evaluate agent output against criteria using LLM */
  private async evaluateOutput(
    output: AgentOutput,
    criteria: VerifyCriteria,
    state: PipelineState
  ): Promise<{ passed: boolean; feedback: string }> {
    const systemPrompt = [
      "You are a quality verification agent.",
      "Evaluate the following output against the given criteria.",
      "Respond with JSON: { \"passed\": true/false, \"feedback\": \"specific feedback\" }",
      "If passed, feedback can be empty. If failed, feedback MUST be specific and actionable."
    ].join(" ");

    const checksText = criteria.checks.map(c => "- " + c).join("\n");
    const userPrompt = [
      "## Criteria",
      criteria.description,
      "",
      "## Checks",
      checksText,
      "",
      "## Agent Output (from node: " + this.targetNodeId + ")",
      output.content.substring(0, 10000)
    ].join("\n");

    const response = await this.callLlm(systemPrompt, userPrompt);
    return this.parseVerifyResponse(response);
  }

  /** Parse LLM response into pass/fail + feedback */
  private parseVerifyResponse(response: string): { passed: boolean; feedback: string } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { passed: Boolean(parsed.passed), feedback: parsed.feedback || "" };
      }
    } catch { /* fall through */ }
    // If parsing fails, treat as pass (fail-open)
    return { passed: true, feedback: "" };
  }

  /** Build state for verification pass */
  private buildVerifyPass(state: PipelineState): Partial<PipelineState> {
    this.streamHandler.emitVerify(
      this.nodeId, true, null,
      (state.verifyAttempts?.[this.targetNodeId] ?? 0) + 1,
      state.currentStreamId
    );
    return {
      verifyPassed: true,
      verifyFeedback: null,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  /** Build state for verification failure */
  private buildVerifyFailure(state: PipelineState, feedback: string): Partial<PipelineState> {
    const currentAttempts = (state.verifyAttempts?.[this.targetNodeId] ?? 0) + 1;
    this.streamHandler.emitVerify(
      this.nodeId, false, feedback, currentAttempts, state.currentStreamId
    );
    return {
      verifyPassed: false,
      verifyFeedback: feedback,
      verifyAttempts: { ...state.verifyAttempts, [this.targetNodeId]: currentAttempts },
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  /** Get the last agent output from state */
  private getLastAgentOutput(state: PipelineState): AgentOutput | null {
    const outputs = state.agentOutputs || [];
    for (let i = outputs.length - 1; i >= 0; i--) {
      if (outputs[i].nodeId === this.targetNodeId) {
        return outputs[i];
      }
    }
    return null;
  }
}
```

### 3.5 VerifyCriteria Configuration

**File:** `config/verify-criteria.ts`

```typescript
/**
 * Verify Criteria Configuration - KSA-233
 * Per-phase verification criteria. Configurable without code changes.
 * Implements: BR-9 (configurable per phase)
 */
import { SDLCPhase } from "../state";

export interface VerifyCriteria {
  phase: SDLCPhase;
  key: string;
  description: string;
  checks: string[];
}

const VERIFY_CRITERIA: Record<string, VerifyCriteria> = {
  requirements: {
    phase: "requirements",
    key: "brd_completeness",
    description: "BRD must have minimum required sections and user stories",
    checks: [
      "Contains at least 3 user stories with 'As a' pattern",
      "Each story has acceptance criteria",
      "Dependencies section is present",
      "Non-Functional Requirements section is present",
    ],
  },
  specification: {
    phase: "specification",
    key: "fsd_use_cases",
    description: "FSD must have complete use cases with flows",
    checks: [
      "Contains use cases with Main Flow tables",
      "Contains Alternative Flow and Exception Flow",
      "Business Rules table with BR- IDs exists",
      "Data Model section is present",
    ],
  },
  design: {
    phase: "design",
    key: "tdd_architecture",
    description: "TDD must have architecture and class design",
    checks: [
      "Architecture Overview section with diagram reference",
      "Class/Module Design with package structure",
      "Contains code blocks with implementation details",
      "Implementation Checklist is present",
    ],
  },
  test_planning: {
    phase: "test_planning",
    key: "stp_coverage",
    description: "STP must cover all BRD stories with traceability",
    checks: [
      "Requirements Traceability Matrix (RTM) is present",
      "All BRD story IDs appear in RTM",
      "Test cases have clear steps and expected results",
      "Multiple test levels defined (UT, IT, E2E)",
    ],
  },
  implementation: {
    phase: "implementation",
    key: "code_compiles",
    description: "Implementation must compile and pass basic validation",
    checks: [
      "No TypeScript compilation errors reported",
      "Key functions/classes defined as per TDD",
      "Exports are properly declared",
      "No obvious runtime errors in logic",
    ],
  },
  user_guide: {
    phase: "user_guide",
    key: "ug_sections",
    description: "User Guide must have required documentation sections",
    checks: [
      "Installation/Quick Start section exists",
      "Configuration Reference with tables exists",
      "Usage section with examples exists",
      "Troubleshooting section exists",
    ],
  },
};

/** Get verification criteria for a given phase. Returns null if not configured. */
export function getVerifyCriteria(phase: SDLCPhase): VerifyCriteria | null {
  return VERIFY_CRITERIA[phase] ?? null;
}
```

### 3.6 AlternateStrategyConfig

**File:** `config/alternate-strategies.ts`

```typescript
/**
 * Alternate Strategy Configuration - KSA-233
 * Defines alternate prompts/approaches per node when primary strategy fails.
 * Implements: BR-13, BR-14
 */
export interface AlternateStrategy {
  nodeId: string;
  description: string;
  promptModifier: string;
  temperatureOverride?: number;
}

const ALTERNATE_STRATEGIES: Record<string, AlternateStrategy> = {
  ba_brd: {
    nodeId: "ba_brd",
    description: "Simplified BRD with fewer sections, focus on core stories",
    promptModifier: "Use a simplified template. Focus only on the 3 most critical user stories. Skip optional sections. Prioritize completeness over breadth.",
    temperatureOverride: 0.3,
  },
  ba_fsd: {
    nodeId: "ba_fsd",
    description: "FSD with simplified flows, fewer alternative paths",
    promptModifier: "Simplify use case flows. Include only Main Flow and 1 Exception Flow per UC. Focus on happy path completeness.",
    temperatureOverride: 0.3,
  },
  sa_tdd: {
    nodeId: "sa_tdd",
    description: "TDD with higher-level design, less implementation detail",
    promptModifier: "Provide architecture overview and key interfaces only. Skip detailed method signatures. Focus on component interactions.",
    temperatureOverride: 0.4,
  },
  dev_code: {
    nodeId: "dev_code",
    description: "Implementation with simpler patterns, fewer abstractions",
    promptModifier: "Use straightforward implementation. Prefer inline logic over abstraction layers. Focus on correctness over elegance.",
    temperatureOverride: 0.2,
  },
  qa_plan: {
    nodeId: "qa_plan",
    description: "Test plan with fewer test levels, focus on critical paths",
    promptModifier: "Focus on Unit Tests and E2E-API tests only. Skip PBT and SIT. Cover only critical business paths.",
    temperatureOverride: 0.3,
  },
};

/** Get alternate strategy for a node. Returns null if not defined. */
export function getAlternateStrategy(nodeId: string): AlternateStrategy | null {
  return ALTERNATE_STRATEGIES[nodeId] ?? null;
}
```

### 3.7 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Template Method | BaseNode.run() -> execute() | Retry logic in base, specific logic in subclass |
| Strategy | AlternateStrategyConfig | Swap prompt/approach without changing node code |
| Observer | StreamHandler events | Decouple self-correction actions from UI rendering |
| Fail-Open | VerifyNode error handling | Pipeline availability over verification strictness |
| Configuration Object | VerifyCriteria, AlternateStrategy | Decouples policy from mechanism |

### 3.8 Error Handling Strategy

| Exception Class | When Thrown | Retry Behavior | State Result |
|----------------|------------|----------------|--------------|
| NonRecoverableError | Missing config, invalid state | Skip retry (EF-2) | pipelineStatus: "failed" |
| Error (generic) | LLM timeout, network issue | Retry up to 2x (UC-1) | Success or "failed" after 3 attempts |
| TimeoutError (from withTimeout) | Node exceeds 300s | Counts as failed attempt (EF-3) | Retry or "failed" |

---

## 4. State Extensions (PipelineAnnotation)

### 4.1 New Fields Added to PipelineAnnotation

The following fields are added to `state.ts` following existing reducer patterns:

```typescript
// === Self-Correction State (KSA-233) ===

/** Last verification result - reset per verify execution */
verifyPassed: Annotation<boolean>({
  reducer: (_existing, update) => update,
  default: () => true,
}),

/** Feedback from verify node when verification fails */
verifyFeedback: Annotation<string | null>({
  reducer: (_existing, update) => update,
  default: () => null,
}),

/** Verify attempt count per target node (e.g., { "ba_brd": 2 }) */
verifyAttempts: Annotation<Record<string, number>>({
  reducer: (existing, update) => ({ ...existing, ...update }),
  default: () => ({}),
}),

/** Maximum verify attempts before strategy switch (default: 2) */
maxVerifyAttempts: Annotation<number>({
  reducer: (_existing, update) => update,
  default: () => 2,
}),

/** Active strategy per node ("primary" or "alternate") */
activeStrategy: Annotation<Record<string, string>>({
  reducer: (existing, update) => ({ ...existing, ...update }),
  default: () => ({}),
}),

/** History log of strategy switches (append-only, capped at 20) */
strategyHistory: Annotation<StrategyEvent[]>({
  reducer: (existing, update) => [...existing, ...update].slice(-20),
  default: () => [],
}),
```

### 4.2 New Type Definitions

```typescript
/** Strategy switch event for audit trail */
export interface StrategyEvent {
  nodeId: string;
  strategy: string;
  timestamp: string;
  reason: string;
}

/** Extended stream event types (added to existing StreamEventType) */
export type StreamEventType =
  | "token" | "status" | "progress" | "complete" | "error"  // existing
  | "retry" | "verify" | "strategy_switch" | "human_intervention_required";  // new (KSA-233)
```

### 4.3 Reducer Pattern Conformance

The new fields follow the SAME patterns already established in state.ts:

| Pattern | Existing Example | New Field Using Same Pattern |
|---------|------------------|------------------------------|
| Replace reducer | feedbackIterations, discrepancyFound | verifyPassed, verifyFeedback, maxVerifyAttempts |
| Merge reducer | parallelResults, qualityGateResults | verifyAttempts, activeStrategy |
| Append-with-cap reducer | agentOutputs (cap 50), chatHistory (cap 200) | strategyHistory (cap 20) |

---

## 5. Edge Routing Design

### 5.1 New Routing Functions

**File:** `edges.ts` (additions)

```typescript
// === Self-Correction Routing (KSA-233) ===

/**
 * After verify node: route based on verification result.
 * Implements: UC-2 (verify pass/fail), UC-3 (strategy switch trigger)
 *
 * Routes:
 * - verifyPassed=true -> next node (quality gate or post-processing)
 * - verifyPassed=false AND verifyAttempts < max -> back to agent (with feedback)
 * - verifyPassed=false AND verifyAttempts >= max -> strategy switch
 */
export function routeAfterVerify(
  targetNodeId: string,
  nextNodeId: string
): (state: PipelineState) => string {
  return (state: PipelineState): string => {
    if (state.pipelineStatus === "failed") return "__end__";

    // Verify passed -> proceed to next node
    if (state.verifyPassed) {
      return nextNodeId;
    }

    // Verify failed - check attempt count
    const attempts = state.verifyAttempts?.[targetNodeId] ?? 0;
    const maxAttempts = state.maxVerifyAttempts ?? 2;

    if (attempts >= maxAttempts) {
      // Max attempts reached -> strategy switch decision
      return "strategy_switch";
    }

    // Under max attempts -> route back to agent for retry with feedback
    return targetNodeId;
  };
}

/**
 * After strategy switch node: route to agent with alternate or pause.
 * Implements: UC-3 (strategy switch), UC-4 (human intervention)
 */
export function routeAfterStrategySwitch(state: PipelineState): string {
  if (state.pipelineStatus === "paused") {
    return "__end__";
  }

  // Find which node triggered strategy switch
  const targetNode = findStrategyTarget(state);
  if (targetNode) {
    return targetNode;
  }

  return "__end__";
}

/** Helper: find which agent node needs the strategy switch */
function findStrategyTarget(state: PipelineState): string | null {
  const activeStrategies = state.activeStrategy || {};
  for (const [nodeId, strategy] of Object.entries(activeStrategies)) {
    if (strategy === "alternate") {
      return nodeId;
    }
  }
  return null;
}
```

### 5.2 Strategy Switch Node (Inline Function)

The strategy switch is implemented as a lightweight inline node (not a full BaseNode subclass) because it only performs state manipulation:

```typescript
/**
 * Strategy switch inline node.
 * Evaluates whether to activate alternate strategy or pause for human.
 */
async function strategySwitchNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const failedNodeId = getLastFailedVerifyTarget(state);
  if (!failedNodeId) {
    return { pipelineStatus: "paused", approvalRequired: true };
  }

  const currentStrategy = state.activeStrategy?.[failedNodeId] ?? "primary";
  const alternateConfig = getAlternateStrategy(failedNodeId);

  // If already on alternate OR no alternate defined -> pause for human
  if (currentStrategy === "alternate" || !alternateConfig) {
    streamHandler.emitHumanIntervention(
      failedNodeId,
      [currentStrategy],
      getVerifyHistory(state, failedNodeId),
      state.currentStreamId
    );

    return {
      pipelineStatus: "paused",
      approvalRequired: true,
      strategyHistory: [{
        nodeId: failedNodeId,
        strategy: "human_intervention",
        timestamp: new Date().toISOString(),
        reason: alternateConfig
          ? "Alternate strategy also failed verification"
          : "No alternate strategy configured",
      }],
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  // Switch to alternate strategy
  streamHandler.emitStrategySwitch(
    failedNodeId, "primary", "alternate",
    "Primary strategy failed verification twice",
    state.currentStreamId
  );

  return {
    activeStrategy: { ...state.activeStrategy, [failedNodeId]: "alternate" },
    verifyAttempts: { ...state.verifyAttempts, [failedNodeId]: 0 },
    strategyHistory: [{
      nodeId: failedNodeId,
      strategy: "alternate",
      timestamp: new Date().toISOString(),
      reason: "Primary strategy failed verification " + (state.maxVerifyAttempts ?? 2) + " times",
    }],
    lastUpdatedAt: new Date().toISOString(),
  };
}
```

### 5.3 Routing Flow Summary

```
Agent Node --execute()--> [BaseNode retry loop] --success--> Verify Node
                               |                                 |
                         [error, retry < 2]                [Pass]   [Fail]
                               |                             |        |
                         [backoff + retry]               Next Node  attempts < max?
                               |                                      |
                         [error, retry = 2]                    Yes -> Agent (feedback)
                               |                               No  -> Strategy Switch
                               v                                      |
                          pipelineStatus                    [Alt defined?]  [No alt]
                          = "failed"                             |            |
                                                          Agent (alt)    Paused
                                                                |
                                                          Verify (alt)
                                                          [Pass] [Fail]
                                                            |      |
                                                         Next   Paused
                                                         Node   (human)
```

---

## 6. StreamHandler Extensions

### 6.1 New Methods

**File:** `stream-handler.ts` (additions)

```typescript
/** Emit retry event - immediate flush (not buffered) */
emitRetry(
  nodeId: string,
  attempt: number,
  maxAttempts: number,
  delayMs: number,
  error: string,
  streamId: string | null
): void {
  this.flush();
  this.emit({
    type: "chat:streamChunk",
    streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
    nodeId,
    eventType: "retry",
    content: JSON.stringify({ attempt, maxAttempts, delayMs, error }),
    timestamp: new Date().toISOString(),
  });
}

/** Emit verify event - immediate flush */
emitVerify(
  nodeId: string,
  passed: boolean,
  feedback: string | null,
  attempt: number,
  streamId: string | null
): void {
  this.flush();
  this.emit({
    type: "chat:streamChunk",
    streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
    nodeId,
    eventType: "verify",
    content: JSON.stringify({ passed, feedback, attempt }),
    timestamp: new Date().toISOString(),
  });
}

/** Emit strategy switch event - immediate flush */
emitStrategySwitch(
  nodeId: string,
  fromStrategy: string,
  toStrategy: string,
  reason: string,
  streamId: string | null
): void {
  this.flush();
  this.emit({
    type: "chat:streamChunk",
    streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
    nodeId,
    eventType: "strategy_switch",
    content: JSON.stringify({ fromStrategy, toStrategy, reason }),
    timestamp: new Date().toISOString(),
  });
}

/** Emit human intervention required event - immediate flush */
emitHumanIntervention(
  nodeId: string,
  failedStrategies: string[],
  verifyHistory: Array<{ attempt: number; feedback: string }>,
  streamId: string | null
): void {
  this.flush();
  this.emit({
    type: "chat:streamChunk",
    streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
    nodeId,
    eventType: "human_intervention_required",
    content: JSON.stringify({ failedStrategies, verifyHistory }),
    timestamp: new Date().toISOString(),
  });
}
```

### 6.2 Event Type Mapping

| Event Type | Method | Flush Behavior | Content Format |
|-----------|--------|----------------|----------------|
| retry | emitRetry() | Immediate | {attempt, maxAttempts, delayMs, error} |
| verify | emitVerify() | Immediate | {passed, feedback, attempt} |
| strategy_switch | emitStrategySwitch() | Immediate | {fromStrategy, toStrategy, reason} |
| human_intervention_required | emitHumanIntervention() | Immediate | {failedStrategies, verifyHistory} |

All new events follow the existing chat:streamChunk message type with eventType discriminator — same protocol as existing status and error events.

---

## 7. Graph Registration

### 7.1 Verify Node Registration in sdlc-graph.ts

**File:** `graphs/sdlc-graph.ts` (modifications)

```typescript
import { VerifyNode } from "../nodes/verify-node";
import { routeAfterVerify, routeAfterStrategySwitch } from "../edges";
import { getAlternateStrategy } from "../config/alternate-strategies";

// === New verify node instances ===
const verifyBaBrd = new VerifyNode("verify_ba_brd", "ba_brd", mcpBridge, streamHandler, llmProvider);
const verifyBaFsd = new VerifyNode("verify_ba_fsd", "ba_fsd", mcpBridge, streamHandler, llmProvider);
const verifySaTdd = new VerifyNode("verify_sa_tdd", "sa_tdd", mcpBridge, streamHandler, llmProvider);
const verifyQaPlan = new VerifyNode("verify_qa_plan", "qa_plan", mcpBridge, streamHandler, llmProvider);
const verifyDevCode = new VerifyNode("verify_dev_code", "dev_code", mcpBridge, streamHandler, llmProvider);
const verifyDevUg = new VerifyNode("verify_dev_ug", "dev_ug", mcpBridge, streamHandler, llmProvider);

// === Register nodes ===
graph
  .addNode("verify_ba_brd", (state: PipelineState) => verifyBaBrd.run(state))
  .addNode("verify_ba_fsd", (state: PipelineState) => verifyBaFsd.run(state))
  .addNode("verify_sa_tdd", (state: PipelineState) => verifySaTdd.run(state))
  .addNode("verify_qa_plan", (state: PipelineState) => verifyQaPlan.run(state))
  .addNode("verify_dev_code", (state: PipelineState) => verifyDevCode.run(state))
  .addNode("verify_dev_ug", (state: PipelineState) => verifyDevUg.run(state))
  .addNode("strategy_switch", strategySwitchNode)
```

### 7.2 Edge Modifications

The key change: agent nodes now route to verify nodes INSTEAD of directly to quality gates.

**Before (KSA-210):**
```
ba_brd --> quality_gate_requirements
```

**After (KSA-233):**
```
ba_brd --> verify_ba_brd --> quality_gate_requirements
                |
                +-- (fail) --> ba_brd (feedback loop)
                +-- (max fails) --> strategy_switch
```

```typescript
// === Modified edges: agent -> verify -> quality gate ===

// ba_brd -> verify -> quality gate
.addEdge("ba_brd", "verify_ba_brd")
.addConditionalEdges("verify_ba_brd",
  routeAfterVerify("ba_brd", "quality_gate_requirements"),
  {
    quality_gate_requirements: "quality_gate_requirements",
    ba_brd: "ba_brd",
    strategy_switch: "strategy_switch",
    __end__: END,
  }
)

// ba_fsd -> verify -> ta_enrich (verify before TA enrichment)
.addEdge("ba_fsd", "verify_ba_fsd")
.addConditionalEdges("verify_ba_fsd",
  routeAfterVerify("ba_fsd", "ta_enrich"),
  {
    ta_enrich: "ta_enrich",
    ba_fsd: "ba_fsd",
    strategy_switch: "strategy_switch",
    __end__: END,
  }
)

// sa_tdd -> verify -> feedback_check
.addEdge("sa_tdd", "verify_sa_tdd")
.addConditionalEdges("verify_sa_tdd",
  routeAfterVerify("sa_tdd", "feedback_check"),
  {
    feedback_check: "feedback_check",
    sa_tdd: "sa_tdd",
    strategy_switch: "strategy_switch",
    __end__: END,
  }
)

// qa_plan -> verify -> quality_gate_test_planning
.addEdge("qa_plan", "verify_qa_plan")
.addConditionalEdges("verify_qa_plan",
  routeAfterVerify("qa_plan", "quality_gate_test_planning"),
  {
    quality_gate_test_planning: "quality_gate_test_planning",
    qa_plan: "qa_plan",
    strategy_switch: "strategy_switch",
    __end__: END,
  }
)

// dev_code -> verify -> security_review_code
.addEdge("dev_code", "verify_dev_code")
.addConditionalEdges("verify_dev_code",
  routeAfterVerify("dev_code", "security_review_code"),
  {
    security_review_code: "security_review_code",
    dev_code: "dev_code",
    strategy_switch: "strategy_switch",
    __end__: END,
  }
)

// dev_ug -> verify -> ba_review_ug
.addEdge("dev_ug", "verify_dev_ug")
.addConditionalEdges("verify_dev_ug",
  routeAfterVerify("dev_ug", "ba_review_ug"),
  {
    ba_review_ug: "ba_review_ug",
    dev_ug: "dev_ug",
    strategy_switch: "strategy_switch",
    __end__: END,
  }
)

// Strategy switch -> routes back to agent or pauses
.addConditionalEdges("strategy_switch", routeAfterStrategySwitch, {
  ba_brd: "ba_brd",
  ba_fsd: "ba_fsd",
  sa_tdd: "sa_tdd",
  qa_plan: "qa_plan",
  dev_code: "dev_code",
  dev_ug: "dev_ug",
  __end__: END,
})
```

### 7.3 Graph Flow Summary

```
__start__ -> sm -> [agent] -> [verify] -> [quality_gate/next] -> sm -> ...
                      ^           |
                      |      fail (< max)
                      +-----------|
                      ^           |
                      |      fail (>= max)
                      |           v
                      +--- strategy_switch
                                  |
                             (paused) -> __end__
```

---

## 8. Security Design

### 8.1 Authentication and Authorization

No changes to authentication. The self-correction patterns operate within the already-authenticated pipeline context. The currentStreamId channel inherits the session authorization of the pipeline operator.

| Role | Permissions | Features |
|------|-------------|----------|
| Pipeline Operator | Read/Write | Start pipeline, view events, provide intervention |
| System (Auto) | Execute | Retry, verify, switch strategies (no human needed) |
| Admin | Admin | Configure verify criteria, set maxRetries, define alternate strategies |

### 8.2 Data Protection

| Data Type | At Rest | In Transit | In Logs |
|-----------|---------|------------|---------|
| Verify feedback | Checkpoint (file) | Internal only | Full text (no PII) |
| Strategy history | Checkpoint (file) | Internal only | Full text |
| User feedback (human intervention) | Checkpoint (file) | WebSocket/SSE | Sanitized |
| LLM prompts for verify | Not persisted | TLS to LLM provider | Excluded |

### 8.3 Input Validation

| Input | Validation | Sanitization |
|-------|-----------|--------------|
| verifyFeedback from LLM | JSON parse with fallback | Truncate to 2000 chars |
| userFeedback from human | Non-empty string check | HTML escape for stream event |
| alternateStrategy config | Schema validation on load | N/A (trusted config) |

---

## 9. Performance and Scalability

### 9.1 Performance Targets

| Operation | Target | Rationale |
|-----------|--------|-----------|
| Retry backoff total | <= 3s overhead | 1s + 2s = 3s, within 300s timeout |
| VerifyNode execution | <= 30s | Single LLM call with short output |
| Strategy switch decision | <= 100ms | Pure state manipulation, no I/O |
| Stream event emission | <= 5ms | Fire-and-forget, immediate flush |

### 9.2 Resource Impact

| Resource | Without Self-Correction | With Self-Correction (worst case) |
|----------|------------------------|-----------------------------------|
| LLM calls per node | 1 | 7 max (initial + 2 retries + verify x3 + alt verify) |
| Execution time per node | 30-120s | ~300s max (retries + verify loops + alt) |
| State size increase | N/A | ~500 bytes (verify fields + strategy history) |
| Stream events per node | 2 (status + complete) | Up to 8 (status + retries + verify + switch + complete) |

### 9.3 Token Budget Impact

| Scenario | Additional Tokens | Mitigation |
|----------|-------------------|------------|
| VerifyNode LLM call | ~2000 tokens per call | Short system prompt, truncate output to 10k chars |
| Agent retry with feedback | ~500 tokens | Feedback is concise actionable text |
| Total worst-case overhead | ~10,000 tokens per node | Acceptable given pipeline value |

---

## 10. Monitoring and Observability

### 10.1 Logging

| Log Event | Level | Fields | When |
|-----------|-------|--------|------|
| Retry attempt | WARN | nodeId, attempt, error, delayMs | Each retry |
| Retry success | INFO | nodeId, totalAttempts, totalTime | After successful retry |
| All retries exhausted | ERROR | nodeId, attempts, lastError | Final failure |
| Verify pass | INFO | nodeId, phase, attempt | Each pass |
| Verify fail | WARN | nodeId, phase, feedback, attempt | Each failure |
| Strategy switch | WARN | nodeId, from, to, reason | On switch |
| Human intervention | ERROR | nodeId, strategies, verifyHistory | On pause |
| VerifyNode internal error | WARN | nodeId, error | Fail-open triggered |

### 10.2 Metrics

| Metric | Type | Description |
|--------|------|-------------|
| pipeline.retry.count | Counter | Total retry attempts across all nodes |
| pipeline.retry.success_rate | Gauge | Percentage of retries that succeed |
| pipeline.verify.pass_rate | Gauge | Percentage of verifications that pass first attempt |
| pipeline.verify.attempts_avg | Histogram | Average verify attempts before success |
| pipeline.strategy_switch.count | Counter | Total strategy switches |
| pipeline.human_intervention.count | Counter | Total human interventions required |

### 10.3 Health Checks

| Endpoint | Checks | Expected Response |
|----------|--------|-------------------|
| Pipeline status query | State.pipelineStatus | "running", "paused", or "failed" |
| Verify criteria loaded | getVerifyCriteria() for each phase | Non-null for configured phases |
| LLM provider available | llmProvider.isAvailable() | true |

---

## 11. Deployment Considerations

### 11.1 Environment Configuration

| Property | DEV | PROD |
|----------|-----|------|
| MAX_RETRIES | 2 | 2 |
| RETRY_BACKOFF_BASE_MS | 1000 | 1000 |
| MAX_VERIFY_ATTEMPTS | 2 | 2 |
| VERIFY_TIMEOUT_MS | 30000 | 30000 |
| NODE_TIMEOUT_MS | 300000 | 300000 |

### 11.2 Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| ENABLE_AUTO_RETRY | true | Enable/disable retry loop in BaseNode.run() |
| ENABLE_VERIFY_NODES | true | Enable/disable verification after agent nodes |
| ENABLE_STRATEGY_SWITCH | true | Enable/disable alternate strategy switching |

### 11.3 Rollback Strategy

If self-correction patterns cause issues:
1. Set ENABLE_VERIFY_NODES=false to bypass verification (agents connect directly to quality gates)
2. Set ENABLE_AUTO_RETRY=false to revert to original run() behavior (immediate fail)
3. Full rollback: revert edges.ts and sdlc-graph.ts to pre-KSA-233 versions (no verify nodes registered)

No database migration — purely code/config changes.

---

## 12. Implementation Checklist

### Phase 1: Core Infrastructure (Priority: MUST)

| # | Task | File | Depends On | Effort |
|---|------|------|-----------|--------|
| 1 | Create NonRecoverableError class | errors/non-recoverable-error.ts | None | 0.5h |
| 2 | Add new state fields to PipelineAnnotation | state.ts | None | 1h |
| 3 | Add StrategyEvent interface and extended StreamEventType | state.ts | #2 | 0.5h |
| 4 | Modify BaseNode.run() with retry loop | nodes/base-node.ts | #1 | 2h |
| 5 | Add emitRetry() method to StreamHandler | stream-handler.ts | #3 | 0.5h |
| 6 | Write unit tests for BaseNode retry logic | __tests__/base-node.test.ts | #4, #5 | 2h |

### Phase 2: Verification System (Priority: MUST)

| # | Task | File | Depends On | Effort |
|---|------|------|-----------|--------|
| 7 | Create VerifyCriteria config module | config/verify-criteria.ts | None | 1h |
| 8 | Create VerifyNode class | nodes/verify-node.ts | #2, #7 | 3h |
| 9 | Add emitVerify() method to StreamHandler | stream-handler.ts | #3 | 0.5h |
| 10 | Write unit tests for VerifyNode | __tests__/verify-node.test.ts | #8, #9 | 2h |

### Phase 3: Strategy Switch (Priority: MUST)

| # | Task | File | Depends On | Effort |
|---|------|------|-----------|--------|
| 11 | Create AlternateStrategyConfig module | config/alternate-strategies.ts | None | 1h |
| 12 | Implement strategySwitchNode inline function | graphs/sdlc-graph.ts | #2, #11 | 2h |
| 13 | Add emitStrategySwitch() and emitHumanIntervention() | stream-handler.ts | #3 | 0.5h |
| 14 | Write unit tests for strategy switch | __tests__/strategy-switch.test.ts | #12, #13 | 2h |

### Phase 4: Graph Integration (Priority: MUST)

| # | Task | File | Depends On | Effort |
|---|------|------|-----------|--------|
| 15 | Add routeAfterVerify() function factory | edges.ts | #2 | 1h |
| 16 | Add routeAfterStrategySwitch() function | edges.ts | #2, #11 | 1h |
| 17 | Register verify nodes in sdlc-graph.ts | graphs/sdlc-graph.ts | #8, #15, #16 | 2h |
| 18 | Modify existing edges (agent -> verify -> next) | graphs/sdlc-graph.ts | #17 | 2h |
| 19 | Write integration tests for full graph flow | __tests__/sdlc-graph.integration.test.ts | #18 | 3h |

### Phase 5: Agent Integration (Priority: SHOULD)

| # | Task | File | Depends On | Effort |
|---|------|------|-----------|--------|
| 20 | Modify agent nodes to read verifyFeedback and activeStrategy | All agent node files | #2 | 2h |
| 21 | Implement pipeline resume logic (reset verify state) | graphs/sdlc-graph.ts | #12 | 1h |
| 22 | End-to-end test: retry -> verify -> strategy -> pause -> resume | __tests__/e2e-self-correction.test.ts | All above | 3h |

**Total estimated effort: ~30 hours**

---

## 13. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Auto-Retry | Automatic re-execution of a failed node without human intervention |
| Backoff | Increasing delay between retry attempts (exponential: 1s, 2s) |
| Verify Node | A dedicated graph node that validates the output of the preceding agent node |
| Strategy Switch | Changing to an alternate prompt/approach after repeated failures |
| Human Intervention | Pipeline pause requiring a human operator to provide guidance |
| Quality Gate | Existing approval checkpoints (separate from verify nodes) |
| Fail-Open | When verify infrastructure fails, treat as pass (do not block pipeline) |
| NonRecoverableError | Error class that bypasses retry logic entirely |

### Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Should verify criteria be stored in external config files (JSON) or inline TypeScript? | Resolved | Inline TypeScript for type safety; can extract to JSON later |
| 2 | Should verify nodes have their own retry logic for LLM calls? | Resolved | Yes, inherited from BaseNode.run() |
| 3 | Should pipeline pause persist to disk or only in-memory? | Resolved | Disk via WorkspaceCheckpointer (BR-18) |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

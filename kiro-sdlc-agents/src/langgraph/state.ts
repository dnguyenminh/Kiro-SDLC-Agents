/**
 * LangGraph Pipeline State — KSA-210
 * Defines the typed state channels for the SDLC pipeline StateGraph.
 * All values must be JSON-serializable (no Date objects, no functions).
 */

import { Annotation } from "@langchain/langgraph";
import type { LlmToolCall } from "./llm-provider";

// === Enums & Literal Types ===

export type SDLCPhase =
  | "requirements"
  | "specification"
  | "design"
  | "test_planning"
  | "implementation"
  | "user_guide"
  | "testing"
  | "deployment"
  | "all";

/** Intent types for router graph classification */
export type PipelineIntent = "sdlc" | "hotfix" | "code_review" | "docs" | "security_audit" | "chat";

export type PipelineStatus = "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";

export type ApprovalDecision = "approve" | "reject" | "revise";

export type StreamEventType =
  | "token" | "status" | "progress" | "complete" | "error"
  | "retry" | "verify" | "strategy_switch" | "human_intervention_required";

/** Strategy switch event for audit trail (KSA-233) */
export interface StrategyEvent {
  nodeId: string;
  strategy: string;
  timestamp: string;
  reason: string;
}

// === Data Structures ===

export interface DocumentState {
  status: "pending" | "in_progress" | "done" | "failed";
  version: number;
  path: string | null;
  completedAt: string | null;
}

export interface AgentOutput {
  nodeId: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface QualityGateCheckpoint {
  gateId: string;
  phase: SDLCPhase;
  nodeId: string;
  summary: string;
  criteria: string[];
  timestamp: string;
}

export interface QualityGateResult {
  passed: boolean;
  issues: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  nodeId?: string;
  timestamp: string;
}

export interface PipelineError {
  nodeId: string;
  code: string;
  message: string;
  timestamp: string;
  recoverable: boolean;
}

export interface PipelineGraphNode {
  id: string;
  label: string;
  status: "idle" | "active" | "completed" | "failed" | "skipped";
  phase: SDLCPhase;
}

export interface PersistedPipelineInfo {
  threadId: string;
  ticketKey: string;
  phase: SDLCPhase;
  status: PipelineStatus;
  lastUpdatedAt: string;
}

// === LangGraph State Annotation ===

export const PipelineAnnotation = Annotation.Root({
  ticketKey: Annotation<string>,
  threadId: Annotation<string>,
  currentPhase: Annotation<SDLCPhase>,
  intent: Annotation<PipelineIntent>({
    reducer: (_existing, update) => update,
    default: () => "chat" as PipelineIntent,
  }),
  pipelineStatus: Annotation<PipelineStatus>,
  resumePoint: Annotation<string | null>,
  documents: Annotation<Record<string, DocumentState>>,
  agentOutputs: Annotation<AgentOutput[]>({
    reducer: (existing, update) => [...existing, ...update].slice(-50),
    default: () => [],
  }),
  currentStreamId: Annotation<string | null>,
  approvalRequired: Annotation<boolean>,
  approvalDecision: Annotation<ApprovalDecision | null>,
  userFeedback: Annotation<string | null>,
  pendingApprovals: Annotation<QualityGateCheckpoint[]>,
  chatHistory: Annotation<ChatMessage[]>({
    reducer: (existing, update) => [...existing, ...update].slice(-200),
    default: () => [],
  }),
  errors: Annotation<PipelineError[]>,
  retryCount: Annotation<Record<string, number>>,
  createdAt: Annotation<string>,
  lastUpdatedAt: Annotation<string>,
  lastCheckpointAt: Annotation<string | null>,

  // Feedback loop state (BA <-> SA discrepancy resolution)
  feedbackIterations: Annotation<number>({
    reducer: (_existing, update) => update,
    default: () => 0,
  }),
  maxFeedbackIterations: Annotation<number>({
    reducer: (_existing, update) => update,
    default: () => 5,
  }),
  discrepancyFound: Annotation<boolean>({
    reducer: (_existing, update) => update,
    default: () => false,
  }),
  previousNode: Annotation<string | null>({
    reducer: (_existing, update) => update,
    default: () => null,
  }),

  // Parallel execution results collector
  parallelResults: Annotation<Record<string, string>>({
    reducer: (existing, update) => ({ ...existing, ...update }),
    default: () => ({}),
  }),

  // Per-phase quality gate results
  qualityGateResults: Annotation<Record<string, QualityGateResult>>({
    reducer: (existing, update) => ({ ...existing, ...update }),
    default: () => ({}),
  }),

  // ReAct agent loop state (Chat Graph)
  toolCalls: Annotation<LlmToolCall[] | null>({
    reducer: (_existing, update) => update,
    default: () => null,
  }),
  toolResults: Annotation<Array<{ toolCallId: string; name: string; content: string }>>({
    reducer: (existing, update) => [...existing, ...update],
    default: () => [],
  }),
  agentIterations: Annotation<number>({
    reducer: (_existing, update) => update,
    default: () => 0,
  }),

  // === Self-Correction State (KSA-233) ===

  /** Last verification result — reset per verify execution */
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
});

export type PipelineState = typeof PipelineAnnotation.State;

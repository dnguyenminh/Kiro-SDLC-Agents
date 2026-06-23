"use strict";
/**
 * LangGraph Pipeline State — KSA-210
 * Defines the typed state channels for the SDLC pipeline StateGraph.
 * All values must be JSON-serializable (no Date objects, no functions).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineAnnotation = void 0;
const langgraph_1 = require("@langchain/langgraph");
// === LangGraph State Annotation ===
exports.PipelineAnnotation = langgraph_1.Annotation.Root({
    ticketKey: (langgraph_1.Annotation),
    threadId: (langgraph_1.Annotation),
    currentPhase: (langgraph_1.Annotation),
    intent: (0, langgraph_1.Annotation)({
        reducer: (_existing, update) => update,
        default: () => "chat",
    }),
    pipelineStatus: (langgraph_1.Annotation),
    resumePoint: (langgraph_1.Annotation),
    documents: (langgraph_1.Annotation),
    agentOutputs: (0, langgraph_1.Annotation)({
        reducer: (existing, update) => [...existing, ...update].slice(-50),
        default: () => [],
    }),
    currentStreamId: (langgraph_1.Annotation),
    approvalRequired: (langgraph_1.Annotation),
    approvalDecision: (langgraph_1.Annotation),
    userFeedback: (langgraph_1.Annotation),
    pendingApprovals: (langgraph_1.Annotation),
    chatHistory: (0, langgraph_1.Annotation)({
        reducer: (existing, update) => [...existing, ...update].slice(-200),
        default: () => [],
    }),
    errors: (langgraph_1.Annotation),
    retryCount: (langgraph_1.Annotation),
    createdAt: (langgraph_1.Annotation),
    lastUpdatedAt: (langgraph_1.Annotation),
    lastCheckpointAt: (langgraph_1.Annotation),
    // Feedback loop state (BA <-> SA discrepancy resolution)
    feedbackIterations: (0, langgraph_1.Annotation)({
        reducer: (_existing, update) => update,
        default: () => 0,
    }),
    maxFeedbackIterations: (0, langgraph_1.Annotation)({
        reducer: (_existing, update) => update,
        default: () => 5,
    }),
    discrepancyFound: (0, langgraph_1.Annotation)({
        reducer: (_existing, update) => update,
        default: () => false,
    }),
    previousNode: (0, langgraph_1.Annotation)({
        reducer: (_existing, update) => update,
        default: () => null,
    }),
    // Parallel execution results collector
    parallelResults: (0, langgraph_1.Annotation)({
        reducer: (existing, update) => ({ ...existing, ...update }),
        default: () => ({}),
    }),
    // Per-phase quality gate results
    qualityGateResults: (0, langgraph_1.Annotation)({
        reducer: (existing, update) => ({ ...existing, ...update }),
        default: () => ({}),
    }),
    // ReAct agent loop state (Chat Graph)
    toolCalls: (0, langgraph_1.Annotation)({
        reducer: (_existing, update) => update,
        default: () => null,
    }),
    toolResults: (0, langgraph_1.Annotation)({
        reducer: (existing, update) => [...existing, ...update],
        default: () => [],
    }),
    // KSA-240: Properly-paired ReAct conversation turns (assistant tool_use + tool results).
    // Accumulates across iterations so the LLM sees correct tool_use/tool_result pairing.
    agentScratchpad: (0, langgraph_1.Annotation)({
        reducer: (existing, update) => [...existing, ...update],
        default: () => [],
    }),
    agentIterations: (0, langgraph_1.Annotation)({
        reducer: (_existing, update) => update,
        default: () => 0,
    }),
    // === Self-Correction State (KSA-233) ===
    /** Last verification result — reset per verify execution */
    verifyPassed: (0, langgraph_1.Annotation)({
        reducer: (_existing, update) => update,
        default: () => true,
    }),
    /** Feedback from verify node when verification fails */
    verifyFeedback: (0, langgraph_1.Annotation)({
        reducer: (_existing, update) => update,
        default: () => null,
    }),
    /** Verify attempt count per target node (e.g., { "ba_brd": 2 }) */
    verifyAttempts: (0, langgraph_1.Annotation)({
        reducer: (existing, update) => ({ ...existing, ...update }),
        default: () => ({}),
    }),
    /** Maximum verify attempts before strategy switch (default: 2) */
    maxVerifyAttempts: (0, langgraph_1.Annotation)({
        reducer: (_existing, update) => update,
        default: () => 2,
    }),
    /** Active strategy per node ("primary" or "alternate") */
    activeStrategy: (0, langgraph_1.Annotation)({
        reducer: (existing, update) => ({ ...existing, ...update }),
        default: () => ({}),
    }),
    /** History log of strategy switches (append-only, capped at 20) */
    strategyHistory: (0, langgraph_1.Annotation)({
        reducer: (existing, update) => [...existing, ...update].slice(-20),
        default: () => [],
    }),
});
//# sourceMappingURL=state.js.map
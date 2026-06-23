/**
 * Conditional Edge Routing — KSA-210
 * Full SDLC pipeline routing logic with feedback loops, parallel fanout,
 * and per-phase quality gates.
 */

import { PipelineState } from "./state";

// === Phase Ordering ===

const PHASE_ORDER: string[] = [
  "requirements",
  "specification",
  "design",
  "test_planning",
  "implementation",
  "user_guide",
  "testing",
  "deployment",
];

// === SM Routing ===

/** After SM node: route to the appropriate agent(s) based on current phase */
export function routeFromSm(state: PipelineState): string {
  switch (state.currentPhase) {
    case "requirements":
      return "ba_brd";
    case "specification":
      return "ba_fsd";
    case "design":
      return "sa_tdd";
    case "test_planning":
      return "qa_plan";
    case "implementation":
      return "dev_code";
    case "user_guide":
      return "dev_ug";
    case "testing":
      return "qa_test";
    case "deployment":
      return "devops_deploy";
    case "all":
      return "ba_brd"; // Start full pipeline from requirements
    default:
      return "ba_brd";
  }
}

// === Post-Node Routing (to quality gates) ===

/** After BA BRD node: go to quality gate for requirements */
export function routeAfterBaBrd(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "quality_gate_requirements";
}

/** After TA enrichment: go to quality gate for specification */
export function routeAfterTaEnrich(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "quality_gate_specification";
}

/** After SA TDD: go to feedback check */
export function routeAfterSaTdd(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "feedback_check";
}

/** After QA plan: go to quality gate for test_planning */
export function routeAfterQaPlan(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "quality_gate_test_planning";
}

/** After DEV code: go to quality gate for implementation */
export function routeAfterDevCode(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "quality_gate_implementation";
}

/** After UG join (parallel complete): go to quality gate for user_guide */
export function routeAfterUgJoin(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "quality_gate_user_guide";
}

/** After QA test: go to quality gate for testing */
export function routeAfterQaTest(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "quality_gate_testing";
}

/** After DevOps deploy: go to quality gate for deployment */
export function routeAfterDevOpsDeploy(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "quality_gate_deployment";
}

// === Feedback Loop Routing ===

/** After feedback check node: route based on discrepancy status */
export function routeAfterFeedbackCheck(state: PipelineState): string {
  // No discrepancy or max iterations reached (paused) — go to security review
  if (!state.discrepancyFound) {
    return "security_review_tdd";
  }

  // Max iterations exceeded — still go through security before QG
  if (state.feedbackIterations >= state.maxFeedbackIterations) {
    return "security_review_tdd";
  }

  // Discrepancy exists — route to BA for FSD fix
  return "ba_fix_fsd";
}

/** After BA fixes FSD: route back to SA for re-review */
export function routeAfterBaFixFsd(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "sa_review";
}

/** After SA re-reviews: go back to feedback check */
export function routeAfterSaReview(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "feedback_check";
}

// === Quality Gate Routing (per-phase) ===

/** Generic quality gate result router */
export function routeAfterQualityGate(state: PipelineState): string {
  // If pipeline is paused, user needs to approve
  if (state.pipelineStatus === "paused") {
    return "__end__";
  }

  if (!state.approvalDecision) {
    // Waiting for approval — end and wait for resume
    return "__end__";
  }

  switch (state.approvalDecision) {
    case "approve":
      return advanceToNextPhase(state.currentPhase);
    case "reject":
      return "__end__";
    case "revise":
      return getPhaseNode(state.currentPhase);
    default:
      return "__end__";
  }
}

// === Parallel UG Routing ===

/** After DEV writes UG: route to BA review UG (simulated parallel via sequential) */
export function routeAfterDevUg(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "ba_review_ug";
}

/** After BA reviews UG: route to QA verify UG */
export function routeAfterBaReviewUg(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "qa_verify_ug";
}

/** After QA verifies UG: route to UG join node */
export function routeAfterQaVerifyUg(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "ug_join";
}

// === Helper Functions ===

/** Get the agent node for a given phase */
function getPhaseNode(phase: string): string {
  const phaseNodes: Record<string, string> = {
    requirements: "ba_brd",
    specification: "ba_fsd",
    design: "sa_tdd",
    test_planning: "qa_plan",
    implementation: "dev_code",
    user_guide: "dev_ug",
    testing: "qa_test",
    deployment: "devops_deploy",
  };
  return phaseNodes[phase] || "__end__";
}

/** Advance to the next phase's SM re-entry or the appropriate node */
function advanceToNextPhase(currentPhase: string): string {
  const idx = PHASE_ORDER.indexOf(currentPhase);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) {
    return "__end__"; // Last phase or unknown — pipeline complete
  }
  // Re-enter via SM for next phase routing
  return "sm";
}

// === Legacy Compatibility (used by approval-node internally) ===

/** @deprecated Use phase-specific route functions instead */
export function routeAfterNode(state: PipelineState): string {
  if (state.pipelineStatus === "failed") return "__end__";
  return "approval";
}

/** @deprecated Use routeAfterQualityGate instead */
export function routeAfterApproval(state: PipelineState): string {
  return routeAfterQualityGate(state);
}

// === Self-Correction Routing (KSA-233) ===

/**
 * After verify node: route based on verification result.
 * Factory function that returns a routing function for the specific verify node.
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

    // Verify failed — check attempt count
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

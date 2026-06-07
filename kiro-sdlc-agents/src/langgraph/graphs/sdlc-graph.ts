/**
 * SDLC Subgraph — Full SDLC Pipeline
 * Moved from graph-builder.ts. Contains all agent nodes, feedback loops,
 * parallel execution (sequential simulation), and per-phase quality gates.
 */

import { StateGraph, END } from "@langchain/langgraph";
import { PipelineAnnotation, PipelineState } from "../state";
import { McpBridge } from "../mcp-bridge";
import { StreamHandler } from "../stream-handler";
import { WorkspaceCheckpointer } from "../checkpointer";
import type { LlmProvider } from "../llm-provider";

import { SmNode } from "../nodes/sm-node";
import { BaNode } from "../nodes/ba-node";
import { TaNode } from "../nodes/ta-node";
import { SaNode } from "../nodes/sa-node";
import { QaNode } from "../nodes/qa-node";
import { DevNode } from "../nodes/dev-node";
import { DevOpsNode } from "../nodes/devops-node";
import { SecurityNode } from "../nodes/security-node";
import { FeedbackNode } from "../nodes/feedback-node";
import { ApprovalNode } from "../nodes/approval-node";
import { VerifyNode } from "../nodes/verify-node";
import { getAlternateStrategy } from "../config/alternate-strategies";

import {
  routeFromSm,
  routeAfterBaBrd,
  routeAfterTaEnrich,
  routeAfterSaTdd,
  routeAfterQaPlan,
  routeAfterDevCode,
  routeAfterUgJoin,
  routeAfterQaTest,
  routeAfterDevOpsDeploy,
  routeAfterFeedbackCheck,
  routeAfterBaFixFsd,
  routeAfterSaReview,
  routeAfterQualityGate,
  routeAfterDevUg,
  routeAfterBaReviewUg,
  routeAfterQaVerifyUg,
  routeAfterVerify,
  routeAfterStrategySwitch,
} from "../edges";

/**
 * Build and compile the full SDLC pipeline subgraph.
 */
export async function buildSdlcSubgraph(
  mcpBridge: McpBridge,
  streamHandler: StreamHandler,
  checkpointer: WorkspaceCheckpointer,
  llmProvider?: LlmProvider
) {
  const smNode = new SmNode("sm", mcpBridge, streamHandler, llmProvider);
  const baBrdNode = new BaNode("ba_brd", mcpBridge, streamHandler, llmProvider);
  const baFsdNode = new BaNode("ba_fsd", mcpBridge, streamHandler, llmProvider);
  const taEnrichNode = new TaNode("ta_enrich", mcpBridge, streamHandler, llmProvider);
  const saTddNode = new SaNode("sa_tdd", mcpBridge, streamHandler, llmProvider);
  const feedbackNode = new FeedbackNode("feedback_check", mcpBridge, streamHandler, llmProvider);
  const baFixFsdNode = new BaNode("ba_fix_fsd", mcpBridge, streamHandler, llmProvider);
  const saReviewNode = new SaNode("sa_review", mcpBridge, streamHandler, llmProvider);
  const qaPlanNode = new QaNode("qa_plan", mcpBridge, streamHandler, llmProvider);
  const devCodeNode = new DevNode("dev_code", mcpBridge, streamHandler, llmProvider);
  const devUgNode = new DevNode("dev_ug", mcpBridge, streamHandler, llmProvider);
  const baReviewUgNode = new BaNode("ba_review_ug", mcpBridge, streamHandler, llmProvider);
  const qaVerifyUgNode = new QaNode("qa_verify_ug", mcpBridge, streamHandler, llmProvider);
  const qaTestNode = new QaNode("qa_test", mcpBridge, streamHandler, llmProvider);
  const devopsDeployNode = new DevOpsNode("devops_deploy", mcpBridge, streamHandler, llmProvider);
  const securityFsdNode = new SecurityNode("security_review_fsd", mcpBridge, streamHandler, llmProvider);
  const securityTddNode = new SecurityNode("security_review_tdd", mcpBridge, streamHandler, llmProvider);
  const securityCodeNode = new SecurityNode("security_review_code", mcpBridge, streamHandler, llmProvider);

  const qgRequirements = new ApprovalNode("quality_gate_requirements", "requirements", mcpBridge, streamHandler, llmProvider);
  const qgSpecification = new ApprovalNode("quality_gate_specification", "specification", mcpBridge, streamHandler, llmProvider);
  const qgDesign = new ApprovalNode("quality_gate_design", "design", mcpBridge, streamHandler, llmProvider);
  const qgTestPlanning = new ApprovalNode("quality_gate_test_planning", "test_planning", mcpBridge, streamHandler, llmProvider);
  const qgImplementation = new ApprovalNode("quality_gate_implementation", "implementation", mcpBridge, streamHandler, llmProvider);
  const qgUserGuide = new ApprovalNode("quality_gate_user_guide", "user_guide", mcpBridge, streamHandler, llmProvider);
  const qgTesting = new ApprovalNode("quality_gate_testing", "testing", mcpBridge, streamHandler, llmProvider);
  const qgDeployment = new ApprovalNode("quality_gate_deployment", "deployment", mcpBridge, streamHandler, llmProvider);

  // === Verify Nodes (KSA-233) ===
  const verifyBaBrd = new VerifyNode("verify_ba_brd", "ba_brd", mcpBridge, streamHandler, llmProvider);
  const verifyBaFsd = new VerifyNode("verify_ba_fsd", "ba_fsd", mcpBridge, streamHandler, llmProvider);
  const verifySaTdd = new VerifyNode("verify_sa_tdd", "sa_tdd", mcpBridge, streamHandler, llmProvider);
  const verifyQaPlan = new VerifyNode("verify_qa_plan", "qa_plan", mcpBridge, streamHandler, llmProvider);
  const verifyDevCode = new VerifyNode("verify_dev_code", "dev_code", mcpBridge, streamHandler, llmProvider);
  const verifyDevUg = new VerifyNode("verify_dev_ug", "dev_ug", mcpBridge, streamHandler, llmProvider);

  /**
   * Strategy switch inline node (KSA-233).
   * Evaluates whether to activate alternate strategy or pause for human.
   */
  async function strategySwitchNode(state: PipelineState): Promise<Partial<PipelineState>> {
    const failedNodeId = getLastFailedVerifyTarget(state);
    if (!failedNodeId) {
      return { pipelineStatus: "paused", approvalRequired: true, lastUpdatedAt: new Date().toISOString() };
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

  /** Helper: find which agent node last failed verification */
  function getLastFailedVerifyTarget(state: PipelineState): string | null {
    if (!state.verifyAttempts) return null;
    const maxAttempts = state.maxVerifyAttempts ?? 2;
    for (const [nodeId, attempts] of Object.entries(state.verifyAttempts)) {
      if (attempts >= maxAttempts) {
        return nodeId;
      }
    }
    return null;
  }

  /** Helper: get verify history for a node */
  function getVerifyHistory(state: PipelineState, _nodeId: string): Array<{ attempt: number; feedback: string }> {
    const attempts = state.verifyAttempts?.[_nodeId] ?? 0;
    const feedback = state.verifyFeedback ?? "";
    // Build a simplified history from current state
    return [{ attempt: attempts, feedback }];
  }

  const graph = new StateGraph(PipelineAnnotation)
    .addNode("sm", (state: PipelineState) => smNode.run(state))
    .addNode("ba_brd", (state: PipelineState) => baBrdNode.run(state))
    .addNode("quality_gate_requirements", (state: PipelineState) => qgRequirements.run(state))
    .addNode("ba_fsd", (state: PipelineState) => baFsdNode.run(state))
    .addNode("ta_enrich", (state: PipelineState) => taEnrichNode.run(state))
    .addNode("security_review_fsd", (state: PipelineState) => securityFsdNode.run(state))
    .addNode("quality_gate_specification", (state: PipelineState) => qgSpecification.run(state))
    .addNode("sa_tdd", (state: PipelineState) => saTddNode.run(state))
    .addNode("feedback_check", (state: PipelineState) => feedbackNode.run(state))
    .addNode("ba_fix_fsd", (state: PipelineState) => baFixFsdNode.run(state))
    .addNode("sa_review", (state: PipelineState) => saReviewNode.run(state))
    .addNode("security_review_tdd", (state: PipelineState) => securityTddNode.run(state))
    .addNode("quality_gate_design", (state: PipelineState) => qgDesign.run(state))
    .addNode("qa_plan", (state: PipelineState) => qaPlanNode.run(state))
    .addNode("quality_gate_test_planning", (state: PipelineState) => qgTestPlanning.run(state))
    .addNode("dev_code", (state: PipelineState) => devCodeNode.run(state))
    .addNode("security_review_code", (state: PipelineState) => securityCodeNode.run(state))
    .addNode("quality_gate_implementation", (state: PipelineState) => qgImplementation.run(state))
    .addNode("dev_ug", (state: PipelineState) => devUgNode.run(state))
    .addNode("ba_review_ug", (state: PipelineState) => baReviewUgNode.run(state))
    .addNode("qa_verify_ug", (state: PipelineState) => qaVerifyUgNode.run(state))
    .addNode("ug_join", async (state: PipelineState) => ({
      agentOutputs: [{
        nodeId: "ug_join",
        content: "User Guide pipeline complete: DEV wrote, BA reviewed, QA verified.",
        timestamp: new Date().toISOString(),
        metadata: { action: "ug_join", parallelResults: state.parallelResults },
      }],
      lastUpdatedAt: new Date().toISOString(),
    }))
    .addNode("quality_gate_user_guide", (state: PipelineState) => qgUserGuide.run(state))
    .addNode("qa_test", (state: PipelineState) => qaTestNode.run(state))
    .addNode("quality_gate_testing", (state: PipelineState) => qgTesting.run(state))
    .addNode("devops_deploy", (state: PipelineState) => devopsDeployNode.run(state))
    .addNode("quality_gate_deployment", (state: PipelineState) => qgDeployment.run(state))

    // === Verify Nodes + Strategy Switch (KSA-233) ===
    .addNode("verify_ba_brd", (state: PipelineState) => verifyBaBrd.run(state))
    .addNode("verify_ba_fsd", (state: PipelineState) => verifyBaFsd.run(state))
    .addNode("verify_sa_tdd", (state: PipelineState) => verifySaTdd.run(state))
    .addNode("verify_qa_plan", (state: PipelineState) => verifyQaPlan.run(state))
    .addNode("verify_dev_code", (state: PipelineState) => verifyDevCode.run(state))
    .addNode("verify_dev_ug", (state: PipelineState) => verifyDevUg.run(state))
    .addNode("strategy_switch", (state: PipelineState) => strategySwitchNode(state))

    .addEdge("__start__", "sm")
    .addConditionalEdges("sm", routeFromSm, {
      ba_brd: "ba_brd", ba_fsd: "ba_fsd", sa_tdd: "sa_tdd",
      qa_plan: "qa_plan", dev_code: "dev_code", dev_ug: "dev_ug",
      qa_test: "qa_test", devops_deploy: "devops_deploy",
    })

    // ba_brd -> verify -> quality_gate (KSA-233: verify before quality gate)
    .addEdge("ba_brd", "verify_ba_brd")
    .addConditionalEdges("verify_ba_brd", routeAfterVerify("ba_brd", "quality_gate_requirements"), {
      quality_gate_requirements: "quality_gate_requirements",
      ba_brd: "ba_brd",
      strategy_switch: "strategy_switch",
      __end__: END,
    })
    .addConditionalEdges("quality_gate_requirements", routeAfterQualityGate, { sm: "sm", ba_brd: "ba_brd", __end__: END })

    // ba_fsd -> verify -> ta_enrich (KSA-233: verify before TA enrichment)
    .addEdge("ba_fsd", "verify_ba_fsd")
    .addConditionalEdges("verify_ba_fsd", routeAfterVerify("ba_fsd", "ta_enrich"), {
      ta_enrich: "ta_enrich",
      ba_fsd: "ba_fsd",
      strategy_switch: "strategy_switch",
      __end__: END,
    })
    .addEdge("ta_enrich", "security_review_fsd")
    .addConditionalEdges("security_review_fsd", routeAfterTaEnrich, { quality_gate_specification: "quality_gate_specification", __end__: END })
    .addConditionalEdges("quality_gate_specification", routeAfterQualityGate, { sm: "sm", ba_fsd: "ba_fsd", __end__: END })

    // sa_tdd -> verify -> feedback_check (KSA-233)
    .addEdge("sa_tdd", "verify_sa_tdd")
    .addConditionalEdges("verify_sa_tdd", routeAfterVerify("sa_tdd", "feedback_check"), {
      feedback_check: "feedback_check",
      sa_tdd: "sa_tdd",
      strategy_switch: "strategy_switch",
      __end__: END,
    })
    .addConditionalEdges("feedback_check", routeAfterFeedbackCheck, { security_review_tdd: "security_review_tdd", ba_fix_fsd: "ba_fix_fsd" })
    .addEdge("security_review_tdd", "quality_gate_design")
    .addConditionalEdges("ba_fix_fsd", routeAfterBaFixFsd, { sa_review: "sa_review", __end__: END })
    .addConditionalEdges("sa_review", routeAfterSaReview, { feedback_check: "feedback_check", __end__: END })
    .addConditionalEdges("quality_gate_design", routeAfterQualityGate, { sm: "sm", sa_tdd: "sa_tdd", __end__: END })

    // qa_plan -> verify -> quality_gate_test_planning (KSA-233)
    .addEdge("qa_plan", "verify_qa_plan")
    .addConditionalEdges("verify_qa_plan", routeAfterVerify("qa_plan", "quality_gate_test_planning"), {
      quality_gate_test_planning: "quality_gate_test_planning",
      qa_plan: "qa_plan",
      strategy_switch: "strategy_switch",
      __end__: END,
    })
    .addConditionalEdges("quality_gate_test_planning", routeAfterQualityGate, { sm: "sm", qa_plan: "qa_plan", __end__: END })

    // dev_code -> verify -> security_review_code (KSA-233)
    .addEdge("dev_code", "verify_dev_code")
    .addConditionalEdges("verify_dev_code", routeAfterVerify("dev_code", "security_review_code"), {
      security_review_code: "security_review_code",
      dev_code: "dev_code",
      strategy_switch: "strategy_switch",
      __end__: END,
    })
    .addConditionalEdges("security_review_code", routeAfterDevCode, { quality_gate_implementation: "quality_gate_implementation", __end__: END })
    .addConditionalEdges("quality_gate_implementation", routeAfterQualityGate, { sm: "sm", dev_code: "dev_code", __end__: END })

    // dev_ug -> verify -> ba_review_ug (KSA-233)
    .addEdge("dev_ug", "verify_dev_ug")
    .addConditionalEdges("verify_dev_ug", routeAfterVerify("dev_ug", "ba_review_ug"), {
      ba_review_ug: "ba_review_ug",
      dev_ug: "dev_ug",
      strategy_switch: "strategy_switch",
      __end__: END,
    })
    .addConditionalEdges("ba_review_ug", routeAfterBaReviewUg, { qa_verify_ug: "qa_verify_ug", __end__: END })
    .addConditionalEdges("qa_verify_ug", routeAfterQaVerifyUg, { ug_join: "ug_join", __end__: END })
    .addConditionalEdges("ug_join", routeAfterUgJoin, { quality_gate_user_guide: "quality_gate_user_guide", __end__: END })
    .addConditionalEdges("quality_gate_user_guide", routeAfterQualityGate, { sm: "sm", dev_ug: "dev_ug", __end__: END })

    .addConditionalEdges("qa_test", routeAfterQaTest, { quality_gate_testing: "quality_gate_testing", __end__: END })
    .addConditionalEdges("quality_gate_testing", routeAfterQualityGate, { sm: "sm", qa_test: "qa_test", __end__: END })

    .addConditionalEdges("devops_deploy", routeAfterDevOpsDeploy, { quality_gate_deployment: "quality_gate_deployment", __end__: END })
    .addConditionalEdges("quality_gate_deployment", routeAfterQualityGate, { sm: "sm", devops_deploy: "devops_deploy", __end__: END })

    // === Strategy Switch routing (KSA-233) ===
    .addConditionalEdges("strategy_switch", routeAfterStrategySwitch, {
      ba_brd: "ba_brd",
      ba_fsd: "ba_fsd",
      sa_tdd: "sa_tdd",
      qa_plan: "qa_plan",
      dev_code: "dev_code",
      dev_ug: "dev_ug",
      __end__: END,
    });

  return graph.compile({ checkpointer });
}

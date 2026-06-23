"use strict";
/**
 * SDLC Subgraph — Full SDLC Pipeline
 * Moved from graph-builder.ts. Contains all agent nodes, feedback loops,
 * parallel execution (sequential simulation), and per-phase quality gates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSdlcSubgraph = buildSdlcSubgraph;
const langgraph_1 = require("@langchain/langgraph");
const state_1 = require("../state");
const sm_node_1 = require("../nodes/sm-node");
const ba_node_1 = require("../nodes/ba-node");
const ta_node_1 = require("../nodes/ta-node");
const sa_node_1 = require("../nodes/sa-node");
const qa_node_1 = require("../nodes/qa-node");
const dev_node_1 = require("../nodes/dev-node");
const devops_node_1 = require("../nodes/devops-node");
const security_node_1 = require("../nodes/security-node");
const feedback_node_1 = require("../nodes/feedback-node");
const approval_node_1 = require("../nodes/approval-node");
const verify_node_1 = require("../nodes/verify-node");
const alternate_strategies_1 = require("../config/alternate-strategies");
const edges_1 = require("../edges");
/**
 * Build and compile the full SDLC pipeline subgraph.
 */
async function buildSdlcSubgraph(mcpBridge, streamHandler, checkpointer, llmProvider) {
    const smNode = new sm_node_1.SmNode("sm", mcpBridge, streamHandler, llmProvider);
    const baBrdNode = new ba_node_1.BaNode("ba_brd", mcpBridge, streamHandler, llmProvider);
    const baFsdNode = new ba_node_1.BaNode("ba_fsd", mcpBridge, streamHandler, llmProvider);
    const taEnrichNode = new ta_node_1.TaNode("ta_enrich", mcpBridge, streamHandler, llmProvider);
    const saTddNode = new sa_node_1.SaNode("sa_tdd", mcpBridge, streamHandler, llmProvider);
    const feedbackNode = new feedback_node_1.FeedbackNode("feedback_check", mcpBridge, streamHandler, llmProvider);
    const baFixFsdNode = new ba_node_1.BaNode("ba_fix_fsd", mcpBridge, streamHandler, llmProvider);
    const saReviewNode = new sa_node_1.SaNode("sa_review", mcpBridge, streamHandler, llmProvider);
    const qaPlanNode = new qa_node_1.QaNode("qa_plan", mcpBridge, streamHandler, llmProvider);
    const devCodeNode = new dev_node_1.DevNode("dev_code", mcpBridge, streamHandler, llmProvider);
    const devUgNode = new dev_node_1.DevNode("dev_ug", mcpBridge, streamHandler, llmProvider);
    const baReviewUgNode = new ba_node_1.BaNode("ba_review_ug", mcpBridge, streamHandler, llmProvider);
    const qaVerifyUgNode = new qa_node_1.QaNode("qa_verify_ug", mcpBridge, streamHandler, llmProvider);
    const qaTestNode = new qa_node_1.QaNode("qa_test", mcpBridge, streamHandler, llmProvider);
    const devopsDeployNode = new devops_node_1.DevOpsNode("devops_deploy", mcpBridge, streamHandler, llmProvider);
    const securityFsdNode = new security_node_1.SecurityNode("security_review_fsd", mcpBridge, streamHandler, llmProvider);
    const securityTddNode = new security_node_1.SecurityNode("security_review_tdd", mcpBridge, streamHandler, llmProvider);
    const securityCodeNode = new security_node_1.SecurityNode("security_review_code", mcpBridge, streamHandler, llmProvider);
    const qgRequirements = new approval_node_1.ApprovalNode("quality_gate_requirements", "requirements", mcpBridge, streamHandler, llmProvider);
    const qgSpecification = new approval_node_1.ApprovalNode("quality_gate_specification", "specification", mcpBridge, streamHandler, llmProvider);
    const qgDesign = new approval_node_1.ApprovalNode("quality_gate_design", "design", mcpBridge, streamHandler, llmProvider);
    const qgTestPlanning = new approval_node_1.ApprovalNode("quality_gate_test_planning", "test_planning", mcpBridge, streamHandler, llmProvider);
    const qgImplementation = new approval_node_1.ApprovalNode("quality_gate_implementation", "implementation", mcpBridge, streamHandler, llmProvider);
    const qgUserGuide = new approval_node_1.ApprovalNode("quality_gate_user_guide", "user_guide", mcpBridge, streamHandler, llmProvider);
    const qgTesting = new approval_node_1.ApprovalNode("quality_gate_testing", "testing", mcpBridge, streamHandler, llmProvider);
    const qgDeployment = new approval_node_1.ApprovalNode("quality_gate_deployment", "deployment", mcpBridge, streamHandler, llmProvider);
    // === Verify Nodes (KSA-233) ===
    const verifyBaBrd = new verify_node_1.VerifyNode("verify_ba_brd", "ba_brd", mcpBridge, streamHandler, llmProvider);
    const verifyBaFsd = new verify_node_1.VerifyNode("verify_ba_fsd", "ba_fsd", mcpBridge, streamHandler, llmProvider);
    const verifySaTdd = new verify_node_1.VerifyNode("verify_sa_tdd", "sa_tdd", mcpBridge, streamHandler, llmProvider);
    const verifyQaPlan = new verify_node_1.VerifyNode("verify_qa_plan", "qa_plan", mcpBridge, streamHandler, llmProvider);
    const verifyDevCode = new verify_node_1.VerifyNode("verify_dev_code", "dev_code", mcpBridge, streamHandler, llmProvider);
    const verifyDevUg = new verify_node_1.VerifyNode("verify_dev_ug", "dev_ug", mcpBridge, streamHandler, llmProvider);
    /**
     * Strategy switch inline node (KSA-233).
     * Evaluates whether to activate alternate strategy or pause for human.
     */
    async function strategySwitchNode(state) {
        const failedNodeId = getLastFailedVerifyTarget(state);
        if (!failedNodeId) {
            return { pipelineStatus: "paused", approvalRequired: true, lastUpdatedAt: new Date().toISOString() };
        }
        const currentStrategy = state.activeStrategy?.[failedNodeId] ?? "primary";
        const alternateConfig = (0, alternate_strategies_1.getAlternateStrategy)(failedNodeId);
        // If already on alternate OR no alternate defined -> pause for human
        if (currentStrategy === "alternate" || !alternateConfig) {
            streamHandler.emitHumanIntervention(failedNodeId, [currentStrategy], getVerifyHistory(state, failedNodeId), state.currentStreamId);
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
        streamHandler.emitStrategySwitch(failedNodeId, "primary", "alternate", "Primary strategy failed verification twice", state.currentStreamId);
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
    function getLastFailedVerifyTarget(state) {
        if (!state.verifyAttempts)
            return null;
        const maxAttempts = state.maxVerifyAttempts ?? 2;
        for (const [nodeId, attempts] of Object.entries(state.verifyAttempts)) {
            if (attempts >= maxAttempts) {
                return nodeId;
            }
        }
        return null;
    }
    /** Helper: get verify history for a node */
    function getVerifyHistory(state, _nodeId) {
        const attempts = state.verifyAttempts?.[_nodeId] ?? 0;
        const feedback = state.verifyFeedback ?? "";
        // Build a simplified history from current state
        return [{ attempt: attempts, feedback }];
    }
    const graph = new langgraph_1.StateGraph(state_1.PipelineAnnotation)
        .addNode("sm", (state) => smNode.run(state))
        .addNode("ba_brd", (state) => baBrdNode.run(state))
        .addNode("quality_gate_requirements", (state) => qgRequirements.run(state))
        .addNode("ba_fsd", (state) => baFsdNode.run(state))
        .addNode("ta_enrich", (state) => taEnrichNode.run(state))
        .addNode("security_review_fsd", (state) => securityFsdNode.run(state))
        .addNode("quality_gate_specification", (state) => qgSpecification.run(state))
        .addNode("sa_tdd", (state) => saTddNode.run(state))
        .addNode("feedback_check", (state) => feedbackNode.run(state))
        .addNode("ba_fix_fsd", (state) => baFixFsdNode.run(state))
        .addNode("sa_review", (state) => saReviewNode.run(state))
        .addNode("security_review_tdd", (state) => securityTddNode.run(state))
        .addNode("quality_gate_design", (state) => qgDesign.run(state))
        .addNode("qa_plan", (state) => qaPlanNode.run(state))
        .addNode("quality_gate_test_planning", (state) => qgTestPlanning.run(state))
        .addNode("dev_code", (state) => devCodeNode.run(state))
        .addNode("security_review_code", (state) => securityCodeNode.run(state))
        .addNode("quality_gate_implementation", (state) => qgImplementation.run(state))
        .addNode("dev_ug", (state) => devUgNode.run(state))
        .addNode("ba_review_ug", (state) => baReviewUgNode.run(state))
        .addNode("qa_verify_ug", (state) => qaVerifyUgNode.run(state))
        .addNode("ug_join", async (state) => ({
        agentOutputs: [{
                nodeId: "ug_join",
                content: "User Guide pipeline complete: DEV wrote, BA reviewed, QA verified.",
                timestamp: new Date().toISOString(),
                metadata: { action: "ug_join", parallelResults: state.parallelResults },
            }],
        lastUpdatedAt: new Date().toISOString(),
    }))
        .addNode("quality_gate_user_guide", (state) => qgUserGuide.run(state))
        .addNode("qa_test", (state) => qaTestNode.run(state))
        .addNode("quality_gate_testing", (state) => qgTesting.run(state))
        .addNode("devops_deploy", (state) => devopsDeployNode.run(state))
        .addNode("quality_gate_deployment", (state) => qgDeployment.run(state))
        // === Verify Nodes + Strategy Switch (KSA-233) ===
        .addNode("verify_ba_brd", (state) => verifyBaBrd.run(state))
        .addNode("verify_ba_fsd", (state) => verifyBaFsd.run(state))
        .addNode("verify_sa_tdd", (state) => verifySaTdd.run(state))
        .addNode("verify_qa_plan", (state) => verifyQaPlan.run(state))
        .addNode("verify_dev_code", (state) => verifyDevCode.run(state))
        .addNode("verify_dev_ug", (state) => verifyDevUg.run(state))
        .addNode("strategy_switch", (state) => strategySwitchNode(state))
        .addEdge("__start__", "sm")
        .addConditionalEdges("sm", edges_1.routeFromSm, {
        ba_brd: "ba_brd", ba_fsd: "ba_fsd", sa_tdd: "sa_tdd",
        qa_plan: "qa_plan", dev_code: "dev_code", dev_ug: "dev_ug",
        qa_test: "qa_test", devops_deploy: "devops_deploy",
    })
        // ba_brd -> verify -> quality_gate (KSA-233: verify before quality gate)
        .addEdge("ba_brd", "verify_ba_brd")
        .addConditionalEdges("verify_ba_brd", (0, edges_1.routeAfterVerify)("ba_brd", "quality_gate_requirements"), {
        quality_gate_requirements: "quality_gate_requirements",
        ba_brd: "ba_brd",
        strategy_switch: "strategy_switch",
        __end__: langgraph_1.END,
    })
        .addConditionalEdges("quality_gate_requirements", edges_1.routeAfterQualityGate, { sm: "sm", ba_brd: "ba_brd", __end__: langgraph_1.END })
        // ba_fsd -> verify -> ta_enrich (KSA-233: verify before TA enrichment)
        .addEdge("ba_fsd", "verify_ba_fsd")
        .addConditionalEdges("verify_ba_fsd", (0, edges_1.routeAfterVerify)("ba_fsd", "ta_enrich"), {
        ta_enrich: "ta_enrich",
        ba_fsd: "ba_fsd",
        strategy_switch: "strategy_switch",
        __end__: langgraph_1.END,
    })
        .addEdge("ta_enrich", "security_review_fsd")
        .addConditionalEdges("security_review_fsd", edges_1.routeAfterTaEnrich, { quality_gate_specification: "quality_gate_specification", __end__: langgraph_1.END })
        .addConditionalEdges("quality_gate_specification", edges_1.routeAfterQualityGate, { sm: "sm", ba_fsd: "ba_fsd", __end__: langgraph_1.END })
        // sa_tdd -> verify -> feedback_check (KSA-233)
        .addEdge("sa_tdd", "verify_sa_tdd")
        .addConditionalEdges("verify_sa_tdd", (0, edges_1.routeAfterVerify)("sa_tdd", "feedback_check"), {
        feedback_check: "feedback_check",
        sa_tdd: "sa_tdd",
        strategy_switch: "strategy_switch",
        __end__: langgraph_1.END,
    })
        .addConditionalEdges("feedback_check", edges_1.routeAfterFeedbackCheck, { security_review_tdd: "security_review_tdd", ba_fix_fsd: "ba_fix_fsd" })
        .addEdge("security_review_tdd", "quality_gate_design")
        .addConditionalEdges("ba_fix_fsd", edges_1.routeAfterBaFixFsd, { sa_review: "sa_review", __end__: langgraph_1.END })
        .addConditionalEdges("sa_review", edges_1.routeAfterSaReview, { feedback_check: "feedback_check", __end__: langgraph_1.END })
        .addConditionalEdges("quality_gate_design", edges_1.routeAfterQualityGate, { sm: "sm", sa_tdd: "sa_tdd", __end__: langgraph_1.END })
        // qa_plan -> verify -> quality_gate_test_planning (KSA-233)
        .addEdge("qa_plan", "verify_qa_plan")
        .addConditionalEdges("verify_qa_plan", (0, edges_1.routeAfterVerify)("qa_plan", "quality_gate_test_planning"), {
        quality_gate_test_planning: "quality_gate_test_planning",
        qa_plan: "qa_plan",
        strategy_switch: "strategy_switch",
        __end__: langgraph_1.END,
    })
        .addConditionalEdges("quality_gate_test_planning", edges_1.routeAfterQualityGate, { sm: "sm", qa_plan: "qa_plan", __end__: langgraph_1.END })
        // dev_code -> verify -> security_review_code (KSA-233)
        .addEdge("dev_code", "verify_dev_code")
        .addConditionalEdges("verify_dev_code", (0, edges_1.routeAfterVerify)("dev_code", "security_review_code"), {
        security_review_code: "security_review_code",
        dev_code: "dev_code",
        strategy_switch: "strategy_switch",
        __end__: langgraph_1.END,
    })
        .addConditionalEdges("security_review_code", edges_1.routeAfterDevCode, { quality_gate_implementation: "quality_gate_implementation", __end__: langgraph_1.END })
        .addConditionalEdges("quality_gate_implementation", edges_1.routeAfterQualityGate, { sm: "sm", dev_code: "dev_code", __end__: langgraph_1.END })
        // dev_ug -> verify -> ba_review_ug (KSA-233)
        .addEdge("dev_ug", "verify_dev_ug")
        .addConditionalEdges("verify_dev_ug", (0, edges_1.routeAfterVerify)("dev_ug", "ba_review_ug"), {
        ba_review_ug: "ba_review_ug",
        dev_ug: "dev_ug",
        strategy_switch: "strategy_switch",
        __end__: langgraph_1.END,
    })
        .addConditionalEdges("ba_review_ug", edges_1.routeAfterBaReviewUg, { qa_verify_ug: "qa_verify_ug", __end__: langgraph_1.END })
        .addConditionalEdges("qa_verify_ug", edges_1.routeAfterQaVerifyUg, { ug_join: "ug_join", __end__: langgraph_1.END })
        .addConditionalEdges("ug_join", edges_1.routeAfterUgJoin, { quality_gate_user_guide: "quality_gate_user_guide", __end__: langgraph_1.END })
        .addConditionalEdges("quality_gate_user_guide", edges_1.routeAfterQualityGate, { sm: "sm", dev_ug: "dev_ug", __end__: langgraph_1.END })
        .addConditionalEdges("qa_test", edges_1.routeAfterQaTest, { quality_gate_testing: "quality_gate_testing", __end__: langgraph_1.END })
        .addConditionalEdges("quality_gate_testing", edges_1.routeAfterQualityGate, { sm: "sm", qa_test: "qa_test", __end__: langgraph_1.END })
        .addConditionalEdges("devops_deploy", edges_1.routeAfterDevOpsDeploy, { quality_gate_deployment: "quality_gate_deployment", __end__: langgraph_1.END })
        .addConditionalEdges("quality_gate_deployment", edges_1.routeAfterQualityGate, { sm: "sm", devops_deploy: "devops_deploy", __end__: langgraph_1.END })
        // === Strategy Switch routing (KSA-233) ===
        .addConditionalEdges("strategy_switch", edges_1.routeAfterStrategySwitch, {
        ba_brd: "ba_brd",
        ba_fsd: "ba_fsd",
        sa_tdd: "sa_tdd",
        qa_plan: "qa_plan",
        dev_code: "dev_code",
        dev_ug: "dev_ug",
        __end__: langgraph_1.END,
    });
    return graph.compile({ checkpointer });
}
//# sourceMappingURL=sdlc-graph.js.map
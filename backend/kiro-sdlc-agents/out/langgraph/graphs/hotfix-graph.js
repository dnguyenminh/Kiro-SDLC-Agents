"use strict";
/**
 * Hotfix Subgraph — Bug Fix Fast-Track Pipeline
 * Streamlined graph for urgent bug fixes without full SDLC ceremony.
 *
 * Flow: __start__ → analyze_bug → dev_fix → qa_verify → [pass?]
 *   pass → deploy_hotfix → __end__
 *   fail → dev_fix (loop, max 3)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHotfixSubgraph = buildHotfixSubgraph;
const langgraph_1 = require("@langchain/langgraph");
const state_1 = require("../state");
const dev_node_1 = require("../nodes/dev-node");
const qa_node_1 = require("../nodes/qa-node");
const devops_node_1 = require("../nodes/devops-node");
/** Maximum fix attempts before escalation */
const MAX_FIX_ATTEMPTS = 3;
/**
 * Build the hotfix subgraph for fast-track bug resolution.
 */
async function buildHotfixSubgraph(mcpBridge, streamHandler, llmProvider) {
    const devNode = new dev_node_1.DevNode("dev_fix", mcpBridge, streamHandler, llmProvider);
    const qaNode = new qa_node_1.QaNode("qa_verify", mcpBridge, streamHandler, llmProvider);
    const devopsNode = new devops_node_1.DevOpsNode("deploy_hotfix", mcpBridge, streamHandler, llmProvider);
    const graph = new langgraph_1.StateGraph(state_1.PipelineAnnotation)
        // Analyze bug description using LLM
        .addNode("analyze_bug", async (state) => {
        const streamId = state.currentStreamId || `stream-hotfix-${Date.now()}`;
        streamHandler.emitStatus("analyze_bug", "active", streamId);
        const lastMessage = state.chatHistory?.[state.chatHistory.length - 1];
        const bugDescription = lastMessage?.content || "";
        let analysis = `Bug report received: ${bugDescription}`;
        if (llmProvider) {
            try {
                analysis = await llmProvider.chat([
                    { role: "system", content: "You are a senior developer analyzing a bug report. Identify: 1) Root cause hypothesis, 2) Affected components, 3) Suggested fix approach. Be concise." },
                    { role: "user", content: bugDescription },
                ], { temperature: 0.3, maxTokens: 1024 });
            }
            catch {
                // Use basic analysis if LLM fails
            }
        }
        streamHandler.emitComplete("analyze_bug", 0, streamId);
        return {
            agentOutputs: [{
                    nodeId: "analyze_bug",
                    content: analysis,
                    timestamp: new Date().toISOString(),
                    metadata: { action: "bug_analysis" },
                }],
            currentPhase: "implementation",
            lastUpdatedAt: new Date().toISOString(),
        };
    })
        // DEV fixes the code
        .addNode("dev_fix", (state) => devNode.run(state))
        // QA verifies the fix
        .addNode("qa_verify", (state) => qaNode.run(state))
        // DevOps deploys the patch
        .addNode("deploy_hotfix", (state) => devopsNode.run(state))
        // Entry
        .addEdge("__start__", "analyze_bug")
        .addEdge("analyze_bug", "dev_fix")
        .addEdge("dev_fix", "qa_verify")
        // After QA: pass → deploy, fail → loop back to dev
        .addConditionalEdges("qa_verify", (state) => {
        if (state.pipelineStatus === "failed") {
            const attempts = state.retryCount?.["dev_fix"] || 0;
            if (attempts >= MAX_FIX_ATTEMPTS) {
                return "__end__"; // Escalate — max attempts reached
            }
            return "dev_fix"; // Loop back for another attempt
        }
        return "deploy_hotfix";
    }, {
        dev_fix: "dev_fix",
        deploy_hotfix: "deploy_hotfix",
        __end__: langgraph_1.END,
    })
        .addEdge("deploy_hotfix", langgraph_1.END);
    return graph.compile();
}
//# sourceMappingURL=hotfix-graph.js.map
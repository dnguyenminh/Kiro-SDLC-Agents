"use strict";
/**
 * Code Review Subgraph — PR/Code Review Pipeline
 * Automated code review with security scanning and quality assessment.
 *
 * Flow: __start__ → fetch_context → security_scan → quality_review → report → __end__
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCodeReviewSubgraph = buildCodeReviewSubgraph;
const langgraph_1 = require("@langchain/langgraph");
const state_1 = require("../state");
const security_node_1 = require("../nodes/security-node");
const qa_node_1 = require("../nodes/qa-node");
/**
 * Build the code review subgraph.
 */
async function buildCodeReviewSubgraph(mcpBridge, streamHandler, llmProvider) {
    const securityNode = new security_node_1.SecurityNode("security_scan", mcpBridge, streamHandler, llmProvider);
    const qaNode = new qa_node_1.QaNode("quality_review", mcpBridge, streamHandler, llmProvider);
    const graph = new langgraph_1.StateGraph(state_1.PipelineAnnotation)
        // Fetch PR/diff context
        .addNode("fetch_context", async (state) => {
        const streamId = state.currentStreamId || `stream-review-${Date.now()}`;
        streamHandler.emitStatus("fetch_context", "active", streamId);
        const lastMessage = state.chatHistory?.[state.chatHistory.length - 1];
        const reviewRequest = lastMessage?.content || "";
        // Attempt to fetch diff via MCP tools
        let context = `Review request: ${reviewRequest}`;
        try {
            const diffResult = await mcpBridge.callTool("read_file", { path: reviewRequest }, 30_000);
            if (diffResult) {
                context = diffResult;
            }
        }
        catch {
            // Continue with available context
        }
        streamHandler.emitComplete("fetch_context", 0, streamId);
        return {
            agentOutputs: [{
                    nodeId: "fetch_context",
                    content: context,
                    timestamp: new Date().toISOString(),
                    metadata: { action: "fetch_pr_context" },
                }],
            lastUpdatedAt: new Date().toISOString(),
        };
    })
        // Security scan for vulnerabilities
        .addNode("security_scan", (state) => securityNode.run(state))
        // Code quality review
        .addNode("quality_review", (state) => qaNode.run(state))
        // Generate review summary report
        .addNode("report", async (state) => {
        const streamId = state.currentStreamId || `stream-review-${Date.now()}`;
        streamHandler.emitStatus("report", "active", streamId);
        const outputs = state.agentOutputs || [];
        const securityFindings = outputs.find(o => o.nodeId === "security_scan")?.content || "No security issues found.";
        const qualityFindings = outputs.find(o => o.nodeId === "quality_review")?.content || "No quality issues found.";
        let report = `## Code Review Report\n\n### Security\n${securityFindings}\n\n### Quality\n${qualityFindings}`;
        if (llmProvider) {
            try {
                report = await llmProvider.chat([
                    { role: "system", content: "Summarize security and quality findings into a concise code review report. Use markdown format. Highlight critical issues first." },
                    { role: "user", content: `Security findings:\n${securityFindings}\n\nQuality findings:\n${qualityFindings}` },
                ], { temperature: 0.3, maxTokens: 2048 });
            }
            catch {
                // Use basic report
            }
        }
        streamHandler.emitComplete("report", 0, streamId);
        return {
            agentOutputs: [{
                    nodeId: "report",
                    content: report,
                    timestamp: new Date().toISOString(),
                    metadata: { action: "review_report" },
                }],
            pipelineStatus: "completed",
            lastUpdatedAt: new Date().toISOString(),
        };
    })
        .addEdge("__start__", "fetch_context")
        .addEdge("fetch_context", "security_scan")
        .addEdge("security_scan", "quality_review")
        .addEdge("quality_review", "report")
        .addEdge("report", langgraph_1.END);
    return graph.compile();
}
//# sourceMappingURL=code-review-graph.js.map
"use strict";
/**
 * Docs Subgraph — Documentation Generation Pipeline
 * Routes to the appropriate agent based on document type.
 *
 * Flow: __start__ → detect_doc_type → [BA|DEV|DevOps] → qa_verify → __end__
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDocsSubgraph = buildDocsSubgraph;
const langgraph_1 = require("@langchain/langgraph");
const state_1 = require("../state");
const ba_node_1 = require("../nodes/ba-node");
const dev_node_1 = require("../nodes/dev-node");
const devops_node_1 = require("../nodes/devops-node");
const qa_node_1 = require("../nodes/qa-node");
/**
 * Build the docs subgraph for document generation.
 */
async function buildDocsSubgraph(mcpBridge, streamHandler, llmProvider) {
    const baNode = new ba_node_1.BaNode("ba_docs", mcpBridge, streamHandler, llmProvider);
    const devNode = new dev_node_1.DevNode("dev_docs", mcpBridge, streamHandler, llmProvider);
    const devopsNode = new devops_node_1.DevOpsNode("devops_docs", mcpBridge, streamHandler, llmProvider);
    const qaNode = new qa_node_1.QaNode("qa_verify_docs", mcpBridge, streamHandler, llmProvider);
    const graph = new langgraph_1.StateGraph(state_1.PipelineAnnotation)
        // Detect what type of document is requested
        .addNode("detect_doc_type", async (state) => {
        const lastMessage = state.chatHistory?.[state.chatHistory.length - 1];
        const request = (lastMessage?.content || "").toLowerCase();
        let docType;
        if (/\b(ug|user\s*guide)\b/i.test(request)) {
            docType = "dev"; // User Guide → DEV
        }
        else if (/\b(dpg|deploy|deployment\s*guide|release\s*note|rln)\b/i.test(request)) {
            docType = "devops"; // Deployment Guide → DevOps
        }
        else if (/\b(brd|fsd|business|requirement|specification)\b/i.test(request)) {
            docType = "ba"; // Business docs → BA
        }
        else {
            docType = "dev"; // Default to DEV for general docs
        }
        return {
            parallelResults: { docType },
            lastUpdatedAt: new Date().toISOString(),
        };
    })
        // BA generates business documents
        .addNode("ba_generate", (state) => baNode.run(state))
        // DEV generates technical documents (UG, API docs)
        .addNode("dev_generate", (state) => devNode.run(state))
        // DevOps generates deployment documents
        .addNode("devops_generate", (state) => devopsNode.run(state))
        // QA verifies the document
        .addNode("qa_verify_docs", (state) => qaNode.run(state))
        .addEdge("__start__", "detect_doc_type")
        // Route to appropriate agent
        .addConditionalEdges("detect_doc_type", (state) => {
        const docType = state.parallelResults?.docType || "dev";
        switch (docType) {
            case "ba": return "ba_generate";
            case "devops": return "devops_generate";
            default: return "dev_generate";
        }
    }, {
        ba_generate: "ba_generate",
        dev_generate: "dev_generate",
        devops_generate: "devops_generate",
    })
        // All generators feed into QA verification
        .addEdge("ba_generate", "qa_verify_docs")
        .addEdge("dev_generate", "qa_verify_docs")
        .addEdge("devops_generate", "qa_verify_docs")
        .addEdge("qa_verify_docs", langgraph_1.END);
    return graph.compile();
}
//# sourceMappingURL=docs-graph.js.map
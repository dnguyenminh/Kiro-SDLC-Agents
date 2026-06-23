"use strict";
/**
 * Graph Builder — Multi-Graph Architecture
 * Builds the ROUTER graph that classifies intent and delegates to subgraphs.
 * Replaces the previous monolithic SDLC graph with a multi-graph architecture.
 *
 * Architecture:
 *   Router Graph → classify_intent → route to subgraph:
 *     sdlc → Full SDLC pipeline (graphs/sdlc-graph.ts)
 *     hotfix → Bug fix fast-track (graphs/hotfix-graph.ts)
 *     code_review → PR review pipeline (graphs/code-review-graph.ts)
 *     docs → Documentation generation (graphs/docs-graph.ts)
 *     security_audit → Security scanning (graphs/security-audit-graph.ts)
 *     chat → Free-form LLM chat (graphs/chat-graph.ts)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPipelineGraph = buildPipelineGraph;
const router_graph_1 = require("./router/router-graph");
/**
 * Build and compile the pipeline graph.
 * Now builds the ROUTER graph which handles intent classification and subgraph delegation.
 * Subgraphs are lazy-loaded on first use (zero activation impact for unused pipelines).
 */
async function buildPipelineGraph(mcpBridge, streamHandler, checkpointer, llmProvider, hookEngine) {
    return (0, router_graph_1.buildRouterGraph)(mcpBridge, streamHandler, checkpointer, llmProvider, hookEngine);
}
//# sourceMappingURL=graph-builder.js.map
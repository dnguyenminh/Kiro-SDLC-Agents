"use strict";
/**
 * SmNode — KSA-210
 * Scrum Master routing node. Analyzes ticket context via MCP mem_search
 * and determines which agent should execute next.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmNode = void 0;
const base_node_1 = require("./base-node");
class SmNode extends base_node_1.BaseNode {
    async execute(state) {
        // Fetch ticket context from KB
        const contextResult = await this.callMcp("mem_search", {
            query: `${state.ticketKey} context requirements`,
        });
        this.streamHandler.emitToken(this.nodeId, `[SM] Routing pipeline for ${state.ticketKey} — phase: ${state.currentPhase}`, state.currentStreamId);
        const output = {
            nodeId: this.nodeId,
            content: contextResult || `SM routed ${state.ticketKey} to phase: ${state.currentPhase}`,
            timestamp: new Date().toISOString(),
            metadata: { phase: state.currentPhase, ticketKey: state.ticketKey },
        };
        return {
            agentOutputs: [output],
            pipelineStatus: "running",
        };
    }
}
exports.SmNode = SmNode;
//# sourceMappingURL=sm-node.js.map
"use strict";
/**
 * VerifyNode — KSA-233
 * Dedicated graph node that validates agent output quality against
 * configurable criteria. Placed after each agent node in the graph.
 *
 * Implements: UC-2 (Output Verification), BR-8 through BR-12
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyNode = void 0;
const base_node_1 = require("./base-node");
const verify_criteria_1 = require("../config/verify-criteria");
class VerifyNode extends base_node_1.BaseNode {
    /** The agent nodeId whose output this verify node evaluates */
    targetNodeId;
    constructor(nodeId, targetNodeId, mcpBridge, streamHandler, llmProvider) {
        super(nodeId, mcpBridge, streamHandler, llmProvider);
        this.targetNodeId = targetNodeId;
    }
    /**
     * Evaluate the last agent output against verification criteria.
     *
     * Processing (FSD 6.2):
     * 1. Extract last agentOutput for targetNodeId
     * 2. Load criteria for currentPhase
     * 3. Evaluate via LLM or rule-based check
     * 4. Return verify result in state
     */
    async execute(state) {
        try {
            // Step 1: Extract agent output (EF-5: handle empty)
            const lastOutput = this.getLastAgentOutput(state);
            if (!lastOutput || !lastOutput.content) {
                return this.buildVerifyFailure(state, "No output produced by agent node");
            }
            // Step 2: Load criteria (EF-6: skip if not configured)
            const criteria = (0, verify_criteria_1.getVerifyCriteria)(state.currentPhase);
            if (!criteria) {
                return this.buildVerifyPass(state);
            }
            // Step 3: Evaluate output against criteria
            const evaluation = await this.evaluateOutput(lastOutput, criteria, state);
            // Step 4-5: Return result
            if (evaluation.passed) {
                return this.buildVerifyPass(state);
            }
            else {
                return this.buildVerifyFailure(state, evaluation.feedback);
            }
        }
        catch (error) {
            // EF-4: VerifyNode itself errors -> treat as pass (BR-12: fail-open)
            console.warn(`VerifyNode '${this.nodeId}' error, treating as pass:`, error);
            return this.buildVerifyPass(state);
        }
    }
    /** Evaluate agent output against criteria using LLM */
    async evaluateOutput(output, criteria, _state) {
        const systemPrompt = [
            "You are a quality verification agent.",
            "Evaluate the following output against the given criteria.",
            "Respond with JSON: { \"passed\": true/false, \"feedback\": \"specific feedback\" }",
            "If passed, feedback can be empty. If failed, feedback MUST be specific and actionable.",
        ].join(" ");
        const checksText = criteria.checks.map((c) => "- " + c).join("\n");
        const userPrompt = [
            "## Criteria",
            criteria.description,
            "",
            "## Checks",
            checksText,
            "",
            "## Agent Output (from node: " + this.targetNodeId + ")",
            output.content.substring(0, 10000),
        ].join("\n");
        const response = await this.callLlm(systemPrompt, userPrompt);
        return this.parseVerifyResponse(response);
    }
    /** Parse LLM response into pass/fail + feedback */
    parseVerifyResponse(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return { passed: Boolean(parsed.passed), feedback: parsed.feedback || "" };
            }
        }
        catch {
            /* fall through */
        }
        // If parsing fails, treat as pass (fail-open)
        return { passed: true, feedback: "" };
    }
    /** Build state for verification pass */
    buildVerifyPass(state) {
        this.streamHandler.emitVerify(this.nodeId, true, null, (state.verifyAttempts?.[this.targetNodeId] ?? 0) + 1, state.currentStreamId);
        return {
            verifyPassed: true,
            verifyFeedback: null,
            lastUpdatedAt: new Date().toISOString(),
        };
    }
    /** Build state for verification failure */
    buildVerifyFailure(state, feedback) {
        const currentAttempts = (state.verifyAttempts?.[this.targetNodeId] ?? 0) + 1;
        this.streamHandler.emitVerify(this.nodeId, false, feedback, currentAttempts, state.currentStreamId);
        return {
            verifyPassed: false,
            verifyFeedback: feedback,
            verifyAttempts: { ...state.verifyAttempts, [this.targetNodeId]: currentAttempts },
            lastUpdatedAt: new Date().toISOString(),
        };
    }
    /** Get the last agent output from state */
    getLastAgentOutput(state) {
        const outputs = state.agentOutputs || [];
        for (let i = outputs.length - 1; i >= 0; i--) {
            if (outputs[i].nodeId === this.targetNodeId) {
                return outputs[i];
            }
        }
        return null;
    }
}
exports.VerifyNode = VerifyNode;
//# sourceMappingURL=verify-node.js.map
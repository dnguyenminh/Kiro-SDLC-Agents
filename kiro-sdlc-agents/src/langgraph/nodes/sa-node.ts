/**
 * SaNode — KSA-210
 * Solution Architect agent node. Invokes SA sub-agent via MCP
 * to generate TDD (Technical Design Document).
 */

import { BaseNode } from "./base-node";
import { PipelineState, AgentOutput, DocumentState } from "../state";

export class SaNode extends BaseNode {
  async execute(state: PipelineState): Promise<Partial<PipelineState>> {
    this.streamHandler.emitToken(
      this.nodeId,
      `[SA] Generating TDD for ${state.ticketKey}...`,
      state.currentStreamId
    );

    const result = await this.callMcp("invoke_sub_agent", {
      name: "sa-agent",
      prompt: `Tao TDD cho ${state.ticketKey}. Doc code intelligence data va FSD.`,
    });

    const output: AgentOutput = {
      nodeId: this.nodeId,
      content: result,
      timestamp: new Date().toISOString(),
      metadata: { docType: "TDD", phase: "design" },
    };

    const documents = { ...state.documents };
    documents.tdd = {
      status: "done",
      version: (documents.tdd?.version || 0) + 1,
      path: `documents/${state.ticketKey}/TDD.md`,
      completedAt: new Date().toISOString(),
    } satisfies DocumentState;

    return {
      agentOutputs: [output],
      documents,
      currentPhase: "design",
    };
  }
}

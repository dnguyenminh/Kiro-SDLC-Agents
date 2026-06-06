/**
 * UiNode — KSA-210
 * UI Designer agent node. Creates wireframes and UI specifications
 * based on FSD UI sections (Phase 2.5).
 */

import { BaseNode } from "./base-node";
import { PipelineState, AgentOutput } from "../state";

const UI_SYSTEM_PROMPT = `You are a UI Designer agent for an SDLC pipeline.
Your role is to create wireframes and detailed UI specifications based on the FSD.

Responsibilities:
- Create wireframe layouts for each screen/page
- Define component hierarchy and interactions
- Specify responsive breakpoints
- Define color schemes, typography, spacing
- Create UI flow diagrams (navigation paths)
- Annotate accessibility requirements (ARIA labels, keyboard nav)

Output wireframes in draw.io format and UI specs in Markdown.`;

export class UiNode extends BaseNode {
  async execute(state: PipelineState): Promise<Partial<PipelineState>> {
    this.streamHandler.emitToken(
      this.nodeId,
      `[UI] Creating wireframes for ${state.ticketKey}...`,
      state.currentStreamId
    );

    const llmAvailable = await this.isLlmAvailable();
    let result: string;

    if (llmAvailable) {
      const userPrompt = `Create UI wireframes and specifications for ${state.ticketKey}.

FSD: ${state.documents.fsd?.path || "documents/" + state.ticketKey + "/FSD.md"}

Based on the FSD UI Specifications section, create:
1. Wireframe layouts for each screen (describe in detail)
2. Component hierarchy
3. Interaction patterns (hover, click, transitions)
4. Responsive behavior
5. Accessibility annotations
6. Navigation flow`;

      result = await this.callLlmStreamFull(UI_SYSTEM_PROMPT, userPrompt, state);
    } else {
      result = await this.callMcp("invoke_sub_agent", {
        name: "ui-agent",
        prompt: `Tao wireframes cho ${state.ticketKey}. Doc FSD de hieu UI specs.`,
      });
    }

    const output: AgentOutput = {
      nodeId: this.nodeId,
      content: result,
      timestamp: new Date().toISOString(),
      metadata: { phase: "specification", action: "create_wireframes", usedLlm: llmAvailable },
    };

    return {
      agentOutputs: [output],
    };
  }
}

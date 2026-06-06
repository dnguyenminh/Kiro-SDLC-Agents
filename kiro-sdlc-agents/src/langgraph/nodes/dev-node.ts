/**
 * DevNode — KSA-210
 * Developer agent node. Handles code implementation (Phase 5)
 * and User Guide creation (Phase 5.5).
 */

import { BaseNode } from "./base-node";
import { PipelineState, AgentOutput, DocumentState } from "../state";

const DEV_SYSTEM_PROMPT = `You are a Developer agent for an SDLC pipeline.
Your responsibilities vary by phase:

IMPLEMENTATION (Phase 5):
- Read TDD for architecture and design decisions
- Implement production code following TDD specifications
- Write unit tests, integration tests per STC
- Ensure code compiles and tests pass
- Follow existing project conventions

USER GUIDE (Phase 5.5):
- Create comprehensive UG.md with Installation, Configuration, Usage, Troubleshooting
- Read source code to extract accurate configuration and API details
- Include working examples and error code references

Always produce complete, production-ready code and documentation.`;

export class DevNode extends BaseNode {
  async execute(state: PipelineState): Promise<Partial<PipelineState>> {
    const phase = state.currentPhase;

    if (phase === "user_guide") {
      return this.executeUserGuide(state);
    }

    return this.executeImplementation(state);
  }

  private async executeImplementation(state: PipelineState): Promise<Partial<PipelineState>> {
    this.streamHandler.emitToken(
      this.nodeId,
      `[DEV] Implementing code for ${state.ticketKey}...`,
      state.currentStreamId
    );

    const llmAvailable = await this.isLlmAvailable();
    let result: string;

    if (llmAvailable) {
      const userPrompt = `Implement code for ticket ${state.ticketKey}.

TDD: ${state.documents.tdd?.path || "documents/" + state.ticketKey + "/TDD.md"}
FSD: ${state.documents.fsd?.path || "documents/" + state.ticketKey + "/FSD.md"}

Follow the TDD architecture design. Implement:
1. Database migrations (if applicable)
2. Entity/model classes
3. Repository/DAO layer
4. Service layer with business logic
5. API controller layer
6. Unit and integration tests (per STC)

Ensure code compiles and all tests pass.`;

      result = await this.callLlmStreamFull(DEV_SYSTEM_PROMPT, userPrompt, state);
    } else {
      result = await this.callMcp("invoke_sub_agent", {
        name: "dev-agent",
        prompt: `Implement code cho ${state.ticketKey} theo TDD. Doc code intelligence data.`,
      });
    }

    const output: AgentOutput = {
      nodeId: this.nodeId,
      content: result,
      timestamp: new Date().toISOString(),
      metadata: { phase: "implementation", action: "code_implementation", usedLlm: llmAvailable },
    };

    return {
      agentOutputs: [output],
    };
  }

  private async executeUserGuide(state: PipelineState): Promise<Partial<PipelineState>> {
    this.streamHandler.emitToken(
      this.nodeId,
      `[DEV] Writing User Guide for ${state.ticketKey}...`,
      state.currentStreamId
    );

    const llmAvailable = await this.isLlmAvailable();
    let result: string;

    if (llmAvailable) {
      const userPrompt = `Write User Guide for ticket ${state.ticketKey}.

Include:
1. Installation / Quick Start
2. Configuration Reference (every property with type, default, range)
3. Usage (each tool/API with examples)
4. Administration
5. Troubleshooting (common issues, error codes)
6. API Reference
7. FAQ

Read source code for accurate details. Template: documents/templates/UG-TEMPLATE.md
Output: documents/${state.ticketKey}/UG.md`;

      result = await this.callLlmStreamFull(DEV_SYSTEM_PROMPT, userPrompt, state);
    } else {
      result = await this.callMcp("invoke_sub_agent", {
        name: "dev-agent",
        prompt: `Viet User Guide cho ${state.ticketKey}. Template: documents/templates/UG-TEMPLATE.md. Output: documents/${state.ticketKey}/UG.md.`,
      });
    }

    const output: AgentOutput = {
      nodeId: this.nodeId,
      content: result,
      timestamp: new Date().toISOString(),
      metadata: { phase: "user_guide", action: "write_ug", usedLlm: llmAvailable },
    };

    const documents = { ...state.documents };
    documents.ug = {
      status: "done",
      version: (documents.ug?.version || 0) + 1,
      path: `documents/${state.ticketKey}/UG.md`,
      completedAt: new Date().toISOString(),
    } satisfies DocumentState;

    return {
      agentOutputs: [output],
      documents,
      parallelResults: { dev_ug: result },
    };
  }
}

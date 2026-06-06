/**
 * BaNode — KSA-210, KSA-217
 * Business Analyst agent node. Uses direct LLM call (preferred) with
 * fallback to MCP invoke_sub_agent for BRD/FSD document generation.
 * Injects workspace steering rules into prompts.
 */

import { BaseNode } from "./base-node";
import { PipelineState, AgentOutput, DocumentState } from "../state";
import { loadSteeringRules, injectSteering } from "../steering-loader";

const BA_SYSTEM_PROMPT = `You are a Business Analyst agent for an SDLC pipeline.
Your role is to create high-quality BRD (Business Requirements Document) and FSD (Functional Specification Document) documents.

When creating a BRD:
- Include business objectives, scope, user stories with acceptance criteria
- Define business flows, use cases, dependencies, and non-functional requirements
- Follow the provided template structure

When creating an FSD:
- Include detailed use cases with main/alternative/exception flows
- Define business rules, data specifications, UI wireframes
- Include system context, sequence diagrams, and state diagrams
- Reference the existing BRD for consistency

Always produce complete, production-ready documents in Markdown format.`;

export class BaNode extends BaseNode {
  async execute(state: PipelineState): Promise<Partial<PipelineState>> {
    const phase = state.currentPhase;
    const docType = phase === "requirements" ? "BRD" : "FSD";

    this.streamHandler.emitToken(
      this.nodeId,
      `[BA] Generating ${docType} for ${state.ticketKey}...`,
      state.currentStreamId
    );

    // Try direct LLM call first (streaming to Chat Panel)
    const llmAvailable = await this.isLlmAvailable();
    let result: string;

    if (llmAvailable) {
      const userPrompt = this.buildUserPrompt(state, docType);
      // Inject steering rules from workspace
      const workspaceRoot = require("vscode").workspace.workspaceFolders?.[0]?.uri.fsPath;
      let systemPrompt = BA_SYSTEM_PROMPT;
      if (workspaceRoot) {
        const rules = await loadSteeringRules(workspaceRoot, "langgraph");
        systemPrompt = injectSteering(BA_SYSTEM_PROMPT, rules);
      }
      result = await this.callLlmStreamFull(systemPrompt, userPrompt, state);
    } else {
      // Fallback: MCP invoke_sub_agent (no streaming)
      const prompt = phase === "requirements"
        ? `Tao BRD cho ${state.ticketKey}. PHAI tao draw.io diagrams.`
        : `Tao FSD cho ${state.ticketKey}. Doc BRD tu KB truoc.`;

      result = await this.callMcp("invoke_sub_agent", {
        name: "ba-agent",
        prompt,
      });
    }

    const output: AgentOutput = {
      nodeId: this.nodeId,
      content: result,
      timestamp: new Date().toISOString(),
      metadata: { docType, phase, usedLlm: llmAvailable },
    };

    const documents = { ...state.documents };
    const docKey = docType.toLowerCase();
    documents[docKey] = {
      status: "done",
      version: (documents[docKey]?.version || 0) + 1,
      path: `documents/${state.ticketKey}/${docType}.md`,
      completedAt: new Date().toISOString(),
    } satisfies DocumentState;

    return {
      agentOutputs: [output],
      documents,
    };
  }

  private buildUserPrompt(state: PipelineState, docType: string): string {
    const ticketKey = state.ticketKey;
    const chatContext = state.chatHistory
      .filter(m => m.role === "user")
      .map(m => m.content)
      .join("\n");

    if (docType === "BRD") {
      return `Create a BRD for ticket ${ticketKey}.

User requirements:
${chatContext}

Generate a complete BRD document in Markdown with:
1. Business Objectives
2. Scope & Boundaries
3. User Stories with Acceptance Criteria (minimum 3)
4. Business Flow description
5. Use Cases
6. Dependencies
7. Non-Functional Requirements`;
    }

    // FSD
    const brdContent = state.documents["brd"]?.path
      ? `BRD is available at: ${state.documents["brd"].path}`
      : "No BRD available — infer from user requirements.";

    return `Create an FSD for ticket ${ticketKey}.

${brdContent}

User requirements:
${chatContext}

Generate a complete FSD document in Markdown with:
1. Use Cases (Main/Alternative/Exception flows)
2. Business Rules table (BR- IDs)
3. Data Specifications
4. UI Specifications
5. API Specifications (if applicable)
6. Error Handling
7. System integration points`;
  }
}

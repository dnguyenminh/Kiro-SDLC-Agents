/**
 * DevOpsNode — KSA-210
 * DevOps agent node. Handles deployment guide creation (DPG/RLN),
 * deployment execution, and release process.
 */

import { BaseNode } from "./base-node";
import { PipelineState, AgentOutput, DocumentState } from "../state";

const DEVOPS_SYSTEM_PROMPT = `You are a DevOps Engineer agent for an SDLC pipeline.
Your responsibilities:

DEPLOYMENT PLANNING:
- Create DPG (Deployment Guide) with step-by-step deployment instructions
- Create RLN (Release Notes) summarizing changes
- Define rollback procedures
- Specify pre/post-deployment checks

DEPLOYMENT EXECUTION:
- Execute deployment according to DPG steps
- Run sanity tests after deployment
- Handle rollback if sanity fails

RELEASE PROCESS:
- Merge branch to master (--no-ff)
- Create version tag (semver)
- Update changelog in README

Always include rollback plans and health check verification.`;

export class DevOpsNode extends BaseNode {
  async execute(state: PipelineState): Promise<Partial<PipelineState>> {
    this.streamHandler.emitToken(
      this.nodeId,
      `[DevOps] Preparing deployment for ${state.ticketKey}...`,
      state.currentStreamId
    );

    const llmAvailable = await this.isLlmAvailable();
    let result: string;

    if (llmAvailable) {
      const userPrompt = `Create Deployment Guide and Release Notes for ${state.ticketKey}.

TDD: ${state.documents.tdd?.path || "documents/" + state.ticketKey + "/TDD.md"}
FSD: ${state.documents.fsd?.path || "documents/" + state.ticketKey + "/FSD.md"}

Generate:
1. DPG.md — Deployment Guide:
   - Pre-deployment checklist
   - Step-by-step deployment instructions
   - Post-deployment verification
   - Rollback plan with steps
   - Deployment architecture diagram description

2. RLN.md — Release Notes:
   - Version number
   - Changes summary (features, fixes, improvements)
   - Breaking changes (if any)
   - Migration instructions (if any)
   - Known issues`;

      result = await this.callLlmStreamFull(DEVOPS_SYSTEM_PROMPT, userPrompt, state);
    } else {
      result = await this.callMcp("invoke_sub_agent", {
        name: "devops-agent",
        prompt: `Tao Deployment Guide va Release Notes cho ${state.ticketKey}. PHAI tao draw.io diagrams (deployment-flow.drawio + rollback-flow.drawio).`,
      });
    }

    const output: AgentOutput = {
      nodeId: this.nodeId,
      content: result,
      timestamp: new Date().toISOString(),
      metadata: { phase: "deployment", action: "create_dpg_rln", usedLlm: llmAvailable },
    };

    const documents = { ...state.documents };
    documents.dpg = {
      status: "done",
      version: (documents.dpg?.version || 0) + 1,
      path: `documents/${state.ticketKey}/DPG.md`,
      completedAt: new Date().toISOString(),
    } satisfies DocumentState;
    documents.rln = {
      status: "done",
      version: (documents.rln?.version || 0) + 1,
      path: `documents/${state.ticketKey}/RLN.md`,
      completedAt: new Date().toISOString(),
    } satisfies DocumentState;

    return {
      agentOutputs: [output],
      documents,
    };
  }
}

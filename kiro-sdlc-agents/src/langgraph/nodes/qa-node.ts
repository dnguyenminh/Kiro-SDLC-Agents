/**
 * QaNode — KSA-210
 * QA Engineer agent node. Handles test planning (STP/STC creation)
 * and test execution phases.
 */

import { BaseNode } from "./base-node";
import { PipelineState, AgentOutput, DocumentState } from "../state";

const QA_SYSTEM_PROMPT = `You are a QA Engineer agent for an SDLC pipeline.
Your responsibilities vary by phase:

TEST PLANNING (Phase 4):
- Create STP (Software Test Plan) with 6 test levels: PBT, UT, IT, E2E-API, E2E-UI, SIT
- Create STC (Software Test Cases) with detailed test cases per level
- Build RTM (Requirements Traceability Matrix) ensuring 100% BRD coverage
- Generate test data CSV files for automation

TESTING (Phase 6):
- Execute automated tests (run ./gradlew test)
- Review test code quality (verify IT tests use real integrations)
- Report test results with pass/fail counts
- Verify UG accuracy (Phase 5.5)

Always produce complete, production-ready documents in Markdown format.`;

export class QaNode extends BaseNode {
  async execute(state: PipelineState): Promise<Partial<PipelineState>> {
    const phase = state.currentPhase;

    if (phase === "test_planning") {
      return this.executeTestPlanning(state);
    } else if (phase === "testing") {
      return this.executeTestExecution(state);
    } else if (phase === "user_guide") {
      return this.executeUgVerification(state);
    }

    // Default: test planning
    return this.executeTestPlanning(state);
  }

  private async executeTestPlanning(state: PipelineState): Promise<Partial<PipelineState>> {
    this.streamHandler.emitToken(
      this.nodeId,
      `[QA] Creating STP/STC for ${state.ticketKey}...`,
      state.currentStreamId
    );

    const llmAvailable = await this.isLlmAvailable();
    let result: string;

    if (llmAvailable) {
      const userPrompt = `Create STP and STC for ticket ${state.ticketKey}.

Requirements:
- 6 test levels: PBT (Property-Based), UT (Unit), IT (Integration), E2E-API, E2E-UI, SIT (Manual)
- RTM with 100% coverage of BRD user stories
- Test data CSV files for each test case
- Traceability: each test case maps to a requirement

BRD: ${state.documents.brd?.path || "documents/" + state.ticketKey + "/BRD.md"}
FSD: ${state.documents.fsd?.path || "documents/" + state.ticketKey + "/FSD.md"}
TDD: ${state.documents.tdd?.path || "documents/" + state.ticketKey + "/TDD.md"}`;

      result = await this.callLlmStreamFull(QA_SYSTEM_PROMPT, userPrompt, state);
    } else {
      result = await this.callMcp("invoke_sub_agent", {
        name: "qa-agent",
        prompt: `Tao STP va STC cho ${state.ticketKey}. PHAI tao draw.io diagrams.`,
      });
    }

    const output: AgentOutput = {
      nodeId: this.nodeId,
      content: result,
      timestamp: new Date().toISOString(),
      metadata: { phase: "test_planning", docType: "STP/STC", usedLlm: llmAvailable },
    };

    const documents = { ...state.documents };
    documents.stp = {
      status: "done",
      version: (documents.stp?.version || 0) + 1,
      path: `documents/${state.ticketKey}/STP.md`,
      completedAt: new Date().toISOString(),
    } satisfies DocumentState;
    documents.stc = {
      status: "done",
      version: (documents.stc?.version || 0) + 1,
      path: `documents/${state.ticketKey}/STC.md`,
      completedAt: new Date().toISOString(),
    } satisfies DocumentState;

    return {
      agentOutputs: [output],
      documents,
    };
  }

  private async executeTestExecution(state: PipelineState): Promise<Partial<PipelineState>> {
    this.streamHandler.emitToken(
      this.nodeId,
      `[QA] Executing tests for ${state.ticketKey}...`,
      state.currentStreamId
    );

    const llmAvailable = await this.isLlmAvailable();
    let result: string;

    if (llmAvailable) {
      const userPrompt = `Execute automated tests for ${state.ticketKey}.
Run ./gradlew test and report results. Review IT test quality.
Verify tests use real integrations (not all-mock).
Report pass/fail counts per test level.`;

      result = await this.callLlmStreamFull(QA_SYSTEM_PROMPT, userPrompt, state);
    } else {
      result = await this.callMcp("invoke_sub_agent", {
        name: "qa-agent",
        prompt: `Chay automated tests cho ${state.ticketKey}. Run ./gradlew test. Bao cao pass/fail.`,
      });
    }

    const output: AgentOutput = {
      nodeId: this.nodeId,
      content: result,
      timestamp: new Date().toISOString(),
      metadata: { phase: "testing", action: "test_execution", usedLlm: llmAvailable },
    };

    return {
      agentOutputs: [output],
    };
  }

  private async executeUgVerification(state: PipelineState): Promise<Partial<PipelineState>> {
    this.streamHandler.emitToken(
      this.nodeId,
      `[QA] Verifying User Guide for ${state.ticketKey}...`,
      state.currentStreamId
    );

    const result = await this.callMcp("invoke_sub_agent", {
      name: "qa-agent",
      prompt: `Verify User Guide cho ${state.ticketKey}. Follow instructions, report PASS/FAIL per step.`,
    });

    const output: AgentOutput = {
      nodeId: this.nodeId,
      content: result,
      timestamp: new Date().toISOString(),
      metadata: { phase: "user_guide", action: "ug_verification" },
    };

    return {
      agentOutputs: [output],
      parallelResults: { qa_ug: result },
    };
  }
}

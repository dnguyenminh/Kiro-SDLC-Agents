/**
 * DevNode — KSA-210, KSA-242
 * Developer agent node. Handles code implementation (Phase 5)
 * and User Guide creation (Phase 5.5).
 * KSA-242: Added steering injection, KB ingest.
 */

import { BaseNode } from "./base-node";
import { PipelineState, AgentOutput, DocumentState } from "../state";
import { loadSteeringRules, injectSteering } from "../steering-loader";
import { debugError } from "../../debug-logger";

/** Template path for User Guide */
const UG_TEMPLATE = "documents/templates/UG-TEMPLATE.md";

const DEV_SYSTEM_PROMPT_FALLBACK = `You are a Developer agent for an SDLC pipeline.
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
- Follow the provided UG template structure EXACTLY

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
      // Step 1: Read TDD + Code Intelligence
      this.streamHandler.emitToken(this.nodeId, `  → Step 1: Reading TDD + Code Intel...`, state.currentStreamId);
      const tddContent = await this.readWorkspaceFile(
        state.documents.tdd?.path || `documents/${state.ticketKey}/TDD.md`
      ) || "";
      const codeIntel = await this.readCodeIntelligence() || "";

      // Step 2: Search KB for context
      let kbContext = "";
      try { kbContext = await this.kbSearch(`${state.ticketKey} TDD implementation design`); } catch (err) { debugError(`[DevNode] KB search failed for ${state.ticketKey}`, err as Error); }

      // Step 3: Generate code via LLM
      this.streamHandler.emitToken(this.nodeId, `  → Step 2: Generating implementation...`, state.currentStreamId);
      const userPrompt = `Implement code for ticket ${state.ticketKey}.

## TDD (Architecture & Design)\n\n${tddContent.slice(0, 15000)}

## CODE INTELLIGENCE (existing codebase)\n\n${codeIntel.slice(0, 8000)}

${kbContext ? `## KB CONTEXT\n\n${kbContext}` : ""}

Follow the TDD architecture design. Implement:
1. Database migrations (if applicable)
2. Entity/model classes
3. Repository/DAO layer
4. Service layer with business logic
5. API controller layer
6. Unit and integration tests (per STC)

Use actual package names, class names, and patterns from Code Intelligence above.
Ensure code compiles and all tests pass.`;

      const workspaceRoot = this.getWorkspaceRoot();
      let systemPrompt = await this.loadAgentPrompt("dev-agent", DEV_SYSTEM_PROMPT_FALLBACK);
      if (workspaceRoot) {
        const rules = await loadSteeringRules(workspaceRoot, "langgraph");
        systemPrompt = injectSteering(systemPrompt, rules);
      }
      result = await this.callLlmStreamFull(systemPrompt, userPrompt, state);
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

    // Step: Update code intelligence index (matches Kiro dev-agent Step 8.5)
    if (llmAvailable) {
      this.streamHandler.emitToken(this.nodeId, `  → Updating code intelligence index...`, state.currentStreamId);
      try {
        await this.execShell(
          "npx tsx src/full-indexer.ts ../../../",
          ".analysis/code-intelligence/scripts"
        );
      } catch {
        // Indexer failure non-blocking — may not be available
        try {
          // Fallback: ingest implementation summary into KB
          await this.kbIngest(
            `## ${state.ticketKey} Implementation Summary\n\n${result.slice(0, 3000)}`,
            "CONTEXT",
            "langgraph-dev-implementation",
            [state.ticketKey, "implementation", "code", "langgraph"]
          );
        } catch (err) { debugError(`[DevNode] KB ingest fallback failed for ${state.ticketKey}`, err as Error); }
      }
    }

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
      // Step 1: Read UG template + source context
      this.streamHandler.emitToken(this.nodeId, `  → Step 1: Reading template + context...`, state.currentStreamId);
      const ugTemplate = await this.readWorkspaceFile(UG_TEMPLATE) || "[UG template not found]";
      const codeIntel = await this.readCodeIntelligence() || "";
      let kbContext = "";
      try { kbContext = await this.kbSearch(`${state.ticketKey} BRD FSD TDD features`); } catch (err) { debugError(`[DevNode] KB search failed for ${state.ticketKey}`, err as Error); }

      // Step 2: Generate via LLM
      this.streamHandler.emitToken(this.nodeId, `  → Step 2: Generating User Guide...`, state.currentStreamId);
      const userPrompt = `Write User Guide for ticket ${state.ticketKey}.

## UG TEMPLATE\n\n${ugTemplate}

## CODE INTELLIGENCE\n\n${codeIntel.slice(0, 8000)}

${kbContext ? `## KB CONTEXT (BRD/FSD/TDD)\n\n${kbContext}` : ""}

Include:
1. Installation / Quick Start
2. Configuration Reference (every property with type, default, range)
3. Usage (each tool/API with examples)
4. Administration
5. Troubleshooting (common issues, error codes)
6. API Reference
7. FAQ

Read source code for accurate details.
Output: documents/${state.ticketKey}/UG.md`;

      const workspaceRoot = this.getWorkspaceRoot();
      let systemPrompt = await this.loadAgentPrompt("dev-agent", DEV_SYSTEM_PROMPT_FALLBACK);
      if (workspaceRoot) {
        const rules = await loadSteeringRules(workspaceRoot, "langgraph");
        systemPrompt = injectSteering(systemPrompt, rules);
      }
      result = await this.callLlmStreamFull(systemPrompt, userPrompt, state);

      // Step 3: Write file
      this.streamHandler.emitToken(this.nodeId, `  → Step 3: Writing UG.md...`, state.currentStreamId);
      await this.writeWorkspaceFile(`documents/${state.ticketKey}/UG.md`, result);

      // Step 4: Export DOCX
      this.streamHandler.emitToken(this.nodeId, `  → Step 4: Exporting DOCX...`, state.currentStreamId);
      const version = (state.documents.ug?.version || 0) + 1;
      await this.exportDocx(`documents/${state.ticketKey}/UG.md`, `UG-v${version}-${state.ticketKey}`);

      // Step 5: KB ingest
      await this.kbIngestFile(`documents/${state.ticketKey}/UG.md`, "DOCUMENT");

      this.streamHandler.emitToken(this.nodeId, `  ✅ User Guide pipeline complete`, state.currentStreamId);
    } else {
      result = await this.callMcp("invoke_sub_agent", {
        name: "dev-agent",
        prompt: `Viet User Guide cho ${state.ticketKey}. Template: ${UG_TEMPLATE}. Output: documents/${state.ticketKey}/UG.md.`,
      });
    }

    const output: AgentOutput = {
      nodeId: this.nodeId,
      content: result,
      timestamp: new Date().toISOString(),
      metadata: { phase: "user_guide", action: "write_ug", usedLlm: llmAvailable, kbIngested: true },
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

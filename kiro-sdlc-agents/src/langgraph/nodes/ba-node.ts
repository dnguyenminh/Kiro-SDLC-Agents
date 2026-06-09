/**
 * BaNode — KSA-210, KSA-217, KSA-242
 * Business Analyst agent node. Full multi-step workflow matching Kiro ba-agent:
 * Jira fetch → KB store → Code Intelligence → Template read → LLM generate →
 * Write file → Diagrams → PNG export → DOCX export → KB ingest.
 *
 * Falls back to invoke_sub_agent("ba-agent") when LLM unavailable.
 */

import { BaseNode } from "./base-node";
import { PipelineState, AgentOutput, DocumentState } from "../state";
import { loadSteeringRules, injectSteering } from "../steering-loader";

/** Template paths for BA documents */
const BA_TEMPLATES = {
  BRD: "documents/templates/BRD-TEMPLATE.md",
  FSD: "documents/templates/FSD-TEMPLATE.md",
} as const;

/** Fallback system prompt (used if .kiro/agents/ba-agent.md not found) */
const BA_SYSTEM_PROMPT_FALLBACK = `You are a Business Analyst agent for an SDLC pipeline.
Your role is to create high-quality BRD (Business Requirements Document) and FSD (Functional Specification Document) documents.

When creating a BRD:
- Include business objectives, scope, user stories with acceptance criteria
- Define business flows, use cases, dependencies, and non-functional requirements
- Follow the provided template structure EXACTLY
- MUST create draw.io diagrams: business-flow.drawio + use-case.drawio
- Export diagrams to PNG format

When creating an FSD:
- Include detailed use cases with main/alternative/exception flows
- Define business rules, data specifications, UI wireframes
- Include system context, sequence diagrams, and state diagrams
- Reference the existing BRD for consistency
- MUST create draw.io diagrams: system-context.drawio + sequence diagrams + state diagram
- Export diagrams to PNG format

DIAGRAM RULES:
- All diagrams stored at documents/{TICKET}/diagrams/
- Each diagram has both .drawio (source) and .png (rendered)
- XML must start with <mxGraphModel>, NOT <mxfile>
- No self-closing edge cells (edge="1" must have <mxGeometry>)
- Use expanded form: <mxCell ...><mxGeometry relative="1" as="geometry"/></mxCell>

Always produce complete, production-ready documents in Markdown format.
Always include a Diagram Index table in the appendix.
Write documents in English. Communicate status in Vietnamese.`;

export class BaNode extends BaseNode {
  async execute(state: PipelineState): Promise<Partial<PipelineState>> {
    const phase = state.currentPhase;
    const docType = phase === "requirements" ? "BRD" : "FSD";
    const ticketKey = state.ticketKey;

    this.streamHandler.emitToken(
      this.nodeId,
      `[BA] Starting ${docType} pipeline for ${ticketKey}...`,
      state.currentStreamId
    );

    const llmAvailable = await this.isLlmAvailable();
    let result: string;

    if (llmAvailable) {
      result = await this.runAgentWorkflow("ba-agent", state, {
        docType,
        outputPath: `documents/${ticketKey}/${docType}.md`,
      });
    } else {
      // Fallback: delegate to Kiro ba-agent (has full capabilities)
      const prompt = phase === "requirements"
        ? `Tao BRD cho ${ticketKey}. PHAI tao draw.io diagrams (use-case.drawio + business-flow.drawio) va export PNG.`
        : `Tao FSD cho ${ticketKey}. Doc BRD tu KB truoc. PHAI tao draw.io diagrams va export PNG.`;

      result = await this.callMcp("invoke_sub_agent", {
        name: "ba-agent",
        prompt,
      });
    }

    const output: AgentOutput = {
      nodeId: this.nodeId,
      content: result,
      timestamp: new Date().toISOString(),
      metadata: { docType, phase, usedLlm: llmAvailable, kbIngested: true },
    };

    const documents = { ...state.documents };
    const docKey = docType.toLowerCase();
    documents[docKey] = {
      status: "done",
      version: (documents[docKey]?.version || 0) + 1,
      path: `documents/${ticketKey}/${docType}.md`,
      completedAt: new Date().toISOString(),
    } satisfies DocumentState;

    return {
      agentOutputs: [output],
      documents,
    };
  }

  /**
   * Full multi-step pipeline (when LLM is available):
   * Step 0: Tool discovery + confirmation
   * Step 1: Fetch Jira ticket data (recursive)
   * Step 2: Search KB for existing context
   * Step 3: Read Code Intelligence (for FSD)
   * Step 4: Read template + example reference
   * Step 5: Generate document via LLM
   * Step 6: Write file to workspace
   * Step 7: Export DOCX
   * Step 8: Ingest into KB
   */
  private async executeFullPipeline(state: PipelineState, docType: string): Promise<string> {
    const ticketKey = state.ticketKey;

    // --- Step 0: Tool discovery + confirmation message ---
    this.streamHandler.emitToken(this.nodeId, `  📋 **Ticket:** ${ticketKey}\n  📄 **Document:** ${docType}\n  📄 **Template:** ${docType === "BRD" ? BA_TEMPLATES.BRD : BA_TEMPLATES.FSD}\n  🚀 Bắt đầu tạo ${docType}...`, state.currentStreamId);

    // Discover tools (match Kiro agent Step 0.5)
    await this.discoverTools("get issue details from project tracker");
    await this.discoverTools("search knowledge base semantic");

    // --- Step 1: Fetch Jira ticket data (recursive linked traversal) ---
    this.streamHandler.emitToken(this.nodeId, `  → Step 1: Fetching Jira ${ticketKey} + linked tickets...`, state.currentStreamId);
    let jiraContext = "";
    try {
      jiraContext = await this.getJiraIssueRecursive(ticketKey, 2, 10);
    } catch {
      // Jira unavailable — continue with chat context only
      jiraContext = "[Jira unavailable — using chat context]";
    }

    // --- Step 2: Search KB for existing context ---
    this.streamHandler.emitToken(this.nodeId, `  → Step 2: Searching KB...`, state.currentStreamId);
    let kbContext = "";
    try {
      kbContext = await this.kbSearch(`${ticketKey} ${docType === "FSD" ? "BRD requirements" : "context"}`);
    } catch {
      kbContext = "";
    }

    // --- Step 3: Read Code Intelligence (for FSD) ---
    let codeIntelContext = "";
    if (docType === "FSD") {
      this.streamHandler.emitToken(this.nodeId, `  → Step 3: Reading Code Intelligence...`, state.currentStreamId);
      codeIntelContext = await this.readCodeIntelligence() || "";
    }

    // --- Step 4: Read template + example reference ---
    this.streamHandler.emitToken(this.nodeId, `  → Step 4: Reading template + example...`, state.currentStreamId);
    const templatePath = docType === "BRD" ? BA_TEMPLATES.BRD : BA_TEMPLATES.FSD;
    const templateContent = await this.readWorkspaceFile(templatePath) || "[Template not found — use standard structure]";

    // Read example BRD as quality reference (matches Kiro agent behavior)
    let exampleRef = "";
    if (docType === "BRD") {
      const example = await this.readWorkspaceFile("documents/CRP-84/BRD.md");
      if (example) {
        exampleRef = example.slice(0, 5000); // First 5k chars as quality reference
      }
    }

    // --- Step 5: Generate document via LLM ---
    this.streamHandler.emitToken(this.nodeId, `  → Step 5: Generating ${docType}...`, state.currentStreamId);
    const userPrompt = this.buildFullPrompt(state, docType, jiraContext, kbContext, codeIntelContext, templateContent, exampleRef);

    // Inject steering rules + dynamic agent prompt
    const workspaceRoot = this.getWorkspaceRoot();
    let systemPrompt = await this.loadAgentPrompt("ba-agent", BA_SYSTEM_PROMPT_FALLBACK);
    if (workspaceRoot) {
      const rules = await loadSteeringRules(workspaceRoot, "langgraph");
      systemPrompt = injectSteering(systemPrompt, rules);
    }

    const documentContent = await this.callLlmStreamFull(systemPrompt, userPrompt, state);

    // --- Step 6: Write file to workspace ---
    this.streamHandler.emitToken(this.nodeId, `  → Step 6: Writing ${docType}.md...`, state.currentStreamId);
    const outputPath = `documents/${ticketKey}/${docType}.md`;
    await this.writeWorkspaceFile(outputPath, documentContent);

    // --- Step 7: Export DOCX ---
    this.streamHandler.emitToken(this.nodeId, `  → Step 7: Exporting DOCX...`, state.currentStreamId);
    const version = (state.documents[docType.toLowerCase()]?.version || 0) + 1;
    const docxName = `${docType}-v${version}-${ticketKey}`;
    const docxResult = await this.exportDocx(outputPath, docxName);
    if (docxResult) {
      this.streamHandler.emitToken(this.nodeId, `    ✓ DOCX: ${docxName}.docx`, state.currentStreamId);
    }

    // --- Step 8: Ingest into KB ---
    this.streamHandler.emitToken(this.nodeId, `  → Step 8: Ingesting into KB...`, state.currentStreamId);
    await this.kbIngestFile(outputPath, "REQUIREMENT");

    this.streamHandler.emitToken(
      this.nodeId,
      `  ✅ ${docType} pipeline complete for ${ticketKey}`,
      state.currentStreamId
    );

    return documentContent;
  }

  /**
   * Build comprehensive LLM prompt with all gathered context.
   */
  private buildFullPrompt(
    state: PipelineState,
    docType: string,
    jiraContext: string,
    kbContext: string,
    codeIntelContext: string,
    templateContent: string,
    exampleRef: string
  ): string {
    const ticketKey = state.ticketKey;
    const chatContext = state.chatHistory
      .filter(m => m.role === "user")
      .map(m => m.content)
      .join("\n");

    const sections: string[] = [];

    sections.push(`Create a ${docType} for ticket ${ticketKey}.`);
    sections.push(`\n## TEMPLATE (follow this structure EXACTLY)\n\n${templateContent}`);

    if (jiraContext && !jiraContext.includes("unavailable")) {
      sections.push(`\n## JIRA TICKET DATA\n\n${jiraContext}`);
    }

    if (kbContext) {
      sections.push(`\n## KNOWLEDGE BASE CONTEXT\n\n${kbContext}`);
    }

    if (chatContext) {
      sections.push(`\n## USER REQUIREMENTS\n\n${chatContext}`);
    }

    if (exampleRef) {
      sections.push(`\n## QUALITY REFERENCE (example BRD — match this level of detail)\n\n${exampleRef}`);
    }

    if (docType === "FSD") {
      const brdPath = state.documents["brd"]?.path;
      if (brdPath) {
        sections.push(`\n## REFERENCE BRD\n\nBRD available at: ${brdPath}`);
      }
      if (codeIntelContext) {
        sections.push(`\n## CODE INTELLIGENCE (actual codebase)\n\n${codeIntelContext}\n\nUse actual table names, API patterns, and service names from above. Do NOT invent names.`);
      }
    }

    // Diagram requirements
    if (docType === "BRD") {
      sections.push(`\n## DIAGRAMS (MANDATORY — include XML in output)

Generate draw.io XML for:
1. documents/${ticketKey}/diagrams/business-flow.drawio — swimlane business process
2. documents/${ticketKey}/diagrams/use-case.drawio — UML use case diagram

Rules:
- Use <mxGraphModel> root (NO <mxfile> wrapper)
- Every edge MUST use expanded form with <mxGeometry relative="1" as="geometry"/>
- Include Diagram Index table in appendix`);
    } else {
      sections.push(`\n## DIAGRAMS (MANDATORY — include XML in output)

Generate draw.io XML for:
1. documents/${ticketKey}/diagrams/system-context.drawio — system boundary + external systems
2. documents/${ticketKey}/diagrams/sequence-main.drawio — main flow sequence
3. documents/${ticketKey}/diagrams/state-entity.drawio — entity lifecycle states

Rules:
- Use <mxGraphModel> root (NO <mxfile> wrapper)
- Every edge MUST use expanded form with <mxGeometry relative="1" as="geometry"/>
- Include Diagram Index table in appendix`);
    }

    return sections.join("\n");
  }
}

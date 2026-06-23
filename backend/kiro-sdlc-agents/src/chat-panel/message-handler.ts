/**
 * Message Handler — KSA-210
 * Dispatches incoming webview messages to the appropriate engine actions.
 */

import * as vscode from "vscode";
import { debugLog } from "../debug-logger";
import { LangGraphEngine } from "../langgraph/langgraph-engine";
import { ChatWebviewToExtMessage, ChatExtToWebviewMessage, AutopilotMode } from "./message-protocol";
import { SDLCPhase } from "../langgraph/state";

/** Pattern matching for ticket-based commands */
const TICKET_PATTERN = /^([A-Z]+-\d+)\s+(.+)$/;

/** Direct command patterns */
const DIRECT_COMMANDS: Record<string, string> = {
  status: "status",
  resume: "resume",
  cancel: "cancel",
};

/** Phase keywords for ticket commands */
const PHASE_KEYWORDS: Record<string, SDLCPhase> = {
  brd: "requirements",
  "tao brd": "requirements",
  fsd: "specification",
  "tao fsd": "specification",
  tdd: "design",
  "tao tdd": "design",
  stp: "test_planning",
  "tao stp": "test_planning",
  implement: "implementation",
  test: "testing",
  deploy: "deployment",
  full: "all",
};

export class MessageHandler {
  private currentModel: string = "auto";
  private currentMode: AutopilotMode = "autopilot";

  constructor(
    private readonly getEngine: () => LangGraphEngine,
    private readonly sendToWebview: (msg: ChatExtToWebviewMessage) => void,
    private readonly onPickContext?: (contextType: string) => void,
    private readonly onPickAttachment?: () => void,
    private readonly onApplyCode?: (code: string, filePath?: string) => void,
    private readonly onInsertCode?: (code: string) => void,
    private readonly onSetModel?: (model: string) => void
  ) {}

  async handle(msg: ChatWebviewToExtMessage): Promise<void> {
    debugLog(` MessageHandler.handle: type="${msg.type}"`);
    switch (msg.type) {
      case "ready":
        debugLog(` MessageHandler: webview READY`);
        await this.handleReady();
        break;
      case "refresh":
        await this.handleReady();
        break;
      case "chat:userMessage":
        debugLog(` MessageHandler: userMessage="${(msg as any).text?.slice(0, 80)}"`);
        await this.handleUserMessage((msg as any).text, (msg as any).context);
        break;
      case "chat:approvalAction":
        await this.handleApproval(msg.decision, msg.feedback);
        break;
      case "chat:cancelStream":
        this.getEngine().cancel();
        this.sendToWebview({ type: "chat:workingStatus", working: false });
        // KSA-283: Emit streamComplete to close any pending tool blocks in UI
        this.sendToWebview({ type: "chat:streamComplete", streamId: "cancelled", nodeId: "user", finalContent: "Cancelled by user", metadata: {} } as any);
        break;
      case "chat:clearHistory":
        break;
      case "chat:resumePipeline":
        this.sendToWebview({ type: "chat:workingStatus", working: true, label: "Resuming..." });
        await this.getEngine().resume(msg.threadId);
        break;
      case "chat:startFresh":
        break;
      case "chat:graphNodeClick":
        this.handleNodeClick(msg.nodeId);
        break;
      case "chat:openWorkflowGraph":
        vscode.commands.executeCommand("kiroSdlc.openWorkflowGraph");
        break;
      case "chat:pickContext":
        if (this.onPickContext) {
          this.onPickContext(msg.contextType);
        }
        break;
      case "chat:pickAttachment":
        if (this.onPickAttachment) {
          this.onPickAttachment();
        }
        break;
      case "chat:setModel":
        this.currentModel = msg.model;
        if (this.onSetModel) {
          this.onSetModel(msg.model);
        }
        break;
      case "chat:setMode":
        this.currentMode = msg.mode;
        break;
      case "chat:applyCode":
        if (this.onApplyCode) {
          this.onApplyCode(msg.code, msg.filePath);
        }
        break;
      case "chat:insertCode":
        if (this.onInsertCode) {
          this.onInsertCode(msg.code);
        }
        break;
      case "tab:create":
        debugLog(` MessageHandler: tab:create`);
        break;
      case "tab:switch":
        debugLog(` MessageHandler: tab:switch to ${(msg as any).payload?.tabId}`);
        // Tab switch — swap LLM context to target tab
        this.getEngine().switchActiveTab((msg as any).payload.tabId);
        break;
      case "tab:close":
        debugLog(` MessageHandler: tab:close ${(msg as any).payload?.tabId}`);
        break;
      case "tab:rename":
        break;
    }
  }

  private async handleReady(): Promise<void> {
    // Check for resumable pipelines
    const pipelines = this.getEngine().listPersistedPipelines();
    const paused = pipelines.find(p => p.status === "paused" || p.status === "running");

    if (paused) {
      this.sendToWebview({
        type: "chat:resumePrompt",
        threadId: paused.threadId,
        ticketKey: paused.ticketKey,
        phase: paused.phase,
        pausedAt: paused.lastUpdatedAt,
      });
    }

    // Send current graph state
    const nodes = this.getEngine().getCurrentNodeStates();
    this.sendToWebview({ type: "chat:graphUpdate", nodes });
  }

  private async handleUserMessage(text: string, context?: Array<{ type: string; label: string; path?: string; content?: string }>): Promise<void> {
    // Build enriched input with context content
    let enrichedText = text;
    if (context && context.length > 0) {
      const contextSections: string[] = [];
      for (const item of context) {
        if (item.content) {
          contextSections.push(`<${item.type} name="${item.label}">\n${item.content}\n</${item.type}>`);
        } else if (item.path) {
          contextSections.push(`<${item.type} name="${item.label}" path="${item.path}" />`);
        }
      }
      if (contextSections.length > 0) {
        enrichedText = `<context>\n${contextSections.join("\n")}\n</context>\n\n${text}`;
      }
    }

    const trimmed = enrichedText.trim().toLowerCase();
    debugLog(` handleUserMessage: "${text.slice(0, 80)}" (trimmed: "${trimmed.slice(0, 40)}", context: ${context?.length || 0} items)`);

    // Emit working status
    this.sendToWebview({ type: "chat:workingStatus", working: true, label: "Working..." });

    // KSA-280: Fire promptSubmit hooks (non-blocking, errors don't affect main flow)
    try {
      const engine = this.getEngine();
      const hookEngine = engine.hookEngine;
      const streamHandler = engine.getStreamHandler();
      await hookEngine.firePromptSubmit(text, streamHandler);
    } catch { /* hooks must never break main execution */ }

    // Check direct commands (use original text for command matching)
    const textTrimmed = text.trim().toLowerCase();
    if (DIRECT_COMMANDS[textTrimmed]) {
      debugLog(` handleUserMessage: routed to DIRECT COMMAND "${textTrimmed}"`);
      await this.handleDirectCommand(DIRECT_COMMANDS[textTrimmed]);
      this.sendToWebview({ type: "chat:workingStatus", working: false });
      return;
    }

    // KSA-278: Check for agent command prefix (e.g., "/qa-agent some task")
    const agentMatch = text.trim().match(/^\/([a-z][-a-z]*)\s+(.+)$/i);
    if (agentMatch) {
      const agentName = agentMatch[1];
      const agentTask = agentMatch[2];
      debugLog(` handleUserMessage: routed to AGENT "${agentName}"`);
      this.sendToWebview({ type: "chat:workingStatus", working: true, label: `${agentName} — working...` });
      await this.getEngine().invokeChat(`[Agent: ${agentName}] ${agentTask}`);
      this.sendToWebview({ type: "chat:workingStatus", working: false });
      return;
    }

    // Check ticket pattern (use original text)
    const match = text.trim().match(TICKET_PATTERN);
    if (match) {
      const ticketKey = match[1];
      const action = match[2].trim().toLowerCase();
      const phase = this.parsePhase(action);
      debugLog(` handleUserMessage: routed to SDLC PIPELINE ticket=${ticketKey} phase=${phase}`);
      this.sendToWebview({ type: "chat:workingStatus", working: true, label: `${ticketKey} — ${phase}` });
      await this.getEngine().invoke(ticketKey, phase, enrichedText);
      this.sendToWebview({ type: "chat:workingStatus", working: false });
      return;
    }

    // All other messages go through router graph (intent auto-classified)
    debugLog(` handleUserMessage: routed to CHAT (invokeChat)`);
    await this.getEngine().invokeChat(enrichedText);
    debugLog(` handleUserMessage: invokeChat RETURNED`);

    // KSA-280: Fire agentStop hooks after chat completion
    try {
      const engine = this.getEngine();
      await engine.hookEngine.fireAgentStop(engine.getStreamHandler());
    } catch { /* hooks must never break main execution */ }

    this.sendToWebview({ type: "chat:workingStatus", working: false });
  }

  private async handleApproval(decision: string, feedback?: string): Promise<void> {
    const validDecisions = ["approve", "reject", "revise"] as const;
    if (!validDecisions.includes(decision as any)) { return; }
    await this.getEngine().handleApproval(decision as any, feedback);
  }

  private handleNodeClick(nodeId: string): void {
    const nodes = this.getEngine().getCurrentNodeStates();
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      this.sendToWebview({
        type: "chat:nodeDetails",
        node,
        recentOutputs: [],
      });
    }
  }

  private async handleDirectCommand(command: string): Promise<void> {
    switch (command) {
      case "status": {
        const nodes = this.getEngine().getCurrentNodeStates();
        this.sendToWebview({ type: "chat:graphUpdate", nodes });
        break;
      }
      case "resume": {
        const pipelines = this.getEngine().listPersistedPipelines();
        const paused = pipelines.find(p => p.status === "paused");
        if (paused) {
          await this.getEngine().resume(paused.threadId);
        } else {
          this.sendToWebview({
            type: "chat:error",
            code: "NO_PIPELINE",
            message: "No paused pipeline to resume.",
            retryable: false,
          });
        }
        break;
      }
      case "cancel":
        this.getEngine().cancel();
        break;
    }
  }

  private parsePhase(action: string): SDLCPhase {
    for (const [keyword, phase] of Object.entries(PHASE_KEYWORDS)) {
      if (action.includes(keyword)) { return phase; }
    }
    return "all";
  }
}


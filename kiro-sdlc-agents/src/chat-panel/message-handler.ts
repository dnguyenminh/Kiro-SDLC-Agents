/**
 * Message Handler — KSA-210
 * Dispatches incoming webview messages to the appropriate engine actions.
 */

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
    switch (msg.type) {
      case "ready":
        await this.handleReady();
        break;
      case "refresh":
        await this.handleReady();
        break;
      case "chat:userMessage":
        await this.handleUserMessage(msg.text);
        break;
      case "chat:approvalAction":
        await this.handleApproval(msg.decision, msg.feedback);
        break;
      case "chat:cancelStream":
        this.getEngine().cancel();
        this.sendToWebview({ type: "chat:workingStatus", working: false });
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

  private async handleUserMessage(text: string): Promise<void> {
    const trimmed = text.trim().toLowerCase();

    // Emit working status
    this.sendToWebview({ type: "chat:workingStatus", working: true, label: "Working..." });

    // Check direct commands
    if (DIRECT_COMMANDS[trimmed]) {
      await this.handleDirectCommand(DIRECT_COMMANDS[trimmed]);
      return;
    }

    // Check ticket pattern
    const match = text.trim().match(TICKET_PATTERN);
    if (match) {
      const ticketKey = match[1];
      const action = match[2].trim().toLowerCase();
      const phase = this.parsePhase(action);
      this.sendToWebview({ type: "chat:workingStatus", working: true, label: `${ticketKey} — ${phase}` });
      await this.getEngine().invoke(ticketKey, phase, text);
      return;
    }

    // All other messages go through router graph (intent auto-classified)
    await this.getEngine().invokeChat(text);
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

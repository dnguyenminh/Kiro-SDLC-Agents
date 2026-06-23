"use strict";
/**
 * Message Handler — KSA-210
 * Dispatches incoming webview messages to the appropriate engine actions.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageHandler = void 0;
const vscode = __importStar(require("vscode"));
const debug_logger_1 = require("../debug-logger");
/** Pattern matching for ticket-based commands */
const TICKET_PATTERN = /^([A-Z]+-\d+)\s+(.+)$/;
/** Direct command patterns */
const DIRECT_COMMANDS = {
    status: "status",
    resume: "resume",
    cancel: "cancel",
};
/** Phase keywords for ticket commands */
const PHASE_KEYWORDS = {
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
class MessageHandler {
    getEngine;
    sendToWebview;
    onPickContext;
    onPickAttachment;
    onApplyCode;
    onInsertCode;
    onSetModel;
    currentModel = "auto";
    currentMode = "autopilot";
    constructor(getEngine, sendToWebview, onPickContext, onPickAttachment, onApplyCode, onInsertCode, onSetModel) {
        this.getEngine = getEngine;
        this.sendToWebview = sendToWebview;
        this.onPickContext = onPickContext;
        this.onPickAttachment = onPickAttachment;
        this.onApplyCode = onApplyCode;
        this.onInsertCode = onInsertCode;
        this.onSetModel = onSetModel;
    }
    async handle(msg) {
        (0, debug_logger_1.debugLog)(` MessageHandler.handle: type="${msg.type}"`);
        switch (msg.type) {
            case "ready":
                (0, debug_logger_1.debugLog)(` MessageHandler: webview READY`);
                await this.handleReady();
                break;
            case "refresh":
                await this.handleReady();
                break;
            case "chat:userMessage":
                (0, debug_logger_1.debugLog)(` MessageHandler: userMessage="${msg.text?.slice(0, 80)}"`);
                await this.handleUserMessage(msg.text, msg.context);
                break;
            case "chat:approvalAction":
                await this.handleApproval(msg.decision, msg.feedback);
                break;
            case "chat:cancelStream":
                this.getEngine().cancel();
                this.sendToWebview({ type: "chat:workingStatus", working: false });
                // KSA-283: Emit streamComplete to close any pending tool blocks in UI
                this.sendToWebview({ type: "chat:streamComplete", streamId: "cancelled", nodeId: "user", finalContent: "Cancelled by user", metadata: {} });
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
                (0, debug_logger_1.debugLog)(` MessageHandler: tab:create`);
                break;
            case "tab:switch":
                (0, debug_logger_1.debugLog)(` MessageHandler: tab:switch to ${msg.payload?.tabId}`);
                // Tab switch — swap LLM context to target tab
                this.getEngine().switchActiveTab(msg.payload.tabId);
                break;
            case "tab:close":
                (0, debug_logger_1.debugLog)(` MessageHandler: tab:close ${msg.payload?.tabId}`);
                break;
            case "tab:rename":
                break;
        }
    }
    async handleReady() {
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
    async handleUserMessage(text, context) {
        // Build enriched input with context content
        let enrichedText = text;
        if (context && context.length > 0) {
            const contextSections = [];
            for (const item of context) {
                if (item.content) {
                    contextSections.push(`<${item.type} name="${item.label}">\n${item.content}\n</${item.type}>`);
                }
                else if (item.path) {
                    contextSections.push(`<${item.type} name="${item.label}" path="${item.path}" />`);
                }
            }
            if (contextSections.length > 0) {
                enrichedText = `<context>\n${contextSections.join("\n")}\n</context>\n\n${text}`;
            }
        }
        const trimmed = enrichedText.trim().toLowerCase();
        (0, debug_logger_1.debugLog)(` handleUserMessage: "${text.slice(0, 80)}" (trimmed: "${trimmed.slice(0, 40)}", context: ${context?.length || 0} items)`);
        // Emit working status
        this.sendToWebview({ type: "chat:workingStatus", working: true, label: "Working..." });
        // KSA-280: Fire promptSubmit hooks (non-blocking, errors don't affect main flow)
        try {
            const engine = this.getEngine();
            const hookEngine = engine.hookEngine;
            const streamHandler = engine.getStreamHandler();
            await hookEngine.firePromptSubmit(text, streamHandler);
        }
        catch { /* hooks must never break main execution */ }
        // Check direct commands (use original text for command matching)
        const textTrimmed = text.trim().toLowerCase();
        if (DIRECT_COMMANDS[textTrimmed]) {
            (0, debug_logger_1.debugLog)(` handleUserMessage: routed to DIRECT COMMAND "${textTrimmed}"`);
            await this.handleDirectCommand(DIRECT_COMMANDS[textTrimmed]);
            this.sendToWebview({ type: "chat:workingStatus", working: false });
            return;
        }
        // KSA-278: Check for agent command prefix (e.g., "/qa-agent some task")
        const agentMatch = text.trim().match(/^\/([a-z][-a-z]*)\s+(.+)$/i);
        if (agentMatch) {
            const agentName = agentMatch[1];
            const agentTask = agentMatch[2];
            (0, debug_logger_1.debugLog)(` handleUserMessage: routed to AGENT "${agentName}"`);
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
            (0, debug_logger_1.debugLog)(` handleUserMessage: routed to SDLC PIPELINE ticket=${ticketKey} phase=${phase}`);
            this.sendToWebview({ type: "chat:workingStatus", working: true, label: `${ticketKey} — ${phase}` });
            await this.getEngine().invoke(ticketKey, phase, enrichedText);
            this.sendToWebview({ type: "chat:workingStatus", working: false });
            return;
        }
        // All other messages go through router graph (intent auto-classified)
        (0, debug_logger_1.debugLog)(` handleUserMessage: routed to CHAT (invokeChat)`);
        await this.getEngine().invokeChat(enrichedText);
        (0, debug_logger_1.debugLog)(` handleUserMessage: invokeChat RETURNED`);
        // KSA-280: Fire agentStop hooks after chat completion
        try {
            const engine = this.getEngine();
            await engine.hookEngine.fireAgentStop(engine.getStreamHandler());
        }
        catch { /* hooks must never break main execution */ }
        this.sendToWebview({ type: "chat:workingStatus", working: false });
    }
    async handleApproval(decision, feedback) {
        const validDecisions = ["approve", "reject", "revise"];
        if (!validDecisions.includes(decision)) {
            return;
        }
        await this.getEngine().handleApproval(decision, feedback);
    }
    handleNodeClick(nodeId) {
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
    async handleDirectCommand(command) {
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
                }
                else {
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
    parsePhase(action) {
        for (const [keyword, phase] of Object.entries(PHASE_KEYWORDS)) {
            if (action.includes(keyword)) {
                return phase;
            }
        }
        return "all";
    }
}
exports.MessageHandler = MessageHandler;
//# sourceMappingURL=message-handler.js.map
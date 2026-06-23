"use strict";
/**
 * LangGraphEngine — KSA-210
 * Singleton orchestration engine. Manages graph lifecycle, invocation,
 * resume, approval handling, and state queries.
 * Lazy-initialized on first use (BR-11: zero activation impact).
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
exports.LangGraphEngine = void 0;
const crypto = __importStar(require("crypto"));
const debug_logger_1 = require("../debug-logger");
const mcp_bridge_1 = require("./mcp-bridge");
const stream_handler_1 = require("./stream-handler");
const checkpointer_1 = require("./checkpointer");
const graph_builder_1 = require("./graph-builder");
const hook_engine_1 = require("./hook-engine");
class LangGraphEngine {
    mcpManager;
    workspaceRoot;
    onEvent;
    graph = null;
    checkpointer;
    streamHandler;
    mcpBridge;
    llmProvider;
    activeThread = null;
    cancelled = false;
    chatHistoryByTab = new Map(); // KSA-240: Per-tab conversation history
    activeTabId = ""; // KSA-240: Current active tab for context routing
    hookEngine; // KSA-280: Hook engine for pipeline integration
    constructor(mcpManager, workspaceRoot, onEvent, llmProvider) {
        this.mcpManager = mcpManager;
        this.workspaceRoot = workspaceRoot;
        this.onEvent = onEvent;
        this.checkpointer = new checkpointer_1.WorkspaceCheckpointer(workspaceRoot);
        this.streamHandler = new stream_handler_1.StreamHandler(onEvent);
        this.mcpBridge = new mcp_bridge_1.McpBridge(mcpManager);
        this.llmProvider = llmProvider;
        this.hookEngine = new hook_engine_1.HookEngine(workspaceRoot); // KSA-280
        // Run cleanup on construction (stale pipeline removal)
        this.checkpointer.cleanup();
    }
    /** Set or replace the LLM provider at runtime (e.g., after settings change). */
    setLlmProvider(provider) {
        this.llmProvider = provider;
        // Force graph rebuild on next invocation so nodes get the new provider
        this.graph = null;
    }
    /** KSA-280: Get the stream handler for external hook integration. */
    getStreamHandler() {
        return this.streamHandler;
    }
    /** KSA-240: Set chat history from persisted state (e.g., after reload) */
    setChatHistory(history, tabId) {
        const id = tabId || this.activeTabId || "default";
        this.chatHistoryByTab.set(id, history);
        if (!this.activeTabId)
            this.activeTabId = id;
    }
    /** KSA-240: Get current chat history for persistence */
    getChatHistory() {
        return this.chatHistoryByTab.get(this.activeTabId) || [];
    }
    /** KSA-240: Switch active tab — engine uses this tab's chatHistory */
    switchActiveTab(tabId) {
        this.activeTabId = tabId;
        if (!this.chatHistoryByTab.has(tabId)) {
            this.chatHistoryByTab.set(tabId, []);
        }
    }
    /** Lazy-init: build graph on first invocation */
    async ensureGraph() {
        if (!this.graph) {
            this.graph = await (0, graph_builder_1.buildPipelineGraph)(this.mcpBridge, this.streamHandler, this.checkpointer, this.llmProvider, this.hookEngine);
        }
        return this.graph;
    }
    /** Start a new pipeline execution */
    async invoke(ticketKey, phase, chatInput, intent) {
        const graph = await this.ensureGraph();
        const threadId = crypto.randomUUID();
        this.activeThread = threadId;
        this.cancelled = false;
        const streamId = `stream-${threadId}-${Date.now()}`;
        // Pre-classify intent: ticket-based commands → sdlc, otherwise let router decide
        const resolvedIntent = intent || "sdlc";
        // Notify UI of pipeline start
        this.onEvent({
            type: "chat:pipelineStatus",
            status: "running",
            phase,
            ticketKey,
        });
        const initialState = {
            ticketKey,
            threadId,
            currentPhase: phase,
            intent: resolvedIntent,
            pipelineStatus: "running",
            resumePoint: null,
            documents: {},
            agentOutputs: [],
            currentStreamId: streamId,
            approvalRequired: false,
            approvalDecision: null,
            userFeedback: null,
            pendingApprovals: [],
            chatHistory: [{
                    id: crypto.randomUUID(),
                    role: "user",
                    content: chatInput,
                    timestamp: new Date().toISOString(),
                }],
            errors: [],
            retryCount: {},
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            lastCheckpointAt: null,
        };
        try {
            await graph.invoke(initialState, {
                configurable: { thread_id: threadId },
            });
            if (!this.cancelled) {
                this.onEvent({
                    type: "chat:pipelineStatus",
                    status: "paused",
                    phase,
                    ticketKey,
                });
            }
        }
        catch (error) {
            this.onEvent({
                type: "chat:error",
                code: "PIPELINE_ERROR",
                message: error.message,
                retryable: true,
            });
        }
        finally {
            this.onEvent({ type: "chat:workingStatus", working: false });
        }
    }
    /** Resume from persisted checkpoint */
    async resume(threadId) {
        const graph = await this.ensureGraph();
        this.activeThread = threadId;
        this.cancelled = false;
        const tuple = await this.checkpointer.getTuple({
            configurable: { thread_id: threadId },
        });
        if (!tuple) {
            this.onEvent({
                type: "chat:error",
                code: "NO_CHECKPOINT",
                message: `No saved state found for thread ${threadId}`,
                retryable: false,
            });
            return;
        }
        try {
            await graph.invoke(null, {
                configurable: { thread_id: threadId },
            });
        }
        catch (error) {
            this.onEvent({
                type: "chat:error",
                code: "RESUME_ERROR",
                message: error.message,
                retryable: true,
            });
        }
    }
    /** Handle human approval decision — update state and resume */
    async handleApproval(decision, feedback) {
        if (!this.activeThread) {
            return;
        }
        const graph = await this.ensureGraph();
        // Update state with approval decision via graph invocation
        await graph.invoke({
            approvalDecision: decision,
            approvalRequired: false,
            userFeedback: feedback || null,
            pipelineStatus: decision === "reject" ? "cancelled" : "running",
        }, { configurable: { thread_id: this.activeThread } });
    }
    /** Cancel active execution */
    cancel() {
        this.cancelled = true;
        this.activeThread = null;
        this.onEvent({
            type: "chat:pipelineStatus",
            status: "cancelled",
            phase: "requirements",
            ticketKey: "",
        });
    }
    /**
     * Invoke the router graph for free-form messages.
     * Intent is auto-classified by the router's classify_intent node.
     */
    async invokeChat(chatInput) {
        const graph = await this.ensureGraph();
        const threadId = crypto.randomUUID();
        this.activeThread = threadId;
        this.cancelled = false;
        const streamId = `stream-${threadId}-${Date.now()}`;
        (0, debug_logger_1.debugLog)(` invokeChat: activeTabId="${this.activeTabId}", input="${chatInput.slice(0, 50)}..."`);
        // KSA-240: Add user message to accumulated history for active tab
        if (!this.activeTabId)
            this.activeTabId = "default";
        const tabHistory = this.chatHistoryByTab.get(this.activeTabId) || [];
        (0, debug_logger_1.debugLog)(` invokeChat: tabHistory has ${tabHistory.length} messages before adding user msg`);
        tabHistory.push({
            id: crypto.randomUUID(),
            role: "user",
            content: chatInput,
            timestamp: new Date().toISOString(),
        });
        // Keep only last 20 messages to avoid token overflow
        if (tabHistory.length > 20) {
            tabHistory.splice(0, tabHistory.length - 20);
        }
        this.chatHistoryByTab.set(this.activeTabId, tabHistory);
        const initialState = {
            ticketKey: "",
            threadId,
            currentPhase: "all",
            intent: "chat",
            pipelineStatus: "running",
            resumePoint: null,
            documents: {},
            agentOutputs: [],
            currentStreamId: streamId,
            approvalRequired: false,
            approvalDecision: null,
            userFeedback: null,
            pendingApprovals: [],
            chatHistory: [...tabHistory], // Pass full conversation context for active tab
            errors: [],
            retryCount: {},
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            lastCheckpointAt: null,
        };
        try {
            // Overall timeout: 4 minutes max for entire chat graph execution
            const CHAT_GRAPH_TIMEOUT_MS = 240_000;
            const graphPromise = graph.invoke(initialState, {
                configurable: { thread_id: threadId },
                recursionLimit: 100, // Allow up to ~50 ReAct iterations (2 nodes each)
            });
            const timeoutPromise = new Promise((_, reject) => {
                const timer = setTimeout(() => reject(new Error("Chat execution timed out (2 min limit). Try a simpler question or start a new tab.")), CHAT_GRAPH_TIMEOUT_MS);
                if (timer.unref)
                    timer.unref();
            });
            const result = await Promise.race([graphPromise, timeoutPromise]);
            // KSA-240: Capture assistant response into chatHistory for context continuity
            (0, debug_logger_1.debugLog)(` invokeChat: graph completed. agentOutputs=${result?.agentOutputs?.length || 0}`);
            if (result && result.agentOutputs) {
                const outputs = result.agentOutputs;
                const lastOutput = outputs[outputs.length - 1];
                if (lastOutput && lastOutput.content) {
                    const activeHistory = this.chatHistoryByTab.get(this.activeTabId) || [];
                    activeHistory.push({
                        id: crypto.randomUUID(),
                        role: "assistant",
                        content: lastOutput.content,
                        timestamp: new Date().toISOString(),
                    });
                    this.chatHistoryByTab.set(this.activeTabId, activeHistory);
                }
            }
            else {
                // Graph ended without text output (e.g., max iterations reached)
                // Emit a summary so UI doesn't show blank
                (0, debug_logger_1.debugLog)(` invokeChat: no agentOutputs — emitting max-iterations notice`);
                this.streamHandler.emitDirect({
                    type: "chat:streamChunk",
                    streamId: streamId,
                    nodeId: "chat",
                    eventType: "token",
                    content: "I gathered information using tools but reached the iteration limit before synthesizing a final answer. Please ask a more specific question or try again.",
                    timestamp: new Date().toISOString(),
                });
                this.streamHandler.emitDirect({
                    type: "chat:streamComplete",
                    streamId: streamId,
                    nodeId: "chat",
                    finalContent: "",
                });
            }
        }
        catch (error) {
            (0, debug_logger_1.debugError)(` invokeChat ERROR: ${error.message}`);
            this.onEvent({
                type: "chat:error",
                code: "PIPELINE_ERROR",
                message: error.message,
                retryable: true,
            });
        }
        finally {
            (0, debug_logger_1.debugLog)(` invokeChat: FINALLY — emitting workingStatus:false`);
            // Always clear working status when graph finishes
            this.onEvent({ type: "chat:workingStatus", working: false });
        }
    }
    /** List persisted pipelines for resume prompt */
    listPersistedPipelines() {
        return this.checkpointer.listPersistedPipelines();
    }
    /** Get current graph node states for visualization */
    getCurrentNodeStates() {
        // Static node definitions — status updated from last known state
        const nodeIds = [
            { id: "sm", label: "Scrum Master", phase: "requirements" },
            { id: "ba", label: "Business Analyst", phase: "requirements" },
            { id: "sa", label: "Solution Architect", phase: "design" },
            { id: "approval", label: "Quality Gate", phase: "requirements" },
        ];
        return nodeIds.map(n => ({
            ...n,
            status: "idle",
        }));
    }
    /** Dispose resources */
    dispose() {
        this.streamHandler.dispose();
        this.hookEngine.dispose(); // KSA-280
        this.activeThread = null;
    }
}
exports.LangGraphEngine = LangGraphEngine;
//# sourceMappingURL=langgraph-engine.js.map
/**
 * LangGraphEngine — KSA-210
 * Singleton orchestration engine. Manages graph lifecycle, invocation,
 * resume, approval handling, and state queries.
 * Lazy-initialized on first use (BR-11: zero activation impact).
 */

import * as crypto from "crypto";
import { debugLog, debugError } from "../debug-logger";
import { McpServerManager } from "../mcp-server-manager";
import { ChatExtToWebviewMessage } from "../chat-panel/message-protocol";
import { McpBridge } from "./mcp-bridge";
import { StreamHandler } from "./stream-handler";
import { WorkspaceCheckpointer } from "./checkpointer";
import { buildPipelineGraph } from "./graph-builder";
import { HookEngine } from "./hook-engine";
import type { LlmProvider } from "./llm-provider";
import {
  PipelineState,
  SDLCPhase,
  PipelineStatus,
  ApprovalDecision,
  PipelineIntent,
  PipelineGraphNode,
  PersistedPipelineInfo,
  ChatMessage,
} from "./state";

type CompiledGraph = Awaited<ReturnType<typeof buildPipelineGraph>>;

export class LangGraphEngine {
  private graph: CompiledGraph | null = null;
  private checkpointer: WorkspaceCheckpointer;
  private streamHandler: StreamHandler;
  private mcpBridge: McpBridge;
  private llmProvider: LlmProvider | undefined;
  private activeThread: string | null = null;
  private cancelled = false;
  private chatHistoryByTab: Map<string, ChatMessage[]> = new Map(); // KSA-240: Per-tab conversation history
  private activeTabId: string = ""; // KSA-240: Current active tab for context routing
  readonly hookEngine: HookEngine; // KSA-280: Hook engine for pipeline integration

  constructor(
    private readonly mcpManager: McpServerManager,
    private readonly workspaceRoot: string,
    private readonly onEvent: (msg: ChatExtToWebviewMessage) => void,
    llmProvider?: LlmProvider
  ) {
    this.checkpointer = new WorkspaceCheckpointer(workspaceRoot);
    this.streamHandler = new StreamHandler(onEvent);
    this.mcpBridge = new McpBridge(mcpManager);
    this.llmProvider = llmProvider;
    this.hookEngine = new HookEngine(workspaceRoot); // KSA-280

    // Run cleanup on construction (stale pipeline removal)
    this.checkpointer.cleanup();
  }

  /** Set or replace the LLM provider at runtime (e.g., after settings change). */
  setLlmProvider(provider: LlmProvider | undefined): void {
    this.llmProvider = provider;
    // Force graph rebuild on next invocation so nodes get the new provider
    this.graph = null;
  }

  /** KSA-280: Get the stream handler for external hook integration. */
  getStreamHandler(): StreamHandler {
    return this.streamHandler;
  }

  /** KSA-240: Set chat history from persisted state (e.g., after reload) */
  setChatHistory(history: ChatMessage[], tabId?: string): void {
    const id = tabId || this.activeTabId || "default";
    this.chatHistoryByTab.set(id, history);
    if (!this.activeTabId) this.activeTabId = id;
  }

  /** KSA-240: Get current chat history for persistence */
  getChatHistory(): ChatMessage[] {
    return this.chatHistoryByTab.get(this.activeTabId) || [];
  }

  /** KSA-240: Switch active tab — engine uses this tab's chatHistory */
  switchActiveTab(tabId: string): void {
    this.activeTabId = tabId;
    if (!this.chatHistoryByTab.has(tabId)) {
      this.chatHistoryByTab.set(tabId, []);
    }
  }

  /** Lazy-init: build graph on first invocation */
  private async ensureGraph(): Promise<CompiledGraph> {
    if (!this.graph) {
      this.graph = await buildPipelineGraph(this.mcpBridge, this.streamHandler, this.checkpointer, this.llmProvider, this.hookEngine);
    }
    return this.graph;
  }

  /** Start a new pipeline execution */
  async invoke(ticketKey: string, phase: SDLCPhase, chatInput: string, intent?: PipelineIntent): Promise<void> {
    const graph = await this.ensureGraph();
    const threadId = crypto.randomUUID();
    this.activeThread = threadId;
    this.cancelled = false;

    const streamId = `stream-${threadId}-${Date.now()}`;

    // Pre-classify intent: ticket-based commands → sdlc, otherwise let router decide
    const resolvedIntent: PipelineIntent = intent || "sdlc";

    // Notify UI of pipeline start
    this.onEvent({
      type: "chat:pipelineStatus",
      status: "running",
      phase,
      ticketKey,
    });

    const initialState: Partial<PipelineState> = {
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
    } catch (error) {
      this.onEvent({
        type: "chat:error",
        code: "PIPELINE_ERROR",
        message: (error as Error).message,
        retryable: true,
      });
    } finally {
      this.onEvent({ type: "chat:workingStatus", working: false });
    }
  }

  /** Resume from persisted checkpoint */
  async resume(threadId: string): Promise<void> {
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
    } catch (error) {
      this.onEvent({
        type: "chat:error",
        code: "RESUME_ERROR",
        message: (error as Error).message,
        retryable: true,
      });
    }
  }

  /** Handle human approval decision — update state and resume */
  async handleApproval(decision: ApprovalDecision, feedback?: string): Promise<void> {
    if (!this.activeThread) { return; }

    const graph = await this.ensureGraph();

    // Update state with approval decision via graph invocation
    await graph.invoke(
      {
        approvalDecision: decision,
        approvalRequired: false,
        userFeedback: feedback || null,
        pipelineStatus: decision === "reject" ? "cancelled" : "running",
      },
      { configurable: { thread_id: this.activeThread } }
    );
  }

  /** Cancel active execution */
  cancel(): void {
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
  async invokeChat(chatInput: string): Promise<void> {
    const graph = await this.ensureGraph();
    const threadId = crypto.randomUUID();
    this.activeThread = threadId;
    this.cancelled = false;

    const streamId = `stream-${threadId}-${Date.now()}`;
    debugLog(` invokeChat: activeTabId="${this.activeTabId}", input="${chatInput.slice(0, 50)}..."`);

    // KSA-240: Add user message to accumulated history for active tab
    if (!this.activeTabId) this.activeTabId = "default";
    const tabHistory = this.chatHistoryByTab.get(this.activeTabId) || [];
    debugLog(` invokeChat: tabHistory has ${tabHistory.length} messages before adding user msg`);
    tabHistory.push({
      id: crypto.randomUUID(),
      role: "user",
      content: chatInput,
      timestamp: new Date().toISOString(),
    } as ChatMessage);

    // Keep only last 20 messages to avoid token overflow
    if (tabHistory.length > 20) {
      tabHistory.splice(0, tabHistory.length - 20);
    }
    this.chatHistoryByTab.set(this.activeTabId, tabHistory);

    const initialState: Partial<PipelineState> = {
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
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error("Chat execution timed out (2 min limit). Try a simpler question or start a new tab.")), CHAT_GRAPH_TIMEOUT_MS);
        if (timer.unref) timer.unref();
      });
      const result = await Promise.race([graphPromise, timeoutPromise]);

      // KSA-240: Capture assistant response into chatHistory for context continuity
      debugLog(` invokeChat: graph completed. agentOutputs=${(result as any)?.agentOutputs?.length || 0}`);
      if (result && (result as any).agentOutputs) {
        const outputs = (result as any).agentOutputs as Array<{ content: string }>;
        const lastOutput = outputs[outputs.length - 1];
        if (lastOutput && lastOutput.content) {
          const activeHistory = this.chatHistoryByTab.get(this.activeTabId) || [];
          activeHistory.push({
            id: crypto.randomUUID(),
            role: "assistant",
            content: lastOutput.content,
            timestamp: new Date().toISOString(),
          } as ChatMessage);
          this.chatHistoryByTab.set(this.activeTabId, activeHistory);
        }
      } else {
        // Graph ended without text output (e.g., max iterations reached)
        // Emit a summary so UI doesn't show blank
        debugLog(` invokeChat: no agentOutputs — emitting max-iterations notice`);
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
    } catch (error) {
      debugError(` invokeChat ERROR: ${(error as Error).message}`);
      this.onEvent({
        type: "chat:error",
        code: "PIPELINE_ERROR",
        message: (error as Error).message,
        retryable: true,
      });
    } finally {
      debugLog(` invokeChat: FINALLY — emitting workingStatus:false`);
      // Always clear working status when graph finishes
      this.onEvent({ type: "chat:workingStatus", working: false });
    }
  }

  /** List persisted pipelines for resume prompt */
  listPersistedPipelines(): PersistedPipelineInfo[] {
    return this.checkpointer.listPersistedPipelines();
  }

  /** Get current graph node states for visualization */
  getCurrentNodeStates(): PipelineGraphNode[] {
    // Static node definitions — status updated from last known state
    const nodeIds: Array<{ id: string; label: string; phase: SDLCPhase }> = [
      { id: "sm", label: "Scrum Master", phase: "requirements" },
      { id: "ba", label: "Business Analyst", phase: "requirements" },
      { id: "sa", label: "Solution Architect", phase: "design" },
      { id: "approval", label: "Quality Gate", phase: "requirements" },
    ];

    return nodeIds.map(n => ({
      ...n,
      status: "idle" as const,
    }));
  }

  /** Dispose resources */
  dispose(): void {
    this.streamHandler.dispose();
    this.hookEngine.dispose(); // KSA-280
    this.activeThread = null;
  }
}


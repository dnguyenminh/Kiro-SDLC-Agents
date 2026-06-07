/**
 * LangGraphEngine — KSA-210
 * Singleton orchestration engine. Manages graph lifecycle, invocation,
 * resume, approval handling, and state queries.
 * Lazy-initialized on first use (BR-11: zero activation impact).
 */

import * as crypto from "crypto";
import { McpServerManager } from "../mcp-server-manager";
import { ChatExtToWebviewMessage } from "../chat-panel/message-protocol";
import { McpBridge } from "./mcp-bridge";
import { StreamHandler } from "./stream-handler";
import { WorkspaceCheckpointer } from "./checkpointer";
import { buildPipelineGraph } from "./graph-builder";
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

    // Run cleanup on construction (stale pipeline removal)
    this.checkpointer.cleanup();
  }

  /** Set or replace the LLM provider at runtime (e.g., after settings change). */
  setLlmProvider(provider: LlmProvider | undefined): void {
    this.llmProvider = provider;
    // Force graph rebuild on next invocation so nodes get the new provider
    this.graph = null;
  }

  /** Lazy-init: build graph on first invocation */
  private async ensureGraph(): Promise<CompiledGraph> {
    if (!this.graph) {
      this.graph = await buildPipelineGraph(this.mcpBridge, this.streamHandler, this.checkpointer, this.llmProvider);
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

    const initialState: Partial<PipelineState> = {
      ticketKey: "",
      threadId,
      currentPhase: "all",
      intent: "chat", // Default — router may reclassify if patterns match
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
    } catch (error) {
      this.onEvent({
        type: "chat:error",
        code: "PIPELINE_ERROR",
        message: (error as Error).message,
        retryable: true,
      });
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
    this.activeThread = null;
  }
}

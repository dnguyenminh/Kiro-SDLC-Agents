/**
 * BaseNode — KSA-210 + KSA-233 (Auto-Retry with Exponential Backoff)
 * Abstract base class for all LangGraph pipeline nodes.
 * Provides timeout, retry loop, error handling, streaming, MCP tool call, and LLM wrappers.
 */

import { McpBridge } from "../mcp-bridge";
import { StreamHandler } from "../stream-handler";
import { PipelineState, PipelineError } from "../state";
import { NonRecoverableError } from "../errors/non-recoverable-error";
import type { LlmProvider, LlmMessage, LlmOptions } from "../llm-provider";

/** Maximum node execution time (300s per TDD Section 5.4) */
const NODE_TIMEOUT_MS = 300_000;

/** Per-tool call timeout (60s per TDD Section 3.3) */
const TOOL_CALL_TIMEOUT_MS = 60_000;

export abstract class BaseNode {
  /** Maximum retry attempts (KSA-233: default 2) */
  private static readonly MAX_RETRIES = 2;

  constructor(
    protected readonly nodeId: string,
    protected readonly mcpBridge: McpBridge,
    protected readonly streamHandler: StreamHandler,
    protected readonly llmProvider?: LlmProvider
  ) {}

  /** Subclasses implement core logic here */
  abstract execute(state: PipelineState): Promise<Partial<PipelineState>>;

  /**
   * Wraps execute() with timeout, retry loop, status streaming, and error handling.
   * This is the method registered as the LangGraph node function.
   *
   * Retry flow (KSA-233, implements UC-1):
   *   1. Call execute() with timeout
   *   2. If NonRecoverableError -> fail immediately (EF-2)
   *   3. If error and retryCount < MAX_RETRIES -> emit retry event, wait backoff, re-execute
   *   4. If all retries exhausted -> emit error, return failed state (EF-1)
   *   5. If success -> emit complete, return result
   */
  async run(state: PipelineState): Promise<Partial<PipelineState>> {
    const startTime = Date.now();
    const maxRetries = BaseNode.MAX_RETRIES;
    let currentRetryCount = state.retryCount?.[this.nodeId] ?? 0;

    this.streamHandler.emitStatus(this.nodeId, "active", state.currentStreamId);

    // Initial attempt + retry loop
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.withTimeout(this.execute(state), NODE_TIMEOUT_MS);
        const duration = Date.now() - startTime;
        this.streamHandler.emitComplete(this.nodeId, duration, state.currentStreamId);

        return {
          ...result,
          retryCount: { ...state.retryCount, [this.nodeId]: currentRetryCount },
          lastUpdatedAt: new Date().toISOString(),
        };
      } catch (error) {
        const err = error as Error;

        // EF-2: Non-recoverable errors bypass retry entirely
        if (err instanceof NonRecoverableError) {
          return this.buildFailureState(state, err, currentRetryCount);
        }

        // Check if more retries available
        if (attempt < maxRetries) {
          currentRetryCount++;
          const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s

          // Emit retry event (BR-19: real-time)
          this.streamHandler.emitRetry(
            this.nodeId, attempt + 1, maxRetries, delayMs,
            err.message, state.currentStreamId
          );

          // Exponential backoff delay
          await this.sleep(delayMs);
          // Continue loop -> re-execute
        } else {
          // EF-1: All retries exhausted
          currentRetryCount++;
          return this.buildFailureState(state, err, currentRetryCount);
        }
      }
    }

    // Should never reach here, but TypeScript needs it
    return { pipelineStatus: "failed", lastUpdatedAt: new Date().toISOString() };
  }

  /**
   * Call an MCP tool via bridge with standard timeout.
   */
  protected async callMcp(toolName: string, args: Record<string, unknown>): Promise<string> {
    return this.mcpBridge.callTool(toolName, args, TOOL_CALL_TIMEOUT_MS);
  }

  /**
   * Call the LLM with system + user prompts and return the full response.
   * Falls back to MCP invoke_sub_agent if LLM provider is unavailable.
   */
  protected async callLlm(systemPrompt: string, userPrompt: string, options?: LlmOptions): Promise<string> {
    if (!this.llmProvider) {
      throw new Error(`No LLM provider configured for node '${this.nodeId}'`);
    }

    const messages: LlmMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    return this.llmProvider.chat(messages, options);
  }

  /**
   * Call the LLM with streaming, emitting tokens to the Chat Panel in real-time.
   * Yields each token chunk for callers that need to process the stream.
   */
  protected async *callLlmStream(
    systemPrompt: string,
    userPrompt: string,
    state: PipelineState,
    options?: LlmOptions
  ): AsyncGenerator<string> {
    if (!this.llmProvider) {
      throw new Error(`No LLM provider configured for node '${this.nodeId}'`);
    }

    const messages: LlmMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const stream = this.llmProvider.chatStream(messages, options);

    for await (const token of stream) {
      // Emit each token to the Chat Panel UI
      this.streamHandler.emitToken(this.nodeId, token, state.currentStreamId);
      yield token;
    }
  }

  /**
   * Convenience: stream LLM and collect the full response as a string.
   * Tokens are emitted to Chat Panel as they arrive.
   */
  protected async callLlmStreamFull(
    systemPrompt: string,
    userPrompt: string,
    state: PipelineState,
    options?: LlmOptions
  ): Promise<string> {
    let result = "";
    for await (const token of this.callLlmStream(systemPrompt, userPrompt, state, options)) {
      result += token;
    }
    return result;
  }

  /**
   * Check if the LLM provider is available for direct calls.
   */
  protected async isLlmAvailable(): Promise<boolean> {
    if (!this.llmProvider) { return false; }
    return this.llmProvider.isAvailable();
  }

  /**
   * Race a promise against a timeout.
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Node '${this.nodeId}' timed out after ${ms}ms`));
      }, ms);
      timer.unref?.();

      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Build failure state after retries exhausted or non-recoverable error (KSA-233).
   */
  private buildFailureState(
    state: PipelineState, error: Error, retryCount: number
  ): Partial<PipelineState> {
    const pipelineError: PipelineError = {
      nodeId: this.nodeId,
      code: error.name || "NODE_FAILED",
      message: error.message,
      timestamp: new Date().toISOString(),
      recoverable: !(error instanceof NonRecoverableError),
    };

    this.streamHandler.emitError(this.nodeId, error.message, state.currentStreamId);

    return {
      errors: [...(state.errors || []), pipelineError],
      retryCount: { ...state.retryCount, [this.nodeId]: retryCount },
      pipelineStatus: "failed",
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  /** Async sleep utility for backoff delay (KSA-233) */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

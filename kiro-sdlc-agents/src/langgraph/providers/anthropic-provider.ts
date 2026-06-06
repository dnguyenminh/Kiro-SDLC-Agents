/**
 * AnthropicProvider — KSA-210
 * LLM provider backed by the Anthropic Messages API via @anthropic-ai/sdk.
 * API key stored in VS Code SecretStorage (never in settings/state).
 * Supports native tool_use for ReAct agent loop.
 */

import type { LlmProvider, LlmMessage, LlmOptions, LlmResponse, LlmToolCall } from "../llm-provider";
import type { McpToolDefinition } from "../tool-registry";
import { validateToolUseId } from "../../anthropic/converter";
import { ConversationHistory } from "../../history/conversation";

/** Secret key used in VS Code SecretStorage */
export const ANTHROPIC_SECRET_KEY = "kiroSdlc.anthropicApiKey";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicProvider implements LlmProvider {
  readonly type = "anthropic" as const;
  private client: any = null;
  private readonly getApiKey: () => Promise<string | undefined>;
  private readonly baseUrl: string | undefined;

  constructor(getApiKey: () => Promise<string | undefined>, baseUrl?: string) {
    this.getApiKey = getApiKey;
    this.baseUrl = baseUrl || undefined;
  }

  async chat(messages: LlmMessage[], options?: LlmOptions): Promise<string> {
    const client = await this.ensureClient();
    const { systemPrompt, userMessages } = this.splitMessages(messages);

    const params: Record<string, unknown> = {
      model: options?.model || DEFAULT_MODEL,
      max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
      messages: userMessages.map(m => ({ role: m.role, content: m.content })),
      // Force non-streaming so the SDK parses a single JSON body. A gateway
      // base URL defaults to SSE when `stream` is omitted, which the SDK then
      // cannot parse as JSON -> empty content -> empty chat bubble (KSA-237).
      stream: false,
    };
    if (systemPrompt) {
      params.system = systemPrompt;
    }
    if (options?.temperature !== undefined) {
      params.temperature = options.temperature;
    }

    const response = await client.messages.create(params);
    // Guard: upstream may return a body without a content array (error shape,
    // streaming-only response, or non-standard gateway payload).
    const content = Array.isArray(response?.content) ? response.content : [];
    return content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text || "")
      .join("");
  }

  async *chatStream(messages: LlmMessage[], options?: LlmOptions): AsyncGenerator<string> {
    const client = await this.ensureClient();
    const { systemPrompt, userMessages } = this.splitMessages(messages);

    const params: Record<string, unknown> = {
      model: options?.model || DEFAULT_MODEL,
      max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
      messages: userMessages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    };
    if (systemPrompt) {
      params.system = systemPrompt;
    }
    if (options?.temperature !== undefined) {
      params.temperature = options.temperature;
    }

    const stream = client.messages.stream(params);

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta?.text) {
        yield event.delta.text;
      }
    }
  }

  /**
   * Chat with tool calling support using Anthropic native tool_use.
   * Tools are passed directly in the API request.
   * Response may contain tool_use content blocks.
   */
  async chatWithTools(
    messages: LlmMessage[],
    tools: McpToolDefinition[],
    options?: LlmOptions
  ): Promise<LlmResponse> {
    const client = await this.ensureClient();
    const { systemPrompt, userMessages } = this.splitMessages(messages);

    // Convert tools to Anthropic format
    const anthropicTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    // Build messages — handle tool result messages specially for Anthropic format
    const formattedMessages = this.formatMessagesForTools(userMessages);

    const params: Record<string, unknown> = {
      model: options?.model || DEFAULT_MODEL,
      max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
      messages: formattedMessages,
      tools: anthropicTools,
      // Force non-streaming so the SDK parses a single JSON body. A gateway
      // base URL defaults to SSE when `stream` is omitted, which the SDK then
      // cannot parse as JSON -> empty content -> "active" status only (KSA-237).
      stream: false,
    };
    if (systemPrompt) {
      params.system = systemPrompt;
    }
    if (options?.temperature !== undefined) {
      params.temperature = options.temperature;
    }

    const response = await client.messages.create(params);

    // Guard: upstream may return a body without a content array.
    const content = Array.isArray(response?.content) ? response.content : [];

    // Check if response contains tool_use blocks
    const toolUseBlocks = content.filter(
      (block: any) => block.type === "tool_use"
    );

    if (toolUseBlocks.length > 0) {
      const toolCalls: LlmToolCall[] = toolUseBlocks.map((block: any) => ({
        id: block.id,
        name: block.name,
        arguments: block.input || {},
      }));
      return { type: "tool_use", toolCalls };
    }

    // Text response
    const text = content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text || "")
      .join("");

    return { type: "text", text };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Available if key exists OR custom baseUrl is configured (no key needed)
      const key = await this.getApiKey();
      return !!key || !!this.baseUrl;
    } catch {
      return false;
    }
  }

  dispose(): void {
    this.client = null;
  }

  private async ensureClient(): Promise<any> {
    if (this.client) {
      return this.client;
    }

    const apiKey = await this.getApiKey();
    if (!apiKey && !this.baseUrl) {
      throw new Error(
        "Anthropic API key not configured. Run 'Kiro SDLC: Set LLM API Key' command."
      );
    }

    // Lazy-load SDK to minimize activation cost
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const options: Record<string, any> = {};
    if (apiKey) { options.apiKey = apiKey; }
    if (this.baseUrl) { options.baseURL = this.baseUrl; }
    // If no key but custom URL, pass dummy key (SDK requires it) — header won't be sent by endpoint
    if (!apiKey && this.baseUrl) { options.apiKey = "not-needed"; }
    this.client = new Anthropic(options);
    return this.client;
  }

  /**
   * Anthropic API expects system prompt separate from messages.
   * Split system messages from user/assistant messages.
   */
  private splitMessages(messages: LlmMessage[]): {
    systemPrompt: string | undefined;
    userMessages: LlmMessage[];
  } {
    const systemMsgs = messages.filter(m => m.role === "system");
    const userMessages = messages.filter(m => m.role !== "system");
    const systemPrompt = systemMsgs.length > 0
      ? systemMsgs.map(m => m.content).join("\n\n")
      : undefined;
    return { systemPrompt, userMessages };
  }

  /**
   * Format messages for Anthropic tool calling.
   * Converts tool result messages into Anthropic's expected format:
   * { role: "user", content: [{ type: "tool_result", tool_use_id, content }] }
   */
  private formatMessagesForTools(messages: LlmMessage[]): any[] {
    const formatted: any[] = [];

    for (const msg of messages) {
      if (msg.role === "tool") {
        // Anthropic expects tool results wrapped in a user message
        formatted.push({
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: msg.toolCallId || "unknown",
            content: msg.content,
          }],
        });
      } else if (msg.role === "assistant") {
        formatted.push({ role: "assistant", content: msg.content });
      } else {
        formatted.push({ role: "user", content: msg.content });
      }
    }

    return formatted;
  }
}

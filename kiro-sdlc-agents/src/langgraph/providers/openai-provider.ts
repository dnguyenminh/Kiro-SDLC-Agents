/**
 * OpenAIProvider — KSA-210
 * LLM provider using OpenAI Chat Completions API via fetch().
 * Uses raw fetch to minimize bundle size (no openai SDK dependency).
 * API key stored in VS Code SecretStorage.
 * Supports function calling for ReAct agent loop.
 */

import type { LlmProvider, LlmMessage, LlmOptions, LlmResponse, LlmToolCall } from "../llm-provider";
import type { McpToolDefinition } from "../tool-registry";

export const OPENAI_SECRET_KEY = "kiroSdlc.openaiApiKey";
const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_API_BASE = "https://api.openai.com/v1";

export class OpenAIProvider implements LlmProvider {
  readonly type = "openai" as const;
  private readonly getApiKey: () => Promise<string | undefined>;
  private readonly apiBase: string;

  constructor(getApiKey: () => Promise<string | undefined>, baseUrl?: string) {
    this.getApiKey = getApiKey;
    this.apiBase = (baseUrl || DEFAULT_API_BASE).replace(/\/$/, "");
  }

  async chat(messages: LlmMessage[], options?: LlmOptions): Promise<string> {
    const apiKey = await this.requireApiKey();
    const model = options?.model || DEFAULT_MODEL;

    const body: Record<string, unknown> = {
      model,
      messages: this.formatMessages(messages),
      max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
    };
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: "POST",
      headers: this.buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content || "";
  }

  async *chatStream(messages: LlmMessage[], options?: LlmOptions): AsyncGenerator<string> {
    const apiKey = await this.requireApiKey();
    const model = options?.model || DEFAULT_MODEL;

    const body: Record<string, unknown> = {
      model,
      messages: this.formatMessages(messages),
      max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
      stream: true,
    };
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: "POST",
      headers: this.buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error("OpenAI response has no body for streaming");
    }

    // Parse SSE stream
    const reader = (response.body as any).getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { break; }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) { continue; }

          const data = trimmed.slice(6);
          if (data === "[DONE]") { return; }

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Skip malformed SSE data
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Chat with tool calling support using OpenAI function calling.
   * Tools are passed as `tools` parameter in the request.
   */
  async chatWithTools(
    messages: LlmMessage[],
    tools: McpToolDefinition[],
    options?: LlmOptions
  ): Promise<LlmResponse> {
    const apiKey = await this.requireApiKey();
    const model = options?.model || DEFAULT_MODEL;

    // Convert tools to OpenAI format
    const openaiTools = tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    const body: Record<string, unknown> = {
      model,
      messages: this.formatMessagesForTools(messages),
      max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
      tools: openaiTools,
    };
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: "POST",
      headers: this.buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string;
      }>;
    };

    const choice = data.choices?.[0];
    const toolCalls = choice?.message?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      const calls: LlmToolCall[] = toolCalls.map((tc) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          // If arguments parsing fails, use empty object
        }
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        };
      });
      return { type: "tool_use", toolCalls: calls };
    }

    // Text response
    return { type: "text", text: choice?.message?.content || "" };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const key = await this.getApiKey();
      // Available if key exists OR custom base URL is configured (no key needed for local)
      return !!key || this.apiBase !== DEFAULT_API_BASE;
    } catch {
      return false;
    }
  }

  dispose(): void {
    // No persistent resources — stateless fetch calls
  }

  private async requireApiKey(): Promise<string> {
    const key = await this.getApiKey();
    if (!key && this.apiBase === DEFAULT_API_BASE) {
      throw new Error(
        "OpenAI API key not configured. Run 'Kiro SDLC: Set LLM API Key' command."
      );
    }
    return key || "";
  }

  /** Build request headers — skip Authorization if key is empty (custom local endpoints) */
  private buildHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    return headers;
  }

  /**
   * Format messages for basic chat (no tools).
   */
  private formatMessages(messages: LlmMessage[]): Array<{ role: string; content: string }> {
    return messages.map(m => ({ role: m.role, content: m.content }));
  }

  /**
   * Format messages for OpenAI tool calling.
   * Converts tool result messages into OpenAI's expected format.
   */
  private formatMessagesForTools(messages: LlmMessage[]): any[] {
    return messages.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "tool",
          tool_call_id: msg.toolCallId || "unknown",
          content: msg.content,
        };
      }
      return { role: msg.role, content: msg.content };
    });
  }
}

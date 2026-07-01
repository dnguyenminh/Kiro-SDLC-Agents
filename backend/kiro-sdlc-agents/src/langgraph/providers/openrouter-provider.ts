/**
 * OpenRouterProvider — KSA-210
 * LLM provider using OpenRouter API via fetch().
 * OpenRouter is an aggregator that lets you call many models (Claude, GPT, etc.)
 * through a single endpoint with one API key.
 * Uses raw fetch to minimize bundle size (no openai SDK dependency).
 * API key stored in VS Code SecretStorage.
 */

import type { LlmProvider, LlmMessage, LlmOptions, LlmResponse, LlmToolCall } from "../llm-provider";
import type { McpToolDefinition } from "../tool-registry";

export const OPENROUTER_SECRET_KEY = "kiroSdlc.openrouterApiKey";
const DEFAULT_MODEL = "meta-llama/llama-3.1-8b-instruct:free";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_API_BASE = "https://openrouter.ai/api/v1";

export class OpenRouterProvider implements LlmProvider {
  readonly type = "openrouter" as const;
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
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
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
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") return;
        try {
          const json = JSON.parse(dataStr);
          const choice = json.choices?.[0];
          if (choice?.delta?.content) {
            yield choice.delta.content;
          }
        } catch { /* skip malformed */ }
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const key = await this.getApiKey();
      if (!key) return false;
      await fetch(`${this.apiBase}/models`, {
        headers: this.buildHeaders(key),
        signal: AbortSignal.timeout(2000),
      });
      return true;
    } catch {
      return false;
    }
  }

  private requireApiKey(): string {
    const key = this.getApiKey();
    if (!key) {
      throw new Error("OpenRouter API key not configured. Run 'Kiro SDLC: Set LLM API Key' command.");
    }
    return key;
  }

  private buildHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    // OpenRouter-specific headers for usage tracking and model info
    headers["HTTP-Referer"] = "https://github.com/dnguyenminh/Kiro-SDLC-Agents";
    headers["X-Title"] = "Kiro SDLC Agents";
    return headers;
  }

  private formatMessages(messages: LlmMessage[]): Array<{ role: string; content: string }> {
    return messages.map(m => ({ role: m.role, content: m.content }));
  }
}
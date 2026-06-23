/**
 * OnnxProvider — KSA-223
 * CPU-only local LLM provider using ONNX Runtime.
 * Supports small models (Phi-3-mini, SmolLM2) for offline/air-gapped use.
 * Model downloaded on-demand via extension command.
 *
 * Architecture:
 *   - Uses onnxruntime-node for CPU inference
 *   - Tokenizer + model weights stored in .code-intel/models/llm/
 *   - Streaming via chunked generation loop
 *   - No API key required — fully local
 */

import * as path from "path";
import type { LlmProvider, LlmMessage, LlmOptions } from "../llm-provider";

/** Default model configuration */
const DEFAULT_MODEL_ID = "phi-3-mini";
const MAX_CONTEXT_TOKENS = 2048;
const MAX_NEW_TOKENS = 512;

/** Model registry — download URLs and file structure */
export interface OnnxModelConfig {
  id: string;
  displayName: string;
  files: string[];
  tokenizerFile: string;
  modelFile: string;
  contextLength: number;
}

export const ONNX_MODEL_REGISTRY: OnnxModelConfig[] = [
  {
    id: "phi-3-mini",
    displayName: "Phi-3 Mini (3.8B, Q4)",
    files: ["model.onnx", "model.onnx.data", "tokenizer.json", "tokenizer_config.json"],
    tokenizerFile: "tokenizer.json",
    modelFile: "model.onnx",
    contextLength: 2048,
  },
  {
    id: "smollm2-360m",
    displayName: "SmolLM2 (360M, FP16)",
    files: ["model.onnx", "tokenizer.json", "tokenizer_config.json"],
    tokenizerFile: "tokenizer.json",
    modelFile: "model.onnx",
    contextLength: 2048,
  },
];

export class OnnxProvider implements LlmProvider {
  readonly type = "ollama" as const;
  private session: any = null;
  private tokenizer: OnnxTokenizer | null = null;
  private readonly modelDir: string;
  private readonly modelId: string;

  constructor(workspaceRoot: string, modelId?: string) {
    this.modelId = modelId || DEFAULT_MODEL_ID;
    this.modelDir = path.join(workspaceRoot, ".code-intel", "models", "llm", this.modelId);
  }

  async chat(messages: LlmMessage[], options?: LlmOptions): Promise<string> {
    await this.ensureLoaded();
    const prompt = this.formatPrompt(messages);
    const inputIds = this.tokenizer!.encode(prompt);
    const maxInput = Math.min(inputIds.length, MAX_CONTEXT_TOKENS);
    const truncated = inputIds.slice(-maxInput);
    const maxTokens = options?.maxTokens || MAX_NEW_TOKENS;
    const generated = await this.generate(truncated, maxTokens, options?.temperature ?? 0.7);
    return this.tokenizer!.decode(generated);
  }

  async *chatStream(messages: LlmMessage[], options?: LlmOptions): AsyncGenerator<string> {
    await this.ensureLoaded();
    const prompt = this.formatPrompt(messages);
    const inputIds = this.tokenizer!.encode(prompt);
    const maxInput = Math.min(inputIds.length, MAX_CONTEXT_TOKENS);
    const truncated = inputIds.slice(-maxInput);
    const maxTokens = options?.maxTokens || MAX_NEW_TOKENS;
    let currentIds = [...truncated];
    let tokensGenerated = 0;

    while (tokensGenerated < maxTokens) {
      const nextToken = await this.predictNext(currentIds, options?.temperature ?? 0.7);
      if (nextToken === this.tokenizer!.eosTokenId) break;
      currentIds.push(nextToken);
      tokensGenerated++;
      const text = this.tokenizer!.decode([nextToken]);
      if (text) yield text;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const fs = await import("fs");
      const modelConfig = ONNX_MODEL_REGISTRY.find(m => m.id === this.modelId);
      if (!modelConfig) return false;
      const modelPath = path.join(this.modelDir, modelConfig.modelFile);
      return fs.existsSync(modelPath);
    } catch {
      return false;
    }
  }

  dispose(): void {
    if (this.session) {
      this.session.release?.();
      this.session = null;
    }
    this.tokenizer = null;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.session && this.tokenizer) return;
    const modelConfig = ONNX_MODEL_REGISTRY.find(m => m.id === this.modelId);
    if (!modelConfig) {
      throw new Error(`Unknown ONNX model: ${this.modelId}. Available: ${ONNX_MODEL_REGISTRY.map(m => m.id).join(", ")}`);
    }
    const tokenizerPath = path.join(this.modelDir, modelConfig.tokenizerFile);
    this.tokenizer = await OnnxTokenizer.load(tokenizerPath);
    const ort = await import("onnxruntime-node" as string).catch(() => null);
    if (!ort) {
      throw new Error("onnxruntime-node not available. Install via: npm install onnxruntime-node");
    }
    const modelPath = path.join(this.modelDir, modelConfig.modelFile);
    this.session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
    });
  }

  private async generate(inputIds: number[], maxNewTokens: number, temperature: number): Promise<number[]> {
    const generated: number[] = [];
    let currentIds = [...inputIds];
    for (let i = 0; i < maxNewTokens; i++) {
      const nextToken = await this.predictNext(currentIds, temperature);
      if (nextToken === this.tokenizer!.eosTokenId) break;
      generated.push(nextToken);
      currentIds.push(nextToken);
    }
    return generated;
  }

  private async predictNext(inputIds: number[], temperature: number): Promise<number> {
    const ort = await import("onnxruntime-node" as string);
    const inputTensor = new ort.Tensor("int64", BigInt64Array.from(inputIds.map(id => BigInt(id))), [1, inputIds.length]);
    const attentionMask = new ort.Tensor("int64", BigInt64Array.from(inputIds.map(() => 1n)), [1, inputIds.length]);
    const feeds: Record<string, any> = { input_ids: inputTensor, attention_mask: attentionMask };
    const results = await this.session.run(feeds);
    const logits = results.logits?.data || results[Object.keys(results)[0]]?.data;
    if (!logits) throw new Error("ONNX model did not return logits");
    const vocabSize = this.tokenizer!.vocabSize;
    const lastTokenLogits = Array.from(logits).slice(-vocabSize) as number[];
    return this.sample(lastTokenLogits, temperature);
  }

  private sample(logits: number[], temperature: number): number {
    if (temperature <= 0.01) return logits.indexOf(Math.max(...logits));
    const scaled = logits.map(l => l / temperature);
    const maxLogit = Math.max(...scaled);
    const exps = scaled.map(l => Math.exp(l - maxLogit));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(e => e / sumExps);
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i];
      if (rand < cumulative) return i;
    }
    return probs.length - 1;
  }

  private formatPrompt(messages: LlmMessage[]): string {
    return messages
      .map(m => {
        switch (m.role) {
          case "system": return `<|system|>\n${m.content}<|end|>`;
          case "user": return `<|user|>\n${m.content}<|end|>`;
          case "assistant": return `<|assistant|>\n${m.content}<|end|>`;
          default: return m.content;
        }
      })
      .join("\n") + "\n<|assistant|>\n";
  }
}

class OnnxTokenizer {
  private vocab: Map<string, number>;
  private reverseVocab: Map<number, string>;
  readonly vocabSize: number;
  readonly eosTokenId: number;

  private constructor(vocab: Map<string, number>, eosTokenId: number) {
    this.vocab = vocab;
    this.reverseVocab = new Map(Array.from(vocab.entries()).map(([k, v]) => [v, k]));
    this.vocabSize = vocab.size;
    this.eosTokenId = eosTokenId;
  }

  static async load(tokenizerPath: string): Promise<OnnxTokenizer> {
    const fs = await import("fs");
    const raw = fs.readFileSync(tokenizerPath, "utf-8");
    const config = JSON.parse(raw);
    const vocab = new Map<string, number>();
    const model = config.model || {};
    if (model.vocab) {
      for (const [token, id] of Object.entries(model.vocab)) {
        vocab.set(token, id as number);
      }
    } else if (config.added_tokens) {
      for (const token of config.added_tokens) {
        vocab.set(token.content, token.id);
      }
    }
    const eosId = vocab.get("<|end|>") ?? vocab.get("</s>") ?? vocab.get("<|endoftext|>") ?? 0;
    return new OnnxTokenizer(vocab, eosId);
  }

  encode(text: string): number[] {
    const tokens: number[] = [];
    const words = text.split(/(\s+)/);
    for (const word of words) {
      const id = this.vocab.get(word);
      if (id !== undefined) {
        tokens.push(id);
      } else {
        for (const char of word) {
          tokens.push(this.vocab.get(char) ?? 0);
        }
      }
    }
    return tokens;
  }

  decode(tokenIds: number[]): string {
    return tokenIds.map(id => this.reverseVocab.get(id) || "").join("");
  }
}

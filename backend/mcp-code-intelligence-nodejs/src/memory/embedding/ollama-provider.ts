/**
 * Ollama-backed embedding provider — wraps HTTP calls to Ollama API.
 * Uses /api/embeddings endpoint for text-to-vector conversion.
 */

import { EmbeddingProvider } from './provider.js';

/** Minimal Ollama client interface for embedding. */
export interface OllamaClient {
  getEmbedding(text: string): Promise<number[] | null>;
  isAvailable(): boolean;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private readonly client: OllamaClient;
  private readonly model: string;

  constructor(client: OllamaClient, model: string) {
    this.client = client;
    this.model = model;
  }

  get modelName(): string {
    return this.model;
  }

  get dimensions(): number {
    // nomic-embed-text default dimension
    return 768;
  }

  async embed(text: string): Promise<number[] | null> {
    return this.client.getEmbedding(text);
  }

  async embedBatch(texts: string[]): Promise<Array<number[] | null>> {
    const results: Array<number[] | null> = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  isAvailable(): boolean {
    return this.client.isAvailable();
  }

  close(): void {
    // No resources to release for HTTP client
  }
}

function log(msg: string): void {
  process.stderr.write(`[ollama-embed] ${msg}\n`);
}

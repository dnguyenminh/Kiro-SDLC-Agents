/**
 * EmbeddingFactory — creates EmbeddingService with priority: Ollama → ONNX → null.
 * Matches Python/Kotlin behavior for provider selection.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EmbeddingProvider } from './provider.js';
import { OnnxEmbeddingProvider } from './onnx-provider.js';
import { OllamaEmbeddingProvider, OllamaClient } from './ollama-provider.js';
import { EmbeddingService } from './service.js';
import { VectorRepository } from '../vector-repo.js';

/** Config shape expected by factory. */
interface EmbeddingConfig {
  workspace: string;
  ollamaUrl?: string | null;
  ollamaModel?: string;
}

export class EmbeddingFactory {
  /** Try providers in priority order, return first available. */
  static create(config: EmbeddingConfig, vectorRepo: VectorRepository): EmbeddingService | null {
    const service = EmbeddingFactory.tryOllama(config, vectorRepo);
    if (service) return service;
    const onnxService = EmbeddingFactory.tryOnnx(config, vectorRepo);
    if (onnxService) return onnxService;
    return null;
  }

  /** Attempt Ollama provider if URL is configured. */
  private static tryOllama(config: EmbeddingConfig, vectorRepo: VectorRepository): EmbeddingService | null {
    if (!config.ollamaUrl) return null;
    const model = config.ollamaModel ?? 'nomic-embed-text';
    const client = createOllamaClient(config.ollamaUrl, model);
    if (!client.isAvailable()) return null;
    const provider = new OllamaEmbeddingProvider(client, model);
    log(`Embedding: Ollama (${model})`);
    return new EmbeddingService(provider, vectorRepo);
  }

  /** Attempt local ONNX provider if model files exist. */
  private static tryOnnx(config: EmbeddingConfig, vectorRepo: VectorRepository): EmbeddingService | null {
    const modelPath = EmbeddingFactory.resolveModel(config.workspace);
    const vocabPath = EmbeddingFactory.resolveVocab(config.workspace);
    if (!modelPath || !vocabPath) {
      log('ONNX model not found. Place model.onnx + vocab.txt in .code-intel/models/');
      return null;
    }
    try {
      const provider = new OnnxEmbeddingProvider(modelPath, vocabPath);
      if (!provider.isAvailable()) return null;
      log('Embedding: ONNX local (all-MiniLM-L6-v2, 384d)');
      return new EmbeddingService(provider, vectorRepo);
    } catch (e: any) {
      log(`ONNX init failed: ${e.message}`);
      return null;
    }
  }

  /** Find model.onnx in workspace or home .code-intel/models/. */
  private static resolveModel(workspace: string): string | null {
    const candidates = [
      path.join(workspace, '.code-intel', 'models', 'model.onnx'),
      path.join(workspace, '.code-intel', 'models', 'all-MiniLM-L6-v2.onnx'),
      path.join(os.homedir(), '.code-intel', 'models', 'model.onnx'),
    ];
    return candidates.find(p => fs.existsSync(p)) ?? null;
  }

  /** Find vocab.txt in workspace or home .code-intel/models/. */
  private static resolveVocab(workspace: string): string | null {
    const candidates = [
      path.join(workspace, '.code-intel', 'models', 'vocab.txt'),
      path.join(os.homedir(), '.code-intel', 'models', 'vocab.txt'),
    ];
    return candidates.find(p => fs.existsSync(p)) ?? null;
  }
}

/** Create a minimal Ollama HTTP client for embeddings. */
function createOllamaClient(baseUrl: string, model: string): OllamaClient {
  return {
    async getEmbedding(text: string): Promise<number[] | null> {
      try {
        const url = `${baseUrl}/api/embeddings`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: text }),
        });
        if (!resp.ok) return null;
        const data = await resp.json() as { embedding?: number[] };
        return data.embedding ?? null;
      } catch {
        return null;
      }
    },
    isAvailable(): boolean {
      // Synchronous check — assume available if URL is configured
      return !!baseUrl;
    },
  };
}

function log(msg: string): void {
  process.stderr.write(`[embed-factory] ${msg}\n`);
}
